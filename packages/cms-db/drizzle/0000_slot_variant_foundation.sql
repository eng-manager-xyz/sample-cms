PRAGMA foreign_keys = ON;

CREATE TABLE templates (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  url_pattern TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  route_authority TEXT NOT NULL DEFAULT 'camo_press' CHECK (route_authority = 'camo_press'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT templates_key_not_blank CHECK (length(trim(key)) > 0),
  CONSTRAINT templates_pattern_absolute CHECK (url_pattern LIKE '/%')
);

CREATE UNIQUE INDEX templates_key_unique ON templates (key);
CREATE UNIQUE INDEX templates_url_pattern_unique ON templates (url_pattern);

CREATE TABLE template_slots (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('static', 'variable', 'derived')),
  path_position INTEGER,
  static_value TEXT,
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'integer', 'boolean')),
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT template_slots_key_not_blank CHECK (length(trim(key)) > 0),
  CONSTRAINT template_slots_non_negative_position CHECK (path_position IS NULL OR path_position >= 0),
  CONSTRAINT template_slots_kind_shape CHECK (
    (kind = 'static' AND path_position IS NOT NULL AND static_value IS NOT NULL)
    OR (kind = 'variable' AND path_position IS NOT NULL AND static_value IS NULL)
    OR (kind = 'derived' AND path_position IS NULL AND static_value IS NULL)
  )
);

CREATE UNIQUE INDEX template_slots_template_key_unique ON template_slots (template_id, key);
CREATE UNIQUE INDEX template_slots_id_template_unique ON template_slots (id, template_id);
CREATE UNIQUE INDEX template_slots_path_position_unique
  ON template_slots (template_id, path_position)
  WHERE path_position IS NOT NULL;
CREATE INDEX template_slots_template_idx ON template_slots (template_id, path_position);

CREATE TABLE route_ingestions (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  source TEXT NOT NULL DEFAULT 'camo_press' CHECK (source IN ('camo_press', 'seed')),
  source_revision TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  checksum TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT route_ingestions_row_count_non_negative CHECK (row_count >= 0),
  CONSTRAINT route_ingestions_completion_shape CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status IN ('succeeded', 'failed') AND completed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX route_ingestions_source_revision_unique
  ON route_ingestions (template_id, source, source_revision);
CREATE INDEX route_ingestions_template_status_idx ON route_ingestions (template_id, status);

CREATE TABLE page_instances (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  canonical_url TEXT NOT NULL,
  route_external_id TEXT NOT NULL,
  route_status TEXT NOT NULL CHECK (route_status IN ('live', 'not_live', 'archived')),
  route_revision TEXT NOT NULL,
  last_ingestion_id TEXT REFERENCES route_ingestions(id) ON DELETE RESTRICT,
  context_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT page_instances_canonical_url_absolute CHECK (canonical_url LIKE '/%'),
  CONSTRAINT page_instances_context_json_valid CHECK (json_valid(context_json))
);

CREATE UNIQUE INDEX page_instances_canonical_url_unique ON page_instances (canonical_url);
CREATE UNIQUE INDEX page_instances_route_external_id_unique ON page_instances (route_external_id);
CREATE UNIQUE INDEX page_instances_id_template_unique ON page_instances (id, template_id);
CREATE INDEX page_instances_template_status_idx ON page_instances (template_id, route_status);

CREATE TABLE page_slot_values (
  page_instance_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_instance_id, slot_id),
  CONSTRAINT page_slot_values_page_template_fk
    FOREIGN KEY (page_instance_id, template_id)
    REFERENCES page_instances(id, template_id) ON DELETE CASCADE,
  CONSTRAINT page_slot_values_slot_template_fk
    FOREIGN KEY (slot_id, template_id)
    REFERENCES template_slots(id, template_id) ON DELETE CASCADE
);

CREATE INDEX page_slot_values_selector_idx
  ON page_slot_values (template_id, slot_id, normalized_value, page_instance_id);

CREATE TABLE tags (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pipeline', 'author', 'seed')),
  parent_tag_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tags_parent_same_template_fk
    FOREIGN KEY (parent_tag_id, template_id)
    REFERENCES tags(id, template_id) ON DELETE RESTRICT,
  CONSTRAINT tags_namespace_not_blank CHECK (length(trim(namespace)) > 0),
  CONSTRAINT tags_value_not_blank CHECK (length(trim(value)) > 0)
);

CREATE UNIQUE INDEX tags_template_namespace_value_unique ON tags (template_id, namespace, value);
CREATE UNIQUE INDEX tags_id_template_unique ON tags (id, template_id);
CREATE INDEX tags_template_namespace_idx ON tags (template_id, namespace, value);

CREATE TABLE page_tags (
  page_instance_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('pipeline', 'author', 'seed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (page_instance_id, tag_id),
  CONSTRAINT page_tags_page_template_fk
    FOREIGN KEY (page_instance_id, template_id)
    REFERENCES page_instances(id, template_id) ON DELETE CASCADE,
  CONSTRAINT page_tags_tag_template_fk
    FOREIGN KEY (tag_id, template_id)
    REFERENCES tags(id, template_id) ON DELETE CASCADE
);

CREATE INDEX page_tags_selector_idx ON page_tags (template_id, tag_id, page_instance_id);

CREATE TABLE route_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  ingestion_id TEXT NOT NULL REFERENCES route_ingestions(id) ON DELETE RESTRICT,
  page_instance_id TEXT REFERENCES page_instances(id) ON DELETE RESTRICT,
  route_external_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'status', 'skip', 'error')),
  previous_status TEXT CHECK (previous_status IN ('live', 'not_live', 'archived')),
  next_status TEXT CHECK (next_status IN ('live', 'not_live', 'archived')),
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT route_audit_log_detail_json_valid CHECK (json_valid(detail_json))
);

CREATE INDEX route_audit_log_ingestion_idx ON route_audit_log (ingestion_id, created_at);
CREATE INDEX route_audit_log_page_idx ON route_audit_log (page_instance_id, created_at);

CREATE TABLE variants (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  active_revision_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT variants_default_priority CHECK (
    (is_default = 1 AND priority = 0)
    OR (is_default = 0 AND priority > 0)
  )
);

CREATE UNIQUE INDEX variants_template_key_unique ON variants (template_id, key);
CREATE UNIQUE INDEX variants_id_template_unique ON variants (id, template_id);
CREATE UNIQUE INDEX variants_one_default_per_template ON variants (template_id) WHERE is_default = 1;
CREATE INDEX variants_resolution_order_idx ON variants (template_id, status, priority);

CREATE TABLE variant_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  variant_id TEXT NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  selector_sql TEXT NOT NULL,
  selector_hash TEXT NOT NULL,
  selector_description TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT variant_revisions_number_positive CHECK (revision_number > 0),
  CONSTRAINT variant_revisions_selector_not_blank CHECK (length(trim(selector_sql)) > 0)
);

CREATE UNIQUE INDEX variant_revisions_variant_number_unique
  ON variant_revisions (variant_id, revision_number);
CREATE UNIQUE INDEX variant_revisions_id_variant_unique ON variant_revisions (id, variant_id);
CREATE INDEX variant_revisions_variant_idx ON variant_revisions (variant_id, revision_number);

CREATE TABLE block_types (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  schema_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT block_types_schema_version_positive CHECK (schema_version > 0),
  CONSTRAINT block_types_schema_json_valid CHECK (json_valid(schema_json))
);

CREATE UNIQUE INDEX block_types_key_unique ON block_types (key);

CREATE TABLE block_lineages (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX block_lineages_template_key_unique ON block_lineages (template_id, key);
CREATE UNIQUE INDEX block_lineages_id_template_unique ON block_lineages (id, template_id);
CREATE INDEX block_lineages_template_idx ON block_lineages (template_id);

CREATE TABLE block_versions (
  id TEXT PRIMARY KEY NOT NULL,
  lineage_id TEXT NOT NULL REFERENCES block_lineages(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL,
  block_type_id TEXT NOT NULL REFERENCES block_types(id) ON DELETE RESTRICT,
  schema_version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT block_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT block_versions_schema_version_positive CHECK (schema_version > 0),
  CONSTRAINT block_versions_content_json_valid CHECK (json_valid(content_json))
);

CREATE UNIQUE INDEX block_versions_lineage_number_unique
  ON block_versions (lineage_id, version_number);
CREATE UNIQUE INDEX block_versions_lineage_hash_unique ON block_versions (lineage_id, content_hash);
CREATE INDEX block_versions_type_idx ON block_versions (block_type_id);

CREATE TABLE variant_operations (
  id TEXT PRIMARY KEY NOT NULL,
  variant_revision_id TEXT NOT NULL REFERENCES variant_revisions(id) ON DELETE CASCADE,
  placement_key TEXT NOT NULL,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('set', 'tombstone', 'order')),
  block_version_id TEXT REFERENCES block_versions(id) ON DELETE RESTRICT,
  order_index INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT variant_operations_placement_not_blank CHECK (length(trim(placement_key)) > 0),
  CONSTRAINT variant_operations_valid_payload CHECK (
    (operation_kind = 'set' AND block_version_id IS NOT NULL AND order_index IS NULL)
    OR (operation_kind = 'tombstone' AND block_version_id IS NULL AND order_index IS NULL)
    OR (operation_kind = 'order' AND block_version_id IS NULL AND order_index >= 0)
  )
);

CREATE UNIQUE INDEX variant_operations_one_content_per_placement
  ON variant_operations (variant_revision_id, placement_key)
  WHERE operation_kind IN ('set', 'tombstone');
CREATE UNIQUE INDEX variant_operations_one_order_per_placement
  ON variant_operations (variant_revision_id, placement_key)
  WHERE operation_kind = 'order';
CREATE INDEX variant_operations_revision_idx
  ON variant_operations (variant_revision_id, placement_key);
CREATE INDEX variant_operations_block_version_idx ON variant_operations (block_version_id);

CREATE TABLE publications (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'failed')),
  input_hash TEXT NOT NULL,
  previous_publication_id TEXT REFERENCES publications(id) ON DELETE RESTRICT,
  route_revision TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  manifest_count INTEGER NOT NULL,
  failure_json TEXT,
  created_by TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT publications_sequence_positive CHECK (sequence > 0),
  CONSTRAINT publications_page_count_non_negative CHECK (page_count >= 0),
  CONSTRAINT publications_manifest_count_non_negative CHECK (manifest_count >= 0),
  CONSTRAINT publications_result_shape CHECK (
    (status = 'published' AND published_at IS NOT NULL AND failure_json IS NULL)
    OR (status = 'failed' AND published_at IS NULL AND failure_json IS NOT NULL)
  ),
  CONSTRAINT publications_failure_json_valid CHECK (failure_json IS NULL OR json_valid(failure_json))
);

CREATE UNIQUE INDEX publications_template_sequence_unique ON publications (template_id, sequence);
CREATE UNIQUE INDEX publications_id_template_unique ON publications (id, template_id);
CREATE INDEX publications_template_created_idx ON publications (template_id, created_at);

CREATE TABLE document_manifests (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  content_hash TEXT NOT NULL,
  placement_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT document_manifests_placement_count_non_negative CHECK (placement_count >= 0)
);

CREATE UNIQUE INDEX document_manifests_template_hash_unique
  ON document_manifests (template_id, content_hash);
CREATE UNIQUE INDEX document_manifests_id_template_unique ON document_manifests (id, template_id);

CREATE TABLE document_manifest_items (
  manifest_id TEXT NOT NULL REFERENCES document_manifests(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  placement_key TEXT NOT NULL,
  block_version_id TEXT NOT NULL REFERENCES block_versions(id) ON DELETE RESTRICT,
  source_variant_revision_id TEXT NOT NULL REFERENCES variant_revisions(id) ON DELETE RESTRICT,
  source_priority INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (manifest_id, placement_key),
  CONSTRAINT document_manifest_items_ordinal_non_negative CHECK (ordinal >= 0),
  CONSTRAINT document_manifest_items_priority_non_negative CHECK (source_priority >= 0)
);

CREATE UNIQUE INDEX document_manifest_items_ordinal_unique
  ON document_manifest_items (manifest_id, ordinal);
CREATE INDEX document_manifest_items_block_version_idx
  ON document_manifest_items (block_version_id);

CREATE TABLE published_page_documents (
  publication_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  page_instance_id TEXT NOT NULL,
  manifest_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  route_status TEXT NOT NULL CHECK (route_status IN ('live', 'not_live', 'archived')),
  resolved_data_json TEXT NOT NULL,
  rendered_document_json TEXT,
  document_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (publication_id, page_instance_id),
  CONSTRAINT published_page_documents_publication_template_fk
    FOREIGN KEY (publication_id, template_id)
    REFERENCES publications(id, template_id) ON DELETE RESTRICT,
  CONSTRAINT published_page_documents_page_template_fk
    FOREIGN KEY (page_instance_id, template_id)
    REFERENCES page_instances(id, template_id) ON DELETE RESTRICT,
  CONSTRAINT published_page_documents_manifest_template_fk
    FOREIGN KEY (manifest_id, template_id)
    REFERENCES document_manifests(id, template_id) ON DELETE RESTRICT,
  CONSTRAINT published_page_documents_url_absolute CHECK (canonical_url LIKE '/%'),
  CONSTRAINT published_page_documents_resolved_data_valid CHECK (json_valid(resolved_data_json)),
  CONSTRAINT published_page_documents_rendered_document_valid CHECK (
    rendered_document_json IS NULL OR json_valid(rendered_document_json)
  )
);

CREATE UNIQUE INDEX published_page_documents_url_unique
  ON published_page_documents (publication_id, canonical_url);
CREATE INDEX published_page_documents_serve_idx
  ON published_page_documents (template_id, canonical_url, publication_id);
CREATE INDEX published_page_documents_manifest_idx ON published_page_documents (manifest_id);

CREATE TABLE current_publications (
  template_id TEXT PRIMARY KEY NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  publication_id TEXT NOT NULL UNIQUE,
  activated_at TEXT NOT NULL,
  activated_by TEXT NOT NULL,
  CONSTRAINT current_publications_publication_template_fk
    FOREIGN KEY (publication_id, template_id)
    REFERENCES publications(id, template_id) ON DELETE RESTRICT
);

CREATE TRIGGER templates_create_default_variant
AFTER INSERT ON templates
BEGIN
  INSERT INTO variants (
    id, template_id, key, name, description, is_default, priority, status,
    active_revision_id, created_at, updated_at
  ) VALUES (
    NEW.id || ':default', NEW.id, 'default', 'Default',
    'Template-owned default layer', 1, 0, 'active', NULL, NEW.created_at, NEW.created_at
  );
  INSERT INTO variant_revisions (
    id, variant_id, revision_number, selector_sql, selector_hash,
    selector_description, created_by, created_at
  ) VALUES (
    NEW.id || ':default:r1', NEW.id || ':default', 1, 'TRUE',
    '35f9735092451bcd1079d62accc2e748ffc0629401731fcbc3cb8f6e12a28079', 'All pages for this template', 'system', NEW.created_at
  );
  UPDATE variants
  SET active_revision_id = NEW.id || ':default:r1'
  WHERE id = NEW.id || ':default';
END;

CREATE TRIGGER page_instances_ingestion_template_insert
BEFORE INSERT ON page_instances
WHEN NEW.last_ingestion_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM route_ingestions
    WHERE id = NEW.last_ingestion_id AND template_id = NEW.template_id
  )
BEGIN
  SELECT RAISE(ABORT, 'route ingestion must belong to the page template');
END;

CREATE TRIGGER page_instances_ingestion_template_update
BEFORE UPDATE OF last_ingestion_id, template_id ON page_instances
WHEN NEW.last_ingestion_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM route_ingestions
    WHERE id = NEW.last_ingestion_id AND template_id = NEW.template_id
  )
BEGIN
  SELECT RAISE(ABORT, 'route ingestion must belong to the page template');
END;

CREATE TRIGGER route_audit_log_template_insert
BEFORE INSERT ON route_audit_log
WHEN NEW.page_instance_id IS NOT NULL
  AND (
    SELECT template_id FROM page_instances WHERE id = NEW.page_instance_id
  ) <> (
    SELECT template_id FROM route_ingestions WHERE id = NEW.ingestion_id
  )
BEGIN
  SELECT RAISE(ABORT, 'route audit page and ingestion must share a template');
END;

CREATE TRIGGER route_audit_log_immutable_update
BEFORE UPDATE ON route_audit_log
BEGIN
  SELECT RAISE(ABORT, 'route audit records are immutable');
END;

CREATE TRIGGER route_audit_log_immutable_delete
BEFORE DELETE ON route_audit_log
BEGIN
  SELECT RAISE(ABORT, 'route audit records are immutable');
END;

CREATE TRIGGER variants_active_revision_insert
BEFORE INSERT ON variants
WHEN NEW.active_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM variant_revisions
    WHERE id = NEW.active_revision_id AND variant_id = NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'active revision must belong to the variant');
END;

CREATE TRIGGER variants_active_revision_update
BEFORE UPDATE OF active_revision_id ON variants
WHEN NEW.active_revision_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM variant_revisions
    WHERE id = NEW.active_revision_id AND variant_id = NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'active revision must belong to the variant');
END;

CREATE TRIGGER variant_revisions_default_selector_insert
BEFORE INSERT ON variant_revisions
WHEN EXISTS (SELECT 1 FROM variants WHERE id = NEW.variant_id AND is_default = 1)
  AND replace(lower(trim(NEW.selector_sql)), ' ', '') NOT IN ('true', '1', '1=1')
BEGIN
  SELECT RAISE(ABORT, 'the default variant selector must match every page');
END;

CREATE TRIGGER variant_revisions_immutable_update
BEFORE UPDATE ON variant_revisions
BEGIN
  SELECT RAISE(ABORT, 'variant revisions are immutable');
END;

CREATE TRIGGER variant_revisions_immutable_delete
BEFORE DELETE ON variant_revisions
BEGIN
  SELECT RAISE(ABORT, 'variant revisions are immutable');
END;

CREATE TRIGGER block_versions_immutable_update
BEFORE UPDATE ON block_versions
BEGIN
  SELECT RAISE(ABORT, 'block versions are immutable');
END;

CREATE TRIGGER block_versions_immutable_delete
BEFORE DELETE ON block_versions
BEGIN
  SELECT RAISE(ABORT, 'block versions are immutable');
END;

CREATE TRIGGER variant_operations_block_template_insert
BEFORE INSERT ON variant_operations
WHEN NEW.block_version_id IS NOT NULL
  AND (
    SELECT lineages.template_id
    FROM block_versions AS versions
    JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
    WHERE versions.id = NEW.block_version_id
  ) <> (
    SELECT variants.template_id
    FROM variant_revisions AS revisions
    JOIN variants ON variants.id = revisions.variant_id
    WHERE revisions.id = NEW.variant_revision_id
  )
BEGIN
  SELECT RAISE(ABORT, 'block version and variant operation must share a template');
END;

CREATE TRIGGER variant_operations_block_template_update
BEFORE UPDATE OF block_version_id, variant_revision_id ON variant_operations
WHEN NEW.block_version_id IS NOT NULL
  AND (
    SELECT lineages.template_id
    FROM block_versions AS versions
    JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
    WHERE versions.id = NEW.block_version_id
  ) <> (
    SELECT variants.template_id
    FROM variant_revisions AS revisions
    JOIN variants ON variants.id = revisions.variant_id
    WHERE revisions.id = NEW.variant_revision_id
  )
BEGIN
  SELECT RAISE(ABORT, 'block version and variant operation must share a template');
END;

CREATE TRIGGER variant_operations_immutable_update
BEFORE UPDATE ON variant_operations
BEGIN
  SELECT RAISE(ABORT, 'variant operations are immutable');
END;

CREATE TRIGGER variant_operations_immutable_delete
BEFORE DELETE ON variant_operations
BEGIN
  SELECT RAISE(ABORT, 'variant operations are immutable');
END;

CREATE TRIGGER publications_previous_template_insert
BEFORE INSERT ON publications
WHEN NEW.previous_publication_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM publications
    WHERE id = NEW.previous_publication_id
      AND template_id = NEW.template_id
      AND status = 'published'
  )
BEGIN
  SELECT RAISE(ABORT, 'rollback target must be a published publication for the same template');
END;

CREATE TRIGGER publications_immutable_update
BEFORE UPDATE ON publications
BEGIN
  SELECT RAISE(ABORT, 'publication records are immutable');
END;

CREATE TRIGGER publications_immutable_delete
BEFORE DELETE ON publications
BEGIN
  SELECT RAISE(ABORT, 'publication records are immutable');
END;

CREATE TRIGGER document_manifests_immutable_update
BEFORE UPDATE ON document_manifests
BEGIN
  SELECT RAISE(ABORT, 'document manifests are immutable');
END;

CREATE TRIGGER document_manifests_immutable_delete
BEFORE DELETE ON document_manifests
BEGIN
  SELECT RAISE(ABORT, 'document manifests are immutable');
END;

CREATE TRIGGER document_manifest_items_template_insert
BEFORE INSERT ON document_manifest_items
WHEN NOT EXISTS (
  SELECT 1
  FROM document_manifests AS manifests
  JOIN block_versions AS versions ON versions.id = NEW.block_version_id
  JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
  JOIN variant_revisions AS revisions ON revisions.id = NEW.source_variant_revision_id
  JOIN variants ON variants.id = revisions.variant_id
  WHERE manifests.id = NEW.manifest_id
    AND manifests.template_id = lineages.template_id
    AND manifests.template_id = variants.template_id
)
BEGIN
  SELECT RAISE(ABORT, 'manifest item provenance must stay within one template');
END;

CREATE TRIGGER document_manifest_items_immutable_update
BEFORE UPDATE ON document_manifest_items
BEGIN
  SELECT RAISE(ABORT, 'document manifest items are immutable');
END;

CREATE TRIGGER document_manifest_items_immutable_delete
BEFORE DELETE ON document_manifest_items
BEGIN
  SELECT RAISE(ABORT, 'document manifest items are immutable');
END;

CREATE TRIGGER published_page_documents_publication_status_insert
BEFORE INSERT ON published_page_documents
WHEN NOT EXISTS (
  SELECT 1 FROM publications
  WHERE id = NEW.publication_id
    AND template_id = NEW.template_id
    AND status = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'page documents require a published publication');
END;

CREATE TRIGGER published_page_documents_immutable_update
BEFORE UPDATE ON published_page_documents
BEGIN
  SELECT RAISE(ABORT, 'published page documents are immutable');
END;

CREATE TRIGGER published_page_documents_immutable_delete
BEFORE DELETE ON published_page_documents
BEGIN
  SELECT RAISE(ABORT, 'published page documents are immutable');
END;

CREATE TRIGGER current_publications_published_insert
BEFORE INSERT ON current_publications
WHEN NOT EXISTS (
  SELECT 1 FROM publications
  WHERE id = NEW.publication_id
    AND template_id = NEW.template_id
    AND status = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'current publication must be published and belong to the template');
END;

CREATE TRIGGER current_publications_published_update
BEFORE UPDATE OF publication_id, template_id ON current_publications
WHEN NOT EXISTS (
  SELECT 1 FROM publications
  WHERE id = NEW.publication_id
    AND template_id = NEW.template_id
    AND status = 'published'
)
BEGIN
  SELECT RAISE(ABORT, 'current publication must be published and belong to the template');
END;
