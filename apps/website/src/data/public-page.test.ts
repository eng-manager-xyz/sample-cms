import { describe, expect, test } from 'bun:test';
import { PublishedDocumentSchema } from '@repo/cms-domain';
import { createPublicPageViewModel, PublicPageViewModelSchema } from './public-page';

const representativeDocument = PublishedDocumentSchema.parse({
  templateId: 'tpl-store',
  pageId: 'page-store-1001',
  placements: [
    {
      placementKey: 'navigation',
      order: 0,
      blockType: 'navigation',
      blockVersionId: 'block-navigation-v1',
      content: { label: 'Uber Eats' },
      provenance: {
        sourceRevisionId: 'default-r1',
        sourceOperationId: 'operation-default-navigation',
        sourcePriority: 0,
      },
    },
    {
      placementKey: 'primary-hero',
      order: 1,
      blockType: 'hero',
      blockVersionId: 'block-hero-v2',
      content: { headline: "Buy now McDonald's Market — San Francisco" },
      provenance: {
        sourceRevisionId: 'revision-brand-r1',
        sourceOperationId: 'operation-brand-hero',
        sourcePriority: 30,
      },
    },
    {
      placementKey: 'category-promo',
      order: 2,
      blockType: 'promo',
      blockVersionId: 'block-promo-v2',
      content: { message: 'Fast-food deals' },
      provenance: {
        sourceRevisionId: 'revision-category-r1',
        sourceOperationId: 'operation-category-promo',
        sourcePriority: 20,
      },
    },
    {
      placementKey: 'footer',
      order: 3,
      blockType: 'footer',
      blockVersionId: 'block-footer-v1',
      content: { legal: 'Chain-store terms' },
      provenance: {
        sourceRevisionId: 'revision-chain-r1',
        sourceOperationId: 'operation-chain-footer',
        sourcePriority: 10,
      },
    },
  ],
});

describe('published page view model', () => {
  test('creates a serializable, published-only view model in placement order', () => {
    const page = createPublicPageViewModel({
      scenarioId: 'stores',
      publicationId: 'publication-store-1',
      canonicalUrl: '/en-US/store/1001',
      documentHash: 'hash-store-1001',
      document: representativeDocument,
    });

    expect(PublicPageViewModelSchema.parse(page)).toEqual(page);
    expect(page.renderMode).toBe('published');
    expect(page.editable).toBe(false);
    expect(page.placements.map((placement) => placement.placementKey)).toEqual([
      'navigation',
      'primary-hero',
      'category-promo',
      'footer',
    ]);
    expect(page.placements[1]?.provenance).toEqual({
      sourceRevisionId: 'revision-brand-r1',
      sourceOperationId: 'operation-brand-hero',
      sourcePriority: 30,
    });
  });

  test('accepts a newly created template key as the presentation identifier', () => {
    const page = createPublicPageViewModel({
      scenarioId: 'author-profile',
      publicationId: 'publication-author-profile-1',
      canonicalUrl: '/en-US/contributors/avery',
      documentHash: 'hash-author-profile-1',
      document: representativeDocument,
    });

    expect(page.scenarioId).toBe('author-profile');
    expect(PublicPageViewModelSchema.parse(page)).toEqual(page);
  });
});
