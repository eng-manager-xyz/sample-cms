PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_route_ingestions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`source` text DEFAULT 'router_service' NOT NULL,
	`source_revision` text NOT NULL,
	`status` text NOT NULL,
	`checksum` text NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`source_observed_at` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "route_ingestions_row_count_non_negative" CHECK("row_count" >= 0),
	CONSTRAINT "route_ingestions_completion_shape" CHECK(("status" = 'running' and "completed_at" is null)
        or ("status" in ('succeeded', 'failed') and "completed_at" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_route_ingestions`("id", "template_id", "source", "source_revision", "status", "checksum", "row_count", "source_observed_at", "started_at", "completed_at", "created_at") SELECT "id", "template_id", CASE WHEN "source" = 'camo_press' THEN 'router_service' ELSE "source" END, "source_revision", "status", "checksum", "row_count", "source_observed_at", "started_at", "completed_at", "created_at" FROM `route_ingestions`;--> statement-breakpoint
DROP TABLE `route_ingestions`;--> statement-breakpoint
ALTER TABLE `__new_route_ingestions` RENAME TO `route_ingestions`;--> statement-breakpoint
CREATE UNIQUE INDEX `route_ingestions_source_revision_unique` ON `route_ingestions` (`template_id`,`source`,`source_revision`);--> statement-breakpoint
CREATE INDEX `route_ingestions_template_status_idx` ON `route_ingestions` (`template_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`url_pattern` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`route_authority` text DEFAULT 'router_service' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "templates_key_not_blank" CHECK(length(trim("key")) > 0),
	CONSTRAINT "templates_domain_not_blank" CHECK(length(trim("domain")) > 0),
	CONSTRAINT "templates_pattern_absolute" CHECK("url_pattern" like '/%')
);
--> statement-breakpoint
INSERT INTO `__new_templates`("id", "key", "name", "domain", "url_pattern", "description", "status", "route_authority", "created_at", "updated_at") SELECT "id", "key", "name", "domain", "url_pattern", "description", "status", CASE WHEN "route_authority" = 'camo_press' THEN 'router_service' ELSE "route_authority" END, "created_at", "updated_at" FROM `templates`;--> statement-breakpoint
DROP TABLE `templates`;--> statement-breakpoint
ALTER TABLE `__new_templates` RENAME TO `templates`;--> statement-breakpoint
CREATE UNIQUE INDEX `templates_key_unique` ON `templates` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `templates_domain_pattern_unique` ON `templates` (`domain`,`url_pattern`);--> statement-breakpoint
CREATE TRIGGER route_ingestions_source_observed_at_insert
BEFORE INSERT ON route_ingestions
WHEN NEW.source_observed_at IS NULL OR length(trim(NEW.source_observed_at)) = 0
BEGIN
  SELECT RAISE(ABORT, 'route ingestions require a source-observed timestamp');
END;--> statement-breakpoint
CREATE TRIGGER route_ingestions_source_observed_at_immutable
BEFORE UPDATE OF source_observed_at ON route_ingestions
WHEN NEW.source_observed_at IS NOT OLD.source_observed_at
BEGIN
  SELECT RAISE(ABORT, 'route ingestion source-observed timestamps are immutable');
END;--> statement-breakpoint
CREATE TRIGGER templates_domain_path_update
BEFORE UPDATE OF domain ON templates
WHEN EXISTS (
  SELECT 1
  FROM page_instances AS owned_page
  JOIN page_instances AS existing_page
    ON existing_page.canonical_url = owned_page.canonical_url
   AND existing_page.template_id <> OLD.id
  JOIN templates AS existing_template ON existing_template.id = existing_page.template_id
  WHERE owned_page.template_id = OLD.id
    AND existing_template.domain = NEW.domain
)
BEGIN
  SELECT RAISE(ABORT, 'template domain change would collide with an existing canonical path');
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
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
