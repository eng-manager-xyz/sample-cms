import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

type JsonRecord = Record<string, unknown>;

const errors: string[] = [];
const currentBunLockSha256 = createHash('sha256').update(readFileSync('bun.lock')).digest('hex');
const currentPackageManagerPin = JSON.parse(readFileSync('package.json', 'utf8')).packageManager;

function object(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return {};
  }
  return value as JsonRecord;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return [];
  }
  return value;
}

function path(root: unknown, dottedPath: string): unknown {
  return dottedPath
    .split('.')
    .reduce<unknown>((value, key) => object(value, dottedPath)[key], root);
}

function assert(condition: unknown, message: string): void {
  if (!condition) errors.push(message);
}

function number(root: unknown, dottedPath: string): number {
  const value = path(root, dottedPath);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${dottedPath} must be a finite number`);
    return Number.NaN;
  }
  return value;
}

function verifyEnvelope(envelope: JsonRecord, label: string): void {
  assert(envelope.evidenceVersion === 1, `${label}: the environment evidence envelope is required`);
  assert(
    /^[0-9a-f]{40}$/.test(String(path(envelope, 'run.gitCommit'))),
    `${label}: a full Git commit is required`
  );
  assert(
    /^[0-9a-f]{64}$/.test(String(path(envelope, 'run.bunLockSha256'))),
    `${label}: a bun.lock SHA-256 is required`
  );
  assert(
    path(envelope, 'run.workingTreeBeforeRun') === '',
    `${label}: evidence must be generated from a clean pre-run working tree`
  );
  assert(
    path(envelope, 'run.bunLockSha256') === currentBunLockSha256,
    `${label}: evidence bun.lock digest must match the checked-in lockfile`
  );
  assert(
    path(envelope, 'run.packageManagerPin') === currentPackageManagerPin,
    `${label}: evidence package-manager pin must match package.json`
  );
  assert(
    number(envelope, 'run.databaseFileBytes') > 0,
    `${label}: database bytes must be positive`
  );
  assert(
    number(envelope, 'run.elapsedMilliseconds') > 0,
    `${label}: elapsed time must be positive`
  );
  assert(
    number(envelope, 'run.host.physicalMemoryBytes') > 0,
    `${label}: host memory must be recorded`
  );
  assert(
    number(envelope, 'run.process.maxRssBytes') > 0,
    `${label}: process max RSS must be recorded`
  );
}

function invocationFlag(envelope: JsonRecord, label: string, flag: string): string {
  const invocation = array(path(envelope, 'run.invocation'), `${label}: invocation`).map(String);
  const index = invocation.indexOf(flag);
  if (index < 0 || index === invocation.length - 1) {
    errors.push(`${label}: invocation must include ${flag}`);
    return '';
  }
  return invocation[index + 1] ?? '';
}

function verifyInvocation(
  envelope: JsonRecord,
  label: string,
  expected: Readonly<Record<string, string>>
): void {
  const invocation = array(path(envelope, 'run.invocation'), `${label}: invocation`).map(String);
  assert(
    invocation.includes('scripts/run-scenario-evidence.ts'),
    `${label}: evidence must use the repository evidence runner`
  );
  for (const [flag, value] of Object.entries(expected)) {
    assert(
      invocationFlag(envelope, label, flag) === value,
      `${label}: invocation ${flag} must equal ${value}`
    );
  }
  assert(
    invocationFlag(envelope, label, '--database') === path(envelope, 'run.databasePath'),
    `${label}: invocation database must match the recorded database path`
  );
}

function scenario(value: unknown): JsonRecord {
  const envelope = object(value, 'evidence');
  return object(envelope.scenarioReport ?? envelope, 'scenario report');
}

async function readJson(filePath: string): Promise<unknown> {
  if (!existsSync(filePath)) {
    errors.push(`missing evidence file: ${filePath}`);
    return {};
  }
  try {
    return await Bun.file(filePath).json();
  } catch (error) {
    errors.push(
      `invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return {};
  }
}

function verifyCommon(report: JsonRecord, label: string): void {
  assert(report.reportVersion === 1, `${label}: reportVersion must equal 1`);
  assert(report.productionSloClaimed === false, `${label}: productionSloClaimed must be false`);
  const environment = object(report.environment, `${label}.environment`);
  assert(typeof environment.bunVersion === 'string', `${label}: Bun version is required`);
  assert(typeof environment.sqliteVersion === 'string', `${label}: SQLite version is required`);
}

function verifyProgress(
  envelope: JsonRecord,
  label: string,
  expectedSeedTotal: number,
  expectedPublicationTotal: number
): void {
  const checkpoints = array(path(envelope, 'run.progressCheckpoints'), `${label}: progress`);
  for (const [phase, expectedTotal] of [
    ['seed', expectedSeedTotal],
    ['compile', expectedPublicationTotal],
    ['write', expectedPublicationTotal],
    ['republish_compile', expectedPublicationTotal],
  ] as const) {
    const final = checkpoints
      .map((value, index) => object(value, `${label}: progress[${index}]`))
      .filter((checkpoint) => checkpoint.phase === phase)
      .at(-1);
    assert(
      final?.completed === expectedTotal && final.total === expectedTotal,
      `${label}: ${phase} progress must reach ${expectedTotal}/${expectedTotal}`
    );
  }
}

function verifyStoreSelectorDemonstrations(
  report: JsonRecord,
  label: string,
  expectedMatches: Readonly<Record<string, number>>
): void {
  const expected = {
    'variant-store-chain': {
      selector: "store_type = 'chain_store'",
      priority: 10,
      placement: 'footer',
    },
    'variant-store-fast-food': {
      selector: "category = 'fast_food'",
      priority: 20,
      placement: 'category-promo',
    },
    'variant-store-mcdonalds': {
      selector: "brand = 'mcdonalds'",
      priority: 30,
      placement: 'primary-hero',
    },
    'variant-store-burger-king': {
      selector: "brand = 'burger_king'",
      priority: 30,
      placement: 'primary-hero',
    },
  } as const;
  const demonstrations = array(
    path(report, 'store.selectorDemonstrations'),
    `${label}: selector demonstrations`
  );
  assert(demonstrations.length === 4, `${label}: exactly four Store selectors are required`);
  for (const [index, value] of demonstrations.entries()) {
    const demonstration = object(value, `${label}: selector demonstration ${index}`);
    const variantId = String(demonstration.variantId);
    const contract = expected[variantId as keyof typeof expected];
    assert(contract !== undefined, `${label}: unexpected Store selector ${variantId}`);
    if (!contract) continue;
    const matchCount = expectedMatches[variantId];
    assert(
      typeof matchCount === 'number' && demonstration.matchCount === matchCount,
      `${label}: ${variantId} match count must equal ${String(matchCount)}`
    );
    assert(demonstration.selector === contract.selector, `${label}: ${variantId} SQL drifted`);
    assert(demonstration.priority === contract.priority, `${label}: ${variantId} priority drifted`);
    assert(
      demonstration.planUsesIndex === true,
      `${label}: ${variantId} preview must use an index`
    );
    assert(
      number(demonstration, 'previewElapsedMilliseconds') > 0,
      `${label}: ${variantId} preview duration must be measured`
    );
    const placements = array(
      demonstration.affectedPlacementKeys,
      `${label}: ${variantId} placements`
    );
    assert(
      placements.length === 1 && placements[0] === contract.placement,
      `${label}: ${variantId} affected placement must be ${contract.placement}`
    );
    assert(
      demonstration.estimatedAffectedPlacementRows === matchCount,
      `${label}: ${variantId} publication impact must equal its one-placement match count`
    );
    assert(
      array(demonstration.samplePages, `${label}: ${variantId} samples`).length > 0,
      `${label}: ${variantId} must include persisted sample pages`
    );
    assert(
      array(demonstration.planSteps, `${label}: ${variantId} plan`).length > 0,
      `${label}: ${variantId} must include an inspectable query plan`
    );
    assert(
      array(demonstration.pairwiseOverlaps, `${label}: ${variantId} overlaps`).length === 3,
      `${label}: ${variantId} must report all three pairwise overlaps`
    );
    assert(
      demonstration.sampleTruncated === true,
      `${label}: ${variantId} preview must record sample truncation`
    );
    assert(
      typeof demonstration.variantRevisionId === 'string' &&
        demonstration.variantRevisionId.length > 0,
      `${label}: ${variantId} revision identity is required`
    );
    for (const [overlapIndex, overlapValue] of array(
      demonstration.pairwiseOverlaps,
      `${label}: ${variantId} overlaps`
    ).entries()) {
      const overlap = object(overlapValue, `${label}: ${variantId} overlap ${overlapIndex}`);
      const otherId = String(overlap.variantId);
      const otherMatchCount = expectedMatches[otherId];
      let expectedOverlap = 0;
      if (variantId.includes('chain')) expectedOverlap = otherMatchCount ?? 0;
      else if (otherId.includes('chain')) expectedOverlap = matchCount ?? 0;
      else if (variantId.includes('fast-food')) expectedOverlap = otherMatchCount ?? 0;
      else if (otherId.includes('fast-food')) expectedOverlap = matchCount ?? 0;
      assert(
        typeof otherMatchCount === 'number' && overlap.matchCount === expectedOverlap,
        `${label}: ${variantId}/${otherId} overlap must equal ${expectedOverlap}`
      );
      const conflictingPlacements = array(
        overlap.conflictingPlacementKeys,
        `${label}: ${variantId}/${otherId} conflicting placements`
      );
      const namedBrandPair =
        (variantId.includes('mcdonalds') && otherId.includes('burger-king')) ||
        (variantId.includes('burger-king') && otherId.includes('mcdonalds'));
      assert(
        namedBrandPair
          ? conflictingPlacements.length === 1 && conflictingPlacements[0] === 'primary-hero'
          : conflictingPlacements.length === 0,
        `${label}: ${variantId}/${otherId} placement-overlap diagnostics drifted`
      );
    }
  }
}

function verifyBounded(report: JsonRecord, envelope: JsonRecord): void {
  verifyEnvelope(envelope, 'bounded');
  verifyInvocation(envelope, 'bounded', {
    '--pages': '1000',
    '--samples': '100',
    '--cases': '200',
    '--seed': '1592639710',
  });
  verifyCommon(report, 'bounded');
  verifyProgress(envelope, 'bounded', 1_000, 1_002);
  assert(
    number(report, 'denseEligibleVehicles.pageCount') === 24,
    'bounded: dense page count must be 24'
  );
  assert(
    path(report, 'denseEligibleVehicles.exactOverridesEveryPlacement') === true,
    'bounded: exact dense override must replace every placement'
  );
  assert(
    path(report, 'denseEligibleVehicles.conflict.rejected') === true,
    'bounded: dense conflict must be rejected'
  );
  assert(
    path(report, 'denseEligibleVehicles.conflict.code') === 'PRIORITY_CONFLICT',
    'bounded: dense conflict code must be PRIORITY_CONFLICT'
  );
  assert(
    number(report, 'denseEligibleVehicles.variantCount') === 17,
    'bounded: dense variant count must be 17'
  );
  assert(
    number(report, 'denseEligibleVehicles.variantMatchCount') === 100,
    'bounded: dense match count must be 100'
  );
  assert(
    number(report, 'denseEligibleVehicles.exactVariantCount') === 4 &&
      number(report, 'denseEligibleVehicles.exactOverridePageCount') === 4,
    'bounded: dense exact-intersection counts must be 4/4'
  );
  assert(
    number(report, 'denseEligibleVehicles.publicationMetrics.pageCount') === 24,
    'bounded: dense publication must contain 24 pages'
  );
  assert(
    number(report, 'denseEligibleVehicles.publicationMetrics.uniqueManifestCount') === 24,
    'bounded: dense publication must contain 24 unique manifests'
  );
  assert(
    number(report, 'denseEligibleVehicles.publicationMetrics.expandedPlacementCount') === 168 &&
      number(report, 'denseEligibleVehicles.publicationMetrics.storedPlacementCount') === 168,
    'bounded: dense expanded/stored placement counts must be 168/168'
  );
  assert(
    number(report, 'denseEligibleVehicles.publicationMetrics.expandedManifestBytes') === 22_024 &&
      number(report, 'denseEligibleVehicles.publicationMetrics.storedManifestBytes') === 22_024,
    'bounded: dense expanded/stored canonical bytes must be 22,024/22,024'
  );
  assert(
    number(report, 'denseEligibleVehicles.publicationElapsedMilliseconds') > 0,
    'bounded: dense compile duration must be measured'
  );
  assert(
    number(report, 'denseEligibleVehicles.publicationSerializedBytes') > 0,
    'bounded: dense serialized publication bytes must be measured'
  );
  assert(
    number(report, 'structuralReplacement.defaultPlacementCount') === 24 &&
      number(report, 'structuralReplacement.effectivePlacementCount') === 23 &&
      number(report, 'structuralReplacement.inheritedPlacementCount') === 22,
    'bounded: structural default/effective/inherited counts must be 24/23/22'
  );
  assert(
    number(report, 'structuralReplacement.inheritanceRatio') >= 0.9,
    'bounded: structural inheritance must be at least 90%'
  );
  assert(
    path(report, 'structuralReplacement.stableHeroPlacementPreserved') === true,
    'bounded: hero placement identity must be stable'
  );
  assert(
    path(report, 'structuralReplacement.heroTypeChangedTo') === 'hero_alt',
    'bounded: structural replacement must use hero_alt'
  );
  assert(
    number(report, 'structuralReplacement.publicationMetrics.pageCount') === 2 &&
      number(report, 'structuralReplacement.publicationMetrics.uniqueManifestCount') === 2 &&
      number(report, 'structuralReplacement.publicationMetrics.storedPlacementCount') === 47,
    'bounded: structural domain publication rows must be 2 pages/2 manifests/47 items'
  );
  assert(
    number(report, 'structuralReplacement.publicationElapsedMilliseconds') > 0 &&
      number(report, 'structuralReplacement.publicationSerializedBytes') > 0,
    'bounded: structural domain duration and serialized bytes must be measured'
  );
  assert(
    number(report, 'generatedDeterminism.caseCount') >= 200,
    'bounded: at least 200 generated cases are required'
  );
  for (const assertion of [
    'orderIndependent',
    'byteStableHashes',
    'noDuplicatePlacements',
    'tombstonesAbsent',
    'oneContentAndOrderProvenancePerWinner',
  ]) {
    assert(
      path(report, `generatedDeterminism.assertions.${assertion}`) === true,
      `bounded: generated assertion ${assertion} must pass`
    );
  }
  assert(
    path(report, 'serviceIntegration.status') === 'verified',
    'bounded: service integration must be verified'
  );
  assert(
    path(report, 'serviceIntegration.publicationFailureLeftPriorPointerActive') === true,
    'bounded: failed publication must preserve the prior pointer'
  );
  assert(
    path(report, 'serviceIntegration.rollbackRestoredPriorHash') === true,
    'bounded: rollback must restore the prior hash'
  );
  assert(
    path(report, 'serviceIntegration.routeStatusOutcomesVerified') === true,
    'bounded: route outcomes must be verified'
  );
  assert(
    path(report, 'serviceIntegration.densePersistence.failedPublicationLeftNoRows') === true,
    'bounded: dense conflict must leave no publication rows'
  );
  assert(
    path(report, 'serviceIntegration.densePersistence.selectorPlanUsesIndexedSlotLookup') === true,
    'bounded: dense selector preview must use the slot index'
  );
  assert(
    number(report, 'serviceIntegration.densePersistence.manifestItemsWithOperationProvenance') ===
      168,
    'bounded: all 168 dense placements must retain exact operation provenance'
  );
  assert(
    number(
      report,
      'serviceIntegration.densePersistence.publicationEvidence.seedElapsedMilliseconds'
    ) > 0 &&
      number(
        report,
        'serviceIntegration.densePersistence.publicationEvidence.durationMilliseconds'
      ) > 0,
    'bounded: dense persisted seed and publication durations must be measured'
  );
  assert(
    number(report, 'serviceIntegration.densePersistence.publicationEvidence.pageCount') === 24 &&
      number(report, 'serviceIntegration.densePersistence.publicationEvidence.manifestCount') ===
        24 &&
      number(
        report,
        'serviceIntegration.densePersistence.publicationEvidence.persistedPageDocumentCount'
      ) === 24 &&
      number(
        report,
        'serviceIntegration.densePersistence.publicationEvidence.persistedManifestItemCount'
      ) === 168,
    'bounded: dense persisted rows must include 24 documents/24 manifests/168 items'
  );
  assert(
    number(
      report,
      'serviceIntegration.densePersistence.publicationEvidence.estimatedStorageBytes'
    ) > 0 &&
      number(
        report,
        'serviceIntegration.densePersistence.publicationEvidence.logicalExpandedRenderedDocumentBytes'
      ) > 0 &&
      number(report, 'serviceIntegration.densePersistence.publicationEvidence.storageDeltaBytes') >
        0,
    'bounded: dense expanded payload, estimated storage, and allocated storage must be measured'
  );
  assert(
    path(report, 'serviceIntegration.structuralPersistence.rollbackRestoredBaselineHash') === true,
    'bounded: structural rollback must restore its baseline hash'
  );
  assert(
    number(
      report,
      'serviceIntegration.structuralPersistence.publicationEvidence.persistedPublicationCount'
    ) === 2 &&
      number(
        report,
        'serviceIntegration.structuralPersistence.publicationEvidence.persistedPageDocumentCount'
      ) === 4 &&
      number(
        report,
        'serviceIntegration.structuralPersistence.publicationEvidence.persistedManifestCount'
      ) === 2 &&
      number(
        report,
        'serviceIntegration.structuralPersistence.publicationEvidence.persistedManifestItemCount'
      ) === 47,
    'bounded: persisted structural rows must be 2 publications/4 documents/2 manifests/47 items'
  );
  assert(
    number(
      report,
      'serviceIntegration.structuralPersistence.publicationEvidence.storageDeltaBytes'
    ) > 0,
    'bounded: persisted structural publication storage delta must be measured'
  );
  assert(
    number(
      report,
      'serviceIntegration.structuralPersistence.publicationEvidence.seedElapsedMilliseconds'
    ) > 0,
    'bounded: persisted structural seed duration must be measured'
  );
  assert(
    number(
      report,
      'serviceIntegration.structuralPersistence.publicationEvidence.baseline.logicalExpandedRenderedDocumentBytes'
    ) > 0 &&
      number(
        report,
        'serviceIntegration.structuralPersistence.publicationEvidence.changed.logicalExpandedRenderedDocumentBytes'
      ) > 0,
    'bounded: both structural publications must measure fully expanded rendered payload bytes'
  );
  for (const contract of [
    'heroAltRejectedHeroPayload',
    'heroAndHeroAltSchemasDiffer',
    'heroAndHeroAltRenderersDiffer',
  ]) {
    assert(
      path(
        report,
        `serviceIntegration.structuralPersistence.structuralContractEvidence.${contract}`
      ) === true,
      `bounded: structural contract ${contract} must pass`
    );
  }
  assert(
    path(
      report,
      'serviceIntegration.structuralPersistence.structuralContractEvidence.unmatchedPageHeroBlockType'
    ) === 'hero' &&
      number(
        report,
        'serviceIntegration.structuralPersistence.structuralContractEvidence.createdVariantBlockVersionCount'
      ) === 1 &&
      number(
        report,
        'serviceIntegration.structuralPersistence.structuralContractEvidence.activeSparseOperationCount'
      ) === 2,
    'bounded: structural variant must create one block version/two sparse operations and leave unmatched hero intact'
  );
  assert(
    number(report, 'store.requestedScalePageCount') === 1_000,
    'bounded: Store proof must request 1,000 scale pages'
  );
  assert(
    number(report, 'store.seed.insertedPageCount') === 1_000,
    'bounded: Store proof must insert 1,000 scale pages'
  );
  assert(
    number(report, 'store.seed.elapsedMilliseconds') > 0,
    'bounded: Store seed duration must be measured'
  );
  assert(
    path(report, 'store.seed.reusedExistingSeed') === false &&
      /^[0-9a-f]{64}$/.test(String(path(report, 'store.seed.seedIdentityHash'))) &&
      path(report, 'store.seedReplay.reusedExistingSeed') === true &&
      number(report, 'store.seedReplay.insertedPageCount') === 0 &&
      path(report, 'store.seedReplay.seedIdentityHash') ===
        path(report, 'store.seed.seedIdentityHash') &&
      path(report, 'store.seedReplay.pageCountUnchanged') === true &&
      path(report, 'store.seedReplay.tagMembershipCountUnchanged') === true &&
      number(report, 'store.seedReplay.elapsedMilliseconds') > 0,
    'bounded: Store scale seed replay must be measured, identity-stable, and insert zero rows'
  );
  assert(number(report, 'store.actualPageCount') === 1_002, 'bounded: Store total must be 1,002');
  assert(
    number(report, 'store.rawCounts.templatePageCount') === 1_002 &&
      number(report, 'store.rawCounts.scalePageCount') === 1_000 &&
      number(report, 'store.rawCounts.slotValueCount') === 4_008 &&
      number(report, 'store.rawCounts.tagMembershipCount') === 1_304 &&
      number(report, 'store.rawCounts.publicationCount') === 2 &&
      number(report, 'store.rawCounts.publishedPageDocumentCount') === 1_004 &&
      number(report, 'store.rawCounts.manifestCount') === 5 &&
      number(report, 'store.rawCounts.manifestItemCount') === 20,
    'bounded: Store raw page/slot/tag/publication/document/manifest counts must match the deterministic fixture'
  );
  assert(
    number(report, 'store.databaseHealth.tableCounts.page_slot_values') === 4_008,
    'bounded: Store must persist 4,008 scalar slot rows'
  );
  assert(
    path(report, 'store.databaseHealth.healthy') === true,
    'bounded: Store database must be healthy'
  );
  assert(
    [7, 8].includes(number(report, 'store.databaseHealth.schemaVersion')),
    'bounded: Store evidence must use supported schema version 7 or 8'
  );
  assert(
    path(report, 'store.completeFiveClassCoverage') === true,
    'bounded: Store proof must cover five independent classes'
  );
  verifyStoreSelectorDemonstrations(report, 'bounded', {
    'variant-store-chain': 501,
    'variant-store-fast-food': 201,
    'variant-store-mcdonalds': 51,
    'variant-store-burger-king': 50,
  });
  for (const [membership, expected] of Object.entries({
    chainStore: 501,
    fastFood: 201,
    independent: 501,
    chainNonFastFood: 300,
    genericFastFoodChain: 100,
    mcdonalds: 51,
    burgerKing: 50,
  })) {
    assert(
      number(report, `store.membershipCounts.${membership}`) === expected,
      `bounded: ${membership} class must contain ${expected} rows`
    );
  }
  assert(
    path(report, 'store.interpolationManifestSharing.sameStructuralManifest') === true &&
      path(report, 'store.interpolationManifestSharing.renderedOutputDiffers') === true &&
      path(report, 'store.interpolationManifestSharing.documentHashesDiffer') === true,
    "bounded: same-manifest McDonald's pages must render different interpolated output"
  );
  for (const assertion of [
    'fastFoodPromoUpdateReachedBothBrands',
    'fastFoodPromoUpdateLeftBrandHeroesUnchanged',
    'mcdonaldsHeroEditIsolatedFromBurgerKingAndDefault',
  ]) {
    assert(
      path(report, `store.mutationPropagation.${assertion}`) === true,
      `bounded: Store mutation assertion ${assertion} must pass`
    );
  }
  assert(
    path(report, 'store.canonicalLookupPlan.usesIndex') === true,
    'bounded: canonical lookup must use an index'
  );
  assert(
    path(report, 'store.tagLookupPlan.usesIndex') === true,
    'bounded: tag lookup must use an index'
  );
  const lookupP50 = number(report, 'store.benchmark.canonicalLookupP50Milliseconds');
  const lookupP95 = number(report, 'store.benchmark.canonicalLookupP95Milliseconds');
  assert(
    lookupP50 > 0 && lookupP95 >= lookupP50,
    'bounded: canonical lookup p50/p95 must be measured and ordered'
  );
  assert(
    number(report, 'store.benchmark.tagMembershipCountMilliseconds') > 0,
    'bounded: tag membership count duration must be measured'
  );
  assert(
    path(report, 'store.scalePublication.currentPointerActive') === true,
    'bounded: Store publication pointer must be active'
  );
  assert(
    path(report, 'store.scalePublication.preview.usesIndex') === true &&
      number(report, 'store.scalePublication.preview.elapsedMilliseconds') > 0,
    'bounded: Store preview must use an index and record duration'
  );
  assert(
    path(report, 'store.scalePublication.idempotentRepublish.reusedCurrentPublication') === true,
    'bounded: Store republish must be idempotent'
  );
  assert(
    path(report, 'store.scalePublication.idempotentRepublish.documentRowsUnchanged') === true,
    'bounded: Store republish must not add document rows'
  );
  assert(
    number(report, 'store.scalePublication.persistedDocumentCount') === 1_002 &&
      number(report, 'store.scalePublication.pageToManifestDedup.uniqueManifestCount') === 5 &&
      number(report, 'store.scalePublication.pageToManifestDedup.reusedPageCount') === 997,
    'bounded: Store materialization must be 1,002 documents/5 manifests/997 reused pages'
  );
  assert(
    number(report, 'store.scalePublication.pageToManifestDedup.logicalExpandedPlacementCount') ===
      4_008 &&
      number(report, 'store.scalePublication.pageToManifestDedup.uniqueStoredPlacementCount') ===
        20,
    'bounded: Store expanded/stored placement counts must be 4,008/20'
  );
  assert(
    number(
      report,
      'store.scalePublication.pageToManifestDedup.logicalExpandedCanonicalStructureBytes'
    ) === 830_021 &&
      number(report, 'store.scalePublication.pageToManifestDedup.uniqueCanonicalStructureBytes') ===
        4_214,
    'bounded: Store expanded/stored canonical bytes must be 830,021/4,214'
  );
  assert(
    number(report, 'store.scalePublication.publicationStorageDeltaBytes') > 0,
    'bounded: Store publication storage delta must be measured'
  );
  const boundedExpandedPayloadBytes = number(
    report,
    'store.scalePublication.logicalExpandedRenderedDocumentBytes'
  );
  const boundedEstimatedManifestPageBytes = number(
    report,
    'store.scalePublication.estimatedManifestPageStorageBytes'
  );
  assert(
    boundedExpandedPayloadBytes > boundedEstimatedManifestPageBytes &&
      boundedExpandedPayloadBytes ===
        number(
          report,
          'store.scalePublication.idempotentRepublish.logicalExpandedRenderedDocumentBytes'
        ),
    'bounded: fully expanded rendered payload bytes must exceed the manifest-page estimate and reproduce on republish'
  );
  assert(
    number(report, 'store.scalePublication.publicationElapsedMilliseconds') > 0 &&
      number(report, 'store.scalePublication.idempotentRepublish.elapsedMilliseconds') > 0,
    'bounded: Store publication and republish durations must be measured'
  );
  assert(
    path(report, 'store.scalePublication.serveReadPath.materializationMode') === 'manifest' &&
      number(report, 'store.scalePublication.serveReadPath.sqlQueryCountPerRequest') === 2 &&
      number(report, 'store.scalePublication.serveReadPath.selectorSqlExecutionsPerRequest') ===
        0 &&
      number(report, 'store.scalePublication.serveReadPath.celEvaluationsPerRequest') === 0,
    'bounded: materialized Store serve must use two fixed queries, zero selectors, and zero CEL evaluations'
  );
  const manifestServeP50 = number(report, 'store.scalePublication.serveReadPath.p50Milliseconds');
  const manifestServeP95 = number(report, 'store.scalePublication.serveReadPath.p95Milliseconds');
  assert(
    manifestServeP50 > 0 && manifestServeP95 >= manifestServeP50,
    'bounded: materialized Store serve p50/p95 must be measured and ordered'
  );
  assert(
    path(report, 'store.publicServeReadPath.materializationMode') === 'expanded' &&
      number(report, 'store.publicServeReadPath.sqlQueryCountPerRequest') === 1 &&
      number(report, 'store.publicServeReadPath.selectorSqlExecutionsPerRequest') === 0 &&
      number(report, 'store.publicServeReadPath.celEvaluationsPerRequest') === 0,
    'bounded: expanded public serve must use one fixed query, zero selectors, and zero CEL evaluations'
  );
  const expandedServeP50 = number(report, 'store.publicServeReadPath.p50Milliseconds');
  const expandedServeP95 = number(report, 'store.publicServeReadPath.p95Milliseconds');
  assert(
    expandedServeP50 > 0 && expandedServeP95 >= expandedServeP50,
    'bounded: expanded public serve p50/p95 must be measured and ordered'
  );
}

function verifyMillion(report: JsonRecord, envelope: JsonRecord): void {
  verifyEnvelope(envelope, 'million');
  verifyInvocation(envelope, 'million', {
    '--pages': '1000000',
    '--samples': '250',
    '--cases': '200',
    '--seed': '1592639710',
  });
  verifyCommon(report, 'million');
  verifyProgress(envelope, 'million', 1_000_000, 1_000_002);
  assert(
    number(report, 'store.requestedScalePageCount') === 1_000_000,
    'million: requested scale must equal 1,000,000'
  );
  assert(
    number(report, 'store.seed.requestedPageCount') === 1_000_000,
    'million: seed request must equal 1,000,000'
  );
  assert(
    number(report, 'store.seed.insertedPageCount') === 1_000_000,
    'million: exactly 1,000,000 scale pages must be inserted'
  );
  assert(
    number(report, 'store.seed.elapsedMilliseconds') > 0,
    'million: Store seed duration must be measured'
  );
  assert(
    path(report, 'store.seed.reusedExistingSeed') === false &&
      /^[0-9a-f]{64}$/.test(String(path(report, 'store.seed.seedIdentityHash'))) &&
      path(report, 'store.seedReplay.reusedExistingSeed') === true &&
      number(report, 'store.seedReplay.insertedPageCount') === 0 &&
      path(report, 'store.seedReplay.seedIdentityHash') ===
        path(report, 'store.seed.seedIdentityHash') &&
      path(report, 'store.seedReplay.pageCountUnchanged') === true &&
      path(report, 'store.seedReplay.tagMembershipCountUnchanged') === true &&
      number(report, 'store.seedReplay.elapsedMilliseconds') > 0,
    'million: scale seed replay must reuse the identical seed and insert zero rows'
  );
  const actualPages = number(report, 'store.actualPageCount');
  assert(
    actualPages === 1_000_002,
    'million: total page count must equal 1,000,000 scale plus two foundation pages'
  );
  assert(
    number(report, 'store.rawCounts.templatePageCount') === 1_000_002 &&
      number(report, 'store.rawCounts.scalePageCount') === 1_000_000 &&
      number(report, 'store.rawCounts.slotValueCount') === 4_000_008 &&
      number(report, 'store.rawCounts.tagMembershipCount') === 1_300_004 &&
      number(report, 'store.rawCounts.publicationCount') === 2 &&
      number(report, 'store.rawCounts.publishedPageDocumentCount') === 1_000_004 &&
      number(report, 'store.rawCounts.manifestCount') === 5 &&
      number(report, 'store.rawCounts.manifestItemCount') === 20,
    'million: exact raw Store page/slot/tag/publication/document/manifest counts must be recorded'
  );
  assert(
    path(report, 'store.databaseHealth.healthy') === true,
    'million: database health must pass'
  );
  assert(
    [7, 8].includes(number(report, 'store.databaseHealth.schemaVersion')),
    'million: Store evidence must use supported schema version 7 or 8'
  );
  assert(
    number(report, 'store.databaseHealth.foreignKeyViolationCount') === 0,
    'million: foreign-key violation count must be zero'
  );
  assert(
    path(report, 'store.completeFiveClassCoverage') === true,
    'million: all five Store classes must be present'
  );
  for (const [membership, expected] of Object.entries({
    chainStore: 500_001,
    fastFood: 200_001,
    independent: 500_001,
    chainNonFastFood: 300_000,
    genericFastFoodChain: 100_000,
    mcdonalds: 50_001,
    burgerKing: 50_000,
  })) {
    assert(
      number(report, `store.membershipCounts.${membership}`) === expected,
      `million: ${membership} class must contain ${expected} rows`
    );
  }
  verifyStoreSelectorDemonstrations(report, 'million', {
    'variant-store-chain': 500_001,
    'variant-store-fast-food': 200_001,
    'variant-store-mcdonalds': 50_001,
    'variant-store-burger-king': 50_000,
  });
  assert(
    path(report, 'store.interpolationManifestSharing.sameStructuralManifest') === true &&
      path(report, 'store.interpolationManifestSharing.renderedOutputDiffers') === true &&
      path(report, 'store.interpolationManifestSharing.documentHashesDiffer') === true,
    "million: same-manifest McDonald's pages must retain distinct interpolated output"
  );
  for (const assertion of [
    'fastFoodPromoUpdateReachedBothBrands',
    'fastFoodPromoUpdateLeftBrandHeroesUnchanged',
    'mcdonaldsHeroEditIsolatedFromBurgerKingAndDefault',
  ]) {
    assert(
      path(report, `store.mutationPropagation.${assertion}`) === true,
      `million: Store mutation assertion ${assertion} must pass`
    );
  }
  assert(
    path(report, 'store.canonicalLookupPlan.usesIndex') === true,
    'million: canonical lookup must use an index'
  );
  assert(
    path(report, 'store.tagLookupPlan.usesIndex') === true,
    'million: tag lookup must use an index'
  );
  assert(
    number(report, 'store.benchmark.scalePageCount') === 1_000_000,
    'million: benchmark must sample the full scale seed'
  );
  const p50 = number(report, 'store.benchmark.canonicalLookupP50Milliseconds');
  const p95 = number(report, 'store.benchmark.canonicalLookupP95Milliseconds');
  assert(
    p50 >= 0 && p95 >= p50,
    'million: canonical lookup p50/p95 must be ordered non-negative measurements'
  );
  assert(
    number(report, 'store.benchmark.tagMembershipCountMilliseconds') > 0,
    'million: tag-membership duration must be measured'
  );
  assert(
    number(report, 'store.scalePublication.pageCount') === actualPages,
    'million: publication page count must equal total Store pages'
  );
  assert(
    number(report, 'store.scalePublication.persistedDocumentCount') === actualPages,
    'million: every Store page must have a persisted document'
  );
  assert(
    number(report, 'store.scalePublication.publicationElapsedMilliseconds') > 0,
    'million: publication duration must be measured'
  );
  assert(
    path(report, 'store.scalePublication.currentPointerActive') === true,
    'million: current pointer must activate'
  );
  assert(
    path(report, 'store.scalePublication.preview.usesIndex') === true &&
      number(report, 'store.scalePublication.preview.elapsedMilliseconds') > 0,
    'million: selector preview must use an index and record duration'
  );
  assert(
    path(report, 'store.scalePublication.idempotentRepublish.inputHashUnchanged') === true,
    'million: republish input hash must be stable'
  );
  assert(
    path(report, 'store.scalePublication.idempotentRepublish.reusedCurrentPublication') === true,
    'million: republish must reuse the current publication'
  );
  assert(
    path(report, 'store.scalePublication.idempotentRepublish.documentRowsUnchanged') === true,
    'million: republish must not add document rows'
  );
  assert(
    number(report, 'store.scalePublication.idempotentRepublish.elapsedMilliseconds') > 0 &&
      number(report, 'store.scalePublication.publishedDocumentsPerSecond') > 0,
    'million: republish duration and publication throughput must be measured'
  );
  assert(
    number(report, 'store.scalePublication.pageToManifestDedup.uniqueManifestCount') > 0,
    'million: at least one manifest is required'
  );
  assert(
    number(report, 'store.scalePublication.manifestCount') === 5 &&
      number(report, 'store.scalePublication.pageToManifestDedup.uniqueManifestCount') === 5 &&
      number(report, 'store.scalePublication.pageToManifestDedup.reusedPageCount') ===
        actualPages - 5 &&
      number(report, 'store.scalePublication.pageToManifestDedup.logicalExpandedPlacementCount') ===
        actualPages * 4 &&
      number(report, 'store.scalePublication.pageToManifestDedup.uniqueStoredPlacementCount') ===
        20,
    'million: Store materialization must preserve the five-manifest/four-placement shape'
  );
  assert(
    number(report, 'store.scalePublication.pageToManifestDedup.reusedPageCount') > 0,
    'million: manifest reuse must be measured'
  );
  assert(
    number(report, 'store.scalePublication.pageToManifestDedup.savedPlacementRatio') > 0,
    'million: shared-manifest placement savings must be positive'
  );
  const logicalStructureBytes = number(
    report,
    'store.scalePublication.pageToManifestDedup.logicalExpandedCanonicalStructureBytes'
  );
  const storedStructureBytes = number(
    report,
    'store.scalePublication.pageToManifestDedup.uniqueCanonicalStructureBytes'
  );
  const savedStructureBytes = number(
    report,
    'store.scalePublication.pageToManifestDedup.savedCanonicalStructureBytes'
  );
  assert(
    logicalStructureBytes > storedStructureBytes &&
      logicalStructureBytes - storedStructureBytes === savedStructureBytes,
    'million: canonical structure byte savings must be internally consistent'
  );
  assert(
    number(report, 'store.scalePublication.publicationStorageDeltaBytes') > 0,
    'million: publication storage delta must be positive'
  );
  const allocatedBefore = number(report, 'store.scalePublication.allocatedBytesBeforePublication');
  const allocatedAfter = number(report, 'store.scalePublication.allocatedBytesAfterPublication');
  const storageDelta = number(report, 'store.scalePublication.publicationStorageDeltaBytes');
  assert(
    allocatedAfter - allocatedBefore === storageDelta &&
      number(report, 'store.scalePublication.publicationStorageBytesPerDocument') > 0,
    'million: allocated storage before/after/delta and bytes per document must be consistent'
  );
  const expandedPayloadBytes = number(
    report,
    'store.scalePublication.logicalExpandedRenderedDocumentBytes'
  );
  const estimatedManifestPageBytes = number(
    report,
    'store.scalePublication.estimatedManifestPageStorageBytes'
  );
  assert(
    expandedPayloadBytes > estimatedManifestPageBytes &&
      expandedPayloadBytes ===
        number(
          report,
          'store.scalePublication.idempotentRepublish.logicalExpandedRenderedDocumentBytes'
        ),
    'million: fully expanded rendered payload bytes must exceed the manifest-page estimate and reproduce on republish'
  );
  assert(
    path(report, 'store.scalePublication.serveReadPath.materializationMode') === 'manifest' &&
      number(report, 'store.scalePublication.serveReadPath.sqlQueryCountPerRequest') === 2 &&
      number(report, 'store.scalePublication.serveReadPath.selectorSqlExecutionsPerRequest') ===
        0 &&
      number(report, 'store.scalePublication.serveReadPath.celEvaluationsPerRequest') === 0,
    'million: materialized serve must use two fixed SQL queries, zero selector queries, and zero CEL evaluations'
  );
  assert(
    number(report, 'store.scalePublication.serveReadPath.sampleCount') >= 250,
    'million: materialized serve must record at least 250 samples'
  );
  const serveP50 = number(report, 'store.scalePublication.serveReadPath.p50Milliseconds');
  const serveP95 = number(report, 'store.scalePublication.serveReadPath.p95Milliseconds');
  assert(
    serveP50 > 0 && serveP95 >= serveP50,
    'million: materialized serve p50/p95 must be measured and ordered'
  );
  assert(
    path(report, 'serviceIntegration.publicationFailureLeftPriorPointerActive') === true,
    'million report: bounded failure proof must preserve the pointer'
  );
  assert(
    path(report, 'serviceIntegration.rollbackRestoredPriorHash') === true,
    'million report: bounded rollback proof must restore the prior hash'
  );
}

async function verifyDeliveryDocs(): Promise<void> {
  const files = {
    benchmarks: 'docs/benchmarks.md',
    guide: 'docs/process-engineering-guide.md',
    adr: 'docs/adr/0001-tidb-materialization.md',
    provenance: 'docs/import-provenance.md',
    readme: 'README.md',
    agents: 'AGENTS.md',
  } as const;
  const contents = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([key, file]) => [key, await Bun.file(file).text()])
    )
  );
  for (const [marker, file] of [
    ['STORE_1M_EVIDENCE_REQUIRED', files.benchmarks],
    ['STORE_1M_ADR_REVIEW_REQUIRED', files.adr],
    ['FINAL_FIVE_PHASE_RESULT_REQUIRED', files.benchmarks],
  ] as const) {
    assert(
      !contents.benchmarks.includes(marker) && !contents.adr.includes(marker),
      `${file}: unresolved delivery marker ${marker}`
    );
  }
  assert(
    contents.provenance.includes('277f9b7c55668a320e52a8e68e136b6ef712ec0b'),
    'provenance: audited Median head is missing'
  );
  assert(
    contents.provenance.includes('https://ui.shadcn.com/blocks'),
    'provenance: shadcn blocks source is missing'
  );
  assert(
    contents.provenance.includes(
      'c8c2ae9948af945230ae352400ba8124a7130ecd3945de8119d989b07ace0b17'
    ) &&
      contents.provenance.includes('71 `SKILL.md` files') &&
      contents.provenance.includes('three untracked skill'),
    'provenance: exact prior-project skill snapshot is missing'
  );
  const mermaidCount = contents.guide.split('```mermaid').length - 1;
  assert(mermaidCount >= 6, 'process guide: at least six Mermaid diagrams are required');
  assert(contents.guide.includes('erDiagram'), 'process guide: relational ERD is missing');
  assert(
    contents.guide.includes('sequenceDiagram'),
    'process guide: request/publication sequence is missing'
  );
  for (const table of [
    'templates',
    'template_slots',
    'route_ingestions',
    'page_instances',
    'page_slot_values',
    'tags',
    'page_tags',
    'route_audit_log',
    'variants',
    'variant_revisions',
    'block_types',
    'block_lineages',
    'block_versions',
    'variant_operations',
    'publications',
    'document_manifests',
    'document_manifest_items',
    'published_page_documents',
    'current_publications',
  ]) {
    assert(contents.guide.includes(`\`${table}\``), `process guide: table ${table} is missing`);
  }
  for (const requirement of [
    'Sample joined rows: `/en-US/store/1001`',
    'Copy-on-write, tombstone, and revert',
    'Dense Eligible Vehicles',
    'Sparse Stores at scale',
    'Structural block replacement',
    'Transitional service architecture',
    'Decisions, tradeoffs, and open questions',
  ]) {
    assert(contents.guide.includes(requirement), `process guide: missing ${requirement}`);
  }
  assert(
    contents.adr.includes('Incremental invalidation matrix'),
    'ADR: invalidation matrix is missing'
  );
  assert(
    contents.adr.includes('Prototype-to-production migration map'),
    'ADR: migration map is missing'
  );
  for (const requirement of [
    'canonical_routes',
    'Chunked compile, validation, and activation',
    'Failure recovery and cleanup',
    'Selector safety in TiDB',
    'Index and partition strategy',
    'Required TiDB proof spikes',
    'https://docs.pingcap.com/tidb/stable/views/',
    'https://docs.pingcap.com/tidb/stable/transaction-overview/',
  ]) {
    assert(contents.adr.includes(requirement), `ADR: missing ${requirement}`);
  }
  assert(
    contents.readme.includes('bun run five-phase-pass'),
    'README: final gate command is missing'
  );
  assert(
    contents.readme.includes('bun run skills:verify'),
    'README: imported-skill verification command is missing'
  );
  assert(
    contents.agents.includes('Linear is the source of truth'),
    'AGENTS.md: Linear authority is missing'
  );
  assert(
    contents.agents.includes('https://linear.app/harwood/project/cms-d9fccc6885e7/overview'),
    'AGENTS.md: canonical Linear CMS project link is missing'
  );
}

const mode = Bun.argv[2] ?? 'all';
const boundedPath = Bun.argv[3] ?? '.data/five-phase-scenario-proof.json';
const millionPath = Bun.argv[4] ?? 'docs/evidence/store-1m.json';
if (mode !== 'bounded' && mode !== 'all') throw new Error('Mode must be bounded or all.');

const boundedEnvelope = object(await readJson(boundedPath), 'bounded evidence');
verifyBounded(scenario(boundedEnvelope), boundedEnvelope);
if (mode === 'all') {
  const millionEnvelope = object(await readJson(millionPath), 'million evidence');
  verifyMillion(scenario(millionEnvelope), millionEnvelope);
  await verifyDeliveryDocs();
}

if (errors.length > 0) {
  console.error(`Evidence verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Evidence verification passed (${mode}).`);
}
