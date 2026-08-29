import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-line bg-surface-muted text-ink-muted',
  success: 'border-success/20 bg-success-soft text-success-strong',
  warning: 'border-warning/25 bg-warning-soft text-warning-strong',
  danger: 'border-danger/20 bg-danger-soft text-danger-strong',
  info: 'border-accent/20 bg-accent-soft text-accent-strong',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({
  children,
  className,
  tone = 'neutral',
  dot = false,
  ...props
}: Readonly<BadgeProps>) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none',
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
