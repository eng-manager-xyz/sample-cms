ALTER TABLE route_ingestions ADD COLUMN source_observed_at TEXT;--> statement-breakpoint
UPDATE route_ingestions
SET source_observed_at = started_at
WHERE source_observed_at IS NULL;--> statement-breakpoint
CREATE TEMP TABLE route_ingestion_observed_at_guard (
  valid INTEGER NOT NULL CHECK (valid = 1)
);--> statement-breakpoint
INSERT INTO route_ingestion_observed_at_guard (valid)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM route_ingestions
  WHERE source_observed_at IS NULL OR length(trim(source_observed_at)) = 0
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE route_ingestion_observed_at_guard;--> statement-breakpoint
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
END;
