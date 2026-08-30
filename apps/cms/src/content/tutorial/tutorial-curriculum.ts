import * as z from 'zod';

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const SectionNumberSchema = z.string().regex(/^\d+\.\d+$/);

const TutorialPlanSectionBaseSchema = z.object({
  id: SlugSchema,
  number: SectionNumberSchema,
  title: z.string().trim().min(1),
  readMinutes: z.int().min(0).max(30),
  mediaMinutes: z.int().min(0),
  digestMinutes: z.int().min(0),
  prerequisite: SectionNumberSchema.nullable(),
  visual: SlugSchema,
});

const TutorialPlanSectionSchema = TutorialPlanSectionBaseSchema.refine(
  (section) => section.readMinutes + section.mediaMinutes + section.digestMinutes <= 30,
  { message: 'a tutorial section may schedule at most 30 minutes' }
);

const TutorialPlanChapterSchema = z.object({
  id: SlugSchema,
  number: z.int().positive(),
  title: z.string().trim().min(1),
  kicker: z.string().trim().min(1),
  sections: z.array(TutorialPlanSectionSchema).length(4),
});

export const TutorialPlanSchema = z
  .object({
    title: z.string().trim().min(1),
    subtitle: z.string().trim().min(1),
    audience: z.string().trim().min(1),
    readingSpeedWordsPerMinute: z.int().positive(),
    totalBudgetMinutes: z.int().positive().max(180),
    chapters: z.array(TutorialPlanChapterSchema).min(1),
  })
  .superRefine((plan, context) => {
    const continuousMinutes = plan.chapters.reduce(
      (planTotal, chapter) =>
        planTotal +
        chapter.sections.reduce(
          (chapterTotal, section) => chapterTotal + section.readMinutes + section.mediaMinutes,
          0
        ),
      0
    );
    if (continuousMinutes > plan.totalBudgetMinutes) {
      context.addIssue({
        code: 'custom',
        message: `continuous reading and media total ${continuousMinutes} minutes exceeds the ${plan.totalBudgetMinutes}-minute budget`,
        path: ['totalBudgetMinutes'],
      });
    }
  });

const TutorialMarkdownSourceSchema = z.object({
  id: SlugSchema,
  markdown: z.string().min(1),
});

const TutorialSectionSchema = z.object({
  ...TutorialPlanSectionBaseSchema.shape,
  prerequisiteId: SlugSchema.nullable(),
  markdownHeadingTitle: z.string().trim().min(1),
  learningOutcome: z.string().trim().min(1),
  bodyMarkdown: z.string().trim().min(1),
  digestPrompt: z.string().trim().min(1),
  wordCount: z.int().min(1),
});

const TutorialChapterSchema = z.object({
  id: SlugSchema,
  number: z.int().positive(),
  title: z.string().trim().min(1),
  kicker: z.string().trim().min(1),
  markdownHeadingTitle: z.string().trim().min(1),
  introductionMarkdown: z.string(),
  sourceId: SlugSchema,
  sections: z.array(TutorialSectionSchema).length(4),
});

const TutorialCurriculumSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  readingSpeedWordsPerMinute: z.int().positive(),
  totalBudgetMinutes: z.int().positive().max(180),
  totals: z.object({
    chapterCount: z.int().positive(),
    sectionCount: z.int().positive(),
    readingMinutes: z.int().min(0),
    mediaMinutes: z.int().min(0),
    digestMinutes: z.int().min(0),
    scheduledMinutes: z.int().min(0),
    wordCount: z.int().min(1),
  }),
  chapters: z.array(TutorialChapterSchema).min(1),
});

type TutorialPlan = z.infer<typeof TutorialPlanSchema>;
export type TutorialSection = z.infer<typeof TutorialSectionSchema>;
export type TutorialChapter = z.infer<typeof TutorialChapterSchema>;
export type TutorialCurriculum = z.infer<typeof TutorialCurriculumSchema>;

interface ParsedMarkdownSection {
  number: string;
  title: string;
  markdown: string;
}

interface ParsedMarkdownChapter {
  number: number;
  title: string;
  introductionMarkdown: string;
  sourceId: string;
  sections: ParsedMarkdownSection[];
}

interface MutableMarkdownSection {
  number: string;
  title: string;
  lines: string[];
}

interface MutableMarkdownChapter {
  number: number;
  title: string;
  introductionLines: string[];
  sourceId: string;
  sections: ParsedMarkdownSection[];
}

interface ExtractedSectionMarkdown {
  learningOutcome: string;
  bodyMarkdown: string;
  digestPrompt: string;
}

const chapterHeadingPattern = /^#\s+Chapter\s+(\d+)(?:\s+[—-]\s+|\s+)(.+?)\s*$/i;
const sectionHeadingPattern = /^##\s+(\d+\.\d+)(?:\s+[—-]\s+|\s+)(.+?)\s*$/;
const timePattern =
  /^>\s*\*\*Estimated time:\*\*\s*Read\s+(\d+)\s+min\s+·\s+Media\s+(\d+)\s+min\s+·\s+Digest\s+(\d+)\s+min\s*$/;
const outcomePattern = /^>\s*\*\*Learning outcome:\*\*\s*(.+?)\s*$/;
const digestPattern = /^(?:>\s*)?\*\*Digest prompt:\*\*\s*(.+?)\s*$/;

function curriculumError(message: string): never {
  throw new Error(`Tutorial curriculum: ${message}`);
}

function addContentLine(
  line: string,
  chapter: MutableMarkdownChapter | null,
  section: MutableMarkdownSection | null
): void {
  if (section) {
    section.lines.push(line);
    return;
  }
  if (chapter) {
    chapter.introductionLines.push(line);
    return;
  }
  if (line.trim().length > 0) {
    curriculumError('content appears before the first chapter heading');
  }
}

function parseMarkdownSource(source: z.infer<typeof TutorialMarkdownSourceSchema>) {
  const chapters: ParsedMarkdownChapter[] = [];
  const lines = source.markdown.replace(/\r\n?/g, '\n').split('\n');
  let currentChapter: MutableMarkdownChapter | null = null;
  let currentSection: MutableMarkdownSection | null = null;
  let fenceCharacter: '`' | '~' | null = null;

  function finishSection(): void {
    if (!currentSection) return;
    if (!currentChapter) {
      curriculumError(`section ${currentSection.number} in ${source.id} has no chapter`);
    }
    currentChapter.sections.push({
      number: currentSection.number,
      title: currentSection.title,
      markdown: currentSection.lines.join('\n').trim(),
    });
    currentSection = null;
  }

  function finishChapter(): void {
    if (!currentChapter) return;
    finishSection();
    chapters.push({
      number: currentChapter.number,
      title: currentChapter.title,
      introductionMarkdown: currentChapter.introductionLines.join('\n').trim(),
      sourceId: currentChapter.sourceId,
      sections: currentChapter.sections,
    });
    currentChapter = null;
  }

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const nextFenceCharacter = fenceMatch[1]?.[0];
      addContentLine(line, currentChapter, currentSection);
      if (nextFenceCharacter === '`' || nextFenceCharacter === '~') {
        if (fenceCharacter === null) fenceCharacter = nextFenceCharacter;
        else if (fenceCharacter === nextFenceCharacter) fenceCharacter = null;
      }
      continue;
    }

    if (fenceCharacter === null) {
      const chapterMatch = line.match(chapterHeadingPattern);
      if (chapterMatch) {
        const chapterNumber = Number.parseInt(chapterMatch[1] ?? '', 10);
        const title = chapterMatch[2]?.trim();
        if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 1 || !title) {
          curriculumError(`invalid chapter heading in ${source.id}: ${line}`);
        }
        finishChapter();
        currentChapter = {
          number: chapterNumber,
          title,
          introductionLines: [],
          sourceId: source.id,
          sections: [],
        };
        continue;
      }

      const sectionMatch = line.match(sectionHeadingPattern);
      if (sectionMatch) {
        if (!currentChapter) {
          curriculumError(`section heading appears before a chapter in ${source.id}: ${line}`);
        }
        const number = sectionMatch[1];
        const title = sectionMatch[2]?.trim();
        if (!number || !title) {
          curriculumError(`invalid section heading in ${source.id}: ${line}`);
        }
        finishSection();
        currentSection = { number, title, lines: [] };
        continue;
      }
    }

    addContentLine(line, currentChapter, currentSection);
  }

  if (fenceCharacter !== null) {
    curriculumError(`unclosed Markdown fence in ${source.id}`);
  }
  finishChapter();
  if (chapters.length === 0) {
    curriculumError(`${source.id} contains no chapter headings`);
  }
  return chapters;
}

function extractSectionMarkdown(
  section: z.infer<typeof TutorialPlanSectionSchema>,
  markdown: string
): ExtractedSectionMarkdown {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const timeMatch = lines[0]?.match(timePattern);
  const outcomeMatch = lines[1]?.match(outcomePattern);
  if (!timeMatch || !outcomeMatch) {
    curriculumError(
      `section ${section.number} must begin with Estimated time and Learning outcome blockquotes`
    );
  }

  const markdownTimes = [timeMatch[1], timeMatch[2], timeMatch[3]].map((value) =>
    Number.parseInt(value ?? '', 10)
  );
  const expectedTimes = [section.readMinutes, section.mediaMinutes, section.digestMinutes];
  if (markdownTimes.some((value, index) => value !== expectedTimes[index])) {
    curriculumError(
      `section ${section.number} timing differs between tutorial-plan.json and Markdown`
    );
  }

  let bodyStart = 2;
  while (lines[bodyStart]?.trim() === '') bodyStart += 1;

  let digestIndex = lines.length - 1;
  while (digestIndex >= bodyStart && lines[digestIndex]?.trim() === '') digestIndex -= 1;
  const digestMatch = lines[digestIndex]?.match(digestPattern);
  if (!digestMatch?.[1]) {
    curriculumError(`section ${section.number} must end with a Digest prompt`);
  }

  const bodyMarkdown = lines.slice(bodyStart, digestIndex).join('\n').trim();
  if (bodyMarkdown.length === 0) {
    curriculumError(`section ${section.number} has no body Markdown`);
  }

  return {
    learningOutcome: outcomeMatch[1]?.trim() ?? curriculumError('missing learning outcome'),
    bodyMarkdown,
    digestPrompt: digestMatch[1].trim(),
  };
}

function countMarkdownWords(markdown: string): number {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/[[\]()*_#>|]/g, ' ');
  return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
}

function validatePlanOrder(plan: TutorialPlan): Map<string, string> {
  const chapterIds = new Set<string>();
  const sectionIds = new Set<string>();
  const sectionNumbers = new Map<string, string>();
  let sectionIndex = 0;
  const indexesByNumber = new Map<string, number>();

  plan.chapters.forEach((chapter, chapterIndex) => {
    if (chapter.number !== chapterIndex + 1) {
      curriculumError(`chapter ${chapter.id} must have sequential number ${chapterIndex + 1}`);
    }
    if (chapterIds.has(chapter.id)) curriculumError(`duplicate chapter id ${chapter.id}`);
    chapterIds.add(chapter.id);

    chapter.sections.forEach((section, chapterSectionIndex) => {
      const expectedNumber = `${chapter.number}.${chapterSectionIndex + 1}`;
      if (section.number !== expectedNumber) {
        curriculumError(`section ${section.id} must have sequential number ${expectedNumber}`);
      }
      if (sectionIds.has(section.id)) curriculumError(`duplicate section id ${section.id}`);
      if (sectionNumbers.has(section.number)) {
        curriculumError(`duplicate section number ${section.number}`);
      }
      sectionIds.add(section.id);
      sectionNumbers.set(section.number, section.id);
      indexesByNumber.set(section.number, sectionIndex);
      sectionIndex += 1;
    });
  });

  const orderedSections = plan.chapters.flatMap((chapter) => chapter.sections);
  for (const [orderedIndex, section] of orderedSections.entries()) {
    if (section.prerequisite) {
      const prerequisiteIndex = indexesByNumber.get(section.prerequisite);
      const currentIndex = indexesByNumber.get(section.number);
      if (prerequisiteIndex === undefined) {
        curriculumError(
          `section ${section.number} references unknown prerequisite ${section.prerequisite}`
        );
      }
      if (currentIndex === undefined || prerequisiteIndex >= currentIndex) {
        curriculumError(
          `section ${section.number} prerequisite ${section.prerequisite} must appear earlier`
        );
      }
    }

    const immediatelyPrevious = orderedSections[orderedIndex - 1];
    if (!immediatelyPrevious && section.prerequisite !== null) {
      curriculumError(
        `section ${section.number} is the starting point and must have no prerequisite`
      );
    }
    if (immediatelyPrevious && section.prerequisite !== immediatelyPrevious.number) {
      curriculumError(
        `section ${section.number} must reference immediately preceding section ${immediatelyPrevious.number}`
      );
    }
  }

  return sectionNumbers;
}

export function parseTutorialCurriculum(
  planInput: unknown,
  markdownSourcesInput: unknown
): TutorialCurriculum {
  const plan = TutorialPlanSchema.parse(planInput);
  const markdownSources = z.array(TutorialMarkdownSourceSchema).min(1).parse(markdownSourcesInput);
  const sectionIdsByNumber = validatePlanOrder(plan);
  const parsedChapters = markdownSources.flatMap(parseMarkdownSource);
  const parsedByNumber = new Map<number, ParsedMarkdownChapter>();

  for (const chapter of parsedChapters) {
    if (parsedByNumber.has(chapter.number)) {
      curriculumError(`chapter ${chapter.number} appears in more than one Markdown source`);
    }
    parsedByNumber.set(chapter.number, chapter);
  }

  if (parsedByNumber.size !== plan.chapters.length) {
    curriculumError(
      `tutorial-plan.json declares ${plan.chapters.length} chapters but Markdown contains ${parsedByNumber.size}`
    );
  }

  const chapters = plan.chapters.map((chapterPlan) => {
    const parsedChapter = parsedByNumber.get(chapterPlan.number);
    if (!parsedChapter) curriculumError(`chapter ${chapterPlan.number} is missing from Markdown`);

    const parsedSectionsByNumber = new Map<string, ParsedMarkdownSection>();
    for (const section of parsedChapter.sections) {
      if (parsedSectionsByNumber.has(section.number)) {
        curriculumError(`section ${section.number} appears more than once in Markdown`);
      }
      parsedSectionsByNumber.set(section.number, section);
    }
    if (parsedSectionsByNumber.size !== chapterPlan.sections.length) {
      curriculumError(
        `chapter ${chapterPlan.number} declares ${chapterPlan.sections.length} sections but Markdown contains ${parsedSectionsByNumber.size}`
      );
    }

    const sections = chapterPlan.sections.map((sectionPlan) => {
      const parsedSection = parsedSectionsByNumber.get(sectionPlan.number);
      if (!parsedSection) curriculumError(`section ${sectionPlan.number} is missing from Markdown`);
      const extracted = extractSectionMarkdown(sectionPlan, parsedSection.markdown);
      const wordCount = countMarkdownWords(
        `${extracted.learningOutcome}\n${extracted.bodyMarkdown}\n${extracted.digestPrompt}`
      );
      return {
        ...sectionPlan,
        prerequisiteId: sectionPlan.prerequisite
          ? (sectionIdsByNumber.get(sectionPlan.prerequisite) ?? null)
          : null,
        markdownHeadingTitle: parsedSection.title,
        ...extracted,
        wordCount,
      };
    });

    const expectedSectionNumbers = new Set(chapterPlan.sections.map((section) => section.number));
    for (const parsedSection of parsedChapter.sections) {
      if (!expectedSectionNumbers.has(parsedSection.number)) {
        curriculumError(
          `Markdown contains unplanned section ${parsedSection.number} in chapter ${chapterPlan.number}`
        );
      }
    }

    return {
      id: chapterPlan.id,
      number: chapterPlan.number,
      title: chapterPlan.title,
      kicker: chapterPlan.kicker,
      markdownHeadingTitle: parsedChapter.title,
      introductionMarkdown: parsedChapter.introductionMarkdown,
      sourceId: parsedChapter.sourceId,
      sections,
    };
  });

  const allSections = chapters.flatMap((chapter) => chapter.sections);
  const readingMinutes = allSections.reduce((total, section) => total + section.readMinutes, 0);
  const mediaMinutes = allSections.reduce((total, section) => total + section.mediaMinutes, 0);
  const digestMinutes = allSections.reduce((total, section) => total + section.digestMinutes, 0);
  const wordCount = allSections.reduce((total, section) => total + section.wordCount, 0);

  return TutorialCurriculumSchema.parse({
    title: plan.title,
    subtitle: plan.subtitle,
    audience: plan.audience,
    readingSpeedWordsPerMinute: plan.readingSpeedWordsPerMinute,
    totalBudgetMinutes: plan.totalBudgetMinutes,
    totals: {
      chapterCount: chapters.length,
      sectionCount: allSections.length,
      readingMinutes,
      mediaMinutes,
      digestMinutes,
      scheduledMinutes: readingMinutes + mediaMinutes + digestMinutes,
      wordCount,
    },
    chapters,
  });
}
