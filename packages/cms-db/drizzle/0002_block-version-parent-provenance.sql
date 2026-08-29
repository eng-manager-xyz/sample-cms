ALTER TABLE `block_versions` ADD `parent_version_id` text REFERENCES block_versions(id);--> statement-breakpoint
CREATE INDEX `block_versions_parent_idx` ON `block_versions` (`parent_version_id`);--> statement-breakpoint
CREATE TRIGGER block_versions_parent_lineage_insert
BEFORE INSERT ON block_versions
WHEN NEW.parent_version_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM block_versions AS parent
    WHERE parent.id = NEW.parent_version_id
      AND parent.lineage_id = NEW.lineage_id
      AND parent.version_number < NEW.version_number
  )
BEGIN
  SELECT RAISE(ABORT, 'block version parent must be an earlier version in the same lineage');
END;
