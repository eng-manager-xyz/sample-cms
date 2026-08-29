import type {
  BlockVersion,
  DefaultDocument,
  DocumentPlacement,
  ResolvedDocument,
  SelectorRecord,
  VariantLayer,
  VariantOperation,
} from '@repo/cms-domain';
import {
  compilePublication,
  compileSelector,
  evaluateSelector,
  orderPlacement,
  resolveDocument,
  setPlacement,
  VariantConflictError,
} from '@repo/cms-domain';

const DENSE_TEMPLATE_ID = 'eligible-vehicles';
const DENSE_FIELDS = ['locale', 'country', 'language', 'state', 'purpose'] as const;
const DENSE_PLACEMENTS = [
  'navigation',
  'primary-hero',
  'eligibility-summary',
  'vehicle-list',
  'legal-notice',
  'cta',
  'footer',
] as const;

interface DenseLocale {
  readonly locale: string;
  readonly country: string;
  readonly language: string;
  readonly states: readonly string[];
}

const DENSE_LOCALES: readonly DenseLocale[] = [
  { locale: 'en-US', country: 'US', language: 'en', states: ['CA', 'NY'] },
  { locale: 'es-US', country: 'US', language: 'es', states: ['CA', 'NY'] },
  { locale: 'en-CA', country: 'CA', language: 'en', states: ['BC', 'ON'] },
  { locale: 'fr-CA', country: 'CA', language: 'fr', states: ['ON', 'QC'] },
];
const DENSE_PURPOSES = ['delivery', 'premium', 'rideshare'] as const;

export interface DensePage {
  readonly id: string;
  readonly canonicalUrl: string;
  readonly dimensions: SelectorRecord;
}

export interface DenseVariant {
  readonly selector: string;
  readonly layer: VariantLayer;
  readonly exact: boolean;
}

export interface DenseGoldenPlacement {
  readonly placementKey: string;
  readonly blockVersionId: string;
  readonly blockType: string;
  readonly contentSourceId: string;
  readonly orderSourceId: string;
}

export interface DenseGolden {
  readonly pageId: string;
  readonly contentHash: string;
  readonly matchedVariantIds: readonly string[];
  readonly placements: readonly DenseGoldenPlacement[];
}

export interface DenseScenarioReport {
  readonly issueId: 'AUT-527';
  readonly templateId: string;
  readonly pageCount: number;
  readonly variantCount: number;
  readonly variantMatchCount: number;
  readonly exactVariantCount: number;
  readonly exactOverridePageCount: number;
  readonly exactOverridesEveryPlacement: boolean;
  readonly publicationHash: string;
  readonly publicationMetrics: ReturnType<typeof compilePublication>['metrics'];
  readonly publicationElapsedMilliseconds: number;
  readonly publicationSerializedBytes: number;
  readonly broadGolden: DenseGolden;
  readonly exactGolden: DenseGolden;
  readonly conflict: {
    readonly rejected: boolean;
    readonly code: string;
    readonly priority: number;
    readonly placementKey: string;
    readonly variantIds: readonly string[];
  };
  readonly limitations: readonly string[];
}

function blockVersion(
  id: string,
  placementKey: string,
  scope: string,
  blockType = placementKey
): BlockVersion {
  return {
    id,
    lineageId: `eligible-lineage:${placementKey}`,
    blockType,
    schemaVersion: 1,
    content: { copy: `${scope}:${placementKey}` },
  };
}

export function denseDefaultDocument(): DefaultDocument {
  return {
    templateId: DENSE_TEMPLATE_ID,
    placements: DENSE_PLACEMENTS.map<DocumentPlacement>((placementKey, order) => ({
      placementKey,
      order,
      blockVersion: blockVersion(`eligible-default:${placementKey}:v1`, placementKey, 'default'),
    })),
  };
}

function setEveryPlacement(scope: string): readonly VariantOperation[] {
  return DENSE_PLACEMENTS.map((placementKey) =>
    setPlacement(
      placementKey,
      blockVersion(`eligible-${scope}:${placementKey}:v1`, placementKey, scope)
    )
  );
}

function exactOperations(page: DensePage): readonly VariantOperation[] {
  const contentOperations = DENSE_PLACEMENTS.map((placementKey) =>
    setPlacement(
      placementKey,
      blockVersion(
        `eligible-exact:${page.id}:${placementKey}:v1`,
        placementKey,
        `exact:${page.id}`,
        placementKey === 'vehicle-list' ? 'exact-vehicle-grid' : placementKey
      )
    )
  );
  const orderOperations = DENSE_PLACEMENTS.map((placementKey, order) =>
    orderPlacement(placementKey, order)
  );
  return [...contentOperations, ...orderOperations];
}

export function buildDensePages(): readonly DensePage[] {
  return DENSE_LOCALES.flatMap((locale) =>
    locale.states.flatMap((state) =>
      DENSE_PURPOSES.map((purpose) => ({
        id: `eligible:${locale.locale}:${state}:${purpose}`,
        canonicalUrl: `/${locale.locale}/eligible-vehicles/${state.toLowerCase()}/${purpose}`,
        dimensions: {
          locale: locale.locale,
          country: locale.country,
          language: locale.language,
          state,
          purpose,
        },
      }))
    )
  );
}

export function buildDenseVariants(pages: readonly DensePage[]): readonly DenseVariant[] {
  const countryVariants = ['CA', 'US'].map<DenseVariant>((country) => ({
    selector: `country = '${country}'`,
    layer: {
      id: `eligible-country:${country}`,
      priority: 10,
      operations: setEveryPlacement(`country:${country}`),
    },
    exact: false,
  }));
  const languageVariants = ['en', 'es', 'fr'].map<DenseVariant>((language) => ({
    selector: `language = '${language}'`,
    layer: {
      id: `eligible-language:${language}`,
      priority: 20,
      operations: setEveryPlacement(`language:${language}`),
    },
    exact: false,
  }));
  const stateVariants = ['BC', 'CA', 'NY', 'ON', 'QC'].map<DenseVariant>((state) => ({
    selector: `state = '${state}'`,
    layer: {
      id: `eligible-state:${state}`,
      priority: 30,
      operations: ['eligibility-summary', 'legal-notice'].map((placementKey) =>
        setPlacement(
          placementKey,
          blockVersion(`eligible-state:${state}:${placementKey}:v1`, placementKey, `state:${state}`)
        )
      ),
    },
    exact: false,
  }));
  const purposeVariants = DENSE_PURPOSES.map<DenseVariant>((purpose) => {
    const operations: VariantOperation[] = [
      setPlacement(
        'primary-hero',
        blockVersion(
          `eligible-purpose:${purpose}:hero:v1`,
          'primary-hero',
          `purpose:${purpose}`,
          purpose === 'premium' ? 'premium-hero' : 'purpose-hero'
        )
      ),
      setPlacement(
        'vehicle-list',
        blockVersion(
          `eligible-purpose:${purpose}:vehicles:v1`,
          'vehicle-list',
          `purpose:${purpose}`,
          purpose === 'premium' ? 'premium-vehicle-grid' : 'vehicle-list'
        )
      ),
      setPlacement(
        'cta',
        blockVersion(`eligible-purpose:${purpose}:cta:v1`, 'cta', `purpose:${purpose}`)
      ),
    ];
    if (purpose === 'premium') {
      operations.push(orderPlacement('eligibility-summary', 1), orderPlacement('primary-hero', 2));
    }
    return {
      selector: `purpose = '${purpose}'`,
      layer: { id: `eligible-purpose:${purpose}`, priority: 40, operations },
      exact: false,
    };
  });
  const exactPages = pages.filter(
    (page) =>
      page.dimensions.purpose === 'premium' && ['CA', 'ON'].includes(String(page.dimensions.state))
  );
  const exactVariants = exactPages.map<DenseVariant>((page) => ({
    selector: DENSE_FIELDS.map((field) => `${field} = '${String(page.dimensions[field])}'`).join(
      ' AND '
    ),
    layer: {
      id: `eligible-exact:${page.id}`,
      priority: 100,
      operations: exactOperations(page),
    },
    exact: true,
  }));
  return [
    ...countryVariants,
    ...languageVariants,
    ...stateVariants,
    ...purposeVariants,
    ...exactVariants,
  ];
}

function matchingLayers(
  page: DensePage,
  variants: readonly DenseVariant[]
): readonly VariantLayer[] {
  return variants.flatMap((variant) => {
    const selector = compileSelector(variant.selector, { fields: DENSE_FIELDS }).expression;
    return evaluateSelector(selector, page.dimensions) ? [variant.layer] : [];
  });
}

function golden(page: DensePage, document: ResolvedDocument): DenseGolden {
  return {
    pageId: page.id,
    contentHash: document.contentHash,
    matchedVariantIds: document.matchedVariantIds,
    placements: document.placements.map((placement) => ({
      placementKey: placement.placementKey,
      blockVersionId: placement.blockVersion.id,
      blockType: placement.blockVersion.blockType,
      contentSourceId: placement.provenance.content.sourceId,
      orderSourceId: placement.provenance.order.sourceId,
    })),
  };
}

function conflictEvidence(document: DefaultDocument) {
  const conflictLayers: readonly VariantLayer[] = [
    {
      id: 'eligible-conflict:a',
      priority: 60,
      operations: [
        setPlacement(
          'legal-notice',
          blockVersion('eligible-conflict:a:legal:v1', 'legal-notice', 'conflict:a')
        ),
      ],
    },
    {
      id: 'eligible-conflict:b',
      priority: 60,
      operations: [
        setPlacement(
          'legal-notice',
          blockVersion('eligible-conflict:b:legal:v1', 'legal-notice', 'conflict:b')
        ),
      ],
    },
  ];
  try {
    resolveDocument(document, conflictLayers);
  } catch (error) {
    if (error instanceof VariantConflictError) {
      const conflict = error.conflicts[0];
      if (conflict) {
        return {
          rejected: true,
          code: error.code,
          priority: conflict.priority,
          placementKey: conflict.placementKey,
          variantIds: conflict.variantIds,
        } as const;
      }
    }
    throw error;
  }
  return {
    rejected: false,
    code: 'NONE',
    priority: -1,
    placementKey: '',
    variantIds: [],
  } as const;
}

export function runDenseEligibleVehiclesProof(): DenseScenarioReport {
  const pages = buildDensePages();
  const variants = buildDenseVariants(pages);
  const sourceDocument = denseDefaultDocument();
  const resolved = pages
    .map((page) => ({
      page,
      layers: matchingLayers(page, variants),
    }))
    .map(({ page, layers }) => ({
      page,
      layers,
      document: resolveDocument(sourceDocument, layers),
    }));
  const publicationStartedAt = performance.now();
  const publication = compilePublication(
    resolved.map(({ page, document }) => ({
      pageId: page.id,
      canonicalUrl: page.canonicalUrl,
      document,
    }))
  );
  const publicationElapsedMilliseconds = performance.now() - publicationStartedAt;
  const publicationSerializedBytes = new TextEncoder().encode(JSON.stringify(publication)).length;
  const broad = resolved.find(({ page }) => page.id === 'eligible:en-US:NY:delivery');
  const exact = resolved.find(({ page }) => page.id === 'eligible:en-US:CA:premium');
  if (!broad || !exact) {
    throw new Error('Dense golden fixtures were not generated.');
  }
  const exactVariantIds = new Set(
    variants.filter((variant) => variant.exact).map(({ layer }) => layer.id)
  );
  const exactResolved = resolved.filter(({ document }) =>
    document.matchedVariantIds.some((id) => exactVariantIds.has(id))
  );
  const exactOverridesEveryPlacement = exactResolved.every(({ document }) =>
    document.placements.every((placement) => placement.provenance.content.priority === 100)
  );

  return {
    issueId: 'AUT-527',
    templateId: DENSE_TEMPLATE_ID,
    pageCount: pages.length,
    variantCount: variants.length,
    variantMatchCount: resolved.reduce((total, entry) => total + entry.layers.length, 0),
    exactVariantCount: exactVariantIds.size,
    exactOverridePageCount: exactResolved.length,
    exactOverridesEveryPlacement,
    publicationHash: publication.hash,
    publicationMetrics: publication.metrics,
    publicationElapsedMilliseconds,
    publicationSerializedBytes,
    broadGolden: golden(broad.page, broad.document),
    exactGolden: golden(exact.page, exact.document),
    conflict: conflictEvidence(sourceDocument),
    limitations: [
      'Metrics describe this deterministic 24-page in-memory domain fixture, not production traffic or TiDB.',
      'Dense manifests are reported as measured; no reuse is inferred beyond equal structural hashes.',
      'runPersistedDenseEligibleVehiclesProof separately verifies SQLite publication, provenance, indexed selectors, and conflict atomicity.',
    ],
  };
}
