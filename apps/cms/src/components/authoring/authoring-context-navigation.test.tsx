import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ContentPageNavigation } from '@/data/content-explorer';
import { getScenarioFixture, scenarioFixtures } from '@/data/scenario-fixtures';
import { AuthoringContextNavigation } from './authoring-context-navigation';

const navigation: ContentPageNavigation = {
  segments: [
    {
      slotId: 'locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      pathPosition: 0,
      staticValue: null,
      defaultValue: 'en-US',
      selectedValue: 'fr-CA',
    },
    {
      slotId: 'resource',
      key: 'resource',
      label: 'Store path',
      kind: 'static',
      pathPosition: 1,
      staticValue: 'store',
      defaultValue: 'store',
      selectedValue: 'store',
    },
    {
      slotId: 'store-id',
      key: 'store_id',
      label: 'Store ID',
      kind: 'variable',
      pathPosition: 2,
      staticValue: null,
      defaultValue: '1001',
      selectedValue: '1006',
    },
  ],
  defaultPage: {
    pageId: 'store-1001',
    canonicalUrl: '/en-US/store/1001',
    routeStatus: 'live',
    slotValues: { locale: 'en-US', resource: 'store', store_id: '1001' },
  },
  selectedPage: {
    pageId: 'store-1006',
    canonicalUrl: '/fr-CA/store/1006',
    routeStatus: 'live',
    slotValues: { locale: 'fr-CA', resource: 'store', store_id: '1006' },
  },
  options: [
    {
      pageId: 'store-1001',
      canonicalUrl: '/en-US/store/1001',
      routeStatus: 'live',
      slotValues: { locale: 'en-US', resource: 'store', store_id: '1001' },
    },
    {
      pageId: 'store-1006',
      canonicalUrl: '/fr-CA/store/1006',
      routeStatus: 'live',
      slotValues: { locale: 'fr-CA', resource: 'store', store_id: '1006' },
    },
  ],
  totalCount: 12,
  truncated: true,
};

function renderContextNavigation(): string {
  return renderToStaticMarkup(
    <AuthoringContextNavigation
      scenarios={scenarioFixtures}
      scenario={getScenarioFixture('stores')}
      navigation={navigation}
      canonicalUrl="/fr-CA/store/1006"
      resolutionStatus="resolved"
      lifecycleLabel="Saved"
      lifecycleTone="neutral"
      lifecycleAnnouncement="Saved SQLite draft loaded for /fr-CA/store/1006."
      disabled={false}
      onTemplateChange={() => undefined}
      onPageChange={() => undefined}
    />
  );
}

describe('AUT-551 compact authoring context navigation', () => {
  test('exposes template and variable URL segments as compact accessible dropdowns', () => {
    const markup = renderContextNavigation();

    expect(markup).toContain('<nav aria-label="Authoring page context"');
    expect(markup).toContain('>Store pages authoring</h1>');
    expect(markup).toContain('>Template</label>');
    expect(markup).toContain('title="Template"');
    expect(markup).toContain('h-7 px-2 text-[11px]');
    expect(markup).not.toContain('h-8');
    expect(markup).toContain('>Store pages</option>');
    expect(markup).toContain('>Locale</label>');
    expect(markup).toContain('title="Locale"');
    expect(markup).toContain('<option value="fr-CA" selected="">fr-CA</option>');
    expect(markup).toContain('>Store ID</label>');
    expect(markup).toContain('title="Store ID"');
    expect(markup).toContain('<option value="1006" selected="">1006</option>');
  });

  test('keeps the static path locked and consolidates route, resolution, and save statuses', () => {
    const markup = renderContextNavigation();

    expect(markup).toContain('title="Store path: store"');
    expect(markup).toContain('>store</span>');
    expect(markup).toContain('Router status: live. Authoring resolution: resolved.');
    expect(markup).toContain('live · resolved');
    expect(markup).toContain('>Saved</span>');
    expect(markup).toContain('Current canonical page: /fr-CA/store/1006');
  });

  test('does not repeat the former verbose preview-page panel copy', () => {
    const markup = renderContextNavigation();

    expect(markup).not.toContain('Preview page');
    expect(markup).not.toContain('Page context only');
    expect(markup).not.toContain('Template variations and their selectors remain template-wide');
  });
});
