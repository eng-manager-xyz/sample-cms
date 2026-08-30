import { Braces, ChevronRight, GitBranch, Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { parseContentJson } from '@/data/authoring-studio';
import type { CmsWorkspacePlacement } from '@/data/sqlite-authoring';
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
  onSelect,
}: Readonly<{
  placement: CmsWorkspacePlacement;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}>) {
  return (
    <section
      data-placement-key={placement.placementKey}
      className={cn(
        'group relative bg-canvas outline outline-1 outline-transparent transition-shadow',
        selected
          ? 'z-10 outline-2 outline-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]'
          : 'hover:z-10 hover:outline-line-strong'
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
      <div className="pointer-events-none absolute left-2 top-2 z-20 flex flex-wrap items-center gap-1.5 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
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
    </section>
  );
}
