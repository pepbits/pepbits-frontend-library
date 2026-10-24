'use client';
import React, {useMemo, type ReactNode} from 'react';
import {computeAge, deriveDisplayName, lookupLabel, type FormValues, type Lookups, type PatientStatus} from '@allyvora/shared';
import {useLocalization} from '@pepbits/i18n/react';
import {cn} from '@pepbits/ui';
import {ProgressRing, useTimeFormat} from '../support';

/** Deterministic bars from the MRN, so each band carries a scannable-looking code (decorative). */
export function Barcode({value, className, height = 26}: {value: string; className?: string; height?: number}) {
  const {rects, width} = useMemo(() => {
    const text = value || 'pending-mrn';
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

const SEX_LABEL: Record<string, string> = {male: 'Male', female: 'Female', other: 'Other', unknown: 'Sex unknown'};

/** Wristband-style patient summary: allergy stripe, identity facts, MRN code and completeness. */
export function PatientBand({values, lookups, mrn, mrnPending, completion, sectionsLabel, size = 'compact', status, actions, className}: {
  values: FormValues; lookups: Lookups; mrn?: string | null; mrnPending?: string | null; completion?: number; sectionsLabel?: string;
  size?: 'compact' | 'full'; status?: PatientStatus; actions?: ReactNode; className?: string;
}) {
  const {t} = useLocalization(), time = useTimeFormat();
  const full = size === 'full';
  const name = (values.displayName as string) || deriveDisplayName(values, lookups);
  const age = computeAge(values);
  const sex = values.administrativeSex as string | undefined;
  const allergy = values.allergyStatus as string | undefined;
  const allergens = Array.isArray(values.allergens) ? values.allergens : [];
  const allergyText = allergy === 'known'
    ? allergens.length ? t('Allergic to {list}', {list: allergens.map(code => lookupLabel(lookups, 'allergen', code)).join(', ')}) : t('Has allergies')
    : allergy === 'nka' ? t('No known allergies') : t('Allergies not recorded');
  const tone = allergy === 'known' ? 'danger' : allergy === 'nka' ? 'ok' : 'accent';
  const dob = values.dobPrecision === 'exact' && values.dateOfBirth ? time.date(String(values.dateOfBirth))
    : values.birthYear ? t('Born {when}', {when: `${values.birthMonth ? lookupLabel(lookups, 'month', values.birthMonth).slice(0, 3) + ' ' : ''}${values.birthYear}`}) : null;
  const facts = [
    [age.label, sex ? t(SEX_LABEL[sex] ?? sex) : null].filter(Boolean).join(', ') || null,
    dob,
    values.bloodGroup ? t('Blood {group}', {group: lookupLabel(lookups, 'bloodGroup', values.bloodGroup)}) : null,
    values.mobile ? `+91 ${values.mobile}` : null,
    full && values.payerType ? lookupLabel(lookups, 'payerType', values.payerType) : null,
  ].filter(Boolean) as string[];
  const code = mrn ?? mrnPending ?? '';
  return <div role="group" aria-label={t('Patient summary')} data-patient-band={size}
    className={cn('relative flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]', full && 'shadow-[var(--shadow-sm)]', className)}>
    {/* Allergy stripe: the first thing a clinician checks on a wristband. */}
    <span className={cn('w-1.5 shrink-0', tone === 'danger' && 'bg-[var(--danger)]', tone === 'ok' && 'bg-[var(--success)]', tone === 'accent' && 'bg-[var(--warning)]')} aria-hidden="true"/>
    <div className="hidden shrink-0 flex-col items-center justify-center gap-2 border-e border-dashed border-[var(--border)] px-2.5 sm:flex" aria-hidden="true"><span className="size-2 rounded-full bg-[var(--border-strong)]"/><span className="size-2 rounded-full bg-[var(--border-strong)]"/></div>
    <div className={cn('min-w-0 flex-1', full ? 'px-5 py-4' : 'px-4 py-2.5')}>
      <div className="flex min-w-0 items-baseline gap-3">
        <p className={cn('truncate font-bold tracking-tight', full ? 'text-[length:calc(24px*var(--fs-scale))]' : 'text-[length:calc(17px*var(--fs-scale))]', name ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]')} data-band-name="">{name || t('New patient')}</p>
        {values.localName ? <span className="hidden truncate text-[length:calc(12px*var(--fs-scale))] text-[var(--text-muted)] md:inline">{String(values.localName)}</span> : null}
        {status === 'inactive' ? <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text-muted)]">{t('Inactive')}</span> : null}
      </div>
      <div className={cn('mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 tabular-nums text-[var(--text-muted)]', full ? 'text-[length:calc(12.5px*var(--fs-scale))]' : 'text-[length:calc(11.5px*var(--fs-scale))]')}>
        {facts.length ? facts.map(fact => <span key={fact}>{fact}</span>) : <span className="text-[var(--text-subtle)]">{t('Details appear here as you type')}</span>}
      </div>
      <p className={cn('mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-[length:calc(10.5px*var(--fs-scale))] font-semibold',
        tone === 'danger' && 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger-ink)]',
        tone === 'ok' && 'bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success-ink)]',
        tone === 'accent' && 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-[var(--warning-ink)]')} data-allergy={tone}>{allergyText}</p>
    </div>
    <div className="hidden shrink-0 flex-col items-center justify-center gap-1 border-s border-dashed border-[var(--border)] px-4 md:flex">
      <Barcode value={code} className={cn('text-[var(--text)]', !mrn && 'opacity-25')} height={full ? 34 : 24}/>
      <span className={cn('text-[length:calc(10.5px*var(--fs-scale))] tabular-nums', mrn ? 'font-bold text-[var(--text)]' : 'text-[var(--text-muted)]')}>{mrn ?? (mrnPending ? t('{mrn} on save', {mrn: mrnPending}) : t('MRN on save'))}</span>
    </div>
    {completion !== undefined ? <div className="flex shrink-0 items-center gap-2.5 border-s border-[var(--border)] px-3 sm:px-4">
      <ProgressRing value={completion} size={full ? 48 : 40} label="Record complete"/>
      {sectionsLabel ? <span className="hidden w-[76px] text-[length:calc(10.5px*var(--fs-scale))] leading-4 text-[var(--text-muted)] xl:block">{sectionsLabel}</span> : null}
    </div> : null}
    {actions ? <div className="flex shrink-0 items-center gap-2 border-s border-[var(--border)] px-3 sm:px-4">{actions}</div> : null}
  </div>;
}
