'use client';
import React, {useEffect, useRef, type ReactNode} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {failureFromError} from '@pepbits/components';
import {AlertCircle, CheckCircle2, Info} from '@pepbits/icons';
import {cn} from '@pepbits/ui';
import {AllyVoraFailure} from '../../adapters/allyvora';

/** Network failures (status 0) are classified as connectivity, everything else by HTTP status. */
export function failureOf(error: unknown) {
  return failureFromError(error instanceof AllyVoraFailure && error.status === 0 ? {name: 'NetworkError'} : error);
}
export const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);

export const SEX_SHORT: Record<string, string> = {male: 'M', female: 'F', other: 'O', unknown: 'U'};
export function initials(name: string): string {
  const parts = name.replace(/^(Mr|Mrs|Ms|Miss|Master|Baby|Dr|Prof|Rev|Sr)\s+/i, '').split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts.length > 1 ? parts[parts.length - 1]![0]!.toUpperCase() : '');
}

/** Timestamps use the effective date/time preferences; recent times use the interface language. */
export function useTimeFormat() {
  const format = useFormatters(), {language} = useLocalization();
  return {
    dateTime: (iso: string) => format.dateTime(new Date(iso)),
    date: (value: string) => format.date(value),
    clock: (iso: string) => format.time(new Date(iso)),
    relative: (iso: string, now: Date = new Date()) => {
      const diff = (new Date(iso).getTime() - now.getTime()) / 1000, abs = Math.abs(diff);
      let rtf: Intl.RelativeTimeFormat;
      try {rtf = new Intl.RelativeTimeFormat(language, {numeric: 'auto'});} catch {rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'});}
      if (abs < 45) return rtf.format(0, 'second');
      if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
      if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
      return format.date(new Date(iso));
    },
  };
}

type Combo = {code: string; mod?: boolean; alt?: boolean};
/**
 * A page shortcut bound only while the effective keyboard-shortcut preference is on.
 * Unmodified keys never fire while typing in a field; modified keys do (Ctrl/⌘+S saves from a field).
 */
export function useHotkey(combo: Combo, handler: (event: KeyboardEvent) => void, enabled = true) {
  const {preferences} = usePreferences();
  const ref = useRef(handler);
  ref.current = handler;
  const active = enabled && preferences.keyboardShortcuts !== false;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== combo.code || event.shiftKey) return;
      if (!!combo.mod !== (event.metaKey || event.ctrlKey) || !!combo.alt !== event.altKey) return;
      if (!combo.mod && !combo.alt) {
        const target = event.target as HTMLElement | null;
        if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      }
      ref.current(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, combo.code, combo.mod, combo.alt]);
}
export const KEYS = {save: {code: 'KeyS', mod: true}, next: {code: 'ArrowRight', alt: true}, previous: {code: 'ArrowLeft', alt: true}, search: {code: 'Slash'}, create: {code: 'KeyN'}} satisfies Record<string, Combo>;

/** Inline page notice (status or alert) using semantic tokens. */
export function Notice({tone, icon, children, actions, onDismiss, dismissLabel = 'Dismiss'}: {tone: 'info' | 'warn' | 'danger' | 'ok'; icon?: ReactNode; children: ReactNode; actions?: ReactNode; onDismiss?: () => void; dismissLabel?: string}) {
  const {t} = useLocalization();
  const Fallback = tone === 'ok' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return <div role={tone === 'danger' ? 'alert' : 'status'} data-notice={tone} className={cn('flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius)] border px-3.5 py-2.5 text-[length:calc(12px*var(--fs-scale))]',
    tone === 'info' && 'border-[color-mix(in_srgb,var(--primary)_30%,var(--border))] bg-[var(--primary-soft)]',
    tone === 'warn' && 'border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))]',
    tone === 'danger' && 'border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))]',
    tone === 'ok' && 'border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_10%,var(--surface))]')}>
    <span className={cn('shrink-0', tone === 'info' && 'text-[var(--primary)]', tone === 'warn' && 'text-[var(--warning-ink)]', tone === 'danger' && 'text-[var(--danger-ink)]', tone === 'ok' && 'text-[var(--success-ink)]')} aria-hidden="true">{icon ?? <Fallback className="size-[18px]"/>}</span>
    <div className="min-w-0 flex-1 text-[var(--text)]">{children}</div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    {onDismiss ? <button type="button" onClick={onDismiss} className="focus-ring rounded px-2 py-1 text-[length:calc(11px*var(--fs-scale))] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)]">{t(dismissLabel)}</button> : null}
  </div>;
}

/** Completion ring for record completeness; the percentage is also given as text. */
export function ProgressRing({value, size = 40, label}: {value: number; size?: number; label: string}) {
  const {t} = useLocalization();
  const stroke = 4, radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius, clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 80 ? 'var(--success)' : clamped >= 50 ? 'var(--warning)' : 'var(--danger)';
  return <span className="relative inline-flex shrink-0 items-center justify-center" style={{width: size, height: size}} role="img" aria-label={t('{label}: {value}%', {label: t(label), value: clamped})}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke}/>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)}/>
    </svg>
    <span className="absolute inset-0 flex items-center justify-center text-[length:calc(9.5px*var(--fs-scale))] font-bold tabular-nums text-[var(--text)]" aria-hidden="true">{clamped}%</span>
  </span>;
}

/** Compact completion bar for list rows. */
export function CompletionBar({value}: {value: number}) {
  const {t} = useLocalization();
  const tone = value >= 80 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)';
  return <span className="inline-flex items-center gap-2" title={t('Record {value}% complete', {value})}>
    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-3)]" aria-hidden="true"><span className="block h-full rounded-full" style={{width: `${value}%`, background: tone}}/></span>
    <span className="text-[length:calc(10.5px*var(--fs-scale))] tabular-nums text-[var(--text-muted)]">{value}%</span>
  </span>;
}
