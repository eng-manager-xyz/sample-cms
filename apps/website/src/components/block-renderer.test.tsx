import { describe, expect, test } from 'bun:test';
import { PublishedDocumentSchema } from '@repo/cms-domain';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPublicPageViewModel } from '@/data/public-page';
import { PublishedBlock, UnknownBlock } from './block-renderer';
import { PublishedPage } from './published-page';

const knownBlockTypes = ['navigation', 'avatar', 'hero', 'hero_alt', 'promo', 'footer'];

const document = PublishedDocumentSchema.parse({
  templateId: 'structural-marketing',
  pageId: 'structural-page:hero-alt',
  placements: [
    {
      placementKey: 'primary-hero',
      order: 0,
      blockType: 'hero_alt',
      blockVersionId: 'structural-hero-v2',
      content: { headline: 'Plan your LAX pickup', mapAssetKey: 'lax-pickup-map' },
      provenance: {
        sourceRevisionId: 'structural-variant-r2',
        sourceOperationId: 'structural-hero-set',
        sourcePriority: 30,
      },
    },
    {
      placementKey: 'section-01',
      order: 1,
      blockType: 'promo',
      blockVersionId: 'structural-section-01-v1',
      content: { message: 'Default section 01' },
      provenance: {
        sourceRevisionId: 'structural-default-r1',
        sourceOperationId: 'structural-section-01-set',
        sourcePriority: 0,
      },
    },
    {
      placementKey: 'footer',
      order: 2,
      blockType: 'footer',
      blockVersionId: 'structural-footer-v1',
      content: { legal: 'Airport product terms' },
      provenance: {
        sourceRevisionId: 'structural-default-r1',
        sourceOperationId: 'structural-footer-set',
        sourcePriority: 0,
      },
    },
  ],
});

const page = createPublicPageViewModel({
  scenarioId: 'structural-proof',
  publicationId: 'structural-publication-1',
  canonicalUrl: '/en-US/airport/hero-alt',
  documentHash: 'structural-document-hash',
  document,
});

describe('published block registry', () => {
  test('covers every first-class block type available to published pages', () => {
    for (const blockType of knownBlockTypes) {
      const firstPlacement = page.placements.at(0);
      if (!firstPlacement) throw new Error('Expected a representative placement.');
      const markup = renderToStaticMarkup(
        <PublishedBlock
          page={page}
          placement={{ ...firstPlacement, placementKey: `proof-${blockType}`, blockType }}
        />
      );
      expect(markup).toContain(`data-placement="proof-${blockType}"`);
      expect(markup).not.toContain(`Unknown block: ${blockType}`);
    }
  });

  test('renders placements synchronously and preserves published order', () => {
    const markup = renderToStaticMarkup(<PublishedPage page={page} />);
    const heroIndex = markup.indexOf('data-placement="primary-hero"');
    const sectionIndex = markup.indexOf('data-placement="section-01"');
    const footerIndex = markup.indexOf('data-placement="footer"');

    expect(heroIndex).toBeGreaterThan(-1);
    expect(sectionIndex).toBeGreaterThan(heroIndex);
    expect(footerIndex).toBeGreaterThan(sectionIndex);
    expect(markup).toContain('Plan your LAX pickup');
    expect(markup).toContain('data-cms-mode="published"');
    expect(markup).toContain('data-cms-editable="false"');
    expect(markup).not.toContain('contenteditable');
  });

  test('keeps unknown block content visibly diagnosable', () => {
    const firstPlacement = page.placements.at(0);
    if (!firstPlacement) throw new Error('Expected a representative placement.');
    const unknownPlacement = {
      ...firstPlacement,
      placementKey: 'future-module',
      blockType: 'future_block',
      content: { headline: 'Do not hide me' },
    };
    const unknownMarkup = renderToStaticMarkup(
      <UnknownBlock page={page} placement={unknownPlacement} />
    );
    const dispatchedMarkup = renderToStaticMarkup(
      <PublishedBlock page={page} placement={unknownPlacement} />
    );

    expect(unknownMarkup).toContain('Unknown block: future_block');
    expect(unknownMarkup).toContain('Do not hide me');
    expect(dispatchedMarkup).toBe(unknownMarkup);
  });
});
