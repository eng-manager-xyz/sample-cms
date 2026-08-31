import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CMS_RENDERED_PAGE_CLASS, CmsRenderedBlock, CmsUnknownBlock } from './renderer';

const page = {
  scenarioId: 'structural-proof',
  canonicalUrl: '/en-US/airport/hero-alt',
  renderMode: 'preview',
} as const;

describe('shared CMS renderer', () => {
  test('exposes the stable document surface class and renders known blocks', () => {
    expect(CMS_RENDERED_PAGE_CLASS).toBe('cms-rendered-page');
    const markup = renderToStaticMarkup(
      <CmsRenderedBlock
        page={page}
        placement={{
          placementKey: 'primary-hero',
          order: 0,
          blockType: 'hero_alt',
          content: { headline: 'Plan your LAX pickup', mapAssetKey: 'lax-map' },
        }}
      />
    );

    expect(markup).toContain('data-placement="primary-hero"');
    expect(markup).toContain('Plan your LAX pickup');
    expect(markup).toContain('href="#details"');
    expect(markup).not.toContain('Unknown block');
  });

  test('keeps static authoring content semantic without exposing live navigation', () => {
    const markup = renderToStaticMarkup(
      <CmsRenderedBlock
        page={{ ...page, interactionMode: 'static' }}
        placement={{
          placementKey: 'primary-hero',
          order: 0,
          blockType: 'hero',
          content: { headline: 'Readable authoring content' },
        }}
      />
    );

    expect(markup).toContain('<h1>Readable authoring content</h1>');
    expect(markup).toContain('Explore this page');
    expect(markup).not.toContain('<a');
    expect(markup).not.toContain('href=');
  });

  test('keeps unknown content visible through direct and dispatched rendering', () => {
    const placement = {
      placementKey: 'future-module',
      order: 0,
      blockType: 'future_block',
      content: { headline: 'Do not hide me' },
    };
    const direct = renderToStaticMarkup(<CmsUnknownBlock page={page} placement={placement} />);
    const dispatched = renderToStaticMarkup(<CmsRenderedBlock page={page} placement={placement} />);

    expect(direct).toContain('Unknown block: future_block');
    expect(direct).toContain('Do not hide me');
    expect(dispatched).toBe(direct);
  });
});
