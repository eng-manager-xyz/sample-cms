import { CMS_RENDERED_PAGE_CLASS } from '@repo/cms-renderer';
import { FileClock, GitBranch, Layers3, PanelRight, Plus, RotateCcw } from 'lucide-react';

import { CanvasBlock, HiddenCanvasBlock } from '@/components/authoring/canvas-block';
import {
  type BlockFormInsertion,
  type BlockFormSaveInput,
  SchemaBlockForm,
} from '@/components/authoring/schema-block-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TemplateKey } from '@/data/scenario-fixtures';
import type {
  CmsCommand,
  CmsWorkspaceFieldInspection,
  CmsWorkspacePlacement,
  CmsWorkspaceSnapshot,
} from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

export type AuthoringInspectorTab = 'fields' | 'cascade' | 'history';

export function AuthoringCanvasPane({
  scenarioId,
  workspace,
  selectedPlacementKey,
  addingBlock,
  actionsDisabled,
  onStartAdd,
  onSelectPlacement,
  runPlacementCommand,
}: Readonly<{
  scenarioId: TemplateKey;
  workspace: CmsWorkspaceSnapshot;
  selectedPlacementKey?: string;
  addingBlock: boolean;
  actionsDisabled: boolean;
  onStartAdd: (insertion: BlockFormInsertion) => void;
  onSelectPlacement: (placementKey: string) => void;
  runPlacementCommand: (command: CmsCommand) => void;
}>) {
  const selectedVariant = workspace.variants.find((variant) => variant.id === workspace.scopeId);
  const isDefault = Boolean(selectedVariant?.isDefault);
  const hasLocalOrder =
    !isDefault && workspace.placements.some((placement) => !placement.orderInherited);
  return (
    <section className="group/document relative min-w-0" aria-label="Authoring document canvas">
      {hasLocalOrder ? (
        <div className="authoring-hover-control pointer-events-none absolute right-2 top-12 z-40 opacity-0 transition-opacity group-hover/document:pointer-events-auto group-hover/document:opacity-100 group-focus-within/document:pointer-events-auto group-focus-within/document:opacity-100">
          <Button
            size="sm"
            variant="outline"
            className="bg-canvas/95 shadow-sm backdrop-blur"
            disabled={actionsDisabled}
            title="Remove this variation's local order and inherit the prior sequence"
            onClick={() =>
              runPlacementCommand({
                kind: 'revertOrder',
                scenarioId,
                scopeId: workspace.scopeId,
                canonicalUrl: workspace.canonicalUrl,
              })
            }
          >
            <RotateCcw aria-hidden="true" className="size-3.5" /> Revert page order
          </Button>
        </div>
      ) : null}
      <div className={cn(CMS_RENDERED_PAGE_CLASS, 'isolate relative min-w-0 overflow-visible')}>
        {workspace.placements.length > 0 || workspace.tombstones.length > 0 ? (
          [
            ...workspace.placements.map((placement) => ({
              kind: 'visible' as const,
              order: placement.order,
              placement,
            })),
            ...workspace.tombstones.map((tombstone, index) => ({
              kind: 'hidden' as const,
              order: tombstone.hiddenPlacement?.order ?? workspace.placements.length + index,
              tombstone,
            })),
          ]
            .sort((left, right) => left.order - right.order)
            .map((item) =>
              item.kind === 'visible' ? (
                <CanvasBlock
                  key={item.placement.placementKey}
                  page={{
                    scenarioId,
                    canonicalUrl: workspace.canonicalUrl,
                    renderMode: 'preview',
                    interactionMode: 'static',
                  }}
                  placement={item.placement}
                  selected={!addingBlock && item.placement.placementKey === selectedPlacementKey}
                  disabled={actionsDisabled}
                  index={item.placement.order}
                  count={workspace.placements.length}
                  isDefault={isDefault}
                  onSelect={() => onSelectPlacement(item.placement.placementKey)}
                  onAdd={(position) =>
                    onStartAdd({
                      position,
                      referencePlacementKey: item.placement.placementKey,
                    })
                  }
                  onMove={(direction) =>
                    runPlacementCommand({
                      kind: 'movePlacement',
                      scenarioId,
                      scopeId: workspace.scopeId,
                      canonicalUrl: workspace.canonicalUrl,
                      placementKey: item.placement.placementKey,
                      direction,
                    })
                  }
                  onToggleVisibility={() =>
                    runPlacementCommand({
                      kind: 'deletePlacement',
                      scenarioId,
                      scopeId: workspace.scopeId,
                      canonicalUrl: workspace.canonicalUrl,
                      placementKey: item.placement.placementKey,
                    })
                  }
                  onRevert={() =>
                    runPlacementCommand({
                      kind: 'revertPlacement',
                      scenarioId,
                      scopeId: workspace.scopeId,
                      canonicalUrl: workspace.canonicalUrl,
                      placementKey: item.placement.placementKey,
                    })
                  }
                />
              ) : (
                <HiddenCanvasBlock
                  key={`hidden:${item.tombstone.placementKey}`}
                  tombstone={item.tombstone}
                  disabled={actionsDisabled}
                  onRestore={() =>
                    runPlacementCommand({
                      kind: 'revertPlacement',
                      scenarioId,
                      scopeId: workspace.scopeId,
                      canonicalUrl: workspace.canonicalUrl,
                      placementKey: item.tombstone.placementKey,
                    })
                  }
                />
              )
            )
        ) : (
          <div className="grid min-h-80 place-items-center px-8 text-center">
            <div>
              <Layers3 aria-hidden="true" className="mx-auto size-7 text-ink-faint" />
              <p className="mt-3 text-sm font-semibold text-ink">This scope is explicitly blank.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Add a registered block or revert a tombstone.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                disabled={actionsDisabled}
                onClick={() => onStartAdd({ position: 'end' })}
              >
                <Plus aria-hidden="true" className="size-3.5" /> Add block
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryPanel({ placement }: Readonly<{ placement?: CmsWorkspacePlacement }>) {
  if (!placement) {
    return <p className="text-xs text-ink-muted">Select a visible placement to inspect history.</p>;
  }
  const currentVersion = placement.versionHistory.find(
    (version) => version.id === placement.blockVersionId
  );
  return (
    <div className="space-y-6">
      <section aria-labelledby="history-state-heading" className="border-l-2 border-accent pl-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
              Selected block
            </p>
            <h3 id="history-state-heading" className="mt-1 text-xs font-semibold text-ink">
              Draft and publication state
            </h3>
          </div>
          <Badge tone={placement.inherited ? 'neutral' : 'info'}>
            {placement.inherited ? 'inherited' : 'local'}
          </Badge>
        </div>
        <dl className="mt-3 divide-y divide-line text-[11px]">
          <div className="flex items-start justify-between gap-3 py-2">
            <dt className="text-ink-muted">Draft</dt>
            <dd className="text-right font-medium text-ink">
              Version {currentVersion?.versionNumber ?? 'current'}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2">
            <dt className="text-ink-muted">Published</dt>
            <dd className="max-w-48 break-all text-right text-ink">
              {placement.publishedBlockVersionId ? 'In current publication' : 'Not published'}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2">
            <dt className="text-ink-muted">Lineage</dt>
            <dd className="max-w-48 break-all text-right font-mono text-[10px] text-ink-faint">
              {placement.lineageId}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="version-lineage-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="version-lineage-heading" className="text-xs font-semibold text-ink">
            Version lineage
          </h3>
          <span className="text-[10px] text-ink-faint">
            {placement.versionHistory.length}{' '}
            {placement.versionHistory.length === 1 ? 'revision' : 'revisions'}
          </span>
        </div>
        <ol className="relative mt-4 space-y-4 border-l border-line pl-4">
          {placement.versionHistory.map((version) => {
            const isDraft = version.id === placement.blockVersionId;
            const isPublished = version.id === placement.publishedBlockVersionId;
            return (
              <li key={version.id} className="relative text-[11px]">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -left-[20.5px] top-1 size-2 rounded-full ring-4 ring-canvas',
                    isDraft ? 'bg-accent' : 'bg-line-strong'
                  )}
                />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">Version {version.versionNumber}</p>
                    <p className="mt-0.5 text-ink-muted">
                      {version.createdBy} · {version.createdAt}
                    </p>
                  </div>
                  <span className="flex flex-wrap justify-end gap-1">
                    {isDraft ? <Badge tone="info">draft</Badge> : null}
                    {isPublished ? <Badge tone="success">published</Badge> : null}
                  </span>
                </div>
                <p className="mt-2 text-ink-muted">
                  {version.blockType} · schema {version.schemaVersion}
                </p>
                <details className="mt-2 text-[10px] text-ink-faint">
                  <summary className="cursor-pointer outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
                    Technical provenance
                  </summary>
                  <dl className="mt-2 space-y-1.5 border-l border-line pl-2.5 font-mono">
                    <div>
                      <dt className="inline font-sans">Version ID: </dt>
                      <dd className="inline break-all">{version.id}</dd>
                    </div>
                    <div>
                      <dt className="inline font-sans">Content hash: </dt>
                      <dd className="inline break-all">{version.contentHash}</dd>
                    </div>
                    <div>
                      <dt className="inline font-sans">Parent: </dt>
                      <dd className="inline break-all">
                        {version.parentBlockVersionId ?? 'initial version'}
                      </dd>
                    </div>
                  </dl>
                </details>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="cascade-trace-heading">
        <details>
          <summary
            id="cascade-trace-heading"
            className="cursor-pointer text-xs font-semibold text-ink outline-none hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-focus"
          >
            Resolution trace · {placement.trace.length}{' '}
            {placement.trace.length === 1 ? 'step' : 'steps'}
          </summary>
          <ol className="mt-3 space-y-2 border-l border-line pl-3">
            {placement.trace.map((step, index) => (
              <li
                key={`${step.sourceRevisionId}:${step.kind}:${step.blockVersionId ?? step.order ?? 'none'}`}
                className="flex gap-2 text-[11px]"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-muted font-mono text-[9px] text-ink-muted">
                  {index + 1}
                </span>
                <span>
                  <strong className="text-ink">{step.sourceVariantName}</strong>{' '}
                  <span className="text-ink-muted">
                    {step.kind} at priority {step.sourcePriority}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      </section>
    </div>
  );
}

export function AuthoringInspectorPane({
  workspace,
  selectedPlacement,
  addingBlock,
  addInsertion,
  inspectorTab,
  inspectorNavigationDisabled,
  collapsed,
  pending,
  placementActionsDisabled,
  serverError,
  onTabChange,
  onCollapsedChange,
  onDiscardChanges,
  onSave,
  onFormDirty,
  inspectField,
}: Readonly<{
  workspace: CmsWorkspaceSnapshot;
  selectedPlacement?: CmsWorkspacePlacement;
  addingBlock: boolean;
  addInsertion?: BlockFormInsertion;
  inspectorTab: Exclude<AuthoringInspectorTab, 'cascade'>;
  inspectorNavigationDisabled: boolean;
  collapsed: boolean;
  pending: boolean;
  placementActionsDisabled: boolean;
  serverError: string | null;
  onTabChange: (tab: Exclude<AuthoringInspectorTab, 'cascade'>) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onDiscardChanges: () => void;
  onSave: (input: BlockFormSaveInput) => Promise<void>;
  onFormDirty: (description: string) => void;
  inspectField: (source: string) => Promise<CmsWorkspaceFieldInspection>;
}>) {
  const inspectorLabel = inspectorTab === 'fields' ? 'Fields' : 'History';
  const collapseLabel = collapsed
    ? `Expand ${inspectorLabel} inspector`
    : `Collapse ${inspectorLabel} inspector`;
  return (
    <aside
      className={cn(
        'min-h-0 rounded-xl border border-line bg-canvas xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)]',
        collapsed
          ? 'xl:overflow-hidden xl:rounded-none xl:border-y-0 xl:border-r-0 xl:bg-transparent'
          : 'xl:overflow-y-auto'
      )}
      data-inspector-collapsed={collapsed ? 'true' : 'false'}
      aria-label={`${inspectorLabel} inspector`}
    >
      <div
        className={cn(
          'sticky top-0 z-10 flex min-h-11 items-center gap-1 border-b border-line bg-canvas p-1.5',
          collapsed && 'xl:justify-center xl:border-b-0 xl:bg-transparent'
        )}
      >
        <div className="hidden shrink-0 xl:block">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'size-8 text-ink-muted hover:bg-surface-muted hover:text-ink',
              collapsed ? '!cursor-w-resize bg-canvas shadow-sm' : '!cursor-e-resize'
            )}
            aria-controls="authoring-block-inspector-content"
            aria-expanded={!collapsed}
            aria-label={collapseLabel}
            title={collapseLabel}
            onClick={() => onCollapsedChange(!collapsed)}
          >
            <PanelRight aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </Button>
        </div>
        <div
          role="tablist"
          aria-label="Block inspector"
          className={cn('flex min-w-0 flex-1', collapsed && 'xl:hidden')}
        >
          {(
            [
              ['fields', 'Fields', GitBranch],
              ['history', 'History', FileClock],
            ] as const
          ).map(([tab, label, Icon]) => (
            <button
              key={tab}
              id={`authoring-inspector-tab-${tab}`}
              type="button"
              role="tab"
              className={cn(
                'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
                inspectorTab === tab ? 'bg-surface-muted text-ink' : 'text-ink-muted hover:text-ink'
              )}
              disabled={pending || (inspectorNavigationDisabled && tab !== 'fields')}
              aria-controls="authoring-block-inspector-content"
              aria-selected={inspectorTab === tab}
              tabIndex={inspectorTab === tab ? 0 : -1}
              title={
                inspectorNavigationDisabled && tab !== 'fields'
                  ? 'Save or cancel local block changes before leaving Fields.'
                  : undefined
              }
              onClick={() => onTabChange(tab)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const nextTab =
                  event.key === 'Home'
                    ? 'fields'
                    : event.key === 'End'
                      ? 'history'
                      : tab === 'fields'
                        ? 'history'
                        : 'fields';
                if (inspectorNavigationDisabled && nextTab !== 'fields') return;
                event.preventDefault();
                onTabChange(nextTab);
                document.getElementById(`authoring-inspector-tab-${nextTab}`)?.focus();
              }}
            >
              <Icon aria-hidden="true" className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div
        id="authoring-block-inspector-content"
        role="tabpanel"
        aria-labelledby={`authoring-inspector-tab-${inspectorTab}`}
        className={cn('p-4', collapsed && 'xl:hidden')}
      >
        {inspectorTab === 'fields' ? (
          <>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  {addingBlock
                    ? 'Add registered block'
                    : (selectedPlacement?.placementKey ?? 'No placement')}
                </h2>
                <p className="mt-1 text-[11px] leading-4 text-ink-muted">
                  {addingBlock
                    ? 'Choose identity, type, insertion, and schema-backed content.'
                    : 'Save creates a new immutable version; Publish is separate.'}
                </p>
              </div>
              {selectedPlacement && !addingBlock ? (
                <Badge tone={selectedPlacement.inherited ? 'neutral' : 'info'}>
                  {selectedPlacement.inherited ? 'inherited' : 'local'}
                </Badge>
              ) : null}
            </div>
            {!workspace.scopeMatchesSamplePage ? (
              <p
                role="status"
                className="mb-4 rounded-lg border border-warning/25 bg-warning-soft p-3 text-[11px] leading-4 text-warning-strong"
              >
                This selector does not match <code>{workspace.canonicalUrl}</code>. Block changes
                are disabled; use View selector to update it or choose a matching scope.
              </p>
            ) : null}
            {selectedPlacement?.inherited &&
            !workspace.variants.find((variant) => variant.id === workspace.scopeId)?.isDefault ? (
              <p
                role="status"
                className="mb-4 rounded-lg border border-accent/25 bg-accent-soft/45 p-3 text-[11px] leading-4 text-ink-muted"
              >
                <strong className="text-ink">Linked from a lower layer.</strong> Saving this block
                creates one local immutable version for this variation. Every untouched block stays
                inherited.
              </p>
            ) : null}
            {addingBlock || selectedPlacement ? (
              <SchemaBlockForm
                key={
                  addingBlock
                    ? `add:${workspace.scopeId}:${addInsertion?.position ?? 'end'}:${addInsertion?.referencePlacementKey ?? 'none'}:${workspace.placements.length}`
                    : `${workspace.scopeId}:${selectedPlacement?.blockVersionId}`
                }
                mode={addingBlock ? 'add' : 'edit'}
                {...(selectedPlacement && !addingBlock ? { placement: selectedPlacement } : {})}
                blockTypes={workspace.blockTypes}
                placementKeys={workspace.placements.map((placement) => placement.placementKey)}
                {...(addingBlock && addInsertion ? { initialInsertion: addInsertion } : {})}
                pending={placementActionsDisabled}
                serverError={serverError}
                onSave={onSave}
                onDirty={onFormDirty}
                inspectField={inspectField}
                hasUnsavedChanges={inspectorNavigationDisabled}
                onDiscard={onDiscardChanges}
              />
            ) : (
              <p className="text-xs text-ink-muted">Add a block to begin authoring.</p>
            )}
          </>
        ) : null}
        {inspectorTab === 'history' ? <HistoryPanel placement={selectedPlacement} /> : null}
      </div>
    </aside>
  );
}
