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

function legacySeedService(database: CmsDatabaseClient, templateId: string): CmsService {
  const idsByScope = new Map<string, number>();
  return new CmsService(database, {
    now: () => '2026-01-03T00:00:00.000Z',
    createId: (scope) => {
      const sequence = (idsByScope.get(scope) ?? 0) + 1;
      idsByScope.set(scope, sequence);
      return `${templateId}:legacy-seed:${scope}:${sequence}`;
    },
  });
}

function seedLegacyTwoPageScenario(
  database: CmsDatabaseClient,
  scenarioId: 'eligible-vehicles' | 'structural-proof'
): void {
  const registration = compactScenarioRegistry[scenarioId];
  const service = legacySeedService(database, registration.templateId);
  const eligible = scenarioId === 'eligible-vehicles';
  service.createTemplate({
    id: registration.templateId,
    key: registration.templateId,
    name: eligible ? 'Eligible Vehicles' : 'Structural replacement',
    domain: 'www.uber.com',
    urlPattern: eligible
      ? '/{locale}/eligible-vehicles/{state}/{slug}'
      : '/{locale}/airport/{slug}',
    description: 'Legacy compact two-page fixture.',
  });

  const slots = eligible
    ? [
        {
          id: 'editable-eligible-slot-locale',
          key: 'locale',
          label: 'Locale',
          kind: 'variable' as const,
          pathPosition: 0,
        },
        {
          id: 'editable-eligible-slot-resource',
          key: 'resource',
          label: 'Resource',
          kind: 'static' as const,
          pathPosition: 1,
          staticValue: 'eligible-vehicles',
        },
        {
          id: 'editable-eligible-slot-state',
          key: 'state',
          label: 'State',
          kind: 'variable' as const,
          pathPosition: 2,
        },
        {
          id: 'editable-eligible-slot-slug',
          key: 'slug',
          label: 'Slug',
          kind: 'variable' as const,
          pathPosition: 3,
        },
        {
          id: 'editable-eligible-slot-country',
          key: 'country',
          label: 'Country',
          kind: 'derived' as const,
        },
        {
          id: 'editable-eligible-slot-language',
          key: 'language',
          label: 'Language',
          kind: 'derived' as const,
        },
      ]
    : [
        {
          id: 'editable-structural-slot-locale',
          key: 'locale',
          label: 'Locale',
          kind: 'variable' as const,
          pathPosition: 0,
        },
        {
          id: 'editable-structural-slot-resource',
          key: 'resource',
          label: 'Resource',
          kind: 'static' as const,
          pathPosition: 1,
          staticValue: 'airport',
        },
        {
          id: 'editable-structural-slot-slug',
          key: 'slug',
          label: 'Slug',
          kind: 'variable' as const,
          pathPosition: 2,
        },
        {
          id: 'editable-structural-slot-code',
          key: 'airport_code',
          label: 'Airport code',
          kind: 'derived' as const,
        },
      ];
  for (const slot of slots) service.createTemplateSlot(registration.templateId, slot);

  if (eligible) {
    for (const page of [
      { locale: 'en-US', state: 'CA', purpose: 'premium', country: 'US', language: 'en' },
      { locale: 'es-US', state: 'TX', purpose: 'delivery', country: 'US', language: 'es' },
    ] as const) {
      const id = `eligible:${page.locale}:${page.state}:${page.purpose}`;
      service.createPage(registration.templateId, {
        id,
        canonicalUrl: `/${page.locale}/eligible-vehicles/${page.state.toLowerCase()}/${page.purpose}`,
        routeExternalId: `router:${id}`,
        routeStatus: 'live',
        routeRevision: 'editable-eligible-v1',
        context: {
          locale: page.locale,
          state: page.state,
          purpose: page.purpose,
          country: page.country,
        },
        slotValues: {
          locale: page.locale,
          resource: 'eligible-vehicles',
          state: page.state.toLowerCase(),
          slug: page.purpose,
          country: page.country,
          language: page.language,
        },
      });
    }
  } else {
    for (const page of [
      { slug: 'current', airportCode: 'PDX' },
      { slug: 'hero-alt', airportCode: 'LAX' },
    ] as const) {
      service.createPage(registration.templateId, {
        id: `structural-page:${page.slug}`,
        canonicalUrl: `/en-US/airport/${page.slug}`,
        routeExternalId: `router:structural:${page.slug}`,
        routeStatus: 'live',
        routeRevision: 'editable-structural-v1',
        context: { locale: 'en-US', slug: page.slug, airportCode: page.airportCode },
        slotValues: {
          locale: 'en-US',
          resource: 'airport',
          slug: page.slug,
          airport_code: page.airportCode,
        },
      });
    }
  }

  service.createDefaultPlacement(registration.templateId, {
    revisionId: `${registration.templateId}:legacy-default:r2`,
    placementKey: 'primary-hero',
    lineage: {
      id: `${registration.templateId}:legacy-lineage:primary-hero`,
      key: 'primary-hero',
      label: 'primary-hero',
    },
    blockVersionId: `${registration.templateId}:legacy-block:primary-hero:v1`,
    blockTypeKey: 'hero',
    content: {
      headline: eligible ? 'Drive with Uber in {{ state }}' : 'Airport rides made simple',
    },
    createdBy: 'legacy-compact-seed',
    position: { kind: 'end' },
  });
  service.createVariant(registration.templateId, {
    id: registration.requiredVariantId,
    revisionId: `${registration.requiredVariantId}:r1`,
    key: eligible ? 'ca-premium-exact' : 'hero-alt-airports',
    name: eligible ? 'CA premium exact' : 'Hero alt airports',
    priority: eligible ? 40 : 30,
    status: 'active',
    selector: eligible
      ? "country = 'US' AND state = 'ca' AND slug = 'premium'"
      : "airport_code IN ('LAX', 'SFO', 'JFK')",
    createdBy: 'legacy-compact-seed',
    mode: 'linked',
  });
  service.publish(registration.templateId, {
    id: eligible ? 'editable-eligible-publication-1' : 'editable-structural-publication-1',
    createdBy: 'legacy-compact-seed',
  });
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

    expect(
      client.sqlite
        .query<{ currentDocumentCount: number; pageCount: number; templateId: string }, []>(
          `SELECT pages.template_id AS templateId,
                  count(*) AS pageCount,
                  (SELECT count(*)
                   FROM published_page_documents AS documents
                   JOIN current_publications AS current
                     ON current.template_id = documents.template_id
                    AND current.publication_id = documents.publication_id
                   WHERE documents.template_id = pages.template_id) AS currentDocumentCount
           FROM page_instances AS pages
           GROUP BY pages.template_id
           ORDER BY pages.template_id`
        )
        .all()
    ).toEqual([
      { templateId: 'eligible-vehicles', pageCount: 14, currentDocumentCount: 14 },
      { templateId: 'structural-marketing', pageCount: 14, currentDocumentCount: 14 },
      { templateId: 'tpl-store', pageCount: 14, currentDocumentCount: 14 },
    ]);
    expect(tableCount(client, 'page_instances')).toBe(42);
    expect(tableCount(client, 'page_slot_values')).toBe(196);
    expect(tableCount(client, 'page_tags')).toBe(4);
    expect(tableCount(client, 'publications')).toBe(4);
    expect(tableCount(client, 'published_page_documents')).toBe(44);
    expect(
      client.sqlite
        .query<{ publicationId: string; rowCount: number; status: string }, []>(
          `SELECT current.publication_id AS publicationId,
                  ingestions.row_count AS rowCount,
                  ingestions.status
           FROM current_publications AS current
           JOIN route_ingestions AS ingestions
             ON ingestions.template_id = current.template_id
            AND ingestions.id = 'ing-store-compact-2'
           WHERE current.template_id = 'tpl-store'`
        )
        .get()
    ).toEqual({ publicationId: 'publication-store-2', rowCount: 12, status: 'succeeded' });

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

  test('keeps the added explorer pages on the template default selectors', () => {
    ensureCompactPublishedScenarios(client);
    const service = new CmsService(client);

    expect(service.previewSelector('tpl-store', "brand = 'mcdonalds'", 50).totalCount).toBe(1);
    expect(
      service.previewSelector(
        'eligible-vehicles',
        "country = 'US' AND state = 'ca' AND slug = 'premium'",
        50
      ).totalCount
    ).toBe(1);
    expect(
      service.previewSelector('structural-marketing', "airport_code IN ('LAX', 'SFO', 'JFK')", 50)
        .totalCount
    ).toBe(1);

    for (const [templateId, pageId] of [
      ['tpl-store', 'page-store-1014'],
      ['eligible-vehicles', 'eligible:fr-CA:QC:rideshare'],
      ['structural-marketing', 'structural-page:guarulhos'],
    ] as const) {
      expect(service.resolvePage(templateId, pageId).document.matchedVariantIds).toEqual([]);
    }
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
             WHERE current.template_id IN (
               'eligible-vehicles', 'structural-marketing', 'tpl-store'
             )
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

  test('reconciles immutable legacy manifests into a serveable rollback chain', async () => {
    ensureCompactPublishedScenarios(client);
    client.sqlite.exec(`
      DROP TRIGGER published_page_documents_immutable_update;
      UPDATE published_page_documents
      SET resolved_data_json = (
        SELECT pages.context_json
        FROM page_instances AS pages
        WHERE pages.template_id = published_page_documents.template_id
          AND pages.id = published_page_documents.page_instance_id
      )
      WHERE template_id IN ('tpl-store', 'eligible-vehicles', 'structural-marketing')
        AND rendered_document_json IS NULL
        AND publication_id = (
          SELECT current.publication_id
          FROM current_publications AS current
          WHERE current.template_id = published_page_documents.template_id
        );
      CREATE TRIGGER published_page_documents_immutable_update
      BEFORE UPDATE ON published_page_documents
      BEGIN
        SELECT RAISE(ABORT, 'published page documents are immutable');
      END;
    `);

    const legacyPublications = client.sqlite
      .query<
        {
          id: string;
          templateId: string;
          inputHash: string;
          previousPublicationId: string | null;
          pageCount: number;
          createdAt: string;
        },
        []
      >(
        `SELECT id, template_id AS templateId, input_hash AS inputHash,
                previous_publication_id AS previousPublicationId,
                page_count AS pageCount, created_at AS createdAt
         FROM publications
         WHERE template_id IN ('tpl-store', 'eligible-vehicles', 'structural-marketing')
           AND sequence = 1
         ORDER BY template_id`
      )
      .all();
    const legacyDocuments = client.sqlite
      .query<
        {
          publicationId: string;
          pageInstanceId: string;
          resolvedDataJson: string;
          renderedDocumentJson: string | null;
          documentHash: string;
          createdAt: string;
        },
        []
      >(
        `SELECT documents.publication_id AS publicationId,
                documents.page_instance_id AS pageInstanceId,
                documents.resolved_data_json AS resolvedDataJson,
                documents.rendered_document_json AS renderedDocumentJson,
                documents.document_hash AS documentHash,
                documents.created_at AS createdAt
         FROM published_page_documents AS documents
         JOIN publications
           ON publications.template_id = documents.template_id
          AND publications.id = documents.publication_id
         WHERE publications.template_id IN (
           'tpl-store', 'eligible-vehicles', 'structural-marketing'
         ) AND publications.sequence = 1
         ORDER BY documents.template_id, documents.page_instance_id`
      )
      .all();

    // Simulate the previously shipped one-publication upgrade for one template. Its current bytes
    // are valid, but its advertised predecessor still has the legacy context payload.
    new CmsService(client).publish('eligible-vehicles', {
      id: 'eligible-vehicles:cel-materialized-publication-v1',
      createdBy: 'legacy-upgrade',
      forceNewPublication: true,
    });
    for (const scenarioId of Object.keys(compactScenarioRegistry) as Array<
      keyof typeof compactScenarioRegistry
    >) {
      expect(compactScenarioIsComplete(client, scenarioId)).toBe(false);
    }

    // This is the real db:seed sequence: foundation first, then compact scenario reconciliation.
    await seedFoundationDatabase(client);
    expect(
      client.sqlite
        .query<
          {
            publicationId: string;
            pageInstanceId: string;
            resolvedDataJson: string;
            renderedDocumentJson: string | null;
            documentHash: string;
            createdAt: string;
          },
          []
        >(
          `SELECT documents.publication_id AS publicationId,
                  documents.page_instance_id AS pageInstanceId,
                  documents.resolved_data_json AS resolvedDataJson,
                  documents.rendered_document_json AS renderedDocumentJson,
                  documents.document_hash AS documentHash,
                  documents.created_at AS createdAt
           FROM published_page_documents AS documents
           JOIN publications
             ON publications.template_id = documents.template_id
            AND publications.id = documents.publication_id
           WHERE publications.template_id IN (
             'tpl-store', 'eligible-vehicles', 'structural-marketing'
           ) AND publications.sequence = 1
           ORDER BY documents.template_id, documents.page_instance_id`
        )
        .all()
    ).toEqual(legacyDocuments);
    ensureCompactPublishedScenarios(client);

    const publicationChain = client.sqlite
      .query<{ templateId: string; publicationId: string; previousPublicationId: string }, []>(
        `SELECT current.template_id AS templateId,
                current.publication_id AS publicationId,
                publications.previous_publication_id AS previousPublicationId
         FROM current_publications AS current
         JOIN publications
           ON publications.template_id = current.template_id
          AND publications.id = current.publication_id
         WHERE current.template_id IN ('tpl-store', 'eligible-vehicles', 'structural-marketing')
         ORDER BY current.template_id`
      )
      .all();
    expect(publicationChain).toEqual([
      {
        templateId: 'eligible-vehicles',
        publicationId: 'eligible-vehicles:cel-materialized-current-v2',
        previousPublicationId: 'eligible-vehicles:cel-materialized-publication-v1',
      },
      {
        templateId: 'structural-marketing',
        publicationId: 'structural-marketing:cel-materialized-current-v2',
        previousPublicationId: 'structural-marketing:cel-materialized-rollback-v2',
      },
      {
        templateId: 'tpl-store',
        publicationId: 'tpl-store:cel-materialized-current-v2',
        previousPublicationId: 'tpl-store:cel-materialized-rollback-v2',
      },
    ]);
    expect(
      client.sqlite
        .query<
          {
            id: string;
            templateId: string;
            inputHash: string;
            previousPublicationId: string | null;
            pageCount: number;
            createdAt: string;
          },
          []
        >(
          `SELECT id, template_id AS templateId, input_hash AS inputHash,
                  previous_publication_id AS previousPublicationId,
                  page_count AS pageCount, created_at AS createdAt
           FROM publications
           WHERE template_id IN ('tpl-store', 'eligible-vehicles', 'structural-marketing')
             AND sequence = 1
           ORDER BY template_id`
        )
        .all()
    ).toEqual(legacyPublications);
    expect(
      client.sqlite
        .query<
          {
            publicationId: string;
            pageInstanceId: string;
            resolvedDataJson: string;
            renderedDocumentJson: string | null;
            documentHash: string;
            createdAt: string;
          },
          []
        >(
          `SELECT documents.publication_id AS publicationId,
                  documents.page_instance_id AS pageInstanceId,
                  documents.resolved_data_json AS resolvedDataJson,
                  documents.rendered_document_json AS renderedDocumentJson,
                  documents.document_hash AS documentHash,
                  documents.created_at AS createdAt
           FROM published_page_documents AS documents
           JOIN publications
             ON publications.template_id = documents.template_id
            AND publications.id = documents.publication_id
           WHERE publications.template_id IN (
             'tpl-store', 'eligible-vehicles', 'structural-marketing'
           ) AND publications.sequence = 1
           ORDER BY documents.template_id, documents.page_instance_id`
        )
        .all()
    ).toEqual(legacyDocuments);
    const currentPayloads = client.sqlite
      .query<{ contract: string; payload: string }, []>(
        `SELECT json_extract(documents.resolved_data_json, '$.contract') AS contract,
                documents.resolved_data_json AS payload
         FROM current_publications AS current
         JOIN published_page_documents AS documents
           ON documents.template_id = current.template_id
          AND documents.publication_id = current.publication_id
         WHERE current.template_id IN ('tpl-store', 'eligible-vehicles', 'structural-marketing')
         ORDER BY current.template_id, documents.canonical_url`
      )
      .all();
    expect(currentPayloads.length).toBeGreaterThan(3);
    expect(
      currentPayloads.every(
        ({ contract, payload }) =>
          contract === 'cms-published-placement-content-v1' && !payload.includes('{{')
      )
    ).toBe(true);

    const countsAfterReconciliation = {
      publications: tableCount(client, 'publications'),
      documents: tableCount(client, 'published_page_documents'),
      manifests: tableCount(client, 'document_manifests'),
      manifestItems: tableCount(client, 'document_manifest_items'),
    };
    await seedFoundationDatabase(client);
    ensureCompactPublishedScenarios(client);
    expect({
      publications: tableCount(client, 'publications'),
      documents: tableCount(client, 'published_page_documents'),
      manifests: tableCount(client, 'document_manifests'),
      manifestItems: tableCount(client, 'document_manifest_items'),
    }).toEqual(countsAfterReconciliation);
    expect(
      client.sqlite
        .query<{ templateId: string; publicationId: string; previousPublicationId: string }, []>(
          `SELECT current.template_id AS templateId,
                  current.publication_id AS publicationId,
                  publications.previous_publication_id AS previousPublicationId
           FROM current_publications AS current
           JOIN publications
             ON publications.template_id = current.template_id
            AND publications.id = current.publication_id
           WHERE current.template_id IN (
             'tpl-store', 'eligible-vehicles', 'structural-marketing'
           )
           ORDER BY current.template_id`
        )
        .all()
    ).toEqual(publicationChain);

    const service = new CmsService(client);
    for (const registration of Object.values(compactScenarioRegistry)) {
      const chain = publicationChain.find(
        ({ templateId }) => templateId === registration.templateId
      );
      if (!chain) throw new Error(`Missing publication chain for ${registration.templateId}.`);
      const current = service.serve(registration.templateId, registration.canonicalUrl);
      const predecessor = service.resolvePublication(
        registration.templateId,
        chain.previousPublicationId,
        registration.canonicalUrl
      );
      expect(current.status).toBe(200);
      expect(predecessor.status).toBe(200);
      if (current.status !== 200 || predecessor.status !== 200) {
        throw new Error(`Expected serveable publication chain for ${registration.templateId}.`);
      }
      expect(predecessor.documentHash).toBe(current.documentHash);
      expect(JSON.stringify(predecessor.document)).toBe(JSON.stringify(current.document));

      expect(service.rollback(registration.templateId, undefined, 'rollback-test')).toMatchObject({
        fromPublicationId: chain.publicationId,
        publicationId: chain.previousPublicationId,
      });
      const rolledBack = service.serve(registration.templateId, registration.canonicalUrl);
      expect(rolledBack.status).toBe(200);
      if (rolledBack.status !== 200) {
        throw new Error(`Expected rollback serving for ${registration.templateId}.`);
      }
      expect(rolledBack.documentHash).toBe(current.documentHash);
      expect(JSON.stringify(rolledBack.document)).toBe(JSON.stringify(current.document));
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

  for (const fixture of [
    {
      scenarioId: 'eligible-vehicles',
      templateId: 'eligible-vehicles',
      legacyPublicationId: 'editable-eligible-publication-1',
      expansionPublicationId: 'editable-eligible-publication-2',
      failurePageId: 'eligible:en-US:TX:premium',
      addedPageId: 'eligible:fr-CA:QC:rideshare',
      addedCanonicalUrl: '/fr-CA/eligible-vehicles/qc/rideshare',
      triggerName: 'fail_eligible_legacy_expansion',
    },
    {
      scenarioId: 'structural-proof',
      templateId: 'structural-marketing',
      legacyPublicationId: 'editable-structural-publication-1',
      expansionPublicationId: 'editable-structural-publication-2',
      failurePageId: 'structural-page:boston-logan',
      addedPageId: 'structural-page:guarulhos',
      addedCanonicalUrl: '/pt-BR/airport/guarulhos',
      triggerName: 'fail_structural_legacy_expansion',
    },
  ] as const) {
    test(`upgrades the legacy two-page ${fixture.scenarioId} publication atomically`, () => {
      seedLegacyTwoPageScenario(client, fixture.scenarioId);
      const service = new CmsService(client);
      const legacyDocuments = client.sqlite
        .query<
          {
            createdAt: string;
            documentHash: string;
            pageInstanceId: string;
            renderedDocumentJson: string | null;
            resolvedDataJson: string;
          },
          [string, string]
        >(
          `SELECT page_instance_id AS pageInstanceId,
                  resolved_data_json AS resolvedDataJson,
                  rendered_document_json AS renderedDocumentJson,
                  document_hash AS documentHash,
                  created_at AS createdAt
           FROM published_page_documents
           WHERE template_id = ? AND publication_id = ?
           ORDER BY page_instance_id`
        )
        .all(fixture.templateId, fixture.legacyPublicationId);
      expect(legacyDocuments).toHaveLength(2);
      expect(
        client.sqlite
          .query<{ previousPublicationId: string | null; publicationId: string }, [string]>(
            `SELECT current.publication_id AS publicationId,
                    publications.previous_publication_id AS previousPublicationId
             FROM current_publications AS current
             JOIN publications
               ON publications.template_id = current.template_id
              AND publications.id = current.publication_id
             WHERE current.template_id = ?`
          )
          .get(fixture.templateId)
      ).toEqual({ publicationId: fixture.legacyPublicationId, previousPublicationId: null });

      client.sqlite.exec(`
        CREATE TRIGGER ${fixture.triggerName}
        BEFORE INSERT ON page_instances
        WHEN NEW.template_id = '${fixture.templateId}' AND NEW.id = '${fixture.failurePageId}'
        BEGIN
          SELECT RAISE(ABORT, 'forced legacy compact expansion failure');
        END;
      `);
      expect(() => ensureCompactPublishedScenario(client, fixture.scenarioId)).toThrow(
        'forced legacy compact expansion failure'
      );
      expect(
        client.sqlite
          .query<{ count: number }, [string]>(
            'SELECT count(*) AS count FROM page_instances WHERE template_id = ?'
          )
          .get(fixture.templateId)?.count
      ).toBe(2);
      expect(
        client.sqlite
          .query<{ count: number }, [string, string]>(
            'SELECT count(*) AS count FROM publications WHERE template_id = ? AND id = ?'
          )
          .get(fixture.templateId, fixture.expansionPublicationId)?.count
      ).toBe(0);
      expect(
        client.sqlite
          .query<{ publicationId: string }, [string]>(
            'SELECT publication_id AS publicationId FROM current_publications WHERE template_id = ?'
          )
          .get(fixture.templateId)
      ).toEqual({ publicationId: fixture.legacyPublicationId });

      client.sqlite.exec(`DROP TRIGGER ${fixture.triggerName}`);
      expect(ensureCompactPublishedScenario(client, fixture.scenarioId)).toBe(
        compactScenarioRegistry[fixture.scenarioId]
      );
      expect(compactScenarioIsComplete(client, fixture.scenarioId)).toBe(true);
      expect(
        client.sqlite
          .query<{ count: number }, [string]>(
            'SELECT count(*) AS count FROM page_instances WHERE template_id = ?'
          )
          .get(fixture.templateId)?.count
      ).toBe(14);
      expect(
        client.sqlite
          .query<{ count: number }, [string, string]>(
            `SELECT count(*) AS count
             FROM published_page_documents
             WHERE template_id = ? AND publication_id = ?`
          )
          .get(fixture.templateId, fixture.expansionPublicationId)?.count
      ).toBe(14);
      expect(
        client.sqlite
          .query<{ previousPublicationId: string | null; publicationId: string }, [string]>(
            `SELECT current.publication_id AS publicationId,
                    publications.previous_publication_id AS previousPublicationId
             FROM current_publications AS current
             JOIN publications
               ON publications.template_id = current.template_id
              AND publications.id = current.publication_id
             WHERE current.template_id = ?`
          )
          .get(fixture.templateId)
      ).toEqual({
        publicationId: fixture.expansionPublicationId,
        previousPublicationId: fixture.legacyPublicationId,
      });
      expect(
        client.sqlite
          .query<
            {
              createdAt: string;
              documentHash: string;
              pageInstanceId: string;
              renderedDocumentJson: string | null;
              resolvedDataJson: string;
            },
            [string, string]
          >(
            `SELECT page_instance_id AS pageInstanceId,
                    resolved_data_json AS resolvedDataJson,
                    rendered_document_json AS renderedDocumentJson,
                    document_hash AS documentHash,
                    created_at AS createdAt
             FROM published_page_documents
             WHERE template_id = ? AND publication_id = ?
             ORDER BY page_instance_id`
          )
          .all(fixture.templateId, fixture.legacyPublicationId)
      ).toEqual(legacyDocuments);
      expect(
        service.resolvePage(fixture.templateId, fixture.addedPageId).document.matchedVariantIds
      ).toEqual([]);
      expect(service.serve(fixture.templateId, fixture.addedCanonicalUrl).status).toBe(200);

      const countsBeforeReplay = {
        pages: tableCount(client, 'page_instances'),
        publications: tableCount(client, 'publications'),
        documents: tableCount(client, 'published_page_documents'),
      };
      ensureCompactPublishedScenario(client, fixture.scenarioId);
      expect({
        pages: tableCount(client, 'page_instances'),
        publications: tableCount(client, 'publications'),
        documents: tableCount(client, 'published_page_documents'),
      }).toEqual(countsBeforeReplay);
    });
  }

  test('rolls back a failed Store expansion before retrying all twelve pages', () => {
    client.sqlite.exec(`
      CREATE TRIGGER fail_compact_store_expansion
      BEFORE INSERT ON page_instances
      WHEN NEW.id = 'page-store-1007'
      BEGIN
        SELECT RAISE(ABORT, 'forced Store expansion failure');
      END;
    `);

    expect(() => ensureCompactPublishedScenario(client, 'stores')).toThrow();
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM page_instances WHERE id LIKE 'page-store-10%'"
        )
        .get()?.count
    ).toBe(2);
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM route_ingestions WHERE id = 'ing-store-compact-2'"
        )
        .get()?.count
    ).toBe(0);
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          "SELECT publication_id AS publicationId FROM current_publications WHERE template_id = 'tpl-store'"
        )
        .get()
    ).toEqual({ publicationId: 'publication-store-1' });

    client.sqlite.exec('DROP TRIGGER fail_compact_store_expansion');
    expect(ensureCompactPublishedScenario(client, 'stores')).toBe(compactScenarioRegistry.stores);
    expect(compactScenarioIsComplete(client, 'stores')).toBe(true);
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM page_instances WHERE template_id = 'tpl-store'"
        )
        .get()?.count
    ).toBe(14);
  });

  test('serving current pages is read-only and never evaluates selector SQL or CEL', () => {
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
        celEvaluations: 0,
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
