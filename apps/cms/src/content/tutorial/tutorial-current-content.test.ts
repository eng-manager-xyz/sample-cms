import { describe, expect, test } from 'bun:test';
import { parseTutorialCurriculum } from './tutorial-curriculum';
import tutorialPlan from './tutorial-plan.json';

const sourceFiles = ['chapters-1-3.md', 'chapters-4-6.md'] as const;
const sourceIds = ['chapters-1-3', 'chapters-4-6'] as const;
const markdownSources = await Promise.all(
  sourceFiles.map(async (filename, index) => ({
    id: sourceIds[index],
    markdown: await Bun.file(new URL(filename, import.meta.url)).text(),
  }))
);
const curriculum = parseTutorialCurriculum(tutorialPlan, markdownSources);
const currentContent = curriculum.chapters
  .flatMap((chapter) => chapter.sections)
  .map((section) => `${section.learningOutcome}\n${section.bodyMarkdown}\n${section.digestPrompt}`)
  .join('\n');

describe('current Auteur tutorial contract', () => {
  test('preserves the six-chapter, four-section progression and timing budget', () => {
    expect(curriculum.totals).toMatchObject({
      chapterCount: 6,
      sectionCount: 24,
      readingMinutes: 135,
      mediaMinutes: 19,
      digestMinutes: 61,
      scheduledMinutes: 215,
    });
    expect(curriculum.chapters.every((chapter) => chapter.sections.length === 4)).toBe(true);
  });

  test('teaches the standalone publication pipeline and all three executable routes', () => {
    expect(currentContent).toContain(
      'selector-driven authoring → atomic immutable publication → read-only public serve → synchronous block registry'
    );
    expect(currentContent).toContain('`apps/cms` runs on `http://localhost:3000`');
    expect(currentContent).toContain('`apps/website` runs on `http://localhost:3001`');
    expect(currentContent).toContain('PublishedDocumentSchema');
    expect(currentContent).toContain('CmsService.serve');
    expect(currentContent).toContain('1–2 SQLite reads and zero selector statements');

    for (const route of [
      '/en-US/eligible-vehicles/ca/premium',
      '/en-US/store/1001',
      '/en-US/airport/hero-alt',
    ]) {
      expect(currentContent).toContain(route);
    }
  });

  test('keeps published delivery isolated from explicit preview and the admin gateway', () => {
    expect(currentContent).toContain('/cms-preview_/<canonical-path>');
    expect(currentContent).toContain('Cache-Control: private, no-store');
    expect(currentContent).toContain('X-Robots-Tag: noindex, nofollow, noarchive');
    expect(currentContent).toContain('/en-US/store/1001?edit_mode=true');
    expect(currentContent).toContain('the query cannot elevate the request');
    expect(currentContent).toContain('CMS_ADMIN_ORIGIN');
    expect(currentContent).toContain('missing or malformed production configuration fails closed');
  });

  test('records donor boundaries, production limits, and the current Linear proof slice', () => {
    expect(currentContent).toContain('Median pull request 15');
    expect(currentContent).toContain('Profound');
    expect(currentContent).toContain('not a production authentication design');
    expect(currentContent).toContain('AUT-534');
    expect(currentContent).toContain('AUT-535');
    expect(currentContent).toContain('AUT-536');
    expect(currentContent).not.toContain('AUT-515 through AUT-532');
    expect(currentContent).not.toContain('AUT-514 through AUT-533');
  });
});
