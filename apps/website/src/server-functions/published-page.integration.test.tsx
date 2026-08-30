import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { ensureCompactPublishedScenarios } from '@repo/cms-scenarios/compact-seed';
import { CmsService } from '@repo/cms-service';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublishedPage } from '@/components/published-page';
import { createPublicPageViewModel } from '@/data/public-page';
import { resolvePublicTemplate } from '@/data/public-path';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  ensureCompactPublishedScenarios(client);
});

afterEach(() => client.close());

describe('published SQLite documents rendered by the standalone website', () => {
  const examples = [
    {
      canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
      expectedBlockCount: 7,
      expectedContent: 'Premium rideshare vehicles in California',
    },
    {
      canonicalUrl: '/en-US/store/1001',
      expectedBlockCount: 4,
      expectedContent: 'Buy now McDonald&#x27;s Market — San Francisco',
    },
    {
      canonicalUrl: '/en-US/airport/hero-alt',
      expectedBlockCount: 23,
      expectedContent: 'Plan your LAX pickup',
    },
  ] as const;

  for (const example of examples) {
    test(`renders ${example.canonicalUrl} from its active publication`, () => {
      const template = resolvePublicTemplate(example.canonicalUrl);
      if (!template) throw new Error('Expected the example to map to a public template.');

      const served = new CmsService(client).serve(template.templateId, example.canonicalUrl);
      expect(served.status).toBe(200);
      if (served.status !== 200) throw new Error('Expected an active publication.');

      const page = createPublicPageViewModel({
        scenarioId: template.scenarioId,
        publicationId: served.publicationId,
        canonicalUrl: served.canonicalUrl,
        documentHash: served.documentHash,
        document: served.document,
      });
      const markup = renderToStaticMarkup(<PublishedPage page={page} />);

      expect(page.placements).toHaveLength(example.expectedBlockCount);
      expect(page.documentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(markup).toContain(example.expectedContent);
      expect(markup).toContain('data-cms-mode="published"');
      expect(markup).toContain('data-cms-editable="false"');
      for (const placement of page.placements) {
        expect(markup).toContain(`data-placement="${placement.placementKey}"`);
      }
    });
  }

  test('renders broad/default outcomes independently of exact-selector outcomes', () => {
    const service = new CmsService(client);
    const eligible = service.serve('eligible-vehicles', '/es-US/eligible-vehicles/tx/delivery');
    const store = service.serve('tpl-store', '/en-US/store/1002');
    expect(eligible.status).toBe(200);
    expect(store.status).toBe(200);
    if (eligible.status !== 200 || store.status !== 200) {
      throw new Error('Expected the default publications.');
    }

    expect(
      eligible.document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.content
    ).toEqual({ headline: 'Drive with Uber in TX' });
    expect(
      store.document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.content
    ).toEqual({ headline: 'I am Neighborhood Kitchen — Oakland' });
    expect(
      eligible.document.placements.every((placement) => placement.provenance.sourcePriority === 0)
    ).toBe(true);
  });

  test('serves added explorer pages from each template default', () => {
    const service = new CmsService(client);
    const pages = [
      service.serve('tpl-store', '/fr-CA/store/1014'),
      service.serve('eligible-vehicles', '/fr-CA/eligible-vehicles/qc/rideshare'),
      service.serve('structural-marketing', '/pt-BR/airport/guarulhos'),
    ];

    expect(pages.every((page) => page.status === 200)).toBe(true);
    for (const page of pages) {
      if (page.status !== 200) throw new Error('Expected the added page to be published.');
      expect(
        page.document.placements.every((placement) => placement.provenance.sourcePriority === 0)
      ).toBe(true);
    }

    const store = pages[0];
    const eligible = pages[1];
    if (store?.status !== 200 || eligible?.status !== 200) {
      throw new Error('Expected default Store and Eligible Vehicles pages.');
    }
    expect(
      store.document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.content
    ).toEqual({ headline: 'I am Boulangerie du Vieux-Port — Québec' });
    expect(
      eligible.document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.content
    ).toEqual({ headline: 'Drive with Uber in QC' });
  });
});
