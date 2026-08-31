import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';

import { CmsService, CmsServiceError } from './index';

let client: CmsDatabaseClient;
let service: CmsService;
let generatedId = 0;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  generatedId = 0;
  service = new CmsService(client, {
    now: () => '2026-08-29T12:00:00.000Z',
    createId: (scope) => `${scope}:test:${++generatedId}`,
  });
});

afterEach(() => {
  client.close();
});

function createCatalogTemplate(id: string, key: string, prefix: string): void {
  service.createTemplate({
    id,
    key,
    name: key,
    domain: `${key}.example.test`,
    urlPattern: `/{locale}/${prefix}/{item_id}`,
  });
  service.createTemplateSlot(id, {
    id: `${id}:slot:locale`,
    key: 'locale',
    label: 'Locale',
    kind: 'variable',
    pathPosition: 0,
  });
  service.createTemplateSlot(id, {
    id: `${id}:slot:prefix`,
    key: prefix,
    label: 'Path prefix',
    kind: 'static',
    pathPosition: 1,
    staticValue: prefix,
  });
  service.createTemplateSlot(id, {
    id: `${id}:slot:id`,
    key: 'item_id',
    label: 'Item ID',
    kind: 'variable',
    pathPosition: 2,
    valueType: 'integer',
  });
  service.createTemplateSlot(id, {
    id: `${id}:slot:title`,
    key: 'title',
    label: 'Title',
    kind: 'derived',
  });
}

function catalogPage(
  id: string,
  prefix: string,
  itemId: number,
  status: 'live' | 'not_live' | 'archived' = 'live'
) {
  return {
    id,
    canonicalUrl: `/en-US/${prefix}/${itemId}`,
    routeExternalId: `router:${id}`,
    routeStatus: status,
    routeRevision: 'manual-v1',
    context: { item: { id: itemId, title: `Item ${itemId}` } },
    slotValues: { locale: 'en-US', item_id: itemId, title: `Item ${itemId}` },
  } as const;
}

describe('AUT-517 template, ordered-slot, and page foundation', () => {
  test('builds and validates canonical URLs, paginates, creates independent defaults, and archives softly', () => {
    createCatalogTemplate('tpl-catalog-a', 'catalog-a', 'shops');
    createCatalogTemplate('tpl-catalog-b', 'catalog-b', 'products');

    expect(
      service.buildCanonicalUrl('tpl-catalog-a', catalogPage('ignored', 'shops', 7).slotValues)
    ).toEqual({
      path: '/en-US/shops/7',
      url: 'https://catalog-a.example.test/en-US/shops/7',
    });
    const page = service.createPage('tpl-catalog-a', catalogPage('page-catalog-7', 'shops', 7));
    expect(page.canonicalUrl).toBe('/en-US/shops/7');
    expect(page.contextHash).toHaveLength(64);
    expect(page.slotValueHash).toHaveLength(64);

    expect(() =>
      service.createPage('tpl-catalog-a', {
        ...catalogPage('page-catalog-bad', 'shops', 8),
        canonicalUrl: '/wrong/path',
      })
    ).toThrow('Canonical URL must be');
    expect(() =>
      service.createPage('tpl-catalog-a', {
        ...catalogPage('page-catalog-duplicate', 'shops', 7),
        routeExternalId: 'router:duplicate',
      })
    ).toThrow();

    const defaults = client.sqlite
      .query<{ id: string; revisionId: string }, []>(
        `SELECT id, active_revision_id AS revisionId
         FROM variants
         WHERE template_id IN ('tpl-catalog-a', 'tpl-catalog-b') AND is_default = 1
         ORDER BY id`
      )
      .all();
    expect(defaults).toEqual([
      { id: 'tpl-catalog-a:default', revisionId: 'tpl-catalog-a:default:r1' },
      { id: 'tpl-catalog-b:default', revisionId: 'tpl-catalog-b:default:r1' },
    ]);

    const first = service.listTemplates({ limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    expect(
      service.listTemplates({ limit: 1, cursor: first.nextCursor ?? undefined }).items
    ).toHaveLength(1);

    expect(service.archiveTemplate('tpl-catalog-a').status).toBe('archived');
    expect(() =>
      service.createPage('tpl-catalog-a', catalogPage('page-after-archive', 'shops', 9))
    ).toThrow(CmsServiceError);
    expect(service.getTemplate('tpl-catalog-a')?.status).toBe('archived');
  });

  test('normalizes canonical domains and freezes route grammar once pages exist', () => {
    expect(() =>
      service.createTemplate({
        id: 'tpl-domain-with-port',
        key: 'domain-with-port',
        name: 'Domain with port',
        domain: 'catalog.example.test:443',
        urlPattern: '/{locale}/shops/{item_id}',
      })
    ).toThrow('bare host names');
    service.createTemplate({
      id: 'tpl-domain-normalized',
      key: 'domain-normalized',
      name: 'Domain normalized',
      domain: 'CATALOG.EXAMPLE.TEST',
      urlPattern: '/{locale}/shops/{item_id}',
    });
    expect(service.getTemplate('tpl-domain-normalized')?.domain).toBe('catalog.example.test');
    service.createTemplateSlot('tpl-domain-normalized', {
      id: 'tpl-domain-normalized:slot:locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      pathPosition: 0,
    });
    service.createTemplateSlot('tpl-domain-normalized', {
      id: 'tpl-domain-normalized:slot:prefix',
      key: 'shops',
      label: 'Path prefix',
      kind: 'static',
      pathPosition: 1,
      staticValue: 'shops',
    });
    service.createTemplateSlot('tpl-domain-normalized', {
      id: 'tpl-domain-normalized:slot:id',
      key: 'item_id',
      label: 'Item ID',
      kind: 'variable',
      pathPosition: 2,
      valueType: 'integer',
    });
    service.createTemplateSlot('tpl-domain-normalized', {
      id: 'tpl-domain-normalized:slot:title',
      key: 'title',
      label: 'Title',
      kind: 'derived',
    });
    service.createPage('tpl-domain-normalized', catalogPage('page-domain-normalized', 'shops', 1));

    expect(() =>
      service.updateTemplate('tpl-domain-normalized', {
        name: 'Domain normalized',
        domain: 'other.example.test',
        urlPattern: '/{locale}/shops/{item_id}',
      })
    ).toThrow('cannot change after canonical pages exist');
    expect(() =>
      service.updateTemplate('tpl-domain-normalized', {
        name: 'Domain normalized',
        domain: 'catalog.example.test',
        urlPattern: '/{locale}/stores/{item_id}',
      })
    ).toThrow('cannot change after canonical pages exist');
  });
});

describe('AUT-518 RouterService lifecycle ingestion', () => {
  test('is idempotent, classifies unchanged/status rows, retains missing rows, and never revives archives', () => {
    createCatalogTemplate('tpl-routes', 'routes', 'venues');
    const pageOne = catalogPage('page-route-1', 'venues', 1);
    const pageTwo = catalogPage('page-route-2', 'venues', 2, 'not_live');
    const initial = service.importRouterServiceRoutes({
      id: 'ing-routes-1',
      templateId: 'tpl-routes',
      sourceRevision: 'router-v1',
      observedAt: '2026-08-29T11:59:30-00:00',
      routes: [pageTwo, pageOne],
    });
    expect(initial).toMatchObject({
      inserted: 2,
      notLive: 1,
      archived: 0,
      rejected: 0,
      sourceObservedAt: '2026-08-29T11:59:30.000Z',
    });
    expect(
      client.sqlite
        .query<{ sourceObservedAt: string }, []>(
          `SELECT source_observed_at AS sourceObservedAt
           FROM route_ingestions WHERE id = 'ing-routes-1'`
        )
        .get()
    ).toEqual({ sourceObservedAt: '2026-08-29T11:59:30.000Z' });

    const replay = service.importRouterServiceRoutes({
      id: 'ignored-replay-id',
      templateId: 'tpl-routes',
      sourceRevision: 'router-v1',
      observedAt: '2026-08-29T11:59:30Z',
      routes: [pageTwo, pageOne],
    });
    expect(replay).toMatchObject({ idempotent: true, ingestionId: 'ing-routes-1', unchanged: 2 });
    expect(() =>
      service.importRouterServiceRoutes({
        id: 'different-observation',
        templateId: 'tpl-routes',
        sourceRevision: 'router-v1',
        observedAt: '2026-08-29T12:00:00Z',
        routes: [pageTwo, pageOne],
      })
    ).toThrow('different input');
    expect(() =>
      service.importRouterServiceRoutes({
        id: 'invalid-observation',
        templateId: 'tpl-routes',
        sourceRevision: 'router-invalid-time',
        observedAt: 'not-a-timestamp',
        routes: [],
      })
    ).toThrow('valid ISO-8601 timestamp');

    const next = service.importRouterServiceRoutes({
      id: 'ing-routes-2',
      templateId: 'tpl-routes',
      sourceRevision: 'router-v2',
      routes: [{ ...pageOne, routeRevision: 'ignored' }],
    });
    expect(next).toMatchObject({ unchanged: 1, updated: 0 });
    expect(service.getPage('tpl-routes', 'page-route-2')).not.toBeNull();

    const archived = service.importRouterServiceRoutes({
      id: 'ing-routes-3',
      templateId: 'tpl-routes',
      sourceRevision: 'router-v3',
      routes: [{ ...pageOne, routeStatus: 'archived' }],
    });
    expect(archived).toMatchObject({ archived: 1, statusChanged: 1 });
    const rejected = service.importRouterServiceRoutes({
      id: 'ing-routes-4',
      templateId: 'tpl-routes',
      sourceRevision: 'router-v4',
      routes: [pageOne],
    });
    expect(rejected).toMatchObject({ rejected: 1, skippedArchived: 1 });
    expect(service.getPage('tpl-routes', 'page-route-1')?.routeStatus).toBe('archived');
    const archivedPage = service.getPage('tpl-routes', 'page-route-1');
    if (!archivedPage) {
      throw new Error('Expected archived route page.');
    }
    expect(() =>
      service.updatePage('tpl-routes', archivedPage.id, {
        ...archivedPage,
        routeStatus: 'live',
      })
    ).toThrow('requires an explicit restore transition');
    expect(
      service.restoreArchivedPage('tpl-routes', archivedPage.id, {
        canonicalUrl: archivedPage.canonicalUrl,
        routeExternalId: archivedPage.routeExternalId,
        routeStatus: 'live',
        routeRevision: 'operator-restore-v1',
        context: archivedPage.context,
        slotValues: archivedPage.slotValues,
        lastIngestionId: archivedPage.lastIngestionId,
      }).routeStatus
    ).toBe('live');
    service.deletePage('tpl-routes', archivedPage.id);
    expect(service.getPage('tpl-routes', archivedPage.id)?.routeStatus).toBe('archived');
    expect(service.listRouteAudit('tpl-routes', 'ing-routes-4')[0]).toMatchObject({
      action: 'skip',
    });

    expect(() =>
      service.importRouterServiceRoutes({
        id: 'ing-routes-invalid',
        templateId: 'tpl-routes',
        sourceRevision: 'router-invalid',
        routes: [{ ...catalogPage('page-route-invalid', 'venues', 99), canonicalUrl: '/wrong' }],
      })
    ).toThrow('Canonical URL must be');
    expect(
      client.sqlite
        .query<{ status: string }, []>(
          `SELECT status FROM route_ingestions WHERE id = 'ing-routes-invalid'`
        )
        .get()
    ).toEqual({ status: 'failed' });
    expect(service.listRouteAudit('tpl-routes', 'ing-routes-invalid')[0]).toMatchObject({
      action: 'error',
    });
  });
});

describe('AUT-519/AUT-520 tags and approved selector surface', () => {
  test('previews safe selectors, applies auditable bulk tag changes, and composes tag layers independently', () => {
    const preview = service.previewSelector('tpl-store', "brand = 'mcdonalds'", 10);
    expect(preview.rows.map((row) => row.pageId)).toEqual(['page-store-1001']);
    expect(preview).toMatchObject({ totalCount: 1, templatePageCount: 2, warnings: [] });
    expect(preview.plan.length).toBeGreaterThan(0);
    expect(preview.plan.some((step) => step.detail.toLowerCase().includes('index'))).toBe(true);
    expect(() =>
      service.previewSelector('tpl-store', "brand = 'x'; DELETE FROM tags", 10)
    ).toThrow();
    expect(() => service.previewSelector('tpl-store', "unknown = 'x'", 10)).toThrow();
    expect(service.previewSelector('tpl-store', "locale = 'en-US'", 1)).toMatchObject({
      totalCount: 2,
      templatePageCount: 2,
      truncated: true,
      warnings: ['full_template'],
    });
    expect(service.previewSelector('tpl-store', "brand = 'missing'", 1)).toMatchObject({
      totalCount: 0,
      warnings: ['zero_match'],
    });

    expect(service.getPagesForTag('tpl-store', 'tag-store-brand-mcdonalds').items).toHaveLength(1);
    expect(service.getTagsForPage('tpl-store', 'page-store-1001')).toHaveLength(3);
    service.createTag('tpl-store', {
      id: 'tag-store-campaign-summer',
      namespace: 'campaign',
      value: 'summer',
      label: 'Summer',
      description: 'Author campaign',
      source: 'author',
    });
    const bulkPreview = service.previewBulkTagChange('tpl-store', {
      tagId: 'tag-store-campaign-summer',
      selector: "category = 'fast_food'",
      mode: 'assign',
    });
    expect(bulkPreview).toMatchObject({
      matchingCount: 1,
      changingCount: 1,
      changingPageIds: ['page-store-1001'],
      samplePageIds: ['page-store-1001'],
    });
    const applied = service.applyBulkTagChange('tpl-store', {
      tagId: 'tag-store-campaign-summer',
      selector: "category = 'fast_food'",
      mode: 'assign',
      source: 'author',
      changedBy: 'editor@example.test',
    });
    expect(applied).toMatchObject({ changingCount: 1, assignmentSource: 'author' });
    expect(
      service
        .getTagsForPage('tpl-store', 'page-store-1001')
        .find((assignment) => assignment.tag.id === 'tag-store-campaign-summer')
    ).toMatchObject({ assignmentSource: 'author' });

    expect(service.resolvePage('tpl-store', 'page-store-1001').document.matchedVariantIds).toEqual([
      'revision-store-chain-1',
      'revision-store-fast-food-1',
      'revision-store-mcdonalds-1',
    ]);
    service.unassignTag('tpl-store', 'page-store-1001', 'tag-store-brand-mcdonalds');
    expect(service.resolvePage('tpl-store', 'page-store-1001').document.matchedVariantIds).toEqual([
      'revision-store-chain-1',
      'revision-store-fast-food-1',
    ]);
    service.unassignTag('tpl-store', 'page-store-1001', 'tag-store-category-fast-food');
    expect(service.resolvePage('tpl-store', 'page-store-1001').document.matchedVariantIds).toEqual([
      'revision-store-chain-1',
    ]);
    service.unassignTag('tpl-store', 'page-store-1001', 'tag-store-type-chain');
    expect(service.resolvePage('tpl-store', 'page-store-1001').document.matchedVariantIds).toEqual(
      []
    );

    const first = service.listPages('tpl-store', { limit: 1 });
    expect(first.nextCursor).not.toBeNull();
    expect(
      service.listPages('tpl-store', { limit: 1, cursor: first.nextCursor ?? undefined }).items
    ).toHaveLength(1);
  });
});

describe('AUT-521/AUT-522/AUT-523 immutable blocks and variants', () => {
  test('atomically adds, positionally inserts, and edits default placements', () => {
    const announcement = service.createDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:r2',
      placementKey: 'announcement',
      lineage: {
        id: 'lineage-store-announcement',
        key: 'announcement',
        label: 'Announcement',
      },
      blockVersionId: 'block-store-announcement-v1',
      blockTypeKey: 'promo',
      content: { message: 'Announcement for {{ store.name }}' },
      createdBy: 'author',
      position: { kind: 'before', placementKey: 'primary-hero' },
    });
    expect(announcement.blockVersion).toMatchObject({
      versionNumber: 1,
      parentVersionId: null,
    });
    service.createDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:r3',
      placementKey: 'secondary-promo',
      lineage: {
        id: 'lineage-store-secondary-promo',
        key: 'secondary-promo',
        label: 'Secondary promotion',
      },
      blockVersionId: 'block-store-secondary-promo-v1',
      blockTypeKey: 'promo',
      content: { message: 'Secondary promotion' },
      createdBy: 'author',
      position: { kind: 'after', placementKey: 'primary-hero' },
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1002')
        .document.placements.map((placement) => placement.placementKey)
    ).toEqual([
      'navigation',
      'announcement',
      'primary-hero',
      'secondary-promo',
      'category-promo',
      'footer',
    ]);

    const edited = service.editDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:r4',
      placementKey: 'secondary-promo',
      blockVersionId: 'block-store-secondary-promo-v2',
      blockTypeKey: 'hero',
      content: { headline: 'Structurally replaced for {{ store.name }}' },
      createdBy: 'author',
    });
    expect(edited.blockVersion).toMatchObject({
      parentVersionId: 'block-store-secondary-promo-v1',
      versionNumber: 2,
      blockTypeKey: 'hero',
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1002')
        .renderedPlacements.find((placement) => placement.placementKey === 'secondary-promo')
    ).toMatchObject({
      blockType: 'hero',
      content: { headline: 'Structurally replaced for Neighborhood Kitchen' },
    });
    expect(service.getBlockVersion('tpl-store', 'block-store-secondary-promo-v1')?.content).toEqual(
      {
        message: 'Secondary promotion',
      }
    );
    const historical = service.resolvePublication(
      'tpl-store',
      'publication-store-1',
      '/en-US/store/1002'
    );
    expect(historical).toMatchObject({ status: 200, publicationId: 'publication-store-1' });
    if (historical.status !== 200 || typeof historical.document !== 'object') {
      throw new Error('Expected historical document.');
    }
    expect(JSON.stringify(historical.document)).not.toContain('secondary-promo');

    service.setDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:r5',
      placementKey: 'secondary-promo',
      blockVersionId: 'block-store-secondary-promo-v1',
      createdBy: 'author',
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1002')
        .document.placements.find((placement) => placement.placementKey === 'secondary-promo')
        ?.blockVersion.id
    ).toBe('block-store-secondary-promo-v1');

    expect(() =>
      service.createDefaultPlacement('tpl-store', {
        placementKey: 'rolled-back',
        lineage: { id: 'lineage-rolled-back', key: 'rolled-back', label: 'Rolled back' },
        blockVersionId: 'block-rolled-back-v1',
        blockTypeKey: 'promo',
        content: { message: 'Must roll back' },
        createdBy: 'author',
        position: { kind: 'before', placementKey: 'missing-reference' },
      })
    ).toThrow('was not found for positional insertion');
    expect(service.getBlockVersion('tpl-store', 'block-rolled-back-v1')).toBeNull();
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM block_lineages WHERE id = 'lineage-rolled-back'"
        )
        .get()?.count
    ).toBe(0);
  });

  test('keeps linked drafts sparse, previews selector revisions, and makes empty mode explicit', () => {
    service.createVariant('tpl-store', {
      id: 'variant-store-draft-preview',
      revisionId: 'revision-store-draft-preview-1',
      key: 'draft-preview',
      name: 'Draft preview',
      priority: 40,
      status: 'draft',
      selector: "brand = 'mcdonalds'",
      createdBy: 'author',
      mode: 'linked',
    });
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM variant_operations
           WHERE variant_revision_id = 'revision-store-draft-preview-1'`
        )
        .get()?.count
    ).toBe(0);
    service.tombstoneVariantPlacement('tpl-store', 'variant-store-draft-preview', {
      revisionId: 'revision-store-draft-preview-2',
      placementKey: 'footer',
      createdBy: 'author',
    });
    const selectorRevision = service.reviseVariantSelector(
      'tpl-store',
      'variant-store-draft-preview',
      {
        revisionId: 'revision-store-draft-preview-3',
        selector: "  store_type = 'independent'  ",
        createdBy: 'author',
      }
    );
    expect(selectorRevision).toMatchObject({
      originalSelector: "  store_type = 'independent'  ",
      selector: "store_type = 'independent'",
      validationResult: {
        status: 'valid',
        normalizedSelector: "store_type = 'independent'",
      },
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1002')
        .document.placements.some((placement) => placement.placementKey === 'footer')
    ).toBe(true);
    expect(
      service
        .resolveVariantDraft('tpl-store', 'variant-store-draft-preview', 'page-store-1002')
        .document.placements.some((placement) => placement.placementKey === 'footer')
    ).toBe(false);
    expect(() =>
      service.resolveVariantDraft('tpl-store', 'variant-store-draft-preview', 'page-store-1001')
    ).toThrow('does not match revision');

    service.createVariant('tpl-store', {
      id: 'variant-store-empty',
      revisionId: 'revision-store-empty-1',
      key: 'empty',
      name: 'Empty replacement',
      priority: 50,
      status: 'draft',
      selector: "store_type = 'independent'",
      createdBy: 'author',
      mode: 'empty',
    });
    expect(
      client.sqlite
        .query<{ operationKind: string }, []>(
          `SELECT operation_kind AS operationKind FROM variant_operations
           WHERE variant_revision_id = 'revision-store-empty-1'
           ORDER BY placement_key`
        )
        .all()
    ).toEqual(Array.from({ length: 4 }, () => ({ operationKind: 'tombstone' })));
    expect(
      service.resolveVariantDraft('tpl-store', 'variant-store-empty', 'page-store-1002').document
        .placements
    ).toEqual([]);
    const inserted = service.createVariantPlacement('tpl-store', 'variant-store-empty', {
      revisionId: 'revision-store-empty-2',
      placementKey: 'empty-announcement',
      lineage: {
        id: 'lineage-store-empty-announcement',
        key: 'empty-announcement',
        label: 'Empty announcement',
      },
      blockVersionId: 'block-store-empty-announcement-v1',
      blockTypeKey: 'promo',
      content: { message: 'Only {{ store.name }} remains' },
      order: 0,
      createdBy: 'author',
    });
    expect(inserted.blockVersion).toMatchObject({ versionNumber: 1, parentVersionId: null });
    expect(
      service
        .resolveVariantDraft('tpl-store', 'variant-store-empty', 'page-store-1002')
        .document.placements.map((placement) => placement.placementKey)
    ).toEqual(['empty-announcement']);
    expect(
      service
        .resolveVariantDraft('tpl-store', 'variant-store-empty', 'page-store-1002')
        .renderedPlacements.at(0)?.content
    ).toEqual({ message: 'Only Neighborhood Kitchen remains' });

    service.setVariantStatus('tpl-store', 'variant-store-draft-preview', 'archived');
    expect(() =>
      service.setVariantPriority('tpl-store', 'variant-store-draft-preview', 60)
    ).toThrow('is archived');
    expect(() =>
      service.reviseVariantSelector('tpl-store', 'variant-store-draft-preview', {
        revisionId: 'revision-store-draft-preview-archived',
        selector: "brand = 'burger-king'",
        createdBy: 'author',
      })
    ).toThrow('is archived');
  });

  test('forks on write, tombstones/reverts, reorders without a content version, and detects overlap', () => {
    expect(() =>
      service.copyOnWritePlacement(
        'tpl-store',
        'variant-store-mcdonalds',
        'page-store-1002',
        'primary-hero',
        {
          blockVersionId: 'block-store-must-not-exist',
          content: { headline: 'Wrong audience' },
          createdBy: 'author',
        }
      )
    ).toThrow('does not match variant');
    expect(() =>
      service.setVariantPlacement('tpl-store', 'tpl-store:default', {
        placementKey: 'primary-hero',
        blockVersionId: 'block-store-hero-v1',
        createdBy: 'author',
      })
    ).toThrow('default-document placement commands');
    const beforeRevision = service.getVariant(
      'tpl-store',
      'variant-store-mcdonalds'
    )?.activeRevisionId;
    const copied = service.copyOnWritePlacement(
      'tpl-store',
      'variant-store-mcdonalds',
      'page-store-1001',
      'primary-hero',
      {
        revisionId: 'revision-store-mcdonalds-2',
        blockVersionId: 'block-store-hero-v3-author',
        content: {
          headline:
            'Hello {{ store.name }} / {{ slot.store_name }} / {{ tag.brand }} / {{ route.externalId }}',
        },
        createdBy: 'author',
      }
    );
    expect(copied.blockVersion.versionNumber).toBeGreaterThan(2);
    expect(copied.blockVersion.parentVersionId).toBe('block-store-hero-v2-mcd');
    expect(copied.revision.revisionNumber).toBe(2);
    expect(
      service.resolvePage('tpl-store', 'page-store-1001').renderedPlacements[1]?.content
    ).toEqual({
      headline: "Hello McDonald's Market / McDonald's Market / mcdonalds / router-store-1001",
    });
    expect(
      client.sqlite
        .query<{ blockVersionId: string }, [string]>(
          `SELECT block_version_id AS blockVersionId FROM variant_operations
           WHERE variant_revision_id = ? AND placement_key = 'primary-hero' AND operation_kind = 'set'`
        )
        .get(beforeRevision ?? '')
    ).toEqual({ blockVersionId: 'block-store-hero-v2-mcd' });

    service.tombstoneVariantPlacement('tpl-store', 'variant-store-mcdonalds', {
      revisionId: 'revision-store-mcdonalds-3',
      placementKey: 'primary-hero',
      createdBy: 'author',
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1001')
        .document.placements.some((placement) => placement.placementKey === 'primary-hero')
    ).toBe(false);
    service.revertVariantPlacement('tpl-store', 'variant-store-mcdonalds', {
      revisionId: 'revision-store-mcdonalds-4',
      placementKey: 'primary-hero',
      createdBy: 'author',
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1001')
        .document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.blockVersion.id
    ).toBe('block-store-hero-v1');

    const versionCount = client.sqlite
      .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
      .get()?.count;
    service.reorderDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:r2',
      placementKey: 'primary-hero',
      order: 9,
      createdBy: 'author',
    });
    service.reorderDefaultPlacements('tpl-store', {
      revisionId: 'tpl-store:default:r3',
      placementKeys: ['primary-hero', 'navigation', 'category-promo', 'footer'],
      createdBy: 'author',
    });
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1002')
        .document.placements.map((placement) => placement.placementKey)
    ).toEqual(['primary-hero', 'navigation', 'category-promo', 'footer']);
    expect(() =>
      service.reorderDefaultPlacements('tpl-store', {
        placementKeys: ['primary-hero', 'navigation', 'navigation', 'footer'],
        createdBy: 'author',
      })
    ).toThrow('every current placement exactly once');
    expect(
      client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
        .get()?.count
    ).toBe(versionCount);
    const inheritedVariantOrder = service
      .resolveVariantDraft('tpl-store', 'variant-store-mcdonalds', 'page-store-1001')
      .document.placements.map((placement) => placement.placementKey);
    service.reorderVariantPlacements('tpl-store', 'variant-store-mcdonalds', {
      revisionId: 'revision-store-mcdonalds-order',
      placementKeys: [...inheritedVariantOrder].reverse(),
      createdBy: 'author',
    });
    expect(
      service
        .resolveVariantDraft('tpl-store', 'variant-store-mcdonalds', 'page-store-1001')
        .document.placements.map((placement) => placement.placementKey)
    ).toEqual([...inheritedVariantOrder].reverse());
    service.revertVariantOrder('tpl-store', 'variant-store-mcdonalds', {
      revisionId: 'revision-store-mcdonalds-order-reverted',
      createdBy: 'author',
    });
    expect(
      service
        .resolveVariantDraft('tpl-store', 'variant-store-mcdonalds', 'page-store-1001')
        .document.placements.map((placement) => placement.placementKey)
    ).toEqual(inheritedVariantOrder);
    expect(
      client.sqlite
        .query<{ count: number }, [string]>(
          `SELECT count(*) AS count
           FROM variant_operations
           WHERE variant_revision_id = ? AND operation_kind = 'order'`
        )
        .get(service.getVariant('tpl-store', 'variant-store-mcdonalds')?.activeRevisionId ?? '')
        ?.count
    ).toBe(0);
    expect(
      client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
        .get()?.count
    ).toBe(versionCount);
    expect(() =>
      client.sqlite
        .query("UPDATE variant_operations SET order_index = 8 WHERE id = 'op-default-hero-order'")
        .run()
    ).toThrow('variant operations are immutable');
    expect(() =>
      service.forkBlockVersion('tpl-store', {
        id: 'invalid-block',
        sourceVersionId: 'block-store-hero-v1',
        content: {},
        createdBy: 'author',
      })
    ).toThrow('Required');

    service.copyOnWritePlacement(
      'tpl-store',
      'variant-store-mcdonalds',
      'page-store-1001',
      'primary-hero',
      {
        revisionId: 'revision-store-mcdonalds-5',
        blockVersionId: 'block-store-hero-v4-structural',
        blockTypeKey: 'promo',
        content: { message: 'Replacement for {{ store.name }}' },
        createdBy: 'author',
      }
    );
    expect(
      service
        .resolvePage('tpl-store', 'page-store-1001')
        .document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.blockVersion.blockType
    ).toBe('promo');

    service.createVariant('tpl-store', {
      id: 'variant-store-conflict',
      revisionId: 'revision-store-conflict-1',
      key: 'conflict',
      name: 'Conflict',
      priority: 10,
      status: 'active',
      selector: "brand = 'mcdonalds'",
      createdBy: 'author',
    });
    service.setVariantPlacement('tpl-store', 'variant-store-conflict', {
      revisionId: 'revision-store-conflict-2',
      placementKey: 'footer',
      blockVersionId: 'block-store-footer-v1',
      createdBy: 'author',
    });
    expect(
      service
        .previewVariantOverlap('tpl-store', 'variant-store-conflict')
        .find((overlap) => overlap.variantId === 'variant-store-chain')
    ).toEqual(
      expect.objectContaining({
        overlapCount: 1,
        overlapPageIds: ['page-store-1001'],
        conflictingPlacementKeys: ['footer'],
      })
    );
    expect(() => service.resolvePage('tpl-store', 'page-store-1001')).toThrow('ambiguous');
  });

  test('reports exact overlap counts independently of the sample limit', () => {
    service.assignTags(
      'tpl-store',
      'page-store-1002',
      ['tag-store-type-chain', 'tag-store-brand-mcdonalds'],
      'author'
    );
    const overlap = service
      .previewVariantOverlap('tpl-store', 'variant-store-mcdonalds', 1)
      .find((entry) => entry.variantId === 'variant-store-chain');
    expect(overlap).toMatchObject({
      overlapCount: 2,
      overlapPageIds: ['page-store-1001'],
      truncated: true,
    });
  });
});

describe('AUT-539 deterministic CEL authoring and publication', () => {
  test('compiles on save, previews two page contexts, and persists only evaluated public content', () => {
    const legacy = service.serve('tpl-store', '/en-US/store/1001');
    expect(legacy).toMatchObject({ status: 200, publicationId: 'publication-store-1' });
    if (legacy.status !== 200) {
      throw new Error('Expected the legacy Store publication.');
    }
    expect(
      legacy.document.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.content
    ).toEqual({ headline: "Buy now McDonald's Market — San Francisco" });

    const rejectedSources = [
      ['unknown-root', '{{ merchant.name }}'],
      ['forbidden-root', '{{ request.path }}'],
      ['forbidden-property', '{{ store.constructor }}'],
      ['malformed', '{{ store.name + }}'],
    ] as const;
    for (const [id, label] of rejectedSources) {
      expect(() =>
        service.forkBlockVersion('tpl-store', {
          id: `block-store-navigation-${id}`,
          sourceVersionId: 'block-store-navigation-v1',
          content: { label },
          createdBy: 'author',
        })
      ).toThrow(CmsServiceError);
      expect(service.getBlockVersion('tpl-store', `block-store-navigation-${id}`)).toBeNull();
    }

    const source =
      '{{ store.name == "McDonald\'s Market" ? "Chain: " + page.context.store.name : "Local: " + context.store.name }} #{{ slots.store_id }}';
    expect(
      service.inspectBlockFieldInterpolation('tpl-store', 'page-store-1001', source)
    ).toMatchObject({
      success: true,
      dependencies: [
        'context.store.name',
        'page.context.store.name',
        'slots.store_id',
        'store.name',
      ],
      evaluatedSample: "Chain: McDonald's Market #1001",
    });
    expect(
      service.inspectBlockFieldInterpolation('tpl-store', 'page-store-1001', '{{ merchant.name }}')
    ).toMatchObject({ success: false, error: { code: 'UNKNOWN_ROOT' } });
    service.editDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:cel-r2',
      placementKey: 'navigation',
      blockVersionId: 'block-store-navigation-cel-v2',
      content: { label: source },
      createdBy: 'author',
    });
    expect(service.getBlockVersion('tpl-store', 'block-store-navigation-cel-v2')?.content).toEqual({
      label: source,
    });

    const firstPreview = service.resolvePage('tpl-store', 'page-store-1001');
    const secondPreview = service.resolvePage('tpl-store', 'page-store-1002');
    expect(
      firstPreview.renderedPlacements.find((placement) => placement.placementKey === 'navigation')
        ?.content
    ).toEqual({ label: "Chain: McDonald's Market #1001" });
    expect(
      secondPreview.renderedPlacements.find((placement) => placement.placementKey === 'navigation')
        ?.content
    ).toEqual({ label: 'Local: Neighborhood Kitchen #1002' });

    const publication = service.publish('tpl-store', {
      id: 'publication-store-cel',
      createdBy: 'author',
    });
    expect(publication).toMatchObject({
      publicationId: 'publication-store-cel',
      previousPublicationId: 'publication-store-1',
      materializationMode: 'manifest',
    });
    const storedDocuments = client.sqlite
      .query<{ resolvedDataJson: string; renderedDocumentJson: string | null }, []>(
        `SELECT resolved_data_json AS resolvedDataJson,
                rendered_document_json AS renderedDocumentJson
         FROM published_page_documents
         WHERE publication_id = 'publication-store-cel'
         ORDER BY page_instance_id`
      )
      .all();
    expect(storedDocuments).toHaveLength(2);
    for (const row of storedDocuments) {
      expect(row.renderedDocumentJson).toBeNull();
      expect(row.resolvedDataJson).not.toContain('{{');
      expect(JSON.parse(row.resolvedDataJson)).toMatchObject({
        contract: 'cms-published-placement-content-v1',
      });
    }
    expect(service.getServeReadQueryTexts('manifest').join('\n')).not.toMatch(
      /content_json|context_json|selector_sql/i
    );

    const served = service.serve('tpl-store', '/en-US/store/1001');
    if (served.status !== 200) {
      throw new Error('Expected the CEL publication to serve.');
    }
    expect(
      served.document.placements.find((placement) => placement.placementKey === 'navigation')
        ?.content
    ).toEqual({ label: "Chain: McDonald's Market #1001" });
    expect(JSON.stringify(served.document)).not.toContain('{{');

    service.publish('tpl-store', {
      id: 'publication-store-cel-expanded',
      createdBy: 'author',
      materializationMode: 'expanded',
    });
    const expandedDocuments = client.sqlite
      .query<{ renderedDocumentJson: string }, []>(
        `SELECT rendered_document_json AS renderedDocumentJson
         FROM published_page_documents
         WHERE publication_id = 'publication-store-cel-expanded'
         ORDER BY page_instance_id`
      )
      .all();
    expect(expandedDocuments).toHaveLength(2);
    expect(expandedDocuments.every((row) => !row.renderedDocumentJson.includes('{{'))).toBe(true);
    expect(service.serve('tpl-store', '/en-US/store/1001')).toMatchObject({
      status: 200,
      publicationId: 'publication-store-cel-expanded',
    });

    const page = service.getPage('tpl-store', 'page-store-1001');
    if (!page) {
      throw new Error('Expected the seeded Store page.');
    }
    service.updatePage('tpl-store', page.id, {
      ...page,
      routeRevision: 'unpublished-context-change',
      context: {
        ...page.context,
        store: { id: 1001, name: 'Unpublished Name', location: 'San Francisco' },
      },
    });
    const servedAfterDraftChange = service.serve('tpl-store', '/en-US/store/1001');
    if (servedAfterDraftChange.status !== 200) {
      throw new Error('Expected the current publication to remain serveable.');
    }
    expect(
      servedAfterDraftChange.document.placements.find(
        (placement) => placement.placementKey === 'navigation'
      )?.content
    ).toEqual({ label: "Chain: McDonald's Market #1001" });
  });

  test('keeps the current pointer atomic when a saved expression is missing at publication', () => {
    service.editDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:cel-missing-r2',
      placementKey: 'navigation',
      blockVersionId: 'block-store-navigation-cel-missing',
      content: { label: '{{ store.missing }}' },
      createdBy: 'author',
    });
    expect(
      service.getBlockVersion('tpl-store', 'block-store-navigation-cel-missing')
    ).not.toBeNull();
    expect(() => service.resolvePage('tpl-store', 'page-store-1001')).toThrow('MISSING_VALUE');
    expect(() =>
      service.publish('tpl-store', {
        id: 'publication-store-cel-missing',
        createdBy: 'author',
      })
    ).toThrow('MISSING_VALUE');
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          `SELECT publication_id AS publicationId
           FROM current_publications
           WHERE template_id = 'tpl-store'`
        )
        .get()
    ).toEqual({ publicationId: 'publication-store-1' });
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count
           FROM publications
           WHERE id = 'publication-store-cel-missing'`
        )
        .get()?.count
    ).toBe(0);
  });

  test('validates evaluated CEL output against the block schema before activation', () => {
    service.registerBlockType({
      id: 'block-type-cel-tight-navigation',
      key: 'cel-tight-navigation',
      name: 'CEL tight navigation',
      schemaVersion: 1,
      schema: {
        type: 'object',
        required: ['label'],
        properties: { label: { type: 'string', maxLength: 16 } },
        additionalProperties: false,
      },
    });
    service.editDefaultPlacement('tpl-store', {
      revisionId: 'tpl-store:default:cel-schema-r2',
      placementKey: 'navigation',
      blockVersionId: 'block-store-navigation-cel-schema',
      blockTypeKey: 'cel-tight-navigation',
      content: { label: '{{ store.name }}' },
      createdBy: 'author',
    });
    expect(() => service.resolvePage('tpl-store', 'page-store-1001')).toThrow(
      'evaluated content failed schema validation'
    );
    expect(() =>
      service.publish('tpl-store', {
        id: 'publication-store-cel-schema-failure',
        createdBy: 'author',
      })
    ).toThrow('evaluated content failed schema validation');
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          `SELECT publication_id AS publicationId
           FROM current_publications
           WHERE template_id = 'tpl-store'`
        )
        .get()
    ).toEqual({ publicationId: 'publication-store-1' });
  });
});

describe('AUT-524/AUT-525 atomic publication and serving', () => {
  test('reports fixed selector-free and CEL-free read counts for manifest and expanded serving', () => {
    expect(service.serveWithEvidence('tpl-store', '/en-US/store/1001')).toMatchObject({
      result: { status: 200, publicationId: 'publication-store-1' },
      materializationMode: 'manifest',
      sqlQueryCount: 2,
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });
    const expandedPublication = service.publish('tpl-store', {
      id: 'publication-store-expanded',
      createdBy: 'test',
      materializationMode: 'expanded',
    });
    const persistedExpandedBytes = client.sqlite
      .query<{ document: string }, []>(
        `SELECT rendered_document_json AS document
         FROM published_page_documents
         WHERE publication_id = 'publication-store-expanded'
         ORDER BY page_instance_id`
      )
      .all()
      .reduce((sum, row) => sum + Buffer.byteLength(row.document, 'utf8'), 0);
    expect(expandedPublication.logicalExpandedRenderedDocumentBytes).toBe(persistedExpandedBytes);
    const expanded = service.serveWithEvidence('tpl-store', '/en-US/store/1001');
    expect(expanded).toMatchObject({
      result: { status: 200, publicationId: 'publication-store-expanded' },
      materializationMode: 'expanded',
      sqlQueryCount: 1,
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });
    expect(expanded.elapsedMilliseconds).toBeGreaterThan(0);
    expect(service.getServeReadQueryTexts('expanded')).toHaveLength(1);
    expect(service.getServeReadQueryTexts('manifest')).toHaveLength(2);
    expect(service.getServeReadQueryTexts('expanded').join('\n')).not.toMatch(/selector/i);
  });

  test('deduplicates manifests, publishes atomically, serves without selectors, and rolls back pointers', () => {
    service.createPage('tpl-store', {
      id: 'page-store-1003',
      canonicalUrl: '/en-US/store/1003',
      routeExternalId: 'router-store-1003',
      routeStatus: 'live',
      routeRevision: 'store-seed-v1',
      context: {
        locale: 'en-US',
        store: { id: 1003, name: 'Third Kitchen', location: 'Berkeley' },
      },
      slotValues: {
        locale: 'en-US',
        store_id: 1003,
        store_name: 'Third Kitchen',
      },
    });
    const progress: {
      phase: 'compile' | 'write';
      pagesProcessed: number;
      totalPages: number;
    }[] = [];
    const publication = service.publish('tpl-store', {
      id: 'publication-store-2',
      createdBy: 'test',
      batchSize: 2,
      onProgress: (entry) => progress.push(entry),
    });
    expect(publication).toMatchObject({
      previousPublicationId: 'publication-store-1',
      pageCount: 3,
      manifestCount: 2,
      reusedCurrentPublication: false,
      materializationMode: 'manifest',
      selectorMatchCount: 3,
      blockReferenceCount: 12,
    });
    expect(progress.filter((entry) => entry.phase === 'compile').at(-1)).toEqual({
      phase: 'compile',
      pagesProcessed: 3,
      totalPages: 3,
    });
    expect(progress.filter((entry) => entry.phase === 'write').at(-1)).toEqual({
      phase: 'write',
      pagesProcessed: 3,
      totalPages: 3,
    });
    expect(publication.rowsWritten).toBeGreaterThanOrEqual(5);
    expect(publication.estimatedStorageBytes).toBeGreaterThan(0);
    expect(publication.logicalExpandedRenderedDocumentBytes).toBeGreaterThan(
      publication.estimatedStorageBytes
    );
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count
           FROM document_manifest_items
           WHERE source_operation_id IS NOT NULL`
        )
        .get()?.count
    ).toBeGreaterThan(0);
    const unchanged = service.publish('tpl-store', { id: 'unused', createdBy: 'test' });
    expect(unchanged).toMatchObject({
      publicationId: 'publication-store-2',
      reusedCurrentPublication: true,
      logicalExpandedRenderedDocumentBytes: publication.logicalExpandedRenderedDocumentBytes,
    });
    expect(service.getServeQueryText()).not.toMatch(/variant|selector|operation/i);
    expect(service.serve('tpl-store', '/en-US/store/1001')).toMatchObject({
      status: 200,
      publicationId: 'publication-store-2',
    });
    expect(service.resolveDraftByCanonicalUrl('tpl-store', '/en-US/store/1001').page.id).toBe(
      'page-store-1001'
    );
    expect(
      service.resolvePublication('tpl-store', 'publication-store-2', '/en-US/store/1001')
    ).toMatchObject({ status: 200, publicationId: 'publication-store-2', routeStatus: 'live' });

    const third = service.getPage('tpl-store', 'page-store-1003');
    if (!third) {
      throw new Error('Expected test page.');
    }
    service.updatePage('tpl-store', third.id, {
      canonicalUrl: third.canonicalUrl,
      routeExternalId: third.routeExternalId,
      routeStatus: third.routeStatus,
      routeRevision: 'store-seed-v2',
      context: {
        locale: 'en-US',
        store: { id: 1003, name: 'Third Kitchen Updated', location: 'Berkeley' },
      },
      slotValues: third.slotValues,
      lastIngestionId: third.lastIngestionId,
    });
    const failureStages = [
      'after-publication',
      'after-manifests',
      'after-pages',
      'before-activation',
    ] as const;
    for (const stage of failureStages) {
      expect(() =>
        service.publish('tpl-store', {
          id: `publication-store-failed-${stage}`,
          createdBy: 'test',
          failAt: stage,
        })
      ).toThrow('Injected failure');
    }
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          `SELECT publication_id AS publicationId FROM current_publications WHERE template_id = 'tpl-store'`
        )
        .get()
    ).toEqual({ publicationId: 'publication-store-2' });
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM publications WHERE id LIKE 'publication-store-failed-%'`
        )
        .get()?.count
    ).toBe(0);

    const next = service.publish('tpl-store', { id: 'publication-store-3', createdBy: 'test' });
    expect(next).toMatchObject({
      previousPublicationId: 'publication-store-2',
      reusedManifestCount: 2,
    });
    expect(service.rollback('tpl-store', undefined, 'operator')).toMatchObject({
      fromPublicationId: 'publication-store-3',
      publicationId: 'publication-store-2',
    });
    expect(service.serve('tpl-store', '/en-US/store/1001')).toMatchObject({
      status: 200,
      publicationId: 'publication-store-2',
    });

    const first = service.getPage('tpl-store', 'page-store-1001');
    if (!first) {
      throw new Error('Expected seeded page.');
    }
    service.updatePage('tpl-store', first.id, { ...first, routeStatus: 'not_live' });
    expect(service.serve('tpl-store', first.canonicalUrl)).toEqual({
      status: 404,
      reason: 'not_live',
    });
  });
});

describe('AUT-543 publication lifecycle preflight', () => {
  test('preflights without writes, compare-and-swaps publish, and rolls back the exact predecessor', () => {
    const page = service.getPage('tpl-store', 'page-store-1002');
    if (!page) throw new Error('Expected the second Store page.');
    service.updatePage('tpl-store', page.id, {
      ...page,
      context: {
        locale: 'en-US',
        store: { id: 1002, name: 'Second Kitchen preflight draft', location: 'Oakland' },
      },
    });
    const beforePointer = client.sqlite
      .query<{ publicationId: string }, []>(
        `SELECT publication_id AS publicationId
         FROM current_publications WHERE template_id = 'tpl-store'`
      )
      .get();
    const beforePublicationCount = client.sqlite
      .query<{ count: number }, []>(
        `SELECT count(*) AS count FROM publications WHERE template_id = 'tpl-store'`
      )
      .get()?.count;
    const beforePublicBytes = JSON.stringify(service.serve('tpl-store', page.canonicalUrl));

    const preflight = service.preflightPublication('tpl-store', { sampleLimit: 2 });
    expect(preflight).toMatchObject({
      templateId: 'tpl-store',
      totalActivePages: 2,
      affectedActivePages: {
        count: 1,
        sampleCanonicalUrls: ['/en-US/store/1002'],
        truncated: false,
      },
      issues: [],
      canPublish: true,
      currentPublication: { id: beforePointer?.publicationId },
    });
    expect(preflight.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM publications WHERE template_id = 'tpl-store'`
        )
        .get()?.count
    ).toBe(beforePublicationCount);

    expect(() =>
      service.publish('tpl-store', {
        createdBy: 'author',
        expectedInputHash: '0'.repeat(64),
        expectedCurrentPublicationId: beforePointer?.publicationId ?? null,
      })
    ).toThrow('Authoring input changed after preflight');
    expect(JSON.stringify(service.serve('tpl-store', page.canonicalUrl))).toBe(beforePublicBytes);
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          `SELECT publication_id AS publicationId
           FROM current_publications WHERE template_id = 'tpl-store'`
        )
        .get()
    ).toEqual(beforePointer);

    if (!preflight.inputHash) throw new Error('Expected a publishable input hash.');
    const published = service.publish('tpl-store', {
      createdBy: 'author',
      expectedInputHash: preflight.inputHash,
      expectedCurrentPublicationId: beforePointer?.publicationId ?? null,
    });
    expect(published.publication).toMatchObject({
      id: published.publicationId,
      previousPublicationId: beforePointer?.publicationId,
      activatedBy: 'author',
    });
    expect(service.preflightPublication('tpl-store').affectedActivePages.count).toBe(0);
    expect(service.serveWithEvidence('tpl-store', page.canonicalUrl)).toMatchObject({
      selectorSqlExecutions: 0,
      celEvaluations: 0,
    });

    expect(() =>
      service.rollback('tpl-store', {
        targetPublicationId: beforePointer?.publicationId ?? '',
        expectedCurrentPublicationId: 'stale-publication',
        activatedBy: 'operator',
      })
    ).toThrow('Serving pointer changed after preflight');
    expect(() =>
      service.rollback('tpl-store', {
        targetPublicationId: 'not-the-retained-predecessor',
        expectedCurrentPublicationId: published.publicationId,
        activatedBy: 'operator',
      })
    ).toThrow('not the exact retained predecessor');
    const rollback = service.rollback('tpl-store', {
      targetPublicationId: beforePointer?.publicationId ?? '',
      expectedCurrentPublicationId: published.publicationId,
      activatedBy: 'operator',
    });
    expect(rollback).toMatchObject({
      fromPublicationId: published.publicationId,
      publicationId: beforePointer?.publicationId,
      publication: { id: beforePointer?.publicationId, activatedBy: 'operator' },
    });
    expect(JSON.stringify(service.serve('tpl-store', page.canonicalUrl))).toBe(beforePublicBytes);
  });

  test('aggregates deterministic same-priority conflicts without moving the public pointer', () => {
    for (const suffix of ['a', 'b'] as const) {
      service.createVariant('tpl-store', {
        id: `variant-preflight-conflict-${suffix}`,
        revisionId: `revision-preflight-conflict-${suffix}-1`,
        key: `preflight-conflict-${suffix}`,
        name: `Preflight conflict ${suffix}`,
        priority: 777,
        status: 'active',
        selector: "route_status = 'live'",
        createdBy: 'author',
      });
      service.setVariantPlacement('tpl-store', `variant-preflight-conflict-${suffix}`, {
        revisionId: `revision-preflight-conflict-${suffix}-2`,
        placementKey: 'footer',
        blockVersionId: 'block-store-footer-v1',
        createdBy: 'author',
      });
    }
    const pointer = client.sqlite
      .query<{ publicationId: string }, []>(
        `SELECT publication_id AS publicationId
         FROM current_publications WHERE template_id = 'tpl-store'`
      )
      .get();
    const publicationCount = client.sqlite
      .query<{ count: number }, []>(
        `SELECT count(*) AS count FROM publications WHERE template_id = 'tpl-store'`
      )
      .get()?.count;

    const preflight = service.preflightPublication('tpl-store', { sampleLimit: 2 });
    expect(preflight).toMatchObject({ canPublish: false, inputHash: null });
    expect(preflight.issues).toEqual([
      expect.objectContaining({
        code: 'PRIORITY_CONFLICT',
        placementKey: 'footer',
        priority: 777,
        affectedPageCount: 2,
        sampleCanonicalUrls: ['/en-US/store/1001', '/en-US/store/1002'],
        variantRevisionIds: ['revision-preflight-conflict-a-2', 'revision-preflight-conflict-b-2'],
      }),
    ]);
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          `SELECT publication_id AS publicationId
           FROM current_publications WHERE template_id = 'tpl-store'`
        )
        .get()
    ).toEqual(pointer);
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          `SELECT count(*) AS count FROM publications WHERE template_id = 'tpl-store'`
        )
        .get()?.count
    ).toBe(publicationCount);
  });
});
