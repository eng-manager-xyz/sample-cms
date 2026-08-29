import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Database,
  GitBranch,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ScenarioFixture } from '@/data/scenario-fixtures';
import type {
  CmsCommand,
  CmsWorkspaceSnapshot,
  SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';
import {
  executeCmsMutation,
  loadCmsWorkspace,
  previewCmsSelector,
} from '@/server-functions/cms.functions';

function mutationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function SqliteAuthoringWorkbench({
  scenario,
  initialWorkspace,
}: Readonly<{ scenario: ScenarioFixture; initialWorkspace: CmsWorkspaceSnapshot }>) {
  const queryClient = useQueryClient();
  const [scopeId, setScopeId] = useState(initialWorkspace.scopeId);
  const workspaceQuery = useQuery({
    queryKey: ['cms-workspace', scenario.id, scopeId],
    queryFn: () => loadCmsWorkspace({ data: { scenarioId: scenario.id, scopeId } }),
    initialData: scopeId === initialWorkspace.scopeId ? initialWorkspace : undefined,
  });
  const workspace = workspaceQuery.data ?? initialWorkspace;
  const selectedVariant = workspace.variants.find((variant) => variant.id === workspace.scopeId);
  const [selectedPlacementKey, setSelectedPlacementKey] = useState(
    initialWorkspace.placements[0]?.placementKey ?? ''
  );
  const selectedPlacement =
    workspace.placements.find((placement) => placement.placementKey === selectedPlacementKey) ??
    workspace.placements[0];
  const [contentJson, setContentJson] = useState(selectedPlacement?.contentJson ?? '{}');
  const [blockTypeKey, setBlockTypeKey] = useState(selectedPlacement?.blockType ?? 'promo');
  const [addPlacementKey, setAddPlacementKey] = useState('new-promotion');
  const [addBlockTypeKey, setAddBlockTypeKey] = useState('promo');
  const [addContentJson, setAddContentJson] = useState(
    workspace.blockTypes.find((blockType) => blockType.key === 'promo')?.exampleContentJson ?? '{}'
  );
  const [selector, setSelector] = useState(selectedVariant?.selector ?? 'TRUE');
  const [newVariantName, setNewVariantName] = useState('Linked experiment');
  const [newVariantMode, setNewVariantMode] = useState<'linked' | 'empty'>('linked');
  const [newVariantPriority, setNewVariantPriority] = useState(50);
  const [status, setStatus] = useState('SQLite workbench loaded. No pending authoring change.');
  const [selectorPreview, setSelectorPreview] = useState<SelectorPreviewSnapshot | null>(null);

  useEffect(() => {
    if (!selectedPlacement) return;
    setSelectedPlacementKey(selectedPlacement.placementKey);
    setContentJson(selectedPlacement.contentJson);
    setBlockTypeKey(selectedPlacement.blockType);
  }, [selectedPlacement]);

  useEffect(() => {
    setSelector(selectedVariant?.selector ?? 'TRUE');
  }, [selectedVariant?.selector]);

  const mutation = useMutation({
    mutationFn: (command: CmsCommand) => executeCmsMutation({ data: command }),
    onSuccess: (result) => {
      setStatus(result.message);
      setScopeId(result.workspace.scopeId);
      queryClient.setQueryData(
        ['cms-workspace', scenario.id, result.workspace.scopeId],
        result.workspace
      );
      void queryClient.invalidateQueries({ queryKey: ['cms-workspace', scenario.id] });
    },
    onError: (error) => setStatus(`Write rejected: ${mutationError(error)}`),
  });
  const previewMutation = useMutation({
    mutationFn: () => previewCmsSelector({ data: { scenarioId: scenario.id, selector } }),
    onSuccess: (preview) => {
      setSelectorPreview(preview);
      setStatus(
        `Selector preview: ${preview.totalCount.toLocaleString()} of ${preview.templatePageCount.toLocaleString()} pages.`
      );
    },
    onError: (error) => setStatus(`Selector rejected: ${mutationError(error)}`),
  });
  const pending = mutation.isPending || previewMutation.isPending || workspaceQuery.isFetching;

  function run(command: CmsCommand) {
    mutation.mutate(command);
  }

  function chooseAddType(nextType: string) {
    setAddBlockTypeKey(nextType);
    const blockType = workspace.blockTypes.find((candidate) => candidate.key === nextType);
    if (blockType) setAddContentJson(blockType.exampleContentJson);
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      <section className="rounded-xl border border-success/30 bg-success-soft/35 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database aria-hidden="true" className="size-4 text-success-strong" />
              <h3 className="text-sm font-semibold text-ink">Live SQLite authoring</h3>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-ink-muted">
              Every command below crosses a validated TanStack server function and delegates to the
              same immutable block, selector, resolution, and publication services used by tests.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="success">persisted</Badge>
            <Badge tone="neutral" className="font-mono">
              {workspace.templateId}
            </Badge>
            <Badge tone={workspace.currentPublicationId ? 'info' : 'warning'}>
              {workspace.currentPublicationId
                ? `serving ${workspace.currentPublicationId}`
                : 'unpublished'}
            </Badge>
          </div>
        </div>
        <p className="mt-3 rounded-md bg-canvas px-2.5 py-2 font-mono text-[9px] text-ink-muted">
          {workspace.canonicalUrl} · {workspace.placements.length} visible ·{' '}
          {workspace.tombstones.length} tombstoned · {workspace.publicationCount} publications
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-canvas p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label
                htmlFor="sqlite-authoring-scope"
                className="grid min-w-[220px] flex-1 gap-1 text-[9px] font-medium text-ink-muted"
              >
                Authoring scope
                <Select
                  id="sqlite-authoring-scope"
                  value={scopeId}
                  onChange={(event) => setScopeId(event.currentTarget.value)}
                >
                  {workspace.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      P{variant.priority} · {variant.name}
                      {variant.isDefault
                        ? ' · default'
                        : variant.matchesSamplePage
                          ? ''
                          : ' · zero match'}
                    </option>
                  ))}
                </Select>
              </label>
              {!selectedVariant?.isDefault ? (
                <label
                  htmlFor="sqlite-variant-priority"
                  className="grid w-24 gap-1 text-[9px] font-medium text-ink-muted"
                >
                  Priority
                  <Input
                    id="sqlite-variant-priority"
                    type="number"
                    min={1}
                    value={selectedVariant?.priority ?? 1}
                    onChange={(event) => {
                      const priority = Number(event.currentTarget.value);
                      if (Number.isSafeInteger(priority) && priority > 0) {
                        run({
                          kind: 'setVariantPriority',
                          scenarioId: scenario.id,
                          scopeId: workspace.scopeId,
                          priority,
                        });
                      }
                    }}
                  />
                </label>
              ) : null}
            </div>
            {!workspace.scopeMatchesSamplePage ? (
              <p className="mt-3 rounded-md border border-warning/30 bg-warning-soft p-2 text-[9px] text-warning-strong">
                This selector currently matches zero pages. Revise it before copy-on-write or
                publication inspection.
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-xl border border-line bg-canvas">
            <div className="border-b border-line p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                Resolved document
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-ink">
                Select a placement to edit, replace, move, or delete
              </h3>
            </div>
            <ol className="divide-y divide-line">
              {workspace.placements.map((placement, index) => (
                <li key={placement.placementKey}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlacementKey(placement.placementKey)}
                    className={cn(
                      'grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      selectedPlacement?.placementKey === placement.placementKey
                        ? 'bg-accent-soft/70'
                        : 'hover:bg-surface-subtle'
                    )}
                  >
                    <span className="text-[9px] tabular-nums text-ink-faint">{index + 1}</span>
                    <span className="min-w-0">
                      <code className="block truncate font-mono text-[9px] font-semibold text-ink">
                        {placement.placementKey}
                      </code>
                      <span className="block truncate text-[8px] text-ink-faint">
                        {placement.blockType} · {placement.blockVersionId}
                      </span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      <Badge
                        tone={placement.inherited ? 'neutral' : 'info'}
                        className="h-5 text-[8px]"
                      >
                        {placement.inherited
                          ? 'content inherited'
                          : `content P${placement.sourcePriority}`}
                      </Badge>
                      {!placement.orderInherited ? (
                        <Badge tone="warning" className="h-5 text-[8px]">
                          order P{placement.orderSourcePriority}
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {workspace.tombstones.length > 0 ? (
              <div className="border-t border-line bg-danger-soft/35 p-3">
                <p className="text-[9px] font-semibold text-danger-strong">Scoped tombstones</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {workspace.tombstones.map((tombstone) => (
                    <Button
                      key={tombstone.placementKey}
                      size="sm"
                      variant="ghost"
                      className="h-6 border border-danger/25 font-mono text-[8px] text-danger-strong"
                      disabled={pending || selectedVariant?.isDefault}
                      onClick={() =>
                        run({
                          kind: 'revertPlacement',
                          scenarioId: scenario.id,
                          scopeId: workspace.scopeId,
                          placementKey: tombstone.placementKey,
                        })
                      }
                    >
                      <RotateCcw aria-hidden="true" className="size-3" />
                      {tombstone.placementKey}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {selectedPlacement ? (
            <section className="rounded-xl border border-line bg-canvas p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <p className="text-[9px] font-semibold uppercase text-ink-faint">
                    Selected placement
                  </p>
                  <code className="mt-1 block font-mono text-[11px] font-semibold text-ink">
                    {selectedPlacement.placementKey}
                  </code>
                </div>
                <label
                  htmlFor="sqlite-block-type"
                  className="grid gap-1 text-[9px] font-medium text-ink-muted"
                >
                  Block type
                  <Select
                    id="sqlite-block-type"
                    value={blockTypeKey}
                    onChange={(event) => setBlockTypeKey(event.currentTarget.value)}
                  >
                    {workspace.blockTypes.map((blockType) => (
                      <option key={blockType.key} value={blockType.key}>
                        {blockType.name} · schema {blockType.schemaVersion}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <label className="mt-3 grid gap-1 text-[9px] font-medium text-ink-muted">
                Immutable version payload
                <textarea
                  value={contentJson}
                  onChange={(event) => setContentJson(event.currentTarget.value)}
                  rows={7}
                  spellCheck={false}
                  className="w-full rounded-md border border-line-strong bg-surface-subtle p-2 font-mono text-[9px] leading-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  disabled={pending || !workspace.scopeMatchesSamplePage}
                  onClick={() =>
                    run({
                      kind: 'editPlacement',
                      scenarioId: scenario.id,
                      scopeId: workspace.scopeId,
                      placementKey: selectedPlacement.placementKey,
                      blockTypeKey: blockTypeKey as
                        | 'navigation'
                        | 'hero'
                        | 'hero_alt'
                        | 'promo'
                        | 'footer',
                      contentJson,
                    })
                  }
                >
                  <Save aria-hidden="true" className="size-3" /> Save new version
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || selectedPlacement.order === 0}
                  onClick={() =>
                    run({
                      kind: 'movePlacement',
                      scenarioId: scenario.id,
                      scopeId: workspace.scopeId,
                      placementKey: selectedPlacement.placementKey,
                      direction: 'up',
                    })
                  }
                >
                  <ArrowUp aria-hidden="true" className="size-3" /> Move up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || selectedPlacement.order >= workspace.placements.length - 1}
                  onClick={() =>
                    run({
                      kind: 'movePlacement',
                      scenarioId: scenario.id,
                      scopeId: workspace.scopeId,
                      placementKey: selectedPlacement.placementKey,
                      direction: 'down',
                    })
                  }
                >
                  <ArrowDown aria-hidden="true" className="size-3" /> Move down
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run({
                      kind: 'deletePlacement',
                      scenarioId: scenario.id,
                      scopeId: workspace.scopeId,
                      placementKey: selectedPlacement.placementKey,
                    })
                  }
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                  {selectedVariant?.isDefault ? 'Delete' : 'Hide here'}
                </Button>
                {!selectedVariant?.isDefault ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run({
                        kind: 'revertPlacement',
                        scenarioId: scenario.id,
                        scopeId: workspace.scopeId,
                        placementKey: selectedPlacement.placementKey,
                      })
                    }
                  >
                    <RotateCcw aria-hidden="true" className="size-3" /> Revert override
                  </Button>
                ) : null}
              </div>
              <details className="mt-3 rounded-md bg-surface-subtle p-2">
                <summary className="cursor-pointer text-[9px] font-medium text-ink-muted">
                  Rendered value and provenance
                </summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[8px] leading-4 text-ink-faint">
                  {selectedPlacement.renderedJson}
                  {'\n'}content winner: {selectedPlacement.sourceRevisionId} / P
                  {selectedPlacement.sourcePriority}
                  {'\n'}order winner: {selectedPlacement.orderSourceRevisionId} / P
                  {selectedPlacement.orderSourcePriority}
                </pre>
              </details>
            </section>
          ) : null}

          <section className="rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-center gap-2">
              <Plus aria-hidden="true" className="size-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink">Add a placement</h3>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label
                htmlFor="sqlite-new-placement-key"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                Stable placement key
                <Input
                  id="sqlite-new-placement-key"
                  value={addPlacementKey}
                  onChange={(event) => setAddPlacementKey(event.currentTarget.value)}
                />
              </label>
              <label
                htmlFor="sqlite-new-block-type"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                Block type
                <Select
                  id="sqlite-new-block-type"
                  value={addBlockTypeKey}
                  onChange={(event) => chooseAddType(event.currentTarget.value)}
                >
                  {workspace.blockTypes.map((blockType) => (
                    <option key={blockType.key} value={blockType.key}>
                      {blockType.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <textarea
              aria-label="New placement JSON payload"
              value={addContentJson}
              onChange={(event) => setAddContentJson(event.currentTarget.value)}
              rows={5}
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-line-strong bg-surface-subtle p-2 font-mono text-[9px] leading-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <Button
              className="mt-2"
              size="sm"
              disabled={pending || !workspace.scopeMatchesSamplePage}
              onClick={() =>
                run({
                  kind: 'addPlacement',
                  scenarioId: scenario.id,
                  scopeId: workspace.scopeId,
                  placementKey: addPlacementKey,
                  blockTypeKey: addBlockTypeKey as
                    | 'navigation'
                    | 'hero'
                    | 'hero_alt'
                    | 'promo'
                    | 'footer',
                  contentJson: addContentJson,
                })
              }
            >
              <Plus aria-hidden="true" className="size-3" /> Add to {selectedVariant?.name}
            </Button>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-center gap-2">
              <GitBranch aria-hidden="true" className="size-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink">Create variant</h3>
            </div>
            <label
              htmlFor="sqlite-new-variant-name"
              className="mt-3 grid gap-1 text-[9px] font-medium text-ink-muted"
            >
              Name
              <Input
                id="sqlite-new-variant-name"
                value={newVariantName}
                onChange={(event) => setNewVariantName(event.currentTarget.value)}
              />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label
                htmlFor="sqlite-new-variant-mode"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                Start mode
                <Select
                  id="sqlite-new-variant-mode"
                  value={newVariantMode}
                  onChange={(event) =>
                    setNewVariantMode(event.currentTarget.value as 'linked' | 'empty')
                  }
                >
                  <option value="linked">Linked / inherit</option>
                  <option value="empty">Blank / tombstones</option>
                </Select>
              </label>
              <label
                htmlFor="sqlite-new-variant-priority"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                Priority
                <Input
                  id="sqlite-new-variant-priority"
                  type="number"
                  min={1}
                  value={newVariantPriority}
                  onChange={(event) => setNewVariantPriority(Number(event.currentTarget.value))}
                />
              </label>
            </div>
            <Button
              className="mt-3 w-full"
              size="sm"
              disabled={pending}
              onClick={() =>
                run({
                  kind: 'createVariant',
                  scenarioId: scenario.id,
                  name: newVariantName,
                  selector,
                  priority: newVariantPriority,
                  mode: newVariantMode,
                })
              }
            >
              <GitBranch aria-hidden="true" className="size-3" /> Create persisted variant
            </Button>
          </section>

          <section className="rounded-xl border border-line bg-canvas p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              Selector contract
            </p>
            <textarea
              aria-label="Variant selector"
              value={selector}
              onChange={(event) => setSelector(event.currentTarget.value)}
              rows={5}
              spellCheck={false}
              className="mt-2 w-full rounded-md border border-line-strong bg-surface-subtle p-2 font-mono text-[9px] leading-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <div className="mt-2 flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => previewMutation.mutate()}
              >
                Preview matches
              </Button>
              {!selectedVariant?.isDefault ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run({
                      kind: 'reviseSelector',
                      scenarioId: scenario.id,
                      scopeId: workspace.scopeId,
                      selector,
                    })
                  }
                >
                  Save selector
                </Button>
              ) : null}
            </div>
            {selectorPreview ? (
              <div className="mt-3 rounded-md bg-surface-subtle p-2 text-[8px] leading-4 text-ink-muted">
                <p className="font-semibold text-ink">
                  {selectorPreview.totalCount} / {selectorPreview.templatePageCount} exact matches
                </p>
                <code className="mt-1 block font-mono">{selectorPreview.normalizedSelector}</code>
                {selectorPreview.sampleUrls.map((url) => (
                  <p key={url} className="truncate font-mono">
                    {url}
                  </p>
                ))}
                <p className="mt-1 text-ink-faint">plan: {selectorPreview.plan.join(' · ')}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-accent/25 bg-accent-soft/35 p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              Atomic publication
            </p>
            <p className="mt-1 text-[9px] leading-4 text-ink-muted">
              Compile every bounded scenario page, write immutable manifests, then move one serving
              pointer. Rollback only repoints to the retained predecessor.
            </p>
            <Button
              className="mt-3 w-full"
              disabled={pending}
              onClick={() => run({ kind: 'publish', scenarioId: scenario.id })}
            >
              <Check aria-hidden="true" className="size-3.5" /> Publish now
            </Button>
            <Button
              className="mt-2 w-full"
              variant="outline"
              disabled={pending || !workspace.rollbackPublicationId}
              onClick={() => run({ kind: 'rollback', scenarioId: scenario.id })}
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Roll back pointer
            </Button>
            {workspace.rollbackPublicationId ? (
              <p className="mt-1 truncate font-mono text-[8px] text-ink-faint">
                target: {workspace.rollbackPublicationId}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-line bg-canvas p-3">
            <div className="flex items-start gap-2">
              {pending ? (
                <RefreshCcw
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 animate-spin text-accent"
                />
              ) : (
                <Database aria-hidden="true" className="mt-0.5 size-3.5 text-accent" />
              )}
              <p role="status" className="text-[9px] leading-4 text-ink-muted">
                {status}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
