import type { CmsDatabaseClient } from '@repo/cms-db';
import { canonicalHash, type JsonObject } from '@repo/cms-domain';
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
