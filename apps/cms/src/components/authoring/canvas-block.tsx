import {
  CmsRenderedBlock,
  type CmsRenderedPageContext,
  type CmsRenderedPlacement,
} from '@repo/cms-renderer';
import { ArrowDown, ArrowUp, Braces, GitBranch, Layers3, Plus, RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseContentJson } from '@/data/authoring-studio';
import type { CmsWorkspacePlacement, CmsWorkspaceTombstone } from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

function renderedPlacement(placement: CmsWorkspacePlacement): CmsRenderedPlacement {
  let content: Readonly<Record<string, unknown>>;
  try {
    content = parseContentJson(placement.renderedJson);
  } catch {
    content = { rendererError: 'The rendered block content is not valid JSON.' };
  }
  return {
    placementKey: placement.placementKey,
    order: placement.order,
    blockType: placement.blockType,
    content,
  };
}

export function CanvasBlock({
  page,
  placement,
  selected,
  disabled,
  index,
  count,
  isDefault,
  onSelect,
  onAdd,
  onMove,
  onToggleVisibility,
  onRevert,
}: Readonly<{
  page: CmsRenderedPageContext;
  placement: CmsWorkspacePlacement;
  selected: boolean;
  disabled: boolean;
  index: number;
  count: number;
  isDefault: boolean;
  onSelect: () => void;
  onAdd: (position: 'before' | 'after') => void;
  onMove: (direction: 'up' | 'down') => void;
  onToggleVisibility: () => void;
  onRevert: () => void;
}>) {
  const showRevert = !isDefault && !placement.inherited;
  return (
    <section
      data-placement-key={placement.placementKey}
      className={cn(
        'group relative outline outline-1 outline-transparent transition-[box-shadow,outline-color] hover:z-20 hover:outline-2 hover:outline-accent focus-within:z-20 focus-within:outline-2 focus-within:outline-accent',
        selected
          ? 'z-10 outline-2 outline-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]'
          : 'hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_10%,transparent)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_10%,transparent)]'
      )}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Inspect ${placement.placementKey}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-none outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset disabled:cursor-not-allowed"
        onClick={onSelect}
      />
      <div className="pointer-events-none">
        <CmsRenderedBlock page={page} placement={renderedPlacement(placement)} />
      </div>
      <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-wrap items-center gap-1.5">
        <Badge tone={placement.inherited ? 'neutral' : 'info'}>
          {placement.inherited ? (
            <Layers3 aria-hidden="true" className="size-3" />
          ) : (
            <GitBranch aria-hidden="true" className="size-3" />
          )}
          {placement.inherited ? 'Inherited' : 'Local'}
        </Badge>
        {placement.draftDifference !== 'same' ? (
          <Badge tone="warning">
            <Braces aria-hidden="true" className="size-3" />
            Draft {placement.draftDifference}
          </Badge>
        ) : null}
      </div>
      <div className="authoring-hover-control pointer-events-none absolute right-2 top-2 z-30 flex items-center gap-1 rounded-lg border border-accent/25 bg-canvas/95 p-1 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <Badge tone="neutral">
          {placement.order + 1} · {placement.placementKey}
        </Badge>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled || index === 0}
          aria-label={`Move ${placement.placementKey} up`}
          title="Move block up"
          onClick={() => onMove('up')}
        >
          <ArrowUp aria-hidden="true" className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled || index === count - 1}
          aria-label={`Move ${placement.placementKey} down`}
          title="Move block down"
          onClick={() => onMove('down')}
        >
          <ArrowDown aria-hidden="true" className="size-3.5" />
        </Button>
        {showRevert ? (
          <Button
            size="icon"
            variant="ghost"
            disabled={disabled}
            aria-label={`Revert local operation for ${placement.placementKey}`}
            title="Revert to inherited block"
            onClick={onRevert}
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
          </Button>
        ) : null}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <button
          type="button"
          role="switch"
          aria-checked="true"
          aria-label={`Hide ${placement.placementKey}`}
          title={isDefault ? 'Remove block from the default document' : 'Hide block in this scope'}
          disabled={disabled}
          className="relative h-5 w-9 rounded-full bg-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
          onClick={onToggleVisibility}
        >
          <span className="absolute right-0.5 top-0.5 size-4 rounded-full bg-canvas shadow-sm" />
        </button>
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Add block above ${placement.placementKey}`}
        title="Add block above"
        className="authoring-hover-control pointer-events-none absolute left-1/2 top-0 z-30 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-accent bg-canvas text-accent-strong opacity-0 shadow-sm outline-none transition-[opacity,transform] hover:scale-110 focus-visible:ring-2 focus-visible:ring-focus group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        onClick={() => onAdd('before')}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Add block below ${placement.placementKey}`}
        title="Add block below"
        className="authoring-hover-control pointer-events-none absolute bottom-0 left-1/2 z-30 grid size-6 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border border-accent bg-canvas text-accent-strong opacity-0 shadow-sm outline-none transition-[opacity,transform] hover:scale-110 focus-visible:ring-2 focus-visible:ring-focus group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        onClick={() => onAdd('after')}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
    </section>
  );
}

export function HiddenCanvasBlock({
  tombstone,
  disabled,
  onRestore,
}: Readonly<{
  tombstone: CmsWorkspaceTombstone;
  disabled: boolean;
  onRestore: () => void;
}>) {
  return (
    <section
      data-hidden-placement-key={tombstone.placementKey}
      className="group relative z-30 h-9 overflow-visible"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-warning" />
      <div className="absolute left-2 top-0 flex -translate-y-1/2 items-center gap-1.5">
        <Badge tone="info">
          <GitBranch aria-hidden="true" className="size-3" /> Local
        </Badge>
        <Badge tone="warning">Hidden</Badge>
      </div>
      <div className="authoring-hover-control pointer-events-none absolute right-2 top-0 flex -translate-y-1/2 items-center gap-2 rounded-lg border border-accent/25 bg-canvas/95 px-2 py-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <span className="text-[10px] font-medium text-ink-muted">
          {tombstone.placementKey} · visible
        </span>
        <button
          type="button"
          role="switch"
          aria-checked="false"
          aria-label={`Show ${tombstone.placementKey}`}
          title="Restore the inherited block"
          disabled={disabled}
          className="relative h-5 w-9 rounded-full bg-line-strong outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
          onClick={onRestore}
        >
          <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-canvas shadow-sm" />
        </button>
      </div>
    </section>
  );
}
