import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';

const readMigration = (name: string): Promise<string> =>
  Bun.file(new URL(`../drizzle/${name}`, import.meta.url)).text();

test('the authoring-contract migrations upgrade populated schema-v1 rows safely', async () => {
  const sqlite = new Database(':memory:', { strict: true });
  try {
    sqlite.exec(await readMigration('0000_slot_variant_foundation.sql'));
    sqlite.exec(`
      INSERT INTO templates (id, key, name, url_pattern)
      VALUES ('legacy-template', 'legacy', 'Legacy', '/{slug}');

      INSERT INTO route_ingestions (
        id, template_id, source, source_revision, status, checksum, row_count,
        started_at, completed_at, created_at
      ) VALUES (
        'legacy-ingestion', 'legacy-template', 'seed', 'legacy-route-v1',
        'succeeded', 'legacy-checksum', 1, '2025-12-31T23:59:58.000Z',
        '2025-12-31T23:59:59.000Z', '2025-12-31T23:59:58.000Z'
      );

      INSERT INTO block_types (id, key, name, schema_version, schema_json)
      VALUES ('legacy-type', 'hero', 'Hero', 1, '{"type":"object"}');
      INSERT INTO block_lineages (id, template_id, key, label)
      VALUES ('legacy-lineage', 'legacy-template', 'hero', 'Hero');
      INSERT INTO block_versions (
        id, lineage_id, version_number, block_type_id, schema_version,
        content_json, content_hash, created_by
      ) VALUES (
        'legacy-version', 'legacy-lineage', 1, 'legacy-type', 1,
        '{"headline":"Legacy"}', 'legacy-hash', 'legacy-author'
      );
      INSERT INTO variant_operations (
        id, variant_revision_id, placement_key, operation_kind, block_version_id
      ) VALUES (
        'legacy-set', 'legacy-template:default:r1', 'hero', 'set', 'legacy-version'
      );
      INSERT INTO variant_operations (
        id, variant_revision_id, placement_key, operation_kind, order_index
      ) VALUES (
        'legacy-order', 'legacy-template:default:r1', 'hero', 'order', 0
      );
      INSERT INTO document_manifests (id, template_id, content_hash, placement_count)
      VALUES ('legacy-manifest', 'legacy-template', 'legacy-manifest-hash', 1);
      INSERT INTO document_manifest_items (
        manifest_id, ordinal, placement_key, block_version_id,
        source_variant_revision_id, source_priority
      ) VALUES (
        'legacy-manifest', 0, 'hero', 'legacy-version',
        'legacy-template:default:r1', 0
      );
      INSERT INTO page_instances (
        id, template_id, canonical_url, route_external_id, route_status,
        route_revision, context_json
      ) VALUES (
        'legacy-page', 'legacy-template', '/legacy', 'legacy-route', 'live',
        'legacy-route-v1', '{}'
      );
    `);

    sqlite.exec(await readMigration('0001_authoring-contract.sql'));
    sqlite.exec(await readMigration('0002_block-version-parent-provenance.sql'));
    sqlite.exec(await readMigration('0003_domain-path-canonical-identity.sql'));
    sqlite.exec(await readMigration('0004_selector-validation-and-preview-metadata.sql'));
    sqlite.exec(await readMigration('0005_route-source-observed-at.sql'));

    expect(
      sqlite
        .query<{ sourceOperationId: string }, []>(
          `SELECT source_operation_id AS sourceOperationId
           FROM document_manifest_items WHERE manifest_id = 'legacy-manifest'`
        )
        .get()
    ).toEqual({ sourceOperationId: 'legacy-set' });
    expect(
      sqlite
        .query<{ slotValueHash: string }, []>(
          `SELECT slot_value_hash AS slotValueHash
           FROM page_instances WHERE id = 'legacy-page'`
        )
        .get()
    ).toEqual({ slotValueHash: 'legacy:legacy-page' });
    expect(sqlite.query('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(
      sqlite
        .query<{ input: string; normalized: string; status: string }, []>(
          `SELECT selector_input AS input, selector_sql AS normalized,
                  json_extract(validation_result_json, '$.status') AS status
           FROM variant_revisions WHERE id = 'legacy-template:default:r1'`
        )
        .get()
    ).toEqual({ input: 'TRUE', normalized: 'TRUE', status: 'valid' });
    expect(
      sqlite
        .query<{ sourceObservedAt: string }, []>(
          `SELECT source_observed_at AS sourceObservedAt
           FROM route_ingestions WHERE id = 'legacy-ingestion'`
        )
        .get()
    ).toEqual({ sourceObservedAt: '2025-12-31T23:59:58.000Z' });

    expect(() =>
      sqlite.exec(`
        INSERT INTO page_instances (
          id, template_id, canonical_url, route_external_id, route_status,
          route_revision, slot_value_hash, context_json
        ) VALUES (
          'missing-hash', 'legacy-template', '/missing-hash', 'missing-hash-route',
          'live', 'legacy-route-v2', NULL, '{}'
        )
      `)
    ).toThrow('canonical slot-value hash');
    expect(() =>
      sqlite.exec(`
        INSERT INTO variant_revisions (
          id, variant_id, revision_number, selector_sql, selector_hash,
          selector_description, created_by
        ) VALUES (
          'legacy-template:default:r2', 'legacy-template:default', 2,
          'TRUE', '35f9735092451bcd1079d62accc2e748ffc0629401731fcbc3cb8f6e12a28079',
          'Missing selector contract', 'legacy-author'
        )
      `)
    ).toThrow('original input');
    expect(() =>
      sqlite.exec(`
        INSERT INTO route_ingestions (
          id, template_id, source, source_revision, status, checksum, row_count,
          started_at, completed_at, created_at
        ) VALUES (
          'missing-observed-at', 'legacy-template', 'seed', 'legacy-route-v2',
          'succeeded', 'legacy-checksum-v2', 0, '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
        )
      `)
    ).toThrow('source-observed timestamp');
    expect(() =>
      sqlite.exec(`
        UPDATE route_ingestions
        SET source_observed_at = '2026-01-01T00:00:00.000Z'
        WHERE id = 'legacy-ingestion'
      `)
    ).toThrow('source-observed timestamps are immutable');
  } finally {
    sqlite.close();
  }
});
