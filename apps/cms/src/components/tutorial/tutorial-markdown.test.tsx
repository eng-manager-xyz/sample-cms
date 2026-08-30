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
  test('marks every tutorial equation for accessible client-side MathJax SVG rendering', () => {
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

    expect(renderedTutorial.match(/mathjax-equation-display/g)).toHaveLength(18);
    expect(renderedTutorial.match(/role="math"/g)).toHaveLength(18);
    expect(renderedTutorial).not.toContain('class="katex');

    const inlineMath = renderMarkdown('The score is $x^2 + y^2$.');
    expect(inlineMath).toContain('class="mathjax-equation"');
    expect(inlineMath).toContain('aria-label="x^2 + y^2"');
    expect(inlineMath).toContain('data-tex="x^2 + y^2"');
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

  test('highlights fenced languages and classifies inline technical vocabulary', () => {
    const markup =
      renderMarkdown(`\`publications\`, \`document_manifests\`, \`PublishedDocumentSchema\`,
\`CmsService.serve(templateId, canonicalUrl)\`, \`CMS_ENABLE_PREVIEW=true\`, and \`docs/data-model.md\`.

\`\`\`sql
SELECT publication_id FROM document_manifests WHERE canonical_url = '/en-US/store/1001';
\`\`\`

\`\`\`typescript
const published = await service.serve(templateId, canonicalUrl);
\`\`\``);

    expect(markup).toContain('data-code-kind="identifier">publications</code>');
    expect(markup).toContain('data-code-kind="identifier">document_manifests</code>');
    expect(markup).toContain('data-code-kind="type">PublishedDocumentSchema</code>');
    expect(markup).toContain('data-code-kind="callable">CmsService.serve');
    expect(markup).toContain('data-code-kind="config">CMS_ENABLE_PREVIEW=true</code>');
    expect(markup).toContain('data-code-kind="path">docs/data-model.md</code>');
    expect(markup).toContain('data-language="SQL"');
    expect(markup).toContain('class="hljs-keyword">SELECT</span>');
    expect(markup).toContain('class="hljs-string">&#x27;/en-US/store/1001&#x27;</span>');
    expect(markup).toContain('data-language="TYPESCRIPT"');
    expect(markup).toContain('class="hljs-keyword">const</span>');
  });
});
