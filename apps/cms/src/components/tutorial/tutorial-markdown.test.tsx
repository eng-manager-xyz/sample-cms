import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseTutorialCurriculum } from '@/content/tutorial/tutorial-curriculum';
import tutorialPlan from '@/content/tutorial/tutorial-plan.json';
import { TutorialMarkdown } from './tutorial-markdown';

const sourceFiles = ['chapters-1-3.md', 'chapters-4-6.md'] as const;
const sourceIds = ['chapters-1-3', 'chapters-4-6'] as const;
const markdownSources = await Promise.all(
  sourceFiles.map(async (filename, index) => ({
    id: sourceIds[index],
    markdown: await Bun.file(new URL(`../../content/tutorial/${filename}`, import.meta.url)).text(),
  }))
);
const curriculum = parseTutorialCurriculum(tutorialPlan, markdownSources);

function renderMarkdown(markdown: string): string {
  return renderToStaticMarkup(createElement(TutorialMarkdown, { markdown }));
}

describe('TutorialMarkdown', () => {
  test('renders math as accessible KaTeX and keeps every tutorial equation valid', () => {
    const source = markdownSources.map(({ markdown }) => markdown).join('\n');
    expect(source.match(/^\$\$$/gm)).toHaveLength(36);
    expect(source).not.toMatch(/^\\[[\]]$/m);

    const renderedTutorial = curriculum.chapters
      .flatMap((chapter) => [
        chapter.introductionMarkdown,
        ...chapter.sections.map((section) => section.bodyMarkdown),
      ])
      .map(renderMarkdown)
      .join('\n');

    expect(renderedTutorial.match(/class="katex-display"/g)).toHaveLength(18);
    expect(renderedTutorial.match(/<math[^>]*display="block"/g)).toHaveLength(18);
    expect(renderedTutorial).not.toContain('mathcolor="#cc0000"');
    expect(renderedTutorial).not.toContain('style="color:#cc0000"');

    const inlineMath = renderMarkdown('The score is $x^2 + y^2$.');
    expect(inlineMath).toContain('<span class="katex">');
    expect(inlineMath).toContain('<annotation encoding="application/x-tex">x^2 + y^2</annotation>');
  });

  test('preserves Markdown semantics and exposes safe, explicit highlighting', () => {
    const markup = renderMarkdown(`# Display heading

**Strong**, *emphasized*, ==highlighted==, and ~~removed~~.

Inline \`==literal syntax==\` stays code.

> A semantic quotation.

| Layer | Purpose |
| --- | --- |
| Default | Inheritance |

Raw <mark>HTML stays text</mark>.`);

    expect(markup).toContain('<h1');
    expect(markup).toContain('font-display');
    expect(markup).toContain('<strong');
    expect(markup).toContain('<em');
    expect(markup).toContain('<mark');
    expect(markup).toContain('>highlighted</mark>');
    expect(markup).toContain('<del');
    expect(markup).toContain('<blockquote');
    expect(markup).toContain('font-serif');
    expect(markup).toContain('<table');
    expect(markup).toContain('<th');
    expect(markup).toContain('&lt;mark&gt;HTML stays text&lt;/mark&gt;');
    expect(markup).toContain('>==literal syntax==</code>');
    expect(markup.match(/<mark/g)).toHaveLength(1);
  });
});
