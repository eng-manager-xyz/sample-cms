import { BrainCircuit, CheckCircle2, Clock3, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  scoreTeachBack,
  type TeachBackCard,
  teachBackCards,
} from '@/content/tutorial/tutorial-learning';
import {
  resetTutorialProgress,
  updateTutorialProgress,
  useTutorialProgress,
} from '@/content/tutorial/tutorial-progress-store';
import {
  buildStudyDeck,
  createCardState,
  recordTutorialReview,
  reviewCard,
  summarizeTutorialProgress,
  type TutorialCardState,
  type TutorialRating,
} from '@/content/tutorial/tutorial-srs';

const teachBackCardIds = teachBackCards.map((card) => card.id);
const teachBackCardById = new Map(teachBackCards.map((card) => [card.id, card] as const));

const ratingDetails: Record<TutorialRating, { label: string; key: string; description: string }> = {
  again: { label: 'Again', key: '1', description: 'I could not explain it yet' },
  hard: { label: 'Hard', key: '2', description: 'I needed substantial help' },
  good: { label: 'Good', key: '3', description: 'I explained the core contract' },
  easy: { label: 'Easy', key: '4', description: 'I explained it precisely and fluently' },
};

const ratingByKey: Readonly<Record<string, TutorialRating>> = {
  '1': 'again',
  '2': 'hard',
  '3': 'good',
  '4': 'easy',
};

const nextDueDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

let browserNow = typeof window === 'undefined' ? 0 : Date.now();

function getTimeSnapshot(): number {
  return browserNow;
}

function subscribeToTime(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  function refreshTime(): void {
    browserNow = Date.now();
    listener();
  }

  refreshTime();
  const interval = window.setInterval(refreshTime, 1_000);
  window.addEventListener('focus', refreshTime);
  document.addEventListener('visibilitychange', refreshTime);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener('focus', refreshTime);
    document.removeEventListener('visibilitychange', refreshTime);
  };
}

function useCurrentTime(): number {
  return useSyncExternalStore(subscribeToTime, getTimeSnapshot, () => 0);
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1_440)}d`;
}

function formatNextDue(timestamp: number): string {
  return nextDueDateFormatter.format(new Date(timestamp));
}

function RatingButton({
  rating,
  previewState,
  onRate,
}: Readonly<{
  rating: TutorialRating;
  previewState: TutorialCardState;
  onRate: (rating: TutorialRating) => void;
}>) {
  const detail = ratingDetails[rating];
  return (
    <button
      type="button"
      aria-keyshortcuts={detail.key}
      onClick={() => onRate(rating)}
      className="group min-h-16 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-left outline-none transition-colors hover:border-accent/45 hover:bg-accent-soft/35 focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-bold text-ink">{detail.label}</span>
        <span className="font-mono text-[10px] font-semibold tabular-nums text-accent-strong">
          {formatInterval(previewState.intervalMinutes)} · {detail.key}
        </span>
      </span>
      <span className="mt-1 block text-[10px] leading-4 text-ink-muted">{detail.description}</span>
    </button>
  );
}

function TeachBackReviewCard({
  card,
  state,
  now,
  remaining,
  onRate,
}: Readonly<{
  card: TeachBackCard;
  state: TutorialCardState;
  now: number;
  remaining: number;
  onRate: (rating: TutorialRating) => void;
}>) {
  const [revealed, setRevealed] = useState(false);
  const [scratchpad, setScratchpad] = useState('');
  const [metCriteriaIds, setMetCriteriaIds] = useState<string[]>([]);
  const revealedRegionRef = useRef<HTMLElement>(null);
  const ratingLockedRef = useRef(false);
  const selfScore = scoreTeachBack(card, metCriteriaIds);
  const metCriteriaIdSet = new Set(metCriteriaIds);

  useEffect(() => {
    if (revealed) revealedRegionRef.current?.focus();
  }, [revealed]);

  function toggleCriterion(criterionId: string, checked: boolean): void {
    setMetCriteriaIds((current) =>
      checked ? [...current, criterionId] : current.filter((id) => id !== criterionId)
    );
  }

  function handleRatingShortcut(event: KeyboardEvent<HTMLElement>): void {
    if (!revealed || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const rating = ratingByKey[event.key];
    if (!rating) return;
    event.preventDefault();
    rateOnce(rating);
  }

  function rateOnce(rating: TutorialRating): void {
    if (ratingLockedRef.current) return;
    ratingLockedRef.current = true;
    onRate(rating);
  }

  return (
    <article
      onKeyDown={handleRatingShortcut}
      className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-sm"
    >
      <header className="border-b border-line bg-surface-subtle p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="info">Chapter {card.chapterNumber}</Badge>
            <span className="font-mono text-[10px] text-ink-faint">
              {state.phase} · {state.reps} reviews
            </span>
          </div>
          <span className="font-mono text-[10px] text-ink-faint">{remaining} in this session</span>
        </div>
        <h3 className="font-display mt-3 text-xl font-bold tracking-[-0.025em] text-ink">
          {card.title}
        </h3>
        <p className="font-serif mt-2 text-base leading-7 text-ink">{card.prompt}</p>
      </header>

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 rounded-xl border border-accent/20 bg-accent-soft/35 p-3.5">
          <Volume2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-strong" />
          <p className="text-xs leading-5 text-ink-muted">
            Explain this aloud as if a teammate challenged the design. Use the scratchpad only to
            structure your answer; it is never saved.
          </p>
        </div>

        <label className="mt-4 block">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
            Private scratchpad · optional
          </span>
          <textarea
            value={scratchpad}
            onChange={(event) => setScratchpad(event.currentTarget.value)}
            rows={4}
            placeholder="Outline the invariant, mechanism, evidence, and boundary…"
            className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-sm leading-6 text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>

        {!revealed ? (
          <Button className="mt-4 min-h-11" onClick={() => setRevealed(true)}>
            <Sparkles aria-hidden="true" className="size-4" />
            Reveal model answer and rubric
          </Button>
        ) : (
          <section
            ref={revealedRegionRef}
            tabIndex={-1}
            aria-labelledby={`${card.id}-model-answer`}
            className="mt-5 space-y-4 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-focus"
          >
            <div>
              <p
                id={`${card.id}-model-answer`}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-accent-strong"
              >
                Model answer
              </p>
              <blockquote className="mt-2 rounded-r-xl border-l-[3px] border-accent bg-accent-soft/35 px-4 py-3 font-serif text-[14px] leading-7 text-ink">
                {card.modelAnswer}
              </blockquote>
            </div>

            <fieldset className="rounded-xl border border-line p-3.5">
              <legend className="font-display px-1 text-sm font-bold text-ink">
                What did your explanation include?
              </legend>
              <div className="mt-2 grid gap-2">
                {card.successCriteria.map((criterion) => (
                  <label
                    key={criterion.id}
                    className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-xs leading-5 text-ink-muted hover:bg-surface-subtle"
                  >
                    <input
                      type="checkbox"
                      checked={metCriteriaIdSet.has(criterion.id)}
                      onChange={(event) =>
                        toggleCriterion(criterion.id, event.currentTarget.checked)
                      }
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span>{criterion.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-ink" aria-live="polite">
                {selfScore.met} of {selfScore.total} criteria ·{' '}
                {selfScore.readyToExplain ? 'ready to re-explain' : 'keep strengthening the trace'}
              </p>
            </fieldset>

            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
                Grade retrieval · keys 1–4
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {(['again', 'hard', 'good', 'easy'] as const).map((rating) => (
                  <RatingButton
                    key={rating}
                    rating={rating}
                    previewState={reviewCard(state, rating, { now }).state}
                    onRate={rateOnce}
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

export function TutorialStudyDeck() {
  const progress = useTutorialProgress();
  const now = useCurrentTime();
  const shouldFocusNextCardRef = useRef(false);
  const [statusMessage, setStatusMessage] = useState('');
  const deck = buildStudyDeck(teachBackCardIds, progress.states, now);
  const activeCardId = deck[0];
  const activeCard = activeCardId ? teachBackCardById.get(activeCardId) : undefined;
  const activeState = activeCardId
    ? (progress.states[activeCardId] ?? createCardState({ now }))
    : undefined;
  const summary = summarizeTutorialProgress(teachBackCardIds, progress.states, now);
  const futureDueDates = teachBackCardIds
    .map((cardId) => progress.states[cardId]?.due)
    .filter((due): due is number => due !== undefined && due > now)
    .sort((left, right) => left - right);

  function focusUpdatedPanel(element: HTMLElement | null): void {
    if (!element || !shouldFocusNextCardRef.current) return;
    element.focus();
    shouldFocusNextCardRef.current = false;
  }

  function handleRate(rating: TutorialRating): void {
    if (!activeCardId) return;
    const reviewedAt = Date.now();
    let intervalMinutes = 0;
    shouldFocusNextCardRef.current = true;
    updateTutorialProgress((current) => {
      const currentState = current.states[activeCardId] ?? createCardState({ now: reviewedAt });
      const result = reviewCard(currentState, rating, { now: reviewedAt });
      intervalMinutes = result.state.intervalMinutes;
      return recordTutorialReview(current, activeCardId, result);
    });
    setStatusMessage(
      `${ratingDetails[rating].label} recorded. Next review in ${formatInterval(intervalMinutes)}.`
    );
  }

  function handleReset(): void {
    if (
      typeof window !== 'undefined' &&
      window.confirm('Reset all tutorial review scheduling and history stored in this browser?')
    ) {
      shouldFocusNextCardRef.current = true;
      resetTutorialProgress();
      setStatusMessage('Tutorial review progress reset.');
    }
  }

  return (
    <section
      id="tutorial-study-deck"
      aria-labelledby="tutorial-study-deck-title"
      className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_2px_12px_rgba(22,22,26,0.035)]"
    >
      <header className="border-b border-line bg-[linear-gradient(135deg,var(--color-accent-soft),var(--color-canvas)_62%)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-accent/25 bg-canvas p-2.5 text-accent-strong">
              <BrainCircuit aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
                Spaced retrieval lab · 12 teach-back cards
              </p>
              <h2
                id="tutorial-study-deck-title"
                className="font-display mt-1 text-2xl font-bold tracking-[-0.03em] text-ink"
              >
                Practice re-explaining the architecture
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
                Due reviews come first, then unseen cards. Scheduling stays in this browser and is
                never written to Auteur SQLite, publication state, or the public website.
              </p>
            </div>
          </div>
          {Object.keys(progress.states).length > 0 ||
          progress.reviewLog.length > 0 ||
          progress.updatedAt !== null ? (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Reset local progress
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
              <span>{summary.mastered} cards in review</span>
              <span>{summary.due} due now</span>
            </div>
            <div
              role="progressbar"
              aria-label="Teach-back cards graduated to review"
              aria-valuemin={0}
              aria-valuemax={summary.total}
              aria-valuenow={summary.mastered}
              aria-valuetext={`${summary.mastered} of ${summary.total} cards in review`}
              className="mt-2 h-3 overflow-hidden rounded-full border border-line-strong bg-surface-muted"
            >
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${(summary.mastered / summary.total) * 100}%` }}
              />
            </div>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center">
            {(['new', 'learning', 'relearning', 'review'] as const).map((phase) => (
              <div key={phase} className="rounded-lg border border-line bg-canvas px-2 py-1.5">
                <dt className="text-[9px] capitalize text-ink-faint">{phase}</dt>
                <dd className="font-mono text-xs font-semibold tabular-nums text-ink">
                  {summary.byPhase[phase]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
        <section
          ref={focusUpdatedPanel}
          tabIndex={-1}
          aria-label={activeCard ? `Current card: ${activeCard.title}` : 'Study session status'}
          className="outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-focus"
        >
          {activeCard && activeState ? (
            <TeachBackReviewCard
              key={activeCard.id}
              card={activeCard}
              state={activeState}
              now={now}
              remaining={deck.length}
              onRate={handleRate}
            />
          ) : (
            <div className="rounded-2xl border border-success/25 bg-success-soft/35 p-6 text-center">
              <CheckCircle2 aria-hidden="true" className="mx-auto size-6 text-success-strong" />
              <h3 className="font-display mt-3 text-lg font-bold text-ink">
                All due cards reviewed
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {futureDueDates[0]
                  ? `Your next review is scheduled for ${formatNextDue(futureDueDates[0])}.`
                  : 'Complete a card to begin a durable review schedule.'}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
                <Clock3 aria-hidden="true" className="size-3.5" />
                Browser-local schedule · version 1
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
