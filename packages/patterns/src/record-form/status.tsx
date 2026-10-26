"use client";
import React from 'react';
import {cn} from '@pepbits/ui';
import {Check} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
export interface RecordSectionProgress {
 state: 'untouched' | 'empty' | 'in-progress' | 'complete' | 'error';
 /** False when a legacy host supplies completion only, without field counts. */
 countsKnown?: boolean;
 requiredDone: number; requiredTotal: number; errorCount: number; optional: boolean;
}
export function statusText(progress: RecordSectionProgress): {text: string; values?: Record<string, number>; tone: 'ok' | 'danger' | 'accent' | 'muted'} {
  if (progress.state === 'error') return {text: '{count} to fix', values: {count: progress.errorCount}, tone: 'danger'};
  if (progress.state === 'complete') return {text: 'Complete', tone: 'ok'};
  if (progress.countsKnown === false) return {text: 'Not started', tone: 'muted'};
  if (progress.optional) return {text: 'Optional', tone: 'muted'};
  return {text: '{done} of {total} required', values: {done: progress.requiredDone, total: progress.requiredTotal}, tone: progress.requiredDone ? 'accent' : 'muted'};
}

export function StatusGlyph({index, progress, active, size = 'md'}: {index: number; progress: RecordSectionProgress; active?: boolean; size?: 'sm' | 'md'}) {
  const {t} = useLocalization();
  const state = progress.state, dimension = size === 'sm' ? 'size-6 text-[length:calc(10px*var(--fs-scale))]' : 'size-7 text-[length:calc(11px*var(--fs-scale))]';
  const base = cn(dimension, 'flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums');
  if (state === 'complete') return <span className={cn(base, 'bg-[var(--success-fill)] text-white', active && 'ring-2 ring-[var(--success)] ring-offset-2 ring-offset-[var(--surface)]')}><Check className="size-3.5" strokeWidth={3} aria-hidden="true"/><span className="sr-only">{t('Complete')}</span></span>;
  if (state === 'error') return <span className={cn(base, 'bg-[var(--danger-fill)] text-white', active && 'ring-2 ring-[var(--danger)] ring-offset-2 ring-offset-[var(--surface)]')}>!<span className="sr-only">{t('Has problems')}</span></span>;
  if (active) return <span className={cn(base, 'bg-[var(--primary-fill)] text-white')}>{index}</span>;
  if (state === 'in-progress') {
    const portion = progress.requiredTotal ? progress.requiredDone / progress.requiredTotal : 0.5;
    return <span className={cn(base, 'relative text-[var(--warning-ink)]')} style={{background: `conic-gradient(var(--warning) ${portion * 360}deg, var(--border) 0)`}}>
      <span className="absolute inset-[2.5px] rounded-full bg-[var(--surface)]" aria-hidden="true"/><span className="relative">{index}</span>
    </span>;
  }
  return <span className={cn(base, 'border border-[var(--border-strong)] text-[var(--text-muted)]')}>{index}</span>;
}

export function StatusPill({progress}: {progress: RecordSectionProgress}) {
  const {t} = useLocalization();
  const {text, values, tone} = statusText(progress);
  return <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[length:calc(10.5px*var(--fs-scale))] font-semibold tabular-nums',
    tone === 'ok' && 'bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success-ink)]',
    tone === 'danger' && 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger-ink)]',
    tone === 'accent' && 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-[var(--warning-ink)]',
    tone === 'muted' && 'bg-[var(--surface-2)] text-[var(--text-muted)]')}>{t(text, values)}</span>;
}
