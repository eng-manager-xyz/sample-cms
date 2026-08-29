import type { CmsDatabaseClient } from './client';
import { CURRENT_SCHEMA_VERSION, getAppliedSchemaVersion } from './migrations';

export interface DatabaseHealthReport {
  healthy: boolean;
  schemaVersion: number;
  integrity: string;
  foreignKeyViolationCount: number;
  problems: string[];
  tableCounts: Record<string, number>;
}

interface CountRow {
  count: number;
}

interface IntegrityRow {
  integrity_check: string;
}

const domainTables = [
  'templates',
  'template_slots',
  'page_instances',
  'page_slot_values',
  'tags',
  'page_tags',
  'route_ingestions',
  'route_audit_log',
  'variants',
  'variant_revisions',
  'block_types',
  'block_lineages',
  'block_versions',
  'variant_operations',
  'publications',
  'document_manifests',
  'document_manifest_items',
  'published_page_documents',
  'current_publications',
] as const;

const readCount = (client: CmsDatabaseClient, query: string): number =>
  client.sqlite.query<CountRow, []>(query).get()?.count ?? 0;

export const inspectDatabaseHealth = (client: CmsDatabaseClient): DatabaseHealthReport => {
  const problems: string[] = [];
  const integrity =
    client.sqlite.query<IntegrityRow, []>('PRAGMA integrity_check').get()?.integrity_check ??
    'unknown';
  const foreignKeyViolationCount = client.sqlite.query('PRAGMA foreign_key_check').all().length;
  const schemaVersion = getAppliedSchemaVersion(client.sqlite);

  if (integrity !== 'ok') {
    problems.push(`SQLite integrity check returned ${integrity}`);
  }
  if (foreignKeyViolationCount > 0) {
    problems.push(`${foreignKeyViolationCount} foreign-key violation(s)`);
  }
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    problems.push(`schema version ${schemaVersion}; expected ${CURRENT_SCHEMA_VERSION}`);
  }

  const templatesWithoutDefault = readCount(
    client,
    `SELECT count(*) AS count
     FROM templates AS templates
     WHERE NOT EXISTS (
       SELECT 1 FROM variants AS variants
       WHERE variants.template_id = templates.id AND variants.is_default = 1
     )`
  );
  if (templatesWithoutDefault > 0) {
    problems.push(`${templatesWithoutDefault} template(s) have no default variant`);
  }

  const activeVariantsWithoutRevision = readCount(
    client,
    `SELECT count(*) AS count
     FROM variants
     WHERE status = 'active' AND active_revision_id IS NULL`
  );
  if (activeVariantsWithoutRevision > 0) {
    problems.push(`${activeVariantsWithoutRevision} active variant(s) have no active revision`);
  }

  const duplicateCanonicalUrls = readCount(
    client,
    `SELECT count(*) AS count
     FROM (
       SELECT templates.domain, pages.canonical_url
       FROM page_instances AS pages
       JOIN templates ON templates.id = pages.template_id
       GROUP BY templates.domain, pages.canonical_url
       HAVING count(*) > 1
     )`
  );
  if (duplicateCanonicalUrls > 0) {
    problems.push(`${duplicateCanonicalUrls} canonical domain-and-path collision(s)`);
  }

  const malformedManifests = readCount(
    client,
    `SELECT count(*) AS count
     FROM document_manifests AS manifests
     WHERE manifests.placement_count <> (
       SELECT count(*) FROM document_manifest_items AS items
       WHERE items.manifest_id = manifests.id
     )`
  );
  if (malformedManifests > 0) {
    problems.push(`${malformedManifests} manifest(s) have an incorrect placement count`);
  }

  const malformedPublications = readCount(
    client,
    `SELECT count(*) AS count
     FROM publications AS publications
     WHERE publications.status = 'published'
       AND (
         publications.page_count <> (
           SELECT count(*) FROM published_page_documents AS documents
           WHERE documents.publication_id = publications.id
         )
         OR publications.manifest_count <> (
           SELECT count(DISTINCT documents.manifest_id)
           FROM published_page_documents AS documents
           WHERE documents.publication_id = publications.id
         )
       )`
  );
  if (malformedPublications > 0) {
    problems.push(`${malformedPublications} publication(s) have incorrect materialization counts`);
  }

  const tableCounts: Record<string, number> = {};
  for (const table of domainTables) {
    tableCounts[table] = readCount(client, `SELECT count(*) AS count FROM ${table}`);
  }

  return {
    healthy: problems.length === 0,
    schemaVersion,
    integrity,
    foreignKeyViolationCount,
    problems,
    tableCounts,
  };
};
