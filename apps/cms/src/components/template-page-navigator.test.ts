import { describe, expect, test } from 'bun:test';
import type { ContentPageNavigation } from '@/data/content-explorer';
import { nextPageForSegment, valuesForSegment } from './template-page-navigator';

const navigation = {
  segments: [
    {
      slotId: 'locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      pathPosition: 0,
      staticValue: null,
      defaultValue: 'en-US',
      selectedValue: 'en-US',
    },
    {
      slotId: 'resource',
      key: 'resource',
      label: 'Resource',
      kind: 'static',
      pathPosition: 1,
      staticValue: 'eligible-vehicles',
      defaultValue: 'eligible-vehicles',
      selectedValue: 'eligible-vehicles',
    },
    {
      slotId: 'state',
      key: 'state',
      label: 'State',
      kind: 'variable',
      pathPosition: 2,
      staticValue: null,
      defaultValue: 'ca',
      selectedValue: 'ca',
    },
    {
      slotId: 'slug',
      key: 'slug',
      label: 'Slug',
      kind: 'variable',
      pathPosition: 3,
      staticValue: null,
      defaultValue: 'premium',
      selectedValue: 'premium',
    },
  ],
  options: [
    {
      pageId: 'ca-premium',
      canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
      routeStatus: 'live',
      slotValues: {
        locale: 'en-US',
        resource: 'eligible-vehicles',
        state: 'ca',
        slug: 'premium',
      },
    },
    {
      pageId: 'tx-delivery',
      canonicalUrl: '/en-US/eligible-vehicles/tx/delivery',
      routeStatus: 'live',
      slotValues: {
        locale: 'en-US',
        resource: 'eligible-vehicles',
        state: 'tx',
        slug: 'delivery',
      },
    },
    {
      pageId: 'es-tx-delivery',
      canonicalUrl: '/es-US/eligible-vehicles/tx/delivery',
      routeStatus: 'live',
      slotValues: {
        locale: 'es-US',
        resource: 'eligible-vehicles',
        state: 'tx',
        slug: 'delivery',
      },
    },
  ],
  totalCount: 3,
  truncated: false,
} satisfies Omit<ContentPageNavigation, 'defaultPage' | 'selectedPage'>;

const completeNavigation: ContentPageNavigation = {
  ...navigation,
  defaultPage: navigation.options[0] ?? null,
  selectedPage: navigation.options[0] ?? null,
};

describe('AUT-547 segmented template page navigation', () => {
  test('only offers downstream values that form an existing concrete page', () => {
    const current = navigation.options[0];
    if (!current) throw new Error('Missing navigation fixture page.');

    expect(valuesForSegment(completeNavigation, current, 0, 'locale')).toEqual(['en-US', 'es-US']);
    expect(valuesForSegment(completeNavigation, current, 3, 'slug')).toEqual(['premium']);
  });

  test('changes one segment by selecting a persisted canonical page and resets downstream values', () => {
    const current = navigation.options[0];
    if (!current) throw new Error('Missing navigation fixture page.');

    expect(nextPageForSegment(completeNavigation, current, 2, 'state', 'tx')).toMatchObject({
      canonicalUrl: '/en-US/eligible-vehicles/tx/delivery',
      slotValues: { locale: 'en-US', state: 'tx', slug: 'delivery' },
    });
    expect(nextPageForSegment(completeNavigation, current, 2, 'state', 'ny')).toBeNull();
  });
});
