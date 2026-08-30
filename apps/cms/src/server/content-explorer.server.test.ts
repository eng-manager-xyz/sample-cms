import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { ensureCompactPublishedScenarios } from '@repo/cms-scenarios/compact-seed';
import { CmsService } from '@repo/cms-service';
import {
  CONTENT_EXPLORER_PAGE_OPTION_LIMIT,
  CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT,
} from '@/data/content-explorer';
import { readContentExplorer } from './content-explorer.server';
import { readCmsWorkspace } from './sqlite-authoring.server';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  ensureCompactPublishedScenarios(client);
});

afterEach(() => client.close());

describe('AUT-540 SQLite content explorer', () => {
  test('returns exactly the allowlisted persisted templates with counts and publication state', () => {
    new CmsService(client).createTemplate({
      id: 'rogue-template',
      key: 'rogue-template',
      name: 'Rogue template',
      domain: 'example.test',
      urlPattern: '/{slug}',
    });

    const snapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
    });

    expect(snapshot.templates.map((template) => template.slug)).toEqual([
      'stores',
      'eligible-vehicles',
      'structural-proof',
    ]);
    expect(snapshot.templates.some((template) => template.templateId === 'rogue-template')).toBe(
      false
    );
    const storeTemplate = snapshot.templates[0];
    expect(storeTemplate).toMatchObject({
      templateId: 'tpl-store',
      pageCount: 14,
      livePageCount: 14,
      variantCount: 4,
      publicationState: 'published',
      currentPublicationId: 'publication-store-2',
      publishedPageCount: 14,
    });
    expect(
      snapshot.templates.map(({ pageCount, publishedPageCount }) => ({
        pageCount,
        publishedPageCount,
      }))
    ).toEqual([
      { pageCount: 14, publishedPageCount: 14 },
      { pageCount: 14, publishedPageCount: 14 },
      { pageCount: 14, publishedPageCount: 14 },
    ]);
    expect(snapshot.templates.every((template) => template.slots.length > 0)).toBe(true);
  });

  test('projects ordered path slots and the deterministic proof page as navigation context', () => {
    const snapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
    });

    expect(snapshot.pageNavigation.segments).toEqual([
      {
        slotId: 'slot-store-locale',
        key: 'locale',
        label: 'Locale',
        kind: 'variable',
        pathPosition: 0,
        staticValue: null,
        defaultValue: 'en-US',
        selectedValue: 'en-US',
      },
      {
        slotId: 'slot-store-static',
        key: 'store',
        label: 'Store path',
        kind: 'static',
        pathPosition: 1,
        staticValue: 'store',
        defaultValue: 'store',
        selectedValue: 'store',
      },
      {
        slotId: 'slot-store-id',
        key: 'store_id',
        label: 'Store ID',
        kind: 'variable',
        pathPosition: 2,
        staticValue: null,
        defaultValue: '1001',
        selectedValue: '1001',
      },
    ]);
    expect(snapshot.pageNavigation.defaultPage).toEqual({
      pageId: 'page-store-1001',
      canonicalUrl: '/en-US/store/1001',
      routeStatus: 'live',
      slotValues: { locale: 'en-US', store: 'store', store_id: '1001' },
    });
    expect(snapshot.pageNavigation.selectedPage).toEqual(snapshot.pageNavigation.defaultPage);
    expect(snapshot.pageNavigation.options).toContainEqual({
      pageId: 'page-store-1002',
      canonicalUrl: '/en-US/store/1002',
      routeStatus: 'live',
      slotValues: { locale: 'en-US', store: 'store', store_id: '1002' },
    });
    const storeTemplate = snapshot.templates.find((template) => template.slug === 'stores');
    if (!storeTemplate) throw new Error('Store template summary was not loaded.');
    expect(snapshot.pageNavigation.totalCount).toBe(storeTemplate.pageCount);
    expect(snapshot.pageNavigation.truncated).toBe(false);
  });

  test('loads every selector identity but computes exact impact only for the selected selector', () => {
    const service = new CmsService(client);
    service.createVariant('tpl-store', {
      id: 'variant-store-live-draft',
      revisionId: 'revision-store-live-draft-1',
      key: 'live-draft',
      name: 'Live draft',
      priority: 40,
      status: 'draft',
      selector: "route_status = 'live'",
      createdBy: 'test',
      mode: 'linked',
    });
    service.setVariantStatus('tpl-store', 'variant-store-burger-king', 'archived');

    const snapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
    });
    expect(snapshot.selectors.map((selector) => selector.id)).not.toContain(
      'variant-store-burger-king'
    );
    expect(snapshot.selectors.every((selector) => !selector.metricsLoaded)).toBe(true);
    expect(snapshot.selectors.every((selector) => selector.exactMatchCount === null)).toBe(true);
    expect(snapshot.selectors.every((selector) => selector.sampleCanonicalUrls.length === 0)).toBe(
      true
    );

    const defaultSnapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
      selectorMetricsFor: 'tpl-store:default',
    });
    const defaults = defaultSnapshot.selectors.find((selector) => selector.isDefault);
    expect(
      defaultSnapshot.selectors.filter((selector) => selector.metricsLoaded).map(({ id }) => id)
    ).toEqual(['tpl-store:default']);
    expect(defaults).toMatchObject({
      id: 'tpl-store:default',
      priority: 0,
      status: 'active',
      selector: 'TRUE',
      metricsLoaded: true,
      exactMatchCount: defaultSnapshot.pageNavigation.totalCount,
      affectedPlacementCount: 4,
      selectedPageMatches: true,
    });
    expect(defaults?.sampleCanonicalUrls.length).toBeLessThanOrEqual(
      CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT
    );
    expect(defaults?.sampleUrlsTruncated).toBe(
      defaultSnapshot.pageNavigation.totalCount > CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT
    );

    const mcdonaldsSnapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
      selectorMetricsFor: 'variant-store-mcdonalds',
    });
    expect(
      mcdonaldsSnapshot.selectors.find((selector) => selector.id === 'variant-store-mcdonalds')
    ).toMatchObject({
      selector: "brand = 'mcdonalds'",
      metricsLoaded: true,
      exactMatchCount: 1,
      affectedPlacementCount: 1,
      selectedPageMatches: true,
      sampleCanonicalUrls: ['/en-US/store/1001'],
      sampleUrlsTruncated: false,
    });

    const draftSnapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
      selectorMetricsFor: 'variant-store-live-draft',
    });
    expect(
      draftSnapshot.selectors.find((selector) => selector.id === 'variant-store-live-draft')
    ).toMatchObject({
      status: 'draft',
      selector: "route_status = 'live'",
      metricsLoaded: true,
      exactMatchCount: draftSnapshot.templates.find((template) => template.slug === 'stores')
        ?.livePageCount,
      affectedPlacementCount: 0,
      selectedPageMatches: true,
    });
  });

  test('bounds concrete page choices at one hundred while retaining exact total and route state', () => {
    const service = new CmsService(client);
    const initial = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
    });
    const additionalCount = CONTENT_EXPLORER_PAGE_OPTION_LIMIT + 1;
    for (let index = 0; index < additionalCount; index += 1) {
      const storeId = 700_000 + index;
      service.createPage('tpl-store', {
        id: `page-store-${storeId}`,
        canonicalUrl: `/en-US/store/${storeId}`,
        routeExternalId: `router-store-${storeId}`,
        routeStatus: index === 0 ? 'archived' : index === 1 ? 'not_live' : 'live',
        routeRevision: 'aut-547-navigation-test',
        context: { store: { id: storeId, name: `Store ${storeId}` } },
        slotValues: {
          locale: 'en-US',
          store: 'store',
          store_id: storeId,
          store_name: `Store ${storeId}`,
        },
      });
    }

    const snapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
    });
    expect(snapshot.pageNavigation.options).toHaveLength(CONTENT_EXPLORER_PAGE_OPTION_LIMIT);
    expect(snapshot.pageNavigation.totalCount).toBe(
      initial.pageNavigation.totalCount + additionalCount
    );
    expect(snapshot.pageNavigation.truncated).toBe(true);
    expect(snapshot.pageNavigation.defaultPage?.canonicalUrl).toBe('/en-US/store/1001');
    expect(snapshot.pageNavigation.options).toContainEqual({
      pageId: 'page-store-700000',
      canonicalUrl: '/en-US/store/700000',
      routeStatus: 'archived',
      slotValues: { locale: 'en-US', store: 'store', store_id: '700000' },
    });
    expect(
      snapshot.pageNavigation.options.every(
        (option) => Object.keys(option.slotValues).join(',') === 'locale,store,store_id'
      )
    ).toBe(true);

    const exactSelection = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
      selectedCanonicalUrl: '/en-US/store/700100',
      includeSelectors: false,
    });
    expect(exactSelection.pageNavigation.options).toHaveLength(CONTENT_EXPLORER_PAGE_OPTION_LIMIT);
    expect(exactSelection.pageNavigation.selectedPage).toMatchObject({
      pageId: 'page-store-700100',
      canonicalUrl: '/en-US/store/700100',
      slotValues: { locale: 'en-US', store: 'store', store_id: '700100' },
    });
    expect(exactSelection.pages.some((page) => page.id === 'page-store-700100')).toBe(false);
    expect(exactSelection.selectedPageDetail).toMatchObject({
      id: 'page-store-700100',
      canonicalUrl: '/en-US/store/700100',
      routeStatus: 'live',
      routeRevision: 'aut-547-navigation-test',
      publicationState: 'not_published',
      documentHash: null,
    });
    expect(exactSelection.pageNavigation.defaultPage).toMatchObject({
      pageId: 'page-store-1001',
      canonicalUrl: '/en-US/store/1001',
      slotValues: { locale: 'en-US', store: 'store', store_id: '1001' },
    });
    expect(exactSelection.pageNavigation.segments.at(-1)).toMatchObject({
      defaultValue: '1001',
      selectedValue: '700100',
    });
    const exactDefaultPage = exactSelection.pageNavigation.defaultPage;
    if (!exactDefaultPage) throw new Error('Expected the Store default preview page.');
    expect(exactSelection.pageNavigation.options).toContainEqual(exactDefaultPage);
    expect(exactSelection.selectors).toEqual([]);
  });

  test('retains both default and exact selected pages at the bounded navigation edge', () => {
    const service = new CmsService(client);
    for (let index = 0; index < 96; index += 1) {
      const suffix = String(index).padStart(3, '0');
      service.createPage('tpl-store', {
        id: `page-store-before-default-${suffix}`,
        canonicalUrl: `/aa-${suffix}/store/${800_000 + index}`,
        routeExternalId: `router-store-before-default-${suffix}`,
        routeStatus: 'live',
        routeRevision: 'aut-547-required-page-boundary',
        context: { store: { id: 800_000 + index, name: `Boundary ${suffix}` } },
        slotValues: {
          locale: `aa-${suffix}`,
          store: 'store',
          store_id: 800_000 + index,
          store_name: `Boundary ${suffix}`,
        },
      });
    }
    service.createPage('tpl-store', {
      id: 'page-store-after-boundary',
      canonicalUrl: '/zz-ZZ/store/999999',
      routeExternalId: 'router-store-after-boundary',
      routeStatus: 'live',
      routeRevision: 'aut-547-required-page-boundary',
      context: { store: { id: 999_999, name: 'After boundary' } },
      slotValues: {
        locale: 'zz-ZZ',
        store: 'store',
        store_id: 999_999,
        store_name: 'After boundary',
      },
    });

    const snapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
      selectedCanonicalUrl: '/zz-ZZ/store/999999',
      includeSelectors: false,
    });
    expect(snapshot.pageNavigation.options).toHaveLength(CONTENT_EXPLORER_PAGE_OPTION_LIMIT);
    expect(snapshot.pageNavigation.defaultPage?.canonicalUrl).toBe('/en-US/store/1001');
    expect(snapshot.pageNavigation.selectedPage?.canonicalUrl).toBe('/zz-ZZ/store/999999');
    expect(snapshot.pageNavigation.options.map((option) => option.canonicalUrl)).toEqual(
      expect.arrayContaining(['/en-US/store/1001', '/zz-ZZ/store/999999'])
    );
  });

  test('uses bounded bidirectional cursors without duplicate pages', () => {
    const allPages = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 50,
    }).pages;
    const first = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
    });
    expect(first.pages).toHaveLength(1);
    expect(first.pages[0]?.id).toBe(allPages[0]?.id);
    expect(first.previousCursor).toBeNull();
    expect(first.nextCursor).not.toBeNull();

    const second = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.pages).toHaveLength(1);
    expect(second.pages[0]?.id).toBe(allPages[1]?.id);
    expect(second.pages[0]?.id).not.toBe(first.pages[0]?.id);
    expect(second.previousCursor).not.toBeNull();
    expect(Boolean(second.nextCursor)).toBe(allPages.length > 2);

    const previous = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
      cursor: second.previousCursor ?? undefined,
    });
    expect(previous.pages[0]?.id).toBe(first.pages[0]?.id);
    expect(previous.previousCursor).toBeNull();
    expect(previous.nextCursor).not.toBeNull();
  });

  test('searches canonical URLs in SQLite while retaining exact template counts', () => {
    const result = readContentExplorer(client, {
      template: 'stores',
      q: '1002',
      limit: 1,
    });

    expect(result.filteredCount).toBe(1);
    expect(result.pages.map((page) => page.canonicalUrl)).toEqual(['/en-US/store/1002']);
    expect(result.templates[0]?.pageCount).toBe(14);
    expect(result.pageNavigation.totalCount).toBe(14);
  });

  test('rejects malformed cursors instead of falling back to an unbounded read', () => {
    expect(() =>
      readContentExplorer(client, {
        template: 'stores',
        q: '',
        limit: 20,
        cursor: 'not-a-content-cursor',
      })
    ).toThrow('invalid or expired');
  });

  test('resolves the canonical page selected by route search inside its template', () => {
    const workspace = readCmsWorkspace(client, 'stores', undefined, '/en-US/store/1002');
    expect(workspace).toMatchObject({
      templateId: 'tpl-store',
      pageId: 'page-store-1002',
      canonicalUrl: '/en-US/store/1002',
    });

    expect(() => readCmsWorkspace(client, 'stores', undefined, '/en-US/airport/hero-alt')).toThrow(
      'not found in the selected template'
    );
  });
});
