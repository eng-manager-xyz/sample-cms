import type { CmsDatabaseClient } from './client';
import { seedFoundationDatabase } from './seed';

const SCALE_TIMESTAMP = '2026-01-02T00:00:00.000Z';
const SCALE_STORE_ID_OFFSET = 2_000_000;

const sha256Hex = (value: string): string =>
  new Bun.CryptoHasher('sha256').update(value).digest('hex');

export interface ScaleSeedResult {
  requestedPageCount: number;
  insertedPageCount: number;
  existingPageCountBeforeSeed: number;
  reusedExistingSeed: boolean;
  seedIdentityHash: string;
  elapsedMilliseconds: number;
}

export interface ScaleSeedOptions {
  pageCount?: number;
  batchSize?: number;
  onProgress?: (inserted: number, total: number) => void;
}

export const seedStoreScale = async (
  client: CmsDatabaseClient,
  options: ScaleSeedOptions = {}
): Promise<ScaleSeedResult> => {
  const startedAt = performance.now();
  await seedFoundationDatabase(client);
  const pageCount = options.pageCount ?? 1_000_000;
  const batchSize = options.batchSize ?? 10_000;
  if (!Number.isSafeInteger(pageCount) || pageCount < 0) {
    throw new Error('pageCount must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error('batchSize must be a positive safe integer');
  }

  const sourceRevision = `store-scale-v1-${pageCount}`;
  const ingestionId = `ing-store-scale-${pageCount}`;
  const seedIdentityHash = sha256Hex(
    JSON.stringify({
      pageCount,
      sourceObservedAt: SCALE_TIMESTAMP,
      sourceRevision,
      templateId: 'tpl-store',
    })
  );
  const existingPageCountBeforeSeed =
    client.sqlite
      .query<{ count: number }, []>(
        "SELECT count(*) AS count FROM page_instances WHERE id LIKE 'page-store-scale-%'"
      )
      .get()?.count ?? 0;
  const existingIngestion = client.sqlite
    .query<{ checksum: string; rowCount: number; status: string }, [string]>(
      `SELECT checksum, row_count AS rowCount, status
       FROM route_ingestions
       WHERE id = ?`
    )
    .get(ingestionId);
  if (
    existingPageCountBeforeSeed === pageCount &&
    existingIngestion?.status === 'succeeded' &&
    existingIngestion.rowCount === pageCount &&
    existingIngestion.checksum === seedIdentityHash
  ) {
    options.onProgress?.(pageCount, pageCount);
    return {
      requestedPageCount: pageCount,
      insertedPageCount: 0,
      existingPageCountBeforeSeed,
      reusedExistingSeed: true,
      seedIdentityHash,
      elapsedMilliseconds: performance.now() - startedAt,
    };
  }
  if (existingPageCountBeforeSeed > pageCount) {
    throw new Error(
      `Scale database already contains ${existingPageCountBeforeSeed} pages; reset it before requesting ${pageCount}.`
    );
  }
  client.sqlite
    .query(
      `INSERT OR IGNORE INTO route_ingestions (
        id, template_id, source, source_revision, source_observed_at, status, checksum, row_count,
        started_at, completed_at, created_at
      ) VALUES (?, 'tpl-store', 'seed', ?, ?, 'succeeded', ?, ?, ?, ?, ?)`
    )
    .run(
      ingestionId,
      sourceRevision,
      SCALE_TIMESTAMP,
      seedIdentityHash,
      pageCount,
      SCALE_TIMESTAMP,
      SCALE_TIMESTAMP,
      SCALE_TIMESTAMP
    );

  const insertPage = client.sqlite.query(`
    INSERT OR IGNORE INTO page_instances (
      id, template_id, canonical_url, route_external_id, route_status, route_revision,
      last_ingestion_id, slot_value_hash, context_json, created_at, updated_at
    ) VALUES (?, 'tpl-store', ?, ?, 'live', ?, ?, ?, ?, ?, ?)
  `);
  const insertSlotValue = client.sqlite.query(`
    INSERT OR IGNORE INTO page_slot_values (
      page_instance_id, template_id, slot_id, value, normalized_value, created_at
    ) VALUES (?, 'tpl-store', ?, ?, ?, ?)
  `);
  const insertPageTag = client.sqlite.query(`
    INSERT OR IGNORE INTO page_tags (
      page_instance_id, template_id, tag_id, source, created_at
    ) VALUES (?, 'tpl-store', ?, 'seed', ?)
  `);

  let insertedPageCount = 0;
  for (let batchStart = 0; batchStart < pageCount; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, pageCount);
    client.sqlite.exec('BEGIN IMMEDIATE');
    try {
      for (let index = batchStart; index < batchEnd; index += 1) {
        const storeId = SCALE_STORE_ID_OFFSET + index;
        const pageId = `page-store-scale-${index}`;
        const canonicalUrl = `/en-US/store/${storeId}`;
        const storeName = `Scale Store ${storeId}`;
        const contextJson = JSON.stringify({
          locale: 'en-US',
          store: { id: storeId, name: storeName, location: `Market ${index % 1000}` },
        });
        const result = insertPage.run(
          pageId,
          canonicalUrl,
          `camo-store-scale-${index}`,
          sourceRevision,
          ingestionId,
          sha256Hex(
            JSON.stringify({
              locale: 'en-us',
              store: 'store',
              store_id: String(storeId),
              store_name: storeName.toLocaleLowerCase('en-US'),
            })
          ),
          contextJson,
          SCALE_TIMESTAMP,
          SCALE_TIMESTAMP
        );
        insertedPageCount += result.changes;

        insertSlotValue.run(pageId, 'slot-store-locale', 'en-US', 'en-us', SCALE_TIMESTAMP);
        insertSlotValue.run(pageId, 'slot-store-static', 'store', 'store', SCALE_TIMESTAMP);
        insertSlotValue.run(
          pageId,
          'slot-store-id',
          String(storeId),
          String(storeId),
          SCALE_TIMESTAMP
        );
        insertSlotValue.run(
          pageId,
          'slot-store-name',
          storeName,
          storeName.toLocaleLowerCase('en-US'),
          SCALE_TIMESTAMP
        );

        if (index % 20 === 0) {
          insertPageTag.run(pageId, 'tag-store-type-chain', SCALE_TIMESTAMP);
          insertPageTag.run(pageId, 'tag-store-category-fast-food', SCALE_TIMESTAMP);
          insertPageTag.run(pageId, 'tag-store-brand-mcdonalds', SCALE_TIMESTAMP);
        } else if (index % 20 === 10) {
          insertPageTag.run(pageId, 'tag-store-type-chain', SCALE_TIMESTAMP);
          insertPageTag.run(pageId, 'tag-store-category-fast-food', SCALE_TIMESTAMP);
          insertPageTag.run(pageId, 'tag-store-brand-burger-king', SCALE_TIMESTAMP);
        } else if (index % 10 === 2) {
          insertPageTag.run(pageId, 'tag-store-type-chain', SCALE_TIMESTAMP);
          insertPageTag.run(pageId, 'tag-store-category-fast-food', SCALE_TIMESTAMP);
        } else if (index % 2 === 0) {
          insertPageTag.run(pageId, 'tag-store-type-chain', SCALE_TIMESTAMP);
        } else {
          insertPageTag.run(pageId, 'tag-store-type-independent', SCALE_TIMESTAMP);
        }
      }
      client.sqlite.exec('COMMIT');
    } catch (error) {
      client.sqlite.exec('ROLLBACK');
      throw error;
    }
    options.onProgress?.(batchEnd, pageCount);
  }

  return {
    requestedPageCount: pageCount,
    insertedPageCount,
    existingPageCountBeforeSeed,
    reusedExistingSeed: false,
    seedIdentityHash,
    elapsedMilliseconds: performance.now() - startedAt,
  };
};
