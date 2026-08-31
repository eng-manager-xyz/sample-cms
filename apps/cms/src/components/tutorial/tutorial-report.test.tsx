import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { TutorialContents, TutorialReport } from '@/components/tutorial/tutorial-report';
import { tutorialCurriculum } from '@/content/tutorial/tutorial-content';

describe('AUT-557 tutorial contents rail', () => {
  test('renders an independently scrolling, accessible desktop rail in its expanded state', () => {
    const markup = renderToStaticMarkup(
      <TutorialContents
        chapters={tutorialCurriculum.chapters.slice(0, 1)}
        collapsed={false}
        onCollapsedChange={() => undefined}
      />
    );

    expect(markup).toContain('data-tutorial-contents-collapsed="false"');
    expect(markup).toContain('aria-labelledby="tutorial-contents-heading"');
    expect(markup).toContain('<h2 id="tutorial-contents-heading"');
    expect(markup).toContain('aria-controls="tutorial-contents-panel"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-label="Collapse tutorial contents"');
    expect(markup).toContain('!cursor-e-resize');
    expect(markup).toContain('xl:max-h-[calc(100dvh-88px)]');
    expect(markup).toContain('xl:overflow-y-auto');
    expect(markup).toContain('xl:overscroll-contain');
  });

  test('keeps the contents panel mounted and mobile-visible behind the collapsed desktop seam', () => {
    const markup = renderToStaticMarkup(
      <TutorialContents
        chapters={tutorialCurriculum.chapters.slice(0, 1)}
        collapsed
        onCollapsedChange={() => undefined}
      />
    );

    expect(markup).toContain('data-tutorial-contents-collapsed="true"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Expand tutorial contents"');
    expect(markup).toContain('!cursor-w-resize');
    expect(markup).toContain('id="tutorial-contents-panel"');
    expect(markup).toContain('xl:hidden');
    expect(markup).toContain('Trace the current system');
  });

  test('keeps contents first in the DOM while placing it in the right desktop column', () => {
    const markup = renderToStaticMarkup(
      <TutorialReport
        health={{
          healthy: true,
          schemaVersion: 1,
          templateCount: 3,
          pageCount: 42,
          publicationCount: 3,
          problems: [],
        }}
      />
    );
    const contentsIndex = markup.indexOf('id="tutorial-contents"');
    const reportIndex = markup.indexOf('aria-label="Architecture tutorial report"');

    expect(contentsIndex).toBeGreaterThan(-1);
    expect(reportIndex).toBeGreaterThan(contentsIndex);
    expect(markup).toContain('xl:grid-cols-[minmax(0,1fr)_280px]');
    expect(markup).toContain('xl:order-2 xl:sticky');
    expect(markup).toContain('space-y-8 xl:order-1');
    expect(markup).toContain('transition-[grid-template-columns]');
    expect(markup).toContain('motion-reduce:transition-none');
  });
});
