import type { SQLQueryBindings } from 'bun:sqlite';
import type { CmsDatabaseClient } from '@repo/cms-db';
import {
  compactScenarioRegistry,
  ensureCompactPublishedScenario,
} from '@repo/cms-scenarios/compact-seed';
import {
  adaptStoredSelector,
  CmsService,
  CmsServiceError,
  compileApprovedSelector,
} from '@repo/cms-service';
import type { ScenarioId } from '@/data/scenario-fixtures';
import type {
  PlacementTraceStep,
  SelectorConflict,
  SelectorScalar,
  SelectorWorkspacePreviewInput,
} from '@/data/selector-workspace';
import type {
  CmsCommand,
  CmsCommandResult,
  CmsPublicationMutationResult,
  CmsPublicationPreflight,
  CmsPublicationPreflightInput,
  CmsPublishPublicationInput,
  CmsRollbackPublicationInput,
  CmsWorkspaceFieldInspection,
  CmsWorkspaceSnapshot,
  SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';
import { CmsPublicationPreflightResultSchema } from '@/data/sqlite-authoring';

const ACTOR = 'prototype-ui';

export const editableScenarioRegistry = compactScenarioRegistry satisfies Record<
  ScenarioId,
  { templateId: string; pageId: string }
>;

type JsonObject = Parameters<CmsService['createDefaultPlacement']>[1]['content'];

interface VariantSelectorRow {
  id: string;
  selector: string;
}

interface BlockTypeRow {
  key: string;
  name: string;
  schemaVersion: number;
  schemaJson: string;
}

interface CurrentPublicationRow {
  currentPublicationId: string;
  rollbackPublicationId: string | null;
}

interface VariantOperationSummaryRow {
  variantId: string;
  variantRevisionId: string;
  placementKey: string | null;
  operationKind: 'set' | 'tombstone' | 'order' | null;
  blockVersionId: string | null;
  orderIndex: number | null;
}

interface VariantOperationSummary {
  variantId: string;
  variantRevisionId: string;
  placementKey: string;
  operationKind: 'set' | 'tombstone' | 'order';
  blockVersionId: string | null;
  orderIndex: number | null;
}

interface PageUrlRow {
  id: string;
  canonicalUrl: string;
}

interface BlockVersionHistoryRow {
  id: string;
  lineageId: string;
  parentBlockVersionId: string | null;
  versionNumber: number;
  blockType: string;
  schemaVersion: number;
  contentHash: string;
  createdBy: string;
  createdAt: string;
}

const blockExamples: Readonly<Record<string, JsonObject>> = {
  navigation: { label: 'Auteur prototype' },
  hero: { headline: 'A new immutable hero' },
  hero_alt: { headline: 'A split-layout hero', mapAssetKey: 'map-demo' },
  promo: { message: 'A new promotion' },
  footer: { legal: 'Prototype terms' },
};

const randomId = (scope: string): string => `${scope}:${globalThis.crypto.randomUUID()}`;

function parseContentJson(value: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new CmsServiceError('INVALID_INPUT', 'Block content must be valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CmsServiceError('INVALID_INPUT', 'Block content must be a JSON object.');
  }
  return parsed as JsonObject;
}

function blockVersionHistoryByLineage(
  client: CmsDatabaseClient,
  templateId: string
): ReadonlyMap<string, readonly BlockVersionHistoryRow[]> {
  const rows = client.sqlite
    .query<BlockVersionHistoryRow, [string]>(
      `SELECT versions.id,
              versions.lineage_id AS lineageId,
              versions.parent_version_id AS parentBlockVersionId,
              versions.version_number AS versionNumber,
              types.key AS blockType,
              versions.schema_version AS schemaVersion,
              versions.content_hash AS contentHash,
              versions.created_by AS createdBy,
              versions.created_at AS createdAt
       FROM block_versions AS versions
       JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
       JOIN block_types AS types ON types.id = versions.block_type_id
       WHERE lineages.template_id = ?
       ORDER BY versions.lineage_id, versions.version_number DESC, versions.id`
    )
    .all(templateId);
  const byLineage = new Map<string, BlockVersionHistoryRow[]>();
  for (const row of rows) {
    const history = byLineage.get(row.lineageId) ?? [];
    history.push(row);
    byLineage.set(row.lineageId, history);
  }
  return byLineage;
}

function inspectStringFields(
  service: CmsService,
  templateId: string,
  pageId: string,
  value: unknown,
  path = '$'
): CmsWorkspaceSnapshot['placements'][number]['fieldInspections'] {
  if (typeof value === 'string') {
    const inspection = service.inspectBlockFieldInterpolation(templateId, pageId, value);
    if (inspection.success) {
      return [
        {
          path,
          source: inspection.source,
          success: true,
          dependencies: inspection.dependencies,
          allowedVariables: inspection.allowedVariables,
          expressionCount: inspection.expressionCount,
          maxAstDepth: inspection.maxAstDepth,
          evaluatedSample: inspection.evaluatedSample,
          error: null,
        },
      ];
    }
    return [
      {
        path,
        source: inspection.source,
        success: false,
        dependencies: inspection.dependencies,
        allowedVariables: inspection.allowedVariables,
        expressionCount: null,
        maxAstDepth: null,
        evaluatedSample: null,
        error: inspection.error,
      },
    ];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      inspectStringFields(service, templateId, pageId, entry, `${path}[${index}]`)
    );
  }
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) =>
    inspectStringFields(service, templateId, pageId, entry, `${path}.${key}`)
  );
}

function insertionIndex(
  placementKeys: readonly string[],
  position: 'start' | 'end' | 'before' | 'after',
  referencePlacementKey?: string
): number {
  if (position === 'start') return 0;
  if (position === 'end') return placementKeys.length;
  if (!referencePlacementKey) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      `Choose a reference placement when inserting ${position}.`
    );
  }
  const referenceIndex = placementKeys.indexOf(referencePlacementKey);
  if (referenceIndex < 0) {
    throw new CmsServiceError(
      'NOT_FOUND',
      `Reference placement "${referencePlacementKey}" was not found.`
    );
  }
  return position === 'before' ? referenceIndex : referenceIndex + 1;
}

const ensureEditableScenario = ensureCompactPublishedScenario;

export function inspectCmsBlockField(
  client: CmsDatabaseClient,
  scenarioId: ScenarioId,
  canonicalUrl: string,
  source: string
): CmsWorkspaceFieldInspection {
  const registry = editableScenarioRegistry[scenarioId];
  const service = new CmsService(client);
  if (!service.getTemplate(registry.templateId)) {
    throw new CmsServiceError('NOT_FOUND', 'Editable template was not found.');
  }
  const page = client.sqlite
    .query<{ id: string }, [string, string]>(
      `SELECT id
       FROM page_instances
       WHERE template_id = ? AND canonical_url = ?`
    )
    .get(registry.templateId, canonicalUrl);
  if (!page) {
    throw new CmsServiceError(
      'NOT_FOUND',
      `Page "${canonicalUrl}" was not found in the selected template.`
    );
  }
  const [inspection] = inspectStringFields(service, registry.templateId, page.id, source);
  if (!inspection) {
    throw new CmsServiceError('INVALID_INPUT', 'A string field is required for CEL inspection.');
  }
  return inspection;
}

function selectorsByVariant(client: CmsDatabaseClient, templateId: string): Map<string, string> {
  return new Map(
    client.sqlite
      .query<VariantSelectorRow, [string]>(
        `SELECT variants.id, revisions.selector_input AS selector
         FROM variants
         JOIN variant_revisions AS revisions ON revisions.id = variants.active_revision_id
         WHERE variants.template_id = ?`
      )
      .all(templateId)
      .map((row) => [row.id, row.selector] as const)
  );
}

function activeOperationsByVariant(
  client: CmsDatabaseClient,
  templateId: string
): Map<string, readonly VariantOperationSummary[]> {
  const rows = client.sqlite
    .query<VariantOperationSummaryRow, [string]>(
      `SELECT variants.id AS variantId,
              revisions.id AS variantRevisionId,
              operations.placement_key AS placementKey,
              operations.operation_kind AS operationKind,
              operations.block_version_id AS blockVersionId,
              operations.order_index AS orderIndex
       FROM variants
       JOIN variant_revisions AS revisions ON revisions.id = variants.active_revision_id
       LEFT JOIN variant_operations AS operations
         ON operations.variant_revision_id = revisions.id
       WHERE variants.template_id = ?
       ORDER BY variants.priority, variants.id, operations.placement_key, operations.operation_kind`
    )
    .all(templateId);
  const byVariant = new Map<string, VariantOperationSummary[]>();
  for (const row of rows) {
    if (!row.placementKey || !row.operationKind) continue;
    const operations = byVariant.get(row.variantId) ?? [];
    operations.push({ ...row, placementKey: row.placementKey, operationKind: row.operationKind });
    byVariant.set(row.variantId, operations);
  }
  return byVariant;
}

function affectedPlacementCount(
  operations: ReadonlyMap<string, readonly VariantOperationSummary[]>,
  variantId: string
): number {
  return new Set((operations.get(variantId) ?? []).map((operation) => operation.placementKey)).size;
}

function selectorMatchesPage(
  client: CmsDatabaseClient,
  service: CmsService,
  templateId: string,
  pageId: string,
  selector: string
): boolean {
  const compiled = compileApprovedSelector(
    adaptStoredSelector(selector),
    service.getApprovedReadSurface(templateId).fields
  );
  return Boolean(
    client.sqlite
      .query<{ matched: number }, SQLQueryBindings[]>(
        `SELECT EXISTS(
           SELECT 1
           FROM page_instances AS p
           WHERE p.template_id = ? AND p.id = ? AND (${compiled.predicateSql})
         ) AS matched`
      )
      .get(templateId, pageId, ...compiled.parameters)?.matched
  );
}

function traceStep(
  step: {
    readonly kind: 'default' | 'set' | 'tombstone' | 'order';
    readonly source: { readonly sourceId: string; readonly priority: number };
    readonly blockVersionId?: string;
    readonly order?: number;
  },
  variantByRevision: ReadonlyMap<string, { readonly id: string; readonly name: string }>
): PlacementTraceStep {
  const source = variantByRevision.get(step.source.sourceId);
  if (!source) {
    throw new CmsServiceError(
      'CONFLICT',
      `Resolution source revision "${step.source.sourceId}" has no owning variant.`
    );
  }
  return {
    kind: step.kind,
    sourceRevisionId: step.source.sourceId,
    sourcePriority: step.source.priority,
    sourceVariantId: source.id,
    sourceVariantName: source.name,
    ...(step.blockVersionId === undefined ? {} : { blockVersionId: step.blockVersionId }),
    ...(step.order === undefined ? {} : { order: step.order }),
  };
}

function operationKindsForPlacement(
  operations: ReadonlyMap<string, readonly VariantOperationSummary[]>,
  variantId: string,
  placementKey: string
): ('set' | 'tombstone' | 'order')[] {
  const kinds = new Set<'set' | 'tombstone' | 'order'>();
  for (const operation of operations.get(variantId) ?? []) {
    if (operation.placementKey === placementKey) kinds.add(operation.operationKind);
  }
  return [...kinds].sort();
}

function resolutionConflicts(
  service: CmsService,
  templateId: string,
  variants: ReturnType<CmsService['listVariants']>,
  operations: ReadonlyMap<string, readonly VariantOperationSummary[]>
): readonly SelectorConflict[] {
  const active = variants.filter(
    (variant) => !variant.isDefault && variant.status === 'active' && variant.activeRevisionId
  );
  const indexById = new Map(active.map((variant, index) => [variant.id, index] as const));
  const conflicts: SelectorConflict[] = [];
  for (const source of active) {
    if (!source.activeRevisionId) continue;
    for (const overlap of service.previewVariantOverlap(templateId, source.id, 5)) {
      const sourceIndex = indexById.get(source.id) ?? -1;
      const otherIndex = indexById.get(overlap.variantId) ?? -1;
      if (otherIndex <= sourceIndex || overlap.overlapCount === 0) continue;
      const other = active[otherIndex];
      if (!other?.activeRevisionId) continue;
      const sampleUrls = overlap.overlapPageIds.flatMap((pageId) => {
        const page = service.getPage(templateId, pageId);
        return page ? [page.canonicalUrl] : [];
      });
      for (const placementKey of overlap.conflictingPlacementKeys) {
        conflicts.push({
          priority: source.priority,
          placementKey,
          overlapCount: overlap.overlapCount,
          sampleUrls,
          sources: [
            {
              variantId: source.id,
              variantRevisionId: source.activeRevisionId,
              variantName: source.name,
              operationKinds: operationKindsForPlacement(operations, source.id, placementKey),
            },
            {
              variantId: other.id,
              variantRevisionId: other.activeRevisionId,
              variantName: other.name,
              operationKinds: operationKindsForPlacement(operations, other.id, placementKey),
            },
          ],
        });
      }
    }
  }
  return conflicts.sort(
    (left, right) =>
      left.priority - right.priority || left.placementKey.localeCompare(right.placementKey)
  );
}

export function readCmsWorkspace(
  client: CmsDatabaseClient,
  scenarioId: ScenarioId,
  requestedScopeId?: string,
  requestedCanonicalUrl?: string
): CmsWorkspaceSnapshot {
  const registry = ensureEditableScenario(client, scenarioId);
  const service = new CmsService(client);
  const template = service.getTemplate(registry.templateId);
  if (!template) throw new CmsServiceError('NOT_FOUND', 'Editable template was not found.');
  const variants = service.listVariants(registry.templateId);
  const defaultVariant = variants.find((variant) => variant.isDefault);
  if (!defaultVariant?.activeRevisionId) {
    throw new CmsServiceError('CONFLICT', 'Editable template has no active default revision.');
  }
  const selectedVariant =
    variants.find((variant) => variant.id === requestedScopeId && variant.status !== 'archived') ??
    defaultVariant;
  const selectors = selectorsByVariant(client, registry.templateId);
  const operations = activeOperationsByVariant(client, registry.templateId);
  const conflicts = resolutionConflicts(service, registry.templateId, variants, operations);
  const variantByRevision = new Map(
    variants.flatMap((variant) =>
      variant.activeRevisionId
        ? [[variant.activeRevisionId, { id: variant.id, name: variant.name }] as const]
        : []
    )
  );
  let pageId: string = registry.pageId;
  if (requestedCanonicalUrl) {
    const selectedPage = client.sqlite
      .query<{ id: string }, [string, string]>(
        `SELECT id FROM page_instances
         WHERE template_id = ? AND canonical_url = ?`
      )
      .get(registry.templateId, requestedCanonicalUrl);
    if (!selectedPage) {
      throw new CmsServiceError(
        'NOT_FOUND',
        `Page "${requestedCanonicalUrl}" was not found in the selected template.`
      );
    }
    pageId = selectedPage.id;
  } else if (!selectedVariant.isDefault) {
    const selector = selectors.get(selectedVariant.id) ?? '';
    const preview = service.previewSelector(registry.templateId, selector, 1);
    pageId = preview.rows[0]?.pageId ?? registry.pageId;
  }
  const page = service.getPage(registry.templateId, pageId);
  if (!page) throw new CmsServiceError('NOT_FOUND', 'Editable sample page was not found.');
  const scopeMatchesSamplePage = selectedVariant.isDefault
    ? true
    : selectorMatchesPage(
        client,
        service,
        registry.templateId,
        pageId,
        selectors.get(selectedVariant.id) ?? ''
      );
  let resolutionStatus: 'resolved' | 'conflict' = 'resolved';
  let resolved: ReturnType<CmsService['resolvePage']>;
  try {
    if (selectedVariant.isDefault) {
      resolved = service.resolveDefaultPage(registry.templateId, pageId);
    } else if (scopeMatchesSamplePage) {
      resolved = service.resolveVariantDraft(registry.templateId, selectedVariant.id, pageId);
    } else {
      resolved = service.resolvePage(registry.templateId, pageId);
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'VariantConflictError') throw error;
    resolutionStatus = 'conflict';
    resolved = service.resolveDefaultPage(registry.templateId, pageId);
  }
  const renderedByPlacement = new Map(
    resolved.renderedPlacements.map((placement) => [placement.placementKey, placement] as const)
  );
  const served = service.serve(registry.templateId, page.canonicalUrl);
  const publishedByPlacement = new Map(
    served.status === 200
      ? served.document.placements.map((placement) => [placement.placementKey, placement] as const)
      : []
  );
  const versionHistory = blockVersionHistoryByLineage(client, registry.templateId);
  const currentPublication = client.sqlite
    .query<CurrentPublicationRow, [string]>(
      `SELECT current.publication_id AS currentPublicationId,
              publications.previous_publication_id AS rollbackPublicationId
       FROM current_publications AS current
       JOIN publications ON publications.id = current.publication_id
         AND publications.template_id = current.template_id
       WHERE current.template_id = ?`
    )
    .get(registry.templateId);
  const publicationCount =
    client.sqlite
      .query<{ count: number }, [string]>(
        'SELECT count(*) AS count FROM publications WHERE template_id = ?'
      )
      .get(registry.templateId)?.count ?? 0;
  const blockTypes = client.sqlite
    .query<BlockTypeRow, []>(
      `SELECT key, name, schema_version AS schemaVersion, schema_json AS schemaJson
       FROM block_types
       ORDER BY key`
    )
    .all()
    .filter((blockType) => blockType.key in blockExamples)
    .map((blockType) => ({
      ...blockType,
      exampleContentJson: JSON.stringify(blockExamples[blockType.key], null, 2),
    }));
  return {
    scenarioId,
    templateId: registry.templateId,
    templateName: template.name,
    pageId,
    canonicalUrl: page.canonicalUrl,
    scopeId: selectedVariant.id,
    scopeMatchesSamplePage,
    variants: variants.map((variant) => {
      const selector = selectors.get(variant.id) ?? 'TRUE';
      const matchesSamplePage =
        variant.isDefault ||
        selectorMatchesPage(client, service, registry.templateId, pageId, selector);
      return {
        id: variant.id,
        name: variant.name,
        priority: variant.priority,
        isDefault: variant.isDefault,
        status: variant.status,
        selector,
        activeRevisionId: variant.activeRevisionId ?? '',
        matchesSamplePage,
        affectedPlacementCount: affectedPlacementCount(operations, variant.id),
      };
    }),
    selectorFields: service.getApprovedReadSurface(registry.templateId).fields,
    blockTypes,
    placements: resolved.document.placements.map((placement) => {
      const history = versionHistory.get(placement.blockVersion.lineageId) ?? [];
      const currentVersion = history.find((version) => version.id === placement.blockVersion.id);
      if (!currentVersion) {
        throw new CmsServiceError(
          'CONFLICT',
          `Block version "${placement.blockVersion.id}" has no immutable history row.`
        );
      }
      const published = publishedByPlacement.get(placement.placementKey);
      return {
        placementKey: placement.placementKey,
        order: placement.order,
        blockType: placement.blockVersion.blockType,
        blockVersionId: placement.blockVersion.id,
        contentJson: JSON.stringify(placement.blockVersion.content, null, 2),
        renderedJson: JSON.stringify(
          renderedByPlacement.get(placement.placementKey)?.content ?? {}
        ),
        sourceRevisionId: placement.provenance.content.sourceId,
        sourcePriority: placement.provenance.content.priority,
        inherited:
          !selectedVariant.isDefault &&
          placement.provenance.content.sourceId !== selectedVariant.activeRevisionId,
        orderSourceRevisionId: placement.provenance.order.sourceId,
        orderSourcePriority: placement.provenance.order.priority,
        orderInherited:
          !selectedVariant.isDefault &&
          placement.provenance.order.sourceId !== selectedVariant.activeRevisionId,
        trace: placement.trace.map((step) => traceStep(step, variantByRevision)),
        lineageId: placement.blockVersion.lineageId,
        parentBlockVersionId: currentVersion.parentBlockVersionId,
        versionNumber: currentVersion.versionNumber,
        schemaVersion: currentVersion.schemaVersion,
        contentHash: currentVersion.contentHash,
        createdBy: currentVersion.createdBy,
        createdAt: currentVersion.createdAt,
        publishedBlockVersionId: published?.blockVersionId ?? null,
        draftDifference: published
          ? published.blockVersionId === placement.blockVersion.id
            ? ('same' as const)
            : ('changed' as const)
          : ('added' as const),
        versionHistory: history.map((version) => ({
          id: version.id,
          parentBlockVersionId: version.parentBlockVersionId,
          versionNumber: version.versionNumber,
          blockType: version.blockType,
          schemaVersion: version.schemaVersion,
          contentHash: version.contentHash,
          createdBy: version.createdBy,
          createdAt: version.createdAt,
        })),
        fieldInspections: inspectStringFields(
          service,
          registry.templateId,
          pageId,
          placement.blockVersion.content
        ),
      };
    }),
    tombstones: resolved.document.tombstones.map((tombstone) => ({
      placementKey: tombstone.placementKey,
      sourceRevisionId: tombstone.source.sourceId,
      sourcePriority: tombstone.source.priority,
      trace: tombstone.trace.map((step) => traceStep(step, variantByRevision)),
      hiddenPlacement: tombstone.hiddenPlacement
        ? {
            order: tombstone.hiddenPlacement.order,
            blockType: tombstone.hiddenPlacement.blockVersion.blockType,
            blockVersionId: tombstone.hiddenPlacement.blockVersion.id,
            contentJson: JSON.stringify(tombstone.hiddenPlacement.blockVersion.content, null, 2),
          }
        : null,
    })),
    matchedVariantRevisionIds: resolved.document.matchedVariantIds,
    resolutionStatus,
    resolutionConflicts: conflicts,
    publicationBlocked: conflicts.length > 0,
    currentPublicationId: currentPublication?.currentPublicationId ?? null,
    currentDocumentHash: served.status === 200 ? served.documentHash : null,
    rollbackPublicationId: currentPublication?.rollbackPublicationId ?? null,
    publicationCount,
  };
}

export function previewCmsSelector(
  client: CmsDatabaseClient,
  scenarioId: ScenarioId,
  selector: string,
  options: Partial<
    Pick<SelectorWorkspacePreviewInput, 'priority' | 'scopeId' | 'canonicalUrl' | 'sampleLimit'>
  > = {}
): SelectorPreviewSnapshot {
  const { templateId } = ensureEditableScenario(client, scenarioId);
  const service = new CmsService(client);
  const variants = service.listVariants(templateId);
  const selectedVariant = variants.find((variant) => variant.id === options.scopeId);
  const priority = options.priority ?? selectedVariant?.priority ?? 1;
  const sampleLimit = options.sampleLimit ?? 10;
  const surface = service.getApprovedReadSurface(templateId);
  const compilation = compileApprovedSelector(selector, surface.fields);
  const preview = service.previewSelector(templateId, selector, sampleLimit);
  const executionSql = `SELECT p.id AS pageId, p.canonical_url AS canonicalUrl,
       p.route_status AS routeStatus, p.context_json AS contextJson
FROM page_instances AS p
WHERE p.template_id = ? AND (${compilation.predicateSql})
ORDER BY p.canonical_url, p.id
LIMIT ?`;
  const displayBinding = (binding: SQLQueryBindings): SelectorScalar => {
    if (
      binding === null ||
      typeof binding === 'string' ||
      typeof binding === 'number' ||
      typeof binding === 'boolean'
    ) {
      return binding;
    }
    if (typeof binding === 'bigint') return binding.toString();
    return '[binary binding]';
  };
  let selectedPageMatches: boolean | null = null;
  if (options.canonicalUrl) {
    const selectedPage = client.sqlite
      .query<{ id: string }, [string, string]>(
        'SELECT id FROM page_instances WHERE template_id = ? AND canonical_url = ?'
      )
      .get(templateId, options.canonicalUrl);
    if (!selectedPage) {
      throw new CmsServiceError(
        'NOT_FOUND',
        `Page "${options.canonicalUrl}" was not found in the selected template.`
      );
    }
    selectedPageMatches = selectorMatchesPage(
      client,
      service,
      templateId,
      selectedPage.id,
      selector
    );
  }
  const operations = activeOperationsByVariant(client, templateId);
  const selectors = selectorsByVariant(client, templateId);
  const targetPlacements = new Set(
    options.scopeId
      ? (operations.get(options.scopeId) ?? []).map((operation) => operation.placementKey)
      : []
  );
  const overlaps: SelectorPreviewSnapshot['overlaps'] = [];
  for (const variant of variants) {
    if (
      variant.isDefault ||
      variant.status !== 'active' ||
      !variant.activeRevisionId ||
      variant.id === options.scopeId
    ) {
      continue;
    }
    const candidateSelector = compileApprovedSelector(
      adaptStoredSelector(selectors.get(variant.id) ?? ''),
      surface.fields
    );
    const predicate = `(${compilation.predicateSql}) AND (${candidateSelector.predicateSql})`;
    const parameters: SQLQueryBindings[] = [
      templateId,
      ...compilation.parameters,
      ...candidateSelector.parameters,
    ];
    const overlapCount =
      client.sqlite
        .query<{ count: number }, SQLQueryBindings[]>(
          `SELECT count(*) AS count
           FROM page_instances AS p
           WHERE p.template_id = ?
             AND p.route_status <> 'archived'
             AND ${predicate}`
        )
        .get(...parameters)?.count ?? 0;
    const sampleRows = client.sqlite
      .query<PageUrlRow, SQLQueryBindings[]>(
        `SELECT p.id, p.canonical_url AS canonicalUrl
         FROM page_instances AS p
         WHERE p.template_id = ?
           AND p.route_status <> 'archived'
           AND ${predicate}
         ORDER BY p.canonical_url, p.id
         LIMIT ?`
      )
      .all(...parameters, sampleLimit);
    const candidatePlacements = new Set(
      (operations.get(variant.id) ?? []).map((operation) => operation.placementKey)
    );
    overlaps.push({
      variantId: variant.id,
      variantRevisionId: variant.activeRevisionId,
      variantName: variant.name,
      priority: variant.priority,
      relation:
        variant.priority < priority ? 'below' : variant.priority > priority ? 'above' : 'same',
      overlapCount,
      sampleUrls: sampleRows.map((page) => page.canonicalUrl),
      truncated: overlapCount > sampleLimit,
      affectedPlacementCount: candidatePlacements.size,
      conflictingPlacementKeys:
        variant.priority === priority
          ? [...targetPlacements].filter((placementKey) => candidatePlacements.has(placementKey))
          : [],
    });
  }
  overlaps.sort(
    (left, right) => left.priority - right.priority || left.variantId.localeCompare(right.variantId)
  );
  return {
    approvedFields: [...surface.fields],
    normalizedSelector: preview.normalizedSelector,
    execution: {
      sql: executionSql,
      parameters: [templateId, ...compilation.parameters, sampleLimit + 1].map(displayBinding),
    },
    totalCount: preview.totalCount,
    templatePageCount: preview.templatePageCount,
    warnings: [...preview.warnings],
    samplePages: [...preview.rows],
    sampleUrls: preview.rows.map((row) => row.canonicalUrl),
    truncated: preview.truncated,
    selectedPageMatches,
    affectedPlacementCount: targetPlacements.size,
    overlaps,
    plan: [...preview.plan],
  };
}

function scopeForCommand(service: CmsService, templateId: string, scopeId: string) {
  const variant = service.getVariant(templateId, scopeId);
  if (!variant || variant.status === 'archived') {
    throw new CmsServiceError('NOT_FOUND', `Authoring scope "${scopeId}" was not found.`);
  }
  return variant;
}

type PageMutationCommand = Extract<
  CmsCommand,
  {
    kind:
      | 'addPlacement'
      | 'editPlacement'
      | 'movePlacement'
      | 'revertOrder'
      | 'deletePlacement'
      | 'revertPlacement';
  }
>;

function pageMutationContext(
  client: CmsDatabaseClient,
  service: CmsService,
  templateId: string,
  command: PageMutationCommand
) {
  const variant = scopeForCommand(service, templateId, command.scopeId);
  const workspace = readCmsWorkspace(
    client,
    command.scenarioId,
    command.scopeId,
    command.canonicalUrl
  );
  if (workspace.scopeId !== variant.id) {
    throw new CmsServiceError(
      'NOT_FOUND',
      `Authoring scope "${command.scopeId}" was not found in the selected template.`
    );
  }
  if (!workspace.scopeMatchesSamplePage) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      `Variation "${variant.name}" does not match page "${command.canonicalUrl}".`
    );
  }
  return { variant, workspace };
}

function requireWorkspacePlacement(
  workspace: CmsWorkspaceSnapshot,
  placementKey: string
): CmsWorkspaceSnapshot['placements'][number] {
  const placement = workspace.placements.find((entry) => entry.placementKey === placementKey);
  if (!placement) {
    throw new CmsServiceError(
      'NOT_FOUND',
      `Placement "${placementKey}" was not found on page "${workspace.canonicalUrl}".`
    );
  }
  return placement;
}

function validateWholeTemplateMutation(service: CmsService, templateId: string): void {
  try {
    service.publish(templateId, {
      createdBy: ACTOR,
      forceNewPublication: true,
      failAt: 'after-publication',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'VariantConflictError') {
      service.validateAuthoringResolution(templateId);
      return;
    }
    if (
      error instanceof CmsServiceError &&
      error.code === 'PUBLICATION_FAILED' &&
      error.message === 'Injected failure after publication row.'
    ) {
      return;
    }
    throw error;
  }
  throw new CmsServiceError(
    'PUBLICATION_FAILED',
    'Authoring validation unexpectedly completed without its rollback checkpoint.'
  );
}

function duplicateVariantOperations(
  client: CmsDatabaseClient,
  service: CmsService,
  templateId: string,
  sourceVariantId: string,
  targetVariantId: string
): void {
  const source = scopeForCommand(service, templateId, sourceVariantId);
  if (source.isDefault) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      'Use linked inheritance rather than duplicating the template default.'
    );
  }
  const sourceOperations = activeOperationsByVariant(client, templateId).get(sourceVariantId) ?? [];
  const contentOperations = sourceOperations.filter(
    (operation) => operation.operationKind !== 'order'
  );
  const orderOperations = sourceOperations.filter(
    (operation) => operation.operationKind === 'order'
  );
  for (const operation of contentOperations) {
    if (operation.operationKind === 'set') {
      if (!operation.blockVersionId) {
        throw new CmsServiceError(
          'CONFLICT',
          `Source placement "${operation.placementKey}" has no immutable block version.`
        );
      }
      service.setVariantPlacement(templateId, targetVariantId, {
        revisionId: randomId('revision'),
        placementKey: operation.placementKey,
        blockVersionId: operation.blockVersionId,
        createdBy: ACTOR,
      });
    } else {
      service.tombstoneVariantPlacement(templateId, targetVariantId, {
        revisionId: randomId('revision'),
        placementKey: operation.placementKey,
        createdBy: ACTOR,
      });
    }
  }
  for (const operation of orderOperations) {
    if (operation.orderIndex === null) {
      throw new CmsServiceError(
        'CONFLICT',
        `Source placement "${operation.placementKey}" has no explicit order.`
      );
    }
    service.reorderVariantPlacement(templateId, targetVariantId, {
      revisionId: randomId('revision'),
      placementKey: operation.placementKey,
      order: operation.orderIndex,
      createdBy: ACTOR,
    });
  }
}

function executeCmsCommandInTransaction(
  client: CmsDatabaseClient,
  command: CmsCommand
): CmsCommandResult {
  const registry = ensureEditableScenario(client, command.scenarioId);
  const service = new CmsService(client);
  let scopeId = 'scopeId' in command ? command.scopeId : undefined;
  let message: string;

  switch (command.kind) {
    case 'createVariant': {
      let selector = command.selector;
      if (command.mode === 'duplicate') {
        if (!command.duplicateSourceScopeId) {
          throw new CmsServiceError('INVALID_INPUT', 'Choose the variation to duplicate.');
        }
        const source = scopeForCommand(
          service,
          registry.templateId,
          command.duplicateSourceScopeId
        );
        if (source.isDefault) {
          throw new CmsServiceError(
            'INVALID_INPUT',
            'Use linked inheritance rather than duplicating the template default.'
          );
        }
        const sourceSelector = selectorsByVariant(client, registry.templateId).get(source.id);
        if (!sourceSelector) {
          throw new CmsServiceError(
            'CONFLICT',
            `Source variation "${source.name}" has no active selector revision.`
          );
        }
        selector = sourceSelector;
      }
      service.previewSelector(registry.templateId, selector, 10);
      const key =
        command.name
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'variant';
      const id = randomId('variant');
      service.createVariant(registry.templateId, {
        id,
        revisionId: randomId('revision'),
        key: `${key}-${id.slice(-8)}`,
        name: command.name,
        priority: command.priority,
        status: 'active',
        selector,
        createdBy: ACTOR,
        mode: command.mode === 'duplicate' ? 'linked' : command.mode,
      });
      if (command.mode === 'duplicate') {
        if (!command.duplicateSourceScopeId) {
          throw new CmsServiceError('INVALID_INPUT', 'Choose the variation to duplicate.');
        }
        duplicateVariantOperations(
          client,
          service,
          registry.templateId,
          command.duplicateSourceScopeId,
          id
        );
      }
      scopeId = id;
      message =
        command.mode === 'linked'
          ? 'Linked variant created in SQLite.'
          : command.mode === 'empty'
            ? 'Blank variant created with explicit tombstones in SQLite.'
            : 'Variation duplicated as an independent immutable revision in SQLite.';
      break;
    }
    case 'reviseSelector':
      scopeForCommand(service, registry.templateId, command.scopeId);
      service.reviseVariantSelector(registry.templateId, command.scopeId, {
        revisionId: randomId('revision'),
        selector: command.selector,
        createdBy: ACTOR,
      });
      message = 'Selector revision validated and persisted.';
      break;
    case 'setVariantPriority':
      service.setVariantPriority(registry.templateId, command.scopeId, command.priority);
      message = `Variant priority changed to ${command.priority}.`;
      break;
    case 'addPlacement': {
      const { variant, workspace } = pageMutationContext(
        client,
        service,
        registry.templateId,
        command
      );
      const content = parseContentJson(command.contentJson);
      const position = command.position ?? 'end';
      const currentPlacementKeys = workspace.placements.map((placement) => placement.placementKey);
      const targetIndex = insertionIndex(
        currentPlacementKeys,
        position,
        command.referencePlacementKey
      );
      if (variant.isDefault) {
        const defaultPosition =
          position === 'start' || position === 'end'
            ? { kind: position }
            : {
                kind: position,
                placementKey:
                  command.referencePlacementKey ??
                  (() => {
                    throw new CmsServiceError(
                      'INVALID_INPUT',
                      `Choose a reference placement when inserting ${position}.`
                    );
                  })(),
              };
        service.createDefaultPlacement(registry.templateId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          lineage: {
            id: randomId('lineage'),
            key: command.placementKey,
            label: command.placementKey,
          },
          blockVersionId: randomId('block-version'),
          blockTypeKey: command.blockTypeKey,
          content,
          createdBy: ACTOR,
          position: defaultPosition,
        });
      } else {
        service.createVariantPlacement(registry.templateId, command.scopeId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          lineage: {
            id: randomId('lineage'),
            key: command.placementKey,
            label: command.placementKey,
          },
          blockVersionId: randomId('block-version'),
          blockTypeKey: command.blockTypeKey,
          content,
          order: currentPlacementKeys.length,
          createdBy: ACTOR,
        });
        if (targetIndex !== currentPlacementKeys.length) {
          const placementKeys = [...currentPlacementKeys];
          placementKeys.splice(targetIndex, 0, command.placementKey);
          service.reorderVariantPlacements(registry.templateId, command.scopeId, {
            revisionId: randomId('revision'),
            placementKeys,
            createdBy: ACTOR,
          });
        }
      }
      message = `Placement ${command.placementKey} added ${position} as an immutable version.`;
      break;
    }
    case 'editPlacement': {
      const { variant, workspace } = pageMutationContext(
        client,
        service,
        registry.templateId,
        command
      );
      requireWorkspacePlacement(workspace, command.placementKey);
      const content = parseContentJson(command.contentJson);
      if (variant.isDefault) {
        service.editDefaultPlacement(registry.templateId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          blockVersionId: randomId('block-version'),
          blockTypeKey: command.blockTypeKey,
          content,
          createdBy: ACTOR,
        });
      } else {
        service.copyOnWritePlacement(
          registry.templateId,
          command.scopeId,
          workspace.pageId,
          command.placementKey,
          {
            revisionId: randomId('revision'),
            blockVersionId: randomId('block-version'),
            blockTypeKey: command.blockTypeKey,
            content,
            createdBy: ACTOR,
          }
        );
      }
      message = `Placement ${command.placementKey} now points to a new immutable version.`;
      break;
    }
    case 'movePlacement': {
      const { variant, workspace } = pageMutationContext(
        client,
        service,
        registry.templateId,
        command
      );
      const placementKeys = workspace.placements.map((placement) => placement.placementKey);
      const index = placementKeys.indexOf(command.placementKey);
      const targetIndex = command.direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= placementKeys.length) {
        throw new CmsServiceError('INVALID_INPUT', 'The placement cannot move farther.');
      }
      [placementKeys[index], placementKeys[targetIndex]] = [
        placementKeys[targetIndex] ?? '',
        placementKeys[index] ?? '',
      ];
      if (variant.isDefault) {
        service.reorderDefaultPlacements(registry.templateId, {
          revisionId: randomId('revision'),
          placementKeys,
          createdBy: ACTOR,
        });
      } else {
        service.reorderVariantPlacements(registry.templateId, command.scopeId, {
          revisionId: randomId('revision'),
          placementKeys,
          createdBy: ACTOR,
        });
      }
      message = `Placement ${command.placementKey} moved ${command.direction} atomically.`;
      break;
    }
    case 'revertOrder': {
      const { variant } = pageMutationContext(client, service, registry.templateId, command);
      if (variant.isDefault) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          'Only a variant order snapshot can be reverted.'
        );
      }
      const hasLocalOrder = (
        activeOperationsByVariant(client, registry.templateId).get(command.scopeId) ?? []
      ).some((operation) => operation.operationKind === 'order');
      if (!hasLocalOrder) {
        throw new CmsServiceError(
          'NOT_FOUND',
          `Variation "${variant.name}" has no local order snapshot to revert.`
        );
      }
      service.revertVariantOrder(registry.templateId, command.scopeId, {
        revisionId: randomId('revision'),
        createdBy: ACTOR,
      });
      message = `Local order for ${variant.name} reverted to inheritance.`;
      break;
    }
    case 'deletePlacement': {
      const { variant, workspace } = pageMutationContext(
        client,
        service,
        registry.templateId,
        command
      );
      requireWorkspacePlacement(workspace, command.placementKey);
      if (variant.isDefault) {
        service.removeDefaultPlacement(registry.templateId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          createdBy: ACTOR,
        });
        message = `Default placement ${command.placementKey} removed; history remains immutable.`;
      } else {
        service.tombstoneVariantPlacement(registry.templateId, command.scopeId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          createdBy: ACTOR,
        });
        message = `Scoped tombstone hides ${command.placementKey}.`;
      }
      break;
    }
    case 'revertPlacement': {
      const { variant } = pageMutationContext(client, service, registry.templateId, command);
      if (variant.isDefault) {
        throw new CmsServiceError('INVALID_INPUT', 'Only a variant override can be reverted.');
      }
      const hasLocalOperation = (
        activeOperationsByVariant(client, registry.templateId).get(command.scopeId) ?? []
      ).some(
        (operation) =>
          operation.placementKey === command.placementKey && operation.operationKind !== 'order'
      );
      if (!hasLocalOperation) {
        throw new CmsServiceError(
          'NOT_FOUND',
          `Variation "${variant.name}" has no local operation for placement "${command.placementKey}".`
        );
      }
      service.revertVariantPlacement(registry.templateId, command.scopeId, {
        revisionId: randomId('revision'),
        placementKey: command.placementKey,
        createdBy: ACTOR,
      });
      message = `Local operation for ${command.placementKey} reverted to inheritance.`;
      break;
    }
    case 'publish': {
      const publication = service.publish(registry.templateId, { createdBy: ACTOR });
      message = publication.reusedCurrentPublication
        ? `Publication ${publication.publicationId} already matches the deterministic input.`
        : `Publication ${publication.publicationId} activated atomically for ${publication.pageCount} pages.`;
      break;
    }
    case 'rollback': {
      const rollback = service.rollback(registry.templateId, undefined, ACTOR);
      message = `Serving pointer rolled back from ${rollback.fromPublicationId} to ${rollback.publicationId}.`;
      break;
    }
  }

  if (
    'canonicalUrl' in command ||
    command.kind === 'reviseSelector' ||
    command.kind === 'setVariantPriority'
  ) {
    validateWholeTemplateMutation(service, registry.templateId);
  }

  return {
    ok: true,
    message,
    workspace: readCmsWorkspace(
      client,
      command.scenarioId,
      scopeId,
      'canonicalUrl' in command ? command.canonicalUrl : undefined
    ),
  };
}

export function preflightCmsPublication(
  client: CmsDatabaseClient,
  input: CmsPublicationPreflightInput
): CmsPublicationPreflight {
  const registry = editableScenarioRegistry[input.scenarioId];
  const service = new CmsService(client);
  if (!service.getTemplate(registry.templateId)) {
    throw new CmsServiceError(
      'NOT_FOUND',
      `Editable template "${registry.templateId}" was not found.`
    );
  }
  return CmsPublicationPreflightResultSchema.parse(
    service.preflightPublication(registry.templateId, {
      ...(input.materializationMode === undefined
        ? {}
        : { materializationMode: input.materializationMode }),
      ...(input.sampleLimit === undefined ? {} : { sampleLimit: input.sampleLimit }),
    })
  );
}

export function publishCmsPublication(
  client: CmsDatabaseClient,
  input: CmsPublishPublicationInput
): CmsPublicationMutationResult {
  const registry = ensureEditableScenario(client, input.scenarioId);
  const service = new CmsService(client);
  const result = service.publish(registry.templateId, {
    createdBy: ACTOR,
    expectedInputHash: input.inputHash,
    expectedCurrentPublicationId: input.expectedCurrentPublicationId,
    ...(input.materializationMode === undefined
      ? {}
      : { materializationMode: input.materializationMode }),
  });
  const preflight = CmsPublicationPreflightResultSchema.parse(
    service.preflightPublication(registry.templateId, {
      ...(input.materializationMode === undefined
        ? {}
        : { materializationMode: input.materializationMode }),
    })
  );
  return {
    kind: 'publish',
    message: result.reusedCurrentPublication
      ? `Publication ${result.publicationId} already matches the deterministic input.`
      : `Publication ${result.publicationId} activated atomically for ${result.pageCount} pages.`,
    publication: result.publication,
    fromPublication: result.fromPublication,
    workspace: readCmsWorkspace(client, input.scenarioId, input.scopeId, input.canonicalUrl),
    preflight,
  };
}

export function rollbackCmsPublication(
  client: CmsDatabaseClient,
  input: CmsRollbackPublicationInput
): CmsPublicationMutationResult {
  const registry = ensureEditableScenario(client, input.scenarioId);
  const service = new CmsService(client);
  const result = service.rollback(registry.templateId, {
    targetPublicationId: input.targetPublicationId,
    expectedCurrentPublicationId: input.expectedCurrentPublicationId,
    activatedBy: ACTOR,
  });
  return {
    kind: 'rollback',
    message: `Serving pointer rolled back from ${result.fromPublicationId} to ${result.publicationId}.`,
    publication: result.publication,
    fromPublication: result.fromPublication,
    workspace: readCmsWorkspace(client, input.scenarioId, input.scopeId, input.canonicalUrl),
    preflight: CmsPublicationPreflightResultSchema.parse(
      service.preflightPublication(registry.templateId)
    ),
  };
}

export function executeCmsCommand(
  client: CmsDatabaseClient,
  command: CmsCommand
): CmsCommandResult {
  return client.sqlite
    .transaction(() => executeCmsCommandInTransaction(client, command))
    .immediate();
}
