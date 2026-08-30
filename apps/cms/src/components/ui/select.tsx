import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Select({
  className,
  children,
  density = 'default',
  ...props
}: Readonly<
  SelectHTMLAttributes<HTMLSelectElement> & {
    density?: 'default' | 'compact';
  }
>) {
  return (
    <select
      className={cn(
        'min-w-0 rounded-md border border-line-strong bg-canvas text-ink outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60',
        density === 'compact' ? 'h-7 px-2 text-[11px]' : 'h-8 px-2.5 text-xs',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
