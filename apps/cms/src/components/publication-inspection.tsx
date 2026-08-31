import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, FileClock, FilePenLine, History, Info, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import type { AuthoringTemplateOption } from '@/components/authoring/authoring-context-navigation';
import { Badge } from '@/components/ui/badge';
import { buttonClassName } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { type TemplateKey, TemplateKeySchema } from '@/data/scenario-fixtures';
import type {
  CmsPublicationHistory,
  CmsPublicationHistoryRow,
  CmsWorkspaceSnapshot,
} from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

export type ReleaseHistoryFilter = 'all' | 'active' | 'rollback' | 'history' | 'failed';

const releaseDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

function releaseDate(value: string | null): string {
  if (!value) return 'Not completed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${releaseDateFormatter.format(date)} UTC`;
}

export function filterPublicationHistory(
  rows: readonly CmsPublicationHistoryRow[],
  filter: ReleaseHistoryFilter
): readonly CmsPublicationHistoryRow[] {
  if (filter === 'active') return rows.filter((row) => row.isCurrent);
  if (filter === 'rollback') return rows.filter((row) => row.isRollbackTarget);
  if (filter === 'failed') return rows.filter((row) => row.status === 'failed');
  if (filter === 'history') {
    return rows.filter(
      (row) => row.status === 'published' && !row.isCurrent && !row.isRollbackTarget
    );
  }
  return rows;
}

function releaseState(row: CmsPublicationHistoryRow): {
  label: string;
  tone: 'danger' | 'info' | 'neutral' | 'success';
  icon: typeof ShieldCheck;
} {
  if (row.status === 'failed') return { label: 'Failed', tone: 'danger', icon: Info };
  if (row.isCurrent) return { label: 'Active', tone: 'success', icon: ShieldCheck };
  if (row.isRollbackTarget) return { label: 'Rollback target', tone: 'info', icon: History };
  return { label: 'Immutable history', tone: 'neutral', icon: FileClock };
}

export function PublicationContextNavigation({
  scenario,
  scenarios,
  canonicalUrl,
  releaseCount,
}: Readonly<{
  scenario: AuthoringTemplateOption;
  scenarios: readonly AuthoringTemplateOption[];
  canonicalUrl: string;
  releaseCount: number;
}>) {
  const selectId = useId();
  const navigate = useNavigate();

  const chooseTemplate = (scenarioId: TemplateKey) => {
    void navigate({
      to: '/publications/$templateId',
      params: { templateId: scenarioId },
      search: {},
    });
  };

  return (
    <nav
      aria-label="Release history context"
      className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden"
    >
      <span className="sr-only">Template context: {scenario.name}</span>
      <label className="sr-only" htmlFor={selectId}>
        Template
      </label>
      <Select
        id={selectId}
        density="compact"
        className="w-auto max-w-40 shrink-0 font-medium"
        value={scenario.id}
        title="Template"
        onChange={(event) => chooseTemplate(TemplateKeySchema.parse(event.currentTarget.value))}
      >
        {scenarios.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      <span aria-hidden="true" className="shrink-0 text-ink-faint">
        /
      </span>
      <span className="shrink-0 text-xs font-medium text-ink">Release history</span>
      <Badge tone="neutral" className="h-5 shrink-0 px-1.5 text-[10px]">
        {releaseCount} {releaseCount === 1 ? 'release' : 'releases'}
      </Badge>
      <span className="sr-only">Return page context: {canonicalUrl}</span>
    </nav>
  );
}

export function PublicationHeaderActions({
  scenarioId,
  canonicalUrl,
}: Readonly<{ scenarioId: TemplateKey; canonicalUrl: string }>) {
  return (
    <nav aria-label="Template workspace views" className="flex items-center gap-1">
      <Link
        to="/author/$templateId"
        params={{ templateId: scenarioId }}
        search={{ canonicalUrl }}
        aria-label="Open template authoring"
        title="Open template authoring"
        className={buttonClassName({ variant: 'outline', size: 'icon-sm' })}
      >
        <FilePenLine aria-hidden="true" className="size-4" />
      </Link>
      <span
        aria-current="page"
        title="Release history"
        className={buttonClassName({ size: 'icon-sm' })}
      >
        <History aria-hidden="true" className="size-4" />
        <span className="sr-only">Release history</span>
      </span>
    </nav>
  );
}

function ReleaseSummary({ history }: Readonly<{ history: CmsPublicationHistory }>) {
  const current = history.rows.find((row) => row.isCurrent);
  const rollback = history.rows.find((row) => row.isRollbackTarget);
  const hasCurrent = history.currentPublicationId !== null;
  const hasRollback = history.rollbackTargetPublicationId !== null;

  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
      <section className="bg-canvas p-4" aria-labelledby="current-release-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Current release
            </p>
            <h2 id="current-release-heading" className="mt-1 text-base font-semibold text-ink">
              {current
                ? `Release #${current.sequence}`
                : hasCurrent
                  ? 'Active release'
                  : 'No active release'}
            </h2>
          </div>
          <span
            className={cn(
              'grid size-8 place-items-center rounded-lg',
              hasCurrent ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-muted'
            )}
          >
            {hasCurrent ? (
              <ShieldCheck aria-hidden="true" className="size-4" />
            ) : (
              <FileClock aria-hidden="true" className="size-4" />
            )}
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-ink-muted">
          {current
            ? `${current.pageCount.toLocaleString()} pages · ${current.manifestCount.toLocaleString()} manifests`
            : hasCurrent
              ? 'The active publication is outside this bounded history window.'
              : 'The template does not have a public serving pointer.'}
        </p>
        <p className="mt-1 text-[10px] text-ink-faint">
          {current
            ? `Activated ${releaseDate(current.activatedAt)}`
            : hasCurrent
              ? history.currentPublicationId
              : 'Publish from authoring first.'}
        </p>
      </section>

      <section className="bg-canvas p-4" aria-labelledby="rollback-release-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Retained predecessor
            </p>
            <h2 id="rollback-release-heading" className="mt-1 text-base font-semibold text-ink">
              {rollback
                ? `Release #${rollback.sequence}`
                : hasRollback
                  ? 'Retained predecessor'
                  : 'No rollback target'}
            </h2>
          </div>
          <span
            className={cn(
              'grid size-8 place-items-center rounded-lg',
              hasRollback ? 'bg-accent-soft text-accent-strong' : 'bg-surface-muted text-ink-muted'
            )}
          >
            <History aria-hidden="true" className="size-4" />
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-ink-muted">
          {rollback
            ? 'This exact immutable predecessor is the only release currently eligible for rollback.'
            : hasRollback
              ? 'The retained predecessor is outside this bounded history window.'
              : 'The active release does not retain a predecessor.'}
        </p>
        <p className="mt-1 text-[10px] text-ink-faint">
          Rollback is reviewed from the authoring publication flow.
        </p>
      </section>

      <section className="bg-canvas p-4" aria-labelledby="release-count-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Immutable records
            </p>
            <h2 id="release-count-heading" className="mt-1 text-base font-semibold text-ink">
              {history.total.toLocaleString()} total
            </h2>
          </div>
          <span className="grid size-8 place-items-center rounded-lg bg-surface-muted text-ink-muted">
            <FileClock aria-hidden="true" className="size-4" />
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-ink-muted">
          Each successful publish records the compiled template state, counts, author, and input
          hash.
        </p>
        <p className="mt-1 text-[10px] text-ink-faint">Newest sequence first · template scoped</p>
      </section>
    </div>
  );
}

function ReleaseRow({ row }: Readonly<{ row: CmsPublicationHistoryRow }>) {
  const state = releaseState(row);
  const StateIcon = state.icon;

  return (
    <tr data-release-state={state.label.toLowerCase().replaceAll(' ', '-')}>
      <td className="border-t border-line px-4 py-3 align-top">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg',
              row.isCurrent
                ? 'bg-success-soft text-success'
                : row.isRollbackTarget
                  ? 'bg-accent-soft text-accent-strong'
                  : 'bg-surface-muted text-ink-muted'
            )}
          >
            <StateIcon aria-hidden="true" className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink">Release #{row.sequence}</p>
            <code className="mt-0.5 block max-w-52 truncate font-mono text-[9px] text-ink-faint">
              {row.id}
            </code>
          </div>
        </div>
      </td>
      <td className="border-t border-line px-4 py-3 align-top">
        <Badge dot tone={state.tone} className="whitespace-nowrap">
          {state.label}
        </Badge>
      </td>
      <td className="border-t border-line px-4 py-3 align-top text-[11px] text-ink-muted">
        <p>{releaseDate(row.publishedAt)}</p>
        <p className="mt-0.5 text-[9px] text-ink-faint">{row.createdBy}</p>
      </td>
      <td className="border-t border-line px-4 py-3 align-top">
        <p className="text-[11px] tabular-nums text-ink">{row.pageCount.toLocaleString()} pages</p>
        <p className="mt-0.5 text-[9px] tabular-nums text-ink-faint">
          {row.manifestCount.toLocaleString()} manifests
        </p>
      </td>
      <td className="border-t border-line px-4 py-3 align-top">
        <details className="group max-w-72">
          <summary className="cursor-pointer list-none text-[10px] font-medium text-accent-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus">
            Technical details
          </summary>
          <dl className="mt-2 space-y-1.5 text-[9px] text-ink-faint">
            <div>
              <dt className="font-semibold text-ink-muted">Input hash</dt>
              <dd className="break-all font-mono">{row.inputHash}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-muted">Previous publication</dt>
              <dd className="break-all font-mono">{row.previousPublicationId ?? 'none'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-muted">Created</dt>
              <dd>{releaseDate(row.createdAt)}</dd>
            </div>
          </dl>
        </details>
      </td>
    </tr>
  );
}

export function PublicationInspection({
  scenario,
  workspace,
  history,
}: Readonly<{
  scenario: AuthoringTemplateOption;
  workspace: CmsWorkspaceSnapshot;
  history: CmsPublicationHistory;
}>) {
  const filterId = useId();
  const [filter, setFilter] = useState<ReleaseHistoryFilter>('all');
  const filteredRows = filterPublicationHistory(history.rows, filter);
  const authoringSearch = { canonicalUrl: workspace.canonicalUrl };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
      <header className="border-b border-line pb-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">Template lifecycle</Badge>
            <Badge tone="success" dot>
              Live SQLite history
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
            Release history
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-ink-muted">
            Review immutable publications for {scenario.name}. A release compiles every eligible
            page in this template and atomically moves one serving pointer.
          </p>
        </div>
      </header>

      <div className="mt-5 rounded-xl border border-accent/20 bg-accent-soft/50 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-accent-strong shadow-sm">
            <Info aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 className="text-xs font-semibold text-ink">What a release represents</h2>
            <p className="mt-1 max-w-4xl text-[11px] leading-5 text-ink-muted">
              Publication records are immutable snapshots owned by this template. The active badge
              marks the snapshot serving public pages; the rollback badge marks its exact retained
              predecessor. Publishing and rollback stay in Authoring so both operations use the same
              guarded preflight and concurrency checks.
            </p>
            <Link
              to="/author/$templateId"
              params={{ templateId: scenario.id }}
              search={authoringSearch}
              className="mt-2 inline-flex text-[11px] font-semibold text-accent-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              Open authoring to review changes
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <ReleaseSummary history={history} />
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Selected template
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-ink">{scenario.name} releases</h2>
            <p className="mt-1 text-[10px] text-ink-muted">
              Showing {filteredRows.length.toLocaleString()} of {history.total.toLocaleString()}{' '}
              immutable records.
            </p>
          </div>
          <label
            htmlFor={filterId}
            className="flex items-center gap-2 text-[10px] font-medium text-ink-muted"
          >
            Show
            <Select
              id={filterId}
              density="compact"
              aria-label="Filter release history"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value as ReleaseHistoryFilter)}
            >
              <option value="all">All releases</option>
              <option value="active">Active release</option>
              <option value="rollback">Rollback target</option>
              <option value="history">Older releases</option>
              <option value="failed">Failed attempts</option>
            </Select>
          </label>
        </div>

        {filteredRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="bg-surface-muted/70">
                <tr>
                  {['Release', 'State', 'Published', 'Materialized', 'Details'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <ReleaseRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center p-6 text-center">
            <div>
              <CheckCircle2 aria-hidden="true" className="mx-auto size-6 text-ink-faint" />
              <p className="mt-2 text-xs font-medium text-ink">
                {history.total === 0 ? 'No releases yet' : 'No records match this filter'}
              </p>
              <p className="mt-1 text-[10px] text-ink-muted">
                {history.total === 0
                  ? 'Open Authoring and review publication when this template is ready.'
                  : 'Choose All releases to restore history.'}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
