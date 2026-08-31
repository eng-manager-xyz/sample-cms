import { describe, expect, test } from 'bun:test';

import {
  AuthoringStudioSearchSchema,
  authoringPanelSearch,
  authoringScopeSearch,
  authoringTemplateSearch,
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
    expect(AuthoringStudioSearchSchema.safeParse({ panel: 'create-selector' }).success).toBe(true);
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
        path: 'headline',
        schemaOrder: 0,
        label: 'Headline',
        description: 'Primary copy',
        kind: 'string',
        itemKind: null,
        children: [],
        required: true,
        enumValues: [],
        celEligible: true,
        source: 'registered-schema',
      },
      {
        key: 'layout',
        path: 'layout',
        schemaOrder: 1,
        label: 'Layout',
        description: null,
        kind: 'string',
        itemKind: null,
        children: [],
        required: false,
        enumValues: ['stacked', 'split'],
        celEligible: true,
        source: 'registered-schema',
      },
    ]);
  });

  test('AUT-556 preserves recursive object hierarchy, nested metadata, and array item kinds', () => {
    const model = deriveBlockFormModel({
      schemaJson: JSON.stringify({
        type: 'object',
        required: ['headline', 'settings'],
        properties: {
          headline: { type: 'string', title: 'Headline' },
          settings: {
            type: 'object',
            title: 'Presentation',
            description: 'Controls how this block is presented.',
            required: ['theme', 'limits'],
            properties: {
              theme: {
                type: 'string',
                title: 'Color theme',
                description: 'Select the registered visual theme.',
                enum: ['light', 'dark'],
              },
              limits: {
                type: 'object',
                title: 'Limits',
                required: ['maximum'],
                properties: {
                  maximum: { type: 'integer', title: 'Maximum items' },
                },
              },
            },
          },
          tags: {
            type: 'array',
            title: 'Tags',
            items: { type: 'string' },
          },
          metadata: { type: 'object', title: 'Raw metadata' },
        },
      }),
      exampleContentJson: JSON.stringify({
        headline: 'Hello',
        settings: { theme: 'light', limits: { maximum: 3 } },
        tags: ['featured'],
        metadata: { campaign: 'summer' },
      }),
      currentContentJson: JSON.stringify({
        headline: 'Current',
        settings: {
          theme: 'dark',
          limits: { maximum: 5 },
          personalized: true,
        },
        tags: ['launch'],
        metadata: { campaign: 'fall' },
      }),
    });

    expect(model.schemaError).toBeNull();
    expect(model.usesLegacyAdapter).toBe(true);
    expect(
      model.fields.map(({ key, path, schemaOrder, kind, itemKind, children }) => ({
        key,
        path,
        schemaOrder,
        kind,
        itemKind,
        childPaths: children.map((child) => child.path),
      }))
    ).toEqual([
      {
        key: 'headline',
        path: 'headline',
        schemaOrder: 0,
        kind: 'string',
        itemKind: null,
        childPaths: [],
      },
      {
        key: 'settings',
        path: 'settings',
        schemaOrder: 1,
        kind: 'object',
        itemKind: null,
        childPaths: ['settings.theme', 'settings.limits', 'settings.personalized'],
      },
      {
        key: 'tags',
        path: 'tags',
        schemaOrder: 2,
        kind: 'array',
        itemKind: 'string',
        childPaths: [],
      },
      {
        key: 'metadata',
        path: 'metadata',
        schemaOrder: 3,
        kind: 'object',
        itemKind: null,
        childPaths: [],
      },
    ]);

    const settings = model.fields[1];
    if (!settings) throw new Error('Expected the nested settings field.');
    expect(settings).toMatchObject({
      label: 'Presentation',
      description: 'Controls how this block is presented.',
      required: true,
      celEligible: false,
      source: 'registered-schema',
    });
    expect(settings.children[0]).toMatchObject({
      key: 'theme',
      path: 'settings.theme',
      schemaOrder: 0,
      label: 'Color theme',
      description: 'Select the registered visual theme.',
      required: true,
      enumValues: ['light', 'dark'],
      celEligible: true,
      source: 'registered-schema',
    });
    expect(settings.children[1]?.children[0]).toMatchObject({
      key: 'maximum',
      path: 'settings.limits.maximum',
      schemaOrder: 0,
      label: 'Maximum items',
      kind: 'integer',
      required: true,
      celEligible: false,
    });
    expect(settings.children[2]).toMatchObject({
      key: 'personalized',
      path: 'settings.personalized',
      schemaOrder: 2,
      kind: 'boolean',
      source: 'legacy-schema-adapter',
    });
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

  test('AUT-556 round-trips nested leaves while arrays and schema-less objects stay JSON', () => {
    const model = deriveBlockFormModel({
      schemaJson: JSON.stringify({
        type: 'object',
        required: ['settings'],
        properties: {
          settings: {
            type: 'object',
            required: ['theme', 'limits'],
            properties: {
              theme: { type: 'string', enum: ['light', 'dark'] },
              limits: {
                type: 'object',
                required: ['maximum'],
                properties: {
                  maximum: { type: 'integer' },
                },
              },
            },
          },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
      }),
      exampleContentJson: '{}',
    });
    const content = {
      settings: { theme: 'dark', limits: { maximum: 5 } },
      tags: ['featured', 'launch'],
      metadata: { campaign: 'fall' },
    };
    const draft = draftValuesFromContent(model.fields, content);

    expect(draft).toEqual({
      'settings.theme': 'dark',
      'settings.limits.maximum': '5',
      tags: '[\n  "featured",\n  "launch"\n]',
      metadata: '{\n  "campaign": "fall"\n}',
    });
    expect(contentFromDraft(model.fields, draft)).toEqual({ success: true, content });

    const invalid = contentFromDraft(model.fields, {
      'settings.theme': '',
      'settings.limits.maximum': '2.5',
      tags: '{}',
      metadata: '[]',
    });
    expect(invalid).toEqual({
      success: false,
      errors: {
        'settings.theme': 'This field is required.',
        'settings.limits.maximum': 'Enter a whole number.',
        tags: 'Enter a JSON array.',
        metadata: 'Enter a JSON object.',
      },
    });
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

describe('AUT-551 compact authoring navigation transitions', () => {
  test('resets page and selector context when changing templates', () => {
    expect(authoringTemplateSearch()).toEqual({ panel: 'fields' });
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

  test('selecting an existing variation exits selector creation mode', () => {
    expect(
      authoringScopeSearch({
        canonicalUrl: '/en-US/store/1001',
        nextScopeId: 'variant-store-fast-food',
        currentPanel: 'create-selector',
        nextScopeIsDefault: false,
      })
    ).toEqual({
      canonicalUrl: '/en-US/store/1001',
      scopeId: 'variant-store-fast-food',
      panel: 'fields',
    });
  });
});
