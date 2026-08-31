import { Link } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Blocks,
  Braces,
  Check,
  CircleAlert,
  Code2,
  Database,
  Eye,
  FileDiff,
  Filter,
  GripVertical,
  LockKeyhole,
  MapPin,
  PanelRight,
  Rows3,
  Sheet,
  SplitSquareVertical,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { BlockAuthoringProof } from '@/components/block-authoring-proof';
import { InstanceTable } from '@/components/instance-table';
import { ScenarioSwitcher } from '@/components/scenario-switcher';
import { SqliteAuthoringWorkbench } from '@/components/sqlite-authoring-workbench';
import { TagAuthoringProof } from '@/components/tag-authoring-proof';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonClassName } from '@/components/ui/button-styles';
import { Select } from '@/components/ui/select';
import type {
  InstanceRow,
  LayerTone,
  ScenarioFixture,
  VariantLayer,
} from '@/data/scenario-fixtures';
import {
  projectionPointMatchesFilters,
  resolveFixturePlacements,
  scenarioFixtures,
} from '@/data/scenario-fixtures';
import type { CmsWorkspaceSnapshot } from '@/data/sqlite-authoring';
import { parseUrlGrammar } from '@/data/template-grammar';
import { cn } from '@/lib/cn';

type WorkspaceView = 'projection' | 'instances' | 'document' | 'blocks' | 'tags';
type InspectorTab = 'pin' | 'sql' | 'diff';

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const layerToneClasses: Record<LayerTone, string> = {
  neutral: 'border-line-strong bg-surface-subtle text-ink-muted',
  blue: 'border-sky-300 bg-sky-50 text-sky-800',
  purple: 'border-accent/35 bg-accent-soft text-accent-strong',
  amber: 'border-warning/35 bg-warning-soft text-warning-strong',
  green: 'border-success/30 bg-success-soft text-success-strong',
  red: 'border-danger/30 bg-danger-soft text-danger-strong',
};

function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

  const tabs = Array.from(
    event.currentTarget
      .closest('[role="tablist"]')
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length === 0) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = tabs.length - 1;

  event.preventDefault();
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function WorkspaceHeader({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  return (
    <div className="border-b border-line bg-canvas px-4 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="info">Map detail</Badge>
              <Badge tone="success">Editable SQLite + proof fixture</Badge>
              <Badge dot tone={scenario.conflictState === '2 conflicts' ? 'danger' : 'success'}>
                {scenario.conflictState}
              </Badge>
              <span className="text-[10px] text-ink-faint">
                {compactNumber.format(scenario.instanceCount)} concrete points
              </span>
            </div>
            <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
              {scenario.name}
            </h1>
            <code className="mt-1 block truncate font-mono text-[11px] text-ink-muted">
              {scenario.pattern}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ScenarioSwitcher scenarios={scenarioFixtures} activeId={scenario.id} />
            <Link
              to="/publications/$templateId"
              params={{ templateId: scenario.id }}
              search={{}}
              className={buttonClassName({ variant: 'outline', size: 'sm' })}
            >
              <Database aria-hidden="true" className="size-3.5" /> Release history
            </Link>
          </div>
        </div>
        <SlotStrip scenario={scenario} />
      </div>
    </div>
  );
}

function SlotStrip({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const slots = parseUrlGrammar(scenario.domain, scenario.pattern);
  const nonPathDimensions = scenario.dimensions.filter(
    (dimension) => dimension.kind === 'derived' || dimension.kind === 'tag'
  );
  return (
    <section
      aria-labelledby="ordered-slots-heading"
      className="rounded-lg border border-line bg-surface-subtle p-2.5"
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2
          id="ordered-slots-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
        >
          Ordered URL grammar
        </h2>
        <span className="text-[9px] text-ink-faint">
          domain + static segments + scalar path slots
        </span>
      </div>
      <ol className="flex gap-1.5 overflow-x-auto pb-0.5">
        {slots.map((slot) => (
          <li
            key={`${slot.order}-${slot.key}`}
            className="flex min-w-[164px] shrink-0 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 py-2"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded bg-surface-muted text-[9px] font-semibold tabular-nums text-ink-muted">
              {slot.order}
            </span>
            <div className="min-w-0">
              <code className="block truncate font-mono text-[9px] text-ink">{slot.label}</code>
              <p className="truncate text-[9px] text-ink-faint">
                {slot.kind === 'variable' ? 'scalar path slot' : slot.kind}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
        <span className="text-[9px] font-medium text-ink-faint">Non-path selector dimensions</span>
        {nonPathDimensions.map((dimension) => (
          <Badge
            key={dimension.id}
            tone={dimension.kind === 'tag' ? 'info' : 'neutral'}
            className="h-5 font-mono text-[8px]"
          >
            {dimension.id} · {dimension.kind === 'tag' ? 'multi-valued tag' : 'derived scalar'}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function LayerStack({
  scenario,
  layerOrder,
  selectedLayerId,
  onSelect,
  onMove,
}: Readonly<{
  scenario: ScenarioFixture;
  layerOrder: string[];
  selectedLayerId: string;
  onSelect: (layerId: string) => void;
  onMove: (layerId: string, direction: 'up' | 'down') => void;
}>) {
  const displayLayers = layerOrder
    .map((layerId) => scenario.layers.find((layer) => layer.id === layerId))
    .filter((layer): layer is VariantLayer => Boolean(layer))
    .reverse();

  return (
    <section
      aria-labelledby="layer-stack-heading"
      className="flex min-h-0 flex-col border-b border-line xl:border-b-0 xl:border-r"
    >
      <div className="border-b border-line bg-canvas px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              Sheet stack
            </p>
            <h2 id="layer-stack-heading" className="mt-0.5 text-sm font-semibold text-ink">
              Priority layers
            </h2>
          </div>
          <Badge tone="neutral" className="text-[9px]">
            high → low
          </Badge>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-ink-faint">
          Preview reordering is local. Publication still validates explicit priority and overlap.
        </p>
      </div>
      <ol className="space-y-2 bg-surface-subtle p-3">
        {displayLayers.map((layer, displayIndex) => {
          const selected = layer.id === selectedLayerId;
          const sourceIndex = layerOrder.indexOf(layer.id);
          const locked = layer.priority === 0;
          return (
            <li key={layer.id}>
              <div
                className={cn(
                  'rounded-lg border p-2.5 transition-[border-color,box-shadow]',
                  layerToneClasses[layer.tone],
                  selected && 'ring-2 ring-accent/20'
                )}
              >
                <div className="flex items-start gap-2">
                  <GripVertical aria-hidden="true" className="mt-1 size-3.5 shrink-0 opacity-45" />
                  <button
                    type="button"
                    onClick={() => onSelect(layer.id)}
                    aria-pressed={selected}
                    className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-semibold">{layer.name}</span>
                      {locked ? (
                        <LockKeyhole aria-label="Default layer is locked" className="size-3" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] opacity-80">
                      P{layer.priority} · {layer.selector}
                    </span>
                  </button>
                  <span className="rounded bg-canvas/70 px-1.5 py-1 text-[9px] font-semibold tabular-nums shadow-sm">
                    {displayIndex + 1}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-current/10 pt-2">
                  <span className="text-[9px] tabular-nums opacity-80">
                    {compactNumber.format(layer.matchCount)} matches ·{' '}
                    {layer.affectedPlacementCount} ops
                  </span>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 bg-canvas/45"
                      aria-label={`Move ${layer.name} up`}
                      disabled={locked || sourceIndex >= layerOrder.length - 1}
                      onClick={() => onMove(layer.id, 'up')}
                    >
                      <ArrowUp aria-hidden="true" className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 bg-canvas/45"
                      aria-label={`Move ${layer.name} down`}
                      disabled={locked || sourceIndex <= 1}
                      onClick={() => onMove(layer.id, 'down')}
                    >
                      <ArrowDown aria-hidden="true" className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line bg-canvas p-3">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          Dimension model
        </p>
        <ul className="space-y-1.5">
          {scenario.dimensions.map((dimension) => (
            <li
              key={dimension.id}
              className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-subtle px-2 py-1.5"
              title={dimension.description}
            >
              <code className="truncate font-mono text-[8px] text-ink-muted">{dimension.id}</code>
              <span className="shrink-0 text-[8px] font-medium text-ink-faint">
                {dimension.kind === 'tag' ? 'multi-valued tag' : `scalar slot · ${dimension.kind}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto border-t border-line bg-canvas p-3">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-subtle p-2.5">
          <SplitSquareVertical aria-hidden="true" className="size-4 text-accent" />
          <div>
            <p className="text-[10px] font-medium text-ink">Overlap stays visible</p>
            <p className="text-[9px] text-ink-faint">
              Same-priority writes never use creation time as a tiebreaker.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Projection({
  scenario,
  axes,
  filters,
  selectedLayer,
  activePointId,
  onAxesChange,
  onFilterChange,
  onPointSelect,
}: Readonly<{
  scenario: ScenarioFixture;
  axes: [string, string];
  filters: Record<string, string>;
  selectedLayer: VariantLayer;
  activePointId: string;
  onAxesChange: (axisIndex: 0 | 1, value: string) => void;
  onFilterChange: (dimensionId: string, value: string) => void;
  onPointSelect: (pointId: string) => void;
}>) {
  const remainingDimensions = scenario.dimensions.filter(
    (dimension) => !axes.includes(dimension.id)
  );
  const visiblePoints = scenario.projectionPoints.filter((point) =>
    projectionPointMatchesFilters(scenario, point, filters)
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-2 rounded-lg border border-line bg-canvas p-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold text-ink">Higher-dimensional projection</p>
          <p className="mt-0.5 text-[9px] text-ink-faint">
            Two axes are shown; remaining dimensions stay available as filters.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor="projection-axis-x" className="text-[9px] text-ink-faint">
            X{' '}
            <Select
              id="projection-axis-x"
              value={axes[0]}
              onChange={(event) => onAxesChange(0, event.currentTarget.value)}
              className="ml-1 w-[120px]"
            >
              {scenario.dimensions.map((dimension) => (
                <option key={dimension.id} value={dimension.id} disabled={dimension.id === axes[1]}>
                  {dimension.label}
                </option>
              ))}
            </Select>
          </label>
          <label htmlFor="projection-axis-y" className="text-[9px] text-ink-faint">
            Y{' '}
            <Select
              id="projection-axis-y"
              value={axes[1]}
              onChange={(event) => onAxesChange(1, event.currentTarget.value)}
              className="ml-1 w-[120px]"
            >
              {scenario.dimensions.map((dimension) => (
                <option key={dimension.id} value={dimension.id} disabled={dimension.id === axes[0]}>
                  {dimension.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <div className="relative h-[390px] overflow-hidden rounded-lg border border-line bg-canvas sm:h-[460px]">
        <div className="map-grid absolute inset-0" />
        <div className="absolute inset-x-12 bottom-10 top-9 border-b border-l border-line-strong">
          <span className="absolute -bottom-7 right-0 text-[9px] font-medium text-ink-faint">
            {scenario.dimensions.find((dimension) => dimension.id === axes[0])?.label} →
          </span>
          <span className="absolute -left-9 -top-5 text-[9px] font-medium text-ink-faint">
            {scenario.dimensions.find((dimension) => dimension.id === axes[1])?.label}
          </span>
          {visiblePoints.map((point) => {
            const active = point.id === activePointId;
            const selectedLayerMatch = point.layerIds.includes(selectedLayer.id);
            const conflict =
              point.layerIds.filter((layerId) => layerId.includes('conflict')).length > 1;
            return (
              <button
                key={point.id}
                type="button"
                aria-label={`${point.label}; ${point.layerIds.length} matching sheets`}
                aria-pressed={active}
                onClick={() => onPointSelect(point.id)}
                className={cn(
                  'absolute grid -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border outline-none transition-[transform,box-shadow] hover:scale-125 focus-visible:ring-2 focus-visible:ring-focus',
                  conflict
                    ? 'size-4 border-danger bg-danger text-white'
                    : selectedLayerMatch
                      ? 'size-3.5 border-accent/70 bg-accent text-white'
                      : 'size-2.5 border-line-strong bg-canvas text-ink-faint',
                  active && 'scale-150 shadow-[0_0_0_5px_var(--color-accent-soft)]'
                )}
                style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
              >
                {conflict ? (
                  <span aria-hidden="true" className="text-[8px] font-bold">
                    !
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas/92 px-2.5 py-2 text-[9px] text-ink-muted shadow-sm backdrop-blur">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-accent" />
            selected sheet match
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full border border-line-strong bg-canvas" />
            other point
          </span>
          <span className="flex items-center gap-1 text-danger-strong">
            <span className="size-2 rounded-full bg-danger" />
            conflict
          </span>
          <span className="ml-auto tabular-nums text-ink-faint">
            {visiblePoints.length} of {scenario.projectionPoints.length} deterministic samples
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-canvas p-2.5">
        <Filter aria-hidden="true" className="size-3.5 text-ink-faint" />
        <span className="mr-1 self-center text-[9px] font-medium text-ink-muted">
          Remaining filters
        </span>
        {remainingDimensions.map((dimension) => (
          <label
            key={dimension.id}
            htmlFor={`projection-filter-${dimension.id}`}
            className="grid gap-1 text-[8px] text-ink-faint"
          >
            {dimension.label} · {dimension.kind === 'tag' ? 'multi-valued tag' : 'scalar'}
            <Select
              id={`projection-filter-${dimension.id}`}
              aria-label={`Filter projection by ${dimension.label}`}
              value={filters[dimension.id] ?? ''}
              onChange={(event) => onFilterChange(dimension.id, event.currentTarget.value)}
              className="w-[138px]"
            >
              <option value="">All values</option>
              {dimension.values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
        ))}
      </div>
    </div>
  );
}

function EffectiveDocument({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  return (
    <div className="mx-auto max-w-[760px] space-y-2 rounded-xl border border-line bg-canvas p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
            Resolved draft
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-ink">Final ordered document</h3>
        </div>
        <Badge tone="neutral" className="font-mono text-[9px]">
          {scenario.pin.canonicalUrl}
        </Badge>
      </div>
      {scenario.pin.placements.map((placement) => (
        <article
          key={placement.placementKey}
          className={cn(
            'rounded-lg border p-3',
            placement.diff === 'hidden'
              ? 'border-dashed border-danger/30 bg-danger-soft/35'
              : 'border-line bg-surface-subtle'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <code className="text-[10px] font-semibold text-ink">{placement.placementKey}</code>
            <Badge
              tone={
                placement.diff === 'hidden'
                  ? 'danger'
                  : placement.diff === 'changed'
                    ? 'info'
                    : 'neutral'
              }
              className="h-5 text-[9px]"
            >
              {placement.blockType} · {placement.diff}
            </Badge>
          </div>
          <p
            className={cn(
              'mt-2 text-xs leading-5 text-ink-muted',
              placement.diff === 'hidden' && 'line-through'
            )}
          >
            {placement.draftValue}
          </p>
          <p className="mt-2 font-mono text-[9px] text-ink-faint">
            winner: {placement.winningLayerId} / {placement.version}
          </p>
        </article>
      ))}
    </div>
  );
}

function CenterWorkspace({
  scenario,
  initialWorkspace,
  view,
  axes,
  filters,
  selectedLayer,
  activePointId,
  onViewChange,
  onAxesChange,
  onFilterChange,
  onPointSelect,
  onInspectRow,
}: Readonly<{
  scenario: ScenarioFixture;
  initialWorkspace: CmsWorkspaceSnapshot;
  view: WorkspaceView;
  axes: [string, string];
  filters: Record<string, string>;
  selectedLayer: VariantLayer;
  activePointId: string;
  onViewChange: (view: WorkspaceView) => void;
  onAxesChange: (axisIndex: 0 | 1, value: string) => void;
  onFilterChange: (dimensionId: string, value: string) => void;
  onPointSelect: (pointId: string) => void;
  onInspectRow: (row: InstanceRow) => void;
}>) {
  return (
    <section aria-labelledby="map-workspace-heading" className="min-w-0 bg-surface">
      <div className="sticky top-[52px] z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas/95 px-3 py-2.5 backdrop-blur">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
            Map workspace
          </p>
          <h2 id="map-workspace-heading" className="mt-0.5 text-sm font-semibold text-ink">
            {selectedLayer.name}
          </h2>
        </div>
        <div
          role="tablist"
          aria-label="Map view"
          className="flex w-full max-w-full overflow-x-auto rounded-lg border border-line bg-surface-subtle p-1 sm:w-auto"
        >
          {(
            [
              ['projection', 'Projection', Sheet],
              ['instances', 'Instances', Rows3],
              ['document', 'Document', Blocks],
              ['blocks', 'Block authoring', Braces],
              ['tags', 'Tags', Filter],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`map-view-tab-${id}`}
              aria-controls={`map-view-panel-${id}`}
              aria-selected={view === id}
              tabIndex={view === id ? 0 : -1}
              onClick={() => onViewChange(id)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
                view === id ? 'bg-canvas text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
              )}
            >
              <Icon aria-hidden="true" className="size-3" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        id={`map-view-panel-${view}`}
        role="tabpanel"
        aria-labelledby={`map-view-tab-${view}`}
        className="p-3 sm:p-4"
      >
        {view === 'projection' ? (
          <Projection
            scenario={scenario}
            axes={axes}
            filters={filters}
            selectedLayer={selectedLayer}
            activePointId={activePointId}
            onAxesChange={onAxesChange}
            onFilterChange={onFilterChange}
            onPointSelect={onPointSelect}
          />
        ) : null}
        {view === 'instances' ? (
          <InstanceTable scenario={scenario} onInspect={onInspectRow} />
        ) : null}
        {view === 'document' ? <EffectiveDocument scenario={scenario} /> : null}
        {view === 'blocks' ? (
          <div className="space-y-4">
            <SqliteAuthoringWorkbench scenario={scenario} initialWorkspace={initialWorkspace} />
            <details className="rounded-xl border border-line bg-canvas p-3">
              <summary className="cursor-pointer text-[10px] font-semibold text-ink-muted">
                Open the schema and lifecycle communication guide
              </summary>
              <div className="mt-3">
                <BlockAuthoringProof scenario={scenario} />
              </div>
            </details>
          </div>
        ) : null}
        {view === 'tags' ? <TagAuthoringProof scenario={scenario} /> : null}
      </div>
    </section>
  );
}

function ResolutionPin({
  scenario,
  selectedLayer,
  selectedRow,
  layerOrder,
  tab,
  onTabChange,
}: Readonly<{
  scenario: ScenarioFixture;
  selectedLayer: VariantLayer;
  selectedRow: InstanceRow | null;
  layerOrder: string[];
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
}>) {
  const matchingLayerIds = selectedRow
    ? selectedRow.matchingLayerIds
    : scenario.pin.matchingLayerIds;
  const matchingLayers = matchingLayerIds
    .map((layerId) => scenario.layers.find((layer) => layer.id === layerId))
    .filter((layer): layer is VariantLayer => Boolean(layer));
  const inspectedUrl = selectedRow?.canonicalUrl ?? scenario.pin.canonicalUrl;
  const inspectedTags = selectedRow?.tags ?? scenario.pin.tags;
  const inspectedDimensions = selectedRow?.dimensions ?? scenario.pin.dimensions;
  const effectivePlacements = selectedRow
    ? resolveFixturePlacements(scenario, matchingLayerIds)
    : scenario.pin.placements;
  const hasConflict = selectedRow?.conflict ?? scenario.conflictState === '2 conflicts';
  const routerStatus = selectedRow?.lifecycle ?? 'live';
  const auteurStatus = selectedRow?.auteurState ?? 'published';
  const requestOutcome =
    routerStatus !== 'live'
      ? 404
      : auteurStatus === 'published'
        ? 200
        : auteurStatus === 'missing'
          ? 503
          : 404;
  const previewWinners = effectivePlacements.map((placement) => {
    let previewLayerId = placement.winningLayerId;
    let previewVersion = placement.version;

    for (const layerId of layerOrder) {
      if (!matchingLayerIds.includes(layerId)) continue;
      const layer = scenario.layers.find((candidate) => candidate.id === layerId);
      const operation = layer?.operations.find(
        (candidate) =>
          candidate.placementKey === placement.placementKey && candidate.kind !== 'inherit'
      );
      if (operation) {
        previewLayerId = layerId;
        previewVersion = operation.version;
      }
    }

    return {
      placementKey: placement.placementKey,
      layerId: previewLayerId,
      version: previewVersion,
    };
  });

  return (
    <aside
      aria-labelledby="resolution-pin-heading"
      className="min-h-0 border-t border-line bg-canvas xl:border-l xl:border-t-0"
    >
      <div className="sticky top-[52px] z-20 border-b border-line bg-canvas">
        <div className="flex items-start justify-between gap-3 px-3 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
              Resolution pin
            </p>
            <h2 id="resolution-pin-heading" className="mt-0.5 text-sm font-semibold text-ink">
              Explain one point
            </h2>
          </div>
          <MapPin aria-hidden="true" className="size-4 text-accent" />
        </div>
        <div
          role="tablist"
          aria-label="Inspector view"
          className="grid grid-cols-3 border-t border-line"
        >
          {(
            [
              ['pin', 'Trace', PanelRight],
              ['sql', 'Selector SQL', Code2],
              ['diff', 'Draft diff', FileDiff],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`inspector-tab-${id}`}
              aria-controls={`inspector-panel-${id}`}
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => onTabChange(id)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-1 border-b-2 text-[9px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
                tab === id
                  ? 'border-accent text-accent-strong'
                  : 'border-transparent text-ink-faint hover:text-ink'
              )}
            >
              <Icon aria-hidden="true" className="size-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        id={`inspector-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`inspector-tab-${tab}`}
        className="space-y-4 p-3 xl:max-h-[calc(100svh-188px)] xl:overflow-y-auto"
      >
        {tab === 'pin' ? (
          <>
            <section>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Canonical URL
              </p>
              <code className="mt-1.5 block break-all rounded-md border border-line bg-surface-subtle p-2 font-mono text-[10px] leading-4 text-ink">
                {inspectedUrl}
              </code>
            </section>
            <section>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Dimensions and indexed tags
              </p>
              <div className="flex flex-wrap gap-1">
                {inspectedDimensions.map((dimension) => (
                  <Badge key={dimension.key} className="h-5 font-mono text-[8px]">
                    {dimension.key}:{dimension.value} · {dimension.kind}
                  </Badge>
                ))}
                {inspectedTags.map((tag) => (
                  <Badge key={tag} tone="info" className="h-5 font-mono text-[8px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
            <section className="grid grid-cols-2 gap-2" aria-label="Route and content authority">
              <div className="rounded-md border border-line bg-surface-subtle p-2">
                <p className="text-[8px] font-semibold uppercase text-ink-faint">RouterService</p>
                <Badge
                  dot
                  tone={routerStatus === 'live' ? 'success' : 'neutral'}
                  className="mt-1.5 h-5 text-[8px]"
                >
                  route {routerStatus.replace('_', ' ')}
                </Badge>
              </div>
              <div className="rounded-md border border-line bg-surface-subtle p-2">
                <p className="text-[8px] font-semibold uppercase text-ink-faint">Auteur</p>
                <Badge
                  dot
                  tone={
                    auteurStatus === 'published'
                      ? 'success'
                      : auteurStatus === 'missing'
                        ? 'danger'
                        : 'warning'
                  }
                  className="mt-1.5 h-5 text-[8px]"
                >
                  content {auteurStatus.replace('_', ' ')}
                </Badge>
              </div>
              <div
                className={cn(
                  'col-span-2 rounded-md border p-2 text-[9px] font-medium',
                  requestOutcome === 200
                    ? 'border-success/25 bg-success-soft text-success-strong'
                    : requestOutcome === 503
                      ? 'border-danger/25 bg-danger-soft text-danger-strong'
                      : 'border-line bg-surface-subtle text-ink-muted'
                )}
              >
                Request outcome · HTTP {requestOutcome}
                {requestOutcome === 503 ? ' · unsafe live route without an active document' : ''}
              </div>
            </section>
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                  Matching sheets
                </p>
                <span className="text-[8px] text-ink-faint">low → high</span>
              </div>
              <ol className="space-y-1.5">
                {matchingLayers.map((layer) => (
                  <li
                    key={layer.id}
                    className={cn('rounded-md border px-2 py-1.5', layerToneClasses[layer.tone])}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[9px] font-semibold">
                        P{layer.priority} · {layer.name}
                      </span>
                      <span className="text-[8px] opacity-70">{layer.operations.length} ops</span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[8px] opacity-70">
                      {layer.selector}
                    </p>
                    {layer.operations.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 border-t border-current/10 pt-1">
                        {layer.operations.map((operation) => (
                          <li
                            key={`${layer.id}-${operation.placementKey}-${operation.version}`}
                            className="flex items-center justify-between gap-2 font-mono text-[7px] opacity-75"
                          >
                            <span className="truncate">{operation.placementKey}</span>
                            <span className="shrink-0">
                              {operation.kind} · {operation.version}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
            <section className="rounded-lg border border-accent/25 bg-accent-soft/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                  Reorder winner preview
                </p>
                <Badge tone="info" className="h-4 px-1 text-[7px]">
                  not published
                </Badge>
              </div>
              <ul className="mt-2 space-y-1">
                {previewWinners.map((winner) => (
                  <li key={winner.placementKey} className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-[8px] text-ink-muted">
                      {winner.placementKey}
                    </code>
                    <span className="shrink-0 font-mono text-[8px] text-accent-strong">
                      {winner.layerId} / {winner.version}
                    </span>
                  </li>
                ))}
              </ul>
              {hasConflict ? (
                <p className="mt-2 border-t border-accent/15 pt-2 text-[8px] leading-3.5 text-danger-strong">
                  Visual order can preview a winner, but equal saved priorities still block
                  publication.
                </p>
              ) : null}
            </section>
            {hasConflict ? (
              <div className="flex gap-2 rounded-lg border border-danger/25 bg-danger-soft p-2.5 text-danger-strong">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-semibold">Publication blocked</p>
                  <p className="mt-0.5 text-[8px] leading-3.5">
                    Two priority-40 sheets write primary-hero. No row ID or creation time can choose
                    a winner.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft p-2.5 text-success-strong">
                <Check aria-hidden="true" className="size-3.5" />
                <span className="text-[9px] font-medium">
                  Deterministic winner for every placement
                </span>
              </div>
            )}
            <section>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Final document · operations and provenance
              </p>
              <ol className="space-y-1.5">
                {effectivePlacements.map((placement) => (
                  <li
                    key={placement.placementKey}
                    className={cn(
                      'rounded-md border p-2',
                      placement.diff === 'hidden'
                        ? 'border-dashed border-danger/30 bg-danger-soft/35'
                        : 'border-line bg-surface-subtle'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="truncate font-mono text-[9px] font-semibold text-ink">
                        {placement.order}. {placement.placementKey}
                      </code>
                      <Badge
                        tone={
                          placement.diff === 'hidden'
                            ? 'danger'
                            : placement.diff === 'changed'
                              ? 'info'
                              : 'neutral'
                        }
                        className="h-4 px-1 text-[7px]"
                      >
                        {placement.diff}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[9px] leading-4 text-ink-muted">
                      {placement.draftValue}
                    </p>
                    <p className="mt-1 font-mono text-[8px] text-accent-strong">
                      preview winner ·{' '}
                      {previewWinners.find(
                        (winner) => winner.placementKey === placement.placementKey
                      )?.layerId ?? placement.winningLayerId}{' '}
                      /{' '}
                      {previewWinners.find(
                        (winner) => winner.placementKey === placement.placementKey
                      )?.version ?? placement.version}
                    </p>
                    {placement.hiddenLower ? (
                      <p className="mt-0.5 font-mono text-[8px] text-danger-strong">
                        hides lower · {placement.hiddenLower}
                      </p>
                    ) : null}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[8px] font-medium text-ink-faint">
                        Full provenance
                      </summary>
                      <ul className="mt-1 space-y-0.5 border-l border-line pl-2">
                        {placement.provenance.map((entry) => (
                          <li key={entry} className="font-mono text-[8px] text-ink-faint">
                            {entry}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ) : null}

        {tab === 'sql' ? (
          <>
            <div className={cn('rounded-lg border p-3', layerToneClasses[selectedLayer.tone])}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.1em] opacity-70">
                Selected sheet
              </p>
              <h3 className="mt-1 text-sm font-semibold">{selectedLayer.name}</h3>
              <p className="mt-1 font-mono text-[9px]">
                priority {selectedLayer.priority} · {compactNumber.format(selectedLayer.matchCount)}{' '}
                matches
              </p>
            </div>
            <section>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Plain selector
              </p>
              <p className="rounded-md bg-surface-subtle p-2 text-[10px] leading-4 text-ink-muted">
                {selectedLayer.selector}
              </p>
            </section>
            <section>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Inspectible SQL
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-line bg-ink p-3 font-mono text-[9px] leading-4 text-canvas">
                <code>{selectedLayer.selectorSql}</code>
              </pre>
            </section>
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning-soft p-2.5 text-warning-strong">
              <Eye aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <p className="text-[8px] leading-3.5">
                Selector SQL runs only against the approved read surface during preview or
                publication. Public requests read the immutable manifest.
              </p>
            </div>
            <section>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Sparse operations
              </p>
              <ul className="space-y-1.5">
                {selectedLayer.operations.map((operation) => (
                  <li
                    key={`${operation.placementKey}-${operation.version}`}
                    className="rounded-md border border-line bg-surface-subtle p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-[9px] font-semibold text-ink">
                        {operation.placementKey}
                      </code>
                      <Badge
                        tone={operation.kind === 'hide' ? 'danger' : 'info'}
                        className="h-4 px-1 text-[7px]"
                      >
                        {operation.kind}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[9px] text-ink-muted">
                      {operation.blockType} · {operation.version}
                    </p>
                    <p className="mt-0.5 text-[8px] leading-3.5 text-ink-faint">
                      {operation.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}

        {tab === 'diff' ? (
          <>
            <div className="rounded-lg border border-line bg-surface-subtle p-3">
              <div className="flex items-center gap-2">
                <Braces aria-hidden="true" className="size-4 text-accent" />
                <div>
                  <p className="text-[10px] font-semibold text-ink">Draft vs publication 19</p>
                  <p className="text-[8px] text-ink-faint">
                    Placement-key comparison, not visual guesswork
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {effectivePlacements.map((placement) => (
                <article
                  key={placement.placementKey}
                  className="overflow-hidden rounded-lg border border-line"
                >
                  <div className="flex items-center justify-between bg-surface-subtle px-2.5 py-2">
                    <code className="text-[9px] font-semibold text-ink">
                      {placement.placementKey}
                    </code>
                    <Badge
                      tone={
                        placement.diff === 'hidden'
                          ? 'danger'
                          : placement.diff === 'changed'
                            ? 'info'
                            : 'neutral'
                      }
                      className="h-4 px-1 text-[7px]"
                    >
                      {placement.diff}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-line">
                    <div className="p-2">
                      <p className="text-[8px] font-semibold uppercase text-ink-faint">Published</p>
                      <p className="mt-1 text-[8px] leading-3.5 text-ink-muted">
                        {placement.publishedValue}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'p-2',
                        placement.diff === 'hidden'
                          ? 'bg-danger-soft/40'
                          : placement.diff === 'changed'
                            ? 'bg-accent-soft/40'
                            : ''
                      )}
                    >
                      <p className="text-[8px] font-semibold uppercase text-ink-faint">Draft</p>
                      <p className="mt-1 text-[8px] leading-3.5 text-ink-muted">
                        {placement.draftValue}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Link
              to="/publications/$templateId"
              params={{ templateId: scenario.id }}
              className={buttonClassName({ className: 'w-full' })}
            >
              Inspect publication and rollback{' '}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </>
        ) : null}
      </div>
    </aside>
  );
}

export function TemplateWorkspace({
  scenario,
  initialWorkspace,
}: Readonly<{ scenario: ScenarioFixture; initialWorkspace: CmsWorkspaceSnapshot }>) {
  const initialLayerId = scenario.layers[1]?.id ?? scenario.layers[0]?.id ?? '';
  const [selectedLayerId, setSelectedLayerId] = useState(initialLayerId);
  const [layerOrder, setLayerOrder] = useState(() => scenario.layers.map((layer) => layer.id));
  const [view, setView] = useState<WorkspaceView>('projection');
  const [axes, setAxes] = useState<[string, string]>(scenario.defaultAxes);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activePointId, setActivePointId] = useState(scenario.projectionPoints[0]?.id ?? '');
  const [selectedRow, setSelectedRow] = useState<InstanceRow | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('pin');
  const selectedLayer =
    scenario.layers.find((layer) => layer.id === selectedLayerId) ?? scenario.layers[0];

  if (!selectedLayer) return null;

  function moveLayer(layerId: string, direction: 'up' | 'down') {
    setLayerOrder((current) => {
      const currentIndex = current.indexOf(layerId);
      const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
      if (currentIndex <= 0 || targetIndex <= 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const target = next[targetIndex];
      if (!target) return current;
      next[targetIndex] = layerId;
      next[currentIndex] = target;
      return next;
    });
  }

  function changeAxis(axisIndex: 0 | 1, value: string) {
    setAxes((current) => (axisIndex === 0 ? [value, current[1]] : [current[0], value]));
    setFilters((current) => {
      if (!(value in current)) return current;
      const next = { ...current };
      delete next[value];
      return next;
    });
  }

  function changeFilter(dimensionId: string, value: string) {
    setFilters((current) => ({ ...current, [dimensionId]: value }));
  }

  function inspectPoint(pointId: string) {
    setActivePointId(pointId);
    setSelectedRow(null);
    setInspectorTab('pin');
  }

  function inspectRow(row: InstanceRow) {
    setSelectedRow(row);
    setInspectorTab('pin');
  }

  return (
    <div className="min-h-[calc(100svh-52px)] bg-surface">
      <WorkspaceHeader scenario={scenario} />
      <div className="mx-auto grid w-full max-w-[1800px] xl:min-h-[calc(100svh-210px)] xl:grid-cols-[250px_minmax(0,1fr)_300px] 2xl:grid-cols-[286px_minmax(520px,1fr)_350px]">
        <LayerStack
          scenario={scenario}
          layerOrder={layerOrder}
          selectedLayerId={selectedLayer.id}
          onSelect={(layerId) => {
            setSelectedLayerId(layerId);
            setInspectorTab('sql');
          }}
          onMove={moveLayer}
        />
        <CenterWorkspace
          scenario={scenario}
          initialWorkspace={initialWorkspace}
          view={view}
          axes={axes}
          filters={filters}
          selectedLayer={selectedLayer}
          activePointId={activePointId}
          onViewChange={setView}
          onAxesChange={changeAxis}
          onFilterChange={changeFilter}
          onPointSelect={inspectPoint}
          onInspectRow={inspectRow}
        />
        <ResolutionPin
          scenario={scenario}
          selectedLayer={selectedLayer}
          selectedRow={selectedRow}
          layerOrder={layerOrder}
          tab={inspectorTab}
          onTabChange={setInspectorTab}
        />
      </div>
    </div>
  );
}
