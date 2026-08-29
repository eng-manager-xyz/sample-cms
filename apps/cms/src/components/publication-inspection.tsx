import { useMutation } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Database,
  FileCheck2,
  GitCompareArrows,
  Globe2,
  History,
  LockKeyhole,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { ScenarioSwitcher } from '@/components/scenario-switcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonClassName } from '@/components/ui/button-styles';
import { Card } from '@/components/ui/card';
import type { PublicationRecord, ScenarioFixture } from '@/data/scenario-fixtures';
import { scenarioFixtures } from '@/data/scenario-fixtures';
import type { CmsWorkspaceSnapshot } from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';
import { executeCmsMutation } from '@/server-functions/cms.functions';

function PublicationCard({
  publication,
  selected,
  onSelect,
}: Readonly<{
  publication: PublicationRecord;
  selected: boolean;
  onSelect: () => void;
}>) {
  const stateTone =
    publication.state === 'active'
      ? 'success'
      : publication.state === 'candidate'
        ? 'info'
        : 'neutral';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl border bg-canvas p-4 text-left outline-none transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-focus',
        selected
          ? 'border-accent/45 shadow-[0_0_0_3px_var(--color-accent-soft)]'
          : 'border-line hover:border-line-strong'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge dot tone={stateTone} className="capitalize">
            {publication.state}
          </Badge>
          <h3 className="mt-2 text-sm font-semibold text-ink">{publication.label}</h3>
          <p className="mt-0.5 text-[10px] text-ink-faint">{publication.createdAt}</p>
        </div>
        {publication.state === 'active' ? (
          <ShieldCheck aria-label="Current serving pointer" className="size-5 text-success" />
        ) : publication.state === 'rollback' ? (
          <History aria-label="Retained rollback target" className="size-5 text-ink-faint" />
        ) : (
          <FileCheck2 aria-label="Candidate snapshot" className="size-5 text-accent" />
        )}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-ink-muted">{publication.description}</p>
      <dl className="mt-3 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-subtle">
        <div className="px-2 py-2">
          <dt className="text-[8px] text-ink-faint">Pages</dt>
          <dd className="mt-0.5 text-[10px] font-semibold tabular-nums text-ink">
            {publication.pageCount.toLocaleString()}
          </dd>
        </div>
        <div className="px-2 py-2">
          <dt className="text-[8px] text-ink-faint">Manifests</dt>
          <dd className="mt-0.5 text-[10px] font-semibold tabular-nums text-ink">
            {publication.manifestCount.toLocaleString()}
          </dd>
        </div>
        <div className="px-2 py-2">
          <dt className="text-[8px] text-ink-faint">Compile</dt>
          <dd className="mt-0.5 text-[10px] font-semibold tabular-nums text-ink">
            {publication.duration}
          </dd>
        </div>
      </dl>
      <code className="mt-3 block truncate font-mono text-[8px] text-ink-faint">
        {publication.hash}
      </code>
    </button>
  );
}

function RequestTrace({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const [selectedCaseId, setSelectedCaseId] = useState(scenario.requestCases[0]?.id ?? '');
  const selectedCase =
    scenario.requestCases.find((requestCase) => requestCase.id === selectedCaseId) ??
    scenario.requestCases[0];

  if (!selectedCase) return null;

  const steps = [
    {
      icon: Globe2,
      owner: 'Camo Press',
      title: 'Route authority',
      detail: `External route ${selectedCase.externalRouteId} is ${selectedCase.lifecycle.replace('_', ' ')}.`,
    },
    {
      icon: ArrowRight,
      owner: 'Transition seam',
      title: 'Template + page identity',
      detail: 'Passes stable IDs; no selector SQL runs.',
    },
    {
      icon: Database,
      owner: 'Auteur',
      title: 'Manifest lookup',
      detail:
        selectedCase.auteurState === 'published'
          ? 'Reads the active immutable document by canonical URL.'
          : selectedCase.auteurState === 'draft_only'
            ? 'Draft authoring exists but is not on the serving pointer.'
            : 'No active manifest exists; the seam rejects the unsafe state.',
    },
    {
      icon: FileCheck2,
      owner: 'Response',
      title: `HTTP ${selectedCase.outcome}`,
      detail: selectedCase.explanation,
    },
  ] as const;
  return (
    <section
      aria-labelledby="request-trace-heading"
      className="rounded-xl border border-line bg-canvas"
    >
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              Serving boundary
            </p>
            <h2 id="request-trace-heading" className="mt-0.5 text-sm font-semibold text-ink">
              Camo Press → Auteur request trace
            </h2>
          </div>
          <Badge
            tone={
              selectedCase.outcome === 200
                ? 'success'
                : selectedCase.outcome === 503
                  ? 'danger'
                  : 'neutral'
            }
            dot
          >
            {selectedCase.outcome === 200
              ? 'request safe'
              : selectedCase.outcome === 503
                ? 'unsafe seam blocked'
                : 'route gated'}
          </Badge>
        </div>
        <code className="mt-2 block truncate rounded-md bg-surface-subtle px-2 py-1.5 font-mono text-[9px] text-ink-muted">
          GET {selectedCase.canonicalUrl}
        </code>
        <fieldset className="mt-3 flex flex-wrap gap-1.5 border-0 p-0">
          <legend className="sr-only">Request outcome fixtures</legend>
          {scenario.requestCases.map((requestCase) => (
            <Button
              key={requestCase.id}
              variant={requestCase.id === selectedCase.id ? 'default' : 'outline'}
              size="sm"
              aria-pressed={requestCase.id === selectedCase.id}
              onClick={() => setSelectedCaseId(requestCase.id)}
            >
              {requestCase.label} · {requestCase.outcome}
            </Button>
          ))}
        </fieldset>
      </div>
      <ol className="grid gap-px bg-line md:grid-cols-4">
        {steps.map(({ icon: Icon, owner, title, detail }, index) => (
          <li key={title} className="relative bg-canvas p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent-strong">
                <Icon aria-hidden="true" className="size-3.5" />
              </span>
              <span className="text-[9px] font-semibold tabular-nums text-ink-faint">
                0{index + 1}
              </span>
            </div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {owner}
            </p>
            <h3 className="mt-1 text-[11px] font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-[9px] leading-4 text-ink-muted">{detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PublicationInspection({
  scenario,
  initialWorkspace,
}: Readonly<{ scenario: ScenarioFixture; initialWorkspace: CmsWorkspaceSnapshot }>) {
  const candidate = scenario.publications.find((publication) => publication.state === 'candidate');
  const active = scenario.publications.find((publication) => publication.state === 'active');
  const rollback = scenario.publications.find((publication) => publication.state === 'rollback');
  const [selectedId, setSelectedId] = useState(active?.id ?? scenario.publications[0]?.id ?? '');
  const [rollbackPreview, setRollbackPreview] = useState(false);
  const [publishPreview, setPublishPreview] = useState(false);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [actionStatus, setActionStatus] = useState(
    `Serving ${initialWorkspace.currentPublicationId ?? 'no active publication'}.`
  );
  const publicationMutation = useMutation({
    mutationFn: (kind: 'publish' | 'rollback') =>
      executeCmsMutation({ data: { kind, scenarioId: scenario.id } }),
    onSuccess: (result) => {
      setWorkspace(result.workspace);
      setActionStatus(result.message);
      setPublishPreview(false);
      setRollbackPreview(false);
    },
    onError: (error) => setActionStatus(error instanceof Error ? error.message : String(error)),
  });
  const selected =
    scenario.publications.find((publication) => publication.id === selectedId) ?? active;

  if (!candidate || !active || !rollback || !selected) return null;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
      <header className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">Publication proof</Badge>
            <Badge tone="success">Live SQLite publication controls</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
            {scenario.name} publications
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-ink-muted">
            Inspect atomic publication, immutable serving state, and the retained rollback target
            before changing the real local pointer.
          </p>
          <p className="mt-2 font-mono text-[9px] text-ink-faint">
            active: {workspace.currentPublicationId ?? 'none'} · {workspace.publicationCount}{' '}
            immutable snapshots · {workspace.currentDocumentHash ?? 'no document hash'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScenarioSwitcher
            scenarios={scenarioFixtures}
            activeId={scenario.id}
            destination="publications"
          />
          <Link
            to="/templates/$templateId"
            params={{ templateId: scenario.id }}
            className={buttonClassName({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Map workspace
          </Link>
        </div>
      </header>

      <RequestTrace scenario={scenario} />

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section aria-labelledby="publication-history-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                  Immutable history
                </p>
                <h2
                  id="publication-history-heading"
                  className="mt-0.5 text-sm font-semibold text-ink"
                >
                  Candidate, active, and rollback snapshots
                </h2>
              </div>
              <span className="text-[9px] text-ink-faint">select a snapshot to inspect</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {scenario.publications.map((publication) => (
                <PublicationCard
                  key={publication.id}
                  publication={publication}
                  selected={publication.id === selected.id}
                  onSelect={() => setSelectedId(publication.id)}
                />
              ))}
            </div>
          </section>

          <section
            aria-labelledby="pointer-heading"
            className="rounded-xl border border-line bg-canvas p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                  Atomic pointer
                </p>
                <h2 id="pointer-heading" className="mt-0.5 text-sm font-semibold text-ink">
                  One transaction changes what serving reads
                </h2>
              </div>
              <Badge tone="success">
                <LockKeyhole aria-hidden="true" className="mr-1 size-3" />
                immutable snapshots
              </Badge>
            </div>
            <div className="mt-4 grid items-center gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="rounded-lg border border-line bg-surface-subtle p-3">
                <p className="text-[8px] font-semibold uppercase text-ink-faint">Before</p>
                <p className="mt-1 text-[11px] font-semibold text-ink">active → {active.id}</p>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="mx-auto size-4 rotate-90 text-ink-faint md:rotate-0"
              />
              <div className="rounded-lg border border-accent/25 bg-accent-soft p-3">
                <p className="text-[8px] font-semibold uppercase text-accent-strong">Transaction</p>
                <p className="mt-1 text-[11px] font-semibold text-ink">validate + swap pointer</p>
              </div>
              <ArrowRight
                aria-hidden="true"
                className="mx-auto size-4 rotate-90 text-ink-faint md:rotate-0"
              />
              <div className="rounded-lg border border-line bg-surface-subtle p-3">
                <p className="text-[8px] font-semibold uppercase text-ink-faint">After</p>
                <p className="mt-1 text-[11px] font-semibold text-ink">active → {candidate.id}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 rounded-lg border border-line bg-surface-subtle p-3">
              <RefreshCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-[9px] leading-4 text-ink-muted">
                If compilation or pointer activation fails, the transaction rolls back and public
                serving continues reading {active.label}. No partially published page set becomes
                visible.
              </p>
            </div>
          </section>

          <section
            aria-labelledby="publication-diff-heading"
            className="rounded-xl border border-line bg-canvas"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                  Manifest comparison
                </p>
                <h2 id="publication-diff-heading" className="mt-0.5 text-sm font-semibold text-ink">
                  {selected.label} vs active publication
                </h2>
              </div>
              <GitCompareArrows aria-hidden="true" className="size-4 text-accent" />
            </div>
            <div className="grid gap-px bg-line sm:grid-cols-3">
              <div className="bg-canvas p-4">
                <p className="text-[9px] text-ink-faint">Changed placements</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {
                    scenario.pin.placements.filter((placement) => placement.diff === 'changed')
                      .length
                  }
                </p>
              </div>
              <div className="bg-canvas p-4">
                <p className="text-[9px] text-ink-faint">Tombstones</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                  {
                    scenario.pin.placements.filter((placement) => placement.diff === 'hidden')
                      .length
                  }
                </p>
              </div>
              <div className="bg-canvas p-4">
                <p className="text-[9px] text-ink-faint">Conflicts</p>
                <p
                  className={cn(
                    'mt-1 text-lg font-semibold tabular-nums',
                    candidate.conflictCount > 0 ? 'text-danger-strong' : 'text-success-strong'
                  )}
                >
                  {candidate.conflictCount}
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[72px]">
          <Card className="overflow-hidden">
            <div className="border-b border-line p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                Publication actions
              </p>
              <h2 className="mt-0.5 text-sm font-semibold text-ink">Guarded pointer preview</h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex gap-2 rounded-lg border border-accent/25 bg-accent-soft p-3 text-accent-strong">
                <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold">Live command boundary</p>
                  <p className="mt-0.5 text-[9px] leading-4">
                    Confirmation validates the current SQLite revisions and conflicts. The fixture
                    comparison to the left is explanatory and does not control this action.
                  </p>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={publicationMutation.isPending}
                onClick={() => setPublishPreview((value) => !value)}
              >
                <Database aria-hidden="true" className="size-3.5" />
                Review live SQLite publish
              </Button>
              {publishPreview ? (
                <div
                  role="status"
                  className="rounded-lg border border-accent/25 bg-accent-soft p-3"
                >
                  <p className="text-[10px] font-semibold text-accent-strong">Ready to persist</p>
                  <p className="mt-1 text-[9px] leading-4 text-ink-muted">
                    The service will compile the current authoring revisions, write immutable rows,
                    and atomically replace {workspace.currentPublicationId ?? 'the empty pointer'}.
                  </p>
                  <Button
                    className="mt-2 w-full"
                    size="sm"
                    disabled={publicationMutation.isPending}
                    onClick={() => publicationMutation.mutate('publish')}
                  >
                    Confirm publish to SQLite
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex items-center gap-2">
                <RotateCcw aria-hidden="true" className="size-4 text-ink-muted" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                    Rollback
                  </p>
                  <h2 className="mt-0.5 text-sm font-semibold text-ink">
                    Restore retained SQLite target
                  </h2>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-lg bg-surface-subtle p-3">
                <p className="text-[9px] leading-4 text-ink-muted">
                  Rollback repoints serving to an existing immutable snapshot. It never recompiles
                  or mutates the retained publication.
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-[9px] text-ink-faint">
                  <Clock3 aria-hidden="true" className="size-3" />
                  {workspace.rollbackPublicationId ?? 'No retained predecessor'}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setRollbackPreview((value) => !value)}
              >
                Preview rollback
              </Button>
              {rollbackPreview ? (
                <div className="rounded-lg border border-warning/30 bg-warning-soft p-3">
                  <p className="text-[10px] font-semibold text-warning-strong">
                    Confirmation preview
                  </p>
                  <p className="mt-1 text-[9px] leading-4 text-ink-muted">
                    Changes only the active pointer to the retained predecessor. No immutable
                    publication rows are rewritten.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRollbackPreview(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={publicationMutation.isPending || !workspace.rollbackPublicationId}
                      onClick={() => publicationMutation.mutate('rollback')}
                    >
                      Confirm rollback
                    </Button>
                  </div>
                </div>
              ) : null}
              {!workspace.rollbackPublicationId ? (
                <p className="text-[8px] leading-4 text-ink-faint">
                  The current SQLite publication has no retained predecessor.
                </p>
              ) : (
                <p className="truncate font-mono text-[8px] text-ink-faint">
                  live target: {workspace.rollbackPublicationId}
                </p>
              )}
            </div>
          </Card>
          <Card className="p-3">
            <p className="text-[9px] font-semibold uppercase text-ink-faint">
              SQLite action status
            </p>
            <p role="status" className="mt-1 text-[9px] leading-4 text-ink-muted">
              {actionStatus}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
