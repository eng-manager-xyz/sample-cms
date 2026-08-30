import { describe, expect, test } from 'bun:test';
import { parseTutorialCurriculum } from './tutorial-curriculum';
import { chapterQuestionnaires, teachBackCards } from './tutorial-learning';
import tutorialPlan from './tutorial-plan.json';

const sourceFiles = ['chapters-1-3.md', 'chapters-4-6.md'] as const;
const sourceIds = ['chapters-1-3', 'chapters-4-6'] as const;
const markdownSources = await Promise.all(
  sourceFiles.map(async (filename, index) => ({
    id: sourceIds[index],
    markdown: await Bun.file(new URL(filename, import.meta.url)).text(),
  }))
);
const presentationSources = await Promise.all(
  [
    '../../components/tutorial/tutorial-report.tsx',
    '../../components/tutorial/tutorial-media.tsx',
    '../../components/tutorial/tutorial-semantic-figures.tsx',
    '../../../public/media/tutorial/illustrations.manifest.json',
    '../../../public/media/tutorial/flows/manifest.json',
    '../../../public/media/tutorial/flows/store-authoring-v1.vtt',
    '../../../public/media/tutorial/flows/eligible-vehicles-authoring-v1.vtt',
    '../../../public/media/tutorial/flows/structural-replacement-authoring-v1.vtt',
    '../../../public/media/tutorial/flows/wall-navigation-v1.vtt',
  ].map((filename) => Bun.file(new URL(filename, import.meta.url)).text())
);
const curriculum = parseTutorialCurriculum(tutorialPlan, markdownSources);
const currentContent = curriculum.chapters
  .flatMap((chapter) => chapter.sections)
  .map((section) => `${section.learningOutcome}\n${section.bodyMarkdown}\n${section.digestPrompt}`)
  .join('\n');
const authoredCourseContent = [
  JSON.stringify(tutorialPlan),
  ...markdownSources.map(({ markdown }) => markdown),
  JSON.stringify(chapterQuestionnaires),
  JSON.stringify(teachBackCards),
].join('\n');
const completeTutorialSurface = [authoredCourseContent, ...presentationSources].join('\n');

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
    expect(currentContent).toContain('`bun run dev:cms`');
    expect(currentContent).toContain('`http://localhost:3000`');
    expect(currentContent).toContain('`bun run dev:website`');
    expect(currentContent).toContain('`http://localhost:3001`');
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

  test('grounds the course in concrete current-code boundaries', () => {
    for (const codePath of [
      'packages/cms-domain/src/selector.ts',
      'packages/cms-service/src/selector-sql.ts',
      'packages/cms-domain/src/interpolation.ts',
      'packages/cms-domain/src/resolution.ts',
      'packages/cms-domain/src/publication.ts',
      'packages/cms-domain/src/published-document.ts',
      'packages/cms-service/src/cms-service.ts',
      'apps/website/src/server-functions/published-page.functions.ts',
      'apps/website/src/components/block-renderer.tsx',
    ]) {
      expect(authoredCourseContent).toContain(codePath);
    }

    for (const executableName of [
      'evaluateSelector',
      'interpolateJson',
      'compilePublication',
      'PublishedDocumentSchema',
      'CmsService.serve',
    ]) {
      expect(authoredCourseContent).toContain(executableName);
    }
  });

  test('states the current selector, interpolation, publication, and serving behavior', () => {
    expect(authoredCourseContent).toMatch(/selector SQL[^.\n]*bounded preview only/i);
    expect(authoredCourseContent).toMatch(/publication[^.\n]*evaluateSelector/i);
    expect(authoredCourseContent).toContain('`{{ dotted.path }}`');
    expect(authoredCourseContent).toMatch(/interpolateJson[^.\n]*immutable page context/i);
    expect(authoredCourseContent).toMatch(/Expanded mode[^.\n]*stored rendered JSON/i);
    expect(authoredCourseContent).toMatch(
      /Manifest mode[^.\n]*calls? `?interpolateJson`?[^.\n]*immutable page context/i
    );
    expect(authoredCourseContent).toMatch(/PublishedDocumentSchema[^.\n]*visible placements/i);
    expect(authoredCourseContent).toMatch(/CmsService\.serve[^.\n]*active publication/i);
    expect(authoredCourseContent).toMatch(/one expanded read or two manifest reads/i);
    expect(authoredCourseContent).toMatch(/unpublished[^.\n]*404/i);
  });

  test('does not teach retired systems, donor history, or proposed production architecture', () => {
    const retiredTeaching = [
      /\bMedian\b/i,
      /route[- ]tree/i,
      /legacy (?:request|architecture|content system)/i,
      /old request path/i,
      /old world/i,
      /big[- ]bang/i,
      /transition architecture/i,
      /during the transition/i,
    ];
    const proposedProductionTeaching = [
      /\bTiDB\b/i,
      /TIDB-[A-Z]+-\d+/,
      /incremental publication/i,
      /chunked publication/i,
      /publication workers?/i,
      /100 MB chunks?/i,
      /hot[- ]key pressure/i,
      /production publication protocol/i,
      /background worker/i,
      /chunk worker/i,
      /checkpoint table/i,
      /incremental compiler/i,
      /alternate activation protocol/i,
      /\bOpen decision\b/i,
      /\bproduction (?:must|needs|still|cannot|will|would|should)\b/i,
      /\bproposed (?:serving|publication|schema|protocol)\b/i,
      /\bproduction readiness\b/i,
      /\bproduction SLO\b/i,
    ];

    for (const retiredPattern of [...retiredTeaching, ...proposedProductionTeaching]) {
      expect(completeTutorialSurface).not.toMatch(retiredPattern);
    }
  });
});
