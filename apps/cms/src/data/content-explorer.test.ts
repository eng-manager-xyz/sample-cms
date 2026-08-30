import { describe, expect, test } from 'bun:test';
import {
  CanonicalUrlSchema,
  CONTENT_EXPLORER_PAGE_OPTION_LIMIT,
  CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT,
  ContentExplorerInputSchema,
  ContentExplorerSearchSchema,
  ContentPageNavigationSchema,
  ContentSelectorSummarySchema,
  canonicalUrlSegments,
  FixedTemplateSlugSchema,
  TemplateWorkspaceSearchSchema,
} from './content-explorer';

describe('AUT-540 content explorer schemas', () => {
  test('defaults to the Store tree without an unbounded cursor or query', () => {
    expect(ContentExplorerSearchSchema.parse({})).toEqual({
      view: 'tree',
      template: 'stores',
      q: '',
    });
    expect(ContentExplorerSearchSchema.parse({ view: 'selectors' }).view).toBe('selectors');
    expect(
      ContentExplorerSearchSchema.parse({ canonicalUrl: '/fr-CA/store/1014' }).canonicalUrl
    ).toBe('/fr-CA/store/1014');
    expect(ContentExplorerSearchSchema.safeParse({ view: 'grid' }).success).toBe(false);
  });

  test('allowlists exactly the three provisioned templates', () => {
    expect(FixedTemplateSlugSchema.options).toEqual([
      'stores',
      'eligible-vehicles',
      'structural-proof',
    ]);
    expect(FixedTemplateSlugSchema.safeParse('rogue-template').success).toBe(false);
  });

  test('bounds every server page read', () => {
    expect(
      ContentExplorerInputSchema.safeParse({ template: 'stores', q: '', limit: 50 }).success
    ).toBe(true);
    expect(
      ContentExplorerInputSchema.safeParse({ template: 'stores', q: '', limit: 51 }).success
    ).toBe(false);
  });

  test('validates canonical studio selection without query-string ambiguity', () => {
    expect(TemplateWorkspaceSearchSchema.parse({ canonicalUrl: '/en-US/store/1002' })).toEqual({
      canonicalUrl: '/en-US/store/1002',
    });
    expect(CanonicalUrlSchema.safeParse('en-US/store/1002').success).toBe(false);
    expect(CanonicalUrlSchema.safeParse('/en-US/store/1002?edit=true').success).toBe(false);
    expect(canonicalUrlSegments('/en-US/store/1002')).toEqual(['en-US', 'store', '1002']);
  });
});

describe('AUT-547 bounded template navigation and selector summaries', () => {
  const navigationOption = {
    pageId: 'page-store-1001',
    canonicalUrl: '/en-US/store/1001',
    routeStatus: 'live' as const,
    slotValues: { locale: 'en-US', store: 'store', store_id: '1001' },
  };

  test('caps concrete page options at one hundred', () => {
    const navigation = {
      segments: [
        {
          slotId: 'slot-store-locale',
          key: 'locale',
          label: 'Locale',
          kind: 'variable' as const,
          pathPosition: 0,
          staticValue: null,
          defaultValue: 'en-US',
          selectedValue: 'en-US',
        },
      ],
      defaultPage: navigationOption,
      selectedPage: navigationOption,
      totalCount: CONTENT_EXPLORER_PAGE_OPTION_LIMIT + 1,
      truncated: true,
    };
    expect(
      ContentPageNavigationSchema.safeParse({
        ...navigation,
        options: Array.from({ length: CONTENT_EXPLORER_PAGE_OPTION_LIMIT }, () => navigationOption),
      }).success
    ).toBe(true);
    expect(
      ContentPageNavigationSchema.safeParse({
        ...navigation,
        options: Array.from(
          { length: CONTENT_EXPLORER_PAGE_OPTION_LIMIT + 1 },
          () => navigationOption
        ),
      }).success
    ).toBe(false);
  });

  test('caps selector URL samples while preserving exact counts', () => {
    const selector = {
      id: 'variant-store-chain',
      activeRevisionId: 'revision-store-chain-1',
      name: 'Chain stores',
      isDefault: false,
      priority: 10,
      status: 'active' as const,
      selector: "store_type = 'chain_store'",
      exactMatchCount: CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT + 1,
      affectedPlacementCount: 1,
      selectedPageMatches: true,
      sampleUrlsTruncated: true,
    };
    expect(
      ContentSelectorSummarySchema.safeParse({
        ...selector,
        sampleCanonicalUrls: Array.from(
          { length: CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT },
          () => '/en-US/store/1001'
        ),
      }).success
    ).toBe(true);
    expect(
      ContentSelectorSummarySchema.safeParse({
        ...selector,
        sampleCanonicalUrls: Array.from(
          { length: CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT + 1 },
          () => '/en-US/store/1001'
        ),
      }).success
    ).toBe(false);
  });
});
