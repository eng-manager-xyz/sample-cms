ALTER TABLE template_slots ADD COLUMN variable_kind TEXT
  CHECK (
    variable_kind IS NULL
    OR (kind = 'variable' AND variable_kind IN ('locale', 'slug'))
  );

UPDATE template_slots
SET variable_kind = CASE key
  WHEN 'locale' THEN 'locale'
  WHEN 'slug' THEN 'slug'
  ELSE NULL
END
WHERE kind = 'variable';

DROP TRIGGER templates_domain_normalized_insert;
DROP TRIGGER templates_domain_normalized_update;

CREATE TRIGGER templates_domain_normalized_insert
BEFORE INSERT ON templates
WHEN NEW.domain <> lower(trim(NEW.domain))
  OR length(NEW.domain) = 0
  OR length(NEW.domain) > 253
  OR NEW.domain GLOB '*[^a-z0-9.-]*'
  OR NEW.domain LIKE '.%'
  OR NEW.domain LIKE '%.'
  OR NEW.domain LIKE '%..%'
  OR NEW.domain LIKE '-%'
  OR NEW.domain LIKE '%-'
  OR NEW.domain LIKE '%.-%'
  OR NEW.domain LIKE '%-.%'
BEGIN
  SELECT RAISE(ABORT, 'template domains must be normalized bare host names');
END;

CREATE TRIGGER templates_domain_normalized_update
BEFORE UPDATE OF domain ON templates
WHEN NEW.domain <> lower(trim(NEW.domain))
  OR length(NEW.domain) = 0
  OR length(NEW.domain) > 253
  OR NEW.domain GLOB '*[^a-z0-9.-]*'
  OR NEW.domain LIKE '.%'
  OR NEW.domain LIKE '%.'
  OR NEW.domain LIKE '%..%'
  OR NEW.domain LIKE '-%'
  OR NEW.domain LIKE '%-'
  OR NEW.domain LIKE '%.-%'
  OR NEW.domain LIKE '%-.%'
BEGIN
  SELECT RAISE(ABORT, 'template domains must be normalized bare host names');
END;

CREATE TRIGGER template_slots_freeze_insert
BEFORE INSERT ON template_slots
WHEN EXISTS (
  SELECT 1 FROM page_instances WHERE template_id = NEW.template_id LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM template_slots WHERE id = NEW.id AND template_id = NEW.template_id
)
BEGIN
  SELECT RAISE(ABORT, 'template slots are frozen after canonical pages exist');
END;

CREATE TRIGGER template_slots_freeze_update
BEFORE UPDATE ON template_slots
WHEN EXISTS (
  SELECT 1 FROM page_instances WHERE template_id = OLD.template_id LIMIT 1
)
BEGIN
  SELECT RAISE(ABORT, 'template slots are frozen after canonical pages exist');
END;

CREATE TRIGGER template_slots_freeze_delete
BEFORE DELETE ON template_slots
WHEN EXISTS (
  SELECT 1 FROM page_instances WHERE template_id = OLD.template_id LIMIT 1
)
BEGIN
  SELECT RAISE(ABORT, 'template slots are frozen after canonical pages exist');
END;

INSERT OR IGNORE INTO block_types (
  id, key, name, schema_version, schema_json, preview_renderer_json, created_at, updated_at
) VALUES (
  'block-type-avatar',
  'avatar',
  'Avatar',
  1,
  '{"type":"object","required":["name","role"],"properties":{"name":{"type":"string","minLength":1},"role":{"type":"string","minLength":1}},"additionalProperties":false}',
  '{"kind":"wireframe","component":"avatar"}',
  '2026-08-31T00:00:00.000Z',
  '2026-08-31T00:00:00.000Z'
);
