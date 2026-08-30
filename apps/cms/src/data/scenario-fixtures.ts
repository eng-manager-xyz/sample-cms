import * as z from 'zod';

export const ScenarioIdSchema = z.enum(['stores', 'eligible-vehicles', 'structural-proof']);
export const TemplateParamsSchema = z.object({ templateId: z.string().min(1) });

export type ScenarioId = z.infer<typeof ScenarioIdSchema>;
export type PublicationState = 'Published' | 'Ready to publish' | 'Draft';
export type ConflictState = 'Clear' | '2 conflicts' | 'Unchecked';
export type DimensionKind = 'path' | 'derived' | 'tag' | 'static';
export type LayerTone = 'neutral' | 'blue' | 'purple' | 'amber' | 'green' | 'red';
export type AuteurContentState = 'published' | 'draft_only' | 'missing';

export interface DimensionFixture {
  id: string;
  label: string;
  kind: DimensionKind;
  values: string[];
  description: string;
}

export interface LayerOperation {
  placementKey: string;
  kind: 'inherit' | 'replace' | 'hide' | 'insert';
  blockType: string;
  version: string;
  summary: string;
  hiddenLower?: string;
}

export interface VariantLayer {
  id: string;
  name: string;
  priority: number;
  selector: string;
  selectorSql: string;
  matchCount: number;
  affectedPlacementCount: number;
  tone: LayerTone;
  operations: LayerOperation[];
}

export interface ProjectionPoint {
  id: string;
  x: number;
  y: number;
  density: number;
  label: string;
  layerIds: string[];
  instanceOffset: number;
}

export interface InstanceRow {
  id: string;
  canonicalUrl: string;
  lifecycle: 'live' | 'not_live' | 'archived';
  auteurState: AuteurContentState;
  dimensions: PageDimension[];
  dimensionSummary: string;
  tags: string[];
  matchingLayerIds: string[];
  matchedLayers: number;
  conflict: boolean;
}

export interface EffectivePlacement {
  placementKey: string;
  order: number;
  blockType: string;
  publishedValue: string;
  draftValue: string;
  diff: 'same' | 'changed' | 'hidden' | 'added';
  winningLayerId: string;
  version: string;
  provenance: string[];
  hiddenLower?: string;
}

export interface PagePin {
  id: string;
  canonicalUrl: string;
  dimensions: PageDimension[];
  tags: string[];
  matchingLayerIds: string[];
  placements: EffectivePlacement[];
}

export interface PageDimension {
  key: string;
  value: string;
  kind: Exclude<DimensionKind, 'static' | 'tag'>;
}

export interface RequestCase {
  id: string;
  label: string;
  canonicalUrl: string;
  externalRouteId: string;
  lifecycle: InstanceRow['lifecycle'];
  auteurState: AuteurContentState;
  outcome: 200 | 404 | 503;
  explanation: string;
}

export interface PublicationRecord {
  id: string;
  label: string;
  state: 'active' | 'candidate' | 'rollback';
  createdAt: string;
  pageCount: number;
  manifestCount: number;
  hash: string;
  duration: string;
  conflictCount: number;
  description: string;
}

export interface ScenarioFixture {
  id: ScenarioId;
  name: string;
  shortName: string;
  domain: string;
  pattern: string;
  description: string;
  dimensions: DimensionFixture[];
  instanceCount: number;
  variantCount: number;
  publicationState: PublicationState;
  conflictState: ConflictState;
  lastPublished: string;
  inheritance: number;
  preview: 'sparse' | 'dense' | 'structural';
  scaleCue: 'millions' | 'thousands' | 'hundreds';
  layers: VariantLayer[];
  projectionPoints: ProjectionPoint[];
  defaultAxes: [string, string];
  pin: PagePin;
  requestCases: RequestCase[];
  publications: PublicationRecord[];
}

function makeRequestCases(prefix: string, canonicalUrl: string): RequestCase[] {
  return [
    {
      id: `${prefix}-live-published`,
      label: 'Live + published',
      canonicalUrl,
      externalRouteId: `router:${prefix}:live`,
      lifecycle: 'live',
      auteurState: 'published',
      outcome: 200,
      explanation:
        'RouterService permits serving, then Auteur reads the active immutable manifest.',
    },
    {
      id: `${prefix}-not-live`,
      label: 'Not live + draft',
      canonicalUrl: `${canonicalUrl}?case=not-live`,
      externalRouteId: `router:${prefix}:not-live`,
      lifecycle: 'not_live',
      auteurState: 'draft_only',
      outcome: 404,
      explanation: 'Authoring may exist, but RouterService deliberately gates the route to 404.',
    },
    {
      id: `${prefix}-archived`,
      label: 'Archived route',
      canonicalUrl: `${canonicalUrl}?case=archived`,
      externalRouteId: `router:${prefix}:archived`,
      lifecycle: 'archived',
      auteurState: 'published',
      outcome: 404,
      explanation: 'Historical content remains immutable while the archived route cannot serve.',
    },
    {
      id: `${prefix}-unsafe`,
      label: 'Live + missing document',
      canonicalUrl: `${canonicalUrl}?case=unsafe`,
      externalRouteId: `router:${prefix}:unsafe`,
      lifecycle: 'live',
      auteurState: 'missing',
      outcome: 503,
      explanation: 'Unsafe seam state: the route is live but Auteur has no activated document.',
    },
  ];
}

function makePoints(
  prefix: string,
  count: number,
  layerIdsForIndex: (index: number) => string[]
): ProjectionPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-point-${index + 1}`,
    x: 7 + ((index * 29) % 87),
    y: 8 + ((index * 43) % 82),
    density: 1 + ((index * 7) % 5),
    label: `Deterministic sample ${index + 1}`,
    layerIds: layerIdsForIndex(index),
    instanceOffset: index,
  }));
}

function makePublications(prefix: string, pageCount: number): PublicationRecord[] {
  const manifestCount = Math.max(12, Math.round(pageCount / 208));
  return [
    {
      id: `${prefix}-candidate-20`,
      label: 'Publication 20',
      state: 'candidate',
      createdAt: 'Aug 29, 2026 · 11:42',
      pageCount,
      manifestCount,
      hash: `fixture-hash:${prefix}:candidate-20`,
      duration: 'fixture 12.8 s',
      conflictCount: prefix === 'eligible' ? 2 : 0,
      description: 'Draft snapshot compiled from the latest authoring revision.',
    },
    {
      id: `${prefix}-active-19`,
      label: 'Publication 19',
      state: 'active',
      createdAt: 'Aug 29, 2026 · 09:14',
      pageCount,
      manifestCount: Math.max(11, manifestCount - 3),
      hash: `fixture-hash:${prefix}:active-19`,
      duration: 'fixture 11.9 s',
      conflictCount: 0,
      description: 'Current immutable serving pointer.',
    },
    {
      id: `${prefix}-rollback-18`,
      label: 'Publication 18',
      state: 'rollback',
      createdAt: 'Aug 28, 2026 · 16:06',
      pageCount,
      manifestCount: Math.max(10, manifestCount - 6),
      hash: `fixture-hash:${prefix}:rollback-18`,
      duration: 'fixture 12.1 s',
      conflictCount: 0,
      description: 'Retained rollback target; never mutated after activation.',
    },
  ];
}

const storeLayers: VariantLayer[] = [
  {
    id: 'store-default',
    name: 'Template default',
    priority: 0,
    selector: 'All store pages',
    selectorSql: 'SELECT page_id FROM selector_pages WHERE template_id = :template_id',
    matchCount: 1_000_000,
    affectedPlacementCount: 4,
    tone: 'neutral',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'insert',
        blockType: 'hero',
        version: 'hero@v12',
        summary: 'I am {{ store.name }} — {{ store.location }}',
      },
      {
        placementKey: 'category-promo',
        kind: 'insert',
        blockType: 'promo',
        version: 'promo@v7',
        summary: 'Local favorites, delivered',
      },
      {
        placementKey: 'footer',
        kind: 'insert',
        blockType: 'footer',
        version: 'footer@v4',
        summary: 'Default marketplace footer',
      },
    ],
  },
  {
    id: 'store-chain',
    name: 'Chain stores',
    priority: 10,
    selector: "tag.store_type = 'chain_store'",
    selectorSql:
      "SELECT page_id FROM selector_page_tags WHERE tag_key = 'store_type' AND tag_value = 'chain_store'",
    matchCount: 184_220,
    affectedPlacementCount: 1,
    tone: 'blue',
    operations: [
      {
        placementKey: 'footer',
        kind: 'replace',
        blockType: 'footer',
        version: 'footer@v9',
        summary: 'Chain availability and franchise terms',
        hiddenLower: 'footer@v4',
      },
    ],
  },
  {
    id: 'store-fast-food',
    name: 'Fast food',
    priority: 20,
    selector: "tag.category = 'fast_food'",
    selectorSql:
      "SELECT page_id FROM selector_page_tags WHERE tag_key = 'category' AND tag_value = 'fast_food'",
    matchCount: 96_482,
    affectedPlacementCount: 1,
    tone: 'amber',
    operations: [
      {
        placementKey: 'category-promo',
        kind: 'replace',
        blockType: 'promo',
        version: 'promo@v11',
        summary: 'Fast favorites in under 30 minutes',
        hiddenLower: 'promo@v7',
      },
    ],
  },
  {
    id: 'store-mcdonalds',
    name: "McDonald's",
    priority: 30,
    selector: "tag.brand = 'mcdonalds'",
    selectorSql:
      "SELECT page_id FROM selector_page_tags WHERE tag_key = 'brand' AND tag_value = 'mcdonalds'",
    matchCount: 13_840,
    affectedPlacementCount: 1,
    tone: 'purple',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'replace',
        blockType: 'hero',
        version: 'hero@v18',
        summary: 'Buy now {{ store.name }} — {{ store.location }}',
        hiddenLower: 'hero@v12',
      },
    ],
  },
  {
    id: 'store-burger-king',
    name: 'Burger King',
    priority: 30,
    selector: "tag.brand = 'burger_king'",
    selectorSql:
      "SELECT page_id FROM selector_page_tags WHERE tag_key = 'brand' AND tag_value = 'burger_king'",
    matchCount: 7_120,
    affectedPlacementCount: 1,
    tone: 'red',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'replace',
        blockType: 'hero',
        version: 'hero@v17',
        summary: 'Have it your way in {{ store.location }}',
        hiddenLower: 'hero@v12',
      },
    ],
  },
];

const eligibleLayers: VariantLayer[] = [
  {
    id: 'eligible-default',
    name: 'Template default',
    priority: 0,
    selector: 'All eligible-vehicle pages',
    selectorSql: 'SELECT page_id FROM selector_pages WHERE template_id = :template_id',
    matchCount: 8_640,
    affectedPlacementCount: 18,
    tone: 'neutral',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'insert',
        blockType: 'hero',
        version: 'hero@v31',
        summary: 'Drive with confidence',
      },
    ],
  },
  {
    id: 'eligible-spanish',
    name: 'Spanish language',
    priority: 10,
    selector: "language = 'es'",
    selectorSql: "SELECT page_id FROM selector_pages WHERE language = 'es'",
    matchCount: 2_880,
    affectedPlacementCount: 14,
    tone: 'blue',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'replace',
        blockType: 'hero',
        version: 'hero@v34',
        summary: 'Conduce con confianza',
        hiddenLower: 'hero@v31',
      },
    ],
  },
  {
    id: 'eligible-california',
    name: 'California legal',
    priority: 20,
    selector: "country = 'US' AND state = 'ca'",
    selectorSql: "SELECT page_id FROM selector_pages WHERE country = 'US' AND state_value = 'ca'",
    matchCount: 720,
    affectedPlacementCount: 8,
    tone: 'amber',
    operations: [
      {
        placementKey: 'legal-notice',
        kind: 'replace',
        blockType: 'legal_notice',
        version: 'legal@v22',
        summary: 'California-specific eligibility and disclosure',
        hiddenLower: 'legal@v19',
      },
    ],
  },
  {
    id: 'eligible-rideshare',
    name: 'Rideshare purpose',
    priority: 30,
    selector: "slug = 'rideshare'",
    selectorSql: "SELECT page_id FROM selector_pages WHERE slug = 'rideshare'",
    matchCount: 2_160,
    affectedPlacementCount: 11,
    tone: 'purple',
    operations: [
      {
        placementKey: 'eligibility-table',
        kind: 'replace',
        blockType: 'vehicle_table',
        version: 'table@v15',
        summary: 'Rideshare vehicle classes and year thresholds',
        hiddenLower: 'table@v9',
      },
    ],
  },
  {
    id: 'eligible-conflict-a',
    name: 'CA campaign A',
    priority: 40,
    selector: "state = 'ca' AND slug = 'rideshare'",
    selectorSql:
      "SELECT page_id FROM selector_pages WHERE state_value = 'ca' AND slug = 'rideshare'",
    matchCount: 240,
    affectedPlacementCount: 1,
    tone: 'red',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'replace',
        blockType: 'hero',
        version: 'hero@v41',
        summary: 'California launch campaign A',
        hiddenLower: 'hero@v31',
      },
    ],
  },
  {
    id: 'eligible-conflict-b',
    name: 'CA campaign B',
    priority: 40,
    selector: "country = 'US' AND state = 'ca'",
    selectorSql: "SELECT page_id FROM selector_pages WHERE country = 'US' AND state_value = 'ca'",
    matchCount: 720,
    affectedPlacementCount: 1,
    tone: 'red',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'replace',
        blockType: 'hero',
        version: 'hero@v42',
        summary: 'California launch campaign B',
        hiddenLower: 'hero@v31',
      },
    ],
  },
];

const structuralLayers: VariantLayer[] = [
  {
    id: 'structural-default',
    name: 'Template default',
    priority: 0,
    selector: 'All airport pages',
    selectorSql: 'SELECT page_id FROM selector_pages WHERE template_id = :template_id',
    matchCount: 3_280,
    affectedPlacementCount: 24,
    tone: 'neutral',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'insert',
        blockType: 'hero',
        version: 'hero@v51',
        summary: 'Your airport ride, ready when you are',
      },
      {
        placementKey: 'seasonal-promo',
        kind: 'insert',
        blockType: 'promo',
        version: 'promo@v24',
        summary: 'Seasonal airport savings',
      },
    ],
  },
  {
    id: 'structural-premium',
    name: 'Premium airports',
    priority: 10,
    selector: "tag.market_tier = 'premium'",
    selectorSql:
      "SELECT page_id FROM selector_page_tags WHERE tag_key = 'market_tier' AND tag_value = 'premium'",
    matchCount: 420,
    affectedPlacementCount: 1,
    tone: 'blue',
    operations: [
      {
        placementKey: 'service-proof',
        kind: 'replace',
        blockType: 'proof_grid',
        version: 'proof@v8',
        summary: 'Premium pickup service proof',
        hiddenLower: 'proof@v6',
      },
    ],
  },
  {
    id: 'structural-hero-alt',
    name: 'Hero alt experiment',
    priority: 30,
    selector: "airport_code IN ('LAX', 'SFO', 'JFK')",
    selectorSql: "SELECT page_id FROM selector_pages WHERE airport_code IN ('LAX', 'SFO', 'JFK')",
    matchCount: 180,
    affectedPlacementCount: 2,
    tone: 'purple',
    operations: [
      {
        placementKey: 'primary-hero',
        kind: 'replace',
        blockType: 'hero_alt',
        version: 'hero_alt@v3',
        summary: 'Split-layout airport hero with pickup map',
        hiddenLower: 'hero@v51',
      },
      {
        placementKey: 'seasonal-promo',
        kind: 'hide',
        blockType: 'promo',
        version: 'tombstone@v2',
        summary: 'Hidden for airport experiment',
        hiddenLower: 'promo@v24',
      },
    ],
  },
];

export const scenarioFixtures: ScenarioFixture[] = [
  {
    id: 'stores',
    name: 'Store pages',
    shortName: 'Store',
    domain: 'www.ubereats.com',
    pattern: '/{locale}/store/{store_id}',
    description:
      'One million concrete store URLs share a default document while sparse brand, category, and store-type sheets contribute only where they match.',
    dimensions: [
      {
        id: 'locale',
        label: 'Locale',
        kind: 'path',
        values: ['en-US', 'es-US', 'fr-CA'],
        description: 'Parsed from the canonical URL.',
      },
      {
        id: 'store_id',
        label: 'Store ID',
        kind: 'path',
        values: ['1234', '4820', '9021'],
        description: 'Stable route identity from RouterService.',
      },
      {
        id: 'brand',
        label: 'Brand',
        kind: 'tag',
        values: ["McDonald's", 'Burger King', 'Independent'],
        description: 'Indexed selector tag.',
      },
      {
        id: 'category',
        label: 'Category',
        kind: 'tag',
        values: ['Fast food', 'Grocery', 'Retail'],
        description: 'Indexed selector tag.',
      },
      {
        id: 'store_type',
        label: 'Store type',
        kind: 'tag',
        values: ['Chain store', 'Independent'],
        description: 'Independent indexed tag membership; never inferred from the brand tag.',
      },
      {
        id: 'channel',
        label: 'Channel',
        kind: 'static',
        values: ['Web'],
        description: 'Constant for this template.',
      },
    ],
    instanceCount: 1_000_000,
    variantCount: 5,
    publicationState: 'Published',
    conflictState: 'Clear',
    lastPublished: '18 min ago',
    inheritance: 96,
    preview: 'sparse',
    scaleCue: 'millions',
    layers: storeLayers,
    projectionPoints: makePoints('store', 28, (index) => {
      if (index % 7 === 0)
        return ['store-default', 'store-chain', 'store-fast-food', 'store-mcdonalds'];
      if (index % 5 === 0)
        return ['store-default', 'store-chain', 'store-fast-food', 'store-burger-king'];
      if (index % 3 === 0) return ['store-default', 'store-chain'];
      return ['store-default'];
    }),
    defaultAxes: ['brand', 'locale'],
    pin: {
      id: 'store-1234',
      canonicalUrl: '/en-US/store/1234',
      dimensions: [
        { key: 'locale', value: 'en-US', kind: 'path' },
        { key: 'store_id', value: '1234', kind: 'path' },
      ],
      tags: ['store_type:chain_store', 'category:fast_food', 'brand:mcdonalds'],
      matchingLayerIds: ['store-default', 'store-chain', 'store-fast-food', 'store-mcdonalds'],
      placements: [
        {
          placementKey: 'primary-hero',
          order: 1,
          blockType: 'hero',
          publishedValue: 'I am McDonald’s — Market Street',
          draftValue: 'Buy now McDonald’s — Market Street',
          diff: 'changed',
          winningLayerId: 'store-mcdonalds',
          version: 'hero@v18',
          provenance: ['store-default → hero@v12', 'store-mcdonalds → hero@v18'],
          hiddenLower: 'hero@v12',
        },
        {
          placementKey: 'category-promo',
          order: 2,
          blockType: 'promo',
          publishedValue: 'Local favorites, delivered',
          draftValue: 'Fast favorites in under 30 minutes',
          diff: 'changed',
          winningLayerId: 'store-fast-food',
          version: 'promo@v11',
          provenance: ['store-default → promo@v7', 'store-fast-food → promo@v11'],
          hiddenLower: 'promo@v7',
        },
        {
          placementKey: 'value-proof',
          order: 3,
          blockType: 'proof_grid',
          publishedValue: 'Transparent fees and live tracking',
          draftValue: 'Transparent fees and live tracking',
          diff: 'same',
          winningLayerId: 'store-default',
          version: 'proof@v5',
          provenance: ['store-default → proof@v5'],
        },
        {
          placementKey: 'footer',
          order: 4,
          blockType: 'footer',
          publishedValue: 'Default marketplace footer',
          draftValue: 'Chain availability and franchise terms',
          diff: 'changed',
          winningLayerId: 'store-chain',
          version: 'footer@v9',
          provenance: ['store-default → footer@v4', 'store-chain → footer@v9'],
          hiddenLower: 'footer@v4',
        },
      ],
    },
    requestCases: makeRequestCases('store', '/en-US/store/1234'),
    publications: makePublications('store', 1_000_000),
  },
  {
    id: 'eligible-vehicles',
    name: 'Eligible vehicles',
    shortName: 'Eligible Vehicles',
    domain: 'www.uber.com',
    pattern: '/{locale}/eligible-vehicles/{state}/{slug}',
    description:
      'Dense locale, state, language, and purpose variation pressure-tests explicit precedence and same-priority conflict blocking.',
    dimensions: [
      {
        id: 'locale',
        label: 'Locale',
        kind: 'path',
        values: ['en-US', 'es-US', 'fr-CA'],
        description: 'Parsed from the canonical URL.',
      },
      {
        id: 'state',
        label: 'State',
        kind: 'path',
        values: ['ca', 'ny', 'tx'],
        description: 'Parsed from the canonical URL.',
      },
      {
        id: 'slug',
        label: 'Purpose',
        kind: 'path',
        values: ['rideshare', 'delivery', 'premium'],
        description: 'Page intent from the canonical URL.',
      },
      {
        id: 'country',
        label: 'Country',
        kind: 'derived',
        values: ['US', 'CA'],
        description: 'Derived from locale and route territory.',
      },
      {
        id: 'language',
        label: 'Language',
        kind: 'derived',
        values: ['en', 'es', 'fr'],
        description: 'Normalized locale language.',
      },
      {
        id: 'campaign',
        label: 'Campaign',
        kind: 'tag',
        values: ['launch-a', 'launch-b'],
        description: 'Indexed content campaign tag.',
      },
    ],
    instanceCount: 8_640,
    variantCount: 96,
    publicationState: 'Ready to publish',
    conflictState: '2 conflicts',
    lastPublished: 'Yesterday, 16:42',
    inheritance: 38,
    preview: 'dense',
    scaleCue: 'thousands',
    layers: eligibleLayers,
    projectionPoints: makePoints('eligible', 36, (index) => {
      const ids = ['eligible-default'];
      if (index % 2 === 0) ids.push('eligible-spanish');
      if (index % 3 === 0) ids.push('eligible-california');
      if (index % 4 === 0) ids.push('eligible-rideshare');
      if (index % 9 === 0) ids.push('eligible-conflict-a', 'eligible-conflict-b');
      return ids;
    }),
    defaultAxes: ['state', 'slug'],
    pin: {
      id: 'eligible-ca-rideshare',
      canonicalUrl: '/en-US/eligible-vehicles/ca/rideshare',
      dimensions: [
        { key: 'locale', value: 'en-US', kind: 'path' },
        { key: 'state', value: 'ca', kind: 'path' },
        { key: 'slug', value: 'rideshare', kind: 'path' },
        { key: 'country', value: 'US', kind: 'derived' },
      ],
      tags: ['campaign:launch-a', 'campaign:launch-b'],
      matchingLayerIds: [
        'eligible-default',
        'eligible-california',
        'eligible-rideshare',
        'eligible-conflict-a',
        'eligible-conflict-b',
      ],
      placements: [
        {
          placementKey: 'primary-hero',
          order: 1,
          blockType: 'hero',
          publishedValue: 'Drive with confidence',
          draftValue: 'Blocked: two priority-40 winners',
          diff: 'changed',
          winningLayerId: 'eligible-conflict-a',
          version: 'conflict',
          provenance: [
            'eligible-default → hero@v31',
            'eligible-conflict-a → hero@v41',
            'eligible-conflict-b → hero@v42',
          ],
          hiddenLower: 'hero@v31',
        },
        {
          placementKey: 'eligibility-table',
          order: 2,
          blockType: 'vehicle_table',
          publishedValue: 'General eligible vehicle table',
          draftValue: 'Rideshare vehicle classes and year thresholds',
          diff: 'changed',
          winningLayerId: 'eligible-rideshare',
          version: 'table@v15',
          provenance: ['eligible-default → table@v9', 'eligible-rideshare → table@v15'],
          hiddenLower: 'table@v9',
        },
        {
          placementKey: 'legal-notice',
          order: 3,
          blockType: 'legal_notice',
          publishedValue: 'US eligibility disclosure',
          draftValue: 'California-specific eligibility and disclosure',
          diff: 'changed',
          winningLayerId: 'eligible-california',
          version: 'legal@v22',
          provenance: ['eligible-default → legal@v19', 'eligible-california → legal@v22'],
          hiddenLower: 'legal@v19',
        },
      ],
    },
    requestCases: makeRequestCases('eligible', '/en-US/eligible-vehicles/ca/rideshare'),
    publications: makePublications('eligible', 8_640),
  },
  {
    id: 'structural-proof',
    name: 'Structural replacement proof',
    shortName: 'Structural',
    domain: 'www.uber.com',
    pattern: '/{locale}/airport/{slug}',
    description:
      'A 24-placement template proves that one selector can replace the hero block type and hide a promo while retaining more than 90% inheritance.',
    dimensions: [
      {
        id: 'locale',
        label: 'Locale',
        kind: 'path',
        values: ['en-US', 'es-US'],
        description: 'Parsed from the canonical URL.',
      },
      {
        id: 'slug',
        label: 'Airport slug',
        kind: 'path',
        values: ['lax', 'sfo', 'jfk'],
        description: 'Stable airport route slug.',
      },
      {
        id: 'airport_code',
        label: 'Airport code',
        kind: 'derived',
        values: ['LAX', 'SFO', 'JFK'],
        description: 'Canonical code derived from the route entity.',
      },
      {
        id: 'market_tier',
        label: 'Market tier',
        kind: 'tag',
        values: ['premium', 'standard'],
        description: 'Indexed commercial market tag.',
      },
      {
        id: 'channel',
        label: 'Channel',
        kind: 'static',
        values: ['Web'],
        description: 'Constant for this template.',
      },
    ],
    instanceCount: 3_280,
    variantCount: 4,
    publicationState: 'Draft',
    conflictState: 'Unchecked',
    lastPublished: 'Aug 26, 09:12',
    inheritance: 92,
    preview: 'structural',
    scaleCue: 'thousands',
    layers: structuralLayers,
    projectionPoints: makePoints('structural', 24, (index) => {
      if (index % 6 === 0)
        return ['structural-default', 'structural-premium', 'structural-hero-alt'];
      if (index % 3 === 0) return ['structural-default', 'structural-premium'];
      return ['structural-default'];
    }),
    defaultAxes: ['airport_code', 'market_tier'],
    pin: {
      id: 'airport-lax',
      canonicalUrl: '/en-US/airport/lax',
      dimensions: [
        { key: 'locale', value: 'en-US', kind: 'path' },
        { key: 'slug', value: 'lax', kind: 'path' },
        { key: 'airport_code', value: 'LAX', kind: 'derived' },
      ],
      tags: ['market_tier:premium'],
      matchingLayerIds: ['structural-default', 'structural-premium', 'structural-hero-alt'],
      placements: [
        {
          placementKey: 'primary-hero',
          order: 1,
          blockType: 'hero_alt',
          publishedValue: 'Your airport ride, ready when you are',
          draftValue: 'Split-layout airport hero with pickup map',
          diff: 'changed',
          winningLayerId: 'structural-hero-alt',
          version: 'hero_alt@v3',
          provenance: ['structural-default → hero@v51', 'structural-hero-alt → hero_alt@v3'],
          hiddenLower: 'hero@v51',
        },
        {
          placementKey: 'service-proof',
          order: 2,
          blockType: 'proof_grid',
          publishedValue: 'Reliable airport pickup',
          draftValue: 'Premium pickup service proof',
          diff: 'changed',
          winningLayerId: 'structural-premium',
          version: 'proof@v8',
          provenance: ['structural-default → proof@v6', 'structural-premium → proof@v8'],
          hiddenLower: 'proof@v6',
        },
        {
          placementKey: 'seasonal-promo',
          order: 3,
          blockType: 'promo',
          publishedValue: 'Seasonal airport savings',
          draftValue: 'Hidden by tombstone',
          diff: 'hidden',
          winningLayerId: 'structural-hero-alt',
          version: 'tombstone@v2',
          provenance: ['structural-default → promo@v24', 'structural-hero-alt → tombstone@v2'],
          hiddenLower: 'promo@v24',
        },
      ],
    },
    requestCases: makeRequestCases('structural', '/en-US/airport/lax'),
    publications: makePublications('structural', 3_280),
  },
];

export function getScenarioFixture(id: ScenarioId): ScenarioFixture {
  const scenario = scenarioFixtures.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown CMS proof scenario: ${id}`);
  return scenario;
}

export function listScenarioFixtures(query: string, pageIndex: number, pageSize: number) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = normalizedQuery
    ? scenarioFixtures.filter((scenario) =>
        [scenario.name, scenario.domain, scenario.pattern, scenario.description]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      )
    : scenarioFixtures;
  const boundedPageSize = Math.max(1, Math.min(pageSize, 12));
  const pageCount = Math.max(1, Math.ceil(matches.length / boundedPageSize));
  const safePageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));

  return {
    rows: matches.slice(safePageIndex * boundedPageSize, (safePageIndex + 1) * boundedPageSize),
    rowCount: matches.length,
    pageCount,
    pageIndex: safePageIndex,
  };
}

export function getInstancePage(
  scenario: ScenarioFixture,
  pageIndex: number,
  pageSize: number
): { rows: InstanceRow[]; rowCount: number; pageCount: number; pageIndex: number } {
  const boundedPageSize = Math.max(1, Math.min(pageSize, 10));
  const pageCount = Math.max(1, Math.ceil(scenario.instanceCount / boundedPageSize));
  const safePageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));
  const offset = safePageIndex * boundedPageSize;
  const count = Math.min(boundedPageSize, scenario.instanceCount - offset);
  const rows = Array.from({ length: count }, (_, rowIndex): InstanceRow => {
    const absoluteIndex = offset + rowIndex;

    if (scenario.id === 'stores') {
      const isMcDonalds = absoluteIndex % 7 === 0;
      const isBurgerKing = absoluteIndex % 5 === 0 && !isMcDonalds;
      const brand = isMcDonalds ? 'mcdonalds' : isBurgerKing ? 'burger_king' : 'independent';
      const isFastFood = isMcDonalds || isBurgerKing;
      const isChain = isFastFood || absoluteIndex % 3 === 0;
      const locale = absoluteIndex > 0 && absoluteIndex % 13 === 0 ? 'es-US' : 'en-US';
      const lifecycle =
        absoluteIndex > 0 && absoluteIndex % 47 === 0
          ? 'archived'
          : absoluteIndex > 0 && absoluteIndex % 23 === 0
            ? 'not_live'
            : 'live';
      const matchingLayerIds = ['store-default'];
      if (isChain) matchingLayerIds.push('store-chain');
      if (isFastFood) matchingLayerIds.push('store-fast-food');
      if (isMcDonalds) matchingLayerIds.push('store-mcdonalds');
      if (isBurgerKing) matchingLayerIds.push('store-burger-king');
      const tags = [
        `store_type:${isChain ? 'chain_store' : 'independent'}`,
        `category:${isFastFood ? 'fast_food' : 'local'}`,
        `brand:${brand}`,
      ];
      return {
        id: `store-${absoluteIndex + 1}`,
        canonicalUrl: `/${locale}/store/${absoluteIndex + 1234}`,
        lifecycle,
        auteurState:
          absoluteIndex % 29 === 13 ? 'missing' : lifecycle === 'live' ? 'published' : 'draft_only',
        dimensions: [
          { key: 'locale', value: locale, kind: 'path' },
          { key: 'store_id', value: String(absoluteIndex + 1234), kind: 'path' },
        ],
        dimensionSummary: `${locale} · store ${absoluteIndex + 1234}`,
        tags,
        matchingLayerIds,
        matchedLayers: matchingLayerIds.length,
        conflict: false,
      };
    }

    if (scenario.id === 'eligible-vehicles') {
      const states = ['ca', 'ny', 'tx'] as const;
      const purposes = ['rideshare', 'delivery', 'premium'] as const;
      const state = states[absoluteIndex % states.length] ?? 'ca';
      const purpose =
        purposes[Math.floor(absoluteIndex / states.length) % purposes.length] ?? 'rideshare';
      const locale = absoluteIndex > 0 && absoluteIndex % 4 === 0 ? 'es-US' : 'en-US';
      const language = locale.startsWith('es') ? 'es' : 'en';
      const conflict = state === 'ca' && purpose === 'rideshare';
      const lifecycle =
        absoluteIndex > 0 && absoluteIndex % 41 === 0 ? 'not_live' : ('live' as const);
      const matchingLayerIds = ['eligible-default'];
      if (language === 'es') matchingLayerIds.push('eligible-spanish');
      if (state === 'ca') matchingLayerIds.push('eligible-california');
      if (purpose === 'rideshare') matchingLayerIds.push('eligible-rideshare');
      if (conflict) matchingLayerIds.push('eligible-conflict-a', 'eligible-conflict-b');
      return {
        id: `eligible-${absoluteIndex + 1}`,
        canonicalUrl:
          absoluteIndex === 0
            ? '/en-US/eligible-vehicles/ca/rideshare'
            : `/${locale}/eligible-vehicles/${state}/${purpose}-${absoluteIndex + 1}`,
        lifecycle,
        auteurState:
          absoluteIndex % 31 === 17 ? 'missing' : lifecycle === 'live' ? 'published' : 'draft_only',
        dimensions: [
          { key: 'locale', value: locale, kind: 'path' },
          { key: 'state', value: state, kind: 'path' },
          { key: 'slug', value: purpose, kind: 'path' },
          { key: 'country', value: 'US', kind: 'derived' },
          { key: 'language', value: language, kind: 'derived' },
        ],
        dimensionSummary: `${locale} · ${state.toUpperCase()} · ${purpose}`,
        tags: conflict ? ['campaign:launch-a', 'campaign:launch-b'] : ['audience:driver'],
        matchingLayerIds,
        matchedLayers: matchingLayerIds.length,
        conflict,
      };
    }

    const airports = ['lax', 'sfo', 'jfk', 'sea'] as const;
    const airport = airports[absoluteIndex % airports.length] ?? 'lax';
    const isExperiment = airport !== 'sea';
    const lifecycle =
      absoluteIndex > 0 && absoluteIndex % 19 === 0 ? 'archived' : ('live' as const);
    const matchingLayerIds = ['structural-default'];
    if (isExperiment) matchingLayerIds.push('structural-premium', 'structural-hero-alt');
    return {
      id: `airport-${absoluteIndex + 1}`,
      canonicalUrl:
        absoluteIndex === 0
          ? '/en-US/airport/lax'
          : `/en-US/airport/${airport}-${absoluteIndex + 1}`,
      lifecycle,
      auteurState:
        absoluteIndex % 43 === 11 ? 'missing' : lifecycle === 'live' ? 'published' : 'draft_only',
      dimensions: [
        { key: 'locale', value: 'en-US', kind: 'path' },
        { key: 'slug', value: airport, kind: 'path' },
        { key: 'airport_code', value: airport.toUpperCase(), kind: 'derived' },
      ],
      dimensionSummary: `en-US · ${airport.toUpperCase()} · ${isExperiment ? 'premium' : 'standard'}`,
      tags: [`market_tier:${isExperiment ? 'premium' : 'standard'}`],
      matchingLayerIds,
      matchedLayers: matchingLayerIds.length,
      conflict: false,
    };
  });

  return { rows, rowCount: scenario.instanceCount, pageCount, pageIndex: safePageIndex };
}

export function projectionPointMatchesFilters(
  scenario: ScenarioFixture,
  point: ProjectionPoint,
  filters: Readonly<Record<string, string>>
): boolean {
  return Object.entries(filters).every(([dimensionId, selectedValue]) => {
    if (!selectedValue) return true;
    const dimension = scenario.dimensions.find((candidate) => candidate.id === dimensionId);
    if (!dimension) return false;
    const selectedIndex = dimension.values.indexOf(selectedValue);
    if (selectedIndex < 0) return false;
    return point.instanceOffset % dimension.values.length === selectedIndex;
  });
}

function versionFromProvenance(placement: EffectivePlacement): string {
  const firstEntry = placement.provenance[0];
  return firstEntry?.split('→')[1]?.trim() ?? placement.version;
}

export function resolveFixturePlacements(
  scenario: ScenarioFixture,
  matchingLayerIds: readonly string[]
): EffectivePlacement[] {
  const defaultLayer = scenario.layers.find((layer) => layer.priority === 0);
  const placements = new Map<string, EffectivePlacement>();

  for (const placement of scenario.pin.placements) {
    const defaultOperation = defaultLayer?.operations.find(
      (operation) => operation.placementKey === placement.placementKey
    );
    const version = defaultOperation?.version ?? versionFromProvenance(placement);
    placements.set(placement.placementKey, {
      ...placement,
      publishedValue: placement.publishedValue,
      draftValue: defaultOperation?.summary ?? placement.publishedValue,
      diff: 'same',
      winningLayerId: defaultLayer?.id ?? placement.winningLayerId,
      version,
      provenance: [`${defaultLayer?.id ?? 'default'} → ${version}`],
      hiddenLower: undefined,
    });
  }

  const matchingLayers = scenario.layers
    .filter((layer) => layer.priority > 0 && matchingLayerIds.includes(layer.id))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  const conflictGroups = new Map<
    string,
    Array<{ layer: VariantLayer; operation: LayerOperation }>
  >();

  for (const layer of matchingLayers) {
    for (const operation of layer.operations) {
      const conflictKey = `${layer.priority}:${operation.placementKey}`;
      const claims = conflictGroups.get(conflictKey) ?? [];
      claims.push({ layer, operation });
      conflictGroups.set(conflictKey, claims);

      const current = placements.get(operation.placementKey);
      if (operation.kind === 'hide') {
        if (!current) continue;
        placements.set(operation.placementKey, {
          ...current,
          draftValue: 'Hidden by tombstone',
          diff: 'hidden',
          winningLayerId: layer.id,
          version: operation.version,
          provenance: [...current.provenance, `${layer.id} → ${operation.version} (tombstone)`],
          hiddenLower: current.version,
        });
        continue;
      }

      if (operation.kind === 'inherit') continue;
      const nextOrder = current?.order ?? placements.size + 1;
      placements.set(operation.placementKey, {
        placementKey: operation.placementKey,
        order: nextOrder,
        blockType: operation.blockType,
        publishedValue: current?.publishedValue ?? 'Not present in the active publication',
        draftValue: operation.summary,
        diff: current ? 'changed' : 'added',
        winningLayerId: layer.id,
        version: operation.version,
        provenance: [
          ...(current?.provenance ?? []),
          `${layer.id} → ${operation.version} (${operation.kind})`,
        ],
        hiddenLower: current?.version,
      });
    }
  }

  for (const claims of conflictGroups.values()) {
    if (claims.length < 2) continue;
    const placementKey = claims[0]?.operation.placementKey;
    if (!placementKey) continue;
    const current = placements.get(placementKey);
    if (!current) continue;
    placements.set(placementKey, {
      ...current,
      draftValue: `Blocked: ${claims.length} same-priority operations`,
      diff: 'changed',
      winningLayerId: 'unresolved conflict',
      version: 'conflict',
      provenance: claims.map(
        ({ layer, operation }) => `${layer.id} → ${operation.version} (priority ${layer.priority})`
      ),
    });
  }

  return [...placements.values()].sort(
    (left, right) => left.order - right.order || left.placementKey.localeCompare(right.placementKey)
  );
}
