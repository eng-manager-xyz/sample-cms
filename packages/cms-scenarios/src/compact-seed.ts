import type { CmsDatabaseClient } from '@repo/cms-db';
import { canonicalHash, type JsonObject } from '@repo/cms-domain';
import { CmsService, CmsServiceError } from '@repo/cms-service';

const SEED_ACTOR = 'compact-scenario-seed';
const SEED_NOW = '2026-01-04T00:00:00.000Z';

const STORE_EXPLORER_PAGES = [
  {
    id: 'page-store-1003',
    storeId: 1003,
    locale: 'en-CA',
    name: 'Maple Market',
    location: 'Toronto',
  },
  {
    id: 'page-store-1004',
    storeId: 1004,
    locale: 'en-US',
    name: 'Sunrise Deli',
    location: 'Seattle',
  },
  {
    id: 'page-store-1005',
    storeId: 1005,
    locale: 'es-US',
    name: 'Cocina Mission',
    location: 'San Francisco',
  },
  {
    id: 'page-store-1006',
    storeId: 1006,
    locale: 'fr-CA',
    name: 'Marché du Plateau',
    location: 'Montréal',
  },
  {
    id: 'page-store-1007',
    storeId: 1007,
    locale: 'en-US',
    name: 'Lakeside Grill',
    location: 'Chicago',
  },
  {
    id: 'page-store-1008',
    storeId: 1008,
    locale: 'es-US',
    name: 'Tacos del Sol',
    location: 'Los Angeles',
  },
  {
    id: 'page-store-1009',
    storeId: 1009,
    locale: 'en-CA',
    name: 'Pacific Pantry',
    location: 'Vancouver',
  },
  {
    id: 'page-store-1010',
    storeId: 1010,
    locale: 'fr-CA',
    name: 'Café du Canal',
    location: 'Montréal',
  },
  {
    id: 'page-store-1011',
    storeId: 1011,
    locale: 'en-US',
    name: 'Desert Kitchen',
    location: 'Phoenix',
  },
  {
    id: 'page-store-1012',
    storeId: 1012,
    locale: 'es-US',
    name: 'Casa Verde',
    location: 'Austin',
  },
  {
    id: 'page-store-1013',
    storeId: 1013,
    locale: 'en-CA',
    name: 'Prairie Table',
    location: 'Calgary',
  },
  {
    id: 'page-store-1014',
    storeId: 1014,
    locale: 'fr-CA',
    name: 'Boulangerie du Vieux-Port',
    location: 'Québec',
  },
] as const;

const ELIGIBLE_EXPLORER_PAGES = [
  { locale: 'en-US', state: 'CA', purpose: 'delivery', country: 'US', language: 'en' },
  { locale: 'en-US', state: 'NY', purpose: 'rideshare', country: 'US', language: 'en' },
  { locale: 'en-US', state: 'TX', purpose: 'premium', country: 'US', language: 'en' },
  { locale: 'es-US', state: 'CA', purpose: 'rideshare', country: 'US', language: 'es' },
  { locale: 'es-US', state: 'NY', purpose: 'delivery', country: 'US', language: 'es' },
  { locale: 'es-US', state: 'TX', purpose: 'premium', country: 'US', language: 'es' },
  { locale: 'en-CA', state: 'BC', purpose: 'delivery', country: 'CA', language: 'en' },
  { locale: 'en-CA', state: 'ON', purpose: 'premium', country: 'CA', language: 'en' },
  { locale: 'en-CA', state: 'QC', purpose: 'rideshare', country: 'CA', language: 'en' },
  { locale: 'fr-CA', state: 'BC', purpose: 'premium', country: 'CA', language: 'fr' },
  { locale: 'fr-CA', state: 'ON', purpose: 'delivery', country: 'CA', language: 'fr' },
  { locale: 'fr-CA', state: 'QC', purpose: 'rideshare', country: 'CA', language: 'fr' },
] as const;

const STRUCTURAL_EXPLORER_PAGES = [
  { locale: 'en-US', slug: 'sea-tac', airportCode: 'SEA' },
  { locale: 'en-US', slug: 'chicago-ohare', airportCode: 'ORD' },
  { locale: 'en-US', slug: 'boston-logan', airportCode: 'BOS' },
  { locale: 'es-US', slug: 'miami', airportCode: 'MIA' },
  { locale: 'en-CA', slug: 'toronto-pearson', airportCode: 'YYZ' },
  { locale: 'fr-CA', slug: 'montreal-trudeau', airportCode: 'YUL' },
  { locale: 'en-GB', slug: 'heathrow', airportCode: 'LHR' },
  { locale: 'fr-FR', slug: 'charles-de-gaulle', airportCode: 'CDG' },
  { locale: 'de-DE', slug: 'brandenburg', airportCode: 'BER' },
  { locale: 'es-ES', slug: 'barajas', airportCode: 'MAD' },
  { locale: 'ja-JP', slug: 'haneda', airportCode: 'HND' },
  { locale: 'pt-BR', slug: 'guarulhos', airportCode: 'GRU' },
] as const;

const REQUIRED_STORE_PAGE_IDS = [
  'page-store-1001',
  'page-store-1002',
  ...STORE_EXPLORER_PAGES.map((page) => page.id),
] as const;
const REQUIRED_ELIGIBLE_PAGE_IDS = [
  'eligible:en-US:CA:premium',
  'eligible:es-US:TX:delivery',
  ...ELIGIBLE_EXPLORER_PAGES.map((page) => `eligible:${page.locale}:${page.state}:${page.purpose}`),
] as const;
const REQUIRED_STRUCTURAL_PAGE_IDS = [
  'structural-page:current',
  'structural-page:hero-alt',
  ...STRUCTURAL_EXPLORER_PAGES.map((page) => `structural-page:${page.slug}`),
] as const;

export const compactScenarioRegistry = {
  stores: {
    templateId: 'tpl-store',
    pageId: 'page-store-1001',
    canonicalUrl: '/en-US/store/1001',
    requiredVariantId: 'variant-store-chain',
    requiredPageIds: REQUIRED_STORE_PAGE_IDS,
    seedPublicationId: 'publication-store-2',
    seedIngestionId: 'ing-store-compact-2',
  },
  'eligible-vehicles': {
    templateId: 'eligible-vehicles',
    pageId: 'eligible:en-US:CA:premium',
    canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
    requiredVariantId: 'editable-eligible-exact',
    requiredPageIds: REQUIRED_ELIGIBLE_PAGE_IDS,
    seedPublicationId: 'editable-eligible-publication-2',
    seedIngestionId: null,
  },
  'structural-proof': {
    templateId: 'structural-marketing',
    pageId: 'structural-page:hero-alt',
    canonicalUrl: '/en-US/airport/hero-alt',
    requiredVariantId: 'editable-structural-hero-alt',
    requiredPageIds: REQUIRED_STRUCTURAL_PAGE_IDS,
    seedPublicationId: 'editable-structural-publication-2',
    seedIngestionId: null,
  },
} as const;

export type CompactScenarioId = keyof typeof compactScenarioRegistry;
export type CompactScenarioRegistration = (typeof compactScenarioRegistry)[CompactScenarioId];

function deterministicService(client: CmsDatabaseClient, templateId: string): CmsService {
  const idsByScope = new Map<string, number>();
  return new CmsService(client, {
    now: () => SEED_NOW,
    createId: (scope) => {
      const sequence = (idsByScope.get(scope) ?? 0) + 1;
      idsByScope.set(scope, sequence);
      return `${templateId}:seed:${scope}:${sequence}`;
    },
  });
}

function eligibleCustomizedContent(blockTypeKey: string, placementKey: string): JsonObject {
  if (blockTypeKey === 'navigation') return { label: 'California premium' };
  if (blockTypeKey === 'hero') return { headline: 'Premium rideshare vehicles in California' };
  if (blockTypeKey === 'footer') return { legal: `CA premium · ${placementKey}` };
  return { message: `CA premium · ${placementKey}` };
}

function structuralDefaultContent(blockTypeKey: string, placementKey: string): JsonObject {
  if (blockTypeKey === 'hero') return { headline: 'Airport rides made simple' };
  if (blockTypeKey === 'footer') return { legal: 'Airport product terms' };
  return { message: `Default ${placementKey}` };
}

function ensureHeroAltBlockType(client: CmsDatabaseClient, service: CmsService): void {
  const existing = client.sqlite
    .query<{ key: string }, []>("SELECT key FROM block_types WHERE key = 'hero_alt'")
    .get();
  if (existing) return;
  service.registerBlockType({
    id: 'block-type-hero-alt',
    key: 'hero_alt',
    name: 'Hero · split layout',
    schemaVersion: 1,
    schema: {
      type: 'object',
      required: ['headline', 'mapAssetKey'],
      properties: {
        headline: { type: 'string' },
        mapAssetKey: { type: 'string' },
      },
      additionalProperties: false,
    },
    previewRenderer: { kind: 'wireframe', component: 'hero_alt' },
  });
}

function createDefaultPlacement(
  service: CmsService,
  templateId: string,
  index: number,
  placementKey: string,
  blockTypeKey: 'navigation' | 'hero' | 'promo' | 'footer',
  content: JsonObject
): void {
  service.createDefaultPlacement(templateId, {
    revisionId: `${templateId}:default:r${index + 2}`,
    placementKey,
    lineage: {
      id: `${templateId}:lineage:${placementKey}`,
      key: placementKey,
      label: placementKey,
    },
    blockVersionId: `${templateId}:block:${placementKey}:v1`,
    blockTypeKey,
    content,
    createdBy: SEED_ACTOR,
    position: { kind: 'end' },
  });
}

function seedStoreExplorerPages(client: CmsDatabaseClient): void {
  const registration = compactScenarioRegistry.stores;
  const service = deterministicService(client, registration.templateId);
  const existingPageCount = STORE_EXPLORER_PAGES.filter((page) =>
    service.getPage(registration.templateId, page.id)
  ).length;
  if (existingPageCount === STORE_EXPLORER_PAGES.length) return;
  if (existingPageCount > 0) {
    throw new CmsServiceError(
      'CONFLICT',
      'The Store explorer page seed is partially initialized; reset and reseed the local database.'
    );
  }

  client.sqlite
    .transaction(() => {
      const ingestion = service.importRouterServiceRoutes({
        id: registration.seedIngestionId,
        templateId: registration.templateId,
        sourceRevision: 'store-compact-v2',
        observedAt: SEED_NOW,
        routes: STORE_EXPLORER_PAGES.map((page) => ({
          id: page.id,
          canonicalUrl: `/${page.locale}/store/${page.storeId}`,
          routeExternalId: `router-store-${page.storeId}`,
          routeStatus: 'live',
          routeRevision: 'store-compact-v2',
          context: {
            locale: page.locale,
            store: { id: page.storeId, name: page.name, location: page.location },
          },
          slotValues: {
            locale: page.locale,
            store: 'store',
            store_id: page.storeId,
            store_name: page.name,
          },
        })),
      });
      if (
        ingestion.idempotent ||
        ingestion.inserted !== STORE_EXPLORER_PAGES.length ||
        ingestion.rowCount !== STORE_EXPLORER_PAGES.length
      ) {
        throw new CmsServiceError(
          'CONFLICT',
          'The Store explorer page import did not insert the complete deterministic page set.'
        );
      }
      const publication = service.publish(registration.templateId, {
        id: registration.seedPublicationId,
        createdBy: SEED_ACTOR,
      });
      if (publication.pageCount !== registration.requiredPageIds.length) {
        throw new CmsServiceError(
          'CONFLICT',
          'The Store explorer publication did not materialize every required page.'
        );
      }
    })
    .immediate();
}

function createEligibleExplorerPage(
  service: CmsService,
  templateId: string,
  page: (typeof ELIGIBLE_EXPLORER_PAGES)[number]
): void {
  const id = `eligible:${page.locale}:${page.state}:${page.purpose}`;
  service.createPage(templateId, {
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

function createStructuralExplorerPage(
  service: CmsService,
  templateId: string,
  page: (typeof STRUCTURAL_EXPLORER_PAGES)[number]
): void {
  service.createPage(templateId, {
    id: `structural-page:${page.slug}`,
    canonicalUrl: `/${page.locale}/airport/${page.slug}`,
    routeExternalId: `router:structural:${page.slug}`,
    routeStatus: 'live',
    routeRevision: 'editable-structural-v1',
    context: { locale: page.locale, slug: page.slug, airportCode: page.airportCode },
    slotValues: {
      locale: page.locale,
      resource: 'airport',
      slug: page.slug,
      airport_code: page.airportCode,
    },
  });
}

function seedExistingExplorerPages(
  client: CmsDatabaseClient,
  scenarioId: 'eligible-vehicles' | 'structural-proof'
): void {
  const registration = compactScenarioRegistry[scenarioId];
  const service = deterministicService(client, registration.templateId);
  const pageIds =
    scenarioId === 'eligible-vehicles'
      ? ELIGIBLE_EXPLORER_PAGES.map(
          (page) => `eligible:${page.locale}:${page.state}:${page.purpose}`
        )
      : STRUCTURAL_EXPLORER_PAGES.map((page) => `structural-page:${page.slug}`);
  const missingPageIds = new Set(
    pageIds.filter((pageId) => !service.getPage(registration.templateId, pageId))
  );
  const seedPublication = publicationState(
    client,
    registration.templateId,
    registration.seedPublicationId
  );
  if (missingPageIds.size === 0 && seedPublication) return;
  if (seedPublication) {
    throw new CmsServiceError(
      'CONFLICT',
      `Compact scenario "${scenarioId}" has an immutable expansion publication without the complete page set.`
    );
  }

  client.sqlite
    .transaction(() => {
      if (scenarioId === 'eligible-vehicles') {
        for (const page of ELIGIBLE_EXPLORER_PAGES) {
          const pageId = `eligible:${page.locale}:${page.state}:${page.purpose}`;
          if (missingPageIds.has(pageId)) {
            createEligibleExplorerPage(service, registration.templateId, page);
          }
        }
      } else {
        for (const page of STRUCTURAL_EXPLORER_PAGES) {
          const pageId = `structural-page:${page.slug}`;
          if (missingPageIds.has(pageId)) {
            createStructuralExplorerPage(service, registration.templateId, page);
          }
        }
      }
      const publication = service.publish(registration.templateId, {
        id: registration.seedPublicationId,
        createdBy: SEED_ACTOR,
        forceNewPublication: true,
      });
      if (publication.pageCount !== registration.requiredPageIds.length) {
        throw new CmsServiceError(
          'CONFLICT',
          `Compact scenario "${scenarioId}" did not publish every explorer page.`
        );
      }
    })
    .immediate();
}

function seedEligibleVehicles(client: CmsDatabaseClient): void {
  const templateId = compactScenarioRegistry['eligible-vehicles'].templateId;
  const service = deterministicService(client, templateId);
  service.createTemplate({
    id: templateId,
    key: templateId,
    name: 'Eligible Vehicles',
    domain: 'www.uber.com',
    urlPattern: '/{locale}/eligible-vehicles/{state}/{slug}',
    description: 'Bounded editable workbench for the dense proof scenario.',
  });
  for (const slot of [
    {
      id: 'editable-eligible-slot-locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      pathPosition: 0,
    },
    {
      id: 'editable-eligible-slot-resource',
      key: 'resource',
      label: 'Resource',
      kind: 'static',
      pathPosition: 1,
      staticValue: 'eligible-vehicles',
    },
    {
      id: 'editable-eligible-slot-state',
      key: 'state',
      label: 'State',
      kind: 'variable',
      pathPosition: 2,
    },
    {
      id: 'editable-eligible-slot-slug',
      key: 'slug',
      label: 'Slug',
      kind: 'variable',
      pathPosition: 3,
    },
    { id: 'editable-eligible-slot-country', key: 'country', label: 'Country', kind: 'derived' },
    { id: 'editable-eligible-slot-language', key: 'language', label: 'Language', kind: 'derived' },
  ] as const) {
    service.createTemplateSlot(templateId, slot);
  }
  for (const page of [
    { locale: 'en-US', state: 'CA', purpose: 'premium', country: 'US', language: 'en' },
    { locale: 'es-US', state: 'TX', purpose: 'delivery', country: 'US', language: 'es' },
  ] as const) {
    const id = `eligible:${page.locale}:${page.state}:${page.purpose}`;
    service.createPage(templateId, {
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
  for (const page of ELIGIBLE_EXPLORER_PAGES) {
    createEligibleExplorerPage(service, templateId, page);
  }

  const placements = [
    ['navigation', 'navigation', { label: 'Eligible Vehicles' }],
    ['primary-hero', 'hero', { headline: 'Drive with Uber in {{ state }}' }],
    ['eligibility', 'promo', { message: 'Review local eligibility' }],
    ['requirements', 'promo', { message: 'Vehicle requirements' }],
    ['vehicle-list', 'promo', { message: 'Eligible vehicle list' }],
    ['legal-notice', 'footer', { legal: 'Local terms apply' }],
    ['footer', 'footer', { legal: 'Uber legal' }],
  ] as const;
  placements.forEach(([placementKey, blockTypeKey, content], index) => {
    createDefaultPlacement(service, templateId, index, placementKey, blockTypeKey, content);
  });

  const variantId = compactScenarioRegistry['eligible-vehicles'].requiredVariantId;
  service.createVariant(templateId, {
    id: variantId,
    revisionId: `${variantId}:r1`,
    key: 'ca-premium-exact',
    name: 'CA premium exact',
    priority: 40,
    status: 'active',
    selector: "country = 'US' AND state = 'ca' AND slug = 'premium'",
    createdBy: SEED_ACTOR,
    mode: 'linked',
  });
  placements.forEach(([placementKey, blockTypeKey], index) => {
    service.copyOnWritePlacement(templateId, variantId, 'eligible:en-US:CA:premium', placementKey, {
      revisionId: `${variantId}:r${index + 2}`,
      blockVersionId: `${templateId}:exact:${placementKey}:v2`,
      content: eligibleCustomizedContent(blockTypeKey, placementKey),
      createdBy: SEED_ACTOR,
    });
  });
  service.publish(templateId, {
    id: compactScenarioRegistry['eligible-vehicles'].seedPublicationId,
    createdBy: SEED_ACTOR,
  });
}

function seedStructuralProof(client: CmsDatabaseClient): void {
  const templateId = compactScenarioRegistry['structural-proof'].templateId;
  const service = deterministicService(client, templateId);
  ensureHeroAltBlockType(client, service);
  service.createTemplate({
    id: templateId,
    key: templateId,
    name: 'Structural replacement',
    domain: 'www.uber.com',
    urlPattern: '/{locale}/airport/{slug}',
    description: 'Bounded editable workbench with 24 default placements.',
  });
  for (const slot of [
    {
      id: 'editable-structural-slot-locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      pathPosition: 0,
    },
    {
      id: 'editable-structural-slot-resource',
      key: 'resource',
      label: 'Resource',
      kind: 'static',
      pathPosition: 1,
      staticValue: 'airport',
    },
    {
      id: 'editable-structural-slot-slug',
      key: 'slug',
      label: 'Slug',
      kind: 'variable',
      pathPosition: 2,
    },
    {
      id: 'editable-structural-slot-code',
      key: 'airport_code',
      label: 'Airport code',
      kind: 'derived',
    },
  ] as const) {
    service.createTemplateSlot(templateId, slot);
  }
  for (const page of [
    { locale: 'en-US', slug: 'current', airportCode: 'PDX' },
    { locale: 'en-US', slug: 'hero-alt', airportCode: 'LAX' },
  ] as const) {
    service.createPage(templateId, {
      id: `structural-page:${page.slug}`,
      canonicalUrl: `/${page.locale}/airport/${page.slug}`,
      routeExternalId: `router:structural:${page.slug}`,
      routeStatus: 'live',
      routeRevision: 'editable-structural-v1',
      context: { locale: page.locale, slug: page.slug, airportCode: page.airportCode },
      slotValues: {
        locale: page.locale,
        resource: 'airport',
        slug: page.slug,
        airport_code: page.airportCode,
      },
    });
  }
  for (const page of STRUCTURAL_EXPLORER_PAGES) {
    createStructuralExplorerPage(service, templateId, page);
  }

  const placementKeys = [
    'primary-hero',
    'announcement-promo',
    ...Array.from({ length: 21 }, (_, index) => `section-${String(index + 1).padStart(2, '0')}`),
    'footer',
  ];
  placementKeys.forEach((placementKey, index) => {
    const blockTypeKey =
      placementKey === 'primary-hero' ? 'hero' : placementKey === 'footer' ? 'footer' : 'promo';
    createDefaultPlacement(
      service,
      templateId,
      index,
      placementKey,
      blockTypeKey,
      structuralDefaultContent(blockTypeKey, placementKey)
    );
  });

  const variantId = compactScenarioRegistry['structural-proof'].requiredVariantId;
  service.createVariant(templateId, {
    id: variantId,
    revisionId: `${variantId}:r1`,
    key: 'hero-alt-airports',
    name: 'Hero alt airports',
    priority: 30,
    status: 'active',
    selector: "airport_code IN ('LAX', 'SFO', 'JFK')",
    createdBy: SEED_ACTOR,
    mode: 'linked',
  });
  service.copyOnWritePlacement(templateId, variantId, 'structural-page:hero-alt', 'primary-hero', {
    revisionId: `${variantId}:r2`,
    blockVersionId: `${templateId}:hero-alt:v2`,
    blockTypeKey: 'hero_alt',
    content: { headline: 'Plan your LAX pickup', mapAssetKey: 'lax-pickup-map' },
    createdBy: SEED_ACTOR,
  });
  service.tombstoneVariantPlacement(templateId, variantId, {
    revisionId: `${variantId}:r3`,
    placementKey: 'announcement-promo',
    createdBy: SEED_ACTOR,
  });
  service.publish(templateId, {
    id: compactScenarioRegistry['structural-proof'].seedPublicationId,
    createdBy: SEED_ACTOR,
  });
}

export function compactScenarioIsComplete(
  client: CmsDatabaseClient,
  scenarioId: CompactScenarioId
): boolean {
  const registration = compactScenarioRegistry[scenarioId];
  const service = new CmsService(client);
  try {
    if (
      !service.getTemplate(registration.templateId) ||
      !service.getPage(registration.templateId, registration.pageId) ||
      !registration.requiredPageIds.every((pageId) =>
        service.getPage(registration.templateId, pageId)
      )
    ) {
      return false;
    }
    const variants = service.listVariants(registration.templateId);
    const defaultVariant = variants.find((variant) => variant.isDefault);
    if (
      !defaultVariant?.activeRevisionId ||
      !variants.some((variant) => variant.id === registration.requiredVariantId)
    ) {
      return false;
    }
    const seedPublicationPages = client.sqlite
      .query<{ pageId: string }, [string, string]>(
        `SELECT page_instance_id AS pageId
         FROM published_page_documents
         WHERE template_id = ? AND publication_id = ?
         ORDER BY page_instance_id`
      )
      .all(registration.templateId, registration.seedPublicationId);
    const requiredPageIds = new Set(registration.requiredPageIds);
    if (
      seedPublicationPages.length !== requiredPageIds.size ||
      seedPublicationPages.some(({ pageId }) => !requiredPageIds.has(pageId))
    ) {
      return false;
    }
    if (registration.seedIngestionId) {
      const ingestion = client.sqlite
        .query<{ rowCount: number; status: string }, [string, string]>(
          `SELECT row_count AS rowCount, status
           FROM route_ingestions
           WHERE template_id = ? AND id = ?`
        )
        .get(registration.templateId, registration.seedIngestionId);
      if (ingestion?.status !== 'succeeded' || ingestion.rowCount !== STORE_EXPLORER_PAGES.length) {
        return false;
      }
    }
    const current = publicationState(client, registration.templateId);
    if (
      !current ||
      !publicationChainIsCompatible(client, service, registration.templateId, current)
    ) {
      return false;
    }
    return service.serve(registration.templateId, registration.canonicalUrl).status === 200;
  } catch {
    return false;
  }
}

interface PublicationState {
  readonly id: string;
  readonly previousPublicationId: string | null;
}

function publicationState(
  client: CmsDatabaseClient,
  templateId: string,
  publicationId?: string
): PublicationState | null {
  if (publicationId) {
    return (
      client.sqlite
        .query<PublicationState, [string, string]>(
          `SELECT id, previous_publication_id AS previousPublicationId
           FROM publications
           WHERE template_id = ? AND id = ? AND status = 'published'`
        )
        .get(templateId, publicationId) ?? null
    );
  }
  return (
    client.sqlite
      .query<PublicationState, [string]>(
        `SELECT publications.id,
                publications.previous_publication_id AS previousPublicationId
         FROM current_publications AS current
         JOIN publications
           ON publications.template_id = current.template_id
          AND publications.id = current.publication_id
         WHERE current.template_id = ? AND publications.status = 'published'`
      )
      .get(templateId) ?? null
  );
}

function publicationMaterializationIsCompatible(
  client: CmsDatabaseClient,
  service: CmsService,
  templateId: string,
  publicationId: string
): boolean {
  const publication = client.sqlite
    .query<{ pageCount: number }, [string, string]>(
      `SELECT page_count AS pageCount
       FROM publications
       WHERE template_id = ? AND id = ? AND status = 'published'`
    )
    .get(templateId, publicationId);
  if (!publication) return false;
  const pages = client.sqlite
    .query<{ canonicalUrl: string }, [string, string]>(
      `SELECT canonical_url AS canonicalUrl
       FROM published_page_documents
       WHERE template_id = ? AND publication_id = ?
       ORDER BY canonical_url, page_instance_id`
    )
    .all(templateId, publicationId);
  if (pages.length !== publication.pageCount) return false;
  try {
    return pages.every(({ canonicalUrl }) => {
      const result = service.resolvePublication(templateId, publicationId, canonicalUrl);
      return result.status === 200 && canonicalHash(result.document) === result.documentHash;
    });
  } catch {
    return false;
  }
}

function publicationChainIsCompatible(
  client: CmsDatabaseClient,
  service: CmsService,
  templateId: string,
  state: PublicationState
): boolean {
  return (
    publicationMaterializationIsCompatible(client, service, templateId, state.id) &&
    (state.previousPublicationId === null ||
      publicationMaterializationIsCompatible(
        client,
        service,
        templateId,
        state.previousPublicationId
      ))
  );
}

function upgradeCurrentManifestPublication(
  client: CmsDatabaseClient,
  registration: CompactScenarioRegistration
): void {
  const service = deterministicService(client, registration.templateId);
  const current = publicationState(client, registration.templateId);
  if (!current || publicationChainIsCompatible(client, service, registration.templateId, current)) {
    return;
  }

  const finalPublicationId = `${registration.templateId}:cel-materialized-current-v2`;
  const existingFinal = publicationState(client, registration.templateId, finalPublicationId);
  if (
    existingFinal &&
    publicationChainIsCompatible(client, service, registration.templateId, existingFinal)
  ) {
    service.rollback(registration.templateId, finalPublicationId, SEED_ACTOR);
    return;
  }
  if (existingFinal) {
    throw new CmsServiceError(
      'CONFLICT',
      `Compact scenario "${registration.templateId}" has an incompatible deterministic CEL reconciliation publication.`
    );
  }

  if (
    !publicationMaterializationIsCompatible(client, service, registration.templateId, current.id)
  ) {
    const rollbackPublicationId = `${registration.templateId}:cel-materialized-rollback-v2`;
    const legacyV1PublicationId = `${registration.templateId}:cel-materialized-publication-v1`;
    const existingAnchor = [rollbackPublicationId, legacyV1PublicationId].find((publicationId) =>
      publicationMaterializationIsCompatible(
        client,
        service,
        registration.templateId,
        publicationId
      )
    );
    if (existingAnchor) {
      service.rollback(registration.templateId, existingAnchor, SEED_ACTOR);
    } else {
      if (publicationState(client, registration.templateId, rollbackPublicationId)) {
        throw new CmsServiceError(
          'CONFLICT',
          `Compact scenario "${registration.templateId}" has an incompatible deterministic CEL rollback publication.`
        );
      }
      service.publish(registration.templateId, {
        id: rollbackPublicationId,
        createdBy: SEED_ACTOR,
        forceNewPublication: true,
      });
    }
  }

  const rollbackAnchor = publicationState(client, registration.templateId);
  if (
    !rollbackAnchor ||
    !publicationMaterializationIsCompatible(
      client,
      service,
      registration.templateId,
      rollbackAnchor.id
    )
  ) {
    throw new CmsServiceError(
      'CONFLICT',
      `Compact scenario "${registration.templateId}" could not materialize a rollback anchor.`
    );
  }
  service.publish(registration.templateId, {
    id: finalPublicationId,
    createdBy: SEED_ACTOR,
    forceNewPublication: true,
  });
  const reconciled = publicationState(client, registration.templateId);
  if (
    !reconciled ||
    !publicationChainIsCompatible(client, service, registration.templateId, reconciled)
  ) {
    throw new CmsServiceError(
      'CONFLICT',
      `Compact scenario "${registration.templateId}" did not produce a serveable CEL publication chain.`
    );
  }
}

export function ensureCompactPublishedScenario(
  client: CmsDatabaseClient,
  scenarioId: CompactScenarioId
): CompactScenarioRegistration {
  const registration = compactScenarioRegistry[scenarioId];
  const service = new CmsService(client);
  if (service.getTemplate(registration.templateId)) {
    if (scenarioId === 'stores') seedStoreExplorerPages(client);
    else seedExistingExplorerPages(client, scenarioId);
    upgradeCurrentManifestPublication(client, registration);
    if (!compactScenarioIsComplete(client, scenarioId)) {
      throw new CmsServiceError(
        'CONFLICT',
        `Compact scenario "${scenarioId}" is partially initialized; reset and reseed the local database.`
      );
    }
    return registration;
  }
  if (scenarioId === 'stores') {
    throw new CmsServiceError(
      'NOT_FOUND',
      'The Store foundation is missing. Run `bun run db:reset && bun run db:seed`.'
    );
  }
  client.sqlite
    .transaction(() => {
      if (scenarioId === 'eligible-vehicles') seedEligibleVehicles(client);
      else seedStructuralProof(client);
      if (!compactScenarioIsComplete(client, scenarioId)) {
        throw new CmsServiceError(
          'CONFLICT',
          `Compact scenario "${scenarioId}" did not satisfy its completion invariant.`
        );
      }
    })
    .immediate();
  return registration;
}

export function ensureCompactPublishedScenarios(
  client: CmsDatabaseClient
): typeof compactScenarioRegistry {
  for (const scenarioId of Object.keys(compactScenarioRegistry) as CompactScenarioId[]) {
    ensureCompactPublishedScenario(client, scenarioId);
  }
  return compactScenarioRegistry;
}
