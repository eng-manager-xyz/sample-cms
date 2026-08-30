import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from 'lucide-react';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire';
import {
  chapterQuestionnaires,
  type QuestionnaireScore,
  scoreQuestionnaire,
} from '@/content/tutorial/tutorial-learning';

const questionnaireByChapterId = new Map(
  chapterQuestionnaires.map((questionnaire) => [questionnaire.chapterId, questionnaire] as const)
);

const questionnaireItemsById = new Map(
  chapterQuestionnaires.map((questionnaire) => [
    questionnaire.id,
    questionnaire.questions.map((question) => ({
      name: question.id,
      required: true,
      choices: question.options.map((_option, optionIndex) => ({ value: String(optionIndex) })),
    })),
  ])
);

export function ChapterQuestionnaire({ chapterId }: Readonly<{ chapterId: string }>) {
  const headingId = useId();
  const resultHeadingId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const [score, setScore] = useState<QuestionnaireScore | null>(null);
  const questionnaire = questionnaireByChapterId.get(chapterId);

  useEffect(() => {
    if (score) resultRef.current?.focus();
  }, [score]);

  if (!questionnaire) return null;

  const items = questionnaireItemsById.get(questionnaire.id) ?? [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const answers: Record<string, number> = {};

    for (const question of questionnaire.questions) {
      const selected = formData.get(question.id);
      if (typeof selected === 'string') answers[question.id] = Number(selected);
    }

    setScore(scoreQuestionnaire(questionnaire, answers));
  };

  const handleReset = () => {
    setScore(null);
    window.requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="border-t border-line bg-[linear-gradient(135deg,var(--color-accent-soft),var(--color-canvas)_55%)] px-5 py-7 sm:px-7 sm:py-8"
    >
      <div className="mx-auto max-w-3xl">
        <header className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg border border-accent/25 bg-canvas p-2 text-accent-strong">
            <CircleHelp aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
              Retrieval checkpoint · 3 questions
            </p>
            <h3 id={headingId} className="font-display mt-1 text-xl font-bold text-ink">
              Check whether you can use Chapter {questionnaire.chapterNumber}
            </h3>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              Answer from memory first. Keyboard: A–E chooses an option, Enter advances, and the
              arrow keys move through choices.
            </p>
          </div>
        </header>

        <Questionnaire
          ref={formRef}
          items={items}
          shortcuts="letters"
          onReset={handleReset}
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-line bg-canvas p-4 shadow-sm sm:p-5"
        >
          <div
            hidden={score !== null}
            inert={score ? true : undefined}
            aria-hidden={score ? true : undefined}
            className={score ? 'hidden' : undefined}
          >
            <QuestionnaireProgress />
            {questionnaire.questions.map((question) => (
              <QuestionnaireItem key={question.id} name={question.id} required>
                <QuestionnaireTitle className="mt-4">{question.prompt}</QuestionnaireTitle>
                <QuestionnaireDescription>
                  Choose the answer that preserves the architecture contract.
                </QuestionnaireDescription>
                <QuestionnaireChoices>
                  {question.options.map((option, optionIndex) => (
                    <QuestionnaireChoice key={option} value={String(optionIndex)}>
                      {option}
                    </QuestionnaireChoice>
                  ))}
                </QuestionnaireChoices>
                <QuestionnaireError />
              </QuestionnaireItem>
            ))}
            <QuestionnaireActions>
              <QuestionnairePrevious />
              <QuestionnaireNext />
              <QuestionnaireSubmit />
            </QuestionnaireActions>
          </div>

          {score ? (
            <section
              ref={resultRef}
              tabIndex={-1}
              aria-labelledby={resultHeadingId}
              aria-live="polite"
              className="rounded-xl border border-line bg-surface-subtle p-4 outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
                    Attempt result
                  </p>
                  <p id={resultHeadingId} className="font-display mt-1 text-lg font-bold text-ink">
                    {score.correct} of {score.total} correct · {score.percentage}%
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ink-muted">
                    {score.mastered
                      ? 'You recalled every contract. Explain the chapter aloud before moving on.'
                      : 'Read the explanations, revisit the linked section concepts, then try again.'}
                  </p>
                </div>
                <Button type="reset" variant="outline" size="sm">
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  Try again
                </Button>
              </div>

              <ol className="mt-4 grid gap-3">
                {score.results.map((result, resultIndex) => {
                  const question = questionnaire.questions[resultIndex];
                  if (!question) return null;
                  const selectedAnswer =
                    result.selectedIndex === null
                      ? 'No answer'
                      : question.options[result.selectedIndex];
                  return (
                    <li
                      key={result.questionId}
                      className="rounded-lg border border-line bg-canvas p-3"
                    >
                      <div className="flex items-start gap-2">
                        {result.correct ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-success-strong"
                          />
                        ) : (
                          <XCircle
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-danger-strong"
                          />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            {result.correct ? 'Correct' : 'Needs another look'} — {selectedAnswer}
                          </p>
                          {!result.correct ? (
                            <p className="mt-1 text-xs text-ink-muted">
                              Correct answer:{' '}
                              <strong className="font-semibold text-ink">
                                {question.options[question.answerIndex]}
                              </strong>
                            </p>
                          ) : null}
                          <p className="mt-1 font-serif text-[13px] leading-5 text-ink-muted">
                            {result.explanation}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </Questionnaire>
      </div>
    </section>
  );
}
