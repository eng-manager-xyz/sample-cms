import type { SQLQueryBindings } from 'bun:sqlite';
import type { CmsDatabaseClient } from '@repo/cms-db';
import {
  canonicalHash,
  canonicalJson,
  type DefaultDocument,
  type BlockVersion as DomainBlockVersion,
  type ProvenanceSource as DomainProvenanceSource,
  type VariantOperation as DomainVariantOperation,
  evaluateSelector,
  interpolateJson,
  type JsonObject,
  type JsonValue,
  orderPlacement,
  type PublishedDocument,
  parsePublishedDocument,
  type ResolvedDocument,
  type ResolvedPlacement,
  type ResolvedTombstone,
  resolveDocument,
  type SelectorExpression,
  type SelectorRecord,
  setPlacement,
  tombstonePlacement,
  type VariantLayer,
} from '@repo/cms-domain';

import { assertBlockContent } from './schema-validation';
import { adaptStoredSelector, compileApprovedSelector } from './selector-sql';
import type {
  ApprovedReadSurface,
  ApprovedSelectorField,
  BlockLineageInput,
  BlockTypeInput,
  BlockVersionRecord,
  BulkTagChangeInput,
  BulkTagChangePreview,
  BulkTagChangeResult,
  CmsServiceOptions,
  CopyOnWritePlacementInput,
  CopyOnWritePlacementResult,
  CreateBlockVersionInput,
  CreateDefaultPlacementInput,
  CreateVariantInput,
  CreateVariantPlacementInput,
  CursorPage,
  DefaultPlacementMutationResult,
  EditDefaultPlacementInput,
  EffectivePageDocument,
  ForkBlockVersionInput,
  PageInput,
  PageRecord,
  PageTagRecord,
  PublishedDocumentResult,
  PublishInput,
  PublishResult,
  RollbackResult,
  RouteImportInput,
  RouteImportResult,
  RouteStatus,
  SelectorPlanStep,
  SelectorPreview,
  ServeReadEvidence,
  ServeResult,
  TagInput,
  TagRecord,
  TemplateInput,
  TemplateRecord,
  TemplateSlotInput,
  TemplateSlotRecord,
  VariantOverlap,
  VariantRecord,
  VariantRevisionRecord,
} from './types';

export type CmsServiceErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'ARCHIVED_GUARD'
  | 'CONFLICT'
  | 'SCHEMA_VALIDATION'
  | 'PUBLICATION_FAILED';

export class CmsServiceError extends Error {
  readonly code: CmsServiceErrorCode;

  constructor(code: CmsServiceErrorCode, message: string) {
    super(message);
    this.name = 'CmsServiceError';
    this.code = code;
  }
}

interface TemplateRow {
  id: string;
  key: string;
  name: string;
  domain: string;
  urlPattern: string;
  description: string;
  status: 'active' | 'archived';
  routeAuthority: 'camo_press';
  createdAt: string;
  updatedAt: string;
}

interface SlotRow {
  id: string;
  templateId: string;
  key: string;
  label: string;
  kind: TemplateSlotInput['kind'];
  pathPosition: number | null;
  staticValue: string | null;
  valueType: 'string' | 'integer' | 'boolean';
  isRequired: number;
  createdAt: string;
}

interface PageRow {
  id: string;
  templateId: string;
  canonicalUrl: string;
  routeExternalId: string;
  routeStatus: RouteStatus;
  routeRevision: string;
  lastIngestionId: string | null;
  slotValueHash: string;
  contextJson: string;
  createdAt: string;
  updatedAt: string;
}

interface TagRow {
  id: string;
  templateId: string;
  namespace: string;
  value: string;
  label: string;
  description: string;
  source: 'pipeline' | 'author' | 'seed';
  parentTagId: string | null;
  createdAt: string;
}

interface VariantRow {
  id: string;
  templateId: string;
  key: string;
  name: string;
  description: string;
  isDefault: number;
  priority: number;
  status: 'draft' | 'active' | 'archived';
  activeRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RevisionRow {
  id: string;
  variantId: string;
  revisionNumber: number;
  selectorInput: string;
  selectorSql: string;
  selectorHash: string;
  validationResultJson: string;
  selectorDescription: string;
  createdBy: string;
  createdAt: string;
}

interface OperationRow {
  id: string;
  variantRevisionId: string;
  placementKey: string;
  operationKind: 'set' | 'tombstone' | 'order';
  blockVersionId: string | null;
  orderIndex: number | null;
  blockTypeKey: string | null;
  blockTypeId: string | null;
  lineageId: string | null;
  schemaVersion: number | null;
  contentJson: string | null;
}

interface BlockVersionRow {
  id: string;
  templateId: string;
  lineageId: string;
  parentVersionId: string | null;
  versionNumber: number;
  blockTypeId: string;
  blockTypeKey: string;
  schemaVersion: number;
  contentJson: string;
  contentHash: string;
  createdBy: string;
  createdAt: string;
}

interface CursorValue {
  value: string;
  id: string;
}

interface PublicationRow {
  id: string;
  sequence: number;
  inputHash: string;
  previousPublicationId: string | null;
  pageCount: number;
  manifestCount: number;
}

interface MaterializedPlacement {
  placementKey: string;
  order: number;
  blockVersionId: string;
  sourceRevisionId: string;
  sourceOperationId: string;
  sourcePriority: number;
}

interface PreparedResolutionLayer {
  readonly id: string;
  readonly priority: number;
  readonly expression: SelectorExpression;
  readonly operations: readonly DomainVariantOperation[];
}

interface PreparedResolutionState {
  readonly defaultRevisionId: string;
  readonly defaultDocument: DefaultDocument;
  readonly fields: readonly ApprovedSelectorField[];
  readonly slotsByKey: ReadonlyMap<string, TemplateSlotRecord>;
  readonly layers: readonly PreparedResolutionLayer[];
  readonly sourceOperationIds: ReadonlyMap<string, string>;
}

interface PreparedPublicationPage {
  readonly page: PageRecord;
  readonly tagsByNamespace: ReadonlyMap<string, readonly string[]>;
}

const templateSelect = `
  SELECT id, key, name, domain, url_pattern AS urlPattern, description, status,
         route_authority AS routeAuthority, created_at AS createdAt, updated_at AS updatedAt
  FROM templates
`;

const slotSelect = `
  SELECT id, template_id AS templateId, key, label, kind, path_position AS pathPosition,
         static_value AS staticValue, value_type AS valueType, is_required AS isRequired,
         created_at AS createdAt
  FROM template_slots
`;

const pageSelect = `
  SELECT id, template_id AS templateId, canonical_url AS canonicalUrl,
         route_external_id AS routeExternalId, route_status AS routeStatus,
         route_revision AS routeRevision, last_ingestion_id AS lastIngestionId,
         slot_value_hash AS slotValueHash, context_json AS contextJson,
         created_at AS createdAt, updated_at AS updatedAt
  FROM page_instances
`;

const tagSelect = `
  SELECT id, template_id AS templateId, namespace, value, label, description, source,
         parent_tag_id AS parentTagId, created_at AS createdAt
  FROM tags
`;

const variantSelect = `
  SELECT id, template_id AS templateId, key, name, description, is_default AS isDefault,
         priority, status, active_revision_id AS activeRevisionId,
         created_at AS createdAt, updated_at AS updatedAt
  FROM variants
`;

const serveSql = `
  SELECT pages.route_status AS currentRouteStatus,
         current.publication_id AS publicationId,
         documents.page_instance_id AS pageInstanceId,
         documents.manifest_id AS manifestId,
         documents.document_hash AS documentHash,
         documents.rendered_document_json AS renderedDocumentJson,
         documents.resolved_data_json AS resolvedDataJson
  FROM page_instances AS pages
  LEFT JOIN current_publications AS current
    ON current.template_id = pages.template_id
  LEFT JOIN published_page_documents AS documents
    ON documents.template_id = pages.template_id
   AND documents.page_instance_id = pages.id
   AND documents.publication_id = current.publication_id
  WHERE pages.template_id = ? AND pages.canonical_url = ?
`;

const publishedManifestSql = `
  SELECT items.ordinal, items.placement_key AS placementKey,
         items.block_version_id AS blockVersionId, types.key AS blockType,
         versions.content_json AS contentJson,
         items.source_variant_revision_id AS sourceRevisionId,
         items.source_operation_id AS sourceOperationId,
         items.source_priority AS sourcePriority
  FROM document_manifest_items AS items
  JOIN document_manifests AS manifests ON manifests.id = items.manifest_id
  JOIN block_versions AS versions ON versions.id = items.block_version_id
  JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
  JOIN block_types AS types ON types.id = versions.block_type_id
  WHERE manifests.template_id = ? AND manifests.id = ?
    AND lineages.template_id = manifests.template_id
  ORDER BY items.ordinal
`;

const encodeCursor = (cursor: CursorValue): string =>
  encodeURIComponent(JSON.stringify([cursor.value, cursor.id]));

const decodeCursor = (cursor: string): CursorValue => {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cursor));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      return { value: parsed[0], id: parsed[1] };
    }
  } catch {
    // The typed error below is more useful to callers than the parser detail.
  }
  throw new CmsServiceError('INVALID_INPUT', 'Invalid pagination cursor.');
};

const assertPageLimit = (limit: number, maximum = 100): number => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      `Limit must be an integer from 1 through ${maximum}.`
    );
  }
  return limit;
};

const normalizeMachineValue = (value: string): string =>
  value.normalize('NFKC').trim().toLowerCase();

const isJsonValue = (value: unknown): value is JsonValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every((entry) => isJsonValue(entry))
  );
};

const parseJson = (value: string): JsonValue => {
  const parsed: unknown = JSON.parse(value);
  if (!isJsonValue(parsed)) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      'Database JSON is outside the supported JSON shape.'
    );
  }
  return parsed;
};

const parseJsonObject = (value: string): JsonObject => {
  const parsed = parseJson(value);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CmsServiceError('INVALID_INPUT', 'Expected a JSON object.');
  }
  return parsed as JsonObject;
};

const assertPublishedDocument = (value: unknown): PublishedDocument => {
  try {
    return parsePublishedDocument(value);
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new CmsServiceError(
      'PUBLICATION_FAILED',
      `Published document failed contract validation.${detail}`
    );
  }
};

const parsePublishedDocumentJson = (value: string): PublishedDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new CmsServiceError(
      'PUBLICATION_FAILED',
      'Published document contains invalid persisted JSON.'
    );
  }
  return assertPublishedDocument(parsed);
};

const stringifyJson = (value: JsonValue): string => JSON.stringify(value);

const normalizeDomain = (domain: string): string => {
  const normalized = domain.normalize('NFKC').trim().toLowerCase();
  if (
    normalized.length === 0 ||
    normalized.includes('://') ||
    normalized.includes('/') ||
    /\s/.test(normalized)
  ) {
    throw new CmsServiceError('INVALID_INPUT', 'Template domains must be bare host names.');
  }
  return normalized;
};

const UNKNOWN_SOURCE_OBSERVED_AT = '1970-01-01T00:00:00.000Z';

const normalizeSourceObservedAt = (observedAt: string | undefined): string => {
  if (observedAt === undefined) {
    return UNKNOWN_SOURCE_OBSERVED_AT;
  }
  const milliseconds = Date.parse(observedAt);
  if (!Number.isFinite(milliseconds)) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      'Route source-observed timestamps must be valid ISO-8601 timestamps.'
    );
  }
  return new Date(milliseconds).toISOString();
};

const sourceOperationKey = (
  revisionId: string,
  placementKey: string,
  blockVersionId: string
): string => canonicalJson([revisionId, placementKey, blockVersionId]);

export class CmsService {
  readonly client: CmsDatabaseClient;
  private readonly now: () => string;
  private readonly createId: (scope: string) => string;
  private readonly selectorPreviewLimit: number;

  constructor(client: CmsDatabaseClient, options: CmsServiceOptions = {}) {
    this.client = client;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? ((scope) => `${scope}:${globalThis.crypto.randomUUID()}`);
    this.selectorPreviewLimit = options.selectorPreviewLimit ?? 200;
  }

  private all<Row>(sql: string, parameters: readonly SQLQueryBindings[] = []): Row[] {
    return this.client.sqlite.query<Row, SQLQueryBindings[]>(sql).all(...parameters);
  }

  private get<Row>(sql: string, parameters: readonly SQLQueryBindings[] = []): Row | null {
    return this.client.sqlite.query<Row, SQLQueryBindings[]>(sql).get(...parameters);
  }

  private run(sql: string, parameters: readonly SQLQueryBindings[] = []): void {
    this.client.sqlite.query<unknown, SQLQueryBindings[]>(sql).run(...parameters);
  }

  private transaction<T>(operation: () => T): T {
    // Bun's transaction wrapper nests with savepoints. That lets a caller group several public
    // service commands plus a final validation/read projection into one atomic unit while each
    // command keeps its own transaction boundary when called independently.
    return this.client.sqlite.transaction(operation).immediate();
  }

  private requireTemplate(templateId: string, active = false): TemplateRecord {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new CmsServiceError('NOT_FOUND', `Template "${templateId}" was not found.`);
    }
    if (active && template.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Template "${templateId}" is archived.`);
    }
    return template;
  }

  createTemplate(input: TemplateInput): TemplateRecord {
    if (!input.urlPattern.startsWith('/')) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Templates require a domain and absolute URL pattern.'
      );
    }
    const domain = normalizeDomain(input.domain);
    return this.transaction(() => {
      const now = this.now();
      this.run(
        `INSERT INTO templates (
          id, key, name, domain, url_pattern, description, status, route_authority,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'camo_press', ?, ?)`,
        [
          input.id,
          input.key,
          input.name,
          domain,
          input.urlPattern,
          input.description ?? '',
          input.status ?? 'active',
          now,
          now,
        ]
      );
      const foundation = this.get<{ defaults: number; revisions: number }>(
        `SELECT count(DISTINCT variants.id) AS defaults,
                count(DISTINCT revisions.id) AS revisions
         FROM variants
         LEFT JOIN variant_revisions AS revisions
           ON revisions.variant_id = variants.id
         WHERE variants.template_id = ? AND variants.is_default = 1
           AND variants.priority = 0 AND variants.status = 'active'
           AND variants.active_revision_id = revisions.id
           AND revisions.selector_sql = 'TRUE'`,
        [input.id]
      );
      if (foundation?.defaults !== 1 || foundation.revisions !== 1) {
        throw new CmsServiceError(
          'CONFLICT',
          'Template creation did not atomically produce exactly one active default revision.'
        );
      }
      return this.requireTemplate(input.id);
    });
  }

  getTemplate(templateId: string): TemplateRecord | null {
    return this.get<TemplateRow>(`${templateSelect} WHERE id = ?`, [templateId]);
  }

  listTemplates(
    input: { readonly limit?: number; readonly cursor?: string } = {}
  ): CursorPage<TemplateRecord> {
    const limit = assertPageLimit(input.limit ?? 25);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = this.all<TemplateRow>(
      `${templateSelect}
       ${cursor ? 'WHERE (key > ? OR (key = ? AND id > ?))' : ''}
       ORDER BY key, id LIMIT ?`,
      cursor ? [cursor.value, cursor.value, cursor.id, limit + 1] : [limit + 1]
    );
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor({ value: last.key, id: last.id }) : null,
    };
  }

  updateTemplate(templateId: string, input: Omit<TemplateInput, 'id' | 'key'>): TemplateRecord {
    const current = this.requireTemplate(templateId);
    if (!input.urlPattern.startsWith('/')) {
      throw new CmsServiceError('INVALID_INPUT', 'Template URL patterns must be absolute.');
    }
    const domain = normalizeDomain(input.domain);
    const pageCount =
      this.get<{ count: number }>(
        'SELECT count(*) AS count FROM page_instances WHERE template_id = ?',
        [templateId]
      )?.count ?? 0;
    if (pageCount > 0 && (current.domain !== domain || current.urlPattern !== input.urlPattern)) {
      throw new CmsServiceError(
        'CONFLICT',
        'A template domain or URL grammar cannot change after canonical pages exist.'
      );
    }
    this.run(
      `UPDATE templates
       SET name = ?, domain = ?, url_pattern = ?, description = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        input.name,
        domain,
        input.urlPattern,
        input.description ?? '',
        input.status ?? 'active',
        this.now(),
        templateId,
      ]
    );
    return this.requireTemplate(templateId);
  }

  deleteTemplate(templateId: string): void {
    this.archiveTemplate(templateId);
  }

  archiveTemplate(templateId: string): TemplateRecord {
    this.requireTemplate(templateId);
    this.run("UPDATE templates SET status = 'archived', updated_at = ? WHERE id = ?", [
      this.now(),
      templateId,
    ]);
    return this.requireTemplate(templateId);
  }

  createTemplateSlot(templateId: string, input: TemplateSlotInput): TemplateSlotRecord {
    this.requireTemplate(templateId, true);
    this.run(
      `INSERT INTO template_slots (
        id, template_id, key, label, kind, path_position, static_value,
        value_type, is_required, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        templateId,
        input.key,
        input.label,
        input.kind,
        input.pathPosition ?? null,
        input.staticValue ?? null,
        input.valueType ?? 'string',
        input.isRequired ?? true,
        this.now(),
      ]
    );
    return this.requireSlot(templateId, input.id);
  }

  private requireSlot(templateId: string, slotId: string): TemplateSlotRecord {
    const row = this.get<SlotRow>(`${slotSelect} WHERE template_id = ? AND id = ?`, [
      templateId,
      slotId,
    ]);
    if (!row) {
      throw new CmsServiceError('NOT_FOUND', `Slot "${slotId}" was not found in the template.`);
    }
    return { ...row, isRequired: row.isRequired === 1 };
  }

  listTemplateSlots(templateId: string): readonly TemplateSlotRecord[] {
    this.requireTemplate(templateId);
    return this.all<SlotRow>(
      `${slotSelect}
       WHERE template_id = ?
       ORDER BY path_position IS NULL, path_position, key, id`,
      [templateId]
    ).map((row) => ({ ...row, isRequired: row.isRequired === 1 }));
  }

  updateTemplateSlot(
    templateId: string,
    slotId: string,
    input: Omit<TemplateSlotInput, 'id'>
  ): TemplateSlotRecord {
    this.requireTemplate(templateId, true);
    this.requireSlot(templateId, slotId);
    this.run(
      `UPDATE template_slots
       SET key = ?, label = ?, kind = ?, path_position = ?, static_value = ?,
           value_type = ?, is_required = ?
       WHERE template_id = ? AND id = ?`,
      [
        input.key,
        input.label,
        input.kind,
        input.pathPosition ?? null,
        input.staticValue ?? null,
        input.valueType ?? 'string',
        input.isRequired ?? true,
        templateId,
        slotId,
      ]
    );
    return this.requireSlot(templateId, slotId);
  }

  deleteTemplateSlot(templateId: string, slotId: string): void {
    this.requireTemplate(templateId, true);
    this.requireSlot(templateId, slotId);
    this.run('DELETE FROM template_slots WHERE template_id = ? AND id = ?', [templateId, slotId]);
  }

  private normalizeSlotValue(
    slot: TemplateSlotRecord,
    rawValue: string | number | boolean
  ): { value: string; normalized: string } {
    const value = String(rawValue);
    if (slot.valueType === 'integer') {
      const integer = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isSafeInteger(integer)) {
        throw new CmsServiceError('INVALID_INPUT', `Slot "${slot.key}" requires an integer.`);
      }
      return { value: String(integer), normalized: String(integer) };
    }
    if (slot.valueType === 'boolean') {
      const normalized = normalizeMachineValue(value);
      if (normalized !== 'true' && normalized !== 'false') {
        throw new CmsServiceError('INVALID_INPUT', `Slot "${slot.key}" requires a boolean.`);
      }
      return { value: normalized, normalized };
    }
    return { value, normalized: normalizeMachineValue(value) };
  }

  private prepareSlotValues(
    templateId: string,
    input: Readonly<Record<string, string | number | boolean>>
  ): readonly {
    slot: TemplateSlotRecord;
    value: string;
    normalized: string;
  }[] {
    const slots = this.listTemplateSlots(templateId);
    const byKey = new Map(slots.map((slot) => [slot.key, slot]));
    const unknown = Object.keys(input).find((key) => !byKey.has(key));
    if (unknown) {
      throw new CmsServiceError('INVALID_INPUT', `Unknown slot "${unknown}".`);
    }
    return slots.map((slot) => {
      const supplied = input[slot.key];
      const rawValue = supplied ?? slot.staticValue;
      if (rawValue === null || rawValue === undefined) {
        if (slot.isRequired) {
          throw new CmsServiceError('INVALID_INPUT', `Required slot "${slot.key}" is missing.`);
        }
        return { slot, value: '', normalized: '' };
      }
      if (slot.kind === 'static' && slot.staticValue !== String(rawValue)) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          `Static slot "${slot.key}" must equal "${slot.staticValue}".`
        );
      }
      return { slot, ...this.normalizeSlotValue(slot, rawValue) };
    });
  }

  private writePage(templateId: string, input: PageInput, mode: 'insert' | 'update'): void {
    const slotValues = this.prepareSlotValues(templateId, input.slotValues);
    const canonicalUrl = this.buildCanonicalUrlFromPrepared(templateId, slotValues);
    if (input.canonicalUrl !== canonicalUrl) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        `Canonical URL must be "${canonicalUrl}" for the supplied template slots.`
      );
    }
    const slotValueHash = canonicalHash(
      Object.fromEntries(slotValues.map((entry) => [entry.slot.key, entry.normalized]))
    );
    const now = this.now();
    if (mode === 'insert') {
      this.run(
        `INSERT INTO page_instances (
          id, template_id, canonical_url, route_external_id, route_status, route_revision,
          last_ingestion_id, slot_value_hash, context_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          templateId,
          canonicalUrl,
          input.routeExternalId,
          input.routeStatus,
          input.routeRevision,
          input.lastIngestionId ?? null,
          slotValueHash,
          stringifyJson(input.context),
          now,
          now,
        ]
      );
    } else {
      this.run(
        `UPDATE page_instances
         SET canonical_url = ?, route_external_id = ?, route_status = ?, route_revision = ?,
             last_ingestion_id = ?, slot_value_hash = ?, context_json = ?, updated_at = ?
         WHERE template_id = ? AND id = ?`,
        [
          canonicalUrl,
          input.routeExternalId,
          input.routeStatus,
          input.routeRevision,
          input.lastIngestionId ?? null,
          slotValueHash,
          stringifyJson(input.context),
          now,
          templateId,
          input.id,
        ]
      );
      this.run('DELETE FROM page_slot_values WHERE template_id = ? AND page_instance_id = ?', [
        templateId,
        input.id,
      ]);
    }
    for (const entry of slotValues) {
      this.run(
        `INSERT INTO page_slot_values (
          page_instance_id, template_id, slot_id, value, normalized_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [input.id, templateId, entry.slot.id, entry.value, entry.normalized, now]
      );
    }
  }

  private buildCanonicalUrlFromPrepared(
    templateId: string,
    slotValues: readonly { slot: TemplateSlotRecord; value: string; normalized: string }[]
  ): string {
    const template = this.requireTemplate(templateId);
    const values = new Map(slotValues.map((entry) => [entry.slot.key, entry.value]));
    const referenced = new Set<string>();
    const path = template.urlPattern.replace(
      /\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
      (_token, key: string) => {
        referenced.add(key);
        const value = values.get(key);
        if (value === undefined || value.length === 0) {
          throw new CmsServiceError(
            'INVALID_INPUT',
            `URL pattern requires a value for slot "${key}".`
          );
        }
        return encodeURIComponent(value);
      }
    );
    if (/\{[^}]*\}/.test(path)) {
      throw new CmsServiceError('INVALID_INPUT', 'URL pattern contains an invalid placeholder.');
    }
    const orderedPathSlots = slotValues
      .filter((entry) => entry.slot.pathPosition !== null)
      .sort(
        (left, right) =>
          (left.slot.pathPosition ?? 0) - (right.slot.pathPosition ?? 0) ||
          left.slot.key.localeCompare(right.slot.key)
      );
    const pathSegments = path.split('/').filter(Boolean).map(decodeURIComponent);
    for (const entry of orderedPathSlots) {
      const position = entry.slot.pathPosition;
      if (position === null || pathSegments[position] !== entry.value) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          `URL pattern position ${String(position)} must resolve from slot "${entry.slot.key}".`
        );
      }
      if (entry.slot.kind !== 'static' && !referenced.has(entry.slot.key)) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          `Ordered variable slot "${entry.slot.key}" must appear in the URL pattern.`
        );
      }
    }
    if (!path.startsWith('/') || path.includes('//')) {
      throw new CmsServiceError('INVALID_INPUT', 'URL pattern must resolve to one absolute path.');
    }
    return path;
  }

  buildCanonicalUrl(
    templateId: string,
    slotInput: Readonly<Record<string, string | number | boolean>>
  ): { readonly path: string; readonly url: string } {
    const template = this.requireTemplate(templateId);
    const path = this.buildCanonicalUrlFromPrepared(
      templateId,
      this.prepareSlotValues(templateId, slotInput)
    );
    return { path, url: `https://${template.domain}${path}` };
  }

  createPage(templateId: string, input: PageInput): PageRecord {
    this.requireTemplate(templateId, true);
    this.transaction(() => this.writePage(templateId, input, 'insert'));
    return this.requirePage(templateId, input.id);
  }

  private pageFromRow(row: PageRow): PageRecord {
    const slotRows = this.all<{ key: string; value: string }>(
      `SELECT ts.key, psv.value
       FROM page_slot_values AS psv
       JOIN template_slots AS ts
         ON ts.id = psv.slot_id AND ts.template_id = psv.template_id
       WHERE psv.template_id = ? AND psv.page_instance_id = ?
       ORDER BY ts.key`,
      [row.templateId, row.id]
    );
    const context = parseJsonObject(row.contextJson);
    return {
      ...row,
      context,
      contextHash: canonicalHash(context),
      slotValues: Object.fromEntries(slotRows.map((slot) => [slot.key, slot.value])),
    };
  }

  private requirePage(templateId: string, pageId: string): PageRecord {
    const row = this.get<PageRow>(`${pageSelect} WHERE template_id = ? AND id = ?`, [
      templateId,
      pageId,
    ]);
    if (!row) {
      throw new CmsServiceError('NOT_FOUND', `Page "${pageId}" was not found in the template.`);
    }
    return this.pageFromRow(row);
  }

  getPage(templateId: string, pageId: string): PageRecord | null {
    const row = this.get<PageRow>(`${pageSelect} WHERE template_id = ? AND id = ?`, [
      templateId,
      pageId,
    ]);
    return row ? this.pageFromRow(row) : null;
  }

  updatePage(templateId: string, pageId: string, input: Omit<PageInput, 'id'>): PageRecord {
    this.requireTemplate(templateId, true);
    const current = this.requirePage(templateId, pageId);
    if (current.routeStatus === 'archived' && input.routeStatus !== 'archived') {
      throw new CmsServiceError(
        'ARCHIVED_GUARD',
        `Archived page "${pageId}" requires an explicit restore transition.`
      );
    }
    this.transaction(() => this.writePage(templateId, { ...input, id: pageId }, 'update'));
    return this.requirePage(templateId, pageId);
  }

  restoreArchivedPage(
    templateId: string,
    pageId: string,
    input: Omit<PageInput, 'id' | 'routeStatus'> & {
      readonly routeStatus: Exclude<RouteStatus, 'archived'>;
    }
  ): PageRecord {
    this.requireTemplate(templateId, true);
    const current = this.requirePage(templateId, pageId);
    if (current.routeStatus !== 'archived') {
      throw new CmsServiceError(
        'INVALID_INPUT',
        `Page "${pageId}" is not archived and does not require restoration.`
      );
    }
    this.transaction(() => this.writePage(templateId, { ...input, id: pageId }, 'update'));
    return this.requirePage(templateId, pageId);
  }

  deletePage(templateId: string, pageId: string): void {
    this.requireTemplate(templateId, true);
    const page = this.requirePage(templateId, pageId);
    if (page.routeStatus === 'archived') {
      return;
    }
    this.updatePage(templateId, pageId, {
      canonicalUrl: page.canonicalUrl,
      routeExternalId: page.routeExternalId,
      routeStatus: 'archived',
      routeRevision: page.routeRevision,
      context: page.context,
      slotValues: page.slotValues,
      lastIngestionId: page.lastIngestionId,
    });
  }

  listPages(
    templateId: string,
    input: { readonly limit?: number; readonly cursor?: string; readonly status?: RouteStatus } = {}
  ): CursorPage<PageRecord> {
    this.requireTemplate(templateId);
    const limit = assertPageLimit(input.limit ?? 25);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const clauses = ['template_id = ?'];
    const parameters: SQLQueryBindings[] = [templateId];
    if (input.status) {
      clauses.push('route_status = ?');
      parameters.push(input.status);
    }
    if (cursor) {
      clauses.push('(canonical_url > ? OR (canonical_url = ? AND id > ?))');
      parameters.push(cursor.value, cursor.value, cursor.id);
    }
    parameters.push(limit + 1);
    const rows = this.all<PageRow>(
      `${pageSelect} WHERE ${clauses.join(' AND ')} ORDER BY canonical_url, id LIMIT ?`,
      parameters
    );
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const items = selected.map((row) => this.pageFromRow(row));
    const last = selected.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor({ value: last.canonicalUrl, id: last.id }) : null,
    };
  }

  importCamoPressRoutes(input: RouteImportInput): RouteImportResult {
    this.requireTemplate(input.templateId, true);
    const sourceObservedAt = normalizeSourceObservedAt(input.observedAt);
    const routes = [...input.routes].sort(
      (left, right) =>
        left.routeExternalId.localeCompare(right.routeExternalId) || left.id.localeCompare(right.id)
    );
    const checksum = canonicalHash({
      templateId: input.templateId,
      sourceRevision: input.sourceRevision,
      sourceObservedAt,
      routes: routes.map((route) => ({
        id: route.id,
        canonicalUrl: route.canonicalUrl,
        routeExternalId: route.routeExternalId,
        routeStatus: route.routeStatus,
        context: route.context,
        slotValues: route.slotValues,
      })),
    });
    const existingIngestion = this.get<{
      id: string;
      checksum: string;
      status: 'running' | 'succeeded' | 'failed';
      rowCount: number;
      sourceObservedAt: string;
    }>(
      `SELECT id, checksum, status, row_count AS rowCount,
              source_observed_at AS sourceObservedAt
       FROM route_ingestions
       WHERE template_id = ? AND source = 'camo_press' AND source_revision = ?`,
      [input.templateId, input.sourceRevision]
    );
    if (existingIngestion) {
      if (existingIngestion.checksum !== checksum || existingIngestion.status !== 'succeeded') {
        throw new CmsServiceError(
          'CONFLICT',
          `Camo Press revision "${input.sourceRevision}" was already imported with different input.`
        );
      }
      return {
        ingestionId: existingIngestion.id,
        checksum,
        sourceObservedAt: existingIngestion.sourceObservedAt,
        rowCount: existingIngestion.rowCount,
        inserted: 0,
        updated: 0,
        statusChanged: 0,
        skippedArchived: routes.filter((route) => {
          const page = this.get<PageRow>(
            `${pageSelect} WHERE template_id = ? AND route_external_id = ?`,
            [input.templateId, route.routeExternalId]
          );
          return page?.routeStatus === 'archived' && route.routeStatus !== 'archived';
        }).length,
        unchanged: existingIngestion.rowCount,
        notLive: routes.filter((route) => route.routeStatus === 'not_live').length,
        archived: routes.filter((route) => route.routeStatus === 'archived').length,
        rejected: routes.filter((route) => {
          const page = this.get<PageRow>(
            `${pageSelect} WHERE template_id = ? AND route_external_id = ?`,
            [input.templateId, route.routeExternalId]
          );
          return page?.routeStatus === 'archived' && route.routeStatus !== 'archived';
        }).length,
        idempotent: true,
      };
    }

    const counters = {
      inserted: 0,
      updated: 0,
      statusChanged: 0,
      skippedArchived: 0,
      unchanged: 0,
      notLive: routes.filter((route) => route.routeStatus === 'not_live').length,
      archived: routes.filter((route) => route.routeStatus === 'archived').length,
      rejected: 0,
    };
    const startedAt = this.now();
    try {
      this.transaction(() => {
        this.run(
          `INSERT INTO route_ingestions (
          id, template_id, source, source_revision, status, checksum, row_count,
          source_observed_at, started_at, completed_at, created_at
        ) VALUES (?, ?, 'camo_press', ?, 'running', ?, 0, ?, ?, NULL, ?)`,
          [
            input.id,
            input.templateId,
            input.sourceRevision,
            checksum,
            sourceObservedAt,
            startedAt,
            startedAt,
          ]
        );

        routes.forEach((route, index) => {
          const existing = this.get<PageRow>(
            `${pageSelect} WHERE template_id = ? AND route_external_id = ?`,
            [input.templateId, route.routeExternalId]
          );
          let action: 'insert' | 'update' | 'status' | 'skip';
          let pageId = route.id;
          let previousStatus: RouteStatus | null = null;
          let nextStatus = route.routeStatus;
          let outcome: 'inserted' | 'updated' | 'status' | 'unchanged' | 'rejected';
          if (!existing) {
            this.writePage(
              input.templateId,
              { ...route, lastIngestionId: input.id, routeRevision: input.sourceRevision },
              'insert'
            );
            counters.inserted += 1;
            action = 'insert';
            outcome = 'inserted';
          } else if (existing.routeStatus === 'archived' && route.routeStatus !== 'archived') {
            action = 'skip';
            pageId = existing.id;
            previousStatus = 'archived';
            nextStatus = 'archived';
            counters.skippedArchived += 1;
            counters.rejected += 1;
            outcome = 'rejected';
          } else {
            pageId = existing.id;
            previousStatus = existing.routeStatus;
            const prepared = this.prepareSlotValues(input.templateId, route.slotValues);
            const expectedUrl = this.buildCanonicalUrlFromPrepared(input.templateId, prepared);
            if (expectedUrl !== route.canonicalUrl) {
              throw new CmsServiceError(
                'INVALID_INPUT',
                `Canonical URL must be "${expectedUrl}" for the supplied template slots.`
              );
            }
            const expectedSlotHash = canonicalHash(
              Object.fromEntries(prepared.map((entry) => [entry.slot.key, entry.normalized]))
            );
            const unchanged =
              existing.canonicalUrl === route.canonicalUrl &&
              existing.routeStatus === route.routeStatus &&
              existing.slotValueHash === expectedSlotHash &&
              canonicalHash(parseJsonObject(existing.contextJson)) === canonicalHash(route.context);
            action = existing.routeStatus === route.routeStatus ? 'update' : 'status';
            if (unchanged) {
              this.run(
                `UPDATE page_instances
               SET route_revision = ?, last_ingestion_id = ?, updated_at = ?
               WHERE template_id = ? AND id = ?`,
                [input.sourceRevision, input.id, this.now(), input.templateId, existing.id]
              );
              counters.unchanged += 1;
              outcome = 'unchanged';
            } else {
              this.writePage(
                input.templateId,
                {
                  ...route,
                  id: existing.id,
                  lastIngestionId: input.id,
                  routeRevision: input.sourceRevision,
                },
                'update'
              );
              outcome = action === 'status' ? 'status' : 'updated';
            }
            if (!unchanged && action === 'status') {
              counters.statusChanged += 1;
            } else if (!unchanged) {
              counters.updated += 1;
            }
          }
          this.run(
            `INSERT INTO route_audit_log (
            id, ingestion_id, page_instance_id, route_external_id, canonical_url,
            action, previous_status, next_status, detail_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              `${input.id}:audit:${index.toString().padStart(8, '0')}`,
              input.id,
              pageId,
              route.routeExternalId,
              route.canonicalUrl,
              action,
              previousStatus,
              nextStatus,
              stringifyJson({
                source: 'camo_press',
                sourceRevision: input.sourceRevision,
                sourceObservedAt,
                outcome,
              }),
              this.now(),
            ]
          );
        });

        this.run(
          `UPDATE route_ingestions
           SET status = 'succeeded', row_count = ?, completed_at = ?
           WHERE template_id = ? AND id = ?`,
          [routes.length, this.now(), input.templateId, input.id]
        );
      });
    } catch (error) {
      const failedAt = this.now();
      const firstRoute = routes[0];
      this.transaction(() => {
        this.run(
          `INSERT OR IGNORE INTO route_ingestions (
            id, template_id, source, source_revision, status, checksum, row_count,
            source_observed_at, started_at, completed_at, created_at
          ) VALUES (?, ?, 'camo_press', ?, 'failed', ?, ?, ?, ?, ?, ?)`,
          [
            input.id,
            input.templateId,
            input.sourceRevision,
            checksum,
            routes.length,
            sourceObservedAt,
            startedAt,
            failedAt,
            startedAt,
          ]
        );
        this.run(
          `INSERT OR IGNORE INTO route_audit_log (
            id, ingestion_id, page_instance_id, route_external_id, canonical_url,
            action, previous_status, next_status, detail_json, created_at
          ) VALUES (?, ?, NULL, ?, ?, 'error', NULL, NULL, ?, ?)`,
          [
            `${input.id}:audit:error`,
            input.id,
            firstRoute?.routeExternalId ?? '(batch)',
            firstRoute?.canonicalUrl ?? '/',
            stringifyJson({
              source: 'camo_press',
              sourceRevision: input.sourceRevision,
              sourceObservedAt,
              error: error instanceof Error ? error.message : 'Unknown ingestion error',
            }),
            failedAt,
          ]
        );
      });
      throw error;
    }

    return {
      ingestionId: input.id,
      checksum,
      sourceObservedAt,
      rowCount: routes.length,
      ...counters,
      idempotent: false,
    };
  }

  listRouteAudit(
    templateId: string,
    ingestionId: string
  ): readonly {
    id: string;
    pageInstanceId: string | null;
    routeExternalId: string;
    canonicalUrl: string;
    action: 'insert' | 'update' | 'status' | 'skip' | 'error';
    previousStatus: RouteStatus | null;
    nextStatus: RouteStatus | null;
    detail: JsonObject;
    createdAt: string;
  }[] {
    this.requireTemplate(templateId);
    const rows = this.all<{
      id: string;
      pageInstanceId: string | null;
      routeExternalId: string;
      canonicalUrl: string;
      action: 'insert' | 'update' | 'status' | 'skip' | 'error';
      previousStatus: RouteStatus | null;
      nextStatus: RouteStatus | null;
      detailJson: string;
      createdAt: string;
    }>(
      `SELECT audit.id, audit.page_instance_id AS pageInstanceId,
              audit.route_external_id AS routeExternalId, audit.canonical_url AS canonicalUrl,
              audit.action, audit.previous_status AS previousStatus, audit.next_status AS nextStatus,
              audit.detail_json AS detailJson, audit.created_at AS createdAt
       FROM route_audit_log AS audit
       JOIN route_ingestions AS ingestion ON ingestion.id = audit.ingestion_id
       WHERE ingestion.template_id = ? AND ingestion.id = ?
       ORDER BY audit.created_at, audit.id`,
      [templateId, ingestionId]
    );
    return rows.map(({ detailJson, ...row }) => ({ ...row, detail: parseJsonObject(detailJson) }));
  }

  createTag(templateId: string, input: TagInput): TagRecord {
    this.requireTemplate(templateId, true);
    const namespace = normalizeMachineValue(input.namespace);
    const value = normalizeMachineValue(input.value);
    this.run(
      `INSERT INTO tags (
        id, template_id, namespace, value, label, description, source, parent_tag_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        templateId,
        namespace,
        value,
        input.label,
        input.description ?? '',
        input.source,
        input.parentTagId ?? null,
        this.now(),
      ]
    );
    return this.requireTag(templateId, input.id);
  }

  private requireTag(templateId: string, tagId: string): TagRecord {
    const row = this.get<TagRow>(`${tagSelect} WHERE template_id = ? AND id = ?`, [
      templateId,
      tagId,
    ]);
    if (!row) {
      throw new CmsServiceError('NOT_FOUND', `Tag "${tagId}" was not found in the template.`);
    }
    return row;
  }

  listTags(templateId: string): readonly TagRecord[] {
    this.requireTemplate(templateId);
    return this.all<TagRow>(`${tagSelect} WHERE template_id = ? ORDER BY namespace, value, id`, [
      templateId,
    ]);
  }

  updateTag(templateId: string, tagId: string, input: Omit<TagInput, 'id'>): TagRecord {
    this.requireTemplate(templateId, true);
    this.requireTag(templateId, tagId);
    this.run(
      `UPDATE tags
       SET namespace = ?, value = ?, label = ?, description = ?, source = ?, parent_tag_id = ?
       WHERE template_id = ? AND id = ?`,
      [
        normalizeMachineValue(input.namespace),
        normalizeMachineValue(input.value),
        input.label,
        input.description ?? '',
        input.source,
        input.parentTagId ?? null,
        templateId,
        tagId,
      ]
    );
    return this.requireTag(templateId, tagId);
  }

  deleteTag(templateId: string, tagId: string): void {
    this.requireTemplate(templateId, true);
    this.requireTag(templateId, tagId);
    this.run('DELETE FROM tags WHERE template_id = ? AND id = ?', [templateId, tagId]);
  }

  assignTags(
    templateId: string,
    pageId: string,
    tagIds: readonly string[],
    source: 'pipeline' | 'author' | 'seed'
  ): readonly PageTagRecord[] {
    this.requireTemplate(templateId, true);
    this.requirePage(templateId, pageId);
    const uniqueTagIds = [...new Set(tagIds)].sort();
    this.transaction(() => {
      for (const tagId of uniqueTagIds) {
        this.requireTag(templateId, tagId);
        this.run(
          `INSERT INTO page_tags (
            page_instance_id, template_id, tag_id, source, created_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(page_instance_id, tag_id) DO UPDATE SET source = excluded.source`,
          [pageId, templateId, tagId, source, this.now()]
        );
      }
    });
    return this.getTagsForPage(templateId, pageId);
  }

  unassignTag(templateId: string, pageId: string, tagId: string): void {
    this.requirePage(templateId, pageId);
    this.run(
      'DELETE FROM page_tags WHERE template_id = ? AND page_instance_id = ? AND tag_id = ?',
      [templateId, pageId, tagId]
    );
  }

  getTagsForPage(templateId: string, pageId: string): readonly PageTagRecord[] {
    this.requirePage(templateId, pageId);
    const rows = this.all<
      {
        tagId: string;
        assignmentSource: 'pipeline' | 'author' | 'seed';
        assignedAt: string;
      } & TagRow
    >(
      `SELECT t.id, t.template_id AS templateId, t.namespace, t.value, t.label,
              t.description, t.source, t.parent_tag_id AS parentTagId,
              t.created_at AS createdAt, pt.page_instance_id AS pageInstanceId,
              pt.source AS assignmentSource, pt.created_at AS assignedAt,
              pt.tag_id AS tagId
       FROM page_tags AS pt
       JOIN tags AS t ON t.id = pt.tag_id AND t.template_id = pt.template_id
       WHERE pt.template_id = ? AND pt.page_instance_id = ?
       ORDER BY t.namespace, t.value, t.id`,
      [templateId, pageId]
    );
    return rows.map((row) => ({
      pageInstanceId: pageId,
      templateId,
      tag: {
        id: row.id,
        templateId: row.templateId,
        namespace: row.namespace,
        value: row.value,
        label: row.label,
        description: row.description,
        source: row.source,
        parentTagId: row.parentTagId,
        createdAt: row.createdAt,
      },
      assignmentSource: row.assignmentSource,
      assignedAt: row.assignedAt,
    }));
  }

  getPagesForTag(
    templateId: string,
    tagId: string,
    input: { readonly limit?: number; readonly cursor?: string } = {}
  ): CursorPage<PageRecord> {
    this.requireTag(templateId, tagId);
    const limit = assertPageLimit(input.limit ?? 25);
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = this.all<PageRow>(
      `SELECT page_instances.id, page_instances.template_id AS templateId,
              page_instances.canonical_url AS canonicalUrl,
              page_instances.route_external_id AS routeExternalId,
              page_instances.route_status AS routeStatus,
              page_instances.route_revision AS routeRevision,
              page_instances.last_ingestion_id AS lastIngestionId,
              page_instances.slot_value_hash AS slotValueHash,
              page_instances.context_json AS contextJson,
              page_instances.created_at AS createdAt,
              page_instances.updated_at AS updatedAt
       FROM page_instances AS page_instances
       JOIN page_tags AS pt
         ON pt.page_instance_id = page_instances.id AND pt.template_id = page_instances.template_id
       WHERE page_instances.template_id = ? AND pt.tag_id = ?
         ${cursor ? 'AND (page_instances.canonical_url > ? OR (page_instances.canonical_url = ? AND page_instances.id > ?))' : ''}
       ORDER BY page_instances.canonical_url, page_instances.id LIMIT ?`,
      cursor
        ? [templateId, tagId, cursor.value, cursor.value, cursor.id, limit + 1]
        : [templateId, tagId, limit + 1]
    );
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const last = selected.at(-1);
    return {
      items: selected.map((row) => this.pageFromRow(row)),
      nextCursor: hasMore && last ? encodeCursor({ value: last.canonicalUrl, id: last.id }) : null,
    };
  }

  previewBulkTagChange(templateId: string, input: BulkTagChangeInput): BulkTagChangePreview {
    this.requireTag(templateId, input.tagId);
    const compilation = compileApprovedSelector(
      input.selector,
      this.getApprovedReadSurface(templateId).fields
    );
    const matchingPageIds = this.all<{ id: string }>(
      `SELECT p.id
       FROM page_instances AS p
       WHERE p.template_id = ? AND (${compilation.predicateSql})
       ORDER BY p.canonical_url, p.id`,
      [templateId, ...compilation.parameters]
    ).map((row) => row.id);
    const assigned = new Set(
      this.all<{ id: string }>(
        `SELECT page_instance_id AS id
         FROM page_tags
         WHERE template_id = ? AND tag_id = ?
         ORDER BY page_instance_id`,
        [templateId, input.tagId]
      ).map((row) => row.id)
    );
    const changingPageIds = matchingPageIds.filter((pageId) =>
      input.mode === 'assign' ? !assigned.has(pageId) : assigned.has(pageId)
    );
    return {
      templateId,
      tagId: input.tagId,
      mode: input.mode,
      normalizedSelector: compilation.normalized,
      matchingCount: matchingPageIds.length,
      changingCount: changingPageIds.length,
      changingPageIds,
      samplePageIds: changingPageIds.slice(0, 20),
    };
  }

  applyBulkTagChange(
    templateId: string,
    input: BulkTagChangeInput & {
      readonly source: 'pipeline' | 'author' | 'seed';
      readonly changedBy: string;
    }
  ): BulkTagChangeResult {
    this.requireTemplate(templateId, true);
    return this.transaction(() => {
      const preview = this.previewBulkTagChange(templateId, input);
      const changedAt = this.now();
      for (const pageId of preview.changingPageIds) {
        if (input.mode === 'assign') {
          this.run(
            `INSERT INTO page_tags (
              page_instance_id, template_id, tag_id, source, created_at
            ) VALUES (?, ?, ?, ?, ?)`,
            [pageId, templateId, input.tagId, input.source, changedAt]
          );
        } else {
          this.run(
            `DELETE FROM page_tags
             WHERE template_id = ? AND page_instance_id = ? AND tag_id = ?`,
            [templateId, pageId, input.tagId]
          );
        }
      }
      return {
        ...preview,
        changedAt,
        changedBy: input.changedBy,
        assignmentSource: input.source,
      };
    });
  }

  getApprovedReadSurface(templateId: string): ApprovedReadSurface {
    this.requireTemplate(templateId);
    const builtins: ApprovedSelectorField[] = [
      {
        name: 'canonical_url',
        kind: 'builtin',
        cardinality: 'scalar',
        valueType: 'string',
        sourceKey: 'canonical_url',
      },
      {
        name: 'route_external_id',
        kind: 'builtin',
        cardinality: 'scalar',
        valueType: 'string',
        sourceKey: 'route_external_id',
      },
      {
        name: 'route_status',
        kind: 'builtin',
        cardinality: 'scalar',
        valueType: 'string',
        sourceKey: 'route_status',
      },
    ];
    const slots = this.listTemplateSlots(templateId);
    const namespaces = this.all<{ namespace: string }>(
      'SELECT DISTINCT namespace FROM tags WHERE template_id = ? ORDER BY namespace',
      [templateId]
    ).map((row) => row.namespace);
    const reserved = new Set(builtins.map((field) => field.name));
    const slotKeys = new Set(slots.map((slot) => slot.key));
    const tagKeys = new Set(namespaces);
    const fields = [...builtins];
    for (const slot of slots) {
      fields.push({
        name: `slot.${slot.key}`,
        kind: 'slot',
        cardinality: 'scalar',
        valueType: slot.valueType,
        sourceKey: slot.key,
      });
      if (!reserved.has(slot.key) && !tagKeys.has(slot.key)) {
        fields.push({
          name: slot.key,
          kind: 'slot',
          cardinality: 'scalar',
          valueType: slot.valueType,
          sourceKey: slot.key,
        });
      }
    }
    for (const namespace of namespaces) {
      fields.push({
        name: `tag.${namespace}`,
        kind: 'tag',
        cardinality: 'multi',
        valueType: 'string',
        sourceKey: namespace,
      });
      if (!reserved.has(namespace) && !slotKeys.has(namespace)) {
        fields.push({
          name: namespace,
          kind: 'tag',
          cardinality: 'multi',
          valueType: 'string',
          sourceKey: namespace,
        });
      }
    }
    return {
      templateId,
      fields: fields.sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  previewSelector(templateId: string, selector: string, requestedLimit = 50): SelectorPreview {
    this.requireTemplate(templateId);
    const limit = assertPageLimit(requestedLimit, this.selectorPreviewLimit);
    const compilation = compileApprovedSelector(
      selector,
      this.getApprovedReadSurface(templateId).fields
    );
    const query = `
      SELECT p.id AS pageId, p.canonical_url AS canonicalUrl,
             p.route_status AS routeStatus, p.context_json AS contextJson
      FROM page_instances AS p
      WHERE p.template_id = ? AND (${compilation.predicateSql})
      ORDER BY p.canonical_url, p.id
      LIMIT ?
    `;
    const parameters: SQLQueryBindings[] = [templateId, ...compilation.parameters, limit + 1];
    const rows = this.all<{
      pageId: string;
      canonicalUrl: string;
      routeStatus: RouteStatus;
      contextJson: string;
    }>(query, parameters);
    const plan = this.all<{ id: number; parent: number; detail: string }>(
      `EXPLAIN QUERY PLAN ${query}`,
      parameters
    ).map<SelectorPlanStep>((row) => ({ id: row.id, parent: row.parent, detail: row.detail }));
    const totalCount =
      this.get<{ count: number }>(
        `SELECT count(*) AS count
         FROM page_instances AS p
         WHERE p.template_id = ? AND (${compilation.predicateSql})`,
        [templateId, ...compilation.parameters]
      )?.count ?? 0;
    const templatePageCount =
      this.get<{ count: number }>(
        'SELECT count(*) AS count FROM page_instances WHERE template_id = ?',
        [templateId]
      )?.count ?? 0;
    const warnings: ('zero_match' | 'full_template')[] = [];
    if (totalCount === 0) {
      warnings.push('zero_match');
    }
    if (templatePageCount > 0 && totalCount === templatePageCount) {
      warnings.push('full_template');
    }
    return {
      normalizedSelector: compilation.normalized,
      expression: compilation.expression,
      totalCount,
      templatePageCount,
      warnings,
      rows: rows.slice(0, limit).map((row) => ({
        pageId: row.pageId,
        canonicalUrl: row.canonicalUrl,
        routeStatus: row.routeStatus,
        contextHash: canonicalHash(parseJsonObject(row.contextJson)),
      })),
      truncated: rows.length > limit,
      limit,
      plan,
    };
  }

  registerBlockType(input: BlockTypeInput): BlockTypeInput {
    if (!Number.isSafeInteger(input.schemaVersion) || input.schemaVersion < 1) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Block schema versions must be positive integers.'
      );
    }
    this.run(
      `INSERT INTO block_types (
        id, key, name, schema_version, schema_json, preview_renderer_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.key,
        input.name,
        input.schemaVersion,
        stringifyJson(input.schema),
        input.previewRenderer ? stringifyJson(input.previewRenderer) : null,
        this.now(),
        this.now(),
      ]
    );
    return input;
  }

  createBlockLineage(templateId: string, input: BlockLineageInput): BlockLineageInput {
    this.requireTemplate(templateId, true);
    this.run(
      `INSERT INTO block_lineages (id, template_id, key, label, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [input.id, templateId, input.key, input.label, this.now()]
    );
    return input;
  }

  private blockVersionFromRow(row: BlockVersionRow): BlockVersionRecord {
    return { ...row, content: parseJsonObject(row.contentJson) };
  }

  private requireBlockVersion(templateId: string, blockVersionId: string): BlockVersionRecord {
    const row = this.get<BlockVersionRow>(
      `SELECT versions.id, lineages.template_id AS templateId,
              versions.lineage_id AS lineageId,
              versions.parent_version_id AS parentVersionId,
              versions.version_number AS versionNumber,
              versions.block_type_id AS blockTypeId, types.key AS blockTypeKey,
              versions.schema_version AS schemaVersion, versions.content_json AS contentJson,
              versions.content_hash AS contentHash, versions.created_by AS createdBy,
              versions.created_at AS createdAt
       FROM block_versions AS versions
       JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
       JOIN block_types AS types ON types.id = versions.block_type_id
       WHERE lineages.template_id = ? AND versions.id = ?`,
      [templateId, blockVersionId]
    );
    if (!row) {
      throw new CmsServiceError(
        'NOT_FOUND',
        `Block version "${blockVersionId}" was not found in the template.`
      );
    }
    return this.blockVersionFromRow(row);
  }

  getBlockVersion(templateId: string, blockVersionId: string): BlockVersionRecord | null {
    try {
      return this.requireBlockVersion(templateId, blockVersionId);
    } catch (error) {
      if (error instanceof CmsServiceError && error.code === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  private requireBlockType(blockTypeKey: string): {
    id: string;
    key: string;
    schemaVersion: number;
    schema: JsonObject;
  } {
    const row = this.get<{
      id: string;
      key: string;
      schemaVersion: number;
      schemaJson: string;
    }>(
      `SELECT id, key, schema_version AS schemaVersion, schema_json AS schemaJson
       FROM block_types WHERE key = ?`,
      [blockTypeKey]
    );
    if (!row) {
      throw new CmsServiceError('NOT_FOUND', `Block type "${blockTypeKey}" was not found.`);
    }
    return { ...row, schema: parseJsonObject(row.schemaJson) };
  }

  private insertBlockVersion(
    templateId: string,
    input: CreateBlockVersionInput,
    expectedVersion: number,
    parentVersionId: string | null
  ): BlockVersionRecord {
    const lineage = this.get<{ id: string }>(
      'SELECT id FROM block_lineages WHERE template_id = ? AND id = ?',
      [templateId, input.lineageId]
    );
    if (!lineage) {
      throw new CmsServiceError('NOT_FOUND', `Block lineage "${input.lineageId}" was not found.`);
    }
    const blockType = this.requireBlockType(input.blockTypeKey);
    try {
      assertBlockContent(blockType.schema, input.content);
    } catch (error) {
      throw new CmsServiceError(
        'SCHEMA_VALIDATION',
        error instanceof Error ? error.message : 'Block content failed schema validation.'
      );
    }
    const contentHash = canonicalHash({
      blockType: blockType.key,
      schemaVersion: blockType.schemaVersion,
      content: input.content,
    });
    this.run(
      `INSERT INTO block_versions (
        id, lineage_id, parent_version_id, version_number, block_type_id, schema_version,
        content_json, content_hash, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.lineageId,
        parentVersionId,
        expectedVersion,
        blockType.id,
        blockType.schemaVersion,
        stringifyJson(input.content),
        contentHash,
        input.createdBy,
        this.now(),
      ]
    );
    return this.requireBlockVersion(templateId, input.id);
  }

  createBlockVersion(templateId: string, input: CreateBlockVersionInput): BlockVersionRecord {
    this.requireTemplate(templateId, true);
    return this.transaction(() => {
      const count = this.get<{ count: number }>(
        `SELECT count(*) AS count
         FROM block_versions AS versions
         JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
         WHERE lineages.template_id = ? AND versions.lineage_id = ?`,
        [templateId, input.lineageId]
      )?.count;
      if (count !== 0) {
        throw new CmsServiceError(
          'CONFLICT',
          `Lineage "${input.lineageId}" already has a first version; fork it instead.`
        );
      }
      return this.insertBlockVersion(templateId, input, 1, null);
    });
  }

  private forkBlockVersionUnsafe(
    templateId: string,
    input: ForkBlockVersionInput
  ): BlockVersionRecord {
    const source = this.requireBlockVersion(templateId, input.sourceVersionId);
    const nextVersion =
      (this.get<{ versionNumber: number | null }>(
        `SELECT max(versions.version_number) AS versionNumber
         FROM block_versions AS versions
         JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
         WHERE lineages.template_id = ? AND versions.lineage_id = ?`,
        [templateId, source.lineageId]
      )?.versionNumber ?? 0) + 1;
    return this.insertBlockVersion(
      templateId,
      {
        id: input.id,
        lineageId: source.lineageId,
        blockTypeKey: input.blockTypeKey ?? source.blockTypeKey,
        content: input.content,
        createdBy: input.createdBy,
      },
      nextVersion,
      source.id
    );
  }

  forkBlockVersion(templateId: string, input: ForkBlockVersionInput): BlockVersionRecord {
    this.requireTemplate(templateId, true);
    return this.transaction(() => this.forkBlockVersionUnsafe(templateId, input));
  }

  interpolateBlockVersion(
    templateId: string,
    blockVersionId: string,
    context: JsonObject
  ): JsonObject {
    const interpolated = interpolateJson(
      this.requireBlockVersion(templateId, blockVersionId).content,
      context
    );
    if (interpolated === null || typeof interpolated !== 'object' || Array.isArray(interpolated)) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Interpolated block content must remain an object.'
      );
    }
    return interpolated as JsonObject;
  }

  private variantFromRow(row: VariantRow): VariantRecord {
    return { ...row, isDefault: row.isDefault === 1 };
  }

  private requireVariant(templateId: string, variantId: string): VariantRecord {
    const row = this.get<VariantRow>(`${variantSelect} WHERE template_id = ? AND id = ?`, [
      templateId,
      variantId,
    ]);
    if (!row) {
      throw new CmsServiceError(
        'NOT_FOUND',
        `Variant "${variantId}" was not found in the template.`
      );
    }
    return this.variantFromRow(row);
  }

  getVariant(templateId: string, variantId: string): VariantRecord | null {
    const row = this.get<VariantRow>(`${variantSelect} WHERE template_id = ? AND id = ?`, [
      templateId,
      variantId,
    ]);
    return row ? this.variantFromRow(row) : null;
  }

  listVariants(templateId: string): readonly VariantRecord[] {
    this.requireTemplate(templateId);
    return this.all<VariantRow>(`${variantSelect} WHERE template_id = ? ORDER BY priority, id`, [
      templateId,
    ]).map((row) => this.variantFromRow(row));
  }

  private revisionFromRow(row: RevisionRow): VariantRevisionRecord {
    return {
      id: row.id,
      variantId: row.variantId,
      revisionNumber: row.revisionNumber,
      originalSelector: row.selectorInput,
      selector: row.selectorSql,
      selectorHash: row.selectorHash,
      validationResult: parseJsonObject(row.validationResultJson) as unknown as {
        status: 'valid';
        normalizedSelector: string;
      },
      selectorDescription: row.selectorDescription,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  private requireRevision(
    templateId: string,
    variantId: string,
    revisionId: string
  ): VariantRevisionRecord {
    const row = this.get<RevisionRow>(
      `SELECT revisions.id, revisions.variant_id AS variantId,
              revisions.revision_number AS revisionNumber,
              revisions.selector_input AS selectorInput,
              revisions.selector_sql AS selectorSql,
              revisions.selector_hash AS selectorHash,
              revisions.validation_result_json AS validationResultJson,
              revisions.selector_description AS selectorDescription,
              revisions.created_by AS createdBy, revisions.created_at AS createdAt
       FROM variant_revisions AS revisions
       JOIN variants AS owner ON owner.id = revisions.variant_id
       WHERE owner.template_id = ? AND revisions.variant_id = ? AND revisions.id = ?`,
      [templateId, variantId, revisionId]
    );
    if (!row) {
      throw new CmsServiceError('NOT_FOUND', `Variant revision "${revisionId}" was not found.`);
    }
    return this.revisionFromRow(row);
  }

  createVariant(templateId: string, input: CreateVariantInput): VariantRecord {
    this.requireTemplate(templateId, true);
    if (!Number.isSafeInteger(input.priority) || input.priority <= 0) {
      throw new CmsServiceError('INVALID_INPUT', 'Variant priority must be a positive integer.');
    }
    const selector = compileApprovedSelector(
      input.selector,
      this.getApprovedReadSurface(templateId).fields
    ).normalized;
    this.transaction(() => {
      const now = this.now();
      this.run(
        `INSERT INTO variants (
          id, template_id, key, name, description, is_default, priority, status,
          active_revision_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?)`,
        [
          input.id,
          templateId,
          input.key,
          input.name,
          input.description ?? '',
          input.priority,
          input.status ?? 'draft',
          now,
          now,
        ]
      );
      this.run(
        `INSERT INTO variant_revisions (
          id, variant_id, revision_number, selector_input, selector_sql, selector_hash,
          validation_result_json, selector_description, created_by, created_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.revisionId,
          input.id,
          input.selector,
          selector,
          canonicalHash(selector),
          stringifyJson({ status: 'valid', normalizedSelector: selector }),
          input.selectorDescription ?? '',
          input.createdBy,
          now,
        ]
      );
      if ((input.mode ?? 'linked') === 'empty') {
        const inheritedPlacements = this.all<{ placementKey: string }>(
          `SELECT DISTINCT operations.placement_key AS placementKey
           FROM variant_operations AS operations
           JOIN variant_revisions AS revisions
             ON revisions.id = operations.variant_revision_id
           JOIN variants AS owners ON owners.id = revisions.variant_id
           WHERE owners.template_id = ?
             AND operations.operation_kind = 'set'
             AND (
               owners.is_default = 1
               OR (owners.status = 'active' AND owners.priority < ?)
             )
           ORDER BY operations.placement_key`,
          [templateId, input.priority]
        );
        for (const placement of inheritedPlacements) {
          this.run(
            `INSERT INTO variant_operations (
              id, variant_revision_id, placement_key, operation_kind,
              block_version_id, order_index, created_at
            ) VALUES (?, ?, ?, 'tombstone', NULL, NULL, ?)`,
            [this.createId('operation'), input.revisionId, placement.placementKey, now]
          );
        }
      }
      this.run(
        'UPDATE variants SET active_revision_id = ?, updated_at = ? WHERE template_id = ? AND id = ?',
        [input.revisionId, now, templateId, input.id]
      );
    });
    return this.requireVariant(templateId, input.id);
  }

  setVariantPriority(templateId: string, variantId: string, priority: number): VariantRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
    }
    if (variant.isDefault || !Number.isSafeInteger(priority) || priority <= 0) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Only non-default variants accept positive priority.'
      );
    }
    this.run('UPDATE variants SET priority = ?, updated_at = ? WHERE template_id = ? AND id = ?', [
      priority,
      this.now(),
      templateId,
      variantId,
    ]);
    return this.requireVariant(templateId, variantId);
  }

  setVariantStatus(
    templateId: string,
    variantId: string,
    status: 'draft' | 'active' | 'archived'
  ): VariantRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault && status !== 'active') {
      throw new CmsServiceError('INVALID_INPUT', 'The template default must remain active.');
    }
    this.run('UPDATE variants SET status = ?, updated_at = ? WHERE template_id = ? AND id = ?', [
      status,
      this.now(),
      templateId,
      variantId,
    ]);
    return this.requireVariant(templateId, variantId);
  }

  private loadRevisionOperations(templateId: string, revisionId: string): readonly OperationRow[] {
    return this.all<OperationRow>(
      `SELECT operations.id, operations.variant_revision_id AS variantRevisionId,
              operations.placement_key AS placementKey,
              operations.operation_kind AS operationKind,
              operations.block_version_id AS blockVersionId,
              operations.order_index AS orderIndex, types.key AS blockTypeKey,
              types.id AS blockTypeId, versions.lineage_id AS lineageId,
              versions.schema_version AS schemaVersion, versions.content_json AS contentJson
       FROM variant_operations AS operations
       JOIN variant_revisions AS revisions ON revisions.id = operations.variant_revision_id
       JOIN variants ON variants.id = revisions.variant_id
       LEFT JOIN block_versions AS versions ON versions.id = operations.block_version_id
       LEFT JOIN block_types AS types ON types.id = versions.block_type_id
       WHERE variants.template_id = ? AND operations.variant_revision_id = ?
       ORDER BY operations.placement_key, operations.operation_kind, operations.id`,
      [templateId, revisionId]
    );
  }

  private forkRevisionSnapshotUnsafe(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly selector?: string;
      readonly selectorDescription?: string;
      readonly createdBy: string;
      readonly transform: (operations: readonly OperationRow[]) => readonly {
        placementKey: string;
        operationKind: 'set' | 'tombstone' | 'order';
        blockVersionId: string | null;
        orderIndex: number | null;
      }[];
    }
  ): VariantRevisionRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
    }
    if (!variant.activeRevisionId) {
      throw new CmsServiceError('CONFLICT', `Variant "${variantId}" has no active revision.`);
    }
    const current = this.requireRevision(templateId, variantId, variant.activeRevisionId);
    const currentOperations = this.loadRevisionOperations(templateId, current.id);
    const operations = input.transform(currentOperations);
    const revisionNumber =
      (this.get<{ revisionNumber: number | null }>(
        `SELECT max(revisions.revision_number) AS revisionNumber
         FROM variant_revisions AS revisions
         JOIN variants ON variants.id = revisions.variant_id
         WHERE variants.template_id = ? AND revisions.variant_id = ?`,
        [templateId, variantId]
      )?.revisionNumber ?? 0) + 1;
    const revisionId = input.revisionId ?? this.createId('revision');
    const selector = variant.isDefault
      ? 'TRUE'
      : compileApprovedSelector(
          input.selector ?? adaptStoredSelector(current.selector),
          this.getApprovedReadSurface(templateId).fields
        ).normalized;
    const selectorInput = variant.isDefault ? 'TRUE' : (input.selector ?? current.originalSelector);
    const createdAt = this.now();
    this.run(
      `INSERT INTO variant_revisions (
        id, variant_id, revision_number, selector_input, selector_sql, selector_hash,
        validation_result_json, selector_description, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        revisionId,
        variantId,
        revisionNumber,
        selectorInput,
        selector,
        canonicalHash(selector),
        stringifyJson({ status: 'valid', normalizedSelector: selector }),
        input.selectorDescription ?? current.selectorDescription,
        input.createdBy,
        createdAt,
      ]
    );
    operations
      .slice()
      .sort(
        (left, right) =>
          left.placementKey.localeCompare(right.placementKey) ||
          left.operationKind.localeCompare(right.operationKind)
      )
      .forEach((operation) => {
        this.run(
          `INSERT INTO variant_operations (
            id, variant_revision_id, placement_key, operation_kind,
            block_version_id, order_index, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            this.createId('operation'),
            revisionId,
            operation.placementKey,
            operation.operationKind,
            operation.blockVersionId,
            operation.orderIndex,
            createdAt,
          ]
        );
      });
    this.run(
      'UPDATE variants SET active_revision_id = ?, updated_at = ? WHERE template_id = ? AND id = ?',
      [revisionId, createdAt, templateId, variantId]
    );
    return this.requireRevision(templateId, variantId, revisionId);
  }

  private forkRevisionSnapshot(
    templateId: string,
    variantId: string,
    input: Parameters<CmsService['forkRevisionSnapshotUnsafe']>[2]
  ): VariantRevisionRecord {
    this.requireTemplate(templateId, true);
    return this.transaction(() => this.forkRevisionSnapshotUnsafe(templateId, variantId, input));
  }

  reviseVariantSelector(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly selector: string;
      readonly selectorDescription?: string;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault) {
      throw new CmsServiceError('INVALID_INPUT', 'The default selector always matches every page.');
    }
    return this.forkRevisionSnapshot(templateId, variantId, {
      ...input,
      transform: (operations) => operations,
    });
  }

  private replaceContentOperation(
    operations: readonly OperationRow[],
    placementKey: string,
    replacement: {
      readonly operationKind: 'set' | 'tombstone';
      readonly blockVersionId: string | null;
    }
  ): readonly {
    placementKey: string;
    operationKind: 'set' | 'tombstone' | 'order';
    blockVersionId: string | null;
    orderIndex: number | null;
  }[] {
    return [
      ...operations
        .filter(
          (operation) =>
            operation.placementKey !== placementKey || operation.operationKind === 'order'
        )
        .map((operation) => ({
          placementKey: operation.placementKey,
          operationKind: operation.operationKind,
          blockVersionId: operation.blockVersionId,
          orderIndex: operation.orderIndex,
        })),
      { placementKey, ...replacement, orderIndex: null },
    ];
  }

  /** Creates a variant-only lineage, first immutable version, set, and order in one revision. */
  createVariantPlacement(
    templateId: string,
    variantId: string,
    input: CreateVariantPlacementInput
  ): CopyOnWritePlacementResult {
    this.requireTemplate(templateId, true);
    if (input.placementKey.trim().length === 0) {
      throw new CmsServiceError('INVALID_INPUT', 'Placement keys must not be blank.');
    }
    if (!Number.isSafeInteger(input.order) || input.order < 0) {
      throw new CmsServiceError('INVALID_INPUT', 'Placement order must be a non-negative integer.');
    }
    return this.transaction(() => {
      const variant = this.requireVariant(templateId, variantId);
      if (variant.isDefault) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          'Use the default-document placement commands for the template default.'
        );
      }
      if (variant.status === 'archived') {
        throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
      }
      if (!variant.activeRevisionId) {
        throw new CmsServiceError('CONFLICT', `Variant "${variantId}" has no active revision.`);
      }
      const operations = this.loadRevisionOperations(templateId, variant.activeRevisionId);
      if (operations.some((operation) => operation.placementKey === input.placementKey)) {
        throw new CmsServiceError(
          'CONFLICT',
          `Variant placement "${input.placementKey}" already has an explicit operation.`
        );
      }

      const now = this.now();
      this.run(
        `INSERT INTO block_lineages (id, template_id, key, label, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [input.lineage.id, templateId, input.lineage.key, input.lineage.label, now]
      );
      const blockVersion = this.insertBlockVersion(
        templateId,
        {
          id: input.blockVersionId,
          lineageId: input.lineage.id,
          blockTypeKey: input.blockTypeKey,
          content: input.content,
          createdBy: input.createdBy,
        },
        1,
        null
      );
      const revision = this.forkRevisionSnapshotUnsafe(templateId, variantId, {
        revisionId: input.revisionId,
        createdBy: input.createdBy,
        transform: (snapshot) => [
          ...snapshot.map((operation) => ({
            placementKey: operation.placementKey,
            operationKind: operation.operationKind,
            blockVersionId: operation.blockVersionId,
            orderIndex: operation.orderIndex,
          })),
          {
            placementKey: input.placementKey,
            operationKind: 'set' as const,
            blockVersionId: blockVersion.id,
            orderIndex: null,
          },
          {
            placementKey: input.placementKey,
            operationKind: 'order' as const,
            blockVersionId: null,
            orderIndex: input.order,
          },
        ],
      });
      return { blockVersion, revision };
    });
  }

  setVariantPlacement(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly blockVersionId: string;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Use the default-document placement commands for the template default.'
      );
    }
    if (variant.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
    }
    this.requireBlockVersion(templateId, input.blockVersionId);
    return this.forkRevisionSnapshot(templateId, variantId, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) =>
        this.replaceContentOperation(operations, input.placementKey, {
          operationKind: 'set',
          blockVersionId: input.blockVersionId,
        }),
    });
  }

  tombstoneVariantPlacement(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'The default document removes placements instead of tombstoning them.'
      );
    }
    if (variant.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
    }
    return this.forkRevisionSnapshot(templateId, variantId, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) =>
        this.replaceContentOperation(operations, input.placementKey, {
          operationKind: 'tombstone',
          blockVersionId: null,
        }).filter(
          (operation) =>
            operation.placementKey !== input.placementKey || operation.operationKind !== 'order'
        ),
    });
  }

  reorderVariantPlacement(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly order: number;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    if (!Number.isSafeInteger(input.order) || input.order < 0) {
      throw new CmsServiceError('INVALID_INPUT', 'Placement order must be a non-negative integer.');
    }
    return this.forkRevisionSnapshot(templateId, variantId, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) => [
        ...operations
          .filter(
            (operation) =>
              operation.placementKey !== input.placementKey || operation.operationKind !== 'order'
          )
          .map((operation) => ({
            placementKey: operation.placementKey,
            operationKind: operation.operationKind,
            blockVersionId: operation.blockVersionId,
            orderIndex: operation.orderIndex,
          })),
        {
          placementKey: input.placementKey,
          operationKind: 'order' as const,
          blockVersionId: null,
          orderIndex: input.order,
        },
      ],
    });
  }

  /** Persists a complete visible order for one variant in a single revision. */
  reorderVariantPlacements(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKeys: readonly string[];
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Use the default-document order command for the template default.'
      );
    }
    if (
      input.placementKeys.length === 0 ||
      input.placementKeys.some((key) => key.trim().length === 0) ||
      new Set(input.placementKeys).size !== input.placementKeys.length
    ) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'A variant reorder requires unique, non-empty visible placement keys.'
      );
    }
    return this.forkRevisionSnapshot(templateId, variantId, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) => [
        ...operations
          .filter((operation) => operation.operationKind !== 'order')
          .map((operation) => ({
            placementKey: operation.placementKey,
            operationKind: operation.operationKind,
            blockVersionId: operation.blockVersionId,
            orderIndex: operation.orderIndex,
          })),
        ...input.placementKeys.map((placementKey, orderIndex) => ({
          placementKey,
          operationKind: 'order' as const,
          blockVersionId: null,
          orderIndex,
        })),
      ],
    });
  }

  revertVariantPlacement(
    templateId: string,
    variantId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Use the default-document placement commands for the template default.'
      );
    }
    if (variant.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
    }
    return this.forkRevisionSnapshot(templateId, variantId, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) =>
        operations
          .filter((operation) => operation.placementKey !== input.placementKey)
          .map((operation) => ({
            placementKey: operation.placementKey,
            operationKind: operation.operationKind,
            blockVersionId: operation.blockVersionId,
            orderIndex: operation.orderIndex,
          })),
    });
  }

  private requireDefaultVariant(templateId: string): VariantRecord {
    const defaultVariant = this.listVariants(templateId).find((variant) => variant.isDefault);
    if (!defaultVariant) {
      throw new CmsServiceError('CONFLICT', 'Template has no default variant.');
    }
    return defaultVariant;
  }

  /**
   * Creates the lineage, immutable first block version, and revised default snapshot as one
   * transaction. Positional insertion rewrites only order operations; existing block pointers stay
   * immutable and unchanged.
   */
  createDefaultPlacement(
    templateId: string,
    input: CreateDefaultPlacementInput
  ): DefaultPlacementMutationResult {
    this.requireTemplate(templateId, true);
    if (input.placementKey.trim().length === 0) {
      throw new CmsServiceError('INVALID_INPUT', 'Placement keys must not be blank.');
    }
    return this.transaction(() => {
      const defaultVariant = this.requireDefaultVariant(templateId);
      if (!defaultVariant.activeRevisionId) {
        throw new CmsServiceError('CONFLICT', 'Template default has no active revision.');
      }
      const currentOperations = this.loadRevisionOperations(
        templateId,
        defaultVariant.activeRevisionId
      );
      if (
        currentOperations.some(
          (operation) =>
            operation.placementKey === input.placementKey && operation.operationKind === 'set'
        )
      ) {
        throw new CmsServiceError(
          'CONFLICT',
          `Default placement "${input.placementKey}" already exists.`
        );
      }

      const now = this.now();
      this.run(
        `INSERT INTO block_lineages (id, template_id, key, label, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [input.lineage.id, templateId, input.lineage.key, input.lineage.label, now]
      );
      const blockVersion = this.insertBlockVersion(
        templateId,
        {
          id: input.blockVersionId,
          lineageId: input.lineage.id,
          blockTypeKey: input.blockTypeKey,
          content: input.content,
          createdBy: input.createdBy,
        },
        1,
        null
      );

      const orderByPlacement = new Map(
        currentOperations
          .filter(
            (operation) => operation.operationKind === 'order' && operation.orderIndex !== null
          )
          .map((operation) => [operation.placementKey, operation.orderIndex ?? 0] as const)
      );
      const orderedPlacementKeys = currentOperations
        .filter((operation) => operation.operationKind === 'set')
        .map((operation) => operation.placementKey)
        .sort(
          (left, right) =>
            (orderByPlacement.get(left) ?? Number.MAX_SAFE_INTEGER) -
              (orderByPlacement.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right)
        );
      const position = input.position ?? { kind: 'end' as const };
      let insertionIndex: number;
      if (position.kind === 'start') {
        insertionIndex = 0;
      } else if (position.kind === 'end') {
        insertionIndex = orderedPlacementKeys.length;
      } else {
        if (!('placementKey' in position)) {
          throw new CmsServiceError('INVALID_INPUT', 'Unsupported default placement position.');
        }
        const referenceIndex = orderedPlacementKeys.indexOf(position.placementKey);
        if (referenceIndex < 0) {
          throw new CmsServiceError(
            'NOT_FOUND',
            `Default placement "${position.placementKey}" was not found for positional insertion.`
          );
        }
        insertionIndex = position.kind === 'before' ? referenceIndex : referenceIndex + 1;
      }
      orderedPlacementKeys.splice(insertionIndex, 0, input.placementKey);

      const revision = this.forkRevisionSnapshotUnsafe(templateId, defaultVariant.id, {
        revisionId: input.revisionId,
        createdBy: input.createdBy,
        transform: (operations) => [
          ...operations
            .filter((operation) => operation.operationKind !== 'order')
            .map((operation) => ({
              placementKey: operation.placementKey,
              operationKind: operation.operationKind,
              blockVersionId: operation.blockVersionId,
              orderIndex: operation.orderIndex,
            })),
          {
            placementKey: input.placementKey,
            operationKind: 'set' as const,
            blockVersionId: blockVersion.id,
            orderIndex: null,
          },
          ...orderedPlacementKeys.map((placementKey, orderIndex) => ({
            placementKey,
            operationKind: 'order' as const,
            blockVersionId: null,
            orderIndex,
          })),
        ],
      });
      return { blockVersion, revision };
    });
  }

  /** Forks the placement's exact current default block and updates the default snapshot atomically. */
  editDefaultPlacement(
    templateId: string,
    input: EditDefaultPlacementInput
  ): DefaultPlacementMutationResult {
    this.requireTemplate(templateId, true);
    return this.transaction(() => {
      const defaultVariant = this.requireDefaultVariant(templateId);
      if (!defaultVariant.activeRevisionId) {
        throw new CmsServiceError('CONFLICT', 'Template default has no active revision.');
      }
      const operations = this.loadRevisionOperations(templateId, defaultVariant.activeRevisionId);
      const current = operations.find(
        (operation) =>
          operation.placementKey === input.placementKey && operation.operationKind === 'set'
      );
      if (!current?.blockVersionId) {
        throw new CmsServiceError(
          'NOT_FOUND',
          `Default placement "${input.placementKey}" was not found.`
        );
      }
      const blockVersion = this.forkBlockVersionUnsafe(templateId, {
        id: input.blockVersionId,
        sourceVersionId: current.blockVersionId,
        content: input.content,
        createdBy: input.createdBy,
        blockTypeKey: input.blockTypeKey,
      });
      const revision = this.forkRevisionSnapshotUnsafe(templateId, defaultVariant.id, {
        revisionId: input.revisionId,
        createdBy: input.createdBy,
        transform: (snapshot) =>
          this.replaceContentOperation(snapshot, input.placementKey, {
            operationKind: 'set',
            blockVersionId: blockVersion.id,
          }),
      });
      return { blockVersion, revision };
    });
  }

  setDefaultPlacement(
    templateId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly blockVersionId: string;
      readonly order?: number;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    this.requireBlockVersion(templateId, input.blockVersionId);
    const defaultVariant = this.requireDefaultVariant(templateId);
    return this.forkRevisionSnapshot(templateId, defaultVariant.id, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) => {
        const existingOrder = operations.find(
          (operation) =>
            operation.placementKey === input.placementKey && operation.operationKind === 'order'
        )?.orderIndex;
        const order = input.order ?? existingOrder;
        if (order === null || order === undefined) {
          throw new CmsServiceError(
            'INVALID_INPUT',
            'A new default placement requires an explicit order.'
          );
        }
        return [
          ...operations
            .filter((operation) => operation.placementKey !== input.placementKey)
            .map((operation) => ({
              placementKey: operation.placementKey,
              operationKind: operation.operationKind,
              blockVersionId: operation.blockVersionId,
              orderIndex: operation.orderIndex,
            })),
          {
            placementKey: input.placementKey,
            operationKind: 'set' as const,
            blockVersionId: input.blockVersionId,
            orderIndex: null,
          },
          {
            placementKey: input.placementKey,
            operationKind: 'order' as const,
            blockVersionId: null,
            orderIndex: order,
          },
        ];
      },
    });
  }

  reorderDefaultPlacement(
    templateId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly order: number;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const defaultVariant = this.requireDefaultVariant(templateId);
    return this.reorderVariantPlacement(templateId, defaultVariant.id, input);
  }

  /** Rewrites the complete default placement order in one immutable revision. */
  reorderDefaultPlacements(
    templateId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKeys: readonly string[];
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const defaultVariant = this.requireDefaultVariant(templateId);
    if (!defaultVariant.activeRevisionId) {
      throw new CmsServiceError('CONFLICT', 'Template default has no active revision.');
    }
    const operations = this.loadRevisionOperations(templateId, defaultVariant.activeRevisionId);
    const currentPlacementKeys = operations
      .filter((operation) => operation.operationKind === 'set')
      .map((operation) => operation.placementKey)
      .sort();
    const requestedPlacementKeys = [...input.placementKeys];
    if (
      new Set(requestedPlacementKeys).size !== requestedPlacementKeys.length ||
      requestedPlacementKeys.length !== currentPlacementKeys.length ||
      [...requestedPlacementKeys].sort().some((key, index) => key !== currentPlacementKeys[index])
    ) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'A default reorder must include every current placement exactly once.'
      );
    }
    return this.forkRevisionSnapshot(templateId, defaultVariant.id, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (snapshot) => [
        ...snapshot
          .filter((operation) => operation.operationKind !== 'order')
          .map((operation) => ({
            placementKey: operation.placementKey,
            operationKind: operation.operationKind,
            blockVersionId: operation.blockVersionId,
            orderIndex: operation.orderIndex,
          })),
        ...requestedPlacementKeys.map((placementKey, orderIndex) => ({
          placementKey,
          operationKind: 'order' as const,
          blockVersionId: null,
          orderIndex,
        })),
      ],
    });
  }

  removeDefaultPlacement(
    templateId: string,
    input: {
      readonly revisionId?: string;
      readonly placementKey: string;
      readonly createdBy: string;
    }
  ): VariantRevisionRecord {
    const defaultVariant = this.requireDefaultVariant(templateId);
    return this.forkRevisionSnapshot(templateId, defaultVariant.id, {
      revisionId: input.revisionId,
      createdBy: input.createdBy,
      transform: (operations) =>
        operations
          .filter((operation) => operation.placementKey !== input.placementKey)
          .map((operation) => ({
            placementKey: operation.placementKey,
            operationKind: operation.operationKind,
            blockVersionId: operation.blockVersionId,
            orderIndex: operation.orderIndex,
          })),
    });
  }

  private domainBlock(operation: OperationRow): DomainBlockVersion {
    if (
      operation.blockVersionId === null ||
      operation.lineageId === null ||
      operation.blockTypeKey === null ||
      operation.schemaVersion === null ||
      operation.contentJson === null
    ) {
      throw new CmsServiceError(
        'CONFLICT',
        `Set operation "${operation.id}" does not reference a complete block version.`
      );
    }
    return {
      id: operation.blockVersionId,
      lineageId: operation.lineageId,
      blockType: operation.blockTypeKey,
      schemaVersion: operation.schemaVersion,
      content: parseJsonObject(operation.contentJson),
    };
  }

  private domainOperation(operation: OperationRow): DomainVariantOperation {
    if (operation.operationKind === 'set') {
      return setPlacement(operation.placementKey, this.domainBlock(operation));
    }
    if (operation.operationKind === 'tombstone') {
      return tombstonePlacement(operation.placementKey);
    }
    if (operation.orderIndex === null) {
      throw new CmsServiceError('CONFLICT', `Order operation "${operation.id}" has no order.`);
    }
    return orderPlacement(operation.placementKey, operation.orderIndex);
  }

  private loadDefaultDocument(templateId: string): {
    readonly revisionId: string;
    readonly document: DefaultDocument;
  } {
    const owner = this.get<{ revisionId: string }>(
      `SELECT variants.active_revision_id AS revisionId
       FROM variants
       WHERE variants.template_id = ? AND variants.is_default = 1
         AND variants.status = 'active'`,
      [templateId]
    );
    if (!owner?.revisionId) {
      throw new CmsServiceError('CONFLICT', 'Template has no active default revision.');
    }
    const operations = this.loadRevisionOperations(templateId, owner.revisionId);
    const orders = new Map(
      operations
        .filter((operation) => operation.operationKind === 'order')
        .map((operation) => [operation.placementKey, operation.orderIndex] as const)
    );
    const placements = operations
      .filter((operation) => operation.operationKind === 'set')
      .map((operation) => {
        const order = orders.get(operation.placementKey);
        if (order === null || order === undefined) {
          throw new CmsServiceError(
            'CONFLICT',
            `Default placement "${operation.placementKey}" has no stable order operation.`
          );
        }
        return {
          placementKey: operation.placementKey,
          order,
          blockVersion: this.domainBlock(operation),
        };
      });
    return { revisionId: owner.revisionId, document: { templateId, placements } };
  }

  private selectorRecord(templateId: string, page: PageRecord): SelectorRecord {
    const surface = this.getApprovedReadSurface(templateId);
    const slots = new Map(this.listTemplateSlots(templateId).map((slot) => [slot.key, slot]));
    const tagsByNamespace = new Map<string, string[]>();
    for (const assignment of this.getTagsForPage(templateId, page.id)) {
      const values = tagsByNamespace.get(assignment.tag.namespace) ?? [];
      values.push(assignment.tag.value);
      tagsByNamespace.set(assignment.tag.namespace, values);
    }
    const record: Record<string, string | readonly string[] | undefined> = {};
    for (const field of surface.fields) {
      if (field.kind === 'builtin') {
        record[field.name] =
          field.sourceKey === 'canonical_url'
            ? page.canonicalUrl
            : field.sourceKey === 'route_external_id'
              ? page.routeExternalId
              : page.routeStatus;
        continue;
      }
      if (field.kind === 'tag') {
        record[field.name] = [...(tagsByNamespace.get(field.sourceKey) ?? [])].sort();
        continue;
      }
      const slot = slots.get(field.sourceKey);
      const value = page.slotValues[field.sourceKey];
      record[field.name] =
        slot && value !== undefined ? this.normalizeSlotValue(slot, value).normalized : undefined;
    }
    return record;
  }

  private interpolationContext(templateId: string, page: PageRecord): JsonObject {
    const slotValues: JsonObject = { ...page.slotValues };
    const tagValues = new Map<string, string[]>();
    for (const assignment of this.getTagsForPage(templateId, page.id)) {
      const values = tagValues.get(assignment.tag.namespace) ?? [];
      values.push(assignment.tag.value);
      tagValues.set(assignment.tag.namespace, values);
    }
    const tags: JsonObject = Object.fromEntries(
      [...tagValues.entries()].map(([namespace, values]) => [namespace, [...values].sort()])
    );
    const tag: JsonObject = Object.fromEntries(
      [...tagValues.entries()].map(([namespace, values]) => [
        namespace,
        [...values].sort().join(','),
      ])
    );
    const context: Record<string, JsonValue> = {
      ...page.context,
      slot: slotValues,
      slots: slotValues,
      tag,
      tags,
      route: {
        canonicalUrl: page.canonicalUrl,
        externalId: page.routeExternalId,
        status: page.routeStatus,
        revision: page.routeRevision,
      },
    };
    for (const [key, value] of Object.entries(page.slotValues)) {
      context[key] ??= value;
    }
    for (const [namespace, values] of tagValues) {
      context[namespace] ??= [...values].sort().join(',');
    }
    return context;
  }

  private matchingLayers(
    templateId: string,
    page: PageRecord,
    maximumPriority = Number.POSITIVE_INFINITY
  ): readonly VariantLayer[] {
    const surface = this.getApprovedReadSurface(templateId);
    const record = this.selectorRecord(templateId, page);
    const variants = this.all<VariantRow>(
      `${variantSelect}
       WHERE template_id = ? AND is_default = 0 AND status = 'active'
       ORDER BY priority, id`,
      [templateId]
    );
    const layers: VariantLayer[] = [];
    for (const row of variants) {
      if (row.priority >= maximumPriority || !row.activeRevisionId) {
        continue;
      }
      const revision = this.requireRevision(templateId, row.id, row.activeRevisionId);
      const selector = compileApprovedSelector(
        adaptStoredSelector(revision.selector),
        surface.fields
      );
      if (!evaluateSelector(selector.expression, record)) {
        continue;
      }
      layers.push({
        id: revision.id,
        priority: row.priority,
        operations: this.loadRevisionOperations(templateId, revision.id).map((operation) =>
          this.domainOperation(operation)
        ),
      });
    }
    return layers;
  }

  private prepareResolutionState(templateId: string): PreparedResolutionState {
    const defaultLayer = this.loadDefaultDocument(templateId);
    const surface = this.getApprovedReadSurface(templateId);
    const slotsByKey = new Map(
      this.listTemplateSlots(templateId).map((slot) => [slot.key, slot] as const)
    );
    const sourceOperationIds = new Map<string, string>();
    const validateAndIndexOperations = (
      revisionId: string,
      operations: readonly OperationRow[]
    ): void => {
      for (const operation of operations) {
        if (operation.operationKind !== 'set' || !operation.blockVersionId) {
          continue;
        }
        const block = this.domainBlock(operation);
        const blockType = this.requireBlockType(block.blockType);
        if (block.schemaVersion !== blockType.schemaVersion) {
          throw new CmsServiceError(
            'SCHEMA_VALIDATION',
            `Block version "${block.id}" uses schema ${block.schemaVersion}, but its registry entry is ${blockType.schemaVersion}.`
          );
        }
        try {
          assertBlockContent(blockType.schema, block.content);
        } catch (error) {
          throw new CmsServiceError(
            'SCHEMA_VALIDATION',
            error instanceof Error ? error.message : 'Block content failed schema validation.'
          );
        }
        sourceOperationIds.set(
          sourceOperationKey(revisionId, operation.placementKey, operation.blockVersionId),
          operation.id
        );
      }
    };
    validateAndIndexOperations(
      defaultLayer.revisionId,
      this.loadRevisionOperations(templateId, defaultLayer.revisionId)
    );

    const variants = this.all<VariantRow>(
      `${variantSelect}
       WHERE template_id = ? AND is_default = 0 AND status = 'active'
       ORDER BY priority, id`,
      [templateId]
    );
    const layers: PreparedResolutionLayer[] = [];
    for (const row of variants) {
      if (!row.activeRevisionId) {
        throw new CmsServiceError('CONFLICT', `Variant "${row.id}" has no active revision.`);
      }
      const revision = this.requireRevision(templateId, row.id, row.activeRevisionId);
      const operations = this.loadRevisionOperations(templateId, revision.id);
      validateAndIndexOperations(revision.id, operations);
      layers.push({
        id: revision.id,
        priority: row.priority,
        expression: compileApprovedSelector(adaptStoredSelector(revision.selector), surface.fields)
          .expression,
        operations: operations.map((operation) => this.domainOperation(operation)),
      });
    }
    return {
      defaultRevisionId: defaultLayer.revisionId,
      defaultDocument: defaultLayer.document,
      fields: surface.fields,
      slotsByKey,
      layers,
      sourceOperationIds,
    };
  }

  private *publicationPageBatches(
    templateId: string,
    batchSize = 5_000
  ): Generator<readonly PreparedPublicationPage[]> {
    let cursor: CursorValue | null = null;
    while (true) {
      const rows: PageRow[] = this.all<PageRow>(
        `${pageSelect}
         WHERE template_id = ? AND route_status <> 'archived'
           ${cursor ? 'AND (canonical_url > ? OR (canonical_url = ? AND id > ?))' : ''}
         ORDER BY canonical_url, id
         LIMIT ?`,
        cursor
          ? [templateId, cursor.value, cursor.value, cursor.id, batchSize]
          : [templateId, batchSize]
      );
      if (rows.length === 0) {
        return;
      }
      const pageIds: string[] = rows.map((row: PageRow) => row.id);
      const placeholders = pageIds.map(() => '?').join(', ');
      const slotRows = this.all<{ pageId: string; key: string; value: string }>(
        `SELECT values_table.page_instance_id AS pageId, slots.key, values_table.value
         FROM page_slot_values AS values_table
         JOIN template_slots AS slots
           ON slots.id = values_table.slot_id AND slots.template_id = values_table.template_id
         WHERE values_table.template_id = ?
           AND values_table.page_instance_id IN (${placeholders})
         ORDER BY values_table.page_instance_id, slots.key`,
        [templateId, ...pageIds]
      );
      const tagRows = this.all<{ pageId: string; namespace: string; value: string }>(
        `SELECT assignments.page_instance_id AS pageId, tags.namespace, tags.value
         FROM page_tags AS assignments
         JOIN tags ON tags.id = assignments.tag_id AND tags.template_id = assignments.template_id
         WHERE assignments.template_id = ?
           AND assignments.page_instance_id IN (${placeholders})
         ORDER BY assignments.page_instance_id, tags.namespace, tags.value, tags.id`,
        [templateId, ...pageIds]
      );
      const slotsByPage = new Map<string, Record<string, string>>();
      for (const row of slotRows) {
        const values = slotsByPage.get(row.pageId) ?? {};
        values[row.key] = row.value;
        slotsByPage.set(row.pageId, values);
      }
      const tagsByPage = new Map<string, Map<string, string[]>>();
      for (const row of tagRows) {
        const namespaces = tagsByPage.get(row.pageId) ?? new Map<string, string[]>();
        const values = namespaces.get(row.namespace) ?? [];
        values.push(row.value);
        namespaces.set(row.namespace, values);
        tagsByPage.set(row.pageId, namespaces);
      }
      yield rows.map((row: PageRow): PreparedPublicationPage => {
        const context = parseJsonObject(row.contextJson);
        const tags = tagsByPage.get(row.id) ?? new Map<string, string[]>();
        return {
          page: {
            ...row,
            context,
            contextHash: canonicalHash(context),
            slotValues: slotsByPage.get(row.id) ?? {},
          },
          tagsByNamespace: new Map(
            [...tags.entries()].map(([namespace, values]) => [
              namespace,
              [...new Set(values)].sort(),
            ])
          ),
        };
      });
      const last: PageRow | undefined = rows.at(-1);
      if (!last || rows.length < batchSize) {
        return;
      }
      cursor = { value: last.canonicalUrl, id: last.id };
    }
  }

  private preparedSelectorRecord(
    state: PreparedResolutionState,
    page: PageRecord,
    tagsByNamespace: ReadonlyMap<string, readonly string[]>
  ): SelectorRecord {
    const record: Record<string, string | readonly string[] | undefined> = {};
    for (const field of state.fields) {
      if (field.kind === 'builtin') {
        record[field.name] =
          field.sourceKey === 'canonical_url'
            ? page.canonicalUrl
            : field.sourceKey === 'route_external_id'
              ? page.routeExternalId
              : page.routeStatus;
      } else if (field.kind === 'tag') {
        record[field.name] = tagsByNamespace.get(field.sourceKey) ?? [];
      } else {
        const slot = state.slotsByKey.get(field.sourceKey);
        const value = page.slotValues[field.sourceKey];
        record[field.name] =
          slot && value !== undefined ? this.normalizeSlotValue(slot, value).normalized : undefined;
      }
    }
    return record;
  }

  private preparedInterpolationContext(
    page: PageRecord,
    tagsByNamespace: ReadonlyMap<string, readonly string[]>
  ): JsonObject {
    const slotValues: JsonObject = { ...page.slotValues };
    const tags: JsonObject = Object.fromEntries(tagsByNamespace);
    const tag: JsonObject = Object.fromEntries(
      [...tagsByNamespace.entries()].map(([namespace, values]) => [namespace, values.join(',')])
    );
    const context: Record<string, JsonValue> = {
      ...page.context,
      slot: slotValues,
      slots: slotValues,
      tag,
      tags,
      route: {
        canonicalUrl: page.canonicalUrl,
        externalId: page.routeExternalId,
        status: page.routeStatus,
        revision: page.routeRevision,
      },
    };
    for (const [key, value] of Object.entries(page.slotValues)) {
      context[key] ??= value;
    }
    for (const [namespace, values] of tagsByNamespace) {
      context[namespace] ??= values.join(',');
    }
    return context;
  }

  private resolvePreparedPage(
    state: PreparedResolutionState,
    prepared: PreparedPublicationPage
  ): EffectivePageDocument {
    const record = this.preparedSelectorRecord(state, prepared.page, prepared.tagsByNamespace);
    const matchingLayers: VariantLayer[] = state.layers
      .filter((layer) => evaluateSelector(layer.expression, record))
      .map((layer) => ({ id: layer.id, priority: layer.priority, operations: layer.operations }));
    const document = this.remapDefaultProvenance(
      resolveDocument(state.defaultDocument, matchingLayers),
      state.defaultRevisionId
    );
    const context = this.preparedInterpolationContext(prepared.page, prepared.tagsByNamespace);
    const renderedPlacements = document.placements.map((placement) => {
      const content = interpolateJson(placement.blockVersion.content, context);
      if (content === null || typeof content !== 'object' || Array.isArray(content)) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          `Placement "${placement.placementKey}" did not render to an object.`
        );
      }
      return {
        placementKey: placement.placementKey,
        order: placement.order,
        blockType: placement.blockVersion.blockType,
        blockVersionId: placement.blockVersion.id,
        content: content as JsonObject,
      };
    });
    return { page: prepared.page, document, renderedPlacements };
  }

  private remapDefaultProvenance(
    document: ResolvedDocument,
    defaultRevisionId: string
  ): ResolvedDocument {
    const remapSource = (source: DomainProvenanceSource): DomainProvenanceSource =>
      source.kind === 'default' ? { ...source, sourceId: defaultRevisionId } : source;
    return {
      ...document,
      placements: document.placements.map(
        (placement): ResolvedPlacement => ({
          ...placement,
          provenance: {
            content: remapSource(placement.provenance.content),
            order: remapSource(placement.provenance.order),
          },
          trace: placement.trace.map((step) => ({ ...step, source: remapSource(step.source) })),
        })
      ),
      tombstones: document.tombstones.map(
        (tombstone): ResolvedTombstone => ({
          ...tombstone,
          source: remapSource(tombstone.source),
          trace: tombstone.trace.map((step) => ({ ...step, source: remapSource(step.source) })),
        })
      ),
    };
  }

  private resolvePageAtPriority(
    templateId: string,
    pageId: string,
    maximumPriority = Number.POSITIVE_INFINITY
  ): EffectivePageDocument {
    this.requireTemplate(templateId);
    const page = this.requirePage(templateId, pageId);
    const defaultLayer = this.loadDefaultDocument(templateId);
    return this.renderResolvedPage(
      templateId,
      page,
      defaultLayer,
      this.matchingLayers(templateId, page, maximumPriority)
    );
  }

  private renderResolvedPage(
    templateId: string,
    page: PageRecord,
    defaultLayer: { readonly revisionId: string; readonly document: DefaultDocument },
    layers: readonly VariantLayer[]
  ): EffectivePageDocument {
    const document = this.remapDefaultProvenance(
      resolveDocument(defaultLayer.document, layers),
      defaultLayer.revisionId
    );
    const interpolationContext = this.interpolationContext(templateId, page);
    const renderedPlacements = document.placements.map((placement) => {
      const content = interpolateJson(placement.blockVersion.content, interpolationContext);
      if (content === null || typeof content !== 'object' || Array.isArray(content)) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          `Placement "${placement.placementKey}" did not render to an object.`
        );
      }
      return {
        placementKey: placement.placementKey,
        order: placement.order,
        blockType: placement.blockVersion.blockType,
        blockVersionId: placement.blockVersion.id,
        content: content as JsonObject,
      };
    });
    return { page, document, renderedPlacements };
  }

  resolvePage(templateId: string, pageId: string): EffectivePageDocument {
    return this.resolvePageAtPriority(templateId, pageId);
  }

  /** Resolves only the template-owned default document for default-scope authoring. */
  resolveDefaultPage(templateId: string, pageId: string): EffectivePageDocument {
    this.requireTemplate(templateId);
    const page = this.requirePage(templateId, pageId);
    return this.renderResolvedPage(templateId, page, this.loadDefaultDocument(templateId), []);
  }

  /**
   * Resolves one variant revision into the complete document without activating a draft variant or
   * publishing it. Other active matching variants remain present, so conflict behavior is exact.
   */
  resolveVariantDraft(
    templateId: string,
    variantId: string,
    pageId: string,
    revisionId?: string
  ): EffectivePageDocument {
    this.requireTemplate(templateId);
    const variant = this.requireVariant(templateId, variantId);
    if (variant.isDefault) {
      throw new CmsServiceError('INVALID_INPUT', 'The default document is already always active.');
    }
    if (variant.status === 'archived') {
      throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
    }
    const page = this.requirePage(templateId, pageId);
    const selectedRevisionId = revisionId ?? variant.activeRevisionId;
    if (!selectedRevisionId) {
      throw new CmsServiceError('CONFLICT', `Variant "${variantId}" has no revision to preview.`);
    }
    const revision = this.requireRevision(templateId, variantId, selectedRevisionId);
    const compiled = compileApprovedSelector(
      adaptStoredSelector(revision.selector),
      this.getApprovedReadSurface(templateId).fields
    );
    if (!evaluateSelector(compiled.expression, this.selectorRecord(templateId, page))) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        `Page "${pageId}" does not match revision "${selectedRevisionId}".`
      );
    }
    const layers = this.matchingLayers(templateId, page)
      .filter((layer) => layer.id !== selectedRevisionId && layer.id !== variant.activeRevisionId)
      .concat({
        id: selectedRevisionId,
        priority: variant.priority,
        operations: this.loadRevisionOperations(templateId, selectedRevisionId).map((operation) =>
          this.domainOperation(operation)
        ),
      });
    return this.renderResolvedPage(templateId, page, this.loadDefaultDocument(templateId), layers);
  }

  resolveDraftByCanonicalUrl(templateId: string, canonicalUrl: string): EffectivePageDocument {
    const page = this.get<{ id: string }>(
      `SELECT id FROM page_instances WHERE template_id = ? AND canonical_url = ?`,
      [templateId, canonicalUrl]
    );
    if (!page) {
      throw new CmsServiceError(
        'NOT_FOUND',
        `Page "${canonicalUrl}" was not found in template "${templateId}".`
      );
    }
    return this.resolvePage(templateId, page.id);
  }

  copyOnWritePlacement(
    templateId: string,
    variantId: string,
    pageId: string,
    placementKey: string,
    input: CopyOnWritePlacementInput
  ): CopyOnWritePlacementResult {
    this.requireTemplate(templateId, true);
    return this.transaction(() => {
      const variant = this.requireVariant(templateId, variantId);
      if (variant.isDefault) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          'Copy-on-write is only needed for sparse non-default variants.'
        );
      }
      if (variant.status === 'archived') {
        throw new CmsServiceError('ARCHIVED_GUARD', `Variant "${variantId}" is archived.`);
      }
      const page = this.requirePage(templateId, pageId);
      const selector = compileApprovedSelector(
        adaptStoredSelector(
          this.requireRevision(templateId, variantId, variant.activeRevisionId ?? '').selector
        ),
        this.getApprovedReadSurface(templateId).fields
      );
      if (!evaluateSelector(selector.expression, this.selectorRecord(templateId, page))) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          `Page "${pageId}" does not match variant "${variantId}" and cannot seed copy-on-write.`
        );
      }
      const currentRevision = this.requireRevision(
        templateId,
        variantId,
        variant.activeRevisionId ?? ''
      );
      const currentSet = this.loadRevisionOperations(templateId, currentRevision.id).find(
        (operation) => operation.placementKey === placementKey && operation.operationKind === 'set'
      );
      const lowerPlacement = this.resolvePageAtPriority(
        templateId,
        pageId,
        variant.priority
      ).document.placements.find((placement) => placement.placementKey === placementKey);
      const sourceVersionId = currentSet?.blockVersionId ?? lowerPlacement?.blockVersion.id;
      if (!sourceVersionId) {
        throw new CmsServiceError(
          'NOT_FOUND',
          `No explicit or lower-priority placement "${placementKey}" can be copied.`
        );
      }
      const blockVersion = this.forkBlockVersionUnsafe(templateId, {
        id: input.blockVersionId,
        sourceVersionId,
        content: input.content,
        createdBy: input.createdBy,
        blockTypeKey: input.blockTypeKey,
      });
      const revision = this.forkRevisionSnapshotUnsafe(templateId, variantId, {
        revisionId: input.revisionId,
        createdBy: input.createdBy,
        transform: (operations) =>
          this.replaceContentOperation(operations, placementKey, {
            operationKind: 'set',
            blockVersionId: blockVersion.id,
          }),
      });
      return { blockVersion, revision };
    });
  }

  previewVariantOverlap(
    templateId: string,
    variantId: string,
    requestedLimit = 100
  ): readonly VariantOverlap[] {
    const limit = assertPageLimit(requestedLimit, this.selectorPreviewLimit);
    const target = this.requireVariant(templateId, variantId);
    if (!target.activeRevisionId) {
      throw new CmsServiceError('CONFLICT', `Variant "${variantId}" has no active revision.`);
    }
    const targetRevision = this.requireRevision(templateId, variantId, target.activeRevisionId);
    const surface = this.getApprovedReadSurface(templateId);
    const targetSelector = compileApprovedSelector(
      adaptStoredSelector(targetRevision.selector),
      surface.fields
    );
    const targetPlacements = new Set(
      this.loadRevisionOperations(templateId, targetRevision.id).map(
        (operation) => operation.placementKey
      )
    );
    return this.listVariants(templateId)
      .filter(
        (candidate) =>
          !candidate.isDefault &&
          candidate.id !== variantId &&
          candidate.status === 'active' &&
          candidate.activeRevisionId !== null
      )
      .map((candidate): VariantOverlap => {
        const revision = this.requireRevision(
          templateId,
          candidate.id,
          candidate.activeRevisionId ?? ''
        );
        const candidateSelector = compileApprovedSelector(
          adaptStoredSelector(revision.selector),
          surface.fields
        );
        const predicate = `(${targetSelector.predicateSql}) AND (${candidateSelector.predicateSql})`;
        const parameters: SQLQueryBindings[] = [
          templateId,
          ...targetSelector.parameters,
          ...candidateSelector.parameters,
        ];
        const overlapCount =
          this.get<{ count: number }>(
            `SELECT count(*) AS count
             FROM page_instances AS p
             WHERE p.template_id = ? AND ${predicate}`,
            parameters
          )?.count ?? 0;
        const overlapPageIds = this.all<{ id: string }>(
          `SELECT p.id
           FROM page_instances AS p
           WHERE p.template_id = ? AND ${predicate}
           ORDER BY p.canonical_url, p.id
           LIMIT ?`,
          [...parameters, limit]
        ).map((page) => page.id);
        return {
          variantId: candidate.id,
          variantRevisionId: revision.id,
          overlapPageIds,
          overlapCount,
          conflictingPlacementKeys: [
            ...new Set(
              this.loadRevisionOperations(templateId, revision.id)
                .map((operation) => operation.placementKey)
                .filter(
                  (placementKey) =>
                    candidate.priority === target.priority && targetPlacements.has(placementKey)
                )
            ),
          ].sort(),
          truncated: overlapCount > limit,
        };
      });
  }

  private preparedMaterializedPlacements(
    state: PreparedResolutionState,
    document: ResolvedDocument
  ): readonly MaterializedPlacement[] {
    return document.placements.map((placement) => {
      const sourceRevisionId = placement.provenance.content.sourceId;
      const sourceOperationId = state.sourceOperationIds.get(
        sourceOperationKey(sourceRevisionId, placement.placementKey, placement.blockVersion.id)
      );
      if (!sourceOperationId) {
        throw new CmsServiceError(
          'CONFLICT',
          `Placement "${placement.placementKey}" has no exact immutable set-operation provenance.`
        );
      }
      return {
        placementKey: placement.placementKey,
        order: placement.order,
        blockVersionId: placement.blockVersion.id,
        sourceRevisionId,
        sourceOperationId,
        sourcePriority: placement.provenance.content.priority,
      };
    });
  }

  private publishedDocumentValue(
    templateId: string,
    pageId: string,
    renderedPlacements: EffectivePageDocument['renderedPlacements'],
    placements: readonly MaterializedPlacement[]
  ): PublishedDocument {
    return assertPublishedDocument({
      templateId,
      pageId,
      placements: renderedPlacements.map((rendered, ordinal) => {
        const placement = placements[ordinal];
        if (!placement) {
          throw new CmsServiceError('CONFLICT', 'Rendered placement count changed.');
        }
        return {
          placementKey: rendered.placementKey,
          order: ordinal,
          blockType: rendered.blockType,
          blockVersionId: rendered.blockVersionId,
          content: rendered.content,
          provenance: {
            sourceRevisionId: placement.sourceRevisionId,
            sourceOperationId: placement.sourceOperationId,
            sourcePriority: placement.sourcePriority,
          },
        };
      }),
    });
  }

  private currentPublication(templateId: string): PublicationRow | null {
    return this.get<PublicationRow>(
      `SELECT publications.id, publications.sequence, publications.input_hash AS inputHash,
              publications.previous_publication_id AS previousPublicationId,
              publications.page_count AS pageCount,
              publications.manifest_count AS manifestCount
       FROM current_publications AS current
       JOIN publications ON publications.id = current.publication_id
         AND publications.template_id = current.template_id
       WHERE current.template_id = ?`,
      [templateId]
    );
  }

  publish(templateId: string, input: PublishInput): PublishResult {
    const startedAt = performance.now();
    this.requireTemplate(templateId, true);
    const batchSize = input.batchSize ?? 5_000;
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
      throw new CmsServiceError(
        'INVALID_INPUT',
        'Publication batch size must be an integer from 1 through 10000.'
      );
    }
    const materializationMode = input.materializationMode ?? 'manifest';
    return this.transaction(() => {
      const state = this.prepareResolutionState(templateId);
      const activeRevisions = this.all<{
        variantId: string;
        priority: number;
        revisionId: string;
        selectorHash: string;
      }>(
        `SELECT variants.id AS variantId, variants.priority,
                revisions.id AS revisionId, revisions.selector_hash AS selectorHash
         FROM variants
         JOIN variant_revisions AS revisions ON revisions.id = variants.active_revision_id
         WHERE variants.template_id = ? AND variants.status = 'active'
         ORDER BY variants.priority, variants.id`,
        [templateId]
      );
      const totalPages =
        this.get<{ count: number }>(
          `SELECT count(*) AS count FROM page_instances
           WHERE template_id = ? AND route_status <> 'archived'`,
          [templateId]
        )?.count ?? 0;
      const inputHasher = new Bun.CryptoHasher('sha256');
      inputHasher.update(
        canonicalJson({
          contract: 'cms-publication-input-v2',
          templateId,
          materializationMode,
          activeRevisions,
        })
      );
      const manifests = new Map<
        string,
        { readonly id: string; readonly placements: readonly MaterializedPlacement[] }
      >();
      let compiledPages = 0;
      let selectorMatchCount = 0;
      let blockReferenceCount = 0;
      let logicalExpandedRenderedDocumentBytes = 0;
      for (const batch of this.publicationPageBatches(templateId, batchSize)) {
        for (const prepared of batch) {
          const entry = this.resolvePreparedPage(state, prepared);
          const placements = this.preparedMaterializedPlacements(state, entry.document);
          const manifestHash = canonicalHash({
            templateId,
            placements: placements.map((placement) => ({
              placementKey: placement.placementKey,
              order: placement.order,
              blockVersionId: placement.blockVersionId,
              sourceRevisionId: placement.sourceRevisionId,
              sourceOperationId: placement.sourceOperationId,
              sourcePriority: placement.sourcePriority,
            })),
          });
          manifests.set(
            manifestHash,
            manifests.get(manifestHash) ?? {
              id: `manifest:${manifestHash}`,
              placements,
            }
          );
          selectorMatchCount += entry.document.matchedVariantIds.length;
          blockReferenceCount += placements.length;
          logicalExpandedRenderedDocumentBytes += Buffer.byteLength(
            stringifyJson(
              this.publishedDocumentValue(
                templateId,
                entry.page.id,
                entry.renderedPlacements,
                placements
              )
            ),
            'utf8'
          );
          inputHasher.update(
            canonicalHash({
              id: entry.page.id,
              canonicalUrl: entry.page.canonicalUrl,
              routeStatus: entry.page.routeStatus,
              routeRevision: entry.page.routeRevision,
              contextHash: entry.page.contextHash,
              slotValueHash: entry.page.slotValueHash,
              tags: Object.fromEntries(prepared.tagsByNamespace),
              contentHash: entry.document.contentHash,
              manifestHash,
            })
          );
          compiledPages += 1;
        }
        input.onProgress?.({ phase: 'compile', pagesProcessed: compiledPages, totalPages });
      }
      if (compiledPages !== totalPages) {
        throw new CmsServiceError(
          'PUBLICATION_FAILED',
          `Publication page snapshot changed from ${totalPages} to ${compiledPages} rows.`
        );
      }
      const inputHash = inputHasher.digest('hex');
      const current = this.currentPublication(templateId);
      if (current?.inputHash === inputHash) {
        return {
          publicationId: current.id,
          sequence: current.sequence,
          inputHash,
          previousPublicationId: current.previousPublicationId,
          pageCount: current.pageCount,
          manifestCount: current.manifestCount,
          reusedManifestCount: current.manifestCount,
          reusedCurrentPublication: true,
          materializationMode,
          selectorMatchCount,
          blockReferenceCount,
          rowsWritten: 0,
          estimatedStorageBytes: 0,
          logicalExpandedRenderedDocumentBytes,
          durationMilliseconds: performance.now() - startedAt,
        };
      }

      const sequence =
        (this.get<{ value: number | null }>(
          'SELECT max(sequence) AS value FROM publications WHERE template_id = ?',
          [templateId]
        )?.value ?? 0) + 1;
      const publicationId = input.id ?? this.createId('publication');
      const now = this.now();
      this.run(
        `INSERT INTO publications (
          id, template_id, sequence, status, input_hash, previous_publication_id,
          route_revision, page_count, manifest_count, failure_json,
          created_by, published_at, created_at
        ) VALUES (?, ?, ?, 'published', ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          publicationId,
          templateId,
          sequence,
          inputHash,
          current?.id ?? null,
          canonicalHash(activeRevisions),
          totalPages,
          manifests.size,
          input.createdBy,
          now,
          now,
        ]
      );
      let rowsWritten = 1;
      if (input.failAt === 'after-publication') {
        throw new CmsServiceError('PUBLICATION_FAILED', 'Injected failure after publication row.');
      }

      let reusedManifestCount = 0;
      const manifestIds = new Map<string, string>();
      for (const [hash, manifest] of [...manifests.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )) {
        const existing = this.get<{ id: string }>(
          'SELECT id FROM document_manifests WHERE template_id = ? AND content_hash = ?',
          [templateId, hash]
        );
        if (existing) {
          reusedManifestCount += 1;
          manifestIds.set(hash, existing.id);
          continue;
        }
        this.run(
          `INSERT INTO document_manifests (
            id, template_id, content_hash, placement_count, created_at
          ) VALUES (?, ?, ?, ?, ?)`,
          [manifest.id, templateId, hash, manifest.placements.length, now]
        );
        rowsWritten += 1;
        manifest.placements.forEach((placement, ordinal) => {
          this.run(
            `INSERT INTO document_manifest_items (
              manifest_id, ordinal, placement_key, block_version_id,
              source_variant_revision_id, source_operation_id, source_priority, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              manifest.id,
              ordinal,
              placement.placementKey,
              placement.blockVersionId,
              placement.sourceRevisionId,
              placement.sourceOperationId,
              placement.sourcePriority,
              now,
            ]
          );
          rowsWritten += 1;
        });
        manifestIds.set(hash, manifest.id);
      }
      if (input.failAt === 'after-manifests') {
        throw new CmsServiceError('PUBLICATION_FAILED', 'Injected failure after manifests.');
      }

      let writtenPages = 0;
      let estimatedStorageBytes = 0;
      for (const batch of this.publicationPageBatches(templateId, batchSize)) {
        for (const prepared of batch) {
          const entry = this.resolvePreparedPage(state, prepared);
          const placements = this.preparedMaterializedPlacements(state, entry.document);
          const manifestHash = canonicalHash({
            templateId,
            placements: placements.map((placement) => ({
              placementKey: placement.placementKey,
              order: placement.order,
              blockVersionId: placement.blockVersionId,
              sourceRevisionId: placement.sourceRevisionId,
              sourceOperationId: placement.sourceOperationId,
              sourcePriority: placement.sourcePriority,
            })),
          });
          const manifestId = manifestIds.get(manifestHash);
          if (!manifestId) {
            throw new CmsServiceError(
              'PUBLICATION_FAILED',
              `Manifest "${manifestHash}" disappeared between publication passes.`
            );
          }
          const interpolationContext = this.preparedInterpolationContext(
            entry.page,
            prepared.tagsByNamespace
          );
          const document = this.publishedDocumentValue(
            templateId,
            entry.page.id,
            entry.renderedPlacements,
            placements
          );
          const resolvedDataJson = stringifyJson(interpolationContext);
          const renderedDocumentJson =
            materializationMode === 'expanded' ? stringifyJson(document) : null;
          const documentHash = canonicalHash(document);
          this.run(
            `INSERT INTO published_page_documents (
              publication_id, template_id, page_instance_id, manifest_id, canonical_url,
              route_status, resolved_data_json, rendered_document_json, document_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              publicationId,
              templateId,
              entry.page.id,
              manifestId,
              entry.page.canonicalUrl,
              entry.page.routeStatus,
              resolvedDataJson,
              renderedDocumentJson,
              documentHash,
              now,
            ]
          );
          estimatedStorageBytes +=
            resolvedDataJson.length + (renderedDocumentJson?.length ?? 0) + 256;
          writtenPages += 1;
          rowsWritten += 1;
        }
        input.onProgress?.({ phase: 'write', pagesProcessed: writtenPages, totalPages });
      }
      if (writtenPages !== totalPages) {
        throw new CmsServiceError(
          'PUBLICATION_FAILED',
          `Publication write pass changed from ${totalPages} to ${writtenPages} rows.`
        );
      }
      if (input.failAt === 'after-pages') {
        throw new CmsServiceError('PUBLICATION_FAILED', 'Injected failure after page documents.');
      }
      if (input.failAt === 'before-activation') {
        throw new CmsServiceError('PUBLICATION_FAILED', 'Injected failure before activation.');
      }
      this.run(
        `INSERT INTO current_publications (
          template_id, publication_id, activated_at, activated_by
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(template_id) DO UPDATE SET
          publication_id = excluded.publication_id,
          activated_at = excluded.activated_at,
          activated_by = excluded.activated_by`,
        [templateId, publicationId, now, input.createdBy]
      );
      rowsWritten += 1;
      return {
        publicationId,
        sequence,
        inputHash,
        previousPublicationId: current?.id ?? null,
        pageCount: totalPages,
        manifestCount: manifests.size,
        reusedManifestCount,
        reusedCurrentPublication: false,
        materializationMode,
        selectorMatchCount,
        blockReferenceCount,
        rowsWritten,
        estimatedStorageBytes,
        logicalExpandedRenderedDocumentBytes,
        durationMilliseconds: performance.now() - startedAt,
      };
    });
  }

  rollback(
    templateId: string,
    targetPublicationId: string | undefined,
    activatedBy: string
  ): RollbackResult {
    this.requireTemplate(templateId, true);
    return this.transaction(() => {
      const current = this.currentPublication(templateId);
      if (!current) {
        throw new CmsServiceError('NOT_FOUND', 'Template has no current publication.');
      }
      const targetId = targetPublicationId ?? current.previousPublicationId;
      if (!targetId) {
        throw new CmsServiceError('NOT_FOUND', 'Current publication has no rollback target.');
      }
      const target = this.get<{ id: string }>(
        `SELECT id FROM publications
         WHERE template_id = ? AND id = ? AND status = 'published'`,
        [templateId, targetId]
      );
      if (!target) {
        throw new CmsServiceError(
          'NOT_FOUND',
          `Published rollback target "${targetId}" was not found in the template.`
        );
      }
      const activatedAt = this.now();
      this.run(
        `UPDATE current_publications
         SET publication_id = ?, activated_at = ?, activated_by = ?
         WHERE template_id = ?`,
        [targetId, activatedAt, activatedBy, templateId]
      );
      return {
        fromPublicationId: current.id,
        publicationId: targetId,
        activatedAt,
        activatedBy,
      };
    });
  }

  getServeQueryText(): string {
    return serveSql;
  }

  getServeReadQueryTexts(materializationMode: 'manifest' | 'expanded'): readonly string[] {
    return materializationMode === 'expanded' ? [serveSql] : [serveSql, publishedManifestSql];
  }

  private renderPublishedManifest(
    templateId: string,
    pageInstanceId: string,
    manifestId: string,
    resolvedDataJson: string
  ): PublishedDocument {
    const context = parseJsonObject(resolvedDataJson);
    const rows = this.all<{
      ordinal: number;
      placementKey: string;
      blockVersionId: string;
      blockType: string;
      contentJson: string;
      sourceRevisionId: string;
      sourceOperationId: string;
      sourcePriority: number;
    }>(publishedManifestSql, [templateId, manifestId]);
    return assertPublishedDocument({
      templateId,
      pageId: pageInstanceId,
      placements: rows.map((row) => {
        const content = interpolateJson(parseJsonObject(row.contentJson), context);
        if (content === null || typeof content !== 'object' || Array.isArray(content)) {
          throw new CmsServiceError(
            'PUBLICATION_FAILED',
            `Published placement "${row.placementKey}" did not render to an object.`
          );
        }
        return {
          placementKey: row.placementKey,
          order: row.ordinal,
          blockType: row.blockType,
          blockVersionId: row.blockVersionId,
          content,
          provenance: {
            sourceRevisionId: row.sourceRevisionId,
            sourceOperationId: row.sourceOperationId,
            sourcePriority: row.sourcePriority,
          },
        };
      }),
    });
  }

  resolvePublication(
    templateId: string,
    publicationId: string,
    canonicalUrl: string
  ): PublishedDocumentResult {
    const row = this.get<{
      routeStatus: RouteStatus;
      pageInstanceId: string;
      manifestId: string;
      documentHash: string;
      renderedDocumentJson: string | null;
      resolvedDataJson: string;
    }>(
      `SELECT documents.route_status AS routeStatus,
              documents.page_instance_id AS pageInstanceId,
              documents.manifest_id AS manifestId,
              documents.document_hash AS documentHash,
              documents.rendered_document_json AS renderedDocumentJson,
              documents.resolved_data_json AS resolvedDataJson
       FROM publications
       JOIN published_page_documents AS documents
         ON documents.publication_id = publications.id
        AND documents.template_id = publications.template_id
       WHERE publications.template_id = ? AND publications.id = ?
         AND publications.status = 'published' AND documents.canonical_url = ?`,
      [templateId, publicationId, canonicalUrl]
    );
    if (!row) {
      return { status: 404, reason: 'missing' };
    }
    return {
      status: 200,
      publicationId,
      canonicalUrl,
      routeStatus: row.routeStatus,
      documentHash: row.documentHash,
      document: row.renderedDocumentJson
        ? parsePublishedDocumentJson(row.renderedDocumentJson)
        : this.renderPublishedManifest(
            templateId,
            row.pageInstanceId,
            row.manifestId,
            row.resolvedDataJson
          ),
    };
  }

  serveWithEvidence(templateId: string, canonicalUrl: string): ServeReadEvidence {
    const startedAt = performance.now();
    const row = this.get<{
      currentRouteStatus: RouteStatus;
      publicationId: string | null;
      pageInstanceId: string | null;
      manifestId: string | null;
      documentHash: string | null;
      renderedDocumentJson: string | null;
      resolvedDataJson: string | null;
    }>(serveSql, [templateId, canonicalUrl]);
    if (!row) {
      return {
        result: { status: 404, reason: 'missing' },
        materializationMode: null,
        sqlQueryCount: 1,
        selectorSqlExecutions: 0,
        elapsedMilliseconds: performance.now() - startedAt,
      };
    }
    const materializationMode = row.renderedDocumentJson
      ? ('expanded' as const)
      : row.manifestId
        ? ('manifest' as const)
        : null;
    if (row.currentRouteStatus === 'archived') {
      return {
        result: { status: 404, reason: 'archived' },
        materializationMode,
        sqlQueryCount: 1,
        selectorSqlExecutions: 0,
        elapsedMilliseconds: performance.now() - startedAt,
      };
    }
    if (row.currentRouteStatus === 'not_live') {
      return {
        result: { status: 404, reason: 'not_live' },
        materializationMode,
        sqlQueryCount: 1,
        selectorSqlExecutions: 0,
        elapsedMilliseconds: performance.now() - startedAt,
      };
    }
    if (
      !row.publicationId ||
      !row.pageInstanceId ||
      !row.manifestId ||
      !row.documentHash ||
      !row.resolvedDataJson
    ) {
      return {
        result: { status: 404, reason: 'unpublished' },
        materializationMode,
        sqlQueryCount: 1,
        selectorSqlExecutions: 0,
        elapsedMilliseconds: performance.now() - startedAt,
      };
    }
    const result: ServeResult = {
      status: 200,
      publicationId: row.publicationId,
      canonicalUrl,
      documentHash: row.documentHash,
      document: row.renderedDocumentJson
        ? parsePublishedDocumentJson(row.renderedDocumentJson)
        : this.renderPublishedManifest(
            templateId,
            row.pageInstanceId,
            row.manifestId,
            row.resolvedDataJson
          ),
    };
    return {
      result,
      materializationMode,
      sqlQueryCount: row.renderedDocumentJson ? 1 : 2,
      selectorSqlExecutions: 0,
      elapsedMilliseconds: performance.now() - startedAt,
    };
  }

  serve(templateId: string, canonicalUrl: string): ServeResult {
    return this.serveWithEvidence(templateId, canonicalUrl).result;
  }
}
