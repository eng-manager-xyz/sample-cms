import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';

import { CmsService, CmsServiceError, type ProvisionTemplateInput } from './index';

let client: CmsDatabaseClient;
let service: CmsService;
let generatedId = 0;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  generatedId = 0;
  service = new CmsService(client, {
    now: () => '2026-08-31T12:00:00.000Z',
    createId: (scope) => `${scope}:provisioning:${++generatedId}`,
  });
});

afterEach(() => client.close());

const provisionInput = (
  overrides: Partial<ProvisionTemplateInput> = {}
): ProvisionTemplateInput => ({
  template: {
    id: 'tpl-self-serve',
    key: 'self-serve',
    name: 'Self serve',
    domain: 'pages.example.test',
  },
  slots: [
    {
      id: 'slot-self-locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      variableKind: 'locale',
    },
    {
      id: 'slot-self-team',
      key: 'team',
      label: 'Team',
      kind: 'static',
      staticValue: 'team',
    },
    {
      id: 'slot-self-slug',
      key: 'slug',
      label: 'Slug',
      kind: 'variable',
      variableKind: 'slug',
    },
  ],
  localeCsv: 'locale\nen-US\nfr-FR\n',
  slugCsv: 'slug\na\nb\n',
  sourceObservedAt: '2026-08-31T11:59:00.000Z',
  ...overrides,
});

const captureCmsServiceError = (operation: () => unknown): CmsServiceError => {
  try {
    operation();
  } catch (error) {
    if (error instanceof CmsServiceError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected CmsServiceError.');
};

describe('AUT-561 atomic template provisioning', () => {
  test('creates one complete aggregate with stable pages, frozen slots, and reserved tags fields', () => {
    const result = service.provisionTemplate(provisionInput());

    expect(result).toMatchObject({
      rowCount: 4,
      template: { id: 'tpl-self-serve', urlPattern: '/{locale}/team/{slug}' },
      defaultVariant: {
        id: 'tpl-self-serve:default',
        activeRevisionId: 'tpl-self-serve:default:r1',
        isDefault: true,
      },
    });
    expect(result.slots.map((slot) => [slot.pathPosition, slot.variableKind])).toEqual([
      [0, 'locale'],
      [1, null],
      [2, 'slug'],
    ]);
    expect(service.listPages('tpl-self-serve', { limit: 10 }).items).toMatchObject([
      { canonicalUrl: '/en-US/team/a', slotValues: { locale: 'en-US', slug: 'a' } },
      { canonicalUrl: '/en-US/team/b', slotValues: { locale: 'en-US', slug: 'b' } },
      { canonicalUrl: '/fr-FR/team/a', slotValues: { locale: 'fr-FR', slug: 'a' } },
      { canonicalUrl: '/fr-FR/team/b', slotValues: { locale: 'fr-FR', slug: 'b' } },
    ]);
    expect(result.approvedReadSurface.fields.map((field) => field.name)).toEqual(
      expect.arrayContaining(['locale', 'slug', 'tags', 'tag.tags'])
    );
    expect(() =>
      service.createTemplateSlot('tpl-self-serve', {
        id: 'late-slot',
        key: 'late',
        label: 'Late',
        kind: 'static',
        pathPosition: 3,
        staticValue: 'late',
      })
    ).toThrow('frozen');
    expect(() =>
      service.updateTemplateSlot('tpl-self-serve', 'slot-self-team', {
        key: 'team',
        label: 'Changed',
        kind: 'static',
        pathPosition: 1,
        staticValue: 'team',
      })
    ).toThrow('frozen');
  });

  test('rolls back the template, slots, default, ingestion, and early routes after a late collision', () => {
    const input = provisionInput({
      template: {
        id: 'tpl-collision',
        key: 'collision',
        name: 'Collision',
        domain: 'www.ubereats.com',
      },
      slots: [
        {
          id: 'slot-collision-locale',
          key: 'locale',
          label: 'Locale',
          kind: 'variable',
          variableKind: 'locale',
        },
        {
          id: 'slot-collision-store',
          key: 'store',
          label: 'Store',
          kind: 'static',
          staticValue: 'store',
        },
        {
          id: 'slot-collision-slug',
          key: 'slug',
          label: 'Slug',
          kind: 'variable',
          variableKind: 'slug',
        },
      ],
      localeCsv: 'locale\nen-US\n',
      slugCsv: 'slug\n1000\n1001\n',
    });

    const error = captureCmsServiceError(() => service.provisionTemplate(input));
    expect(error.code).toBe('CONFLICT');
    expect(error.issues).toEqual([
      expect.objectContaining({ path: 'routes.1', code: 'collision' }),
    ]);
    expect(service.getTemplate('tpl-collision')).toBeNull();
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM page_instances
           WHERE template_id = 'tpl-collision' OR canonical_url = '/en-US/store/1000'`
        )
        .get()
    ).toEqual({ count: 0 });
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM route_ingestions WHERE template_id = 'tpl-collision'`
        )
        .get()
    ).toEqual({ count: 0 });
    expect(service.serve('tpl-store', '/en-US/store/1001').status).toBe(200);
  });

  test('maps aggregate identity collisions to template and slot input paths', () => {
    const templateIdentityError = captureCmsServiceError(() =>
      service.provisionTemplate(
        provisionInput({
          template: {
            id: 'tpl-store',
            key: 'store',
            name: 'Conflicting store',
            domain: 'conflicting.example.test',
          },
        })
      )
    );
    expect(templateIdentityError.issues.map((issue) => issue.path)).toEqual([
      'template.id',
      'template.key',
    ]);

    service.createTemplate({
      id: 'tpl-domain-owner',
      key: 'domain-owner',
      name: 'Domain owner',
      domain: 'pages.example.test',
      urlPattern: '/{locale}/team/{slug}',
    });
    const domainError = captureCmsServiceError(() => service.provisionTemplate(provisionInput()));
    expect(domainError.issues).toEqual([
      expect.objectContaining({ path: 'template.domain', code: 'collision' }),
    ]);

    const slotIdError = captureCmsServiceError(() =>
      service.provisionTemplate(
        provisionInput({
          template: {
            id: 'tpl-slot-conflict',
            key: 'slot-conflict',
            name: 'Slot conflict',
            domain: 'slot-conflict.example.test',
          },
          slots: [
            {
              id: 'slot-store-locale',
              key: 'locale',
              label: 'Locale',
              kind: 'variable',
              variableKind: 'locale',
            },
            {
              id: 'slot-conflict-team',
              key: 'team',
              label: 'Team',
              kind: 'static',
              staticValue: 'team',
            },
            {
              id: 'slot-conflict-slug',
              key: 'slug',
              label: 'Slug',
              kind: 'variable',
              variableKind: 'slug',
            },
          ],
        })
      )
    );
    expect(slotIdError.issues).toEqual([
      expect.objectContaining({ path: 'slots.0.id', code: 'collision' }),
    ]);
  });

  test('persists a larger route set through the bounded prepared-statement path', () => {
    const slugs = Array.from(
      { length: 2_000 },
      (_, index) => `member-${index.toString().padStart(4, '0')}`
    );
    const result = service.provisionTemplate(
      provisionInput({
        localeCsv: 'locale\nen-US\n',
        slugCsv: `slug\n${slugs.join('\n')}\n`,
      })
    );

    expect(result.rowCount).toBe(2_000);
    expect(
      client.sqlite
        .query<{ pages: number; slotValues: number; auditRows: number }, [string]>(
          `SELECT
            (SELECT count(*) FROM page_instances WHERE template_id = 'tpl-self-serve') AS pages,
            (SELECT count(*) FROM page_slot_values WHERE template_id = 'tpl-self-serve') AS slotValues,
            (SELECT count(*) FROM route_audit_log WHERE ingestion_id = ?) AS auditRows`
        )
        .get(result.ingestionId)
    ).toEqual({ pages: 2_000, slotValues: 6_000, auditRows: 2_000 });
    expect(
      client.sqlite
        .query<{ id: string }, [string]>(
          `SELECT id FROM route_audit_log
           WHERE ingestion_id = ? ORDER BY id DESC LIMIT 1`
        )
        .get(result.ingestionId)
    ).toEqual({ id: `${result.ingestionId}:audit:00001999` });
  });

  test('keeps inherited block identity until copy-on-write and serves only the forked winner', () => {
    service.provisionTemplate(
      provisionInput({ localeCsv: 'locale\nen-US\n', slugCsv: 'slug\na\nb\n' })
    );
    const defaultPlacement = service.createDefaultPlacement('tpl-self-serve', {
      placementKey: 'avatar',
      lineage: { id: 'lineage-self-avatar', key: 'avatar', label: 'Avatar' },
      blockVersionId: 'block-self-avatar-v1',
      blockTypeKey: 'avatar',
      content: { name: 'Default Person', role: 'Default role' },
      createdBy: 'author',
    });
    const variant = service.createVariant('tpl-self-serve', {
      id: 'variant-self-a',
      revisionId: 'revision-self-a-1',
      key: 'slug-a',
      name: 'Slug A',
      priority: 10,
      status: 'active',
      selector: "slug = 'a'",
      createdBy: 'author',
      mode: 'linked',
    });
    const pages = service.listPages('tpl-self-serve', { limit: 10 }).items;
    const pageA = pages.find((page) => page.canonicalUrl === '/en-US/team/a');
    const pageB = pages.find((page) => page.canonicalUrl === '/en-US/team/b');
    if (!pageA || !pageB) {
      throw new Error('Expected both provisioned identity-test pages.');
    }
    expect(
      service.resolvePage('tpl-self-serve', pageA.id).document.placements[0]?.blockVersion.id
    ).toBe(defaultPlacement.blockVersion.id);
    expect(
      service.resolvePage('tpl-self-serve', pageB.id).document.placements[0]?.blockVersion.id
    ).toBe(defaultPlacement.blockVersion.id);

    const copied = service.copyOnWritePlacement('tpl-self-serve', variant.id, pageA.id, 'avatar', {
      revisionId: 'revision-self-a-2',
      blockVersionId: 'block-self-avatar-v2',
      content: { name: 'Variant Person', role: 'Variant role' },
      createdBy: 'author',
    });
    expect(copied.blockVersion.parentVersionId).toBe(defaultPlacement.blockVersion.id);
    expect(
      service.resolvePage('tpl-self-serve', pageA.id).document.placements[0]?.blockVersion.id
    ).toBe(copied.blockVersion.id);
    expect(
      service.resolvePage('tpl-self-serve', pageB.id).document.placements[0]?.blockVersion.id
    ).toBe(defaultPlacement.blockVersion.id);

    service.publish('tpl-self-serve', { id: 'publication-self-1', createdBy: 'author' });
    expect(service.serveCanonicalWithEvidence('pages.example.test', '/en-US/team/a')).toMatchObject(
      {
        template: { id: 'tpl-self-serve' },
        result: {
          status: 200,
          document: {
            placements: [
              { blockVersionId: 'block-self-avatar-v2', content: { name: 'Variant Person' } },
            ],
          },
        },
        sqlQueryCount: 2,
        selectorSqlExecutions: 0,
        celEvaluations: 0,
      }
    );
    expect(service.serveCanonicalWithEvidence('pages.example.test', '/en-US/team/b')).toMatchObject(
      {
        result: {
          status: 200,
          document: { placements: [{ blockVersionId: 'block-self-avatar-v1' }] },
        },
      }
    );
  });
});

describe('AUT-560/561 canonical serving seam', () => {
  test('resolves host plus path in the same selector-free one/two-read budget', () => {
    expect(
      service.serveCanonicalWithEvidence('WWW.UBEREATS.COM', '/en-US/store/1001')
    ).toMatchObject({
      template: { id: 'tpl-store', key: 'store', domain: 'www.ubereats.com' },
      result: { status: 200, publicationId: 'publication-store-1' },
      materializationMode: 'manifest',
      sqlQueryCount: 2,
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });
    expect(service.serveCanonicalWithEvidence('wrong.example', '/en-US/store/1001')).toMatchObject({
      template: null,
      result: { status: 404, reason: 'missing' },
      sqlQueryCount: 1,
    });
    expect(service.getCanonicalServeReadQueryTexts('manifest').join('\n')).not.toMatch(
      /selector|variant_revisions/i
    );
  });
});
