import type { ComponentPropsWithRef } from 'react';
import {
  type ButtonSize,
  type ButtonVariant,
  buttonClassName,
} from '@/components/ui/button-styles';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  type = 'button',
  ...props
}: Readonly<ButtonProps>) {
  return (
    <button type={type} className={buttonClassName({ variant, size, className })} {...props} />
  );
}
