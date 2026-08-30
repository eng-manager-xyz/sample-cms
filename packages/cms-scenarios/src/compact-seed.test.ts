import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { CmsService } from '@repo/cms-service';

import {
  compactScenarioIsComplete,
  compactScenarioRegistry,
  ensureCompactPublishedScenario,
  ensureCompactPublishedScenarios,
} from './compact-seed';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
});

afterEach(() => client.close());

function tableCount(database: CmsDatabaseClient, table: string): number {
  return (
    database.sqlite.query<{ count: number }, []>(`SELECT count(*) AS count FROM ${table}`).get()
      ?.count ?? 0
  );
}

describe('compact published scenario seed', () => {
  test('provisions all three current publications and replays without writes', () => {
    ensureCompactPublishedScenarios(client);
    const service = new CmsService(client);

    for (const [scenarioId, registration] of Object.entries(compactScenarioRegistry)) {
      expect(
        compactScenarioIsComplete(client, scenarioId as keyof typeof compactScenarioRegistry)
      ).toBe(true);
      expect(service.serve(registration.templateId, registration.canonicalUrl).status).toBe(200);
    }

    const countsBeforeReplay = {
      templates: tableCount(client, 'templates'),
      pages: tableCount(client, 'page_instances'),
      variants: tableCount(client, 'variants'),
      operations: tableCount(client, 'variant_operations'),
      publications: tableCount(client, 'publications'),
      documents: tableCount(client, 'published_page_documents'),
    };
    const publicationsBeforeReplay = client.sqlite
      .query<{ templateId: string; publicationId: string }, []>(
        `SELECT template_id AS templateId, publication_id AS publicationId
         FROM current_publications
         ORDER BY template_id`
      )
      .all();

    ensureCompactPublishedScenarios(client);

    expect({
      templates: tableCount(client, 'templates'),
      pages: tableCount(client, 'page_instances'),
      variants: tableCount(client, 'variants'),
      operations: tableCount(client, 'variant_operations'),
      publications: tableCount(client, 'publications'),
      documents: tableCount(client, 'published_page_documents'),
    }).toEqual(countsBeforeReplay);
    expect(
      client.sqlite
        .query<{ templateId: string; publicationId: string }, []>(
          `SELECT template_id AS templateId, publication_id AS publicationId
           FROM current_publications
           ORDER BY template_id`
        )
        .all()
    ).toEqual(publicationsBeforeReplay);
  });

  test('materializes the dense, sparse, and structural block patterns', () => {
    ensureCompactPublishedScenarios(client);
    const service = new CmsService(client);

    const dense = service.serve('eligible-vehicles', '/en-US/eligible-vehicles/ca/premium');
    expect(dense.status).toBe(200);
    if (dense.status !== 200) throw new Error('Dense page was not published.');
    expect(dense.document.placements).toHaveLength(7);
    expect(
      dense.document.placements.every((placement) => placement.provenance.sourcePriority === 40)
    ).toBe(true);
    expect(
      dense.document.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({
      blockType: 'hero',
      content: { headline: 'Premium rideshare vehicles in California' },
    });
    const denseDefault = service.serve('eligible-vehicles', '/es-US/eligible-vehicles/tx/delivery');
    expect(denseDefault.status).toBe(200);
    if (denseDefault.status !== 200) throw new Error('Dense default page was not published.');
    expect(denseDefault.document.placements).toHaveLength(7);
    expect(
      denseDefault.document.placements.every(
        (placement) => placement.provenance.sourcePriority === 0
      )
    ).toBe(true);
    expect(
      denseDefault.document.placements.find(
        (placement) => placement.placementKey === 'primary-hero'
      )
    ).toMatchObject({ content: { headline: 'Drive with Uber in TX' } });

    const sparse = service.serve('tpl-store', '/en-US/store/1001');
    expect(sparse.status).toBe(200);
    if (sparse.status !== 200) throw new Error('Sparse Store page was not published.');
    expect(sparse.document.placements).toHaveLength(4);
    expect(
      sparse.document.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({ content: { headline: "Buy now McDonald's Market — San Francisco" } });
    const sparseDefault = service.serve('tpl-store', '/en-US/store/1002');
    expect(sparseDefault.status).toBe(200);
    if (sparseDefault.status !== 200) throw new Error('Sparse default page was not published.');
    expect(
      sparseDefault.document.placements.find(
        (placement) => placement.placementKey === 'primary-hero'
      )
    ).toMatchObject({ content: { headline: 'I am Neighborhood Kitchen — Oakland' } });
    expect(
      sparse.document.placements
        .filter((placement) =>
          sparseDefault.document.placements.some(
            (candidate) => candidate.blockVersionId === placement.blockVersionId
          )
        )
        .map((placement) => placement.placementKey)
    ).toContain('navigation');

    const structural = service.serve('structural-marketing', '/en-US/airport/hero-alt');
    expect(structural.status).toBe(200);
    if (structural.status !== 200) throw new Error('Structural page was not published.');
    expect(structural.document.placements).toHaveLength(23);
    expect(
      structural.document.placements.some(
        (placement) => placement.placementKey === 'announcement-promo'
      )
    ).toBe(false);
    expect(
      structural.document.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({
      placementKey: 'primary-hero',
      blockType: 'hero_alt',
      content: { headline: 'Plan your LAX pickup', mapAssetKey: 'lax-pickup-map' },
      provenance: { sourcePriority: 30 },
    });
    expect(
      structural.document.placements.filter(
        (placement) => placement.provenance.sourcePriority === 0
      )
    ).toHaveLength(22);
  });

  test('reproduces compact IDs and publication hashes in a fresh database', async () => {
    ensureCompactPublishedScenarios(client);
    const replayClient = await createTestDatabase();
    try {
      await seedFoundationDatabase(replayClient);
      ensureCompactPublishedScenarios(replayClient);

      const snapshot = (database: CmsDatabaseClient) => ({
        operations: database.sqlite
          .query<{ id: string }, []>(
            `SELECT operations.id
             FROM variant_operations AS operations
             JOIN variant_revisions AS revisions ON revisions.id = operations.variant_revision_id
             JOIN variants ON variants.id = revisions.variant_id
             WHERE variants.template_id IN ('eligible-vehicles', 'structural-marketing')
             ORDER BY operations.id`
          )
          .all(),
        publications: database.sqlite
          .query<{ templateId: string; publicationId: string; documentHash: string }, []>(
            `SELECT current.template_id AS templateId,
                    current.publication_id AS publicationId,
                    documents.document_hash AS documentHash
             FROM current_publications AS current
             JOIN published_page_documents AS documents
               ON documents.template_id = current.template_id
              AND documents.publication_id = current.publication_id
             WHERE current.template_id IN ('eligible-vehicles', 'structural-marketing')
             ORDER BY current.template_id, documents.canonical_url`
          )
          .all(),
      });

      expect(snapshot(replayClient)).toEqual(snapshot(client));
      expect(snapshot(client).operations[0]?.id).toMatch(
        /^(eligible-vehicles|structural-marketing):seed:operation:\d+$/
      );
    } finally {
      replayClient.close();
    }
  });

  test('rolls back a partial compact seed and retries deterministically', () => {
    client.sqlite.exec(`
      CREATE TRIGGER fail_compact_eligible_seed
      BEFORE INSERT ON page_instances
      WHEN NEW.template_id = 'eligible-vehicles'
      BEGIN
        SELECT RAISE(ABORT, 'forced compact seed failure');
      END;
    `);

    expect(() => ensureCompactPublishedScenario(client, 'eligible-vehicles')).toThrow();
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM templates WHERE id = 'eligible-vehicles'"
        )
        .get()?.count
    ).toBe(0);

    client.sqlite.exec('DROP TRIGGER fail_compact_eligible_seed');
    const registration = ensureCompactPublishedScenario(client, 'eligible-vehicles');
    expect(registration).toBe(compactScenarioRegistry['eligible-vehicles']);
    expect(compactScenarioIsComplete(client, 'eligible-vehicles')).toBe(true);
  });

  test('serving current pages is read-only and never evaluates selector SQL', () => {
    ensureCompactPublishedScenarios(client);
    const service = new CmsService(client);
    const mutationCountsBefore = {
      operations: tableCount(client, 'variant_operations'),
      publications: tableCount(client, 'publications'),
      documents: tableCount(client, 'published_page_documents'),
    };

    for (const registration of Object.values(compactScenarioRegistry)) {
      const evidence = service.serveWithEvidence(
        registration.templateId,
        registration.canonicalUrl
      );
      expect(evidence).toMatchObject({
        result: { status: 200 },
        selectorSqlExecutions: 0,
      });
      expect(evidence.sqlQueryCount === 1 || evidence.sqlQueryCount === 2).toBe(true);
    }

    expect({
      operations: tableCount(client, 'variant_operations'),
      publications: tableCount(client, 'publications'),
      documents: tableCount(client, 'published_page_documents'),
    }).toEqual(mutationCountsBefore);
  });
});
