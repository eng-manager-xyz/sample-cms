import { describe, expect, test } from 'bun:test';

import {
  AuthoringStudioSearchSchema,
  authoringPanelSearch,
  authoringScopeSearch,
  contentFromDraft,
  deriveBlockFormModel,
  draftValuesFromContent,
  parseContentJson,
  publishedWebsiteHref,
  resolveWebsiteOriginState,
  WebsiteOriginSchema,
  websitePreviewHref,
} from './authoring-studio';

const LOCAL_WEBSITE_ORIGIN = 'http://localhost:3001';

describe('AUT-541 schema-driven block form model', () => {
  test('validates canonical page and scope route state', () => {
    expect(
      AuthoringStudioSearchSchema.parse({
        canonicalUrl: '/en-US/store/1001',
        scopeId: 'variant-store-mcdonalds',
        panel: 'cascade',
      })
    ).toEqual({
      canonicalUrl: '/en-US/store/1001',
      scopeId: 'variant-store-mcdonalds',
      panel: 'cascade',
    });
    expect(
      AuthoringStudioSearchSchema.safeParse({ canonicalUrl: '/en-US/store/1001?draft=true' })
        .success
    ).toBe(false);
    expect(AuthoringStudioSearchSchema.safeParse({ panel: 'sql' }).success).toBe(false);
  });

  test('uses registered JSON schema properties as the primary field contract', () => {
    const model = deriveBlockFormModel({
      schemaJson: JSON.stringify({
        type: 'object',
        required: ['headline'],
        properties: {
          headline: { type: 'string', title: 'Headline', description: 'Primary copy' },
          layout: { type: 'string', enum: ['stacked', 'split'] },
        },
      }),
      exampleContentJson: JSON.stringify({ headline: 'Hello', layout: 'stacked' }),
    });

    expect(model.schemaError).toBeNull();
    expect(model.usesLegacyAdapter).toBe(false);
    expect(model.fields).toEqual([
      {
        key: 'headline',
        label: 'Headline',
        description: 'Primary copy',
        kind: 'string',
        required: true,
        enumValues: [],
        celEligible: true,
        source: 'registered-schema',
      },
      {
        key: 'layout',
        label: 'Layout',
        description: null,
        kind: 'string',
        required: false,
        enumValues: ['stacked', 'split'],
        celEligible: true,
        source: 'registered-schema',
      },
    ]);
  });

  test('adapts immutable required-only v1 schemas from registered examples and current payloads', () => {
    const model = deriveBlockFormModel({
      schemaJson: '{"type":"object","required":["headline"]}',
      exampleContentJson: '{"headline":"Example"}',
      currentContentJson: '{"headline":"{{ store.name }}","featured":true}',
    });

    expect(model.usesLegacyAdapter).toBe(true);
    expect(
      model.fields.map(({ key, kind, required, source }) => ({
        key,
        kind,
        required,
        source,
      }))
    ).toEqual([
      {
        key: 'headline',
        kind: 'string',
        required: true,
        source: 'legacy-schema-adapter',
      },
      {
        key: 'featured',
        kind: 'boolean',
        required: false,
        source: 'legacy-schema-adapter',
      },
    ]);
  });

  test('coerces primary form values and rejects missing or malformed fields', () => {
    const model = deriveBlockFormModel({
      schemaJson: JSON.stringify({
        type: 'object',
        required: ['headline', 'rank'],
        properties: {
          headline: { type: 'string' },
          rank: { type: 'integer' },
          enabled: { type: 'boolean' },
          settings: { type: 'object' },
        },
      }),
      exampleContentJson: '{}',
    });
    const valid = contentFromDraft(model.fields, {
      headline: 'Hello {{ store.name }}',
      rank: '2',
      enabled: 'true',
      settings: '{"tone":"warm"}',
    });
    expect(valid).toEqual({
      success: true,
      content: {
        headline: 'Hello {{ store.name }}',
        rank: 2,
        enabled: true,
        settings: { tone: 'warm' },
      },
    });

    const invalid = contentFromDraft(model.fields, {
      headline: '',
      rank: '2.5',
      enabled: 'maybe',
      settings: '[]',
    });
    expect(invalid.success).toBe(false);
    if (invalid.success) throw new Error('Expected invalid authoring fields.');
    expect(invalid.errors).toEqual({
      headline: 'This field is required.',
      rank: 'Enter a whole number.',
      enabled: 'Choose true or false.',
      settings: 'Enter a JSON object.',
    });
  });

  test('round-trips form draft display values and validates object JSON', () => {
    const model = deriveBlockFormModel({
      schemaJson: JSON.stringify({
        type: 'object',
        properties: {
          message: { type: 'string' },
          active: { type: 'boolean' },
        },
      }),
      exampleContentJson: '{}',
    });
    expect(draftValuesFromContent(model.fields, { message: 'Hi', active: false })).toEqual({
      message: 'Hi',
      active: 'false',
    });
    expect(parseContentJson('{"message":"Hi"}')).toEqual({ message: 'Hi' });
    expect(() => parseContentJson('[]')).toThrow('Block content must be a JSON object.');
  });

  test('derives isolated preview and published website URLs', () => {
    expect(websitePreviewHref('/en-US/store/1001', LOCAL_WEBSITE_ORIGIN)).toBe(
      'http://localhost:3001/cms-preview_/en-US/store/1001'
    );
    expect(publishedWebsiteHref('/en-US/store/1001', LOCAL_WEBSITE_ORIGIN)).toBe(
      'http://localhost:3001/en-US/store/1001'
    );
    expect(() =>
      websitePreviewHref('/en-US/store/1001?draft=true', LOCAL_WEBSITE_ORIGIN)
    ).toThrow();
    expect(() => websitePreviewHref('/en-US/store/1001', 'javascript:alert(1)')).toThrow();
  });

  test('normalizes only bare absolute HTTP(S) website origins', () => {
    expect(WebsiteOriginSchema.parse(' https://website.example.com:8443/ ')).toBe(
      'https://website.example.com:8443'
    );
    for (const origin of [
      'website.example.com',
      'ftp://website.example.com',
      'https://writer:secret@website.example.com',
      'https://website.example.com/content',
      'https://website.example.com?tenant=auteur',
      'https://website.example.com#preview',
    ]) {
      expect(WebsiteOriginSchema.safeParse(origin).success).toBe(false);
    }
  });

  test('uses configured production origin and fails closed when it is missing or invalid', () => {
    expect(
      resolveWebsiteOriginState({
        configuredOrigin: 'https://website.example.com/',
        environment: 'production',
      })
    ).toEqual({
      status: 'ready',
      origin: 'https://website.example.com',
      source: 'configured',
    });
    expect(
      resolveWebsiteOriginState({ configuredOrigin: undefined, environment: 'production' })
    ).toEqual({ status: 'unavailable', reason: 'missing-config' });
    expect(
      resolveWebsiteOriginState({
        configuredOrigin: 'https://website.example.com/content',
        environment: 'production',
      })
    ).toEqual({ status: 'unavailable', reason: 'invalid-config' });
  });

  test('defaults localhost only in development and test environments', () => {
    expect(
      resolveWebsiteOriginState({ configuredOrigin: undefined, environment: 'development' })
    ).toEqual({
      status: 'ready',
      origin: LOCAL_WEBSITE_ORIGIN,
      source: 'local-development-default',
    });
    expect(resolveWebsiteOriginState({ configuredOrigin: '', environment: 'test' })).toEqual({
      status: 'ready',
      origin: LOCAL_WEBSITE_ORIGIN,
      source: 'local-development-default',
    });
    expect(
      resolveWebsiteOriginState({ configuredOrigin: undefined, environment: 'staging' })
    ).toEqual({ status: 'unavailable', reason: 'missing-config' });
    expect(
      resolveWebsiteOriginState({
        configuredOrigin: 'not-a-url',
        environment: 'development',
      })
    ).toEqual({ status: 'unavailable', reason: 'invalid-config' });
  });
});

describe('AUT-550 selector mode search transitions', () => {
  test('opens and closes selector mode without changing page or scope', () => {
    expect(
      authoringPanelSearch({
        canonicalUrl: '/en-US/store/1001',
        scopeId: 'variant-store-fast-food',
        panel: 'cascade',
      })
    ).toEqual({
      canonicalUrl: '/en-US/store/1001',
      scopeId: 'variant-store-fast-food',
      panel: 'cascade',
    });
    expect(
      authoringPanelSearch({
        canonicalUrl: '/en-US/store/1001',
        scopeId: 'variant-store-fast-food',
        panel: 'fields',
      })
    ).toEqual({
      canonicalUrl: '/en-US/store/1001',
      scopeId: 'variant-store-fast-food',
      panel: 'fields',
    });
    expect(
      authoringPanelSearch({
        canonicalUrl: '/en-US/store/1001',
        scopeId: 'variant-store-default',
        panel: 'cascade',
      })
    ).toEqual({
      canonicalUrl: '/en-US/store/1001',
      scopeId: 'variant-store-default',
      panel: 'cascade',
    });
  });

  test('clears a selected variant to default and exits selector-only mode', () => {
    expect(
      authoringScopeSearch({
        canonicalUrl: '/en-US/store/1001',
        nextScopeId: 'variant-store-default',
        currentPanel: 'cascade',
        nextScopeIsDefault: true,
      })
    ).toEqual({
      canonicalUrl: '/en-US/store/1001',
      scopeId: 'variant-store-default',
      panel: 'fields',
    });
  });
});
