ALTER TABLE `templates`
  ADD `domain` text NOT NULL DEFAULT 'local.invalid'
  CHECK (length(trim(`domain`)) > 0);--> statement-breakpoint
ALTER TABLE `templates`
  ADD `status` text NOT NULL DEFAULT 'active'
  CHECK (`status` IN ('active', 'archived'));--> statement-breakpoint
DROP INDEX `templates_url_pattern_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `templates_domain_pattern_unique` ON `templates` (`domain`,`url_pattern`);--> statement-breakpoint
DROP TRIGGER document_manifest_items_immutable_update;--> statement-breakpoint
ALTER TABLE `document_manifest_items` ADD `source_operation_id` text REFERENCES variant_operations(id);--> statement-breakpoint
UPDATE `document_manifest_items`
SET `source_operation_id` = (
  SELECT operations.id
  FROM variant_operations AS operations
  WHERE operations.variant_revision_id = document_manifest_items.source_variant_revision_id
    AND operations.placement_key = document_manifest_items.placement_key
    AND operations.operation_kind = 'set'
    AND operations.block_version_id = document_manifest_items.block_version_id
  ORDER BY operations.id
  LIMIT 1
);--> statement-breakpoint
CREATE TEMP TABLE `_cms_source_operation_backfill_guard` (
  missing_count integer NOT NULL CHECK (missing_count = 0)
);--> statement-breakpoint
INSERT INTO `_cms_source_operation_backfill_guard` (missing_count)
SELECT count(*) FROM `document_manifest_items` WHERE `source_operation_id` IS NULL;--> statement-breakpoint
DROP TABLE `_cms_source_operation_backfill_guard`;--> statement-breakpoint
CREATE TRIGGER document_manifest_items_immutable_update
BEFORE UPDATE ON document_manifest_items
BEGIN
  SELECT RAISE(ABORT, 'document manifest items are immutable');
END;--> statement-breakpoint
CREATE INDEX `document_manifest_items_source_operation_idx` ON `document_manifest_items` (`source_operation_id`);--> statement-breakpoint
DROP TRIGGER document_manifest_items_template_insert;--> statement-breakpoint
CREATE TRIGGER document_manifest_items_template_insert
BEFORE INSERT ON document_manifest_items
WHEN NOT EXISTS (
  SELECT 1
  FROM document_manifests AS manifests
  JOIN block_versions AS versions ON versions.id = NEW.block_version_id
  JOIN block_lineages AS lineages ON lineages.id = versions.lineage_id
  JOIN variant_revisions AS revisions ON revisions.id = NEW.source_variant_revision_id
  JOIN variants ON variants.id = revisions.variant_id
  JOIN variant_operations AS operations ON operations.id = NEW.source_operation_id
  WHERE manifests.id = NEW.manifest_id
    AND manifests.template_id = lineages.template_id
    AND manifests.template_id = variants.template_id
    AND operations.variant_revision_id = revisions.id
    AND operations.operation_kind = 'set'
    AND operations.block_version_id = versions.id
)
BEGIN
  SELECT RAISE(ABORT, 'manifest item provenance must identify its exact set operation');
END;--> statement-breakpoint
ALTER TABLE `page_instances` ADD `slot_value_hash` text;--> statement-breakpoint
UPDATE `page_instances`
SET `slot_value_hash` = 'legacy:' || id
WHERE `slot_value_hash` IS NULL;--> statement-breakpoint
CREATE TEMP TABLE `_cms_slot_hash_backfill_guard` (
  missing_count integer NOT NULL CHECK (missing_count = 0)
);--> statement-breakpoint
INSERT INTO `_cms_slot_hash_backfill_guard` (missing_count)
SELECT count(*) FROM `page_instances` WHERE `slot_value_hash` IS NULL;--> statement-breakpoint
DROP TABLE `_cms_slot_hash_backfill_guard`;--> statement-breakpoint
CREATE TRIGGER page_instances_slot_hash_insert
BEFORE INSERT ON page_instances
WHEN NEW.slot_value_hash IS NULL OR length(trim(NEW.slot_value_hash)) = 0
BEGIN
  SELECT RAISE(ABORT, 'page instances require a canonical slot-value hash');
END;--> statement-breakpoint
CREATE TRIGGER page_instances_slot_hash_update
BEFORE UPDATE OF slot_value_hash ON page_instances
WHEN NEW.slot_value_hash IS NULL OR length(trim(NEW.slot_value_hash)) = 0
BEGIN
  SELECT RAISE(ABORT, 'page instances require a canonical slot-value hash');
END;--> statement-breakpoint
CREATE UNIQUE INDEX `page_instances_template_slot_hash_unique` ON `page_instances` (`template_id`,`slot_value_hash`);--> statement-breakpoint
ALTER TABLE `tags` ADD `description` text DEFAULT '' NOT NULL;
