import type { CmsDatabaseClient } from '@repo/cms-db';
import type { JsonObject } from '@repo/cms-domain';
import { CmsService, CmsServiceError } from '@repo/cms-service';

const SEED_ACTOR = 'compact-scenario-seed';
const SEED_NOW = '2026-01-04T00:00:00.000Z';

export const compactScenarioRegistry = {
  stores: {
    templateId: 'tpl-store',
    pageId: 'page-store-1001',
    canonicalUrl: '/en-US/store/1001',
    requiredVariantId: 'variant-store-chain',
  },
  'eligible-vehicles': {
    templateId: 'eligible-vehicles',
    pageId: 'eligible:en-US:CA:premium',
    canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
    requiredVariantId: 'editable-eligible-exact',
  },
  'structural-proof': {
    templateId: 'structural-marketing',
    pageId: 'structural-page:hero-alt',
    canonicalUrl: '/en-US/airport/hero-alt',
    requiredVariantId: 'editable-structural-hero-alt',
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
  service.createPage(templateId, {
    id: 'eligible:en-US:CA:premium',
    canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
    routeExternalId: 'camo:eligible:en-US:CA:premium',
    routeStatus: 'live',
    routeRevision: 'editable-eligible-v1',
    context: { locale: 'en-US', state: 'CA', purpose: 'premium', country: 'US' },
    slotValues: {
      locale: 'en-US',
      resource: 'eligible-vehicles',
      state: 'ca',
      slug: 'premium',
      country: 'US',
      language: 'en',
    },
  });
  service.createPage(templateId, {
    id: 'eligible:es-US:TX:delivery',
    canonicalUrl: '/es-US/eligible-vehicles/tx/delivery',
    routeExternalId: 'camo:eligible:es-US:TX:delivery',
    routeStatus: 'live',
    routeRevision: 'editable-eligible-v1',
    context: { locale: 'es-US', state: 'TX', purpose: 'delivery', country: 'US' },
    slotValues: {
      locale: 'es-US',
      resource: 'eligible-vehicles',
      state: 'tx',
      slug: 'delivery',
      country: 'US',
      language: 'es',
    },
  });

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
    id: 'editable-eligible-publication-1',
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
  for (const [slug, code] of [
    ['current', 'PDX'],
    ['hero-alt', 'LAX'],
  ] as const) {
    service.createPage(templateId, {
      id: `structural-page:${slug}`,
      canonicalUrl: `/en-US/airport/${slug}`,
      routeExternalId: `camo:structural:${slug}`,
      routeStatus: 'live',
      routeRevision: 'editable-structural-v1',
      context: { locale: 'en-US', slug, airportCode: code },
      slotValues: { locale: 'en-US', resource: 'airport', slug, airport_code: code },
    });
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
    id: 'editable-structural-publication-1',
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
      !service.getPage(registration.templateId, registration.pageId)
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
    const currentPublicationId = client.sqlite
      .query<{ publicationId: string }, [string]>(
        'SELECT publication_id AS publicationId FROM current_publications WHERE template_id = ?'
      )
      .get(registration.templateId)?.publicationId;
    if (!currentPublicationId) return false;
    return service.serve(registration.templateId, registration.canonicalUrl).status === 200;
  } catch {
    return false;
  }
}

export function ensureCompactPublishedScenario(
  client: CmsDatabaseClient,
  scenarioId: CompactScenarioId
): CompactScenarioRegistration {
  const registration = compactScenarioRegistry[scenarioId];
  const service = new CmsService(client);
  if (service.getTemplate(registration.templateId)) {
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
