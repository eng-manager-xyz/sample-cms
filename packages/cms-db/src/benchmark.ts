import type { CmsDatabaseClient } from './client';

export interface DatabaseBenchmarkResult {
  scalePageCount: number;
  canonicalLookupP50Milliseconds: number;
  canonicalLookupP95Milliseconds: number;
  tagMembershipCountMilliseconds: number;
  mcdonaldsPageCount: number;
  burgerKingPageCount: number;
  genericFastFoodPageCount: number;
}

interface CountRow {
  count: number;
}

const percentile = (samples: readonly number[], value: number): number => {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * value));
  return sorted[index] ?? 0;
};

export const benchmarkDatabase = (
  client: CmsDatabaseClient,
  sampleCount = 250
): DatabaseBenchmarkResult => {
  const scalePageCount =
    client.sqlite
      .query<CountRow, []>(
        "SELECT count(*) AS count FROM page_instances WHERE id LIKE 'page-store-scale-%'"
      )
      .get()?.count ?? 0;
  const lookup = client.sqlite.query(
    `SELECT pages.id, pages.route_status
     FROM templates
     JOIN page_instances AS pages ON pages.template_id = templates.id
     WHERE templates.domain = ? AND pages.canonical_url = ?`
  );
  const timings: number[] = [];
  for (let index = 0; index < sampleCount && scalePageCount > 0; index += 1) {
    const row = (index * 7919) % scalePageCount;
    const startedAt = performance.now();
    lookup.get('www.ubereats.com', `/en-US/store/${2_000_000 + row}`);
    timings.push(performance.now() - startedAt);
  }

  const tagCountStartedAt = performance.now();
  const mcdonaldsPageCount =
    client.sqlite
      .query<CountRow, []>(`
        SELECT count(*) AS count
        FROM page_tags
        WHERE template_id = 'tpl-store' AND tag_id = 'tag-store-brand-mcdonalds'
      `)
      .get()?.count ?? 0;
  const burgerKingPageCount =
    client.sqlite
      .query<CountRow, []>(`
        SELECT count(*) AS count
        FROM page_tags
        WHERE template_id = 'tpl-store' AND tag_id = 'tag-store-brand-burger-king'
      `)
      .get()?.count ?? 0;
  const genericFastFoodPageCount =
    client.sqlite
      .query<CountRow, []>(`
        SELECT count(*) AS count
        FROM page_instances AS pages
        WHERE pages.template_id = 'tpl-store'
          AND pages.id LIKE 'page-store-scale-%'
          AND EXISTS (
            SELECT 1 FROM page_tags
            WHERE page_instance_id = pages.id
              AND tag_id = 'tag-store-category-fast-food'
          )
          AND NOT EXISTS (
            SELECT 1 FROM page_tags
            WHERE page_instance_id = pages.id
              AND tag_id IN ('tag-store-brand-mcdonalds', 'tag-store-brand-burger-king')
          )
      `)
      .get()?.count ?? 0;
  const tagMembershipCountMilliseconds = performance.now() - tagCountStartedAt;

  return {
    scalePageCount,
    canonicalLookupP50Milliseconds: percentile(timings, 0.5),
    canonicalLookupP95Milliseconds: percentile(timings, 0.95),
    tagMembershipCountMilliseconds,
    mcdonaldsPageCount,
    burgerKingPageCount,
    genericFastFoodPageCount,
  };
};
