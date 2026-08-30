import { describe, expect, test } from 'bun:test';
import {
  getInstancePage,
  getScenarioFixture,
  listScenarioFixtures,
  projectionPointMatchesFilters,
  resolveFixturePlacements,
} from './scenario-fixtures';

describe('AUT-526 proof fixtures', () => {
  test("the McDonald's pin resolves contributions from all four required sheets", () => {
    const stores = getScenarioFixture('stores');

    expect(stores.pin.matchingLayerIds).toEqual([
      'store-default',
      'store-chain',
      'store-fast-food',
      'store-mcdonalds',
    ]);
    expect(stores.pin.placements.map((placement) => placement.winningLayerId)).toContain(
      'store-mcdonalds'
    );
    expect(stores.pin.placements.map((placement) => placement.winningLayerId)).toContain(
      'store-fast-food'
    );
    expect(stores.pin.placements.map((placement) => placement.winningLayerId)).toContain(
      'store-chain'
    );
    expect(stores.pin.tags).toEqual([
      'store_type:chain_store',
      'category:fast_food',
      'brand:mcdonalds',
    ]);
    expect(stores.dimensions.find((dimension) => dimension.id === 'store_type')?.kind).toBe('tag');
  });

  test('the structural scenario replaces a block type and retains at least 90% inheritance', () => {
    const structural = getScenarioFixture('structural-proof');
    const hero = structural.pin.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    const promo = structural.pin.placements.find(
      (placement) => placement.placementKey === 'seasonal-promo'
    );

    expect(structural.inheritance).toBeGreaterThanOrEqual(90);
    expect(hero?.blockType).toBe('hero_alt');
    expect(hero?.hiddenLower).toBe('hero@v51');
    expect(promo?.diff).toBe('hidden');
  });

  test('instance paging is bounded even when a caller requests an oversized page', () => {
    const stores = getScenarioFixture('stores');
    const page = getInstancePage(stores, 4, 999);

    expect(page.rows).toHaveLength(10);
    expect(page.rowCount).toBe(1_000_000);
    expect(page.pageIndex).toBe(4);
  });

  test('generated pages preserve one canonical URL per page instance', () => {
    for (const scenarioId of ['stores', 'eligible-vehicles', 'structural-proof'] as const) {
      const scenario = getScenarioFixture(scenarioId);
      const firstTwoPages = [
        ...getInstancePage(scenario, 0, 10).rows,
        ...getInstancePage(scenario, 1, 10).rows,
      ];
      const canonicalUrls = firstTwoPages.map((row) => row.canonicalUrl);

      expect(new Set(canonicalUrls).size).toBe(canonicalUrls.length);
    }
  });

  test('generated rows carry exact dimensions, independent tags, and matching layer identities', () => {
    const stores = getScenarioFixture('stores');
    const [mcdonalds, independent] = getInstancePage(stores, 0, 2).rows;

    expect(mcdonalds?.dimensions.map((dimension) => dimension.key)).toEqual(['locale', 'store_id']);
    expect(mcdonalds?.tags).toContain('store_type:chain_store');
    expect(mcdonalds?.matchingLayerIds).toEqual([
      'store-default',
      'store-chain',
      'store-fast-food',
      'store-mcdonalds',
    ]);
    expect(independent?.matchingLayerIds).toEqual(['store-default']);
  });

  test('selected-row resolution does not leak a different brand layer', () => {
    const stores = getScenarioFixture('stores');
    const burgerKing = getInstancePage(stores, 0, 6).rows[5];

    expect(burgerKing?.matchingLayerIds).toContain('store-burger-king');
    expect(burgerKing?.matchingLayerIds).not.toContain('store-mcdonalds');
    const placements = resolveFixturePlacements(stores, burgerKing?.matchingLayerIds ?? []);
    expect(
      placements.find((placement) => placement.placementKey === 'primary-hero')?.winningLayerId
    ).toBe('store-burger-king');
  });

  test('projection filters change the deterministic sample without drawing all instances', () => {
    const stores = getScenarioFixture('stores');
    const matching = stores.projectionPoints.filter((point) =>
      projectionPointMatchesFilters(stores, point, { locale: 'en-US' })
    );

    expect(matching.length).toBeGreaterThan(0);
    expect(matching.length).toBeLessThan(stores.projectionPoints.length);
  });

  test('the map wall supports search and bounded pagination', () => {
    const search = listScenarioFixtures('airport', 0, 2);
    const firstPage = listScenarioFixtures('', 0, 2);
    const secondPage = listScenarioFixtures('', 1, 2);

    expect(search.rows.map((scenario) => scenario.id)).toEqual(['structural-proof']);
    expect(firstPage.rows).toHaveLength(2);
    expect(secondPage.rows).toHaveLength(1);
    expect(firstPage.pageCount).toBe(2);
  });

  test('same-priority eligible-vehicle writes remain visibly blocking', () => {
    const eligible = getScenarioFixture('eligible-vehicles');
    const priorityForty = eligible.layers.filter((layer) => layer.priority === 40);

    expect(eligible.conflictState).toBe('2 conflicts');
    expect(priorityForty).toHaveLength(2);
    expect(
      priorityForty.every((layer) => layer.operations[0]?.placementKey === 'primary-hero')
    ).toBe(true);
    expect(
      eligible.publications.find((publication) => publication.state === 'candidate')?.conflictCount
    ).toBe(2);
  });

  test('request fixtures keep RouterService and Auteur states independent', () => {
    const stores = getScenarioFixture('stores');
    expect(stores.requestCases.map((requestCase) => requestCase.outcome)).toEqual([
      200, 404, 404, 503,
    ]);
    expect(
      stores.requestCases.some(
        (requestCase) => requestCase.lifecycle === 'live' && requestCase.auteurState === 'missing'
      )
    ).toBe(true);
  });
});
