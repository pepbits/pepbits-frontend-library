"use client";
import React, {useMemo, type ReactNode} from 'react';
import {cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
/** Deterministic bars from the host code, so each band carries a scannable-looking code (decorative). */
export function DecorativeRecordCode({value, className, height = 26}: {value: string; className?: string; height?: number}) {
  const {rects, width} = useMemo(() => {
    const text = value || 'pending-record';
    let hash = 2166136261, x = 0;
    const out: {x: number; w: number}[] = [];
    for (let i = 0; i < 38; i++) {
      hash ^= text.charCodeAt(i % text.length) + i * 7;
      hash = Math.imul(hash, 16777619);
      const n = hash >>> 0, w = 1 + (n % 3);
      if (i % 2 === 0) out.push({x, w});
      x += i % 2 === 0 ? w : 1 + ((n >> 3) % 2);
    }
    return {rects: out, width: x};
  }, [value]);
  return <svg viewBox={`0 0 ${width} ${height}`} width={width * 1.4} height={height} preserveAspectRatio="none" className={className} aria-hidden="true" data-barcode={value}>
    {rects.map(rect => <rect key={rect.x} x={rect.x} y={0} width={rect.w} height={height} fill="currentColor"/>)}
  </svg>;
}

/** Completion ring for record completeness; the percentage is also given as text. */
export function RecordCompletionRing({value, size = 40, label}: {value: number; size?: number; label: string}) {
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

export interface RecordSummaryBandProps {
 title: ReactNode; subtitle?: ReactNode; badge?: ReactNode; facts: string[]; emptyFacts?: ReactNode;
 label?: string; alert?: {label: ReactNode; tone: 'danger' | 'success' | 'warning'};
 code?: string; codeCaption?: ReactNode; codePending?: boolean;
 completion?: number; completionCaption?: string; completionLabel?: string;
 size?: 'compact' | 'full'; actions?: ReactNode; className?: string;
}
/** Host-owned identity and facts; the code is decorative, never a scanner contract. */
export function RecordSummaryBand({title, subtitle, badge, facts, emptyFacts, label='Record summary', alert, code, codeCaption, codePending, completion, completionCaption, completionLabel='Record complete', size='compact', actions, className}: RecordSummaryBandProps) {
 const {t}=useLocalization(); const full=size==='full', tone=alert?.tone;
  return <div role="group" aria-label={t(label)} data-record-summary={size}
    className={cn('relative flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]', full && 'shadow-[var(--shadow-sm)]', className)}>
    {/* Host-supplied alert tone continues along the edge of the summary. */}
    <span className={cn('w-1.5 shrink-0', tone === 'danger' && 'bg-[var(--danger)]', tone === 'success' && 'bg-[var(--success)]', tone === 'warning' && 'bg-[var(--warning)]')} aria-hidden="true"/>
    <div className="hidden shrink-0 flex-col items-center justify-center gap-2 border-e border-dashed border-[var(--border)] px-2.5 sm:flex" aria-hidden="true"><span className="size-2 rounded-full bg-[var(--border-strong)]"/><span className="size-2 rounded-full bg-[var(--border-strong)]"/></div>
    <div className={cn('min-w-0 flex-1', full ? 'px-5 py-4' : 'px-4 py-1.5')}>
      <div className="flex min-w-0 items-baseline gap-3">
        <p className={cn('truncate font-bold tracking-tight', full ? 'text-[length:calc(24px*var(--fs-scale))]' : 'text-[length:calc(15px*var(--fs-scale))] leading-tight', 'text-[var(--text)]')} data-band-name="">{title}</p>
        {subtitle ? <span className="truncate text-[var(--text-muted)]">{subtitle}</span> : null}
        {badge}

      </div>
      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-0.5 tabular-nums text-[var(--text-muted)]', full ? 'mt-0.5 text-[length:calc(12.5px*var(--fs-scale))]' : 'text-[length:calc(11.5px*var(--fs-scale))] leading-4')}>
        {facts.length ? facts.map(fact => <span key={fact}>{fact}</span>) : <span className="text-[var(--text-subtle)]">{emptyFacts}</span>}
      </div>
      <p className={cn('inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 text-[length:calc(10.5px*var(--fs-scale))] font-semibold', full ? 'mt-1.5 py-0.5' : 'mt-[3px] leading-4',
        tone === 'danger' && 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger-ink)]',
        tone === 'success' && 'bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success-ink)]',
        tone === 'warning' && 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-[var(--warning-ink)]')} data-summary-alert={tone}>{alert?.label}</p>
    </div>
    <div className="hidden shrink-0 flex-col items-center justify-center gap-1 border-s border-dashed border-[var(--border)] px-4 md:flex">
      <DecorativeRecordCode value={code ?? ""} className={cn('text-[var(--text)]', codePending && 'opacity-25')} height={full ? 34 : 24}/>
      <span className={cn('text-[length:calc(10.5px*var(--fs-scale))] tabular-nums', !codePending ? 'font-bold text-[var(--text)]' : 'text-[var(--text-muted)]')}>{codeCaption}</span>
    </div>
    {completion !== undefined ? <div className="flex shrink-0 items-center gap-2.5 border-s border-[var(--border)] px-3 sm:px-4">
      <RecordCompletionRing value={completion} size={full ? 48 : 40} label={completionLabel}/>
      {completionCaption ? <span className="hidden w-[76px] text-[length:calc(10.5px*var(--fs-scale))] leading-4 text-[var(--text-muted)] xl:block">{completionCaption}</span> : null}
    </div> : null}
    {actions ? <div className="flex shrink-0 items-center gap-2 border-s border-[var(--border)] px-3 sm:px-4">{actions}</div> : null}
  </div>;
}
