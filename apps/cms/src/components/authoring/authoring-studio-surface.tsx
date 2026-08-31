import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export function AuthoringDocumentSurface({
  children,
  inspectorCollapsed = false,
}: Readonly<{ children: ReactNode; inspectorCollapsed?: boolean }>) {
  return (
    <div
      className={cn(
        'grid min-h-[calc(100vh-6rem)] gap-3 bg-surface-muted/50 p-3 transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none sm:min-h-[calc(100vh-3.25rem)]',
        inspectorCollapsed
          ? 'xl:grid-cols-[minmax(520px,1fr)_44px] xl:gap-0'
          : 'xl:grid-cols-[minmax(520px,1fr)_390px]'
      )}
      data-authoring-mode="document"
      data-inspector-collapsed={inspectorCollapsed ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

export function AuthoringSelectorSurface({
  children,
  disabled,
  onReturnToDocument,
}: Readonly<{
  children: ReactNode;
  disabled: boolean;
  onReturnToDocument: () => void;
}>) {
  return (
    <section
      className="min-h-[calc(100vh-6rem)] bg-surface-muted/50 p-3 sm:min-h-[calc(100vh-3.25rem)]"
      data-authoring-mode="selector"
      aria-labelledby="selector-mode-heading"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
            Template-wide mode
          </p>
          <h2 id="selector-mode-heading" className="mt-0.5 text-sm font-semibold text-ink">
            Selector and cascade
          </h2>
          <p className="mt-1 text-[11px] text-ink-muted">
            The selected page remains preview context while selector intent and impact span the
            entire template.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onReturnToDocument}
          aria-label="Return to document authoring"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> Back to document
        </Button>
      </div>
      {children}
    </section>
  );
}
