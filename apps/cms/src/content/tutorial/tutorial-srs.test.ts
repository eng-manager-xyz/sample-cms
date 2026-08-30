import { describe, expect, test } from 'bun:test';
import {
  buildStudyDeck,
  createCardState,
  createTutorialProgress,
  DEFAULT_TUTORIAL_SCHEDULER_CONFIG,
  isCardDue,
  migrateTutorialProgressV0ToV1,
  parseTutorialProgress,
  recordTutorialReview,
  resolveTutorialSchedulerConfig,
  reviewCard,
  serializeTutorialProgress,
  summarizeTutorialProgress,
  TutorialCardStateSchema,
  TutorialProgressSchema,
} from './tutorial-srs';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const T0 = 1_800_000_000_000;

function graduatedCard() {
  const first = reviewCard(createCardState({ now: T0 }), 'good', { now: T0 }).state;
  return reviewCard(first, 'good', { now: first.due }).state;
}

describe('tutorial SRS schemas and configuration', () => {
  test('creates a new card that is due immediately with the configured starting ease', () => {
    const card = createCardState({ now: T0, config: { startingEase: 2.8 } });
    expect(card).toEqual({
      phase: 'new',
      step: 0,
      ease: 2.8,
      intervalMinutes: 0,
      due: T0,
      reps: 0,
      lapses: 0,
      lastReviewedAt: null,
    });
    expect(isCardDue(card, T0)).toBe(true);
  });

  test('merges sparse scheduler overrides without losing nested ease defaults', () => {
    const config = resolveTutorialSchedulerConfig({
      graduatingIntervalDays: 2,
      easeDelta: { hard: -0.25 },
    });
    expect(config.graduatingIntervalDays).toBe(2);
    expect(config.learningStepsMinutes).toEqual(
      DEFAULT_TUTORIAL_SCHEDULER_CONFIG.learningStepsMinutes
    );
    expect(config.easeDelta).toEqual({ again: -0.2, hard: -0.25, good: 0, easy: 0.15 });
  });

  test('rejects malformed persisted card state at the Zod boundary', () => {
    const result = TutorialCardStateSchema.safeParse({
      ...createCardState({ now: T0 }),
      intervalMinutes: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['intervalMinutes']);
  });
});

describe('learning and relearning ladders', () => {
  test('Good advances a new card through the ten-minute step and then graduates', () => {
    const first = reviewCard(createCardState({ now: T0 }), 'good', { now: T0 });
    expect(first.state).toMatchObject({
      phase: 'learning',
      step: 1,
      intervalMinutes: 10,
      due: T0 + 10 * MINUTE_MS,
      reps: 1,
    });

    const second = reviewCard(first.state, 'good', { now: first.state.due });
    expect(second.state).toMatchObject({
      phase: 'review',
      step: 0,
      intervalMinutes: 1_440,
      due: first.state.due + DAY_MS,
      reps: 2,
    });
  });

  test('Again resets, Hard repeats, and Easy graduates a new card immediately', () => {
    const fresh = createCardState({ now: T0 });
    expect(reviewCard(fresh, 'again', { now: T0 }).state).toMatchObject({
      phase: 'learning',
      step: 0,
      intervalMinutes: 1,
    });
    expect(reviewCard(fresh, 'hard', { now: T0 }).state).toMatchObject({
      phase: 'learning',
      step: 0,
      intervalMinutes: 1,
    });
    expect(reviewCard(fresh, 'easy', { now: T0 }).state).toMatchObject({
      phase: 'review',
      intervalMinutes: 4 * 1_440,
      due: T0 + 4 * DAY_MS,
    });
  });

  test('a lapsed review enters relearning and Good returns it to review', () => {
    const graduated = graduatedCard();
    const lapsed = reviewCard(graduated, 'again', { now: graduated.due }).state;
    expect(lapsed).toMatchObject({
      phase: 'relearning',
      step: 0,
      lapses: 1,
      intervalMinutes: 10,
    });
    expect(lapsed.ease).toBeLessThan(graduated.ease);

    const recovered = reviewCard(lapsed, 'good', { now: lapsed.due }).state;
    expect(recovered).toMatchObject({ phase: 'review', intervalMinutes: 1_440 });
  });
});

describe('review scheduling and bookkeeping', () => {
  test('Good grows, Easy raises ease, and Hard lowers ease without shrinking the interval', () => {
    const graduated = graduatedCard();
    const good = reviewCard(graduated, 'good', { now: graduated.due }).state;
    const easy = reviewCard(graduated, 'easy', { now: graduated.due }).state;
    const hard = reviewCard(graduated, 'hard', { now: graduated.due }).state;

    expect(good.intervalMinutes).toBeGreaterThan(graduated.intervalMinutes);
    expect(good.ease).toBe(graduated.ease);
    expect(easy.ease).toBeGreaterThan(graduated.ease);
    expect(easy.intervalMinutes).toBeGreaterThanOrEqual(good.intervalMinutes);
    expect(hard.ease).toBeLessThan(graduated.ease);
    expect(hard.intervalMinutes).toBeGreaterThanOrEqual(graduated.intervalMinutes);
  });

  test('clamps ease and caps the maximum interval', () => {
    const graduated = graduatedCard();
    const hard = reviewCard({ ...graduated, ease: 1.3 }, 'hard', {
      now: graduated.due,
      config: { minEase: 1.3 },
    }).state;
    expect(hard.ease).toBe(1.3);

    const capped = reviewCard(graduated, 'easy', {
      now: graduated.due,
      config: { maxIntervalDays: 2 },
    }).state;
    expect(capped.intervalMinutes).toBe(2 * 1_440);
  });

  test('returns an auditable log and is deterministic for identical inputs', () => {
    const state = createCardState({ now: T0 });
    const first = reviewCard(state, 'good', { now: T0 + 2 * MINUTE_MS });
    const second = reviewCard(state, 'good', { now: T0 + 2 * MINUTE_MS });
    expect(first).toEqual(second);
    expect(first.log).toEqual({
      rating: 'good',
      phase: 'new',
      intervalMinutes: 10,
      ease: 2.5,
      reviewedAt: T0 + 2 * MINUTE_MS,
      elapsedMinutes: 0,
    });
    expect(first.state.lastReviewedAt).toBe(T0 + 2 * MINUTE_MS);
  });
});

describe('buildStudyDeck', () => {
  test('orders due reviews first, then new cards, and excludes future reviews', () => {
    const dueLater = TutorialCardStateSchema.parse({
      ...createCardState({ now: T0 }),
      phase: 'learning',
      due: T0 - 100,
    });
    const dueEarlier = TutorialCardStateSchema.parse({
      ...graduatedCard(),
      due: T0 - 1_000,
    });
    const future = TutorialCardStateSchema.parse({
      ...graduatedCard(),
      due: T0 + DAY_MS,
    });

    expect(
      buildStudyDeck(
        ['fresh-card', 'new-card', 'due-later', 'due-earlier', 'future-card'],
        {
          'new-card': createCardState({ now: T0 }),
          'due-later': dueLater,
          'due-earlier': dueEarlier,
          'future-card': future,
        },
        T0
      )
    ).toEqual(['due-earlier', 'due-later', 'fresh-card', 'new-card']);
  });

  test('keeps authored order for equal due times and never mutates inputs', () => {
    const state = TutorialCardStateSchema.parse({
      ...graduatedCard(),
      due: T0 - 1,
    });
    const ids = ['first-card', 'second-card'];
    const states = { 'first-card': state, 'second-card': state };
    const idsBefore = [...ids];
    const statesBefore = structuredClone(states);

    expect(buildStudyDeck(ids, states, T0)).toEqual(ids);
    expect(ids).toEqual(idsBefore);
    expect(states).toEqual(statesBefore);
  });

  test('rejects duplicate card IDs', () => {
    expect(() => buildStudyDeck(['same-card', 'same-card'], {}, T0)).toThrow(
      'duplicate study card id same-card'
    );
  });
});

describe('versioned tutorial progress', () => {
  test('treats a missing browser-storage value as fresh progress', () => {
    expect(parseTutorialProgress(null)).toEqual(createTutorialProgress());
  });

  test('creates, records, serializes, and parses a current progress document', () => {
    const initial = createTutorialProgress();
    const result = reviewCard(createCardState({ now: T0 }), 'good', { now: T0 });
    const recorded = recordTutorialReview(initial, 'chapter-1-public-request-boundary', result);

    expect(recorded).toMatchObject({
      version: 1,
      updatedAt: T0,
      states: { 'chapter-1-public-request-boundary': result.state },
    });
    expect(recorded.reviewLog).toEqual([
      { cardId: 'chapter-1-public-request-boundary', ...result.log },
    ]);
    expect(parseTutorialProgress(serializeTutorialProgress(recorded))).toEqual(recorded);
  });

  test('migrates unversioned and explicit version-zero state overlays to version one', () => {
    const reviewed = reviewCard(createCardState({ now: T0 }), 'easy', { now: T0 }).state;
    const unversioned = parseTutorialProgress({ states: { 'legacy-card': reviewed } });
    const explicit = migrateTutorialProgressV0ToV1({
      version: 0,
      states: { 'legacy-card': reviewed },
    });

    for (const migrated of [unversioned, explicit]) {
      expect(migrated).toEqual({
        version: 1,
        states: { 'legacy-card': reviewed },
        reviewLog: [],
        updatedAt: T0,
      });
    }
  });

  test('rejects corrupt JSON, unsupported versions, and invalid current state', () => {
    expect(() => parseTutorialProgress('{')).toThrow('tutorial progress is not valid JSON');
    expect(() => parseTutorialProgress({ version: 99, states: {} })).toThrow(
      'unsupported tutorial progress version 99'
    );
    expect(
      TutorialProgressSchema.safeParse({
        version: 1,
        states: {
          'bad-card': { ...createCardState({ now: T0 }), reps: -1 },
        },
      }).success
    ).toBe(false);
  });
});

describe('summarizeTutorialProgress', () => {
  test('reports unseen cards as new and due while review-phase cards count as mastered', () => {
    const learning = reviewCard(createCardState({ now: T0 }), 'again', { now: T0 }).state;
    const mastered = graduatedCard();
    const summary = summarizeTutorialProgress(
      ['unseen-card', 'learning-card', 'mastered-card'],
      {
        'learning-card': { ...learning, due: T0 - 1 },
        'mastered-card': { ...mastered, due: T0 + DAY_MS },
      },
      T0
    );

    expect(summary).toEqual({
      total: 3,
      due: 2,
      mastered: 1,
      byPhase: { new: 1, learning: 1, review: 1, relearning: 0 },
    });
  });
});
