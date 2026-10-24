'use client';
import React, {forwardRef, type ButtonHTMLAttributes, type ComponentProps} from 'react';
import {LoaderCircle} from '@pepbits/icons';
import {cn, SourceButton} from '@pepbits/ui';
import {OrviaLink} from '../services';

type Variant = 'primary' | 'secondary' | 'ghost' | 'mint';
type Size = 'sm' | 'md' | 'lg';
const base = 'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';
const variants: Record<Variant, string> = {
  primary: 'bg-scrub-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_18px_-10px_rgba(8,69,63,0.7)] hover:bg-scrub-800',
  secondary: 'border border-ink-200 bg-surface text-ink-900 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'text-ink-700 hover:bg-ink-100/70 hover:text-ink-900',
  mint: 'bg-mint text-rail hover:bg-white',
};
const sizes: Record<Size, string> = {sm: 'h-9 px-3.5 text-sm', md: 'h-11 px-5 text-[length:calc(0.95rem*var(--fs-scale))]', lg: 'h-12 px-6 text-base'};
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {return cn(base, variants[variant], sizes[size], className);}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {variant?: Variant; size?: Size; loading?: boolean}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...props}, ref) {
  return <SourceButton ref={ref} type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>}
    {children}
  </SourceButton>;
});
export function ButtonLink({variant = 'primary', size = 'md', className, ...props}: ComponentProps<typeof OrviaLink> & {variant?: Variant; size?: Size}) {
  return <OrviaLink className={buttonClasses(variant, size, className)} {...props}/>;
}
