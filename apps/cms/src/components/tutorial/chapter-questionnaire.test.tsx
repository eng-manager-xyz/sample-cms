import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChapterQuestionnaire } from './chapter-questionnaire';

describe('ChapterQuestionnaire', () => {
  test('renders the official questionnaire semantics for a tutorial chapter', () => {
    const markup = renderToStaticMarkup(<ChapterQuestionnaire chapterId="trace-current-system" />);

    expect(markup).toContain('<form');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('Retrieval checkpoint · 3 questions');
    expect(markup.match(/<fieldset/g)).toHaveLength(3);
    expect(markup.match(/<input[^>]+type="radio"/g)).toHaveLength(9);
    expect(markup).toContain('name="chapter-1-server-boundary"');
    expect(markup).toContain('aria-keyshortcuts="A"');
    expect(markup).toContain('Check understanding');
  });

  test('does not invent a questionnaire for an unknown chapter', () => {
    expect(renderToStaticMarkup(<ChapterQuestionnaire chapterId="unknown" />)).toBe('');
  });
});
