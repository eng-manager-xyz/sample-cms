import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { CmsService } from '@repo/cms-service';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublishedPage } from '@/components/published-page';
import { previewResponseHeaders } from '@/data/preview-page-policy';
import { resolvePublicTemplate } from '@/data/public-path';
import { resolveCanonicalTemplatePage } from './canonical-template.server';
import { readPreviewPage } from './preview-page.server';
import { readPublishedPage } from './published-page.server';

interface DynamicTemplateFixture {
  readonly templateId: string;
  readonly templateKey: string;
  readonly domain: string;
  readonly canonicalUrl: string;
  readonly pageId: string;
}

let client: CmsDatabaseClient;
let service: CmsService;
let generatedId = 0;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  generatedId = 0;
  service = new CmsService(client, {
    now: () => '2026-08-31T18:00:00.000Z',
    createId: (scope) => `dynamic-page:${scope}:${++generatedId}`,
  });
  if (
    !client.sqlite
      .query<{ id: string }, []>("SELECT id FROM block_types WHERE key = 'avatar'")
      .get()
  ) {
    service.registerBlockType({
      id: 'block-type-avatar',
      key: 'avatar',
      name: 'Avatar',
      schemaVersion: 1,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role'],
        properties: {
          name: { type: 'string', minLength: 1 },
          role: { type: 'string', minLength: 1 },
        },
      },
      previewRenderer: { kind: 'wireframe', component: 'avatar' },
    });
  }
});

afterEach(() => client.close());

function createDynamicTemplate(input: {
  readonly suffix: string;
  readonly domain: string;
}): DynamicTemplateFixture {
  const templateId = `tpl-author-${input.suffix}`;
  const templateKey = `author-${input.suffix}`;
  const pageId = `page-author-${input.suffix}`;
  const canonicalUrl = '/en-US/contributors/Jos%C3%A9%20Silva';
  service.createTemplate({
    id: templateId,
    key: templateKey,
    name: `Author ${input.suffix}`,
    domain: input.domain,
    urlPattern: '/{locale}/contributors/{slug}',
  });
  service.createTemplateSlot(templateId, {
    id: `${templateId}:slot:locale`,
    key: 'locale',
    label: 'Locale',
    kind: 'variable',
    pathPosition: 0,
  });
  service.createTemplateSlot(templateId, {
    id: `${templateId}:slot:contributors`,
    key: 'contributors',
    label: 'Contributors',
    kind: 'static',
    pathPosition: 1,
    staticValue: 'contributors',
  });
  service.createTemplateSlot(templateId, {
    id: `${templateId}:slot:slug`,
    key: 'slug',
    label: 'Contributor',
    kind: 'variable',
    pathPosition: 2,
  });
  service.createPage(templateId, {
    id: pageId,
    canonicalUrl,
    routeExternalId: `router:${pageId}`,
    routeStatus: 'live',
    routeRevision: 'router-v1',
    context: {},
    slotValues: { locale: 'en-US', slug: 'José Silva' },
  });
  service.createDefaultPlacement(templateId, {
    revisionId: `${templateId}:default:r2`,
    placementKey: 'profile-avatar',
    lineage: {
      id: `${templateId}:lineage:avatar`,
      key: 'profile-avatar',
      label: 'Profile avatar',
    },
    blockVersionId: `${templateId}:block:avatar:v1`,
    blockTypeKey: 'avatar',
    content: { name: 'José Silva', role: 'Template author' },
    createdBy: 'dynamic-page-test',
  });
  service.createDefaultPlacement(templateId, {
    revisionId: `${templateId}:default:r3`,
    placementKey: 'primary-hero',
    lineage: {
      id: `${templateId}:lineage:hero`,
      key: 'primary-hero',
      label: 'Primary hero',
    },
    blockVersionId: `${templateId}:block:hero:v1`,
    blockTypeKey: 'hero',
    content: { headline: 'A dynamically created author page' },
    createdBy: 'dynamic-page-test',
  });
  service.createDefaultPlacement(templateId, {
    revisionId: `${templateId}:default:r4`,
    placementKey: 'footer',
    lineage: {
      id: `${templateId}:lineage:footer`,
      key: 'footer',
      label: 'Footer',
    },
    blockVersionId: `${templateId}:block:footer:v1`,
    blockTypeKey: 'footer',
    content: { legal: 'Author profile terms' },
    createdBy: 'dynamic-page-test',
  });
  return { templateId, templateKey, domain: input.domain, canonicalUrl, pageId };
}

describe('dynamic canonical website resolution', () => {
  test('serves and renders a materialized publication outside the static proof registry', () => {
    const fixture = createDynamicTemplate({ suffix: 'published', domain: 'authors.example.test' });
    service.publish(fixture.templateId, {
      id: 'publication-author-published-1',
      createdBy: 'dynamic-page-test',
      materializationMode: 'expanded',
    });

    const published = readPublishedPage(client, {
      canonicalUrl: fixture.canonicalUrl,
      host: fixture.domain,
      nodeEnv: 'production',
    });
    expect(published.result.status).toBe(200);
    if (published.result.status !== 200) throw new Error('Expected a dynamic publication.');
    expect(published.result.page).toMatchObject({
      scenarioId: fixture.templateKey,
      templateId: fixture.templateId,
      pageId: fixture.pageId,
      publicationId: 'publication-author-published-1',
      canonicalUrl: fixture.canonicalUrl,
      renderMode: 'published',
    });
    expect(published.evidence).toMatchObject({
      materializationMode: 'expanded',
      sqlQueryCount: 1,
      serviceSqlQueryCount: 1,
      adapterSqlQueryCount: 0,
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });
    const markup = renderToStaticMarkup(<PublishedPage page={published.result.page} />);
    expect(markup).toContain('data-placement="profile-avatar"');
    expect(markup).toContain('data-placement="primary-hero"');
    expect(markup).toContain('data-placement="footer"');
    expect(markup).toContain('A dynamically created author page');
    expect(markup).not.toContain('Unknown block: avatar');

    const localPublished = readPublishedPage(client, {
      canonicalUrl: fixture.canonicalUrl,
      host: 'localhost:3001',
      nodeEnv: 'development',
    });
    expect(localPublished.result.status).toBe(200);
    expect(localPublished.evidence).toMatchObject({
      materializationMode: 'expanded',
      sqlQueryCount: 2,
      serviceSqlQueryCount: 1,
      adapterSqlQueryCount: 1,
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });
    expect(
      readPublishedPage(client, {
        canonicalUrl: fixture.canonicalUrl,
        host: 'localhost:3001',
        nodeEnv: 'production',
      }).result
    ).toEqual({ status: 404, reason: 'missing' });
    expect(
      readPublishedPage(client, {
        canonicalUrl: fixture.canonicalUrl,
        host: 'localhost:3001',
        nodeEnv: 'production',
        allowLocalhost: true,
      }).result.status
    ).toBe(200);

    expect(
      readPublishedPage(client, {
        canonicalUrl: fixture.canonicalUrl,
        host: 'other.example.test',
        nodeEnv: 'production',
      }).result
    ).toEqual({ status: 404, reason: 'missing' });
    expect(
      readPublishedPage(client, {
        canonicalUrl: fixture.canonicalUrl,
        host: 'authors.example.test/unsafe',
        nodeEnv: 'production',
      }).result
    ).toEqual({ status: 404, reason: 'missing' });
  });

  test('preserves the two-read manifest serving contract for a dynamic template', () => {
    const fixture = createDynamicTemplate({ suffix: 'manifest', domain: 'manifest.example.test' });
    service.publish(fixture.templateId, {
      id: 'publication-author-manifest-1',
      createdBy: 'dynamic-page-test',
      materializationMode: 'manifest',
    });

    const published = readPublishedPage(client, {
      canonicalUrl: fixture.canonicalUrl,
      host: fixture.domain,
      nodeEnv: 'production',
    });
    expect(published.result.status).toBe(200);
    expect(published.evidence).toMatchObject({
      materializationMode: 'manifest',
      sqlQueryCount: 2,
      serviceSqlQueryCount: 2,
      adapterSqlQueryCount: 0,
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });
  });

  test('previews a persisted template outside the static proof registry', () => {
    const fixture = createDynamicTemplate({ suffix: 'profile', domain: 'authors.example.test' });
    expect(resolvePublicTemplate(fixture.canonicalUrl)).toBeNull();

    const preview = readPreviewPage(client, {
      canonicalUrl: fixture.canonicalUrl,
      host: fixture.domain,
      nodeEnv: 'production',
      previewEnabled: true,
    });
    expect(preview.status).toBe(200);
    if (preview.status !== 200) throw new Error('Expected a dynamic author preview.');
    expect(preview.page).toMatchObject({
      scenarioId: fixture.templateKey,
      templateId: fixture.templateId,
      pageId: fixture.pageId,
      canonicalUrl: fixture.canonicalUrl,
      renderMode: 'preview',
    });
    const markup = renderToStaticMarkup(<PublishedPage page={preview.page} />);
    expect(markup).toContain('data-placement="profile-avatar"');
    expect(markup).toContain('<span>JS</span>');
    expect(markup).toContain('José Silva');
    expect(markup).not.toContain('Unknown block: avatar');
    expect(
      readPreviewPage(client, {
        canonicalUrl: fixture.canonicalUrl,
        host: 'localhost:3001',
        nodeEnv: 'test',
        previewEnabled: false,
      }).status
    ).toBe(200);
    expect(previewResponseHeaders).toEqual({
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      Vary: 'Host',
    });
  });

  test('uses domain plus path identity and fails closed for ambiguous localhost paths', () => {
    const first = createDynamicTemplate({ suffix: 'first', domain: 'first.example.test' });
    const second = createDynamicTemplate({ suffix: 'second', domain: 'second.example.test' });

    expect(
      resolveCanonicalTemplatePage(client, {
        host: first.domain,
        canonicalUrl: first.canonicalUrl,
        allowLocalhost: false,
      })
    ).toMatchObject({ templateId: first.templateId, scenarioId: first.templateKey });
    expect(
      resolveCanonicalTemplatePage(client, {
        host: second.domain,
        canonicalUrl: second.canonicalUrl,
        allowLocalhost: false,
      })
    ).toMatchObject({ templateId: second.templateId, scenarioId: second.templateKey });
    expect(
      resolveCanonicalTemplatePage(client, {
        host: 'localhost:3001',
        canonicalUrl: first.canonicalUrl,
        allowLocalhost: true,
      })
    ).toBeNull();
    expect(
      readPreviewPage(client, {
        canonicalUrl: first.canonicalUrl,
        host: 'other.example.test',
        nodeEnv: 'production',
        previewEnabled: true,
      })
    ).toEqual({ status: 404, reason: 'missing' });
  });
});
