import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PreviewPageViewModelSchema } from '@/data/preview-page';
import { PublishedPage } from './published-page';

const previewPage = PreviewPageViewModelSchema.parse({
  scenarioId: 'stores',
  templateId: 'tpl-store',
  pageId: 'page-store-1001',
  canonicalUrl: '/en-US/store/1001',
  resolutionHash: 'preview-resolution-hash',
  renderMode: 'preview',
  editable: true,
  matchedVariantRevisionIds: ['revision-store-mcdonalds-preview-only'],
  placements: [
    {
      placementKey: 'primary-hero',
      order: 0,
      blockType: 'hero',
      blockVersionId: 'block-store-hero-preview-only',
      content: { headline: 'An unpublished Store hero' },
      provenance: {
        content: {
          kind: 'variant',
          sourceRevisionId: 'revision-store-mcdonalds-preview-only',
          sourcePriority: 30,
        },
        order: {
          kind: 'default',
          sourceRevisionId: 'tpl-store:default:r1',
          sourcePriority: 0,
        },
        trace: [],
      },
    },
  ],
  tombstones: [],
});

describe('shared website block renderer', () => {
  test('renders preview placements through the registry without the publication-only drawer', () => {
    const markup = renderToStaticMarkup(<PublishedPage page={previewPage} />);

    expect(markup).toContain('data-cms-mode="preview"');
    expect(markup).toContain('data-cms-editable="true"');
    expect(markup).toContain('data-placement="primary-hero"');
    expect(markup).toContain('An unpublished Store hero');
    expect(markup).not.toContain('publication-drawer');
    expect(markup).not.toContain('Materialized publication');
  });
});
