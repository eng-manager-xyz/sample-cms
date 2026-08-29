import type {
  BlockVersion,
  DefaultDocument,
  DocumentPlacement,
  JsonValue,
  ResolvedDocument,
  VariantLayer,
  VariantOperation,
} from '@repo/cms-domain';
import {
  canonicalJson,
  compilePublication,
  orderPlacement,
  PublicationError,
  resolveDocument,
  setPlacement,
  tombstonePlacement,
} from '@repo/cms-domain';

export interface PropertyProofOptions {
  readonly seed?: number;
  readonly caseCount?: number;
}

export interface PropertyProofReport {
  readonly issueId: 'AUT-530';
  readonly seed: number;
  readonly caseCount: number;
  readonly permutationComparisons: number;
  readonly tombstoneCases: number;
  readonly assertions: {
    readonly orderIndependent: true;
    readonly byteStableHashes: true;
    readonly noDuplicatePlacements: true;
    readonly tombstonesAbsent: true;
    readonly oneContentAndOrderProvenancePerWinner: true;
  };
  readonly domainPublicationFailureEvidence: {
    readonly rejectedDuplicateCanonicalUrl: boolean;
    readonly errorCode: string;
    readonly priorPublicationHashUnchanged: boolean;
  };
  readonly limitations: readonly string[];
}

class DeterministicRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  integer(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive safe integer.');
    }
    return this.next() % maxExclusive;
  }

  chance(numerator: number, denominator: number): boolean {
    return this.integer(denominator) < numerator;
  }
}

function shuffled<T>(items: readonly T[], random: DeterministicRandom): readonly T[] {
  return items
    .map((item, index) => ({ item, index, key: random.next() }))
    .sort((left, right) => left.key - right.key || left.index - right.index)
    .map(({ item }) => item);
}

function generatedBlock(caseIndex: number, placementIndex: number, version: string): BlockVersion {
  return {
    id: `property:${caseIndex}:placement:${placementIndex}:${version}`,
    lineageId: `property:${caseIndex}:lineage:${placementIndex}`,
    blockType: placementIndex % 3 === 0 ? 'hero' : 'content',
    schemaVersion: 1,
    content: { caseIndex, placementIndex, version },
  };
}

function generatedCase(
  caseIndex: number,
  random: DeterministicRandom
): { readonly source: DefaultDocument; readonly variants: readonly VariantLayer[] } {
  const placementCount = 3 + random.integer(6);
  const placements = Array.from({ length: placementCount }, (_, placementIndex) => ({
    placementKey: `placement-${placementIndex}`,
    order: placementIndex,
    blockVersion: generatedBlock(caseIndex, placementIndex, 'default'),
  })) satisfies DocumentPlacement[];
  const variantCount = 1 + random.integer(4);
  const variants = Array.from({ length: variantCount }, (_, variantIndex) => {
    const setTarget = random.integer(placementCount);
    const orderTarget = (setTarget + 1 + random.integer(placementCount - 1)) % placementCount;
    const operations: VariantOperation[] = [
      setPlacement(
        `placement-${setTarget}`,
        generatedBlock(caseIndex, setTarget, `variant-${variantIndex}`)
      ),
      orderPlacement(`placement-${orderTarget}`, random.integer(placementCount * 2)),
    ];
    if (variantIndex === variantCount - 1 && placementCount > 3 && random.chance(1, 2)) {
      const tombstoneTarget = (orderTarget + 1) % placementCount;
      if (tombstoneTarget !== setTarget && tombstoneTarget !== orderTarget) {
        operations.push(tombstonePlacement(`placement-${tombstoneTarget}`));
      }
    }
    return {
      id: `property:${caseIndex}:variant:${variantIndex}`,
      priority: (variantIndex + 1) * 10,
      operations,
    } satisfies VariantLayer;
  });
  return {
    source: { templateId: `property-template:${caseIndex}`, placements },
    variants,
  };
}

function assertResolvedInvariants(document: ResolvedDocument): void {
  const keys = document.placements.map((placement) => placement.placementKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Generated resolution contained duplicate placement keys.');
  }
  const tombstones = new Set(document.tombstones.map((tombstone) => tombstone.placementKey));
  if (keys.some((key) => tombstones.has(key))) {
    throw new Error('Generated resolution exposed a tombstoned placement.');
  }
  if (
    document.placements.some(
      (placement) => !placement.provenance.content.sourceId || !placement.provenance.order.sourceId
    )
  ) {
    throw new Error('Generated resolution omitted winning provenance.');
  }
}

function permutedLayers(
  variants: readonly VariantLayer[],
  random: DeterministicRandom
): readonly VariantLayer[] {
  return shuffled(variants, random).map((variant) => ({
    ...variant,
    operations: shuffled(variant.operations, random),
  }));
}

function publicationFailureEvidence(document: ResolvedDocument) {
  const prior = compilePublication([
    {
      pageId: 'property-prior-page',
      canonicalUrl: '/property/prior',
      document,
    },
  ]);
  let activeHash = prior.hash;
  try {
    const candidate = compilePublication([
      {
        pageId: 'property-candidate-a',
        canonicalUrl: '/property/duplicate',
        document,
      },
      {
        pageId: 'property-candidate-b',
        canonicalUrl: '/property/duplicate',
        document,
      },
    ]);
    activeHash = candidate.hash;
  } catch (error) {
    if (error instanceof PublicationError) {
      return {
        rejectedDuplicateCanonicalUrl: true,
        errorCode: error.code,
        priorPublicationHashUnchanged: activeHash === prior.hash,
      };
    }
    throw error;
  }
  return {
    rejectedDuplicateCanonicalUrl: false,
    errorCode: 'NONE',
    priorPublicationHashUnchanged: activeHash === prior.hash,
  };
}

export function runGeneratedDeterminismProof(
  options: PropertyProofOptions = {}
): PropertyProofReport {
  const seed = options.seed ?? 0x5eedc0de;
  const caseCount = options.caseCount ?? 200;
  if (!Number.isSafeInteger(caseCount) || caseCount <= 0) {
    throw new Error('caseCount must be a positive safe integer.');
  }
  const random = new DeterministicRandom(seed);
  let tombstoneCases = 0;
  let representativeDocument: ResolvedDocument | null = null;
  for (let caseIndex = 0; caseIndex < caseCount; caseIndex += 1) {
    const generated = generatedCase(caseIndex, random);
    const baseline = resolveDocument(generated.source, generated.variants);
    const permuted = resolveDocument(
      { ...generated.source, placements: shuffled(generated.source.placements, random) },
      permutedLayers(generated.variants, random)
    );
    assertResolvedInvariants(baseline);
    assertResolvedInvariants(permuted);
    if (
      canonicalJson(baseline as unknown as JsonValue) !==
      canonicalJson(permuted as unknown as JsonValue)
    ) {
      throw new Error(`Generated case ${caseIndex} changed under input permutation.`);
    }
    const publication = compilePublication([
      {
        pageId: `property-page:${caseIndex}`,
        canonicalUrl: `/property/${caseIndex}`,
        document: baseline,
      },
    ]);
    const permutedPublication = compilePublication([
      {
        pageId: `property-page:${caseIndex}`,
        canonicalUrl: `/property/${caseIndex}`,
        document: permuted,
      },
    ]);
    if (publication.hash !== permutedPublication.hash) {
      throw new Error(`Generated publication ${caseIndex} changed under input permutation.`);
    }
    if (baseline.tombstones.length > 0) {
      tombstoneCases += 1;
    }
    representativeDocument ??= baseline;
  }
  if (!representativeDocument) {
    throw new Error('Property proof did not generate a representative document.');
  }
  return {
    issueId: 'AUT-530',
    seed,
    caseCount,
    permutationComparisons: caseCount,
    tombstoneCases,
    assertions: {
      orderIndependent: true,
      byteStableHashes: true,
      noDuplicatePlacements: true,
      tombstonesAbsent: true,
      oneContentAndOrderProvenancePerWinner: true,
    },
    domainPublicationFailureEvidence: publicationFailureEvidence(representativeDocument),
    limitations: [
      'Generated-model coverage is deterministic and bounded; it is not an exhaustive proof.',
      'The fast prior-hash check is domain-only; runServiceIntegrationProof verifies database transaction rollback.',
    ],
  };
}
