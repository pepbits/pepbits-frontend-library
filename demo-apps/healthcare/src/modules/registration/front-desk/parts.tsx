'use client';
import React, {useCallback, useEffect, useState, type ReactNode} from 'react';
import {cn} from '@pepbits/ui';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {usePreferences} from '@pepbits/preferences/react';
import type {Density} from '@pepbits/preferences';
import {useLocalization} from '@pepbits/i18n/react';
import {Notice} from '../support';

/* Small front desk helpers on the shared @pepbits primitives and semantic tokens. Links go through
   ./link (demo route mapping), so they take the Button token classes instead of the Button element. */

export const LINK_BUTTON = {
  primary: 'focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-[var(--primary-fill)] px-3.5 text-[length:calc(13px*var(--fs-scale))] font-semibold text-white shadow-sm hover:bg-[var(--primary-strong)]',
  danger: 'focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent bg-[var(--danger-fill)] px-3.5 text-[length:calc(13px*var(--fs-scale))] font-semibold text-white hover:brightness-95',
  secondary: 'focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3.5 text-[length:calc(13px*var(--fs-scale))] font-semibold text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]',
  ghost: 'focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-transparent px-3 text-[length:calc(12px*var(--fs-scale))] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]',
  inline: 'font-semibold text-[var(--primary)] underline underline-offset-2',
} as const;

export const TEXT = {
  eyebrow: 'text-[length:calc(10.5px*var(--fs-scale))] font-bold uppercase tracking-[0.08em]',
  title: 'text-[length:calc(22px*var(--fs-scale))] font-bold tracking-tight text-[var(--text)]',
  heading: 'text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]',
  body: 'text-[length:calc(12px*var(--fs-scale))] text-[var(--text)]',
  muted: 'text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]',
  small: 'text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]',
} as const;

/** Field grid gaps follow the effective density, as in the patient form sections. */
export const fieldGap = (density: Density) => density === 'compact' ? 'gap-x-4 gap-y-3' : density === 'spacious' ? 'gap-x-6 gap-y-6' : 'gap-x-5 gap-y-4';

/** Keyboard key hint, shown only while keyboard shortcuts are enabled. */
export function Kbd({children}: {children: ReactNode}) {
  return <kbd className="rounded-[calc(var(--radius)*0.6)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-1.5 py-px font-sans text-[length:calc(10px*var(--fs-scale))] text-[var(--text-muted)]">{children}</kbd>;
}

export function useShortcuts() {
  const {preferences} = usePreferences();
  return preferences.keyboardShortcuts !== false;
}

/** Posts to the host notifications. */
export function useToast() {
  const {notify} = useScreenHost();
  return useCallback((text: string, tone: 'success' | 'info' | 'warning' | 'error' = 'info') => notify(text, {tone}), [notify]);
}

export function useDebounced<T>(value: T, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {const timer = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(timer);}, [value, ms]);
  return debounced;
}

/** Problems and server errors as one danger notice with a list. */
export function ProblemList({items, className}: {items: string[]; className?: string}) {
  if (!items.length) return null;
  return <div className={className}><Notice tone="danger"><ul className="list-disc space-y-0.5 ps-5">{items.map(item => <li key={item}>{item}</li>)}</ul></Notice></div>;
}

/** Bordered panel on the surface tokens (Card with an optional header). */
export function Panel({title, subtitle, icon, actions, tone, className, bodyClassName, children, ...rest}: {title?: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; tone?: 'danger' | 'warning' | 'success'; className?: string; bodyClassName?: string; children: ReactNode} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return <section {...rest} className={cn('overflow-hidden rounded-[var(--radius)] border bg-[var(--surface)] shadow-[var(--shadow-sm)]',
    tone === 'danger' ? 'border-[color-mix(in_srgb,var(--danger)_35%,var(--border))]' : tone === 'warning' ? 'border-[color-mix(in_srgb,var(--warning)_40%,var(--border))]' : tone === 'success' ? 'border-[color-mix(in_srgb,var(--success)_35%,var(--border))]' : 'border-[var(--border)]', className)}>
    {title ? <header className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3',
      tone === 'danger' && 'bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))]', tone === 'warning' && 'bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))]')}>
      <div className="flex min-w-0 items-start gap-3">
        {icon}
        <div className="min-w-0"><h2 className={TEXT.heading}>{title}</h2>{subtitle ? <p className={cn('mt-0.5', TEXT.muted)}>{subtitle}</p> : null}</div>
      </div>
      {actions}
    </header> : null}
    <div className={bodyClassName}>{children}</div>
  </section>;
}

/** A labelled group around a non-input control (segmented choice, radio cards); the control carries the accessible name. */
export function Choice({label, required, className, children}: {label: string; required?: boolean; className?: string; children: ReactNode}) {
  const {t} = useLocalization();
  return <div className={cn('min-w-0', className)}>
    <span className="mb-1.5 flex items-center gap-1 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]" aria-hidden="true">{t(label)}{required ? <span className="text-[var(--danger-ink)]">*</span> : null}</span>
    {children}
  </div>;
}
