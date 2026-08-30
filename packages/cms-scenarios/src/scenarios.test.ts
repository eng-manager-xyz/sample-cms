import { expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCliOptions, runCli } from './cli';
import { runDenseEligibleVehiclesProof } from './dense';
import { runGeneratedDeterminismProof } from './properties';
import {
  requireVerifiedServiceIntegration,
  runServiceIntegrationProof,
} from './service-integration';
import { DEFAULT_STORE_PAGE_COUNT, runStoreProof } from './store';
import { runStructuralReplacementProof } from './structural';

test('AUT-527 dense matrix is deterministic and rejects same-priority collisions', () => {
  const report = runDenseEligibleVehiclesProof();
  expect(report.pageCount).toBe(24);
  expect(report.variantCount).toBe(17);
  expect(report.variantMatchCount).toBe(100);
  expect(report.exactOverridePageCount).toBe(4);
  expect(report.exactOverridesEveryPlacement).toBe(true);
  expect(report.publicationHash).toBe(
    '39bf8224eee6acfaf8ed28cf2d1a7d1295683b6f2b279a530728f12feaf85f93'
  );
  expect(report.broadGolden.contentHash).toBe(
    'e8b9a054b29641387a197e3f84da7c08f99d852a15b73e6742167d42e9207b8a'
  );
  expect(report.exactGolden.contentHash).toBe(
    '20ee28dccad22f59fdc4ea09a564f33beed846789d4dd7fe32061daadf49d792'
  );
  expect(report.exactGolden.matchedVariantIds.at(-1)).toBe(
    'eligible-exact:eligible:en-US:CA:premium'
  );
  expect(report.conflict).toEqual({
    rejected: true,
    code: 'PRIORITY_CONFLICT',
    priority: 60,
    placementKey: 'legal-notice',
    variantIds: ['eligible-conflict:a', 'eligible-conflict:b'],
  });
  expect(report.publicationMetrics.savedPlacementCount).toBe(0);
  expect(report.publicationElapsedMilliseconds).toBeGreaterThan(0);
  expect(report.publicationSerializedBytes).toBeGreaterThan(0);
});

test('AUT-528 store composition, lookup plans, interpolation, and tag removal are measured', async () => {
  const report = await runStoreProof({ pageCount: 100, benchmarkSamples: 20 });
  expect(report.actualPageCount).toBe(102);
  expect(report.seed).toMatchObject({
    requestedPageCount: 100,
    insertedPageCount: 100,
    existingPageCountBeforeSeed: 0,
    reusedExistingSeed: false,
  });
  expect(report.seedReplay).toMatchObject({
    requestedPageCount: 100,
    insertedPageCount: 0,
    existingPageCountBeforeSeed: 100,
    reusedExistingSeed: true,
    seedIdentityHash: report.seed.seedIdentityHash,
    pageCountUnchanged: true,
    tagMembershipCountUnchanged: true,
  });
  expect(report.rawCounts).toEqual({
    templatePageCount: 102,
    scalePageCount: 100,
    slotValueCount: 408,
    tagMembershipCount: 134,
    publicationCount: 2,
    publishedPageDocumentCount: 104,
    manifestCount: 5,
    manifestItemCount: 20,
  });
  expect(report.membershipCounts).toEqual({
    chainStore: 51,
    fastFood: 21,
    mcdonalds: 6,
    burgerKing: 5,
    independent: 51,
    genericFastFoodChain: 10,
    chainNonFastFood: 30,
  });
  expect(report.canonicalLookupPlan.usesIndex).toBe(true);
  expect(report.tagLookupPlan.usesIndex).toBe(true);
  expect(report.independentTagRemoval.removedOnlyRequestedMembership).toBe(true);
  expect(report.namedBrandsSharedUnchangedBlockVersionIds).toEqual([
    'block-store-footer-v2-chain',
    'block-store-navigation-v1',
    'block-store-promo-v2-fast',
  ]);
  const mcdonalds = report.classGoldens.find((golden) => golden.classId === 'mcdonalds');
  expect(mcdonalds).toBeDefined();
  expect(mcdonalds?.contentHash).toBe(
    '85abed51409b0e585576d6cd3e5fc59119fe869e82bc77ebb17d2761c400b103'
  );
  expect(mcdonalds?.manifestHash).toBe(
    'f891dc773861c35dd60e18cb153d4fb36e8b9434eedef7c90c8a81225caaa733'
  );
  expect(mcdonalds?.renderedHero).toEqual({
    headline: "Buy now McDonald's Market — San Francisco",
  });
  expect(report.routeStatusOutcomes.every((outcome) => outcome.serviceVerified)).toBe(true);
  expect(report.completeFiveClassCoverage).toBe(true);
  expect(report.persistedClassGoldens.map((golden) => golden.classId)).toEqual([
    'mcdonalds',
    'independent',
    'generic-fast-food-chain',
    'chain-non-fast-food',
    'burger-king',
  ]);
  expect(report.persistedClassGoldens.at(-1)).toMatchObject({
    classId: 'burger-king',
    tags: ['brand=burger_king', 'category=fast_food', 'store_type=chain_store'],
    matchedVariantRevisionIds: [
      'revision-store-chain-1',
      'revision-store-fast-food-1',
      'revision-store-burger-king-1',
    ],
    blockVersionIds: [
      'block-store-navigation-v1',
      'block-store-hero-v3-bk',
      'block-store-promo-v2-fast',
      'block-store-footer-v2-chain',
    ],
  });
  expect(
    Object.fromEntries(
      report.selectorDemonstrations.map((demonstration) => [
        demonstration.variantId,
        {
          matchCount: demonstration.matchCount,
          affectedPlacementKeys: demonstration.affectedPlacementKeys,
          planUsesIndex: demonstration.planUsesIndex,
          overlapCount: demonstration.pairwiseOverlaps.length,
        },
      ])
    )
  ).toEqual({
    'variant-store-chain': {
      matchCount: 51,
      affectedPlacementKeys: ['footer'],
      planUsesIndex: true,
      overlapCount: 3,
    },
    'variant-store-fast-food': {
      matchCount: 21,
      affectedPlacementKeys: ['category-promo'],
      planUsesIndex: true,
      overlapCount: 3,
    },
    'variant-store-burger-king': {
      matchCount: 5,
      affectedPlacementKeys: ['primary-hero'],
      planUsesIndex: true,
      overlapCount: 3,
    },
    'variant-store-mcdonalds': {
      matchCount: 6,
      affectedPlacementKeys: ['primary-hero'],
      planUsesIndex: true,
      overlapCount: 3,
    },
  });
  expect(report.scalePublication).toMatchObject({
    engine: '@repo/cms-service',
    pageCount: 102,
    persistedDocumentCount: 102,
    manifestCount: 5,
    crossPublicationReusedManifestCount: 2,
    currentPointerActive: true,
    preview: { eligiblePageCount: 102, sampledPageCount: 50, truncated: true },
    idempotentRepublish: {
      publicationId: 'publication-store-scale-100',
      inputHashUnchanged: true,
      reusedCurrentPublication: true,
      reusedManifestCount: 5,
      documentRowsUnchanged: true,
    },
    pageToManifestDedup: {
      uniqueManifestCount: 5,
      pagesSharingManifest: 102,
      reusedPageCount: 97,
      deduplicatedPageRatio: 97 / 102,
      averagePagesPerManifest: 102 / 5,
      logicalExpandedPlacementCount: 408,
      uniqueStoredPlacementCount: 20,
      savedPlacementCount: 388,
      savedPlacementRatio: 388 / 408,
    },
  });
  expect(report.scalePublication.publicationElapsedMilliseconds).toBeGreaterThan(0);
  expect(report.scalePublication.publishedDocumentsPerSecond).toBeGreaterThan(0);
  expect(report.scalePublication.logicalExpandedRenderedDocumentBytes).toBeGreaterThan(
    report.scalePublication.estimatedManifestPageStorageBytes
  );
  expect(report.scalePublication.idempotentRepublish.logicalExpandedRenderedDocumentBytes).toBe(
    report.scalePublication.logicalExpandedRenderedDocumentBytes
  );
  expect(report.scalePublication.publicationStorageDeltaBytes).toBeGreaterThan(0);
  expect(report.scalePublication.publicationStorageBytesPerDocument).toBeGreaterThan(0);
  expect(report.scalePublication.serveReadPath).toMatchObject({
    materializationMode: 'manifest',
    sqlQueryCountPerRequest: 2,
    selectorSqlExecutionsPerRequest: 0,
    celEvaluationsPerRequest: 0,
    sampleCount: 20,
  });
  expect(report.scalePublication.serveReadPath.p50Milliseconds).toBeGreaterThan(0);
  expect(report.scalePublication.serveReadPath.p95Milliseconds).toBeGreaterThan(0);
  expect(report.scalePublication.serveReadPath.sqlStatements).toHaveLength(2);
  expect(report.interpolationManifestSharing).toMatchObject({
    firstPageId: 'page-store-1001',
    secondPageId: 'page-store-scale-0',
    sameStructuralManifest: true,
    renderedOutputDiffers: true,
    documentHashesDiffer: true,
  });
  expect(report.mutationPropagation).toEqual({
    fastFoodPromoUpdateReachedBothBrands: true,
    fastFoodPromoUpdateLeftBrandHeroesUnchanged: true,
    mcdonaldsHeroEditIsolatedFromBurgerKingAndDefault: true,
  });
  expect(report.publicServeReadPath).toMatchObject({
    materializationMode: 'expanded',
    sqlQueryCountPerRequest: 1,
    selectorSqlExecutionsPerRequest: 0,
    celEvaluationsPerRequest: 0,
    sampleCount: 100,
  });
  expect(report.scalePublication.pageToManifestDedup.savedCanonicalStructureBytes).toBeGreaterThan(
    0
  );
  expect(report.representativePublication.metrics.uniqueManifestCount).toBe(5);
  expect(report.representativePublication.metrics.savedManifestBytes).toBe(0);
});

test('AUT-529 preserves stable placement identity and 91.67% pointer inheritance', () => {
  const report = runStructuralReplacementProof();
  expect(report.defaultPlacementCount).toBe(24);
  expect(report.effectivePlacementCount).toBe(23);
  expect(report.sparseOperationCount).toBe(2);
  expect(report.inheritedPlacementCount).toBe(22);
  expect(report.inheritanceRatio).toBe(22 / 24);
  expect(report.meetsNinetyPercentInheritance).toBe(true);
  expect(report.stableHeroPlacementPreserved).toBe(true);
  expect(report.heroTypeChangedTo).toBe('hero_alt');
  expect(report.revertEvidence).toEqual({
    restoredDefaultHero: true,
    restoredHeroBlockVersionId: 'structural-block:primary-hero:v1',
    promoRemainsTombstoned: true,
  });
  expect(report.currentPublishedHash).toBe(
    '3ca91d8618a91ce98424030621d9861ed29fd41b6405358374fd5eca14c5d22d'
  );
  expect(report.draftHash).toBe('553e36f0efc641fdeea8ebbb1522688b6ca9f500cff1f85b6ee87d6154bfba88');
  expect(report.publicationHash).toBe(
    '691e09b1c9e6f23644144c003e752e827a76998f463d567d6467ec5a45bf5021'
  );
  expect(report.publicationMetrics).toMatchObject({
    pageCount: 2,
    uniqueManifestCount: 2,
    expandedPlacementCount: 47,
    storedPlacementCount: 47,
  });
  expect(report.publicationElapsedMilliseconds).toBeGreaterThan(0);
  expect(report.publicationSerializedBytes).toBeGreaterThan(0);
});

test('AUT-530 generated cases are permutation-stable and reproducible', () => {
  const first = runGeneratedDeterminismProof({ caseCount: 100 });
  const second = runGeneratedDeterminismProof({ caseCount: 100 });
  expect(second).toEqual(first);
  expect(first.permutationComparisons).toBe(100);
  expect(first.tombstoneCases).toBe(26);
  expect(first.assertions).toEqual({
    orderIndependent: true,
    byteStableHashes: true,
    noDuplicatePlacements: true,
    tombstonesAbsent: true,
    oneContentAndOrderProvenancePerWinner: true,
  });
  expect(first.domainPublicationFailureEvidence).toEqual({
    rejectedDuplicateCanonicalUrl: true,
    errorCode: 'DUPLICATE_CANONICAL_URL',
    priorPublicationHashUnchanged: true,
  });
});

test('persisted service proof covers dense conflict atomicity, structural rollback, and route status', async () => {
  const evidence = await runServiceIntegrationProof();
  requireVerifiedServiceIntegration(evidence);
  expect(evidence.densePersistence).toMatchObject({
    pageCount: 24,
    publicationPageCount: 24,
    exactOverridesEveryPlacement: true,
    selectorPlanUsesIndexedSlotLookup: true,
    conflictRejected: true,
    conflictCode: 'PRIORITY_CONFLICT',
    failedPublicationLeftPriorPointerActive: true,
    failedPublicationLeftNoRows: true,
    publicationEvidence: {
      pageCount: 24,
      manifestCount: 24,
      persistedPublicationCount: 1,
      persistedPageDocumentCount: 24,
      persistedManifestCount: 24,
      persistedManifestItemCount: 168,
    },
  });
  expect(evidence.densePersistence.manifestItemsWithOperationProvenance).toBe(168);
  expect(evidence.densePersistence.publicationEvidence.seedElapsedMilliseconds).toBeGreaterThan(0);
  expect(evidence.densePersistence.publicationEvidence.durationMilliseconds).toBeGreaterThan(0);
  expect(evidence.densePersistence.publicationEvidence.rowsWritten).toBeGreaterThan(0);
  expect(evidence.densePersistence.publicationEvidence.estimatedStorageBytes).toBeGreaterThan(0);
  expect(
    evidence.densePersistence.publicationEvidence.logicalExpandedRenderedDocumentBytes
  ).toBeGreaterThan(0);
  expect(
    evidence.densePersistence.publicationEvidence.allocatedBytesAfterPublication
  ).toBeGreaterThanOrEqual(
    evidence.densePersistence.publicationEvidence.allocatedBytesBeforePublication
  );
  expect(evidence.structuralPersistence).toMatchObject({
    defaultPlacementCount: 24,
    effectivePlacementCount: 23,
    inheritedPlacementCount: 22,
    meetsNinetyPercentInheritance: true,
    stableHeroPlacementPreserved: true,
    heroBlockType: 'hero_alt',
    promoTombstoned: true,
    structuralContractEvidence: {
      heroAltRejectedHeroPayload: true,
      heroAndHeroAltSchemasDiffer: true,
      heroAndHeroAltRenderersDiffer: true,
      unmatchedPageHeroBlockType: 'hero',
      createdVariantBlockVersionCount: 1,
      activeSparseOperationCount: 2,
    },
    rollbackRestoredBaselineHash: true,
    publicationEvidence: {
      baseline: { pageCount: 2, manifestCount: 1 },
      changed: { pageCount: 2, manifestCount: 2 },
      persistedPublicationCount: 2,
      persistedPageDocumentCount: 4,
      persistedManifestCount: 2,
      persistedManifestItemCount: 47,
    },
  });
  expect(
    evidence.structuralPersistence.publicationEvidence.baseline.durationMilliseconds
  ).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.seedElapsedMilliseconds
  ).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.changed.durationMilliseconds
  ).toBeGreaterThan(0);
  expect(evidence.structuralPersistence.publicationEvidence.baseline.rowsWritten).toBeGreaterThan(
    0
  );
  expect(evidence.structuralPersistence.publicationEvidence.changed.rowsWritten).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.baseline.estimatedStorageBytes
  ).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.baseline.logicalExpandedRenderedDocumentBytes
  ).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.changed.estimatedStorageBytes
  ).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.changed.logicalExpandedRenderedDocumentBytes
  ).toBeGreaterThan(0);
  expect(
    evidence.structuralPersistence.publicationEvidence.allocatedBytesAfterPublication
  ).toBeGreaterThanOrEqual(
    evidence.structuralPersistence.publicationEvidence.allocatedBytesBeforePublication
  );
  expect(evidence.storeService.routeStatusOutcomes).toEqual([
    { routeStatus: 'live', status: 200, reason: 'served' },
    { routeStatus: 'not_live', status: 404, reason: 'not_live' },
    { routeStatus: 'archived', status: 404, reason: 'archived' },
  ]);
  expect(evidence.storeService.publicationFailureLeftNoRows).toBe(true);
  expect(evidence.storeService.servePlanUsesCanonicalIndex).toBe(true);
  expect(evidence.storeService.serveReadPath).toMatchObject({
    materializationMode: 'expanded',
    sqlQueryCountPerRequest: 1,
    selectorSqlExecutionsPerRequest: 0,
    celEvaluationsPerRequest: 0,
    sampleCount: 100,
  });
  expect(evidence.storeService.serveReadPath.p50Milliseconds).toBeGreaterThan(0);
  expect(evidence.storeService.serveReadPath.p95Milliseconds).toBeGreaterThan(0);
  expect(evidence.storeService.serveReadPath.sqlStatements).toHaveLength(1);
  expect(evidence.documentHashes).toEqual([
    '173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d',
    'ccab79f3fc4eb0aa0a1b9ac750d341254a126971df9553e5926928859d8f4b66',
    '173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d',
  ]);
}, 30_000);

test('CLI keeps the explicit scale default and writes machine-readable integration evidence', async () => {
  const parsed = parseCliOptions(['seed', '--output', '/tmp/scenario-seed.json']);
  expect(parsed.pageCount).toBe(DEFAULT_STORE_PAGE_COUNT);
  const directory = await mkdtemp(join(tmpdir(), 'cms-scenarios-'));
  const outputPath = join(directory, 'integration.json');
  await runCli(['integration', '--output', outputPath]);
  const report: unknown = await Bun.file(outputPath).json();
  expect(report).toMatchObject({
    command: 'integration',
    evidence: {
      status: 'verified',
      storeService: {
        serveReadPath: {
          selectorSqlExecutionsPerRequest: 0,
          celEvaluationsPerRequest: 0,
        },
      },
    },
  });
}, 30_000);
