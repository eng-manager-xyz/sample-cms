import { ChevronRight } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export const compactTreeRowClassName =
  'flex min-h-8 min-w-0 items-center rounded-md text-[12px] font-medium outline-none transition-colors';

export function CompactTreeRow({
  activeAncestor = false,
  children,
  className,
}: Readonly<{
  activeAncestor?: boolean;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'group/tree-row flex min-w-0 items-center rounded-md',
        activeAncestor && 'bg-surface-muted/70',
        className
      )}
      data-active-branch={activeAncestor || undefined}
    >
      {children}
    </div>
  );
}

export function CompactTreeDisclosure({
  expanded,
  label,
  controls,
  className,
  ...props
}: Readonly<
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'aria-controls' | 'aria-expanded' | 'aria-label'
  > & {
    expanded: boolean;
    label: string;
    controls: string;
  }
>) {
  return (
    <button
      type="button"
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
      aria-expanded={expanded}
      aria-controls={controls}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-md text-ink-faint outline-none transition-colors hover:bg-canvas hover:text-ink focus-visible:ring-2 focus-visible:ring-focus',
        className
      )}
      {...props}
    >
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.8}
        className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
      />
    </button>
  );
}

export function CompactTreeChildren({
  id,
  label,
  children,
  className,
}: Readonly<{
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <ul
      id={id}
      aria-label={label}
      className={cn('relative ml-4 mt-1 space-y-0.5 border-l border-line pl-3', className)}
    >
      {children}
    </ul>
  );
}
