import type {
  BlockVersion,
  DefaultDocument,
  DocumentPlacement,
  VariantLayer,
  VariantOperation,
} from '@repo/cms-domain';
import {
  compilePublication,
  resolveDocument,
  revertPlacement,
  setPlacement,
  tombstonePlacement,
} from '@repo/cms-domain';

const STRUCTURAL_TEMPLATE_ID = 'structural-marketing';
const STRUCTURAL_PLACEMENT_KEYS = [
  'navigation',
  'primary-hero',
  'announcement-promo',
  ...Array.from({ length: 21 }, (_, index) => `content-${String(index + 1).padStart(2, '0')}`),
] as const;

export interface StructuralPlacementComparison {
  readonly placementKey: string;
  readonly defaultBlockType: string;
  readonly defaultBlockVersionId: string;
  readonly effectiveBlockType: string | null;
  readonly effectiveBlockVersionId: string | null;
  readonly contentSourceId: string | null;
  readonly inheritedByPointer: boolean;
  readonly tombstoned: boolean;
}

export interface StructuralScenarioReport {
  readonly issueId: 'AUT-529';
  readonly templateId: string;
  readonly defaultPlacementCount: 24;
  readonly effectivePlacementCount: number;
  readonly sparseOperationCount: 2;
  readonly inheritedPlacementCount: number;
  readonly inheritanceRatio: number;
  readonly meetsNinetyPercentInheritance: boolean;
  readonly stableHeroPlacementPreserved: boolean;
  readonly heroTypeChangedFrom: 'hero';
  readonly heroTypeChangedTo: 'hero_alt';
  readonly tombstonedPlacementKey: 'announcement-promo';
  readonly unaffectedBlockVersionIds: readonly string[];
  readonly comparison: readonly StructuralPlacementComparison[];
  readonly draftHash: string;
  readonly currentPublishedHash: string;
  readonly publicationHash: string;
  readonly publicationMetrics: ReturnType<typeof compilePublication>['metrics'];
  readonly publicationElapsedMilliseconds: number;
  readonly publicationSerializedBytes: number;
  readonly revertEvidence: {
    readonly restoredDefaultHero: boolean;
    readonly restoredHeroBlockVersionId: string;
    readonly promoRemainsTombstoned: boolean;
  };
  readonly persistedVerificationRunner: 'runPersistedStructuralProof';
  readonly limitations: readonly string[];
}

function structuralBlock(
  placementKey: string,
  blockType: string,
  versionSuffix: string,
  copy: string
): BlockVersion {
  return {
    id: `structural-block:${placementKey}:${versionSuffix}`,
    lineageId: `structural-lineage:${placementKey}`,
    blockType,
    schemaVersion: 1,
    content: blockType === 'hero_alt' ? { copy, layout: 'split' } : { copy },
  };
}

export function structuralDefaultDocument(): DefaultDocument {
  return {
    templateId: STRUCTURAL_TEMPLATE_ID,
    placements: STRUCTURAL_PLACEMENT_KEYS.map<DocumentPlacement>((placementKey, order) => ({
      placementKey,
      order,
      blockVersion: structuralBlock(
        placementKey,
        placementKey === 'primary-hero'
          ? 'hero'
          : placementKey === 'announcement-promo'
            ? 'promo'
            : placementKey === 'navigation'
              ? 'navigation'
              : 'content-section',
        'v1',
        `Default ${placementKey}`
      ),
    })),
  };
}

export function structuralVariantOperations(): readonly VariantOperation[] {
  return [
    setPlacement(
      'primary-hero',
      structuralBlock(
        'primary-hero',
        'hero_alt',
        'hero-alt-v1',
        'Alternative hero with a distinct schema'
      )
    ),
    tombstonePlacement('announcement-promo'),
  ];
}

export function runStructuralReplacementProof(): StructuralScenarioReport {
  const source = structuralDefaultDocument();
  const operations = structuralVariantOperations();
  const variant: VariantLayer = {
    id: 'structural-variant:hero-alt',
    priority: 10,
    operations,
  };
  const current = resolveDocument(source, []);
  const draft = resolveDocument(source, [variant]);
  const defaultByKey = new Map(
    source.placements.map((placement) => [placement.placementKey, placement])
  );
  const effectiveByKey = new Map(
    draft.placements.map((placement) => [placement.placementKey, placement])
  );
  const tombstoneKeys = new Set(draft.tombstones.map((tombstone) => tombstone.placementKey));
  const comparison = source.placements.map<StructuralPlacementComparison>((defaultPlacement) => {
    const effectivePlacement = effectiveByKey.get(defaultPlacement.placementKey);
    return {
      placementKey: defaultPlacement.placementKey,
      defaultBlockType: defaultPlacement.blockVersion.blockType,
      defaultBlockVersionId: defaultPlacement.blockVersion.id,
      effectiveBlockType: effectivePlacement?.blockVersion.blockType ?? null,
      effectiveBlockVersionId: effectivePlacement?.blockVersion.id ?? null,
      contentSourceId: effectivePlacement?.provenance.content.sourceId ?? null,
      inheritedByPointer:
        effectivePlacement?.blockVersion.id === defaultPlacement.blockVersion.id &&
        effectivePlacement.provenance.content.kind === 'default',
      tombstoned: tombstoneKeys.has(defaultPlacement.placementKey),
    };
  });
  const unaffectedBlockVersionIds = comparison
    .filter((placement) => placement.inheritedByPointer)
    .map((placement) => placement.defaultBlockVersionId);
  const inheritedPlacementCount = unaffectedBlockVersionIds.length;
  const inheritanceRatio = inheritedPlacementCount / source.placements.length;
  const defaultHero = defaultByKey.get('primary-hero');
  const draftHero = effectiveByKey.get('primary-hero');
  if (!defaultHero || !draftHero) {
    throw new Error('Structural hero fixture is missing.');
  }
  const revertedOperations = revertPlacement(operations, 'primary-hero');
  const reverted = resolveDocument(source, [
    { id: variant.id, priority: variant.priority, operations: revertedOperations },
  ]);
  const revertedHero = reverted.placements.find(
    (placement) => placement.placementKey === 'primary-hero'
  );
  if (!revertedHero) {
    throw new Error('Reverted structural hero fixture is missing.');
  }
  const publicationStartedAt = performance.now();
  const publication = compilePublication([
    {
      pageId: 'structural-page:current',
      canonicalUrl: '/en-US/product/current',
      document: current,
    },
    {
      pageId: 'structural-page:draft',
      canonicalUrl: '/en-US/product/hero-alt',
      document: draft,
    },
  ]);
  const publicationElapsedMilliseconds = performance.now() - publicationStartedAt;
  const publicationSerializedBytes = new TextEncoder().encode(JSON.stringify(publication)).length;

  return {
    issueId: 'AUT-529',
    templateId: STRUCTURAL_TEMPLATE_ID,
    defaultPlacementCount: 24,
    effectivePlacementCount: draft.placements.length,
    sparseOperationCount: 2,
    inheritedPlacementCount,
    inheritanceRatio,
    meetsNinetyPercentInheritance: inheritanceRatio >= 0.9,
    stableHeroPlacementPreserved:
      defaultHero.placementKey === draftHero.placementKey &&
      defaultHero.blockVersion.lineageId === draftHero.blockVersion.lineageId,
    heroTypeChangedFrom: 'hero',
    heroTypeChangedTo: 'hero_alt',
    tombstonedPlacementKey: 'announcement-promo',
    unaffectedBlockVersionIds,
    comparison,
    draftHash: draft.contentHash,
    currentPublishedHash: current.contentHash,
    publicationHash: publication.hash,
    publicationMetrics: publication.metrics,
    publicationElapsedMilliseconds,
    publicationSerializedBytes,
    revertEvidence: {
      restoredDefaultHero: revertedHero.blockVersion.id === defaultHero.blockVersion.id,
      restoredHeroBlockVersionId: revertedHero.blockVersion.id,
      promoRemainsTombstoned: reverted.tombstones.some(
        (tombstone) => tombstone.placementKey === 'announcement-promo'
      ),
    },
    persistedVerificationRunner: 'runPersistedStructuralProof',
    limitations: [
      'This fast proof is domain-only; runPersistedStructuralProof verifies database publication and pointer rollback.',
      'The 91.67% inheritance result is measured on this 24-placement fixture.',
    ],
  };
}
