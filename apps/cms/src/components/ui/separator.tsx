import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Separator({ className, ...props }: Readonly<HTMLAttributes<HTMLHRElement>>) {
  return <hr className={cn('h-px w-full border-0 bg-line', className)} {...props} />;
}
