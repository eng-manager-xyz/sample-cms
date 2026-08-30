import { describe, expect, test } from 'bun:test';
import { parseTutorialCurriculum, TutorialPlanSchema } from './tutorial-curriculum';

const firstSectionPlan = {
  id: 'first-section',
  number: '1.1',
  title: 'First section',
  readMinutes: 2,
  mediaMinutes: 1,
  digestMinutes: 1,
  prerequisite: null,
  visual: 'first-visual',
};

const secondSectionPlan = {
  id: 'second-section',
  number: '1.2',
  title: 'Second section',
  readMinutes: 3,
  mediaMinutes: 0,
  digestMinutes: 2,
  prerequisite: '1.1',
  visual: 'second-visual',
};

const thirdSectionPlan = {
  id: 'third-section',
  number: '1.3',
  title: 'Third section',
  readMinutes: 2,
  mediaMinutes: 1,
  digestMinutes: 1,
  prerequisite: '1.2',
  visual: 'third-visual',
};

const fourthSectionPlan = {
  id: 'fourth-section',
  number: '1.4',
  title: 'Fourth section',
  readMinutes: 2,
  mediaMinutes: 1,
  digestMinutes: 0,
  prerequisite: '1.3',
  visual: 'fourth-visual',
};

const firstChapterPlan = {
  id: 'first-chapter',
  number: 1,
  title: 'First chapter',
  kicker: 'Model → proof',
  sections: [firstSectionPlan, secondSectionPlan, thirdSectionPlan, fourthSectionPlan],
};

const plan = {
  title: 'Test tutorial',
  subtitle: 'A test curriculum',
  audience: 'Reviewers',
  readingSpeedWordsPerMinute: 190,
  totalBudgetMinutes: 12,
  chapters: [firstChapterPlan],
};

const markdown = `# Chapter 1 — First chapter

An introductory sentence.

## 1.1 — First section with a longer heading

> **Estimated time:** Read 2 min · Media 1 min · Digest 1 min
> **Learning outcome:** Explain the first concept.

The first body includes a fenced example that must not become a heading.

\`\`\`text
# Chapter 99 — Not a real chapter
## 99.1 — Not a real section
\`\`\`

**Digest prompt:** Restate the first concept.

## 1.2 Second section

> **Estimated time:** Read 3 min · Media 0 min · Digest 2 min
> **Learning outcome:** Apply the second concept.

The second body follows the first prerequisite.

> **Digest prompt:** Connect the two concepts.

## 1.3 — Third section

> **Estimated time:** Read 2 min · Media 1 min · Digest 1 min
> **Learning outcome:** Extend the concept without backtracking.

The third body advances from the second section.

**Digest prompt:** Name the new capability.

## 1.4 — Fourth section

> **Estimated time:** Read 2 min · Media 1 min · Digest 0 min
> **Learning outcome:** Complete the chapter's reasoning chain.

The fourth body closes the chapter.

**Digest prompt:** Summarize the complete chain.`;

describe('tutorial curriculum parser', () => {
  test('joins the typed plan to Markdown sections and derives transparent totals', () => {
    const curriculum = parseTutorialCurriculum(plan, [{ id: 'test-source', markdown }]);

    expect(curriculum).toMatchObject({
      title: 'Test tutorial',
      totalBudgetMinutes: 12,
      totals: {
        chapterCount: 1,
        sectionCount: 4,
        readingMinutes: 9,
        mediaMinutes: 3,
        digestMinutes: 4,
        scheduledMinutes: 16,
      },
    });
    expect(curriculum.chapters[0]?.introductionMarkdown).toBe('An introductory sentence.');
    expect(curriculum.chapters[0]?.sections[0]).toMatchObject({
      id: 'first-section',
      markdownHeadingTitle: 'First section with a longer heading',
      learningOutcome: 'Explain the first concept.',
      digestPrompt: 'Restate the first concept.',
      prerequisiteId: null,
    });
    expect(curriculum.chapters[0]?.sections[1]?.prerequisiteId).toBe('first-section');
    expect(curriculum.chapters[0]?.sections[0]?.bodyMarkdown).toContain(
      '# Chapter 99 — Not a real chapter'
    );
  });

  test('does not count display, inline, or legacy-delimited TeX as prose', () => {
    const baseline = parseTutorialCurriculum(plan, [{ id: 'test-source', markdown }]);
    const texOnly = String.raw`$$
M_v = \{p \in P_T \mid S_v(p)=\text{true}\}
$$

$S_v(p)=\text{true}$

\(R_T(p)\)

\[
\operatorname{Serve}_T(u)=\Pi_{C(T)}[u]
    \]`;
    const withTex = markdown.replace(
      'The first body includes a fenced example',
      () => `${texOnly}\n\nThe first body includes a fenced example`
    );
    const curriculum = parseTutorialCurriculum(plan, [{ id: 'test-source', markdown: withTex }]);

    expect(curriculum.chapters[0]?.sections[0]?.wordCount).toBe(
      baseline.chapters[0]?.sections[0]?.wordCount
    );
    expect(curriculum.totals.wordCount).toBe(baseline.totals.wordCount);
  });

  test('rejects Markdown timing that drifts from the plan', () => {
    expect(() =>
      parseTutorialCurriculum(plan, [
        { id: 'test-source', markdown: markdown.replace('Read 2 min', 'Read 9 min') },
      ])
    ).toThrow('section 1.1 timing differs');
  });

  test('rejects a missing planned Markdown section', () => {
    const truncated = markdown.slice(0, markdown.indexOf('## 1.4'));
    expect(() =>
      parseTutorialCurriculum(plan, [{ id: 'test-source', markdown: truncated }])
    ).toThrow('declares 4 sections but Markdown contains 3');
  });

  test('rejects an unknown prerequisite at the plan boundary', () => {
    const invalidPlan = {
      ...plan,
      chapters: [
        {
          ...firstChapterPlan,
          sections: [
            firstSectionPlan,
            { ...secondSectionPlan, prerequisite: '9.9' },
            thirdSectionPlan,
            fourthSectionPlan,
          ],
        },
      ],
    };
    expect(() => parseTutorialCurriculum(invalidPlan, [{ id: 'test-source', markdown }])).toThrow(
      'references unknown prerequisite 9.9'
    );
  });

  test('exposes Zod validation for malformed plan inputs', () => {
    const result = TutorialPlanSchema.safeParse({ ...plan, readingSpeedWordsPerMinute: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['readingSpeedWordsPerMinute']);
    }
  });

  test('requires exactly four sections in every chapter', () => {
    const result = TutorialPlanSchema.safeParse({
      ...plan,
      chapters: [{ ...firstChapterPlan, sections: firstChapterPlan.sections.slice(0, 3) }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['chapters', 0, 'sections']);
    }
  });

  test('caps each complete section schedule at 30 minutes', () => {
    const result = TutorialPlanSchema.safeParse({
      ...plan,
      chapters: [
        {
          ...firstChapterPlan,
          sections: [
            { ...firstSectionPlan, readMinutes: 28, mediaMinutes: 2, digestMinutes: 1 },
            secondSectionPlan,
            thirdSectionPlan,
            fourthSectionPlan,
          ],
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('at most 30 minutes');
    }
  });

  test('caps the uninterrupted reading and media path at its declared three-hour-or-less budget', () => {
    const result = TutorialPlanSchema.safeParse({ ...plan, totalBudgetMinutes: 11 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['totalBudgetMinutes'],
        message: 'continuous reading and media total 12 minutes exceeds the 11-minute budget',
      });
    }
    expect(TutorialPlanSchema.safeParse({ ...plan, totalBudgetMinutes: 181 }).success).toBe(false);
  });

  test('requires every section to depend on the immediately preceding section', () => {
    const backtrackingPlan = {
      ...plan,
      chapters: [
        {
          ...firstChapterPlan,
          sections: [
            firstSectionPlan,
            secondSectionPlan,
            thirdSectionPlan,
            { ...fourthSectionPlan, prerequisite: '1.2' },
          ],
        },
      ],
    };
    expect(() =>
      parseTutorialCurriculum(backtrackingPlan, [{ id: 'test-source', markdown }])
    ).toThrow('section 1.4 must reference immediately preceding section 1.3');
  });
});
