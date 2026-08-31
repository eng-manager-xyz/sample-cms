import { CMS_RENDERED_PAGE_CLASS } from '@repo/cms-renderer';
import { FileClock, GitBranch, Layers3, Plus, RotateCcw } from 'lucide-react';

import { CanvasBlock, HiddenCanvasBlock } from '@/components/authoring/canvas-block';
import {
  type BlockFormInsertion,
  type BlockFormSaveInput,
  SchemaBlockForm,
} from '@/components/authoring/schema-block-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ScenarioFixture } from '@/data/scenario-fixtures';
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
  scenarioId: ScenarioFixture['id'];
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
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-xs font-semibold text-ink">Draft versus published</h3>
        <dl className="mt-3 grid gap-2 text-[11px]">
          <div className="rounded-lg border border-line bg-surface-muted/40 p-2.5">
            <dt className="text-ink-faint">Stable lineage</dt>
            <dd className="mt-1 break-all font-mono text-ink">{placement.lineageId}</dd>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted/40 p-2.5">
            <dt className="text-ink-faint">Draft immutable version</dt>
            <dd className="mt-1 break-all font-mono text-ink">{placement.blockVersionId}</dd>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted/40 p-2.5">
            <dt className="text-ink-faint">Draft content hash</dt>
            <dd className="mt-1 break-all font-mono text-ink">{placement.contentHash}</dd>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted/40 p-2.5">
            <dt className="text-ink-faint">Published immutable version</dt>
            <dd className="mt-1 break-all font-mono text-ink">
              {placement.publishedBlockVersionId ?? 'Not in current publication'}
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h3 className="text-xs font-semibold text-ink">Version lineage</h3>
        <ol className="mt-3 space-y-2">
          {placement.versionHistory.map((version) => (
            <li
              key={version.id}
              className={cn(
                'rounded-lg border p-2.5 text-[11px]',
                version.id === placement.blockVersionId
                  ? 'border-accent/30 bg-accent-soft/45'
                  : 'border-line bg-canvas'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">Version {version.versionNumber}</span>
                <Badge tone={version.id === placement.blockVersionId ? 'info' : 'neutral'}>
                  {version.blockType} · schema {version.schemaVersion}
                </Badge>
              </div>
              <code className="mt-2 block break-all text-[10px] text-ink-muted">{version.id}</code>
              <p className="mt-2 break-all font-mono text-[10px] text-ink-muted">
                Hash: {version.contentHash}
              </p>
              <p className="mt-2 text-ink-muted">
                Parent: <code>{version.parentBlockVersionId ?? 'initial version'}</code>
              </p>
              <p className="mt-1 text-ink-faint">
                {version.createdBy} · {version.createdAt}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="text-xs font-semibold text-ink">Cascade trace</h3>
        <ol className="mt-3 space-y-2">
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
  pending,
  placementActionsDisabled,
  serverError,
  onTabChange,
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
  pending: boolean;
  placementActionsDisabled: boolean;
  serverError: string | null;
  onTabChange: (tab: Exclude<AuthoringInspectorTab, 'cascade'>) => void;
  onDiscardChanges: () => void;
  onSave: (input: BlockFormSaveInput) => Promise<void>;
  onFormDirty: (description: string) => void;
  inspectField: (source: string) => Promise<CmsWorkspaceFieldInspection>;
}>) {
  return (
    <aside className="min-h-0 rounded-xl border border-line bg-canvas xl:sticky xl:top-16 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
      <div className="sticky top-0 z-10 flex border-b border-line bg-canvas p-1.5">
        {(
          [
            ['fields', 'Fields', GitBranch],
            ['history', 'History', FileClock],
          ] as const
        ).map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            className={cn(
              'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
              inspectorTab === tab ? 'bg-surface-muted text-ink' : 'text-ink-muted hover:text-ink'
            )}
            disabled={pending || (inspectorNavigationDisabled && tab !== 'fields')}
            aria-pressed={inspectorTab === tab}
            title={
              inspectorNavigationDisabled && tab !== 'fields'
                ? 'Save or cancel local block changes before leaving Fields.'
                : undefined
            }
            onClick={() => onTabChange(tab)}
          >
            <Icon aria-hidden="true" className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="p-4">
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
