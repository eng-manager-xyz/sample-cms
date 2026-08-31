import { cn } from '@/lib/cn';

export type ButtonVariant = 'default' | 'outline' | 'ghost';
export type ButtonSize = 'default' | 'sm' | 'icon' | 'icon-sm';

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-ink text-canvas shadow-[0_1px_1px_rgba(0,0,0,0.12)] hover:bg-ink-muted active:translate-y-px',
  outline:
    'border border-line-strong bg-canvas text-ink shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:bg-surface-subtle active:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink active:bg-line',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-9 gap-2 rounded-lg px-3.5 text-[13px]',
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-xs',
  icon: 'size-8 rounded-md',
  'icon-sm': 'size-7 rounded-md',
};

export function buttonClassName({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium outline-none transition-[background-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}
