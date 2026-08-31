import { GitBranch, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
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
  const selectedDescription = selectedVariant
    ? `P${selectedVariant.priority} · ${selectedVariant.name} · ${
        selectedVariant.isDefault
          ? 'template default'
          : selectedVariant.matchesSamplePage
            ? 'matches preview'
            : 'does not match preview'
      }`
    : 'Choose a template variation';

  return (
    <div
      className="flex min-w-0 items-center gap-0.5 sm:gap-1"
      data-scope-kind={hasSelectedSelector ? 'selector' : 'default'}
    >
      <label className="sr-only" htmlFor="authoring-scope">
        Template variation
      </label>
      <Select
        id="authoring-scope"
        density="compact"
        className="w-24 shrink-0 font-medium sm:w-36 xl:w-44"
        value={selectedScopeId}
        disabled={disabled}
        title={`Template variation: ${selectedDescription}`}
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
      </Select>
      {hasSelectedSelector ? (
        <>
          <Button
            size="icon-sm"
            disabled={disabled}
            aria-label={`View selector for ${selectedVariant?.name ?? 'selected variation'}`}
            onClick={onViewSelector}
            title="Open the template-scoped authored predicate and generated SQLite preview"
          >
            <GitBranch aria-hidden="true" className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
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
  );
}
