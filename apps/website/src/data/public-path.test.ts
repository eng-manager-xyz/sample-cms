import { describe, expect, test } from 'bun:test';
import {
  canonicalPathFromSplat,
  PublicCanonicalPathSchema,
  PublicPageRequestSchema,
  PublicScenarioIdSchema,
  publicHostMatchesTemplate,
  publicRenderPolicy,
  representativePages,
  resolvePublicTemplate,
} from './public-path';

describe('public canonical path mapping', () => {
  test('maps the three disjoint canonical patterns to their template IDs', () => {
    expect(resolvePublicTemplate('/en-US/eligible-vehicles/ca/premium')).toMatchObject({
      scenarioId: 'eligible-vehicles',
      templateId: 'eligible-vehicles',
      canonicalHost: 'www.uber.com',
    });
    expect(resolvePublicTemplate('/en-US/store/1001')).toMatchObject({
      scenarioId: 'stores',
      templateId: 'tpl-store',
      canonicalHost: 'www.ubereats.com',
    });
    expect(resolvePublicTemplate('/en-US/airport/hero-alt')).toMatchObject({
      scenarioId: 'structural-proof',
      templateId: 'structural-marketing',
      canonicalHost: 'www.uber.com',
    });
  });

  test('does not guess a template for malformed or overlapping paths', () => {
    expect(resolvePublicTemplate('/en-US/store/not-a-number')).toBeNull();
    expect(resolvePublicTemplate('/en-US/store/1001/extra')).toBeNull();
    expect(resolvePublicTemplate('/en-US/airport')).toBeNull();
    expect(resolvePublicTemplate('/en-US/eligible-vehicles/ca')).toBeNull();
    expect(resolvePublicTemplate('/en-US/eligible-vehicles/ca/premium/store/1001')).toBeNull();
  });

  test('keeps every landing-page example inside its declared pattern', () => {
    for (const page of representativePages) {
      expect(resolvePublicTemplate(page.canonicalUrl)?.scenarioId).toBe(page.scenarioId);
    }
  });

  test('constructs one absolute canonical path from a TanStack splat', () => {
    expect(canonicalPathFromSplat('en-US/store/1001')).toBe('/en-US/store/1001');
    expect(canonicalPathFromSplat('/en-US/store/1001')).toBe('/en-US/store/1001');
    expect(canonicalPathFromSplat('en-US/contributors/José Silva')).toBe(
      '/en-US/contributors/Jos%C3%A9%20Silva'
    );
  });

  test('accepts any safe template key as a presentation identifier', () => {
    expect(PublicScenarioIdSchema.parse('author-profile')).toBe('author-profile');
    expect(PublicScenarioIdSchema.safeParse('Author Profile').success).toBe(false);
    expect(PublicScenarioIdSchema.safeParse('author/profile').success).toBe(false);
  });
});

describe('public delivery policy', () => {
  test('does not expose preview or edit mode through the server request contract', () => {
    expect(PublicPageRequestSchema.parse({ canonicalUrl: '/en-US/store/1001' })).toEqual({
      canonicalUrl: '/en-US/store/1001',
    });
    expect(
      PublicPageRequestSchema.safeParse({
        canonicalUrl: '/en-US/store/1001',
        edit_mode: true,
      }).success
    ).toBe(false);
    expect(
      PublicPageRequestSchema.safeParse({
        canonicalUrl: '/en-US/store/1001?edit_mode=true',
      }).success
    ).toBe(false);
    expect(publicRenderPolicy).toEqual({
      source: 'active-publication',
      editable: false,
      acceptsPreviewSearchParams: false,
    });
  });

  test('accepts persisted percent-encoded segments and rejects unsafe path forms', () => {
    const canonicalUrl = '/en-US/contributors/Jos%C3%A9%20Silva';
    expect(PublicCanonicalPathSchema.parse(canonicalUrl)).toBe(canonicalUrl);
    expect(PublicPageRequestSchema.parse({ canonicalUrl })).toEqual({ canonicalUrl });

    for (const unsafePath of [
      '/en-US/contributors/Jos%C3%A9%20Silva#bio',
      '/en-US/contributors/Jos%C3%A9%20Silva?mode=edit',
      '/en-US/contributors/%ZZ',
      '/en-US/contributors/%00',
      '/en-US/contributors/%2Fprivate',
      '/en-US/contributors/%2E%2E/private',
      '/en-US/contributors/%C3%28',
      '/en-US/contributors/../private',
      '/en-US//contributors',
      'https://www.uber.com/en-US/contributors/jose',
    ]) {
      expect(PublicCanonicalPathSchema.safeParse(unsafePath).success).toBe(false);
    }
  });

  test('allows local development but enforces canonical hosts in production', () => {
    const store = resolvePublicTemplate('/en-US/store/1001');
    const airport = resolvePublicTemplate('/en-US/airport/hero-alt');
    expect(store).not.toBeNull();
    expect(airport).not.toBeNull();
    if (!store || !airport) throw new Error('Expected public templates.');

    expect(publicHostMatchesTemplate('localhost:3001', store, 'development')).toBe(true);
    expect(publicHostMatchesTemplate('127.0.0.1:3001', airport, 'test')).toBe(true);
    expect(publicHostMatchesTemplate('www.ubereats.com', store, 'production')).toBe(true);
    expect(publicHostMatchesTemplate('www.uber.com', airport, 'production')).toBe(true);
    expect(publicHostMatchesTemplate('www.uber.com', store, 'production')).toBe(false);
    expect(publicHostMatchesTemplate('localhost:3001', store, 'production')).toBe(false);
    expect(publicHostMatchesTemplate('localhost:3001', store, 'production', true)).toBe(true);
  });
});
