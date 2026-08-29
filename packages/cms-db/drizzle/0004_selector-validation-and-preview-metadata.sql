ALTER TABLE variant_revisions ADD COLUMN selector_input TEXT;--> statement-breakpoint
ALTER TABLE variant_revisions ADD COLUMN validation_result_json TEXT;--> statement-breakpoint
ALTER TABLE block_types ADD COLUMN preview_renderer_json TEXT;--> statement-breakpoint
DROP TRIGGER variant_revisions_immutable_update;--> statement-breakpoint
UPDATE variant_revisions
SET selector_input = selector_sql,
    validation_result_json = json_object(
      'status', 'valid',
      'normalizedSelector', selector_sql,
      'source', 'migration'
    );--> statement-breakpoint
CREATE TEMP TABLE selector_revision_contract_guard (
  valid INTEGER NOT NULL CHECK (valid = 1)
);--> statement-breakpoint
INSERT INTO selector_revision_contract_guard (valid)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM variant_revisions
  WHERE selector_input IS NULL
     OR length(trim(selector_input)) = 0
     OR validation_result_json IS NULL
     OR NOT json_valid(validation_result_json)
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE selector_revision_contract_guard;--> statement-breakpoint
CREATE TRIGGER variant_revisions_selector_contract_insert
BEFORE INSERT ON variant_revisions
WHEN NEW.selector_input IS NULL
  OR length(trim(NEW.selector_input)) = 0
  OR NEW.validation_result_json IS NULL
  OR NOT json_valid(NEW.validation_result_json)
  OR json_extract(NEW.validation_result_json, '$.status') <> 'valid'
  OR json_extract(NEW.validation_result_json, '$.normalizedSelector') <> NEW.selector_sql
BEGIN
  SELECT RAISE(ABORT, 'selector revisions require original input and a matching valid normalization result');
END;--> statement-breakpoint
CREATE TRIGGER variant_revisions_immutable_update
BEFORE UPDATE ON variant_revisions
BEGIN
  SELECT RAISE(ABORT, 'variant revisions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER block_types_preview_renderer_insert
BEFORE INSERT ON block_types
WHEN NEW.preview_renderer_json IS NOT NULL AND NOT json_valid(NEW.preview_renderer_json)
BEGIN
  SELECT RAISE(ABORT, 'block preview renderer metadata must be valid JSON');
END;--> statement-breakpoint
CREATE TRIGGER block_types_preview_renderer_update
BEFORE UPDATE OF preview_renderer_json ON block_types
WHEN NEW.preview_renderer_json IS NOT NULL AND NOT json_valid(NEW.preview_renderer_json)
BEGIN
  SELECT RAISE(ABORT, 'block preview renderer metadata must be valid JSON');
END;--> statement-breakpoint
CREATE TRIGGER block_types_contract_immutable_update
BEFORE UPDATE OF id, key, schema_version, schema_json ON block_types
BEGIN
  SELECT RAISE(ABORT, 'block type schema contracts are immutable');
END;--> statement-breakpoint
CREATE TRIGGER templates_domain_normalized_insert
BEFORE INSERT ON templates
WHEN NEW.domain <> lower(trim(NEW.domain))
  OR instr(NEW.domain, '://') > 0
  OR instr(NEW.domain, '/') > 0
  OR instr(NEW.domain, ' ') > 0
BEGIN
  SELECT RAISE(ABORT, 'template domains must be normalized bare host names');
END;--> statement-breakpoint
CREATE TRIGGER templates_domain_normalized_update
BEFORE UPDATE OF domain ON templates
WHEN NEW.domain <> lower(trim(NEW.domain))
  OR instr(NEW.domain, '://') > 0
  OR instr(NEW.domain, '/') > 0
  OR instr(NEW.domain, ' ') > 0
BEGIN
  SELECT RAISE(ABORT, 'template domains must be normalized bare host names');
END;--> statement-breakpoint
DROP TRIGGER templates_create_default_variant;--> statement-breakpoint
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
    id, variant_id, revision_number, selector_input, selector_sql, selector_hash,
    validation_result_json, selector_description, created_by, created_at
  ) VALUES (
    NEW.id || ':default:r1', NEW.id || ':default', 1, 'TRUE', 'TRUE',
    '35f9735092451bcd1079d62accc2e748ffc0629401731fcbc3cb8f6e12a28079',
    '{"status":"valid","normalizedSelector":"TRUE"}',
    'All pages for this template', 'system', NEW.created_at
  );
  UPDATE variants
  SET active_revision_id = NEW.id || ':default:r1'
  WHERE id = NEW.id || ':default';
END;
