import { describe, expect, test } from 'bun:test';

import {
  contentExplorerTreePath,
  pagesForExplorerTree,
  resolveExplorerSelection,
} from '@/components/content-explorer';
import type { ContentExplorerPage } from '@/data/content-explorer';

const firstPage: ContentExplorerPage = {
  id: 'page-store-1001',
  templateId: 'tpl-store',
  canonicalUrl: '/en-US/store/1001',
  routeStatus: 'live',
  routeRevision: 'route-1',
  updatedAt: '2026-01-03T00:00:00.000Z',
  segments: ['en-US', 'store', '1001'],
  publicationState: 'published',
  documentHash: 'hash-1',
  slotValues: { locale: 'en-US', store: 'store', store_id: '1001' },
  tags: [],
};

const deepLinkedPage: ContentExplorerPage = {
  ...firstPage,
  id: 'page-store-9999',
  canonicalUrl: '/fr-CA/store/9999',
  routeRevision: 'route-2',
  segments: ['fr-CA', 'store', '9999'],
  documentHash: 'hash-2',
};

describe('AUT-553 filesystem-style Content Explorer model', () => {
  test('uses canonical paths as stable template, page, and selector identity', () => {
    expect(contentExplorerTreePath('stores', 'template')).toBe('/templates/stores');
    expect(contentExplorerTreePath('stores', 'pages')).toBe('/templates/stores/pages');
    expect(contentExplorerTreePath('stores', 'page', '/en-US/store/1001')).toBe(
      '/templates/stores/pages/en-US/store/1001'
    );
    expect(contentExplorerTreePath('stores', 'selector', 'tpl-store:default')).toBe(
      '/templates/stores/selectors/tpl-store:default'
    );
  });

  test('pins an exact deep-linked page without duplicating a loaded row', () => {
    expect(pagesForExplorerTree([firstPage], deepLinkedPage)).toEqual([deepLinkedPage, firstPage]);
    expect(pagesForExplorerTree([deepLinkedPage, firstPage], deepLinkedPage)).toEqual([
      deepLinkedPage,
      firstPage,
    ]);
  });

  test('normalizes legacy explorer views into the unified collection inspectors', () => {
    const snapshot = { selectedPageDetail: null, selectors: [] };

    expect(
      resolveExplorerSelection({ view: 'table', template: 'stores', q: '' }, snapshot).kind
    ).toBe('pages');
    expect(
      resolveExplorerSelection({ view: 'selectors', template: 'stores', q: '' }, snapshot).kind
    ).toBe('selectors');
  });
});
