import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Select({
  className,
  children,
  ...props
}: Readonly<SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select
      className={cn(
        'h-8 min-w-0 rounded-md border border-line-strong bg-canvas px-2.5 text-xs text-ink outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
