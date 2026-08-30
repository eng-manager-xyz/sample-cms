import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TutorialStudyDeck } from './tutorial-study-deck';

describe('TutorialStudyDeck', () => {
  test('server-renders the first teach-back card and an accessible mastery summary', () => {
    const markup = renderToStaticMarkup(<TutorialStudyDeck />);

    expect(markup).toContain('Spaced retrieval lab · 12 teach-back cards');
    expect(markup).toContain('Practice re-explaining the architecture');
    expect(markup).toContain('From route to rendered page');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuemax="12"');
    expect(markup).toContain('aria-valuenow="0"');
    expect(markup).toContain('Private scratchpad · optional');
    expect(markup).toContain('Reveal model answer and rubric');
    expect(markup).toContain('never written to Auteur SQLite');
  });
});
