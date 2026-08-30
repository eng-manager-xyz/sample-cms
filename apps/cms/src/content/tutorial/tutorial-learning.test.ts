import { describe, expect, test } from 'bun:test';
import {
  ChapterQuestionnaireSchema,
  ComprehensionQuestionSchema,
  chapterQuestionnaires,
  scoreQuestionnaire,
  scoreTeachBack,
  TeachBackCardSchema,
  TutorialLearningContentSchema,
  teachBackCards,
  tutorialLearningCardIds,
} from './tutorial-learning';
import tutorialPlan from './tutorial-plan.json';

describe('tutorial learning content', () => {
  test('provides three comprehension questions and two teach-back cards per chapter', () => {
    expect(chapterQuestionnaires).toHaveLength(6);
    expect(teachBackCards).toHaveLength(12);

    for (const [index, questionnaire] of chapterQuestionnaires.entries()) {
      const chapterNumber = index + 1;
      expect(questionnaire.chapterNumber).toBe(chapterNumber);
      expect(questionnaire.questions).toHaveLength(3);
      expect(teachBackCards.filter((card) => card.chapterNumber === chapterNumber)).toHaveLength(2);
    }
  });

  test('uses globally unique stable IDs for all thirty scheduled learning cards', () => {
    expect(tutorialLearningCardIds).toHaveLength(30);
    expect(new Set(tutorialLearningCardIds).size).toBe(tutorialLearningCardIds.length);
  });

  test('maps every learning item back to a current tutorial chapter and section', () => {
    const chapters = new Map(tutorialPlan.chapters.map((chapter) => [chapter.id, chapter]));

    for (const questionnaire of chapterQuestionnaires) {
      const chapter = chapters.get(questionnaire.chapterId);
      expect(chapter?.number).toBe(questionnaire.chapterNumber);
      const sectionIds = new Set(chapter?.sections.map((section) => section.id));
      for (const question of questionnaire.questions) {
        expect(question.sourceSectionIds.every((sectionId) => sectionIds.has(sectionId))).toBe(
          true
        );
      }
    }

    for (const card of teachBackCards) {
      const chapter = chapters.get(card.chapterId);
      expect(chapter?.number).toBe(card.chapterNumber);
      const sectionIds = new Set(chapter?.sections.map((section) => section.id));
      expect(card.sourceSectionIds.every((sectionId) => sectionIds.has(sectionId))).toBe(true);
    }
  });

  test('parses the complete static model through its public schema', () => {
    expect(
      TutorialLearningContentSchema.parse({ questionnaires: chapterQuestionnaires, teachBackCards })
    ).toEqual({ questionnaires: chapterQuestionnaires, teachBackCards });
  });

  test('rejects an answer index outside its authored options', () => {
    const question = chapterQuestionnaires[0]?.questions[0];
    if (!question) throw new Error('question fixture missing');
    const result = ComprehensionQuestionSchema.safeParse({
      ...question,
      answerIndex: question.options.length,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['answerIndex'],
        message: 'answerIndex must identify one of the authored options',
      });
    }
  });

  test('rejects duplicate options and mismatched questionnaire chapter identity', () => {
    const questionnaire = chapterQuestionnaires[0];
    const question = questionnaire?.questions[0];
    if (!questionnaire || !question) throw new Error('questionnaire fixture missing');

    expect(
      ComprehensionQuestionSchema.safeParse({
        ...question,
        options: [question.options[0], question.options[0], question.options[2]],
      }).success
    ).toBe(false);

    const result = ChapterQuestionnaireSchema.safeParse({
      ...questionnaire,
      questions: [
        { ...question, chapterId: 'relational-grammar' },
        ...questionnaire.questions.slice(1),
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === 'questions.0.chapterId')
      ).toBe(true);
    }
  });

  test('requires unique teach-back criteria', () => {
    const card = teachBackCards[0];
    if (!card) throw new Error('teach-back fixture missing');
    const firstCriterion = card.successCriteria[0];
    if (!firstCriterion) throw new Error('criterion fixture missing');
    const result = TeachBackCardSchema.safeParse({
      ...card,
      successCriteria: [firstCriterion, firstCriterion, ...card.successCriteria.slice(2)],
    });
    expect(result.success).toBe(false);
  });
});

describe('scoreQuestionnaire', () => {
  const questionnaire = chapterQuestionnaires[0];
  if (!questionnaire) throw new Error('questionnaire fixture missing');

  test('reports objective correctness, completion, and mastery separately', () => {
    const first = questionnaire.questions[0];
    const second = questionnaire.questions[1];
    if (!first || !second) throw new Error('question fixture missing');

    const score = scoreQuestionnaire(questionnaire, {
      [first.id]: first.answerIndex,
      [second.id]: second.answerIndex === 0 ? 1 : 0,
    });

    expect(score).toMatchObject({
      answered: 2,
      correct: 1,
      incorrect: 1,
      unanswered: 1,
      total: 3,
      percentage: 33,
      complete: false,
      mastered: false,
    });
    expect(score.results[0]?.explanation).toBe(first.explanation);
  });

  test('marks only a complete all-correct questionnaire as mastered', () => {
    const answers = Object.fromEntries(
      questionnaire.questions.map((question) => [question.id, question.answerIndex])
    );
    expect(scoreQuestionnaire(questionnaire, answers)).toMatchObject({
      answered: 3,
      correct: 3,
      percentage: 100,
      complete: true,
      mastered: true,
    });
  });

  test('rejects unknown questions and option indexes outside the question', () => {
    expect(() => scoreQuestionnaire(questionnaire, { 'not-authored': 0 })).toThrow(
      'unknown questionnaire question not-authored'
    );
    const question = questionnaire.questions[0];
    if (!question) throw new Error('question fixture missing');
    expect(() =>
      scoreQuestionnaire(questionnaire, { [question.id]: question.options.length })
    ).toThrow(`answer ${question.options.length} is outside the options for ${question.id}`);
  });
});

describe('scoreTeachBack', () => {
  const card = teachBackCards[0];
  if (!card) throw new Error('teach-back fixture missing');

  test('scores a checklist without pretending a partial explanation is ready', () => {
    const met = card.successCriteria.slice(0, 2).map((criterion) => criterion.id);
    expect(scoreTeachBack(card, met)).toMatchObject({
      cardId: card.id,
      met: 2,
      total: 4,
      percentage: 50,
      readyToExplain: false,
    });
    expect(
      scoreTeachBack(
        card,
        card.successCriteria.map((criterion) => criterion.id)
      )
    ).toMatchObject({
      percentage: 100,
      readyToExplain: true,
      missingCriteriaIds: [],
    });
  });

  test('rejects duplicate or unauthored checklist criteria', () => {
    const criterion = card.successCriteria[0];
    if (!criterion) throw new Error('criterion fixture missing');
    expect(() => scoreTeachBack(card, [criterion.id, criterion.id])).toThrow(
      `teach-back score for ${card.id} contains duplicate criteria`
    );
    expect(() => scoreTeachBack(card, ['not-authored'])).toThrow(
      'unknown teach-back criterion not-authored'
    );
  });
});
