import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export type JsonObject = Record<string, unknown>;
export type JsonValue = JsonObject | JsonValue[] | boolean | number | string | null;

const createdAt = () => text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    urlPattern: text('url_pattern').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
    routeAuthority: text('route_authority', { enum: ['router_service'] })
      .notNull()
      .default('router_service'),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('templates_key_unique').on(table.key),
    uniqueIndex('templates_domain_pattern_unique').on(table.domain, table.urlPattern),
    check('templates_key_not_blank', sql`length(trim(${table.key})) > 0`),
    check('templates_domain_not_blank', sql`length(trim(${table.domain})) > 0`),
    check('templates_pattern_absolute', sql`${table.urlPattern} like '/%'`),
  ]
);

export const templateSlots = sqliteTable(
  'template_slots',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    kind: text('kind', { enum: ['static', 'variable', 'derived'] }).notNull(),
    pathPosition: integer('path_position'),
    staticValue: text('static_value'),
    valueType: text('value_type', { enum: ['string', 'integer', 'boolean'] })
      .notNull()
      .default('string'),
    isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('template_slots_template_key_unique').on(table.templateId, table.key),
    uniqueIndex('template_slots_id_template_unique').on(table.id, table.templateId),
    uniqueIndex('template_slots_path_position_unique')
      .on(table.templateId, table.pathPosition)
      .where(sql`${table.pathPosition} is not null`),
    index('template_slots_template_idx').on(table.templateId, table.pathPosition),
    check('template_slots_key_not_blank', sql`length(trim(${table.key})) > 0`),
    check(
      'template_slots_non_negative_position',
      sql`${table.pathPosition} is null or ${table.pathPosition} >= 0`
    ),
    check(
      'template_slots_kind_shape',
      sql`(
        (${table.kind} = 'static' and ${table.pathPosition} is not null and ${table.staticValue} is not null)
        or (${table.kind} = 'variable' and ${table.pathPosition} is not null and ${table.staticValue} is null)
        or (${table.kind} = 'derived' and ${table.pathPosition} is null and ${table.staticValue} is null)
      )`
    ),
  ]
);

export const routeIngestions = sqliteTable(
  'route_ingestions',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    source: text('source', { enum: ['router_service', 'seed'] })
      .notNull()
      .default('router_service'),
    sourceRevision: text('source_revision').notNull(),
    status: text('status', { enum: ['running', 'succeeded', 'failed'] }).notNull(),
    checksum: text('checksum').notNull(),
    rowCount: integer('row_count').notNull().default(0),
    sourceObservedAt: text('source_observed_at').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('route_ingestions_source_revision_unique').on(
      table.templateId,
      table.source,
      table.sourceRevision
    ),
    index('route_ingestions_template_status_idx').on(table.templateId, table.status),
    check('route_ingestions_row_count_non_negative', sql`${table.rowCount} >= 0`),
    check(
      'route_ingestions_completion_shape',
      sql`(${table.status} = 'running' and ${table.completedAt} is null)
        or (${table.status} in ('succeeded', 'failed') and ${table.completedAt} is not null)`
    ),
  ]
);

export const pageInstances = sqliteTable(
  'page_instances',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    canonicalUrl: text('canonical_url').notNull(),
    routeExternalId: text('route_external_id').notNull(),
    routeStatus: text('route_status', { enum: ['live', 'not_live', 'archived'] }).notNull(),
    routeRevision: text('route_revision').notNull(),
    lastIngestionId: text('last_ingestion_id').references(() => routeIngestions.id, {
      onDelete: 'restrict',
    }),
    slotValueHash: text('slot_value_hash').notNull(),
    contextJson: text('context_json', { mode: 'json' }).$type<JsonObject>().notNull(),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('page_instances_template_canonical_unique').on(
      table.templateId,
      table.canonicalUrl
    ),
    uniqueIndex('page_instances_route_external_id_unique').on(table.routeExternalId),
    uniqueIndex('page_instances_template_slot_hash_unique').on(
      table.templateId,
      table.slotValueHash
    ),
    uniqueIndex('page_instances_id_template_unique').on(table.id, table.templateId),
    index('page_instances_template_status_idx').on(table.templateId, table.routeStatus),
    check('page_instances_canonical_url_absolute', sql`${table.canonicalUrl} like '/%'`),
    check('page_instances_context_json_valid', sql`json_valid(${table.contextJson})`),
  ]
);

export const pageSlotValues = sqliteTable(
  'page_slot_values',
  {
    pageInstanceId: text('page_instance_id').notNull(),
    templateId: text('template_id').notNull(),
    slotId: text('slot_id').notNull(),
    value: text('value').notNull(),
    normalizedValue: text('normalized_value').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.pageInstanceId, table.slotId] }),
    foreignKey({
      name: 'page_slot_values_page_template_fk',
      columns: [table.pageInstanceId, table.templateId],
      foreignColumns: [pageInstances.id, pageInstances.templateId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'page_slot_values_slot_template_fk',
      columns: [table.slotId, table.templateId],
      foreignColumns: [templateSlots.id, templateSlots.templateId],
    }).onDelete('cascade'),
    index('page_slot_values_selector_idx').on(
      table.templateId,
      table.slotId,
      table.normalizedValue,
      table.pageInstanceId
    ),
  ]
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    namespace: text('namespace').notNull(),
    value: text('value').notNull(),
    label: text('label').notNull(),
    description: text('description').notNull().default(''),
    source: text('source', { enum: ['pipeline', 'author', 'seed'] }).notNull(),
    parentTagId: text('parent_tag_id'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('tags_template_namespace_value_unique').on(
      table.templateId,
      table.namespace,
      table.value
    ),
    uniqueIndex('tags_id_template_unique').on(table.id, table.templateId),
    foreignKey({
      name: 'tags_parent_same_template_fk',
      columns: [table.parentTagId, table.templateId],
      foreignColumns: [table.id, table.templateId],
    }).onDelete('restrict'),
    index('tags_template_namespace_idx').on(table.templateId, table.namespace, table.value),
    check('tags_namespace_not_blank', sql`length(trim(${table.namespace})) > 0`),
    check('tags_value_not_blank', sql`length(trim(${table.value})) > 0`),
  ]
);

export const pageTags = sqliteTable(
  'page_tags',
  {
    pageInstanceId: text('page_instance_id').notNull(),
    templateId: text('template_id').notNull(),
    tagId: text('tag_id').notNull(),
    source: text('source', { enum: ['pipeline', 'author', 'seed'] }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.pageInstanceId, table.tagId] }),
    foreignKey({
      name: 'page_tags_page_template_fk',
      columns: [table.pageInstanceId, table.templateId],
      foreignColumns: [pageInstances.id, pageInstances.templateId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'page_tags_tag_template_fk',
      columns: [table.tagId, table.templateId],
      foreignColumns: [tags.id, tags.templateId],
    }).onDelete('cascade'),
    index('page_tags_selector_idx').on(table.templateId, table.tagId, table.pageInstanceId),
  ]
);

export const routeAuditLog = sqliteTable(
  'route_audit_log',
  {
    id: text('id').primaryKey(),
    ingestionId: text('ingestion_id')
      .notNull()
      .references(() => routeIngestions.id, { onDelete: 'restrict' }),
    pageInstanceId: text('page_instance_id').references(() => pageInstances.id, {
      onDelete: 'restrict',
    }),
    routeExternalId: text('route_external_id').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    action: text('action', { enum: ['insert', 'update', 'status', 'skip', 'error'] }).notNull(),
    previousStatus: text('previous_status', { enum: ['live', 'not_live', 'archived'] }),
    nextStatus: text('next_status', { enum: ['live', 'not_live', 'archived'] }),
    detailJson: text('detail_json', { mode: 'json' }).$type<JsonObject>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('route_audit_log_ingestion_idx').on(table.ingestionId, table.createdAt),
    index('route_audit_log_page_idx').on(table.pageInstanceId, table.createdAt),
    check('route_audit_log_detail_json_valid', sql`json_valid(${table.detailJson})`),
  ]
);

export const variants = sqliteTable(
  'variants',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    priority: integer('priority').notNull(),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('draft'),
    activeRevisionId: text('active_revision_id'),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('variants_template_key_unique').on(table.templateId, table.key),
    uniqueIndex('variants_id_template_unique').on(table.id, table.templateId),
    uniqueIndex('variants_one_default_per_template')
      .on(table.templateId)
      .where(sql`${table.isDefault} = 1`),
    index('variants_resolution_order_idx').on(table.templateId, table.status, table.priority),
    check(
      'variants_default_priority',
      sql`(${table.isDefault} = 1 and ${table.priority} = 0)
        or (${table.isDefault} = 0 and ${table.priority} > 0)`
    ),
  ]
);

export const variantRevisions = sqliteTable(
  'variant_revisions',
  {
    id: text('id').primaryKey(),
    variantId: text('variant_id')
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').notNull(),
    selectorInput: text('selector_input').notNull(),
    selectorSql: text('selector_sql').notNull(),
    selectorHash: text('selector_hash').notNull(),
    validationResultJson: text('validation_result_json', { mode: 'json' })
      .$type<JsonObject>()
      .notNull(),
    selectorDescription: text('selector_description').notNull().default(''),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('variant_revisions_variant_number_unique').on(
      table.variantId,
      table.revisionNumber
    ),
    uniqueIndex('variant_revisions_id_variant_unique').on(table.id, table.variantId),
    index('variant_revisions_variant_idx').on(table.variantId, table.revisionNumber),
    check('variant_revisions_number_positive', sql`${table.revisionNumber} > 0`),
    check('variant_revisions_selector_not_blank', sql`length(trim(${table.selectorSql})) > 0`),
    check(
      'variant_revisions_selector_input_not_blank',
      sql`length(trim(${table.selectorInput})) > 0`
    ),
    check(
      'variant_revisions_validation_result_json_valid',
      sql`json_valid(${table.validationResultJson})`
    ),
  ]
);

export const blockTypes = sqliteTable(
  'block_types',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    schemaJson: text('schema_json', { mode: 'json' }).$type<JsonObject>().notNull(),
    previewRendererJson: text('preview_renderer_json', { mode: 'json' }).$type<JsonObject | null>(),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('block_types_key_unique').on(table.key),
    check('block_types_schema_version_positive', sql`${table.schemaVersion} > 0`),
    check('block_types_schema_json_valid', sql`json_valid(${table.schemaJson})`),
    check(
      'block_types_preview_renderer_json_valid',
      sql`${table.previewRendererJson} is null or json_valid(${table.previewRendererJson})`
    ),
  ]
);

export const blockLineages = sqliteTable(
  'block_lineages',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('block_lineages_template_key_unique').on(table.templateId, table.key),
    uniqueIndex('block_lineages_id_template_unique').on(table.id, table.templateId),
    index('block_lineages_template_idx').on(table.templateId),
  ]
);

export const blockVersions = sqliteTable(
  'block_versions',
  {
    id: text('id').primaryKey(),
    lineageId: text('lineage_id')
      .notNull()
      .references(() => blockLineages.id, { onDelete: 'restrict' }),
    parentVersionId: text('parent_version_id'),
    versionNumber: integer('version_number').notNull(),
    blockTypeId: text('block_type_id')
      .notNull()
      .references(() => blockTypes.id, { onDelete: 'restrict' }),
    schemaVersion: integer('schema_version').notNull(),
    contentJson: text('content_json', { mode: 'json' }).$type<JsonObject>().notNull(),
    contentHash: text('content_hash').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentVersionId],
      foreignColumns: [table.id],
      name: 'block_versions_parent_fk',
    }).onDelete('restrict'),
    uniqueIndex('block_versions_lineage_number_unique').on(table.lineageId, table.versionNumber),
    uniqueIndex('block_versions_lineage_hash_unique').on(table.lineageId, table.contentHash),
    index('block_versions_type_idx').on(table.blockTypeId),
    index('block_versions_parent_idx').on(table.parentVersionId),
    check('block_versions_number_positive', sql`${table.versionNumber} > 0`),
    check('block_versions_schema_version_positive', sql`${table.schemaVersion} > 0`),
    check('block_versions_content_json_valid', sql`json_valid(${table.contentJson})`),
  ]
);

export const variantOperations = sqliteTable(
  'variant_operations',
  {
    id: text('id').primaryKey(),
    variantRevisionId: text('variant_revision_id')
      .notNull()
      .references(() => variantRevisions.id, { onDelete: 'cascade' }),
    placementKey: text('placement_key').notNull(),
    operationKind: text('operation_kind', { enum: ['set', 'tombstone', 'order'] }).notNull(),
    blockVersionId: text('block_version_id').references(() => blockVersions.id, {
      onDelete: 'restrict',
    }),
    orderIndex: integer('order_index'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('variant_operations_one_content_per_placement')
      .on(table.variantRevisionId, table.placementKey)
      .where(sql`${table.operationKind} in ('set', 'tombstone')`),
    uniqueIndex('variant_operations_one_order_per_placement')
      .on(table.variantRevisionId, table.placementKey)
      .where(sql`${table.operationKind} = 'order'`),
    index('variant_operations_revision_idx').on(table.variantRevisionId, table.placementKey),
    index('variant_operations_block_version_idx').on(table.blockVersionId),
    check('variant_operations_placement_not_blank', sql`length(trim(${table.placementKey})) > 0`),
    check(
      'variant_operations_valid_payload',
      sql`(${table.operationKind} = 'set' and ${table.blockVersionId} is not null and ${table.orderIndex} is null)
        or (${table.operationKind} = 'tombstone' and ${table.blockVersionId} is null and ${table.orderIndex} is null)
        or (${table.operationKind} = 'order' and ${table.blockVersionId} is null and ${table.orderIndex} >= 0)`
    ),
  ]
);

export const publications = sqliteTable(
  'publications',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    sequence: integer('sequence').notNull(),
    status: text('status', { enum: ['published', 'failed'] }).notNull(),
    inputHash: text('input_hash').notNull(),
    previousPublicationId: text('previous_publication_id'),
    routeRevision: text('route_revision').notNull(),
    pageCount: integer('page_count').notNull(),
    manifestCount: integer('manifest_count').notNull(),
    failureJson: text('failure_json', { mode: 'json' }).$type<JsonObject | null>(),
    createdBy: text('created_by').notNull(),
    publishedAt: text('published_at'),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('publications_template_sequence_unique').on(table.templateId, table.sequence),
    uniqueIndex('publications_id_template_unique').on(table.id, table.templateId),
    index('publications_template_created_idx').on(table.templateId, table.createdAt),
    check('publications_sequence_positive', sql`${table.sequence} > 0`),
    check('publications_page_count_non_negative', sql`${table.pageCount} >= 0`),
    check('publications_manifest_count_non_negative', sql`${table.manifestCount} >= 0`),
    check(
      'publications_result_shape',
      sql`(${table.status} = 'published' and ${table.publishedAt} is not null and ${table.failureJson} is null)
        or (${table.status} = 'failed' and ${table.publishedAt} is null and ${table.failureJson} is not null)`
    ),
    check(
      'publications_failure_json_valid',
      sql`${table.failureJson} is null or json_valid(${table.failureJson})`
    ),
  ]
);

export const documentManifests = sqliteTable(
  'document_manifests',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    contentHash: text('content_hash').notNull(),
    placementCount: integer('placement_count').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('document_manifests_template_hash_unique').on(table.templateId, table.contentHash),
    uniqueIndex('document_manifests_id_template_unique').on(table.id, table.templateId),
    check('document_manifests_placement_count_non_negative', sql`${table.placementCount} >= 0`),
  ]
);

export const documentManifestItems = sqliteTable(
  'document_manifest_items',
  {
    manifestId: text('manifest_id')
      .notNull()
      .references(() => documentManifests.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    placementKey: text('placement_key').notNull(),
    blockVersionId: text('block_version_id')
      .notNull()
      .references(() => blockVersions.id, { onDelete: 'restrict' }),
    sourceVariantRevisionId: text('source_variant_revision_id')
      .notNull()
      .references(() => variantRevisions.id, { onDelete: 'restrict' }),
    sourceOperationId: text('source_operation_id')
      .notNull()
      .references(() => variantOperations.id, { onDelete: 'restrict' }),
    sourcePriority: integer('source_priority').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.manifestId, table.placementKey] }),
    uniqueIndex('document_manifest_items_ordinal_unique').on(table.manifestId, table.ordinal),
    index('document_manifest_items_block_version_idx').on(table.blockVersionId),
    index('document_manifest_items_source_operation_idx').on(table.sourceOperationId),
    check('document_manifest_items_ordinal_non_negative', sql`${table.ordinal} >= 0`),
    check('document_manifest_items_priority_non_negative', sql`${table.sourcePriority} >= 0`),
  ]
);

export const publishedPageDocuments = sqliteTable(
  'published_page_documents',
  {
    publicationId: text('publication_id').notNull(),
    templateId: text('template_id').notNull(),
    pageInstanceId: text('page_instance_id').notNull(),
    manifestId: text('manifest_id').notNull(),
    canonicalUrl: text('canonical_url').notNull(),
    routeStatus: text('route_status', { enum: ['live', 'not_live', 'archived'] }).notNull(),
    resolvedDataJson: text('resolved_data_json', { mode: 'json' }).$type<JsonObject>().notNull(),
    renderedDocumentJson: text('rendered_document_json', { mode: 'json' }).$type<JsonValue>(),
    documentHash: text('document_hash').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.publicationId, table.pageInstanceId] }),
    foreignKey({
      name: 'published_page_documents_publication_template_fk',
      columns: [table.publicationId, table.templateId],
      foreignColumns: [publications.id, publications.templateId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'published_page_documents_page_template_fk',
      columns: [table.pageInstanceId, table.templateId],
      foreignColumns: [pageInstances.id, pageInstances.templateId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'published_page_documents_manifest_template_fk',
      columns: [table.manifestId, table.templateId],
      foreignColumns: [documentManifests.id, documentManifests.templateId],
    }).onDelete('restrict'),
    uniqueIndex('published_page_documents_url_unique').on(table.publicationId, table.canonicalUrl),
    index('published_page_documents_serve_idx').on(
      table.templateId,
      table.canonicalUrl,
      table.publicationId
    ),
    index('published_page_documents_manifest_idx').on(table.manifestId),
    check('published_page_documents_url_absolute', sql`${table.canonicalUrl} like '/%'`),
    check(
      'published_page_documents_resolved_data_valid',
      sql`json_valid(${table.resolvedDataJson})`
    ),
    check(
      'published_page_documents_rendered_document_valid',
      sql`${table.renderedDocumentJson} is null or json_valid(${table.renderedDocumentJson})`
    ),
  ]
);

export const currentPublications = sqliteTable(
  'current_publications',
  {
    templateId: text('template_id')
      .primaryKey()
      .references(() => templates.id, { onDelete: 'cascade' }),
    publicationId: text('publication_id').notNull().unique(),
    activatedAt: text('activated_at').notNull(),
    activatedBy: text('activated_by').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'current_publications_publication_template_fk',
      columns: [table.publicationId, table.templateId],
      foreignColumns: [publications.id, publications.templateId],
    }).onDelete('restrict'),
  ]
);

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateSlot = typeof templateSlots.$inferSelect;
export type PageInstance = typeof pageInstances.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type VariantRevision = typeof variantRevisions.$inferSelect;
export type VariantOperation = typeof variantOperations.$inferSelect;
export type BlockVersion = typeof blockVersions.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type DocumentManifest = typeof documentManifests.$inferSelect;
export type PublishedPageDocument = typeof publishedPageDocuments.$inferSelect;
