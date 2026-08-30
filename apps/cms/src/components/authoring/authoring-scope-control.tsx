import { GitBranch, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CmsWorkspaceVariant } from '@/data/sqlite-authoring';

export function AuthoringScopeControl({
  variants,
  selectedScopeId,
  disabled,
  onSelectScope,
  onViewSelector,
  onClearSelector,
}: Readonly<{
  variants: readonly CmsWorkspaceVariant[];
  selectedScopeId: string;
  disabled: boolean;
  onSelectScope: (scopeId: string) => void;
  onViewSelector: () => void;
  onClearSelector: () => void;
}>) {
  const selectedVariant = variants.find((variant) => variant.id === selectedScopeId);
  const hasSelectedSelector = Boolean(selectedVariant && !selectedVariant.isDefault);
  const clearLabel = selectedVariant
    ? `Clear ${selectedVariant.name} and return to template default`
    : 'Return to template default';

  return (
    <div className="min-w-56 sm:min-w-72">
      <label
        className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
        htmlFor="authoring-scope"
      >
        Template variation
      </label>
      <div
        className="flex h-9 min-w-0 items-center gap-1 rounded-lg border border-line-strong bg-canvas p-1 shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
        data-scope-kind={hasSelectedSelector ? 'selector' : 'default'}
      >
        <select
          id="authoring-scope"
          className="h-7 min-w-0 flex-1 bg-transparent px-2 text-xs text-ink outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          value={selectedScopeId}
          disabled={disabled}
          onChange={(event) => onSelectScope(event.currentTarget.value)}
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              P{variant.priority} · {variant.name}
              {variant.isDefault
                ? ' · template default'
                : variant.matchesSamplePage
                  ? ' · matches preview'
                  : ' · does not match preview'}
            </option>
          ))}
        </select>
        {hasSelectedSelector ? (
          <>
            <Button
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={disabled}
              onClick={onViewSelector}
              title="Open the template-scoped authored predicate and generated SQLite preview"
            >
              <GitBranch aria-hidden="true" className="size-3" /> View selector
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={disabled}
              aria-label={clearLabel}
              title={clearLabel}
              onClick={onClearSelector}
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
