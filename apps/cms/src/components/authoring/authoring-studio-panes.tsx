import {
  ArrowDown,
  ArrowUp,
  FileClock,
  GitBranch,
  Layers3,
  PanelRight,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { CanvasBlock } from '@/components/authoring/canvas-block';
import { type BlockFormSaveInput, SchemaBlockForm } from '@/components/authoring/schema-block-form';
import { SelectorWorkspace } from '@/components/selector-workspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { publishedWebsiteHref, type WebsiteOriginState } from '@/data/authoring-studio';
import type { ScenarioFixture } from '@/data/scenario-fixtures';
import type { SelectorWorkspacePreviewInput } from '@/data/selector-workspace';
import type {
  CmsCommand,
  CmsCommandResult,
  CmsWorkspaceFieldInspection,
  CmsWorkspacePlacement,
  CmsWorkspaceSnapshot,
  SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

export type AuthoringInspectorTab = 'fields' | 'cascade' | 'history';

function PlacementStructureRow({
  placement,
  selected,
  index,
  count,
  isDefault,
  pending,
  onSelect,
  onMove,
  onDelete,
  onRevert,
}: Readonly<{
  placement: CmsWorkspacePlacement;
  selected: boolean;
  index: number;
  count: number;
  isDefault: boolean;
  pending: boolean;
  onSelect: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onDelete: () => void;
  onRevert: () => void;
}>) {
  const localContentOperation = !placement.inherited;
  return (
    <li
      className={cn(
        'rounded-lg border px-2 py-2',
        selected ? 'border-accent/35 bg-accent-soft/55' : 'border-line bg-canvas'
      )}
    >
      <button
        type="button"
        disabled={pending}
        className="w-full rounded-md px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-semibold text-ink">
            {index + 1}. {placement.placementKey}
          </span>
          <Badge tone={placement.inherited ? 'neutral' : 'info'}>
            {placement.inherited ? 'Inherited' : 'Local'}
          </Badge>
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-faint">
          <span>{placement.blockType}</span>
          <span aria-hidden="true">·</span>
          <span>v{placement.versionNumber}</span>
          {placement.draftDifference !== 'same' ? (
            <span className="text-warning-strong">· draft {placement.draftDifference}</span>
          ) : null}
        </span>
      </button>
      <div className="mt-2 flex items-center gap-1 border-t border-line/70 pt-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={pending || index === 0}
          aria-label={`Move ${placement.placementKey} up`}
          onClick={() => onMove('up')}
        >
          <ArrowUp aria-hidden="true" className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={pending || index === count - 1}
          aria-label={`Move ${placement.placementKey} down`}
          onClick={() => onMove('down')}
        >
          <ArrowDown aria-hidden="true" className="size-3.5" />
        </Button>
        {!isDefault && localContentOperation ? (
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            aria-label={`Revert local operation for ${placement.placementKey}`}
            onClick={onRevert}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto text-danger-strong"
          disabled={pending}
          aria-label={`${isDefault ? 'Delete' : 'Hide'} ${placement.placementKey}`}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}

export function AuthoringStructurePane({
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
  onStartAdd: () => void;
  onSelectPlacement: (placementKey: string) => void;
  runPlacementCommand: (command: CmsCommand) => void;
}>) {
  const selectedVariant = workspace.variants.find((variant) => variant.id === workspace.scopeId);
  const hasLocalOrder =
    !selectedVariant?.isDefault &&
    workspace.placements.some((placement) => !placement.orderInherited);
  return (
    <aside className="min-h-0 rounded-xl border border-line bg-surface-subtle p-3 xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <Layers3 aria-hidden="true" className="size-3.5" /> Structure
          </p>
          <p className="mt-1 text-[10px] text-ink-faint">
            {workspace.placements.length} visible · {workspace.tombstones.length} hidden
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasLocalOrder ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={actionsDisabled}
              title="Remove this variation's complete local order and inherit the prior sequence"
              onClick={() =>
                runPlacementCommand({
                  kind: 'revertOrder',
                  scenarioId,
                  scopeId: workspace.scopeId,
                  canonicalUrl: workspace.canonicalUrl,
                })
              }
            >
              <RotateCcw aria-hidden="true" className="size-3.5" /> Revert order
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
            title={
              actionsDisabled && !workspace.scopeMatchesSamplePage
                ? 'This scope does not match the displayed canonical page.'
                : undefined
            }
            onClick={onStartAdd}
          >
            <Plus aria-hidden="true" className="size-3.5" /> Add
          </Button>
        </div>
      </div>
      <ol className="mt-3 space-y-2">
        {workspace.placements.map((placement, index) => (
          <PlacementStructureRow
            key={placement.placementKey}
            placement={placement}
            selected={!addingBlock && placement.placementKey === selectedPlacementKey}
            index={index}
            count={workspace.placements.length}
            isDefault={Boolean(selectedVariant?.isDefault)}
            pending={actionsDisabled}
            onSelect={() => onSelectPlacement(placement.placementKey)}
            onMove={(direction) =>
              runPlacementCommand({
                kind: 'movePlacement',
                scenarioId,
                scopeId: workspace.scopeId,
                canonicalUrl: workspace.canonicalUrl,
                placementKey: placement.placementKey,
                direction,
              })
            }
            onDelete={() =>
              runPlacementCommand({
                kind: 'deletePlacement',
                scenarioId,
                scopeId: workspace.scopeId,
                canonicalUrl: workspace.canonicalUrl,
                placementKey: placement.placementKey,
              })
            }
            onRevert={() =>
              runPlacementCommand({
                kind: 'revertPlacement',
                scenarioId,
                scopeId: workspace.scopeId,
                canonicalUrl: workspace.canonicalUrl,
                placementKey: placement.placementKey,
              })
            }
          />
        ))}
      </ol>
      {workspace.tombstones.length > 0 ? (
        <section className="mt-5 border-t border-line pt-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
            Tombstones
          </h2>
          <ul className="mt-2 space-y-2">
            {workspace.tombstones.map((tombstone) => (
              <li
                key={tombstone.placementKey}
                className="rounded-lg border border-warning/25 bg-warning-soft/45 p-2.5"
              >
                <p className="truncate text-xs font-semibold text-warning-strong">
                  {tombstone.placementKey}
                </p>
                <p className="mt-1 text-[10px] text-ink-muted">
                  Hides {tombstone.hiddenPlacement?.blockType ?? 'a lower placement'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={actionsDisabled}
                  onClick={() =>
                    runPlacementCommand({
                      kind: 'revertPlacement',
                      scenarioId,
                      scopeId: workspace.scopeId,
                      canonicalUrl: workspace.canonicalUrl,
                      placementKey: tombstone.placementKey,
                    })
                  }
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" /> Revert
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

export function AuthoringCanvasPane({
  workspace,
  websiteOrigin,
  selectedPlacementKey,
  addingBlock,
  selectionDisabled,
  onSelectPlacement,
}: Readonly<{
  workspace: CmsWorkspaceSnapshot;
  websiteOrigin: WebsiteOriginState;
  selectedPlacementKey?: string;
  addingBlock: boolean;
  selectionDisabled: boolean;
  onSelectPlacement: (placementKey: string) => void;
}>) {
  const publishedHref =
    websiteOrigin.status === 'ready'
      ? publishedWebsiteHref(workspace.canonicalUrl, websiteOrigin.origin)
      : undefined;
  const unavailableOriginMessage =
    websiteOrigin.status === 'unavailable' && websiteOrigin.reason === 'invalid-config'
      ? 'CMS_WEBSITE_ORIGIN is invalid; the published-page link is unavailable.'
      : 'Set CMS_WEBSITE_ORIGIN on the CMS server to enable website links in this environment.';
  return (
    <main className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
            <PanelRight aria-hidden="true" className="size-3.5" /> Selected scope projection
          </p>
          <p className="mt-1 max-w-2xl text-[10px] leading-4 text-ink-faint">
            Canvas includes defaults, lower layers, and the selected scope. Preview opens the
            persisted saved draft as the full active cascade, so local unsaved edits are excluded
            and higher matching layers may change the website result.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="info">private preview resolution</Badge>
          <Badge tone="neutral">{workspace.matchedVariantRevisionIds.length} matched layers</Badge>
          {!workspace.scopeMatchesSamplePage ? (
            <Badge tone="warning">scope does not match page</Badge>
          ) : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-line-strong bg-canvas shadow-[0_12px_35px_rgba(22,22,26,0.08)]">
        {workspace.placements.length > 0 ? (
          workspace.placements.map((placement) => (
            <CanvasBlock
              key={placement.placementKey}
              placement={placement}
              selected={!addingBlock && placement.placementKey === selectedPlacementKey}
              disabled={selectionDisabled}
              onSelect={() => onSelectPlacement(placement.placementKey)}
            />
          ))
        ) : (
          <div className="grid min-h-80 place-items-center px-8 text-center">
            <div>
              <Layers3 aria-hidden="true" className="mx-auto size-7 text-ink-faint" />
              <p className="mt-3 text-sm font-semibold text-ink">This scope is explicitly blank.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Add a registered block or revert a tombstone.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] text-ink-muted">
        <span>
          Serving pointer: <code>{workspace.currentPublicationId ?? 'unpublished'}</code>
        </span>
        {publishedHref ? (
          <a
            href={publishedHref}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent-strong underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            Open published page
          </a>
        ) : (
          <span aria-disabled="true" className="text-ink-faint" title={unavailableOriginMessage}>
            Published page unavailable
          </span>
        )}
      </div>
    </main>
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
  scenarioId,
  workspace,
  selectedPlacement,
  addingBlock,
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
  runCommand,
  previewSelector,
}: Readonly<{
  scenarioId: ScenarioFixture['id'];
  workspace: CmsWorkspaceSnapshot;
  selectedPlacement?: CmsWorkspacePlacement;
  addingBlock: boolean;
  inspectorTab: AuthoringInspectorTab;
  inspectorNavigationDisabled: boolean;
  pending: boolean;
  placementActionsDisabled: boolean;
  serverError: string | null;
  onTabChange: (tab: AuthoringInspectorTab) => void;
  onDiscardChanges: () => void;
  onSave: (input: BlockFormSaveInput) => Promise<void>;
  onFormDirty: (description: string) => void;
  inspectField: (source: string) => Promise<CmsWorkspaceFieldInspection>;
  runCommand: (command: CmsCommand) => Promise<CmsCommandResult>;
  previewSelector: (input: SelectorWorkspacePreviewInput) => Promise<SelectorPreviewSnapshot>;
}>) {
  return (
    <aside className="min-h-0 rounded-xl border border-line bg-canvas xl:sticky xl:top-[84px] xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <div className="sticky top-0 z-10 flex border-b border-line bg-canvas p-1.5">
        {(
          [
            ['fields', 'Fields', GitBranch],
            ['cascade', 'Cascade', Layers3],
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
                are disabled; update the selector in Cascade or choose a matching scope.
              </p>
            ) : null}
            {addingBlock || selectedPlacement ? (
              <SchemaBlockForm
                key={
                  addingBlock
                    ? `add:${workspace.scopeId}:${workspace.placements.length}`
                    : `${workspace.scopeId}:${selectedPlacement?.blockVersionId}`
                }
                mode={addingBlock ? 'add' : 'edit'}
                {...(selectedPlacement && !addingBlock ? { placement: selectedPlacement } : {})}
                blockTypes={workspace.blockTypes}
                placementKeys={workspace.placements.map((placement) => placement.placementKey)}
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
        {inspectorTab === 'cascade' ? (
          <SelectorWorkspace
            scenarioId={scenarioId}
            workspace={workspace}
            pending={pending}
            runCommand={runCommand}
            previewSelector={previewSelector}
          />
        ) : null}
        {inspectorTab === 'history' ? <HistoryPanel placement={selectedPlacement} /> : null}
      </div>
    </aside>
  );
}
