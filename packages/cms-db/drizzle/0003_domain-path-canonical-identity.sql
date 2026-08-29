DROP INDEX `page_instances_canonical_url_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `page_instances_template_canonical_unique` ON `page_instances` (`template_id`,`canonical_url`);--> statement-breakpoint
CREATE TRIGGER page_instances_domain_path_insert
BEFORE INSERT ON page_instances
WHEN EXISTS (
  SELECT 1
  FROM page_instances AS existing
  JOIN templates AS existing_template ON existing_template.id = existing.template_id
  JOIN templates AS incoming_template ON incoming_template.id = NEW.template_id
  WHERE existing_template.domain = incoming_template.domain
    AND existing.canonical_url = NEW.canonical_url
)
BEGIN
  SELECT RAISE(ABORT, 'canonical domain and path already map to another page instance');
END;--> statement-breakpoint
CREATE TRIGGER page_instances_domain_path_update
BEFORE UPDATE OF template_id, canonical_url ON page_instances
WHEN EXISTS (
  SELECT 1
  FROM page_instances AS existing
  JOIN templates AS existing_template ON existing_template.id = existing.template_id
  JOIN templates AS incoming_template ON incoming_template.id = NEW.template_id
  WHERE existing.id <> OLD.id
    AND existing_template.domain = incoming_template.domain
    AND existing.canonical_url = NEW.canonical_url
)
BEGIN
  SELECT RAISE(ABORT, 'canonical domain and path already map to another page instance');
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
END;
