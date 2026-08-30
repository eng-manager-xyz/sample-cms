import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Gauge,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { ChapterQuestionnaire } from '@/components/tutorial/chapter-questionnaire';
import { TutorialMarkdown } from '@/components/tutorial/tutorial-markdown';
import { TutorialMediaLegend, TutorialSectionMedia } from '@/components/tutorial/tutorial-media';
import {
  ContentAnatomyFigure,
  ScenarioComparisonFigure,
} from '@/components/tutorial/tutorial-semantic-figures';
import { TutorialStudyDeck } from '@/components/tutorial/tutorial-study-deck';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { tutorialCurriculum } from '@/content/tutorial/tutorial-content';
import type { TutorialChapter, TutorialSection } from '@/content/tutorial/tutorial-curriculum';
import type { CmsHealthSummary } from '@/server-functions/cms.functions';

type ActiveVisualChange = (visualId: string | null) => void;

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: Readonly<{
  label: string;
  value: string;
  detail: string;
  icon: typeof BookOpenText;
}>) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
            {label}
          </p>
          <p className="font-display mt-1 text-xl font-bold tracking-[-0.025em] text-ink">
            {value}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-ink-muted">{detail}</p>
        </div>
        <span className="rounded-lg border border-accent/20 bg-accent-soft p-2 text-accent-strong">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
    </Card>
  );
}

function HealthSummary({ health }: Readonly<{ health: CmsHealthSummary }>) {
  return (
    <Card
      className={
        health.healthy
          ? 'border-success/30 bg-success-soft/30 p-4'
          : 'border-danger/30 bg-danger-soft/35 p-4'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={
              health.healthy
                ? 'rounded-lg border border-success/25 bg-canvas p-2 text-success-strong'
                : 'rounded-lg border border-danger/25 bg-canvas p-2 text-danger-strong'
            }
          >
            <Database aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="font-display text-sm font-bold text-ink">
              {health.healthy
                ? 'Executable SQLite baseline is healthy'
                : 'SQLite baseline needs attention'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-ink-muted">
              Schema v{health.schemaVersion} · {health.templateCount.toLocaleString()} templates ·{' '}
              {health.pageCount.toLocaleString()} pages · {health.publicationCount.toLocaleString()}{' '}
              publications
            </p>
          </div>
        </div>
        <Badge tone={health.healthy ? 'success' : 'danger'} dot>
          {health.healthy ? 'live evidence surface' : 'health check failed'}
        </Badge>
      </div>
      {health.problems.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[10px] leading-4 text-danger-strong">
          {health.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function TutorialContents({ chapters }: Readonly<{ chapters: TutorialChapter[] }>) {
  return (
    <aside className="print:hidden">
      <Card className="overflow-hidden xl:flex xl:max-h-[calc(100dvh-88px)] xl:flex-col">
        <div className="shrink-0 border-b border-line p-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-accent-strong">
            Tutorial contents
          </p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Follow the dependency chain or jump to a review question.
          </p>
        </div>
        <nav
          aria-label="Tutorial chapters"
          className="p-2 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:[scrollbar-gutter:stable]"
        >
          <ol className="space-y-1">
            {chapters.map((chapter) => (
              <li
                key={chapter.id}
                className="rounded-lg border border-transparent p-2 hover:border-line hover:bg-surface-subtle"
              >
                <a
                  href={`#chapter-${chapter.id}`}
                  className="group flex items-start gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-ink text-[10px] font-semibold text-canvas">
                    {chapter.number}
                  </span>
                  <span>
                    <span className="font-display block text-xs font-bold leading-4 text-ink group-hover:text-accent-strong">
                      {chapter.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-ink-faint">
                      {chapter.kicker}
                    </span>
                  </span>
                </a>
                <ol className="mt-2 space-y-0.5 border-l border-line pl-3">
                  {chapter.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#section-${section.id}`}
                        className="block rounded px-1.5 py-1 text-[10px] leading-4 text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <span className="font-mono text-ink-faint">{section.number}</span>{' '}
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <a
            href="#tutorial-study-deck"
            className="font-display mt-3 flex min-h-10 items-center justify-between rounded-lg border border-accent/20 bg-accent-soft/40 px-3 text-xs font-bold text-accent-strong outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-focus"
          >
            Spaced retrieval lab
            <span className="font-mono text-[10px] font-medium">12 cards</span>
          </a>
        </nav>
      </Card>
    </aside>
  );
}

function TimeBreakdown({ section }: Readonly<{ section: TutorialSection }>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge tone="neutral">
        <BookOpenText aria-hidden="true" className="size-3" /> {section.readMinutes} min read
      </Badge>
      {section.mediaMinutes > 0 ? (
        <Badge tone="info">{section.mediaMinutes} min media</Badge>
      ) : null}
      <Badge tone="warning">{section.digestMinutes} min digest</Badge>
    </div>
  );
}

function TutorialSectionArticle({
  section,
  activeVisual,
  onActiveVisualChange,
}: Readonly<{
  section: TutorialSection;
  activeVisual: string | null;
  onActiveVisualChange: ActiveVisualChange;
}>) {
  return (
    <article
      id={`section-${section.id}`}
      className="scroll-mt-24 border-t border-line px-5 py-8 sm:px-7 sm:py-10"
      data-visual={section.visual}
    >
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] font-semibold text-accent-strong">
            Section {section.number}
          </p>
          <TimeBreakdown section={section} />
        </div>
        <h3 className="font-display mt-3 max-w-3xl text-xl font-bold tracking-[-0.025em] text-ink sm:text-2xl">
          {section.title}
        </h3>
        <div className="mt-4 flex gap-3 rounded-xl border border-accent/20 bg-accent-soft/45 p-4">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-strong" />
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-accent-strong">
              Learning outcome
            </p>
            <p className="mt-1 text-[13px] leading-5 text-ink">{section.learningOutcome}</p>
          </div>
        </div>
        {section.prerequisite && section.prerequisiteId ? (
          <p className="mt-3 text-[11px] text-ink-faint">
            Builds on{' '}
            <a
              href={`#section-${section.prerequisiteId}`}
              className="font-medium text-accent-strong underline decoration-accent/30 underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              section {section.prerequisite}
            </a>
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-ink-faint">Entry point · no prerequisite</p>
        )}
      </header>

      <TutorialSectionMedia
        section={section}
        activeVisual={activeVisual}
        onActiveVisualChange={onActiveVisualChange}
      />
      <TutorialMarkdown markdown={section.bodyMarkdown} />

      <aside className="mt-7 rounded-xl border border-warning/30 bg-warning-soft/55 p-4">
        <div className="flex items-start gap-3">
          <Gauge aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-strong" />
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-warning-strong">
              Digest prompt
            </p>
            <p className="font-serif mt-1 text-sm leading-6 text-ink">{section.digestPrompt}</p>
          </div>
        </div>
      </aside>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 font-mono text-[10px] text-ink-faint">
        <span>{section.wordCount.toLocaleString()} parsed words</span>
        <a
          href="#tutorial-contents"
          className="rounded font-medium text-ink-muted hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Back to contents
        </a>
      </footer>
    </article>
  );
}

function TutorialChapterArticle({
  chapter,
  activeVisual,
  onActiveVisualChange,
}: Readonly<{
  chapter: TutorialChapter;
  activeVisual: string | null;
  onActiveVisualChange: ActiveVisualChange;
}>) {
  const chapterDeepStudyMinutes = chapter.sections.reduce(
    (total, section) => total + section.readMinutes + section.mediaMinutes + section.digestMinutes,
    0
  );
  return (
    <section
      id={`chapter-${chapter.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_2px_12px_rgba(22,22,26,0.035)]"
    >
      <header className="border-b border-line bg-surface-subtle px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-sm font-semibold text-canvas">
              {chapter.number}
            </span>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
                {chapter.kicker}
              </p>
              <h2 className="font-display mt-1 text-2xl font-bold tracking-[-0.03em] text-ink">
                {chapter.title}
              </h2>
            </div>
          </div>
          <Badge tone="neutral">
            <Clock3 aria-hidden="true" className="size-3" />{' '}
            {formatMinutes(chapterDeepStudyMinutes)} deep study
          </Badge>
        </div>
        {chapter.introductionMarkdown ? (
          <TutorialMarkdown markdown={chapter.introductionMarkdown} className="mt-4 max-w-3xl" />
        ) : null}
      </header>
      {chapter.sections.map((section) => (
        <TutorialSectionArticle
          key={section.id}
          section={section}
          activeVisual={activeVisual}
          onActiveVisualChange={onActiveVisualChange}
        />
      ))}
      {chapter.number === 2 ? (
        <div className="border-t border-line px-5 py-7 sm:px-7 sm:py-8">
          <ContentAnatomyFigure />
        </div>
      ) : null}
      {chapter.number === 4 ? (
        <div className="border-t border-line px-5 py-7 sm:px-7 sm:py-8">
          <ScenarioComparisonFigure />
        </div>
      ) : null}
      <ChapterQuestionnaire chapterId={chapter.id} />
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-subtle px-5 py-3 font-mono text-[10px] text-ink-faint sm:px-7">
        <span>
          Parsed from <code className="font-mono">{chapter.sourceId}.md</code>
        </span>
        <a
          href="#tutorial-top"
          className="rounded font-medium text-ink-muted hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Return to report top
        </a>
      </footer>
    </section>
  );
}

export function TutorialReport({ health }: Readonly<{ health: CmsHealthSummary }>) {
  const { totals } = tutorialCurriculum;
  const continuousMinutes = totals.readingMinutes + totals.mediaMinutes;
  const [activeVisual, setActiveVisual] = useState<string | null>(null);

  return (
    <div
      id="tutorial-top"
      className="mx-auto w-full max-w-[1580px] px-4 py-6 sm:px-5 sm:py-8 lg:px-7"
    >
      <header className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_2px_14px_rgba(22,22,26,0.04)]">
        <div className="map-grid border-b border-line px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info" dot>
              Architecture field guide
            </Badge>
            <Badge tone="neutral">6 chapters · 24 sections</Badge>
            <Badge tone="neutral">18 checks · 12 teach-back cards</Badge>
            <Badge tone={health.healthy ? 'success' : 'danger'}>
              SQLite schema v{health.schemaVersion}
            </Badge>
          </div>
          <div className="mt-6 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="font-mono text-[11px] font-[600] uppercase tracking-[0.14em] text-accent-strong">
                Read the running system from authoring to render
              </p>
              <h1 className="font-display mt-2 max-w-4xl text-3xl font-[800] tracking-[-0.045em] text-ink sm:text-4xl lg:text-5xl">
                {tutorialCurriculum.title}
              </h1>
              <p className="font-serif mt-4 max-w-3xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
                {tutorialCurriculum.subtitle}
              </p>
              <p className="font-serif mt-4 text-xs italic text-ink-faint">
                For {tutorialCurriculum.audience}
              </p>
            </div>
            <HealthSummary health={health} />
          </div>
        </div>

        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-canvas p-4 sm:p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
              Plan target
            </p>
            <p className="font-display mt-1 text-lg font-bold text-ink">
              {formatMinutes(tutorialCurriculum.totalBudgetMinutes)}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-muted">
              Maximum uninterrupted reading path
            </p>
          </div>
          <div className="bg-canvas p-4 sm:p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
              Read + media path
            </p>
            <p className="font-display mt-1 text-lg font-bold text-success-strong">
              {formatMinutes(continuousMinutes)}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-muted">
              {totals.readingMinutes} min prose · {totals.mediaMinutes} min media
            </p>
          </div>
          <div className="bg-canvas p-4 sm:p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
              Optional deep study
            </p>
            <p className="font-display mt-1 text-lg font-bold text-ink">
              {formatMinutes(totals.scheduledMinutes)}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-muted">
              Adds {totals.digestMinutes} min of deliberate digest prompts
            </p>
          </div>
          <div className="bg-canvas p-4 sm:p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
              Parsed manuscript
            </p>
            <p className="font-display mt-1 text-lg font-bold text-ink">
              {totals.wordCount.toLocaleString()} words
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-muted">
              {tutorialCurriculum.readingSpeedWordsPerMinute} words/min planning rate
            </p>
          </div>
        </div>
      </header>

      <section
        className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Tutorial at a glance"
      >
        <MetricCard
          label="Curriculum"
          value={`${totals.chapterCount} × ${totals.sectionCount}`}
          detail="Chapters and dependency-ordered sections"
          icon={BookOpenText}
        />
        <MetricCard
          label="Runtime path"
          value="CMS → publication → website"
          detail="Validated server functions keep SQLite outside browser modules"
          icon={Route}
        />
        <MetricCard
          label="Compiler rule"
          value="Selectors off serve"
          detail="Preview SQL, server-side resolution, expanded reads or manifest reconstruction"
          icon={ShieldCheck}
        />
        <MetricCard
          label="Handoff"
          value="Evidence linked"
          detail="Measured findings retain source and limitations"
          icon={FileCheck2}
        />
      </section>

      <aside className="mt-4 rounded-xl border border-success/25 bg-success-soft/45 p-4 text-[13px] leading-6 text-ink-muted">
        <strong className="font-semibold text-success-strong">Pacing contract.</strong> Reading
        straight through the prose and media takes {formatMinutes(continuousMinutes)}, leaving{' '}
        {tutorialCurriculum.totalBudgetMinutes - continuousMinutes} minutes inside the three-hour
        cap. The {totals.digestMinutes} minutes of prompts are optional pauses for deeper study, so
        the full reflective path is {formatMinutes(totals.scheduledMinutes)}.
      </aside>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
        <p className="text-xs leading-5 text-ink-muted">
          Interactive visuals explain the model. Persisted claims remain tied to SQLite status and
          repository evidence.
        </p>
        <TutorialMediaLegend />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div id="tutorial-contents" className="scroll-mt-24 xl:sticky xl:top-[72px] xl:self-start">
          <TutorialContents chapters={tutorialCurriculum.chapters} />
        </div>
        <section className="min-w-0 space-y-8" aria-label="Architecture tutorial report">
          {tutorialCurriculum.chapters.map((chapter) => (
            <TutorialChapterArticle
              key={chapter.id}
              chapter={chapter}
              activeVisual={activeVisual}
              onActiveVisualChange={setActiveVisual}
            />
          ))}

          <TutorialStudyDeck />

          <Card className="overflow-hidden border-success/25">
            <div className="flex flex-col gap-4 bg-success-soft/35 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="flex gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-success-strong"
                />
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-success-strong">
                    Review-ready reading path
                  </p>
                  <h2 className="font-display mt-1 text-lg font-bold text-ink">
                    Continue from prose to executable proof
                  </h2>
                  <p className="mt-2 max-w-2xl text-[13px] leading-6 text-ink-muted">
                    Reproduce the bounded and million-row ledgers, inspect the live workbenches, and
                    trace each result back through the current SQLite publication and serving code.
                  </p>
                </div>
              </div>
              <a
                href="#tutorial-top"
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-canvas px-3 text-xs font-medium text-ink outline-none hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus"
              >
                Review from top
                <ArrowRight aria-hidden="true" className="size-3.5 -rotate-90" />
              </a>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
