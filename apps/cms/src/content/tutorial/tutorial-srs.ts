import * as z from 'zod';

const MINUTE_MS = 60_000;
const DAY_MINUTES = 1_440;

const TutorialCardIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type TutorialCardId = z.infer<typeof TutorialCardIdSchema>;

const TutorialRatingSchema = z.enum(['again', 'hard', 'good', 'easy']);
export type TutorialRating = z.infer<typeof TutorialRatingSchema>;

const TutorialCardPhaseSchema = z.enum(['new', 'learning', 'review', 'relearning']);
type TutorialCardPhase = z.infer<typeof TutorialCardPhaseSchema>;

export const TutorialCardStateSchema = z.object({
  phase: TutorialCardPhaseSchema.default('new'),
  step: z.int().min(0).default(0),
  ease: z.number().positive().default(2.5),
  intervalMinutes: z.int().min(0).default(0),
  due: z.int().min(0).default(0),
  reps: z.int().min(0).default(0),
  lapses: z.int().min(0).default(0),
  lastReviewedAt: z.int().min(0).nullable().default(null),
});
export type TutorialCardState = z.infer<typeof TutorialCardStateSchema>;

const TutorialReviewLogSchema = z.object({
  rating: TutorialRatingSchema,
  phase: TutorialCardPhaseSchema,
  intervalMinutes: z.int().min(0),
  ease: z.number().positive(),
  reviewedAt: z.int().min(0),
  elapsedMinutes: z.number().min(0),
});
const EaseDeltaSchema = z.object({
  again: z.number(),
  hard: z.number(),
  good: z.number(),
  easy: z.number(),
});

const TutorialSchedulerConfigSchema = z.object({
  learningStepsMinutes: z.array(z.number().positive()).min(1),
  relearningStepsMinutes: z.array(z.number().positive()).min(1),
  graduatingIntervalDays: z.number().positive(),
  easyIntervalDays: z.number().positive(),
  startingEase: z.number().positive(),
  minEase: z.number().positive(),
  easyBonus: z.number().positive(),
  hardMultiplier: z.number().positive(),
  intervalModifier: z.number().positive(),
  maxIntervalDays: z.number().positive(),
  easeDelta: EaseDeltaSchema,
});
export type TutorialSchedulerConfig = z.infer<typeof TutorialSchedulerConfigSchema>;

const TutorialSchedulerConfigOverrideSchema = z.object({
  learningStepsMinutes: z.array(z.number().positive()).min(1).optional(),
  relearningStepsMinutes: z.array(z.number().positive()).min(1).optional(),
  graduatingIntervalDays: z.number().positive().optional(),
  easyIntervalDays: z.number().positive().optional(),
  startingEase: z.number().positive().optional(),
  minEase: z.number().positive().optional(),
  easyBonus: z.number().positive().optional(),
  hardMultiplier: z.number().positive().optional(),
  intervalModifier: z.number().positive().optional(),
  maxIntervalDays: z.number().positive().optional(),
  easeDelta: EaseDeltaSchema.partial().optional(),
});
export type TutorialSchedulerConfigOverride = z.infer<typeof TutorialSchedulerConfigOverrideSchema>;

export const DEFAULT_TUTORIAL_SCHEDULER_CONFIG: TutorialSchedulerConfig =
  TutorialSchedulerConfigSchema.parse({
    learningStepsMinutes: [1, 10],
    relearningStepsMinutes: [10],
    graduatingIntervalDays: 1,
    easyIntervalDays: 4,
    startingEase: 2.5,
    minEase: 1.3,
    easyBonus: 1.3,
    hardMultiplier: 1.2,
    intervalModifier: 1,
    maxIntervalDays: 36_500,
    easeDelta: { again: -0.2, hard: -0.15, good: 0, easy: 0.15 },
  });

const SchedulerOptionsSchema = z.object({
  now: z.int().min(0).optional(),
  config: TutorialSchedulerConfigOverrideSchema.optional(),
});
export type TutorialSchedulerOptions = z.infer<typeof SchedulerOptionsSchema>;

const TutorialReviewResultSchema = z.object({
  state: TutorialCardStateSchema,
  log: TutorialReviewLogSchema,
});
export type TutorialReviewResult = z.infer<typeof TutorialReviewResultSchema>;

export function resolveTutorialSchedulerConfig(
  overrideInput: TutorialSchedulerConfigOverride = {}
): TutorialSchedulerConfig {
  const override = TutorialSchedulerConfigOverrideSchema.parse(overrideInput);
  return TutorialSchedulerConfigSchema.parse({
    ...DEFAULT_TUTORIAL_SCHEDULER_CONFIG,
    ...override,
    easeDelta: {
      ...DEFAULT_TUTORIAL_SCHEDULER_CONFIG.easeDelta,
      ...override.easeDelta,
    },
  });
}

export function createCardState(optionsInput: TutorialSchedulerOptions = {}): TutorialCardState {
  const options = SchedulerOptionsSchema.parse(optionsInput);
  const now = options.now ?? Date.now();
  const config = resolveTutorialSchedulerConfig(options.config);
  return TutorialCardStateSchema.parse({
    phase: 'new',
    ease: config.startingEase,
    due: now,
  });
}

export function isCardDue(stateInput: TutorialCardState, nowInput: number = Date.now()): boolean {
  const state = TutorialCardStateSchema.parse(stateInput);
  const now = z.int().min(0).parse(nowInput);
  return state.due <= now;
}

function clampEase(ease: number, config: TutorialSchedulerConfig): number {
  return Math.max(config.minEase, Math.round(ease * 100) / 100);
}

function dueAt(now: number, intervalMinutes: number): number {
  return Math.round(now + intervalMinutes * MINUTE_MS);
}

function stepMinutes(steps: readonly number[], step: number, fallbackDays: number): number {
  return Math.round(steps[step] ?? fallbackDays * DAY_MINUTES);
}

function graduate(
  state: TutorialCardState,
  config: TutorialSchedulerConfig,
  now: number,
  easy: boolean
): TutorialCardState {
  const days = easy ? config.easyIntervalDays : config.graduatingIntervalDays;
  const intervalMinutes = Math.round(days * DAY_MINUTES);
  return {
    ...state,
    phase: 'review',
    step: 0,
    intervalMinutes,
    due: dueAt(now, intervalMinutes),
  };
}

function scheduleLearningCard(
  state: TutorialCardState,
  rating: TutorialRating,
  config: TutorialSchedulerConfig,
  now: number
): TutorialCardState {
  const relearning = state.phase === 'relearning';
  const phase: TutorialCardPhase = relearning ? 'relearning' : 'learning';
  const steps = relearning ? config.relearningStepsMinutes : config.learningStepsMinutes;

  if (rating === 'easy') return graduate(state, config, now, true);

  if (rating === 'again') {
    const intervalMinutes = stepMinutes(steps, 0, config.graduatingIntervalDays);
    return { ...state, phase, step: 0, intervalMinutes, due: dueAt(now, intervalMinutes) };
  }

  if (rating === 'hard') {
    const intervalMinutes = stepMinutes(steps, state.step, config.graduatingIntervalDays);
    return {
      ...state,
      phase,
      step: state.step,
      intervalMinutes,
      due: dueAt(now, intervalMinutes),
    };
  }

  const nextStep = (state.phase === 'new' ? 0 : state.step) + 1;
  if (nextStep >= steps.length) return graduate(state, config, now, false);
  const intervalMinutes = stepMinutes(steps, nextStep, config.graduatingIntervalDays);
  return { ...state, phase, step: nextStep, intervalMinutes, due: dueAt(now, intervalMinutes) };
}

function capIntervalDays(days: number, config: TutorialSchedulerConfig): number {
  return Math.min(days, config.maxIntervalDays);
}

function nextReviewInterval(
  state: TutorialCardState,
  rating: 'hard' | 'good' | 'easy',
  config: TutorialSchedulerConfig,
  currentDays: number
): { ease: number; days: number } {
  if (rating === 'hard') {
    return {
      ease: clampEase(state.ease + config.easeDelta.hard, config),
      days: Math.max(
        currentDays,
        Math.round(currentDays * config.hardMultiplier * config.intervalModifier)
      ),
    };
  }

  if (rating === 'easy') {
    return {
      ease: clampEase(state.ease + config.easeDelta.easy, config),
      days: Math.max(
        currentDays + 1,
        Math.round(currentDays * state.ease * config.easyBonus * config.intervalModifier)
      ),
    };
  }

  return {
    ease: clampEase(state.ease + config.easeDelta.good, config),
    days: Math.max(currentDays + 1, Math.round(currentDays * state.ease * config.intervalModifier)),
  };
}

function scheduleReviewCard(
  state: TutorialCardState,
  rating: TutorialRating,
  config: TutorialSchedulerConfig,
  now: number
): TutorialCardState {
  if (rating === 'again') {
    const intervalMinutes = stepMinutes(
      config.relearningStepsMinutes,
      0,
      config.graduatingIntervalDays
    );
    return {
      ...state,
      phase: 'relearning',
      step: 0,
      ease: clampEase(state.ease + config.easeDelta.again, config),
      lapses: state.lapses + 1,
      intervalMinutes,
      due: dueAt(now, intervalMinutes),
    };
  }

  const currentDays = state.intervalMinutes / DAY_MINUTES;
  const scheduled = nextReviewInterval(state, rating, config, currentDays);
  const intervalMinutes = Math.round(capIntervalDays(scheduled.days, config) * DAY_MINUTES);
  return {
    ...state,
    phase: 'review',
    step: 0,
    ease: scheduled.ease,
    intervalMinutes,
    due: dueAt(now, intervalMinutes),
  };
}

export function reviewCard(
  stateInput: TutorialCardState,
  ratingInput: TutorialRating,
  optionsInput: TutorialSchedulerOptions = {}
): TutorialReviewResult {
  const state = TutorialCardStateSchema.parse(stateInput);
  const rating = TutorialRatingSchema.parse(ratingInput);
  const options = SchedulerOptionsSchema.parse(optionsInput);
  const now = options.now ?? Date.now();
  const config = resolveTutorialSchedulerConfig(options.config);
  const scheduled =
    state.phase === 'review'
      ? scheduleReviewCard(state, rating, config, now)
      : scheduleLearningCard(state, rating, config, now);
  const nextState: TutorialCardState = {
    ...scheduled,
    reps: state.reps + 1,
    lastReviewedAt: now,
  };

  return TutorialReviewResultSchema.parse({
    state: nextState,
    log: {
      rating,
      phase: state.phase,
      intervalMinutes: nextState.intervalMinutes,
      ease: nextState.ease,
      reviewedAt: now,
      elapsedMinutes:
        state.lastReviewedAt === null ? 0 : Math.max(0, (now - state.lastReviewedAt) / MINUTE_MS),
    },
  });
}

const StudyDeckCardIdsSchema = z
  .array(TutorialCardIdSchema)
  .min(1)
  .superRefine((cardIds, context) => {
    const seen = new Set<string>();
    for (const [index, cardId] of cardIds.entries()) {
      if (seen.has(cardId)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate study card id ${cardId}`,
          path: [index],
        });
      }
      seen.add(cardId);
    }
  });

const TutorialCardStatesSchema = z.record(TutorialCardIdSchema, TutorialCardStateSchema);

export function buildStudyDeck(
  cardIdsInput: readonly TutorialCardId[],
  statesInput: Readonly<Record<string, TutorialCardState>>,
  nowInput: number = Date.now()
): TutorialCardId[] {
  const cardIds = StudyDeckCardIdsSchema.parse(cardIdsInput);
  const states = TutorialCardStatesSchema.parse(statesInput);
  const now = z.int().min(0).parse(nowInput);
  const dueCards: { id: TutorialCardId; due: number; authoredIndex: number }[] = [];
  const newCards: TutorialCardId[] = [];

  for (const [authoredIndex, cardId] of cardIds.entries()) {
    const state = states[cardId];
    if (!state || state.phase === 'new') {
      newCards.push(cardId);
      continue;
    }
    if (state.due <= now) dueCards.push({ id: cardId, due: state.due, authoredIndex });
  }

  dueCards.sort((left, right) => left.due - right.due || left.authoredIndex - right.authoredIndex);
  return [...dueCards.map((card) => card.id), ...newCards];
}

const TutorialProgressReviewSchema = z.object({
  cardId: TutorialCardIdSchema,
  ...TutorialReviewLogSchema.shape,
});
const TUTORIAL_PROGRESS_VERSION = 1 as const;

const TutorialProgressV0Schema = z.strictObject({
  version: z.literal(0).optional(),
  states: TutorialCardStatesSchema.default({}),
});
export type TutorialProgressV0 = z.infer<typeof TutorialProgressV0Schema>;

export const TutorialProgressSchema = z.strictObject({
  version: z.literal(TUTORIAL_PROGRESS_VERSION),
  states: TutorialCardStatesSchema.default({}),
  reviewLog: z.array(TutorialProgressReviewSchema).default([]),
  updatedAt: z.int().min(0).nullable().default(null),
});
export type TutorialProgress = z.infer<typeof TutorialProgressSchema>;

export function createTutorialProgress(): TutorialProgress {
  return TutorialProgressSchema.parse({ version: TUTORIAL_PROGRESS_VERSION });
}

function latestReviewedAt(states: Readonly<Record<string, TutorialCardState>>): number | null {
  let latest: number | null = null;
  for (const state of Object.values(states)) {
    if (state.lastReviewedAt !== null && (latest === null || state.lastReviewedAt > latest)) {
      latest = state.lastReviewedAt;
    }
  }
  return latest;
}

export function migrateTutorialProgressV0ToV1(input: TutorialProgressV0): TutorialProgress {
  const legacy = TutorialProgressV0Schema.parse(input);
  return TutorialProgressSchema.parse({
    version: TUTORIAL_PROGRESS_VERSION,
    states: legacy.states,
    reviewLog: [],
    updatedAt: latestReviewedAt(legacy.states),
  });
}

function decodeProgressInput(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  try {
    const decoded: unknown = JSON.parse(input);
    return decoded;
  } catch (error) {
    throw new Error('tutorial progress is not valid JSON', { cause: error });
  }
}

export function parseTutorialProgress(input: unknown): TutorialProgress {
  if (input === null || input === undefined) return createTutorialProgress();
  const decoded = decodeProgressInput(input);
  const versionProbe = z.looseObject({ version: z.int().optional() }).safeParse(decoded);

  if (versionProbe.success && versionProbe.data.version === TUTORIAL_PROGRESS_VERSION) {
    return TutorialProgressSchema.parse(decoded);
  }

  if (versionProbe.success && versionProbe.data.version !== undefined) {
    if (versionProbe.data.version !== 0) {
      throw new Error(`unsupported tutorial progress version ${versionProbe.data.version}`);
    }
  }

  const legacy = TutorialProgressV0Schema.parse(decoded);
  return migrateTutorialProgressV0ToV1(legacy);
}

export function serializeTutorialProgress(input: TutorialProgress): string {
  return JSON.stringify(TutorialProgressSchema.parse(input));
}

export function recordTutorialReview(
  progressInput: TutorialProgress,
  cardIdInput: TutorialCardId,
  resultInput: TutorialReviewResult
): TutorialProgress {
  const progress = TutorialProgressSchema.parse(progressInput);
  const cardId = TutorialCardIdSchema.parse(cardIdInput);
  const result = TutorialReviewResultSchema.parse(resultInput);
  return TutorialProgressSchema.parse({
    version: TUTORIAL_PROGRESS_VERSION,
    states: { ...progress.states, [cardId]: result.state },
    reviewLog: [...progress.reviewLog, { cardId, ...result.log }],
    updatedAt: result.log.reviewedAt,
  });
}

const TutorialProgressSummarySchema = z.object({
  total: z.int().min(0),
  due: z.int().min(0),
  mastered: z.int().min(0),
  byPhase: z.record(TutorialCardPhaseSchema, z.int().min(0)),
});
export type TutorialProgressSummary = z.infer<typeof TutorialProgressSummarySchema>;

export function summarizeTutorialProgress(
  cardIdsInput: readonly TutorialCardId[],
  statesInput: Readonly<Record<string, TutorialCardState>>,
  nowInput: number = Date.now()
): TutorialProgressSummary {
  const cardIds = StudyDeckCardIdsSchema.parse(cardIdsInput);
  const states = TutorialCardStatesSchema.parse(statesInput);
  const now = z.int().min(0).parse(nowInput);
  const byPhase: Record<TutorialCardPhase, number> = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
  };
  let due = 0;

  for (const cardId of cardIds) {
    const state = states[cardId];
    const phase = state?.phase ?? 'new';
    byPhase[phase] += 1;
    if (!state || state.due <= now) due += 1;
  }

  return TutorialProgressSummarySchema.parse({
    total: cardIds.length,
    due,
    mastered: byPhase.review,
    byPhase,
  });
}
