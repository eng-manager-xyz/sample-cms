import {
  type CmsDatabaseClient,
  createCmsDatabase,
  resetDatabase,
  seedFoundationDatabase,
} from '@repo/cms-db';
import type { JsonObject, VariantOperation } from '@repo/cms-domain';
import { CmsService } from '@repo/cms-service';

import {
  buildDensePages,
  buildDenseVariants,
  type DenseVariant,
  denseDefaultDocument,
} from './dense';
import { structuralDefaultDocument, structuralVariantOperations } from './structural';

const FIXED_NOW = '2026-01-03T00:00:00.000Z';

export interface DensePersistenceEvidence {
  readonly templateId: 'eligible-vehicles';
  readonly pageCount: 24;
  readonly publicationPageCount: 24;
  readonly manifestCount: number;
  readonly exactPageId: string;
  readonly exactOverridesEveryPlacement: boolean;
  readonly exactMatchedRevisionIds: readonly string[];
  readonly selectorPlanUsesIndexedSlotLookup: boolean;
  readonly manifestItemsWithOperationProvenance: number;
  readonly conflictRejected: boolean;
  readonly conflictCode: string;
  readonly failedPublicationLeftPriorPointerActive: boolean;
  readonly failedPublicationLeftNoRows: boolean;
  readonly publicationEvidence: {
    readonly seedElapsedMilliseconds: number;
    readonly pageCount: number;
    readonly manifestCount: number;
    readonly rowsWritten: number;
    readonly estimatedStorageBytes: number;
    readonly logicalExpandedRenderedDocumentBytes: number;
    readonly durationMilliseconds: number;
    readonly persistedPublicationCount: number;
    readonly persistedPageDocumentCount: number;
    readonly persistedManifestCount: number;
    readonly persistedManifestItemCount: number;
    readonly allocatedBytesBeforePublication: number;
    readonly allocatedBytesAfterPublication: number;
    readonly storageDeltaBytes: number;
  };
}

export interface StructuralPersistenceEvidence {
  readonly templateId: 'structural-marketing';
  readonly defaultPlacementCount: 24;
  readonly effectivePlacementCount: 23;
  readonly inheritedPlacementCount: number;
  readonly inheritanceRatio: number;
  readonly meetsNinetyPercentInheritance: boolean;
  readonly stableHeroPlacementPreserved: boolean;
  readonly heroBlockType: 'hero_alt';
  readonly promoTombstoned: boolean;
  readonly structuralContractEvidence: {
    readonly heroAltRejectedHeroPayload: boolean;
    readonly heroAndHeroAltSchemasDiffer: boolean;
    readonly heroAndHeroAltRenderersDiffer: boolean;
    readonly unmatchedPageHeroBlockType: 'hero';
    readonly createdVariantBlockVersionCount: 1;
    readonly activeSparseOperationCount: 2;
  };
  readonly baselinePublicationId: string;
  readonly changedPublicationId: string;
  readonly rollbackRestoredBaselineHash: boolean;
  readonly publicationEvidence: {
    readonly seedElapsedMilliseconds: number;
    readonly baseline: {
      readonly pageCount: number;
      readonly manifestCount: number;
      readonly rowsWritten: number;
      readonly estimatedStorageBytes: number;
      readonly logicalExpandedRenderedDocumentBytes: number;
      readonly durationMilliseconds: number;
    };
    readonly changed: {
      readonly pageCount: number;
      readonly manifestCount: number;
      readonly rowsWritten: number;
      readonly estimatedStorageBytes: number;
      readonly logicalExpandedRenderedDocumentBytes: number;
      readonly durationMilliseconds: number;
    };
    readonly persistedPublicationCount: number;
    readonly persistedPageDocumentCount: number;
    readonly persistedManifestCount: number;
    readonly persistedManifestItemCount: number;
    readonly allocatedBytesBeforePublication: number;
    readonly allocatedBytesAfterPublication: number;
    readonly storageDeltaBytes: number;
  };
}

export interface StoreServiceEvidence {
  readonly publicationFailureLeftPriorPointerActive: boolean;
  readonly publicationFailureLeftNoRows: boolean;
  readonly rollbackRestoredPriorHash: boolean;
  readonly routeStatusOutcomesVerified: boolean;
  readonly routeStatusOutcomes: readonly {
    readonly routeStatus: 'live' | 'not_live' | 'archived';
    readonly status: 200 | 404;
    readonly reason: 'served' | 'not_live' | 'archived';
  }[];
  readonly servePlanUsesCanonicalIndex: boolean;
  readonly serveReadPath: {
    readonly materializationMode: 'expanded';
    readonly sqlQueryCountPerRequest: 1;
    readonly selectorSqlExecutionsPerRequest: 0;
    readonly celEvaluationsPerRequest: 0;
    readonly sqlStatements: readonly string[];
    readonly sampleCount: number;
    readonly p50Milliseconds: number;
    readonly p95Milliseconds: number;
  };
  readonly publicationIds: readonly string[];
  readonly documentHashes: readonly string[];
}

export interface VerifiedServiceIntegrationEvidence {
  readonly status: 'verified';
  readonly publicationFailureLeftPriorPointerActive: boolean;
  readonly rollbackRestoredPriorHash: boolean;
  readonly routeStatusOutcomesVerified: boolean;
  readonly publicationIds: readonly string[];
  readonly documentHashes: readonly string[];
  readonly densePersistence: DensePersistenceEvidence;
  readonly structuralPersistence: StructuralPersistenceEvidence;
  readonly storeService: StoreServiceEvidence;
}

export interface UnavailableServiceIntegrationEvidence {
  readonly status: 'unavailable';
  readonly reason: string;
  readonly requiredMethods: readonly ['resolvePage', 'publish', 'rollback', 'serve'];
}

export type ServiceIntegrationEvidence =
  | VerifiedServiceIntegrationEvidence
  | UnavailableServiceIntegrationEvidence;

export interface ScenarioServiceAdapter {
  provePublicationFailureRollbackAndServing: () => Promise<VerifiedServiceIntegrationEvidence>;
}

function createService(client: CmsDatabaseClient, prefix: string): CmsService {
  let sequence = 0;
  return new CmsService(client, {
    now: () => FIXED_NOW,
    createId: (scope) => {
      sequence += 1;
      return `${prefix}:${scope}:${String(sequence).padStart(5, '0')}`;
    },
  });
}

async function withEmptyDatabase<T>(
  operation: (client: CmsDatabaseClient) => Promise<T> | T
): Promise<T> {
  const client = createCmsDatabase({ databasePath: ':memory:' });
  try {
    await resetDatabase(client);
    return await operation(client);
  } finally {
    client.close();
  }
}

function databaseAllocatedBytes(client: CmsDatabaseClient): number {
  const pageCount =
    client.sqlite.query<{ page_count: number }, []>('PRAGMA page_count').get()?.page_count ?? 0;
  const pageSize =
    client.sqlite.query<{ page_size: number }, []>('PRAGMA page_size').get()?.page_size ?? 0;
  return pageCount * pageSize;
}

function tableCount(client: CmsDatabaseClient, table: string): number {
  return (
    client.sqlite.query<{ count: number }, []>(`SELECT count(*) AS count FROM ${table}`).get()
      ?.count ?? 0
  );
}

function percentile(samples: readonly number[], value: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0;
}

function registerCopyBlockTypes(
  service: CmsService,
  types: ReadonlySet<string>,
  prefix: string
): void {
  for (const type of [...types].sort()) {
    const isStructuralAlternative = prefix === 'structural' && type === 'hero_alt';
    service.registerBlockType({
      id: `${prefix}:block-type:${type}`,
      key: type,
      name: type,
      schemaVersion: 1,
      schema: isStructuralAlternative
        ? {
            type: 'object',
            required: ['copy', 'layout'],
            properties: {
              copy: { type: 'string' },
              layout: { type: 'string', enum: ['split'] },
            },
            additionalProperties: false,
          }
        : {
            type: 'object',
            required: ['copy'],
            properties: { copy: { type: 'string' } },
            additionalProperties: false,
          },
      previewRenderer: { component: `${prefix}:${type}`, schemaVersion: 1 },
    });
  }
}

function applyVariantOperation(
  service: CmsService,
  templateId: string,
  variantId: string,
  operation: VariantOperation,
  revisionNumber: number,
  defaultVersionByPlacement: ReadonlyMap<string, string>,
  persistedVersions: Set<string>
): void {
  const revisionId = `${variantId}:r${revisionNumber}`;
  if (operation.kind === 'set') {
    if (!persistedVersions.has(operation.blockVersion.id)) {
      const sourceVersionId = defaultVersionByPlacement.get(operation.placementKey);
      if (!sourceVersionId) {
        throw new Error(`No default block version exists for ${operation.placementKey}.`);
      }
      service.forkBlockVersion(templateId, {
        id: operation.blockVersion.id,
        sourceVersionId,
        blockTypeKey: operation.blockVersion.blockType,
        content: operation.blockVersion.content,
        createdBy: 'scenario-seed',
      });
      persistedVersions.add(operation.blockVersion.id);
    }
    service.setVariantPlacement(templateId, variantId, {
      revisionId,
      placementKey: operation.placementKey,
      blockVersionId: operation.blockVersion.id,
      createdBy: 'scenario-seed',
    });
    return;
  }
  if (operation.kind === 'tombstone') {
    service.tombstoneVariantPlacement(templateId, variantId, {
      revisionId,
      placementKey: operation.placementKey,
      createdBy: 'scenario-seed',
    });
    return;
  }
  service.reorderVariantPlacement(templateId, variantId, {
    revisionId,
    placementKey: operation.placementKey,
    order: operation.order,
    createdBy: 'scenario-seed',
  });
}

function createDenseVariant(
  service: CmsService,
  fixture: DenseVariant,
  defaultVersionByPlacement: ReadonlyMap<string, string>,
  persistedVersions: Set<string>
): void {
  service.createVariant('eligible-vehicles', {
    id: fixture.layer.id,
    revisionId: `${fixture.layer.id}:r1`,
    key: fixture.layer.id,
    name: fixture.layer.id,
    priority: fixture.layer.priority,
    status: 'active',
    selector: fixture.selector,
    createdBy: 'scenario-seed',
  });
  fixture.layer.operations.forEach((operation, index) => {
    applyVariantOperation(
      service,
      'eligible-vehicles',
      fixture.layer.id,
      operation,
      index + 2,
      defaultVersionByPlacement,
      persistedVersions
    );
  });
}

export async function runPersistedDenseEligibleVehiclesProof(): Promise<DensePersistenceEvidence> {
  return withEmptyDatabase(async (client) => {
    const seedStartedAt = performance.now();
    const service = createService(client, 'dense');
    const templateId = 'eligible-vehicles' as const;
    const pages = buildDensePages();
    const variants = buildDenseVariants(pages);
    const defaults = denseDefaultDocument();

    service.createTemplate({
      id: templateId,
      key: templateId,
      name: 'Eligible Vehicles',
      domain: 'www.uber.com',
      urlPattern: '/{locale}/{resource}/{state}/{purpose}',
      description: 'AUT-527 persisted scenario proof',
    });
    const slots = [
      {
        id: 'dense-slot-locale',
        key: 'locale',
        label: 'Locale',
        kind: 'variable',
        pathPosition: 0,
      },
      {
        id: 'dense-slot-resource',
        key: 'resource',
        label: 'Resource',
        kind: 'static',
        pathPosition: 1,
        staticValue: 'eligible-vehicles',
      },
      { id: 'dense-slot-state', key: 'state', label: 'State', kind: 'variable', pathPosition: 2 },
      {
        id: 'dense-slot-purpose',
        key: 'purpose',
        label: 'Purpose',
        kind: 'variable',
        pathPosition: 3,
      },
      { id: 'dense-slot-country', key: 'country', label: 'Country', kind: 'derived' },
      { id: 'dense-slot-language', key: 'language', label: 'Language', kind: 'derived' },
    ] as const;
    for (const slot of slots) {
      service.createTemplateSlot(templateId, slot);
    }

    const blockTypes = new Set(
      defaults.placements.map((placement) => placement.blockVersion.blockType)
    );
    for (const variant of variants) {
      for (const operation of variant.layer.operations) {
        if (operation.kind === 'set') {
          blockTypes.add(operation.blockVersion.blockType);
        }
      }
    }
    registerCopyBlockTypes(service, blockTypes, 'dense');

    const defaultVersionByPlacement = new Map<string, string>();
    const persistedVersions = new Set<string>();
    defaults.placements.forEach((placement, index) => {
      service.createBlockLineage(templateId, {
        id: placement.blockVersion.lineageId,
        key: placement.placementKey,
        label: placement.placementKey,
      });
      service.createBlockVersion(templateId, {
        id: placement.blockVersion.id,
        lineageId: placement.blockVersion.lineageId,
        blockTypeKey: placement.blockVersion.blockType,
        content: placement.blockVersion.content,
        createdBy: 'scenario-seed',
      });
      service.setDefaultPlacement(templateId, {
        revisionId: `${templateId}:default:r${index + 2}`,
        placementKey: placement.placementKey,
        blockVersionId: placement.blockVersion.id,
        order: placement.order,
        createdBy: 'scenario-seed',
      });
      defaultVersionByPlacement.set(placement.placementKey, placement.blockVersion.id);
      persistedVersions.add(placement.blockVersion.id);
    });

    for (const page of pages) {
      service.createPage(templateId, {
        id: page.id,
        canonicalUrl: page.canonicalUrl,
        routeExternalId: `router:${page.id}`,
        routeStatus: 'live',
        routeRevision: 'dense-v1',
        context: { dimensions: page.dimensions as JsonObject },
        slotValues: {
          locale: String(page.dimensions.locale),
          resource: 'eligible-vehicles',
          state: String(page.dimensions.state).toLowerCase(),
          purpose: String(page.dimensions.purpose),
          country: String(page.dimensions.country),
          language: String(page.dimensions.language),
        },
      });
    }
    for (const variant of variants) {
      createDenseVariant(service, variant, defaultVersionByPlacement, persistedVersions);
    }

    const exactPage = pages.find((page) => page.id === 'eligible:en-US:CA:premium');
    if (!exactPage) {
      throw new Error('Persisted dense exact page was not generated.');
    }
    const seedElapsedMilliseconds = performance.now() - seedStartedAt;
    const allocatedBytesBeforePublication = databaseAllocatedBytes(client);
    const publication = service.publish(templateId, {
      id: 'dense-publication:baseline',
      createdBy: 'scenario-publisher',
    });
    const allocatedBytesAfterPublication = databaseAllocatedBytes(client);
    const exactDocument = service.resolvePage(templateId, exactPage.id);
    const activeBeforeConflict = service.serve(templateId, exactPage.canonicalUrl);
    if (activeBeforeConflict.status !== 200) {
      throw new Error('Persisted dense publication did not serve the exact page.');
    }
    const publicationRowsBefore =
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM publications WHERE template_id = 'eligible-vehicles'"
        )
        .get()?.count ?? 0;

    const legalDefault = defaultVersionByPlacement.get('legal-notice');
    if (!legalDefault) {
      throw new Error('Dense legal-notice default is missing.');
    }
    for (const suffix of ['a', 'b'] as const) {
      const versionId = `eligible-conflict:${suffix}:legal:v1`;
      service.forkBlockVersion(templateId, {
        id: versionId,
        sourceVersionId: legalDefault,
        content: { copy: `conflict:${suffix}:legal-notice` },
        createdBy: 'scenario-seed',
      });
      const variantId = `eligible-conflict:${suffix}`;
      service.createVariant(templateId, {
        id: variantId,
        revisionId: `${variantId}:r1`,
        key: variantId,
        name: variantId,
        priority: 60,
        status: 'active',
        selector: "locale = 'en-US'",
        createdBy: 'scenario-seed',
      });
      service.setVariantPlacement(templateId, variantId, {
        revisionId: `${variantId}:r2`,
        placementKey: 'legal-notice',
        blockVersionId: versionId,
        createdBy: 'scenario-seed',
      });
    }

    let conflictRejected = false;
    let conflictCode = 'NONE';
    try {
      service.publish(templateId, {
        id: 'dense-publication:must-not-exist',
        createdBy: 'scenario-publisher',
      });
    } catch (error) {
      conflictRejected = true;
      conflictCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : error instanceof Error
            ? error.name
            : 'UNKNOWN';
    }
    const activeAfterConflict = service.serve(templateId, exactPage.canonicalUrl);
    const publicationRowsAfter =
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM publications WHERE template_id = 'eligible-vehicles'"
        )
        .get()?.count ?? 0;
    const operationProvenanceCount =
      client.sqlite
        .query<{ count: number }, [string]>(
          `SELECT count(*) AS count
         FROM document_manifest_items AS items
         JOIN document_manifests AS manifests ON manifests.id = items.manifest_id
         WHERE manifests.template_id = ? AND items.source_operation_id <> ''`
        )
        .get(templateId)?.count ?? 0;
    const selectorPreview = service.previewSelector(
      templateId,
      "locale = 'en-US' AND state = 'CA' AND purpose = 'premium'",
      10
    );

    return {
      templateId,
      pageCount: pages.length as 24,
      publicationPageCount: publication.pageCount as 24,
      manifestCount: publication.manifestCount,
      exactPageId: exactPage.id,
      exactOverridesEveryPlacement: exactDocument.document.placements.every(
        (placement) => placement.provenance.content.priority === 100
      ),
      exactMatchedRevisionIds: exactDocument.document.matchedVariantIds,
      selectorPlanUsesIndexedSlotLookup: selectorPreview.plan.some((step) =>
        /page_slot_values.*index|index.*page_slot_values|page_slot_values_lookup_idx/i.test(
          step.detail
        )
      ),
      manifestItemsWithOperationProvenance: operationProvenanceCount,
      conflictRejected,
      conflictCode,
      failedPublicationLeftPriorPointerActive:
        activeAfterConflict.status === 200 &&
        activeAfterConflict.publicationId === publication.publicationId &&
        activeAfterConflict.documentHash === activeBeforeConflict.documentHash,
      failedPublicationLeftNoRows: publicationRowsAfter === publicationRowsBefore,
      publicationEvidence: {
        seedElapsedMilliseconds,
        pageCount: publication.pageCount,
        manifestCount: publication.manifestCount,
        rowsWritten: publication.rowsWritten,
        estimatedStorageBytes: publication.estimatedStorageBytes,
        logicalExpandedRenderedDocumentBytes: publication.logicalExpandedRenderedDocumentBytes,
        durationMilliseconds: publication.durationMilliseconds,
        persistedPublicationCount: tableCount(client, 'publications'),
        persistedPageDocumentCount: tableCount(client, 'published_page_documents'),
        persistedManifestCount: tableCount(client, 'document_manifests'),
        persistedManifestItemCount: tableCount(client, 'document_manifest_items'),
        allocatedBytesBeforePublication,
        allocatedBytesAfterPublication,
        storageDeltaBytes: allocatedBytesAfterPublication - allocatedBytesBeforePublication,
      },
    };
  });
}

export async function runPersistedStructuralProof(): Promise<StructuralPersistenceEvidence> {
  return withEmptyDatabase(async (client) => {
    const seedStartedAt = performance.now();
    const service = createService(client, 'structural');
    const templateId = 'structural-marketing' as const;
    const defaults = structuralDefaultDocument();
    const operations = structuralVariantOperations();
    service.createTemplate({
      id: templateId,
      key: templateId,
      name: 'Structural marketing',
      domain: 'www.uber.com',
      urlPattern: '/{locale}/{resource}/{slug}',
    });
    for (const slot of [
      {
        id: 'structural-slot-locale',
        key: 'locale',
        label: 'Locale',
        kind: 'variable',
        pathPosition: 0,
      },
      {
        id: 'structural-slot-resource',
        key: 'resource',
        label: 'Resource',
        kind: 'static',
        pathPosition: 1,
        staticValue: 'product',
      },
      { id: 'structural-slot-slug', key: 'slug', label: 'Slug', kind: 'variable', pathPosition: 2 },
    ] as const) {
      service.createTemplateSlot(templateId, slot);
    }
    const blockTypes = new Set(
      defaults.placements.map((placement) => placement.blockVersion.blockType)
    );
    for (const operation of operations) {
      if (operation.kind === 'set') {
        blockTypes.add(operation.blockVersion.blockType);
      }
    }
    registerCopyBlockTypes(service, blockTypes, 'structural');
    const defaultVersionByPlacement = new Map<string, string>();
    const persistedVersions = new Set<string>();
    defaults.placements.forEach((placement, index) => {
      service.createBlockLineage(templateId, {
        id: placement.blockVersion.lineageId,
        key: placement.placementKey,
        label: placement.placementKey,
      });
      service.createBlockVersion(templateId, {
        id: placement.blockVersion.id,
        lineageId: placement.blockVersion.lineageId,
        blockTypeKey: placement.blockVersion.blockType,
        content: placement.blockVersion.content,
        createdBy: 'scenario-seed',
      });
      service.setDefaultPlacement(templateId, {
        revisionId: `${templateId}:default:r${index + 2}`,
        placementKey: placement.placementKey,
        blockVersionId: placement.blockVersion.id,
        order: placement.order,
        createdBy: 'scenario-seed',
      });
      defaultVersionByPlacement.set(placement.placementKey, placement.blockVersion.id);
      persistedVersions.add(placement.blockVersion.id);
    });
    const blockVersionCountBeforeVariant = tableCount(client, 'block_versions');
    const defaultHeroVersionId = defaultVersionByPlacement.get('primary-hero');
    if (!defaultHeroVersionId) {
      throw new Error('Structural default hero version was not persisted.');
    }
    let heroAltRejectedHeroPayload = false;
    try {
      service.forkBlockVersion(templateId, {
        id: 'structural-invalid-hero-alt',
        sourceVersionId: defaultHeroVersionId,
        blockTypeKey: 'hero_alt',
        content: { copy: 'Missing the required alternative layout.' },
        createdBy: 'scenario-schema-proof',
      });
    } catch (error) {
      heroAltRejectedHeroPayload =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        String(error.code) === 'SCHEMA_VALIDATION';
    }
    for (const slug of ['current', 'hero-alt']) {
      service.createPage(templateId, {
        id: `structural-page:${slug}`,
        canonicalUrl: `/en-US/product/${slug}`,
        routeExternalId: `router:structural:${slug}`,
        routeStatus: 'live',
        routeRevision: 'structural-v1',
        context: { locale: 'en-US', slug },
        slotValues: { locale: 'en-US', resource: 'product', slug },
      });
    }
    const variantId = 'structural-variant:hero-alt';
    service.createVariant(templateId, {
      id: variantId,
      revisionId: `${variantId}:r1`,
      key: variantId,
      name: 'Hero alternative',
      priority: 10,
      status: 'draft',
      selector: "slug = 'hero-alt'",
      createdBy: 'scenario-seed',
    });
    operations.forEach((operation, index) => {
      applyVariantOperation(
        service,
        templateId,
        variantId,
        operation,
        index + 2,
        defaultVersionByPlacement,
        persistedVersions
      );
    });
    const seedElapsedMilliseconds = performance.now() - seedStartedAt;
    const blockTypeContracts = client.sqlite
      .query<{ key: string; previewRendererJson: string | null; schemaJson: string }, []>(`
        SELECT key, schema_json AS schemaJson, preview_renderer_json AS previewRendererJson
        FROM block_types
        WHERE key IN ('hero', 'hero_alt')
        ORDER BY key
      `)
      .all();
    const heroContract = blockTypeContracts.find((contract) => contract.key === 'hero');
    const heroAltContract = blockTypeContracts.find((contract) => contract.key === 'hero_alt');
    if (!heroContract || !heroAltContract) {
      throw new Error('Structural hero block contracts were not persisted.');
    }
    const activeSparseOperationCount =
      client.sqlite
        .query<{ count: number }, [string]>(`
          SELECT count(*) AS count
          FROM variant_operations AS operations
          JOIN variants ON variants.active_revision_id = operations.variant_revision_id
          WHERE variants.id = ?
        `)
        .get(variantId)?.count ?? 0;
    const createdVariantBlockVersionCount =
      tableCount(client, 'block_versions') - blockVersionCountBeforeVariant;
    if (
      !heroAltRejectedHeroPayload ||
      heroContract.schemaJson === heroAltContract.schemaJson ||
      heroContract.previewRendererJson === heroAltContract.previewRendererJson ||
      createdVariantBlockVersionCount !== 1 ||
      activeSparseOperationCount !== 2
    ) {
      throw new Error('Structural schema, renderer, or sparse-write contract was not proven.');
    }
    const allocatedBytesBeforePublication = databaseAllocatedBytes(client);
    const baseline = service.publish(templateId, {
      id: 'structural-publication:baseline',
      createdBy: 'scenario-publisher',
    });
    const baselineServe = service.serve(templateId, '/en-US/product/hero-alt');
    service.setVariantStatus(templateId, variantId, 'active');
    const effective = service.resolvePage(templateId, 'structural-page:hero-alt').document;
    const unmatched = service.resolvePage(templateId, 'structural-page:current').document;
    const changed = service.publish(templateId, {
      id: 'structural-publication:changed',
      createdBy: 'scenario-publisher',
    });
    const changedServe = service.serve(templateId, '/en-US/product/hero-alt');
    const allocatedBytesAfterPublication = databaseAllocatedBytes(client);
    service.rollback(templateId, baseline.publicationId, 'scenario-rollback');
    const rolledBackServe = service.serve(templateId, '/en-US/product/hero-alt');
    if (
      baselineServe.status !== 200 ||
      changedServe.status !== 200 ||
      rolledBackServe.status !== 200
    ) {
      throw new Error('Structural service fixture did not serve every publication state.');
    }
    const hero = effective.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    if (hero?.blockVersion.blockType !== 'hero_alt') {
      throw new Error('Structural service fixture did not replace the hero block type.');
    }
    const inheritedPlacementCount = effective.placements.filter(
      (placement) => placement.provenance.content.priority === 0
    ).length;
    const inheritanceRatio = inheritedPlacementCount / defaults.placements.length;
    const defaultHero = defaults.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    const unmatchedHero = unmatched.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    if (unmatchedHero?.blockVersion.blockType !== 'hero') {
      throw new Error('Structural hero_alt renderer leaked to an unmatched page.');
    }
    return {
      templateId,
      defaultPlacementCount: defaults.placements.length as 24,
      effectivePlacementCount: effective.placements.length as 23,
      inheritedPlacementCount,
      inheritanceRatio,
      meetsNinetyPercentInheritance: inheritanceRatio >= 0.9,
      stableHeroPlacementPreserved:
        defaultHero?.placementKey === hero.placementKey &&
        defaultHero.blockVersion.lineageId === hero.blockVersion.lineageId,
      heroBlockType: hero.blockVersion.blockType,
      promoTombstoned: effective.tombstones.some(
        (tombstone) => tombstone.placementKey === 'announcement-promo'
      ),
      structuralContractEvidence: {
        heroAltRejectedHeroPayload,
        heroAndHeroAltSchemasDiffer: heroContract.schemaJson !== heroAltContract.schemaJson,
        heroAndHeroAltRenderersDiffer:
          heroContract.previewRendererJson !== heroAltContract.previewRendererJson,
        unmatchedPageHeroBlockType: unmatchedHero.blockVersion.blockType,
        createdVariantBlockVersionCount: createdVariantBlockVersionCount as 1,
        activeSparseOperationCount: activeSparseOperationCount as 2,
      },
      baselinePublicationId: baseline.publicationId,
      changedPublicationId: changed.publicationId,
      rollbackRestoredBaselineHash:
        changedServe.documentHash !== baselineServe.documentHash &&
        rolledBackServe.documentHash === baselineServe.documentHash,
      publicationEvidence: {
        seedElapsedMilliseconds,
        baseline: {
          pageCount: baseline.pageCount,
          manifestCount: baseline.manifestCount,
          rowsWritten: baseline.rowsWritten,
          estimatedStorageBytes: baseline.estimatedStorageBytes,
          logicalExpandedRenderedDocumentBytes: baseline.logicalExpandedRenderedDocumentBytes,
          durationMilliseconds: baseline.durationMilliseconds,
        },
        changed: {
          pageCount: changed.pageCount,
          manifestCount: changed.manifestCount,
          rowsWritten: changed.rowsWritten,
          estimatedStorageBytes: changed.estimatedStorageBytes,
          logicalExpandedRenderedDocumentBytes: changed.logicalExpandedRenderedDocumentBytes,
          durationMilliseconds: changed.durationMilliseconds,
        },
        persistedPublicationCount: tableCount(client, 'publications'),
        persistedPageDocumentCount: tableCount(client, 'published_page_documents'),
        persistedManifestCount: tableCount(client, 'document_manifests'),
        persistedManifestItemCount: tableCount(client, 'document_manifest_items'),
        allocatedBytesBeforePublication,
        allocatedBytesAfterPublication,
        storageDeltaBytes: allocatedBytesAfterPublication - allocatedBytesBeforePublication,
      },
    };
  });
}

function pageUpdateInput(
  page: NonNullable<ReturnType<CmsService['getPage']>>,
  routeStatus: 'live' | 'not_live' | 'archived'
) {
  return {
    canonicalUrl: page.canonicalUrl,
    routeExternalId: page.routeExternalId,
    routeStatus,
    routeRevision: `${page.routeRevision}:${routeStatus}`,
    context: page.context,
    slotValues: page.slotValues,
    lastIngestionId: page.lastIngestionId,
  } as const;
}

export async function runStoreServiceProof(): Promise<StoreServiceEvidence> {
  return withEmptyDatabase(async (client) => {
    await seedFoundationDatabase(client);
    const service = createService(client, 'store');
    const templateId = 'tpl-store';
    const notLivePage = service.getPage(templateId, 'page-store-1002');
    if (!notLivePage) {
      throw new Error('Store foundation page 1002 is missing.');
    }
    service.updatePage(templateId, notLivePage.id, pageUpdateInput(notLivePage, 'not_live'));
    service.createPage(templateId, {
      id: 'page-store-1003',
      canonicalUrl: '/en-US/store/1003',
      routeExternalId: 'router-store-1003',
      routeStatus: 'archived',
      routeRevision: 'store-service-v1',
      context: {
        locale: 'en-US',
        store: { id: 1003, name: 'Archived Store', location: 'Oakland' },
      },
      slotValues: {
        locale: 'en-US',
        store: 'store',
        store_id: 1003,
        store_name: 'Archived Store',
      },
    });
    const baseline = service.publish(templateId, {
      id: 'store-publication:baseline',
      createdBy: 'scenario-publisher',
      materializationMode: 'expanded',
    });
    const liveBefore = service.serve(templateId, '/en-US/store/1001');
    if (liveBefore.status !== 200) {
      throw new Error('Store baseline publication did not serve its live page.');
    }
    service.forkBlockVersion(templateId, {
      id: 'block-store-hero-v3-service-proof',
      sourceVersionId: 'block-store-hero-v2-mcd',
      content: { headline: 'Service proof {{ store.name }} — {{ store.location }}' },
      createdBy: 'scenario-author',
    });
    service.setVariantPlacement(templateId, 'variant-store-mcdonalds', {
      revisionId: 'revision-store-mcdonalds-service-proof',
      placementKey: 'primary-hero',
      blockVersionId: 'block-store-hero-v3-service-proof',
      createdBy: 'scenario-author',
    });
    const publicationRowsBeforeFailure =
      client.sqlite
        .query<{ count: number }, [string]>(
          'SELECT count(*) AS count FROM publications WHERE template_id = ?'
        )
        .get(templateId)?.count ?? 0;
    let failureRejected = false;
    try {
      service.publish(templateId, {
        id: 'store-publication:must-not-exist',
        createdBy: 'scenario-publisher',
        failAt: 'before-activation',
        materializationMode: 'expanded',
      });
    } catch {
      failureRejected = true;
    }
    const liveAfterFailure = service.serve(templateId, '/en-US/store/1001');
    const publicationRowsAfterFailure =
      client.sqlite
        .query<{ count: number }, [string]>(
          'SELECT count(*) AS count FROM publications WHERE template_id = ?'
        )
        .get(templateId)?.count ?? 0;
    const changed = service.publish(templateId, {
      id: 'store-publication:changed',
      createdBy: 'scenario-publisher',
      materializationMode: 'expanded',
    });
    const liveChanged = service.serve(templateId, '/en-US/store/1001');
    service.rollback(templateId, baseline.publicationId, 'scenario-rollback');
    const liveRolledBack = service.serve(templateId, '/en-US/store/1001');
    const notLive = service.serve(templateId, '/en-US/store/1002');
    const archived = service.serve(templateId, '/en-US/store/1003');
    if (
      liveAfterFailure.status !== 200 ||
      liveChanged.status !== 200 ||
      liveRolledBack.status !== 200 ||
      notLive.status !== 404 ||
      notLive.reason !== 'not_live' ||
      archived.status !== 404 ||
      archived.reason !== 'archived'
    ) {
      throw new Error('Store service publication or route-status outcomes were incorrect.');
    }
    const routeStatusOutcomes = [
      { routeStatus: 'live', status: liveRolledBack.status, reason: 'served' },
      {
        routeStatus: 'not_live',
        status: notLive.status,
        reason: notLive.reason,
      },
      {
        routeStatus: 'archived',
        status: archived.status,
        reason: archived.reason,
      },
    ] as const;
    const servePlan = client.sqlite
      .query<{ detail: string }, [string, string]>(
        `EXPLAIN QUERY PLAN ${service.getServeQueryText()}`
      )
      .all(templateId, '/en-US/store/1001');
    const serveTimings: number[] = [];
    for (let index = 0; index < 100; index += 1) {
      const evidence = service.serveWithEvidence(templateId, '/en-US/store/1001');
      if (
        evidence.result.status !== 200 ||
        evidence.materializationMode !== 'expanded' ||
        evidence.sqlQueryCount !== 1 ||
        evidence.selectorSqlExecutions !== 0 ||
        evidence.celEvaluations !== 0
      ) {
        throw new Error(
          'Expanded serve read path was not one fixed selector-free and CEL-free query.'
        );
      }
      serveTimings.push(evidence.elapsedMilliseconds);
    }
    return {
      publicationFailureLeftPriorPointerActive:
        failureRejected &&
        liveAfterFailure.publicationId === baseline.publicationId &&
        liveAfterFailure.documentHash === liveBefore.documentHash,
      publicationFailureLeftNoRows: publicationRowsAfterFailure === publicationRowsBeforeFailure,
      rollbackRestoredPriorHash:
        liveChanged.documentHash !== liveBefore.documentHash &&
        liveRolledBack.documentHash === liveBefore.documentHash,
      routeStatusOutcomesVerified:
        routeStatusOutcomes[0].status === 200 &&
        routeStatusOutcomes[1].status === 404 &&
        routeStatusOutcomes[1].reason === 'not_live' &&
        routeStatusOutcomes[2].status === 404 &&
        routeStatusOutcomes[2].reason === 'archived',
      routeStatusOutcomes,
      servePlanUsesCanonicalIndex: servePlan.some((step) =>
        /page_instances_canonical_url_unique|page_instances_template_canonical/i.test(step.detail)
      ),
      serveReadPath: {
        materializationMode: 'expanded',
        sqlQueryCountPerRequest: 1,
        selectorSqlExecutionsPerRequest: 0,
        celEvaluationsPerRequest: 0,
        sqlStatements: service.getServeReadQueryTexts('expanded'),
        sampleCount: serveTimings.length,
        p50Milliseconds: percentile(serveTimings, 0.5),
        p95Milliseconds: percentile(serveTimings, 0.95),
      },
      publicationIds: [baseline.publicationId, changed.publicationId],
      documentHashes: [
        liveBefore.documentHash,
        liveChanged.documentHash,
        liveRolledBack.documentHash,
      ],
    };
  });
}

export function createCmsServiceScenarioAdapter(): ScenarioServiceAdapter {
  return {
    async provePublicationFailureRollbackAndServing() {
      const densePersistence = await runPersistedDenseEligibleVehiclesProof();
      const structuralPersistence = await runPersistedStructuralProof();
      const storeService = await runStoreServiceProof();
      return {
        status: 'verified',
        publicationFailureLeftPriorPointerActive:
          storeService.publicationFailureLeftPriorPointerActive &&
          densePersistence.failedPublicationLeftPriorPointerActive,
        rollbackRestoredPriorHash:
          storeService.rollbackRestoredPriorHash &&
          structuralPersistence.rollbackRestoredBaselineHash,
        routeStatusOutcomesVerified: storeService.routeStatusOutcomesVerified,
        publicationIds: storeService.publicationIds,
        documentHashes: storeService.documentHashes,
        densePersistence,
        structuralPersistence,
        storeService,
      };
    },
  };
}

export async function runServiceIntegrationProof(
  adapter: ScenarioServiceAdapter = createCmsServiceScenarioAdapter()
): Promise<ServiceIntegrationEvidence> {
  const evidence = await adapter.provePublicationFailureRollbackAndServing();
  if (
    evidence.status !== 'verified' ||
    !evidence.publicationFailureLeftPriorPointerActive ||
    !evidence.rollbackRestoredPriorHash ||
    !evidence.routeStatusOutcomesVerified ||
    !evidence.densePersistence.conflictRejected ||
    !evidence.densePersistence.failedPublicationLeftNoRows ||
    !evidence.structuralPersistence.meetsNinetyPercentInheritance ||
    !evidence.storeService.publicationFailureLeftNoRows
  ) {
    throw new Error(
      'cms-service integration did not prove every publication and serving invariant.'
    );
  }
  return evidence;
}

export function requireVerifiedServiceIntegration(
  evidence: ServiceIntegrationEvidence
): asserts evidence is VerifiedServiceIntegrationEvidence {
  if (evidence.status !== 'verified') {
    throw new Error(`cms-service integration unavailable: ${evidence.reason}`);
  }
}
