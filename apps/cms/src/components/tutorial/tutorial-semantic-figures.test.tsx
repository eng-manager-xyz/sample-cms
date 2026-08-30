import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CurrentCodeFlowFigure, TutorialSemanticFigures } from './tutorial-semantic-figures';

function renderFigures(): string {
  return renderToStaticMarkup(<TutorialSemanticFigures />);
}

describe('TutorialSemanticFigures', () => {
  test('traces the current executable code path without historical comparison framing', () => {
    const markup = renderToStaticMarkup(<CurrentCodeFlowFigure />);

    expect(markup).toContain('One repository, two applications, one publication boundary');
    expect(markup).toContain('aria-label="Current Auteur code path"');
    expect(markup).toContain('apps/cms/src/routes/templates.$templateId.tsx');
    expect(markup).toContain('apps/cms/src/server-functions/cms.functions.ts');
    expect(markup).toContain('packages/cms-service/src/cms-service.ts');
    expect(markup).toContain('packages/cms-db/src/schema/index.ts');
    expect(markup).toContain('apps/website/src/server-functions/published-page.functions.ts');
    expect(markup).toContain('apps/website/src/components/block-renderer.tsx');
    expect(markup).toContain('public serving evaluates no selectors');
    expect(markup).toContain('manifest mode replays bounded interpolation');
    expect(markup).not.toMatch(/legacy|route.tree|old world|median|profound|louvre/i);
  });

  test('renders two labelled figures with explanatory captions', () => {
    const markup = renderFigures();

    expect(markup.match(/<figure/g)).toHaveLength(2);
    expect(markup.match(/<figcaption/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="Auteur content anatomy and scenario comparison"');
    expect(markup).toContain('One address, one typed version, one explainable winner');
    expect(markup).toContain('How much of one effective page is decided locally?');

    const labelledByIds = [...markup.matchAll(/<figure[^>]+aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1]
    );
    const describedByIds = [...markup.matchAll(/<figure[^>]+aria-describedby="([^"]+)"/g)].map(
      (match) => match[1]
    );

    expect(new Set(labelledByIds).size).toBe(2);
    expect(new Set(describedByIds).size).toBe(2);
    for (const id of [...labelledByIds, ...describedByIds]) {
      expect(markup).toContain(`id="${id}"`);
    }
  });

  test('keeps placement, block, version, and provenance as separate visible concepts', () => {
    const markup = renderFigures();

    for (const label of ['Placement', 'Block', 'Version', 'Provenance']) {
      expect(markup).toContain(`>${label}<`);
    }
    expect(markup).toContain('primary-hero');
    expect(markup).toContain('hero_alt');
    expect(markup).toContain('structural-block:primary-hero:hero-alt-v1');
    expect(markup).toContain('hero-alt revision · set operation · priority 10');
    expect(markup).toContain('not the placement key');
  });

  test('renders the exact scenario ratios on one percentage scale', () => {
    const markup = renderFigures();

    expect(markup).toMatch(
      /<li[^>]*data-placement-surface="7"[^>]*data-locally-decided-placements="7"/
    );
    expect(markup).toMatch(
      /<li[^>]*data-placement-surface="4"[^>]*data-locally-decided-placements="3"/
    );
    expect(markup).toMatch(
      /<li[^>]*data-placement-surface="24"[^>]*data-locally-decided-placements="2"/
    );
    expect(markup).toContain('7 / 7 · 100%');
    expect(markup).toContain('3 / 4 · 75%');
    expect(markup).toContain('2 / 24 · 8.33%');
    expect(markup).toContain(
      'aria-label="Locally decided placements per effective page: Eligible 7 of 7, Store 3 of 4, Structural 2 of 24"'
    );
    expect(markup).toContain('Dense exact override');
    expect(markup).toContain('Sparse composition');
    expect(markup).toContain('Sparse type replacement');
    expect(markup).toContain('0 inherited positions');
    expect(markup).toContain('1 default position');
    expect(markup).toContain('22 unchanged default pointers');
    expect(markup).toContain('style="width:100%"');
    expect(markup).toContain('style="width:75%"');
    expect(markup).toContain('style="width:8.33%"');
    expect(markup).toContain('The resulting document has 23 visible placements');
    expect(markup).toContain('Multiple operations on one placement count once.');
    expect(markup).not.toContain('Local operations:');
  });

  test('provides a captioned data table with row and column headers', () => {
    const markup = renderFigures();

    expect(markup).toContain('<table');
    expect(markup).toContain('<caption');
    expect(markup).toContain(
      'Exact locally-decided-placement ratios for the representative effective page in each proof scenario'
    );
    expect(markup.match(/scope="col"/g)).toHaveLength(5);
    expect(markup.match(/scope="row"/g)).toHaveLength(3);
    expect(markup).toContain('Effective-page placement surface');
    expect(markup).toContain('Locally decided placements');
    expect(markup).toContain('Eligible is 7 / 7, Store is 3 / 4, and Structural is 2 / 24.');
  });
});
