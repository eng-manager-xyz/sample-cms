import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { benchmarkDatabase } from './benchmark';
import type { CmsDatabaseClient } from './client';
import { inspectDatabaseHealth } from './health';
import { runMigrations } from './migrations';
import { resetDatabase } from './reset';
import { seedStoreScale } from './scale';
import { seedFoundationDatabase } from './seed';
import { createTestDatabase } from './testing';

describe('CMS database foundation', () => {
  let client: CmsDatabaseClient;

  beforeEach(async () => {
    client = await createTestDatabase();
  });

  afterEach(() => {
    client.close();
  });

  test('migrates and seeds deterministically with a healthy relational graph', async () => {
    expect(await runMigrations(client)).toBe(0);

    await seedFoundationDatabase(client);
    const firstHealth = inspectDatabaseHealth(client);
    expect(firstHealth.healthy).toBe(true);
    expect(firstHealth.problems).toEqual([]);
    expect(firstHealth.tableCounts.templates).toBe(1);
    expect(firstHealth.tableCounts.page_instances).toBe(2);
    expect(firstHealth.tableCounts.tags).toBe(5);
    expect(firstHealth.tableCounts.variants).toBe(5);
    expect(firstHealth.tableCounts.block_versions).toBe(8);
    expect(firstHealth.tableCounts.variant_operations).toBe(12);
    expect(firstHealth.tableCounts.published_page_documents).toBe(2);
    expect(
      client.sqlite
        .query<{ sourceObservedAt: string }, []>(
          `SELECT source_observed_at AS sourceObservedAt
           FROM route_ingestions WHERE id = 'ing-store-seed-1'`
        )
        .get()
    ).toEqual({ sourceObservedAt: '2026-01-01T00:00:00.000Z' });
    const hashes = client.sqlite
      .query<{ hash: string }, []>(`
        SELECT checksum AS hash FROM route_ingestions
        UNION ALL SELECT slot_value_hash FROM page_instances
        UNION ALL SELECT selector_hash FROM variant_revisions
        UNION ALL SELECT content_hash FROM block_versions
        UNION ALL SELECT content_hash FROM document_manifests
        UNION ALL SELECT input_hash FROM publications
        UNION ALL SELECT document_hash FROM published_page_documents
      `)
      .all();
    expect(hashes.length).toBeGreaterThan(0);
    expect(hashes.every(({ hash }) => /^[0-9a-f]{64}$/.test(hash))).toBe(true);
    expect(
      client.sqlite
        .query<{ parentVersionId: string | null }, []>(
          `SELECT parent_version_id AS parentVersionId
           FROM block_versions WHERE id = 'block-store-hero-v2-mcd'`
        )
        .get()
    ).toEqual({ parentVersionId: 'block-store-hero-v1' });
    expect(
      client.sqlite
        .query<{ renderer: string }, []>(
          `SELECT json_extract(preview_renderer_json, '$.component') AS renderer
           FROM block_types WHERE key = 'hero'`
        )
        .get()
    ).toEqual({ renderer: 'hero' });

    await seedFoundationDatabase(client);
    const secondHealth = inspectDatabaseHealth(client);
    expect(secondHealth).toEqual(firstHealth);
  });

  test('repeatable seed preserves immutable legacy Store publication history', async () => {
    await seedFoundationDatabase(client);
    client.sqlite.exec(`
      DROP TRIGGER published_page_documents_immutable_update;
      UPDATE published_page_documents
      SET resolved_data_json = CASE page_instance_id
        WHEN 'page-store-1001'
          THEN '{"locale":"en-US","store":{"id":1001,"name":"McDonald''s Market","location":"San Francisco"}}'
        ELSE '{"locale":"en-US","store":{"id":1002,"name":"Neighborhood Kitchen","location":"Oakland"}}'
      END
      WHERE publication_id = 'publication-store-1';
      CREATE TRIGGER published_page_documents_immutable_update
      BEFORE UPDATE ON published_page_documents
      BEGIN
        SELECT RAISE(ABORT, 'published page documents are immutable');
      END;
    `);

    const legacyRows = client.sqlite
      .query<{ pageInstanceId: string; payload: string }, []>(
        `SELECT page_instance_id AS pageInstanceId, resolved_data_json AS payload
         FROM published_page_documents
         WHERE publication_id = 'publication-store-1'
         ORDER BY page_instance_id`
      )
      .all();

    await seedFoundationDatabase(client);
    expect(
      client.sqlite
        .query<{ pageInstanceId: string; payload: string }, []>(
          `SELECT page_instance_id AS pageInstanceId, resolved_data_json AS payload
           FROM published_page_documents
           WHERE publication_id = 'publication-store-1'
           ORDER BY page_instance_id`
        )
        .all()
    ).toEqual(legacyRows);
    expect(
      legacyRows.every(({ payload }) => !payload.includes('cms-published-placement-content-v1'))
    ).toBe(true);
    expect(() =>
      client.sqlite
        .query(
          `UPDATE published_page_documents
           SET resolved_data_json = '{}'
           WHERE publication_id = 'publication-store-1'`
        )
        .run()
    ).toThrow('published page documents are immutable');
  });

  test('enforces canonical domain-plus-path identity and one default per template', async () => {
    await seedFoundationDatabase(client);

    expect(() =>
      client.sqlite
        .query(`
          INSERT INTO page_instances (
            id, template_id, canonical_url, route_external_id, route_status,
            route_revision, last_ingestion_id, slot_value_hash, context_json
          ) VALUES (
            'page-duplicate-url', 'tpl-store', '/en-US/store/1001', 'router-duplicate-url',
            'live', 'store-seed-v1', 'ing-store-seed-1',
            'b9911814e741ca3fdc14c783616a6b144edc0a4e5792517eef975d488fc6fe07', '{}'
          )
        `)
        .run()
    ).toThrow();

    client.sqlite.exec(`
      INSERT INTO templates (
        id, key, name, domain, url_pattern, description, status, route_authority
      ) VALUES (
        'tpl-other-domain', 'other-domain', 'Other domain', 'example.test',
        '/{locale}/store/{store_id}', '', 'active', 'router_service'
      );
      INSERT INTO page_instances (
        id, template_id, canonical_url, route_external_id, route_status,
        route_revision, slot_value_hash, context_json
      ) VALUES (
        'page-other-domain', 'tpl-other-domain', '/en-US/store/1001',
        'router-other-domain', 'live', 'other-v1', 'other-domain-slot-hash', '{}'
      );
      INSERT INTO templates (
        id, key, name, domain, url_pattern, description, status, route_authority
      ) VALUES (
        'tpl-same-domain-overlap', 'same-domain-overlap', 'Same domain overlap',
        'www.ubereats.com', '/en-US/store/{store_id}', '', 'active', 'router_service'
      );
    `);
    expect(() =>
      client.sqlite.exec(`
        INSERT INTO page_instances (
          id, template_id, canonical_url, route_external_id, route_status,
          route_revision, slot_value_hash, context_json
        ) VALUES (
          'page-same-domain-overlap', 'tpl-same-domain-overlap', '/en-US/store/1001',
          'router-same-domain-overlap', 'live', 'overlap-v1', 'overlap-slot-hash', '{}'
        )
      `)
    ).toThrow('canonical domain and path');
    expect(() =>
      client.sqlite.exec(`
        UPDATE templates SET domain = 'www.ubereats.com' WHERE id = 'tpl-other-domain'
      `)
    ).toThrow('domain change would collide');

    const canonicalPlan = client.sqlite
      .query<{ detail: string }, [string, string]>(`
        EXPLAIN QUERY PLAN
        SELECT pages.id, pages.route_status
        FROM templates
        JOIN page_instances AS pages ON pages.template_id = templates.id
        WHERE templates.domain = ? AND pages.canonical_url = ?
      `)
      .all('www.ubereats.com', '/en-US/store/1001');
    expect(
      canonicalPlan.some((step) => step.detail.includes('page_instances_template_canonical_unique'))
    ).toBe(true);

    expect(() =>
      client.sqlite
        .query(`
          INSERT INTO variants (
            id, template_id, key, name, is_default, priority, status
          ) VALUES (
            'variant-store-second-default', 'tpl-store', 'second-default',
            'Second default', 1, 0, 'draft'
          )
        `)
        .run()
    ).toThrow();
  });

  test('allows one content operation plus one order operation and validates tombstones', async () => {
    await seedFoundationDatabase(client);

    client.sqlite
      .query(`
        INSERT INTO variant_operations (
          id, variant_revision_id, placement_key, operation_kind, block_version_id, order_index
        ) VALUES (
          'op-mcd-secondary-tombstone', 'revision-store-mcdonalds-1',
          'secondary-promo', 'tombstone', NULL, NULL
        )
      `)
      .run();
    client.sqlite
      .query(`
        INSERT INTO variant_operations (
          id, variant_revision_id, placement_key, operation_kind, block_version_id, order_index
        ) VALUES (
          'op-mcd-secondary-order', 'revision-store-mcdonalds-1',
          'secondary-promo', 'order', NULL, 4
        )
      `)
      .run();

    expect(() =>
      client.sqlite
        .query(`
          INSERT INTO variant_operations (
            id, variant_revision_id, placement_key, operation_kind, block_version_id, order_index
          ) VALUES (
            'op-invalid-tombstone', 'revision-store-mcdonalds-1',
            'invalid-promo', 'tombstone', 'block-store-promo-v1', NULL
          )
        `)
        .run()
    ).toThrow();

    expect(() =>
      client.sqlite
        .query(`
          INSERT INTO variant_operations (
            id, variant_revision_id, placement_key, operation_kind, block_version_id, order_index
          ) VALUES (
            'op-mcd-secondary-set', 'revision-store-mcdonalds-1',
            'secondary-promo', 'set', 'block-store-promo-v1', NULL
          )
        `)
        .run()
    ).toThrow();
  });

  test('keeps block versions, revisions, route audit, and published records immutable', async () => {
    await seedFoundationDatabase(client);

    expect(() =>
      client.sqlite
        .query(
          "UPDATE block_versions SET content_hash = 'changed' WHERE id = 'block-store-hero-v1'"
        )
        .run()
    ).toThrow('block versions are immutable');
    expect(() =>
      client.sqlite
        .query("DELETE FROM variant_revisions WHERE id = 'revision-store-mcdonalds-1'")
        .run()
    ).toThrow('variant revisions are immutable');
    expect(() =>
      client.sqlite
        .query(
          "UPDATE variant_operations SET placement_key = 'changed' WHERE id = 'op-mcd-hero-set'"
        )
        .run()
    ).toThrow('variant operations are immutable');
    expect(() =>
      client.sqlite.query("DELETE FROM variant_operations WHERE id = 'op-mcd-hero-set'").run()
    ).toThrow('variant operations are immutable');
    expect(() =>
      client.sqlite
        .query("UPDATE route_audit_log SET action = 'skip' WHERE id = 'audit-store-1001-insert'")
        .run()
    ).toThrow('route audit records are immutable');
    expect(() =>
      client.sqlite
        .query("UPDATE publications SET input_hash = 'changed' WHERE id = 'publication-store-1'")
        .run()
    ).toThrow('publication records are immutable');
    expect(() =>
      client.sqlite.query("DELETE FROM document_manifests WHERE id = 'manifest-store-mcd-v1'").run()
    ).toThrow('document manifests are immutable');
    expect(() =>
      client.sqlite
        .query(`
          UPDATE published_page_documents
          SET document_hash = 'changed'
          WHERE publication_id = 'publication-store-1' AND page_instance_id = 'page-store-1001'
        `)
        .run()
    ).toThrow('published page documents are immutable');

    expect(() =>
      client.sqlite
        .query(`
          UPDATE current_publications
          SET activated_at = '2026-01-02T00:00:00.000Z'
          WHERE template_id = 'tpl-store'
        `)
        .run()
    ).not.toThrow();
  });

  test('rejects cross-template block operations', async () => {
    await seedFoundationDatabase(client);
    client.sqlite.exec(`
      INSERT INTO templates (
        id, key, name, domain, url_pattern, description
      ) VALUES (
        'tpl-other', 'other', 'Other', 'www.example.com', '/{locale}/other/{id}',
        'Cross-template constraint fixture'
      );
    `);

    const generatedDefault = client.sqlite
      .query<{ activeRevisionId: string; count: number }, []>(`
        SELECT count(*) AS count, active_revision_id AS activeRevisionId
        FROM variants
        WHERE template_id = 'tpl-other' AND is_default = 1
      `)
      .get();
    expect(generatedDefault).toEqual({ count: 1, activeRevisionId: 'tpl-other:default:r1' });

    expect(() =>
      client.sqlite
        .query(`
          INSERT INTO variant_operations (
            id, variant_revision_id, placement_key, operation_kind, block_version_id, order_index
          ) VALUES (
            'op-other-invalid-block', 'tpl-other:default:r1',
            'primary-hero', 'set', 'block-store-hero-v1', NULL
          )
        `)
        .run()
    ).toThrow('block version and variant operation must share a template');
  });

  test('reset recreates a clean migrated schema', async () => {
    await seedFoundationDatabase(client);
    await resetDatabase(client);

    const health = inspectDatabaseHealth(client);
    expect(health.healthy).toBe(true);
    expect(health.tableCounts.templates).toBe(0);
    expect(health.tableCounts.block_versions).toBe(0);
    expect(health.tableCounts.current_publications).toBe(0);
  });

  test('scale seed materializes five independent Store classes without resolver branches', async () => {
    const initialSeed = await seedStoreScale(client, { pageCount: 40, batchSize: 7 });
    const replaySeed = await seedStoreScale(client, { pageCount: 40, batchSize: 7 });
    expect(initialSeed).toMatchObject({
      requestedPageCount: 40,
      insertedPageCount: 40,
      existingPageCountBeforeSeed: 0,
      reusedExistingSeed: false,
    });
    expect(replaySeed).toMatchObject({
      requestedPageCount: 40,
      insertedPageCount: 0,
      existingPageCountBeforeSeed: 40,
      reusedExistingSeed: true,
      seedIdentityHash: initialSeed.seedIdentityHash,
    });

    const tagsForPage = (pageId: string): readonly string[] =>
      client.sqlite
        .query<{ value: string }, [string]>(`
          SELECT tags.namespace || '=' || tags.value AS value
          FROM page_tags
          JOIN tags ON tags.id = page_tags.tag_id
          WHERE page_tags.page_instance_id = ?
          ORDER BY value
        `)
        .all(pageId)
        .map((row) => row.value);

    expect(tagsForPage('page-store-scale-1')).toEqual(['store_type=independent']);
    expect(tagsForPage('page-store-scale-4')).toEqual(['store_type=chain_store']);
    expect(tagsForPage('page-store-scale-2')).toEqual([
      'category=fast_food',
      'store_type=chain_store',
    ]);
    expect(tagsForPage('page-store-scale-0')).toEqual([
      'brand=mcdonalds',
      'category=fast_food',
      'store_type=chain_store',
    ]);
    expect(tagsForPage('page-store-scale-10')).toEqual([
      'brand=burger_king',
      'category=fast_food',
      'store_type=chain_store',
    ]);
    const scaleHashes = client.sqlite
      .query<{ hash: string }, []>(`
        SELECT checksum AS hash FROM route_ingestions WHERE id = 'ing-store-scale-40'
        UNION ALL
        SELECT slot_value_hash FROM page_instances WHERE id LIKE 'page-store-scale-%'
      `)
      .all();
    expect(scaleHashes).toHaveLength(41);
    expect(scaleHashes.every(({ hash }) => /^[0-9a-f]{64}$/.test(hash))).toBe(true);

    expect(benchmarkDatabase(client, 10)).toMatchObject({
      scalePageCount: 40,
      mcdonaldsPageCount: 3,
      burgerKingPageCount: 2,
      genericFastFoodPageCount: 4,
    });
  });
});
