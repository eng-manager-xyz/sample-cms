import {
  ArrowDown,
  ArrowUp,
  Braces,
  ChevronRight,
  GitBranch,
  Layers3,
  Plus,
  RotateCcw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseContentJson } from '@/data/authoring-studio';
import type { CmsWorkspacePlacement, CmsWorkspaceTombstone } from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

function primaryText(placement: CmsWorkspacePlacement): string {
  try {
    const content = parseContentJson(placement.renderedJson);
    const preferredKeys = ['headline', 'message', 'label', 'legal', 'copy'];
    for (const key of preferredKeys) {
      const value = content[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    const firstScalar = Object.values(content).find(
      (value) => typeof value === 'string' || typeof value === 'number'
    );
    return firstScalar === undefined ? 'Configured block' : String(firstScalar);
  } catch {
    return 'Preview unavailable';
  }
}

function BlockPreview({ placement }: Readonly<{ placement: CmsWorkspacePlacement }>) {
  const copy = primaryText(placement);
  if (placement.blockType === 'navigation') {
    return (
      <div className="flex min-h-16 items-center justify-between border-b border-line px-6">
        <span className="text-base font-bold tracking-[-0.03em]">{copy}</span>
        <span className="flex items-center gap-5 text-xs text-ink-muted">
          Explore <span className="rounded-full bg-ink px-3 py-1.5 text-canvas">Sign in</span>
        </span>
      </div>
    );
  }
  if (placement.blockType === 'hero' || placement.blockType === 'hero_alt') {
    return (
      <div
        className={cn(
          'grid min-h-56 gap-8 px-7 py-10 sm:px-10',
          placement.blockType === 'hero_alt' && 'md:grid-cols-[minmax(0,1fr)_12rem]'
        )}
      >
        <div className="self-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-strong">
            {placement.blockType === 'hero_alt' ? 'Split hero' : 'Featured'}
          </span>
          <h2 className="mt-3 max-w-3xl text-3xl font-bold leading-[1.04] tracking-[-0.045em] text-ink sm:text-5xl">
            {copy}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink-muted">
            Evaluated for the selected canonical page context.
          </p>
        </div>
        {placement.blockType === 'hero_alt' ? (
          <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-accent/40 bg-accent-soft/60">
            <span className="text-xs font-semibold text-accent-strong">Alternate media</span>
          </div>
        ) : null}
      </div>
    );
  }
  if (placement.blockType === 'promo') {
    return (
      <div className="m-6 flex items-center justify-between gap-5 rounded-xl bg-accent-soft px-6 py-5 text-accent-strong">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Promotion</span>
          <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">{copy}</p>
        </div>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </div>
    );
  }
  if (placement.blockType === 'footer') {
    return (
      <div className="border-t border-line bg-surface-muted px-6 py-8 text-xs text-ink-muted">
        <p className="font-medium text-ink">Auteur</p>
        <p className="mt-3">{copy}</p>
      </div>
    );
  }
  return <pre className="overflow-auto p-6 text-xs text-ink-muted">{placement.renderedJson}</pre>;
}

export function CanvasBlock({
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
        'group relative bg-canvas outline outline-1 outline-transparent transition-[box-shadow,outline-color] hover:z-20 hover:outline-2 hover:outline-accent focus-within:z-20 focus-within:outline-2 focus-within:outline-accent',
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
        <BlockPreview placement={placement} />
      </div>
      <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">
          {placement.order + 1} · {placement.placementKey}
        </Badge>
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
      <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-lg border border-accent/25 bg-canvas/95 p-1 opacity-100 shadow-sm backdrop-blur lg:pointer-events-none lg:opacity-0 lg:transition-opacity lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100">
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
        className="absolute left-1/2 top-0 z-30 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-accent bg-canvas text-accent-strong opacity-100 shadow-sm outline-none transition-[opacity,transform] hover:scale-110 focus-visible:ring-2 focus-visible:ring-focus lg:pointer-events-none lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100"
        onClick={() => onAdd('before')}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Add block below ${placement.placementKey}`}
        title="Add block below"
        className="absolute bottom-0 left-1/2 z-30 grid size-6 -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border border-accent bg-canvas text-accent-strong opacity-100 shadow-sm outline-none transition-[opacity,transform] hover:scale-110 focus-visible:ring-2 focus-visible:ring-focus lg:pointer-events-none lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100"
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
      className="group relative grid min-h-24 place-items-center border-y border-dashed border-line-strong bg-surface-muted/65 px-6 py-8 outline outline-1 outline-transparent transition-[outline-color] hover:z-20 hover:outline-2 hover:outline-accent focus-within:z-20 focus-within:outline-2 focus-within:outline-accent"
    >
      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <Badge tone="info">
          <GitBranch aria-hidden="true" className="size-3" /> Local
        </Badge>
        <Badge tone="warning">Hidden</Badge>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-ink-muted">{tombstone.placementKey}</p>
        <p className="mt-1 text-[10px] text-ink-faint">
          {tombstone.hiddenPlacement?.blockType ?? 'Inherited block'} is hidden in this scope
        </p>
      </div>
      <div className="absolute right-2 top-2 flex items-center gap-2 rounded-lg border border-accent/25 bg-canvas/95 px-2 py-1.5 shadow-sm">
        <span className="text-[10px] font-medium text-ink-muted">Visible</span>
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
