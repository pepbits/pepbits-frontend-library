'use client';
import React, {forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes} from 'react';
import {ChevronDown, CircleAlert} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {cn, SourceInput, SourceSelect} from '@pepbits/ui';

const text = (t: (key: string) => string, value: ReactNode) => typeof value === 'string' ? t(value) : value;

interface FieldProps {label: string; htmlFor: string; required?: boolean; optional?: boolean; hint?: ReactNode; error?: string; className?: string; labelClassName?: string; aside?: ReactNode; children: ReactNode}
/** Label + control + hint/error (source `components/ui/Field.tsx`). */
export function Field({label, htmlFor, required, optional, hint, error, className, labelClassName, aside, children}: FieldProps) {
  const {t} = useLocalization();
  return <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className={cn('text-sm font-medium text-ink-800', labelClassName)}>
        {t(label)}
        {required && <span className="ms-0.5 text-signal" aria-hidden="true">*</span>}
        {optional && <span className="ms-1.5 font-normal text-ink-500">{t('Optional')}</span>}
      </label>
      {aside}
    </div>
    {children}
    <FieldMessage id={htmlFor} error={error} hint={text(t, hint)}/>
  </div>;
}
export function FieldMessage({id, error, hint}: {id: string; error?: string; hint?: ReactNode}) {
  const {t} = useLocalization();
  if (error) return <p id={`${id}-error`} className="flex animate-fade-in items-start gap-1.5 text-[length:calc(0.8rem*var(--fs-scale))] font-medium text-signal">
    <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true"/>{t(error)}
  </p>;
  if (hint) return <p id={`${id}-hint`} className="text-[length:calc(0.8rem*var(--fs-scale))] leading-snug text-ink-500">{hint}</p>;
  return null;
}

const control = 'h-11 w-full rounded-xl border bg-surface px-3.5 text-[length:calc(0.95rem*var(--fs-scale))] text-ink-900 placeholder:text-ink-400 transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';
const ok = 'border-ink-200 hover:border-ink-300 focus:border-scrub-500 focus:ring-scrub-100';
const bad = 'border-signal/70 bg-[color-mix(in_srgb,var(--danger)_5%,var(--surface))] focus:border-signal focus:ring-signal/15';
const describedBy = (id: string | undefined, invalid?: boolean, hasHint = false) => !id ? undefined : invalid ? `${id}-error` : hasHint ? `${id}-hint` : undefined;

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {invalid?: boolean; leading?: ReactNode; trailing?: ReactNode; hasHint?: boolean}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({invalid, leading, trailing, className, id, hasHint, ...props}, ref) {
  return <div className="group relative flex items-center">
    {leading && <span className="pointer-events-none absolute start-3.5 flex text-ink-500 transition-colors group-focus-within:text-scrub-600">{leading}</span>}
    <SourceInput ref={ref} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy(id, invalid, hasHint)}
      className={cn(control, invalid ? bad : ok, leading ? 'ps-10' : '', trailing ? 'pe-12' : '', className)} {...props}/>
    {trailing && <span className="absolute end-1.5 flex items-center">{trailing}</span>}
  </div>;
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {invalid?: boolean; placeholder?: string; hasHint?: boolean}
/** Native select for accessibility and mobile pickers. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({invalid, placeholder, className, id, children, value, hasHint, ...props}, ref) {
  const {t} = useLocalization(), empty = value === '' || value === undefined;
  return <div className="relative">
    <SourceSelect ref={ref} id={id} value={value} aria-invalid={invalid || undefined} aria-describedby={describedBy(id, invalid, hasHint)}
      className={cn(control, invalid ? bad : ok, 'cursor-pointer appearance-none pe-10', empty && 'text-ink-500', className)} {...props}>
      {placeholder !== undefined && <option value="" disabled>{t(placeholder)}</option>}
      {children}
    </SourceSelect>
    <ChevronDown className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true"/>
  </div>;
});

interface AffixInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {invalid?: boolean; prefix?: ReactNode; suffix?: ReactNode; status?: ReactNode; hasHint?: boolean}
/** Input with fixed text before or after (dial code, domain). Affixes stay left-to-right because they are addresses and numbers. */
export const AffixInput = forwardRef<HTMLInputElement, AffixInputProps>(function AffixInput({invalid, prefix, suffix, status, className, id, hasHint, ...props}, ref) {
  return <div dir="ltr" className={cn('flex h-11 w-full items-center overflow-hidden rounded-xl border bg-surface transition-[border-color,box-shadow] duration-150 focus-within:ring-4',
    invalid ? 'border-signal/70 bg-[color-mix(in_srgb,var(--danger)_5%,var(--surface))] focus-within:border-signal focus-within:ring-signal/15' : 'border-ink-200 hover:border-ink-300 focus-within:border-scrub-500 focus-within:ring-scrub-100')}>
    {prefix && <span className="flex h-full shrink-0 items-center border-e border-ink-100 bg-ink-50/70 px-3 text-sm tabular-nums text-ink-500">{prefix}</span>}
    <SourceInput ref={ref} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy(id, invalid, hasHint)}
      className={cn('h-full min-w-0 flex-1 bg-transparent px-3.5 text-[length:calc(0.95rem*var(--fs-scale))] text-ink-900 placeholder:text-ink-400 focus:outline-none', className)} {...props}/>
    {suffix && <span className="shrink-0 pe-3 text-[length:calc(0.95rem*var(--fs-scale))] text-ink-500">{suffix}</span>}
    {status && <span className="flex shrink-0 items-center pe-3">{status}</span>}
  </div>;
});
