import { describe, expect, test } from 'bun:test';
import {
  createPreviewPageViewModel,
  PreviewPageRequestSchema,
  PreviewPageViewModelSchema,
  previewHostMatchesTemplate,
} from './preview-page';
import { resolvePublicTemplate } from './public-path';
import { WebsitePageViewModelSchema } from './website-page';

const draft = {
  page: {
    id: 'page-store-1001',
    canonicalUrl: '/en-US/store/1001',
    ignoredServiceField: true,
  },
  document: {
    templateId: 'tpl-store',
    contentHash: 'draft-hash',
    matchedVariantIds: ['revision-store-mcdonalds-2'],
    placements: [
      {
        placementKey: 'primary-hero',
        order: 0,
        blockVersion: {
          id: 'block-store-hero-preview',
          blockType: 'hero',
          lineageId: 'lineage-store-primary-hero',
        },
        provenance: {
          content: {
            kind: 'variant',
            sourceId: 'revision-store-mcdonalds-2',
            priority: 30,
          },
          order: { kind: 'default', sourceId: 'tpl-store:default:r1', priority: 0 },
        },
        trace: [
          {
            kind: 'set',
            placementKey: 'primary-hero',
            source: {
              kind: 'variant',
              sourceId: 'revision-store-mcdonalds-2',
              priority: 30,
            },
            blockVersionId: 'block-store-hero-preview',
          },
        ],
      },
    ],
    tombstones: [],
  },
  renderedPlacements: [
    {
      placementKey: 'primary-hero',
      order: 0,
      blockType: 'hero',
      blockVersionId: 'block-store-hero-preview',
      content: { headline: "Preview-only McDonald's Market" },
    },
  ],
};

describe('preview page view model', () => {
  test('merges rendered content with stable resolved identity and authoring provenance', () => {
    const page = createPreviewPageViewModel({
      scenarioId: 'stores',
      canonicalUrl: '/en-US/store/1001',
      draft,
    });

    expect(PreviewPageViewModelSchema.parse(page)).toEqual(page);
    expect(WebsitePageViewModelSchema.parse(page)).toEqual(page);
    expect(page.renderMode).toBe('preview');
    expect(page.editable).toBe(true);
    expect(page.placements[0]).toMatchObject({
      placementKey: 'primary-hero',
      blockVersionId: 'block-store-hero-preview',
      content: { headline: "Preview-only McDonald's Market" },
      provenance: {
        content: {
          kind: 'variant',
          sourceRevisionId: 'revision-store-mcdonalds-2',
          sourcePriority: 30,
        },
        order: {
          kind: 'default',
          sourceRevisionId: 'tpl-store:default:r1',
          sourcePriority: 0,
        },
      },
    });
  });

  test('rejects a rendered placement that does not match the resolved immutable version', () => {
    expect(() =>
      createPreviewPageViewModel({
        scenarioId: 'stores',
        canonicalUrl: '/en-US/store/1001',
        draft: {
          ...draft,
          renderedPlacements: [
            { ...draft.renderedPlacements[0], blockVersionId: 'unrelated-block-version' },
          ],
        },
      })
    ).toThrow('does not match its resolved authoring placement');
  });

  test('normalizes sparse resolved order values while preserving their exact provenance trace', () => {
    const footer = {
      placementKey: 'footer',
      order: 40,
      blockVersion: {
        id: 'block-store-footer-preview',
        blockType: 'footer',
      },
      provenance: {
        content: {
          kind: 'default' as const,
          sourceId: 'tpl-store:default:r1',
          priority: 0,
        },
        order: {
          kind: 'variant' as const,
          sourceId: 'revision-store-structural-order',
          priority: 20,
        },
      },
      trace: [
        {
          kind: 'order' as const,
          source: {
            kind: 'variant' as const,
            sourceId: 'revision-store-structural-order',
            priority: 20,
          },
          order: 40,
        },
      ],
    };
    const page = createPreviewPageViewModel({
      scenarioId: 'stores',
      canonicalUrl: '/en-US/store/1001',
      draft: {
        ...draft,
        document: {
          ...draft.document,
          placements: [...draft.document.placements, footer],
        },
        renderedPlacements: [
          ...draft.renderedPlacements,
          {
            placementKey: footer.placementKey,
            order: footer.order,
            blockType: footer.blockVersion.blockType,
            blockVersionId: footer.blockVersion.id,
            content: { legal: 'Preview terms' },
          },
        ],
      },
    });

    expect(page.placements.map((placement) => placement.order)).toEqual([0, 1]);
    expect(page.placements[1]?.provenance).toMatchObject({
      order: {
        sourceRevisionId: 'revision-store-structural-order',
        sourcePriority: 20,
      },
      trace: [
        {
          operationKind: 'order',
          order: 40,
        },
      ],
    });
  });
});

describe('preview request isolation', () => {
  test('uses a strict canonical-path-only request schema', () => {
    expect(PreviewPageRequestSchema.parse({ canonicalUrl: '/en-US/store/1001' })).toEqual({
      canonicalUrl: '/en-US/store/1001',
    });
    expect(
      PreviewPageRequestSchema.safeParse({
        canonicalUrl: '/en-US/store/1001',
        edit_mode: true,
      }).success
    ).toBe(false);
    expect(
      PreviewPageRequestSchema.safeParse({
        canonicalUrl: '/en-US/store/1001?edit_mode=true',
      }).success
    ).toBe(false);
  });

  test('accepts a percent-encoded canonical segment for a newly created template key', () => {
    const canonicalUrl = '/en-US/contributors/Jos%C3%A9%20Silva';
    expect(PreviewPageRequestSchema.parse({ canonicalUrl })).toEqual({ canonicalUrl });

    const page = createPreviewPageViewModel({
      scenarioId: 'author-profile',
      canonicalUrl,
      draft: { ...draft, page: { ...draft.page, canonicalUrl } },
    });
    expect(page.scenarioId).toBe('author-profile');
    expect(PreviewPageViewModelSchema.parse(page)).toEqual(page);
  });

  test('allows local development and fails closed in production until explicitly enabled', () => {
    const template = resolvePublicTemplate('/en-US/store/1001');
    if (!template) throw new Error('Expected the Store template.');

    expect(
      previewHostMatchesTemplate({
        host: 'localhost:3001',
        template,
        nodeEnv: 'development',
        previewEnabled: false,
      })
    ).toBe(true);
    expect(
      previewHostMatchesTemplate({
        host: 'www.ubereats.com',
        template,
        nodeEnv: 'production',
        previewEnabled: false,
      })
    ).toBe(false);
    expect(
      previewHostMatchesTemplate({
        host: 'www.ubereats.com',
        template,
        nodeEnv: undefined,
        previewEnabled: false,
      })
    ).toBe(false);
    expect(
      previewHostMatchesTemplate({
        host: 'www.ubereats.com',
        template,
        nodeEnv: 'production',
        previewEnabled: true,
      })
    ).toBe(true);
    expect(
      previewHostMatchesTemplate({
        host: 'www.uber.com',
        template,
        nodeEnv: 'production',
        previewEnabled: true,
      })
    ).toBe(false);
  });
});
