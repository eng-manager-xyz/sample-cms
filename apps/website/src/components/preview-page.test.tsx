import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PreviewPageViewModel } from '@/data/preview-page';
import { PreviewPage } from './preview-page';

const previewPage: PreviewPageViewModel = {
  scenarioId: 'stores',
  templateId: 'tpl-store',
  pageId: 'page-store-1001',
  canonicalUrl: '/en-US/store/1001',
  resolutionHash: 'draft-resolution-hash',
  renderMode: 'preview',
  editable: true,
  matchedVariantRevisionIds: ['revision-store-mcdonalds-preview'],
  placements: [
    {
      placementKey: 'primary-hero',
      order: 0,
      blockType: 'hero',
      blockVersionId: 'block-store-hero-preview',
      content: { headline: 'Preview-only store headline' },
      provenance: {
        content: {
          kind: 'variant',
          sourceRevisionId: 'revision-store-mcdonalds-preview',
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
};

describe('PreviewPage', () => {
  test('renders preview chrome around the shared placement registry', () => {
    const markup = renderToStaticMarkup(<PreviewPage page={previewPage} />);

    expect(markup).toContain('Unpublished authoring preview');
    expect(markup).toContain('Preview-only store headline');
    expect(markup).toContain('data-cms-mode="preview"');
    expect(markup).toContain('data-cms-editable="true"');
    expect(markup).toContain('data-placement="primary-hero"');
    expect(markup).toContain('href="/en-US/store/1001"');
    expect(markup).not.toContain('Publication provenance');
  });
});
