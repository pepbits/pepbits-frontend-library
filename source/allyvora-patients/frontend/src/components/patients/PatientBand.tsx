import { useMemo, type ReactNode } from 'react';
import { computeAge, deriveDisplayName, formatDate, lookupLabel, type FormValues, type Lookups, type PatientStatus } from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { ProgressRing } from '@/components/ui/Misc';

/** Deterministic bars from the MRN, so each band carries a scannable-looking code. */
export function Barcode({ value, className, height = 26 }: { value: string; className?: string; height?: number }) {
  const { rects, width } = useMemo(() => {
    const s = value || 'pending-mrn';
    let h = 2166136261;
    const out: { x: number; w: number }[] = [];
    let x = 0;
    for (let i = 0; i < 38; i++) {
      h ^= s.charCodeAt(i % s.length) + i * 7;
      h = Math.imul(h, 16777619);
      const n = h >>> 0;
      const w = 1 + (n % 3);
      if (i % 2 === 0) out.push({ x, w });
      x += i % 2 === 0 ? w : 1 + ((n >> 3) % 2);
    }
    return { rects: out, width: x };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width * 1.4} height={height} preserveAspectRatio="none" className={className} aria-hidden>
      {rects.map((r) => (
        <rect key={r.x} x={r.x} y={0} width={r.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}

const SEX_LABEL: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other', unknown: 'Sex unknown' };

export function PatientBand({
  values,
  lookups,
  mrn,
  mrnPending,
  completion,
  sectionsLabel,
  size = 'compact',
  status,
  actions,
  className,
}: {
  values: FormValues;
  lookups: Lookups;
  mrn?: string | null;
  mrnPending?: string | null;
  completion?: number;
  sectionsLabel?: string;
  size?: 'compact' | 'full';
  status?: PatientStatus;
  actions?: ReactNode;
  className?: string;
}) {
  const full = size === 'full';
  const name = (values.displayName as string) || deriveDisplayName(values, lookups);
  const age = computeAge(values);
  const sex = values.administrativeSex as string | undefined;
  const allergy = values.allergyStatus as string | undefined;
  const allergens = Array.isArray(values.allergens) ? values.allergens : [];
  const allergyText =
    allergy === 'known'
      ? allergens.length
        ? `Allergic to ${allergens.map((a) => lookupLabel(lookups, 'allergen', a)).join(', ')}`
        : 'Has allergies'
      : allergy === 'nka'
        ? 'No known allergies'
        : 'Allergies not recorded';
  const tone = allergy === 'known' ? 'danger' : allergy === 'nka' ? 'ok' : 'accent';

  const dob =
    values.dobPrecision === 'exact' && values.dateOfBirth
      ? formatDate(String(values.dateOfBirth))
      : values.birthYear
        ? `Born ${values.birthMonth ? lookupLabel(lookups, 'month', values.birthMonth).slice(0, 3) + ' ' : ''}${values.birthYear}`
        : null;

  const facts = [
    [age.label, sex ? SEX_LABEL[sex] : null].filter(Boolean).join(', ') || null,
    dob,
    values.bloodGroup ? `Blood ${lookupLabel(lookups, 'bloodGroup', values.bloodGroup)}` : null,
    values.mobile ? `+91 ${values.mobile}` : null,
    full && values.payerType ? lookupLabel(lookups, 'payerType', values.payerType) : null,
  ].filter(Boolean) as string[];

  const code = mrn ?? mrnPending ?? '';

  return (
    <div
      className={cn('relative flex items-stretch overflow-hidden rounded-2xl border border-line bg-surface', full ? 'shadow-lift' : '', className)}
      role="group"
      aria-label="Patient summary"
    >
      {/* Allergy stripe: the first thing a clinician checks on a wristband. */}
      <span className={cn('w-1.5 shrink-0', tone === 'danger' && 'bg-danger', tone === 'ok' && 'bg-ok', tone === 'accent' && 'bg-accent')} aria-hidden />
      <div className="hidden shrink-0 flex-col items-center justify-center gap-2 border-r border-dashed border-line px-2.5 sm:flex" aria-hidden>
        <span className="size-2 rounded-full bg-line-strong" />
        <span className="size-2 rounded-full bg-line-strong" />
      </div>

      <div className={cn('min-w-0 flex-1', full ? 'px-5 py-4' : 'px-4 py-2.5')}>
        <div className="flex min-w-0 items-baseline gap-3">
          <p className={cn('truncate font-cond font-semibold tracking-tight text-ink', full ? 'text-[28px] leading-9' : 'text-xl leading-7', !name && 'text-ink-3')}>
            {name || 'New patient'}
          </p>
          {values.localName && <span className={cn('hidden truncate text-ink-2 md:inline', full ? 'text-base' : 'text-[13px]')}>{String(values.localName)}</span>}
          {status === 'inactive' && <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-2xs font-medium text-ink-2">Inactive</span>}
        </div>
        <div className={cn('tabular mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-ink-2', full ? 'text-sm' : 'text-[13px]')}>
          {facts.length ? facts.map((f) => <span key={f}>{f}</span>) : <span className="text-ink-3">Details appear here as you type</span>}
        </div>
        <p
          className={cn(
            'mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-xs font-medium',
            tone === 'danger' && 'bg-danger-soft text-danger',
            tone === 'ok' && 'bg-ok-soft text-ok',
            tone === 'accent' && 'bg-accent-soft text-accent-ink',
          )}
        >
          {allergyText}
        </p>
      </div>

      <div className="hidden shrink-0 flex-col items-center justify-center gap-1 border-l border-dashed border-line px-4 md:flex">
        <Barcode value={code} className={cn('text-ink', !mrn && 'opacity-25')} height={full ? 34 : 24} />
        <span className={cn('tabular text-xs', mrn ? 'font-semibold text-ink' : 'text-ink-3')}>
          {mrn ?? (mrnPending ? `${mrnPending} on save` : 'MRN on save')}
        </span>
      </div>

      {completion !== undefined && (
        <div className="flex shrink-0 items-center gap-2.5 border-l border-line px-3 sm:px-4">
          <div className="relative">
            <ProgressRing value={completion} size={full ? 48 : 40} />
            <span className="tabular absolute inset-0 flex items-center justify-center text-2xs font-semibold text-ink">{completion}%</span>
          </div>
          {sectionsLabel && <span className="hidden w-[68px] text-xs leading-4 text-ink-2 xl:block">{sectionsLabel}</span>}
        </div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-2 border-l border-line px-3 sm:px-4">{actions}</div>}
    </div>
  );
}
