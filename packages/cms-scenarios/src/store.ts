import type {
  CmsDatabaseClient,
  DatabaseBenchmarkResult,
  DatabaseHealthReport,
  ScaleSeedResult,
} from '@repo/cms-db';
import {
  benchmarkDatabase,
  createCmsDatabase,
  inspectDatabaseHealth,
  resetDatabase,
  seedStoreScale,
} from '@repo/cms-db';
import type {
  BlockVersion,
  DefaultDocument,
  JsonObject,
  JsonValue,
  ResolvedDocument,
  SelectorRecord,
  VariantLayer,
} from '@repo/cms-domain';
import {
  canonicalJson,
  compilePublication,
  compileSelector,
  createDocumentManifest,
  evaluateSelector,
  interpolateJson,
  resolveDocument,
  setPlacement,
} from '@repo/cms-domain';
import { CmsService } from '@repo/cms-service';

import { runStoreServiceProof, type StoreServiceEvidence } from './service-integration';

export const DEFAULT_STORE_PAGE_COUNT = 1_000_000;
const STORE_SELECTOR_FIELDS = ['store_type', 'category', 'brand'] as const;

interface StoreClassFixture {
  readonly id: string;
  readonly canonicalUrl: string;
  readonly tags: SelectorRecord;
  readonly context: JsonObject;
}

interface StoreVariant {
  readonly selector: string;
  readonly layer: VariantLayer;
}

export interface QueryPlanEvidence {
  readonly steps: readonly string[];
  readonly usesIndex: boolean;
}

export interface StoreClassGolden {
  readonly classId: string;
  readonly contentHash: string;
  readonly manifestHash: string;
  readonly matchedVariantIds: readonly string[];
  readonly blockVersionIds: readonly string[];
  readonly renderedHero: JsonValue;
}

export interface PersistedStoreClassGolden {
  readonly classId:
    | 'independent'
    | 'chain-non-fast-food'
    | 'generic-fast-food-chain'
    | 'mcdonalds'
    | 'burger-king';
  readonly pageId: string;
  readonly tags: readonly string[];
  readonly contentHash: string;
  readonly matchedVariantRevisionIds: readonly string[];
  readonly blockVersionIds: readonly string[];
}

export interface StoreSelectorDemonstration {
  readonly variantId:
    | 'variant-store-chain'
    | 'variant-store-fast-food'
    | 'variant-store-mcdonalds'
    | 'variant-store-burger-king';
  readonly variantRevisionId: string;
  readonly selector: string;
  readonly priority: number;
  readonly matchCount: number;
  readonly samplePages: readonly {
    readonly pageId: string;
    readonly canonicalUrl: string;
  }[];
  readonly sampleTruncated: boolean;
  readonly previewElapsedMilliseconds: number;
  readonly planSteps: readonly string[];
  readonly planUsesIndex: boolean;
  readonly affectedPlacementKeys: readonly string[];
  readonly estimatedAffectedPlacementRows: number;
  readonly pairwiseOverlaps: readonly {
    readonly variantId: string;
    readonly matchCount: number;
    readonly conflictingPlacementKeys: readonly string[];
  }[];
}

export interface StoreRawCounts {
  readonly templatePageCount: number;
  readonly scalePageCount: number;
  readonly slotValueCount: number;
  readonly tagMembershipCount: number;
  readonly publicationCount: number;
  readonly publishedPageDocumentCount: number;
  readonly manifestCount: number;
  readonly manifestItemCount: number;
}

export interface ScalePublicationEvidence {
  readonly engine: '@repo/cms-service';
  readonly publicationId: string;
  readonly pageCount: number;
  readonly persistedDocumentCount: number;
  readonly manifestCount: number;
  readonly crossPublicationReusedManifestCount: number;
  readonly currentPointerActive: boolean;
  readonly preview: {
    readonly eligiblePageCount: number;
    readonly sampledPageCount: number;
    readonly truncated: boolean;
    readonly elapsedMilliseconds: number;
    readonly usesIndex: boolean;
  };
  readonly publicationElapsedMilliseconds: number;
  readonly publishedDocumentsPerSecond: number;
  readonly estimatedManifestPageStorageBytes: number;
  readonly logicalExpandedRenderedDocumentBytes: number;
  readonly idempotentRepublish: {
    readonly publicationId: string;
    readonly inputHashUnchanged: boolean;
    readonly reusedCurrentPublication: boolean;
    readonly reusedManifestCount: number;
    readonly logicalExpandedRenderedDocumentBytes: number;
    readonly elapsedMilliseconds: number;
    readonly documentRowsUnchanged: boolean;
  };
  readonly pageToManifestDedup: {
    readonly uniqueManifestCount: number;
    readonly pagesSharingManifest: number;
    readonly reusedPageCount: number;
    readonly deduplicatedPageRatio: number;
    readonly averagePagesPerManifest: number;
    readonly logicalExpandedPlacementCount: number;
    readonly uniqueStoredPlacementCount: number;
    readonly savedPlacementCount: number;
    readonly savedPlacementRatio: number;
    readonly logicalExpandedCanonicalStructureBytes: number;
    readonly uniqueCanonicalStructureBytes: number;
    readonly savedCanonicalStructureBytes: number;
  };
  readonly allocatedBytesBeforePublication: number;
  readonly allocatedBytesAfterPublication: number;
  readonly publicationStorageDeltaBytes: number;
  readonly publicationStorageBytesPerDocument: number;
  readonly serveReadPath: {
    readonly materializationMode: 'manifest';
    readonly sqlQueryCountPerRequest: 2;
    readonly selectorSqlExecutionsPerRequest: 0;
    readonly sqlStatements: readonly string[];
    readonly sampleCount: number;
    readonly p50Milliseconds: number;
    readonly p95Milliseconds: number;
  };
}

export interface StoreScenarioReport {
  readonly issueId: 'AUT-528';
  readonly requestedScalePageCount: number;
  readonly actualPageCount: number;
  readonly seed: ScaleSeedResult;
  readonly seedReplay: ScaleSeedResult & {
    readonly pageCountUnchanged: boolean;
    readonly tagMembershipCountUnchanged: boolean;
  };
  readonly databaseHealth: DatabaseHealthReport;
  readonly rawCounts: StoreRawCounts;
  readonly databaseStorage: {
    readonly pageCount: number;
    readonly pageSizeBytes: number;
    readonly freelistPageCount: number;
    readonly allocatedBytes: number;
  };
  readonly membershipCounts: {
    readonly chainStore: number;
    readonly fastFood: number;
    readonly mcdonalds: number;
    readonly burgerKing: number;
    readonly independent: number;
    readonly genericFastFoodChain: number;
    readonly chainNonFastFood: number;
  };
  readonly canonicalLookupPlan: QueryPlanEvidence;
  readonly tagLookupPlan: QueryPlanEvidence;
  readonly benchmark: DatabaseBenchmarkResult;
  readonly representativePublication: ReturnType<typeof compilePublication>;
  readonly classGoldens: readonly StoreClassGolden[];
  readonly persistedClassGoldens: readonly PersistedStoreClassGolden[];
  readonly completeFiveClassCoverage: boolean;
  readonly selectorDemonstrations: readonly StoreSelectorDemonstration[];
  readonly scalePublication: ScalePublicationEvidence;
  readonly publicServeReadPath: StoreServiceEvidence['serveReadPath'];
  readonly interpolationManifestSharing: {
    readonly firstPageId: 'page-store-1001';
    readonly secondPageId: 'page-store-scale-0';
    readonly sharedManifestId: string;
    readonly sameStructuralManifest: boolean;
    readonly renderedHeroHeadlines: readonly [string, string];
    readonly renderedOutputDiffers: boolean;
    readonly documentHashesDiffer: boolean;
  };
  readonly mutationPropagation: {
    readonly fastFoodPromoUpdateReachedBothBrands: boolean;
    readonly fastFoodPromoUpdateLeftBrandHeroesUnchanged: boolean;
    readonly mcdonaldsHeroEditIsolatedFromBurgerKingAndDefault: boolean;
  };
  readonly namedBrandsSharedUnchangedBlockVersionIds: readonly string[];
  readonly independentTagRemoval: {
    readonly before: readonly string[];
    readonly after: readonly string[];
    readonly removedOnlyRequestedMembership: boolean;
  };
  readonly routeStatusOutcomes: readonly {
    readonly routeStatus: 'live' | 'not_live' | 'archived';
    readonly actualHttpStatus: 200 | 404;
    readonly reason: 'served' | 'not_live' | 'archived';
    readonly serviceVerified: true;
  }[];
  readonly limitations: readonly string[];
}

export interface StoreScenarioOptions {
  readonly databasePath?: string;
  readonly pageCount?: number;
  readonly benchmarkSamples?: number;
  readonly publishScale?: boolean;
  readonly reset?: boolean;
  readonly onProgress?: (inserted: number, total: number) => void;
  readonly onPhaseProgress?: (progress: StorePhaseProgress) => void;
}

export interface StorePhaseProgress {
  readonly phase: 'seed' | 'compile' | 'write' | 'republish_compile' | 'republish_write';
  readonly completed: number;
  readonly total: number;
}

interface CountRow {
  readonly count: number;
}

function percentile(samples: readonly number[], value: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0;
}

interface PragmaRow {
  readonly page_count?: number;
  readonly page_size?: number;
  readonly freelist_count?: number;
}

interface QueryPlanRow {
  readonly detail: string;
}

interface StoredVariantEvidenceRow {
  readonly variantId: StoreSelectorDemonstration['variantId'];
  readonly priority: number;
  readonly revisionId: string;
  readonly selector: string;
}

function storeBlock(
  id: string,
  lineageId: string,
  blockType: string,
  content: JsonObject
): BlockVersion {
  return { id, lineageId, blockType, schemaVersion: 1, content };
}

function storeDefault(): DefaultDocument {
  return {
    templateId: 'tpl-store',
    placements: [
      {
        placementKey: 'navigation',
        order: 0,
        blockVersion: storeBlock(
          'block-store-navigation-v1',
          'lineage-store-navigation',
          'navigation',
          { label: 'Uber Eats' }
        ),
      },
      {
        placementKey: 'primary-hero',
        order: 1,
        blockVersion: storeBlock('block-store-hero-v1', 'lineage-store-primary-hero', 'hero', {
          headline: 'I am {{ store.name }} — {{ store.location }}',
        }),
      },
      {
        placementKey: 'category-promo',
        order: 2,
        blockVersion: storeBlock('block-store-promo-v1', 'lineage-store-category-promo', 'promo', {
          message: 'Local favorites',
        }),
      },
      {
        placementKey: 'footer',
        order: 3,
        blockVersion: storeBlock('block-store-footer-v1', 'lineage-store-footer', 'footer', {
          legal: 'Standard terms',
        }),
      },
    ],
  };
}

function storeVariants(): readonly StoreVariant[] {
  return [
    {
      selector: "store_type = 'chain_store'",
      layer: {
        id: 'variant-store-chain',
        priority: 10,
        operations: [
          setPlacement(
            'footer',
            storeBlock('block-store-footer-v2-chain', 'lineage-store-footer', 'footer', {
              legal: 'Chain-store terms',
            })
          ),
        ],
      },
    },
    {
      selector: "category = 'fast_food'",
      layer: {
        id: 'variant-store-fast-food',
        priority: 20,
        operations: [
          setPlacement(
            'category-promo',
            storeBlock('block-store-promo-v2-fast', 'lineage-store-category-promo', 'promo', {
              message: 'Fast-food deals',
            })
          ),
        ],
      },
    },
    {
      selector: "brand = 'mcdonalds'",
      layer: {
        id: 'variant-store-mcdonalds',
        priority: 30,
        operations: [
          setPlacement(
            'primary-hero',
            storeBlock('block-store-hero-v2-mcd', 'lineage-store-primary-hero', 'hero', {
              headline: 'Buy now {{ store.name }} — {{ store.location }}',
            })
          ),
        ],
      },
    },
    {
      selector: "brand = 'burger_king'",
      layer: {
        id: 'variant-store-burger-king',
        priority: 30,
        operations: [
          setPlacement(
            'primary-hero',
            storeBlock('block-store-hero-v3-bk', 'lineage-store-primary-hero', 'hero', {
              headline: 'Buy today {{ store.name }} — {{ store.location }}',
            })
          ),
        ],
      },
    },
  ];
}

function storeClassFixtures(): readonly StoreClassFixture[] {
  return [
    {
      id: 'independent',
      canonicalUrl: '/en-US/store/class-independent',
      tags: { store_type: ['independent'] },
      context: { store: { name: 'Neighborhood Kitchen', location: 'Oakland' } },
    },
    {
      id: 'chain-non-fast-food',
      canonicalUrl: '/en-US/store/class-chain',
      tags: { store_type: ['chain_store'] },
      context: { store: { name: 'Market Hall', location: 'San Jose' } },
    },
    {
      id: 'generic-fast-food-chain',
      canonicalUrl: '/en-US/store/class-fast-food',
      tags: { store_type: ['chain_store'], category: ['fast_food'] },
      context: { store: { name: 'Quick Bites', location: 'Berkeley' } },
    },
    {
      id: 'mcdonalds',
      canonicalUrl: '/en-US/store/class-mcdonalds',
      tags: {
        store_type: ['chain_store'],
        category: ['fast_food'],
        brand: ['mcdonalds'],
      },
      context: { store: { name: "McDonald's Market", location: 'San Francisco' } },
    },
    {
      id: 'burger-king',
      canonicalUrl: '/en-US/store/class-burger-king',
      tags: {
        store_type: ['chain_store'],
        category: ['fast_food'],
        brand: ['burger_king'],
      },
      context: { store: { name: 'Burger King Downtown', location: 'San Francisco' } },
    },
  ];
}

function resolveStoreClass(
  fixture: StoreClassFixture,
  configuredVariants: readonly StoreVariant[] = storeVariants()
): ResolvedDocument {
  const variants = configuredVariants.flatMap((variant) => {
    const expression = compileSelector(variant.selector, {
      fields: STORE_SELECTOR_FIELDS,
    }).expression;
    return evaluateSelector(expression, fixture.tags) ? [variant.layer] : [];
  });
  return resolveDocument(storeDefault(), variants);
}

function readCount(client: CmsDatabaseClient, sql: string): number {
  return client.sqlite.query<CountRow, []>(sql).get()?.count ?? 0;
}

function readParameterizedCount(
  client: CmsDatabaseClient,
  sql: string,
  parameters: readonly string[]
): number {
  return client.sqlite.query<CountRow, string[]>(sql).get(...parameters)?.count ?? 0;
}

function pragmaNumber(client: CmsDatabaseClient, pragma: string, key: keyof PragmaRow): number {
  return client.sqlite.query<PragmaRow, []>(`PRAGMA ${pragma}`).get()?.[key] ?? 0;
}

function explain(
  client: CmsDatabaseClient,
  sql: string,
  parameters: readonly (number | string)[],
  expectedIndex: string
): QueryPlanEvidence {
  const rows = client.sqlite
    .query<QueryPlanRow, (number | string)[]>(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...parameters);
  const steps = rows.map((row) => row.detail);
  return {
    steps,
    usesIndex: steps.some((step) => step.includes(expectedIndex)),
  };
}

function readTagLabels(client: CmsDatabaseClient): readonly string[] {
  return client.sqlite
    .query<{ label: string }, []>(`
      SELECT t.namespace || '=' || t.value AS label
      FROM page_tags AS pt
      JOIN tags AS t ON t.id = pt.tag_id AND t.template_id = pt.template_id
      WHERE pt.page_instance_id = 'page-store-1001'
      ORDER BY t.namespace, t.value
    `)
    .all()
    .map((row) => row.label);
}

function readTagsForPage(client: CmsDatabaseClient, pageId: string): readonly string[] {
  return client.sqlite
    .query<{ label: string }, [string]>(`
      SELECT tags.namespace || '=' || tags.value AS label
      FROM page_tags
      JOIN tags ON tags.id = page_tags.tag_id
      WHERE page_tags.page_instance_id = ?
      ORDER BY label
    `)
    .all(pageId)
    .map((row) => row.label);
}

function persistedStoreClassGoldens(
  client: CmsDatabaseClient,
  service: CmsService,
  pageCount: number
): readonly PersistedStoreClassGolden[] {
  const fixtures = [
    { classId: 'mcdonalds', index: 0 },
    { classId: 'independent', index: 1 },
    { classId: 'generic-fast-food-chain', index: 2 },
    { classId: 'chain-non-fast-food', index: 4 },
    { classId: 'burger-king', index: 10 },
  ] as const;
  return fixtures.flatMap(({ classId, index }) => {
    if (index >= pageCount) {
      return [];
    }
    const pageId = `page-store-scale-${index}`;
    const document = service.resolvePage('tpl-store', pageId).document;
    return [
      {
        classId,
        pageId,
        tags: readTagsForPage(client, pageId),
        contentHash: document.contentHash,
        matchedVariantRevisionIds: document.matchedVariantIds,
        blockVersionIds: document.placements.map((placement) => placement.blockVersion.id),
      },
    ];
  });
}

function persistedSelectorDemonstrations(
  client: CmsDatabaseClient,
  service: CmsService
): readonly StoreSelectorDemonstration[] {
  const requiredVariantIds = new Set<StoreSelectorDemonstration['variantId']>([
    'variant-store-chain',
    'variant-store-fast-food',
    'variant-store-mcdonalds',
    'variant-store-burger-king',
  ]);
  const variants = client.sqlite
    .query<StoredVariantEvidenceRow, []>(`
      SELECT variants.id AS variantId, variants.priority,
             revisions.id AS revisionId, revisions.selector_sql AS selector
      FROM variants
      JOIN variant_revisions AS revisions ON revisions.id = variants.active_revision_id
      WHERE variants.template_id = 'tpl-store'
        AND variants.id IN (
          'variant-store-chain',
          'variant-store-fast-food',
          'variant-store-mcdonalds',
          'variant-store-burger-king'
        )
      ORDER BY variants.priority, variants.id
    `)
    .all();
  if (variants.length !== requiredVariantIds.size) {
    throw new Error('The four persisted Store selector variants were not all available.');
  }
  return variants.map((variant) => {
    const startedAt = performance.now();
    const preview = service.previewSelector('tpl-store', variant.selector, 5);
    const previewElapsedMilliseconds = performance.now() - startedAt;
    const affectedPlacementKeys = client.sqlite
      .query<{ placementKey: string }, [string]>(`
        SELECT DISTINCT placement_key AS placementKey
        FROM variant_operations
        WHERE variant_revision_id = ?
        ORDER BY placement_key
      `)
      .all(variant.revisionId)
      .map((row) => row.placementKey);
    const pairwiseOverlaps = service
      .previewVariantOverlap('tpl-store', variant.variantId, 5)
      .filter((overlap) => requiredVariantIds.has(overlap.variantId as never))
      .map((overlap) => ({
        variantId: overlap.variantId,
        matchCount: overlap.overlapCount,
        conflictingPlacementKeys: overlap.conflictingPlacementKeys,
      }));
    return {
      variantId: variant.variantId,
      variantRevisionId: variant.revisionId,
      selector: variant.selector,
      priority: variant.priority,
      matchCount: preview.totalCount,
      samplePages: preview.rows.map((row) => ({
        pageId: row.pageId,
        canonicalUrl: row.canonicalUrl,
      })),
      sampleTruncated: preview.truncated,
      previewElapsedMilliseconds,
      planSteps: preview.plan.map((step) => step.detail),
      planUsesIndex: preview.plan.some((step) => /index/i.test(step.detail)),
      affectedPlacementKeys,
      estimatedAffectedPlacementRows: preview.totalCount * affectedPlacementKeys.length,
      pairwiseOverlaps,
    };
  });
}

function storeRawCounts(client: CmsDatabaseClient): StoreRawCounts {
  return {
    templatePageCount: readCount(
      client,
      "SELECT count(*) AS count FROM page_instances WHERE template_id = 'tpl-store'"
    ),
    scalePageCount: readCount(
      client,
      "SELECT count(*) AS count FROM page_instances WHERE id LIKE 'page-store-scale-%'"
    ),
    slotValueCount: readCount(
      client,
      "SELECT count(*) AS count FROM page_slot_values WHERE template_id = 'tpl-store'"
    ),
    tagMembershipCount: readCount(
      client,
      "SELECT count(*) AS count FROM page_tags WHERE template_id = 'tpl-store'"
    ),
    publicationCount: readCount(
      client,
      "SELECT count(*) AS count FROM publications WHERE template_id = 'tpl-store'"
    ),
    publishedPageDocumentCount: readCount(
      client,
      "SELECT count(*) AS count FROM published_page_documents WHERE template_id = 'tpl-store'"
    ),
    manifestCount: readCount(
      client,
      "SELECT count(*) AS count FROM document_manifests WHERE template_id = 'tpl-store'"
    ),
    manifestItemCount: readCount(
      client,
      `SELECT count(*) AS count
       FROM document_manifest_items AS items
       JOIN document_manifests AS manifests ON manifests.id = items.manifest_id
       WHERE manifests.template_id = 'tpl-store'`
    ),
  };
}

function renderedHeroHeadline(document: JsonValue): string {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Published Store document was not an object.');
  }
  const placements = (document as JsonObject).placements;
  if (!Array.isArray(placements)) {
    throw new Error('Published Store document did not contain placements.');
  }
  for (const placement of placements) {
    if (!placement || typeof placement !== 'object' || Array.isArray(placement)) continue;
    if (placement.placementKey !== 'primary-hero') continue;
    const content = placement.content;
    if (!content || typeof content !== 'object' || Array.isArray(content)) break;
    if (typeof content.headline === 'string') return content.headline;
  }
  throw new Error('Published Store document did not contain a rendered hero headline.');
}

function interpolationManifestSharingEvidence(
  client: CmsDatabaseClient,
  service: CmsService,
  publicationId: string,
  pageCount: number
): StoreScenarioReport['interpolationManifestSharing'] {
  if (pageCount < 1) {
    throw new Error('The Store interpolation proof requires at least one scale page.');
  }
  const manifests = client.sqlite
    .query<{ manifestId: string; pageId: string }, [string]>(`
      SELECT page_instance_id AS pageId, manifest_id AS manifestId
      FROM published_page_documents
      WHERE publication_id = ?
        AND page_instance_id IN ('page-store-1001', 'page-store-scale-0')
      ORDER BY page_instance_id
    `)
    .all(publicationId);
  const manifestByPage = new Map(manifests.map((row) => [row.pageId, row.manifestId]));
  const firstManifest = manifestByPage.get('page-store-1001');
  const secondManifest = manifestByPage.get('page-store-scale-0');
  const first = service.serve('tpl-store', '/en-US/store/1001');
  const second = service.serve('tpl-store', '/en-US/store/2000000');
  if (first.status !== 200 || second.status !== 200 || !firstManifest || !secondManifest) {
    throw new Error('Published Store interpolation fixtures were not available.');
  }
  const renderedHeroHeadlines = [
    renderedHeroHeadline(first.document),
    renderedHeroHeadline(second.document),
  ] as const;
  return {
    firstPageId: 'page-store-1001',
    secondPageId: 'page-store-scale-0',
    sharedManifestId: firstManifest,
    sameStructuralManifest: firstManifest === secondManifest,
    renderedHeroHeadlines,
    renderedOutputDiffers: renderedHeroHeadlines[0] !== renderedHeroHeadlines[1],
    documentHashesDiffer: first.documentHash !== second.documentHash,
  };
}

function placementVersion(document: ResolvedDocument, placementKey: string): string {
  const placement = document.placements.find((entry) => entry.placementKey === placementKey);
  if (!placement) throw new Error(`Store document has no ${placementKey} placement.`);
  return placement.blockVersion.id;
}

function mutationPropagationEvidence(): StoreScenarioReport['mutationPropagation'] {
  const fixtures = new Map(storeClassFixtures().map((fixture) => [fixture.id, fixture]));
  const mcdonalds = fixtures.get('mcdonalds');
  const burgerKing = fixtures.get('burger-king');
  const independent = fixtures.get('independent');
  if (!mcdonalds || !burgerKing || !independent) {
    throw new Error('Store mutation fixtures were not generated.');
  }
  const baselineMcdonalds = resolveStoreClass(mcdonalds);
  const baselineBurgerKing = resolveStoreClass(burgerKing);
  const baselineIndependent = resolveStoreClass(independent);
  const fastFoodUpdate = storeVariants().map(
    (variant): StoreVariant =>
      variant.layer.id === 'variant-store-fast-food'
        ? {
            ...variant,
            layer: {
              ...variant.layer,
              operations: [
                setPlacement(
                  'category-promo',
                  storeBlock(
                    'block-store-promo-v3-fast-proof',
                    'lineage-store-category-promo',
                    'promo',
                    { message: 'Updated fast-food deals' }
                  )
                ),
              ],
            },
          }
        : variant
  );
  const fastMcdonalds = resolveStoreClass(mcdonalds, fastFoodUpdate);
  const fastBurgerKing = resolveStoreClass(burgerKing, fastFoodUpdate);
  const mcdonaldsHeroUpdate = storeVariants().map(
    (variant): StoreVariant =>
      variant.layer.id === 'variant-store-mcdonalds'
        ? {
            ...variant,
            layer: {
              ...variant.layer,
              operations: [
                setPlacement(
                  'primary-hero',
                  storeBlock(
                    'block-store-hero-v4-mcd-proof',
                    'lineage-store-primary-hero',
                    'hero',
                    { headline: "Edited McDonald's {{ store.name }} — {{ store.location }}" }
                  )
                ),
              ],
            },
          }
        : variant
  );
  const editedMcdonalds = resolveStoreClass(mcdonalds, mcdonaldsHeroUpdate);
  const editedBurgerKing = resolveStoreClass(burgerKing, mcdonaldsHeroUpdate);
  const editedIndependent = resolveStoreClass(independent, mcdonaldsHeroUpdate);
  return {
    fastFoodPromoUpdateReachedBothBrands:
      placementVersion(fastMcdonalds, 'category-promo') === 'block-store-promo-v3-fast-proof' &&
      placementVersion(fastBurgerKing, 'category-promo') === 'block-store-promo-v3-fast-proof',
    fastFoodPromoUpdateLeftBrandHeroesUnchanged:
      placementVersion(fastMcdonalds, 'primary-hero') ===
        placementVersion(baselineMcdonalds, 'primary-hero') &&
      placementVersion(fastBurgerKing, 'primary-hero') ===
        placementVersion(baselineBurgerKing, 'primary-hero'),
    mcdonaldsHeroEditIsolatedFromBurgerKingAndDefault:
      placementVersion(editedMcdonalds, 'primary-hero') === 'block-store-hero-v4-mcd-proof' &&
      placementVersion(editedBurgerKing, 'primary-hero') ===
        placementVersion(baselineBurgerKing, 'primary-hero') &&
      placementVersion(editedIndependent, 'primary-hero') ===
        placementVersion(baselineIndependent, 'primary-hero'),
  };
}

function databaseAllocatedBytes(client: CmsDatabaseClient): number {
  return (
    pragmaNumber(client, 'page_count', 'page_count') *
    pragmaNumber(client, 'page_size', 'page_size')
  );
}

interface ManifestUsageRow {
  readonly manifestId: string;
  readonly pageCount: number;
  readonly placementCount: number;
}

interface ManifestItemRow {
  readonly placementKey: string;
  readonly ordinal: number;
  readonly blockVersionId: string;
  readonly sourceRevisionId: string;
  readonly sourceOperationId: string;
  readonly sourcePriority: number;
}

function pageToManifestDedup(client: CmsDatabaseClient, publicationId: string) {
  const usages = client.sqlite
    .query<ManifestUsageRow, [string]>(`
      SELECT documents.manifest_id AS manifestId,
             count(*) AS pageCount,
             manifests.placement_count AS placementCount
      FROM published_page_documents AS documents
      JOIN document_manifests AS manifests ON manifests.id = documents.manifest_id
      WHERE documents.publication_id = ?
      GROUP BY documents.manifest_id, manifests.placement_count
      ORDER BY documents.manifest_id
    `)
    .all(publicationId);
  let logicalExpandedCanonicalStructureBytes = 0;
  let uniqueCanonicalStructureBytes = 0;
  for (const usage of usages) {
    const items = client.sqlite
      .query<ManifestItemRow, [string]>(`
        SELECT placement_key AS placementKey, ordinal, block_version_id AS blockVersionId,
               source_variant_revision_id AS sourceRevisionId,
               source_operation_id AS sourceOperationId, source_priority AS sourcePriority
        FROM document_manifest_items
        WHERE manifest_id = ?
        ORDER BY ordinal
      `)
      .all(usage.manifestId);
    const canonicalStructureBytes = new TextEncoder().encode(
      canonicalJson({
        manifestId: usage.manifestId,
        items: items.map((item) => ({
          placementKey: item.placementKey,
          ordinal: item.ordinal,
          blockVersionId: item.blockVersionId,
          sourceRevisionId: item.sourceRevisionId,
          sourceOperationId: item.sourceOperationId,
          sourcePriority: item.sourcePriority,
        })),
      })
    ).byteLength;
    uniqueCanonicalStructureBytes += canonicalStructureBytes;
    logicalExpandedCanonicalStructureBytes += canonicalStructureBytes * usage.pageCount;
  }
  const pageCount = usages.reduce((total, usage) => total + usage.pageCount, 0);
  const uniqueManifestCount = usages.length;
  const pagesSharingManifest = usages.reduce(
    (total, usage) => total + (usage.pageCount > 1 ? usage.pageCount : 0),
    0
  );
  const reusedPageCount = usages.reduce(
    (total, usage) => total + Math.max(0, usage.pageCount - 1),
    0
  );
  const logicalExpandedPlacementCount = usages.reduce(
    (total, usage) => total + usage.pageCount * usage.placementCount,
    0
  );
  const uniqueStoredPlacementCount = usages.reduce(
    (total, usage) => total + usage.placementCount,
    0
  );
  const savedPlacementCount = logicalExpandedPlacementCount - uniqueStoredPlacementCount;
  return {
    uniqueManifestCount,
    pagesSharingManifest,
    reusedPageCount,
    deduplicatedPageRatio: pageCount === 0 ? 0 : reusedPageCount / pageCount,
    averagePagesPerManifest: uniqueManifestCount === 0 ? 0 : pageCount / uniqueManifestCount,
    logicalExpandedPlacementCount,
    uniqueStoredPlacementCount,
    savedPlacementCount,
    savedPlacementRatio:
      logicalExpandedPlacementCount === 0 ? 0 : savedPlacementCount / logicalExpandedPlacementCount,
    logicalExpandedCanonicalStructureBytes,
    uniqueCanonicalStructureBytes,
    savedCanonicalStructureBytes:
      logicalExpandedCanonicalStructureBytes - uniqueCanonicalStructureBytes,
  };
}

function publishScaleDatabase(
  client: CmsDatabaseClient,
  service: CmsService,
  pageCount: number,
  publishScale: boolean,
  resolveSampleCount: number,
  onPhaseProgress?: (progress: StorePhaseProgress) => void
): ScalePublicationEvidence {
  const previewStartedAt = performance.now();
  const preview = service.previewSelector('tpl-store', "route_status = 'live'", 50);
  const previewElapsedMilliseconds = performance.now() - previewStartedAt;
  const eligiblePageCount = readParameterizedCount(
    client,
    "SELECT count(*) AS count FROM page_instances WHERE template_id = ? AND route_status <> 'archived'",
    ['tpl-store']
  );
  const allocatedBytesBeforePublication = databaseAllocatedBytes(client);
  if (!publishScale) {
    throw new Error(
      'publishScale=false is unsupported for an AUT-528 proof; use the seed command for authoring-only data.'
    );
  }
  const publicationStartedAt = performance.now();
  const publication = service.publish('tpl-store', {
    id: `publication-store-scale-${pageCount}`,
    createdBy: 'scenario-scale-publisher',
    onProgress: (progress) =>
      onPhaseProgress?.({
        phase: progress.phase,
        completed: progress.pagesProcessed,
        total: progress.totalPages,
      }),
  });
  const publicationElapsedMilliseconds = performance.now() - publicationStartedAt;
  const persistedDocumentCount = readParameterizedCount(
    client,
    'SELECT count(*) AS count FROM published_page_documents WHERE publication_id = ?',
    [publication.publicationId]
  );
  const dedup = pageToManifestDedup(client, publication.publicationId);
  const republishStartedAt = performance.now();
  const republish = service.publish('tpl-store', {
    id: `publication-store-scale-${pageCount}-idempotency-check`,
    createdBy: 'scenario-scale-publisher',
    onProgress: (progress) =>
      onPhaseProgress?.({
        phase: `republish_${progress.phase}`,
        completed: progress.pagesProcessed,
        total: progress.totalPages,
      }),
  });
  const republishElapsedMilliseconds = performance.now() - republishStartedAt;
  const documentCountAfterRepublish = readParameterizedCount(
    client,
    'SELECT count(*) AS count FROM published_page_documents WHERE publication_id = ?',
    [publication.publicationId]
  );
  const allocatedBytesAfterPublication = databaseAllocatedBytes(client);
  const currentPointerActive =
    client.sqlite
      .query<{ publicationId: string }, [string]>(
        'SELECT publication_id AS publicationId FROM current_publications WHERE template_id = ?'
      )
      .get('tpl-store')?.publicationId === publication.publicationId;
  const serveTimings: number[] = [];
  for (let index = 0; index < resolveSampleCount; index += 1) {
    const row = pageCount === 0 ? 0 : (index * 7919) % pageCount;
    const canonicalUrl = pageCount === 0 ? '/en-US/store/1001' : `/en-US/store/${2_000_000 + row}`;
    const evidence = service.serveWithEvidence('tpl-store', canonicalUrl);
    if (
      evidence.result.status !== 200 ||
      evidence.materializationMode !== 'manifest' ||
      evidence.sqlQueryCount !== 2 ||
      evidence.selectorSqlExecutions !== 0
    ) {
      throw new Error('Scale serve read-path evidence was not fixed and selector-free.');
    }
    serveTimings.push(evidence.elapsedMilliseconds);
  }
  return {
    engine: '@repo/cms-service',
    publicationId: publication.publicationId,
    pageCount: publication.pageCount,
    persistedDocumentCount,
    manifestCount: publication.manifestCount,
    crossPublicationReusedManifestCount: publication.reusedManifestCount,
    currentPointerActive,
    preview: {
      eligiblePageCount,
      sampledPageCount: preview.rows.length,
      truncated: preview.truncated,
      elapsedMilliseconds: previewElapsedMilliseconds,
      usesIndex: preview.plan.some((step) => /index/i.test(step.detail)),
    },
    publicationElapsedMilliseconds,
    publishedDocumentsPerSecond:
      publicationElapsedMilliseconds === 0
        ? 0
        : persistedDocumentCount / (publicationElapsedMilliseconds / 1_000),
    estimatedManifestPageStorageBytes: publication.estimatedStorageBytes,
    logicalExpandedRenderedDocumentBytes: publication.logicalExpandedRenderedDocumentBytes,
    idempotentRepublish: {
      publicationId: republish.publicationId,
      inputHashUnchanged: republish.inputHash === publication.inputHash,
      reusedCurrentPublication: republish.reusedCurrentPublication,
      reusedManifestCount: republish.reusedManifestCount,
      logicalExpandedRenderedDocumentBytes: republish.logicalExpandedRenderedDocumentBytes,
      elapsedMilliseconds: republishElapsedMilliseconds,
      documentRowsUnchanged: documentCountAfterRepublish === persistedDocumentCount,
    },
    pageToManifestDedup: dedup,
    allocatedBytesBeforePublication,
    allocatedBytesAfterPublication,
    publicationStorageDeltaBytes: allocatedBytesAfterPublication - allocatedBytesBeforePublication,
    publicationStorageBytesPerDocument:
      persistedDocumentCount === 0
        ? 0
        : (allocatedBytesAfterPublication - allocatedBytesBeforePublication) /
          persistedDocumentCount,
    serveReadPath: {
      materializationMode: 'manifest',
      sqlQueryCountPerRequest: 2,
      selectorSqlExecutionsPerRequest: 0,
      sqlStatements: service.getServeReadQueryTexts('manifest'),
      sampleCount: serveTimings.length,
      p50Milliseconds: percentile(serveTimings, 0.5),
      p95Milliseconds: percentile(serveTimings, 0.95),
    },
  };
}

function independentTagRemovalEvidence(client: CmsDatabaseClient) {
  client.sqlite.exec('BEGIN IMMEDIATE');
  try {
    const before = readTagLabels(client);
    client.sqlite
      .query(
        `DELETE FROM page_tags
         WHERE page_instance_id = 'page-store-1001'
           AND tag_id = 'tag-store-category-fast-food'`
      )
      .run();
    const after = readTagLabels(client);
    const expectedAfter = before.filter((tag) => tag !== 'category=fast_food');
    return {
      before,
      after,
      removedOnlyRequestedMembership:
        JSON.stringify(after) === JSON.stringify(expectedAfter) &&
        after.includes('brand=mcdonalds') &&
        after.includes('store_type=chain_store'),
    };
  } finally {
    client.sqlite.exec('ROLLBACK');
  }
}

export async function runStoreProof(
  options: StoreScenarioOptions = {}
): Promise<StoreScenarioReport> {
  const pageCount = options.pageCount ?? DEFAULT_STORE_PAGE_COUNT;
  const client = createCmsDatabase({ databasePath: options.databasePath ?? ':memory:' });
  try {
    if (options.reset ?? true) {
      await resetDatabase(client);
      // Evidence databases are intentionally reusable paths. Reclaim pages from the prior run so
      // allocated-byte deltas describe this run rather than historical freelist capacity.
      client.sqlite.exec('VACUUM');
    }
    const seed = await seedStoreScale(client, {
      pageCount,
      onProgress: (inserted, total) => {
        options.onProgress?.(inserted, total);
        options.onPhaseProgress?.({ phase: 'seed', completed: inserted, total });
      },
    });
    const pageCountBeforeReplay = readCount(
      client,
      "SELECT count(*) AS count FROM page_instances WHERE id LIKE 'page-store-scale-%'"
    );
    const tagMembershipCountBeforeReplay = readCount(
      client,
      "SELECT count(*) AS count FROM page_tags WHERE template_id = 'tpl-store'"
    );
    const replay = await seedStoreScale(client, { pageCount });
    const pageCountAfterReplay = readCount(
      client,
      "SELECT count(*) AS count FROM page_instances WHERE id LIKE 'page-store-scale-%'"
    );
    const tagMembershipCountAfterReplay = readCount(
      client,
      "SELECT count(*) AS count FROM page_tags WHERE template_id = 'tpl-store'"
    );
    const seedReplay = {
      ...replay,
      pageCountUnchanged: pageCountAfterReplay === pageCountBeforeReplay,
      tagMembershipCountUnchanged: tagMembershipCountAfterReplay === tagMembershipCountBeforeReplay,
    };
    if (
      !seedReplay.reusedExistingSeed ||
      seedReplay.insertedPageCount !== 0 ||
      seedReplay.seedIdentityHash !== seed.seedIdentityHash ||
      !seedReplay.pageCountUnchanged ||
      !seedReplay.tagMembershipCountUnchanged
    ) {
      throw new Error('Store scale seed replay was not idempotent.');
    }
    const databaseHealth = inspectDatabaseHealth(client);
    if (!databaseHealth.healthy) {
      throw new Error(
        `Store scenario database is unhealthy: ${databaseHealth.problems.join('; ')}`
      );
    }
    const scaleService = new CmsService(client, {
      now: () => '2026-01-04T00:00:00.000Z',
      createId: (scope) => `store-scale:${scope}:${pageCount}`,
    });
    const persistedClassGoldens = persistedStoreClassGoldens(client, scaleService, pageCount);
    const selectorDemonstrations = persistedSelectorDemonstrations(client, scaleService);
    const scalePublication = publishScaleDatabase(
      client,
      scaleService,
      pageCount,
      options.publishScale ?? true,
      options.benchmarkSamples ?? 250,
      options.onPhaseProgress
    );
    const interpolationManifestSharing = interpolationManifestSharingEvidence(
      client,
      scaleService,
      scalePublication.publicationId,
      pageCount
    );
    const publishedDatabaseHealth = inspectDatabaseHealth(client);
    if (!publishedDatabaseHealth.healthy) {
      throw new Error(
        `Published Store scenario database is unhealthy: ${publishedDatabaseHealth.problems.join('; ')}`
      );
    }

    const fixtures = storeClassFixtures();
    const documents = fixtures.map((fixture) => ({
      fixture,
      document: resolveStoreClass(fixture),
    }));
    const representativePublication = compilePublication(
      documents.map(({ fixture, document }) => ({
        pageId: `store-class:${fixture.id}`,
        canonicalUrl: fixture.canonicalUrl,
        document,
      }))
    );
    const classGoldens = documents.map<StoreClassGolden>(({ fixture, document }) => {
      const hero = document.placements.find(
        (placement) => placement.placementKey === 'primary-hero'
      );
      if (!hero) {
        throw new Error(`Store class ${fixture.id} has no primary hero.`);
      }
      return {
        classId: fixture.id,
        contentHash: document.contentHash,
        manifestHash: createDocumentManifest(document).hash,
        matchedVariantIds: document.matchedVariantIds,
        blockVersionIds: document.placements.map((placement) => placement.blockVersion.id),
        renderedHero: interpolateJson(hero.blockVersion.content, fixture.context),
      };
    });
    const mcdonalds = documents.find(({ fixture }) => fixture.id === 'mcdonalds');
    const burgerKing = documents.find(({ fixture }) => fixture.id === 'burger-king');
    if (!mcdonalds || !burgerKing) {
      throw new Error('Named-brand fixtures were not generated.');
    }
    const mcdonaldsIds = new Set(
      mcdonalds.document.placements
        .filter((placement) => placement.placementKey !== 'primary-hero')
        .map((placement) => placement.blockVersion.id)
    );
    const namedBrandsSharedUnchangedBlockVersionIds = burgerKing.document.placements
      .filter(
        (placement) =>
          placement.placementKey !== 'primary-hero' && mcdonaldsIds.has(placement.blockVersion.id)
      )
      .map((placement) => placement.blockVersion.id)
      .sort();

    const canonicalTarget = pageCount > 0 ? '/en-US/store/2000000' : '/en-US/store/1001';
    const canonicalLookupPlan = explain(
      client,
      `SELECT pages.id, pages.route_status
       FROM templates
       JOIN page_instances AS pages ON pages.template_id = templates.id
       WHERE templates.domain = ? AND pages.canonical_url = ?`,
      ['www.ubereats.com', canonicalTarget],
      'page_instances_template_canonical_unique'
    );
    const tagLookupPlan = explain(
      client,
      `SELECT p.id
       FROM page_tags AS pt
       JOIN page_instances AS p
         ON p.id = pt.page_instance_id AND p.template_id = pt.template_id
       WHERE pt.template_id = ? AND pt.tag_id = ?
       ORDER BY p.id LIMIT ?`,
      ['tpl-store', 'tag-store-brand-mcdonalds', 25],
      'page_tags_selector_idx'
    );

    const serviceEvidence = await runStoreServiceProof();
    const pageSizeBytes = pragmaNumber(client, 'page_size', 'page_size');
    const allocatedPageCount = pragmaNumber(client, 'page_count', 'page_count');
    const freelistPageCount = pragmaNumber(client, 'freelist_count', 'freelist_count');
    return {
      issueId: 'AUT-528',
      requestedScalePageCount: pageCount,
      actualPageCount: readCount(client, 'SELECT count(*) AS count FROM page_instances'),
      seed,
      seedReplay,
      databaseHealth: publishedDatabaseHealth,
      rawCounts: storeRawCounts(client),
      databaseStorage: {
        pageCount: allocatedPageCount,
        pageSizeBytes,
        freelistPageCount,
        allocatedBytes: allocatedPageCount * pageSizeBytes,
      },
      membershipCounts: {
        chainStore: readCount(
          client,
          "SELECT count(*) AS count FROM page_tags WHERE tag_id = 'tag-store-type-chain'"
        ),
        fastFood: readCount(
          client,
          "SELECT count(*) AS count FROM page_tags WHERE tag_id = 'tag-store-category-fast-food'"
        ),
        mcdonalds: readCount(
          client,
          "SELECT count(*) AS count FROM page_tags WHERE tag_id = 'tag-store-brand-mcdonalds'"
        ),
        burgerKing: readCount(
          client,
          "SELECT count(*) AS count FROM page_tags WHERE tag_id = 'tag-store-brand-burger-king'"
        ),
        independent: readCount(
          client,
          "SELECT count(*) AS count FROM page_tags WHERE tag_id = 'tag-store-type-independent'"
        ),
        genericFastFoodChain: readCount(
          client,
          `SELECT count(*) AS count
           FROM page_instances AS pages
           WHERE pages.template_id = 'tpl-store'
             AND pages.id LIKE 'page-store-scale-%'
             AND EXISTS (
               SELECT 1 FROM page_tags
               WHERE page_instance_id = pages.id
                 AND tag_id = 'tag-store-category-fast-food'
             )
             AND NOT EXISTS (
               SELECT 1 FROM page_tags
               WHERE page_instance_id = pages.id
                 AND tag_id IN ('tag-store-brand-mcdonalds', 'tag-store-brand-burger-king')
             )`
        ),
        chainNonFastFood: readCount(
          client,
          `SELECT count(*) AS count
           FROM page_instances AS pages
           WHERE pages.template_id = 'tpl-store'
             AND pages.id LIKE 'page-store-scale-%'
             AND EXISTS (
               SELECT 1 FROM page_tags
               WHERE page_instance_id = pages.id
                 AND tag_id = 'tag-store-type-chain'
             )
             AND NOT EXISTS (
               SELECT 1 FROM page_tags
               WHERE page_instance_id = pages.id
                 AND tag_id = 'tag-store-category-fast-food'
             )`
        ),
      },
      canonicalLookupPlan,
      tagLookupPlan,
      benchmark: benchmarkDatabase(client, options.benchmarkSamples ?? 250),
      representativePublication,
      classGoldens,
      persistedClassGoldens,
      completeFiveClassCoverage: persistedClassGoldens.length === 5,
      selectorDemonstrations,
      scalePublication,
      publicServeReadPath: serviceEvidence.serveReadPath,
      interpolationManifestSharing,
      mutationPropagation: mutationPropagationEvidence(),
      namedBrandsSharedUnchangedBlockVersionIds,
      independentTagRemoval: independentTagRemovalEvidence(client),
      routeStatusOutcomes: serviceEvidence.routeStatusOutcomes.map((outcome) => ({
        routeStatus: outcome.routeStatus,
        actualHttpStatus: outcome.status,
        reason: outcome.reason,
        serviceVerified: true,
      })),
      limitations: [
        'Scale timings and allocated bytes are measurements of this local SQLite run only.',
        'Route-status outcomes are verified on a bounded service fixture, separate from the configurable scale database.',
        'The configurable scale database is previewed and published through the generic CmsService path; atomic failure and rollback use a bounded integration fixture.',
      ],
    };
  } finally {
    client.close();
  }
}
