"use client";
// Port of lumen-reports src/components/reports/FilterBar.tsx.
import { Clock } from 'lucide-react';
import React from 'react';
import { DateInput, useLocalization } from '@pepbits/ops-ui';
import { PRESET_LABELS, PRESETS, rangeDays, resolveRange } from '../lib/dates';
import type { DatePreset, DateRangeValue, FilterDef, FilterValues, ReportPolicy } from '../types';
import { Button, MultiSelect, SelectInput, TextInput } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function DateRangeInput({ value, onChange, label = 'Period' }: { value: DateRangeValue; onChange: (v: DateRangeValue) => void; label?: string }) {
 const referenceT = useReferenceLocalization().t;

  return (
    <div className="lr-period">
      <SelectInput label={label} value={value.preset} onChange={(e) => {
        const preset = e.target.value as DatePreset;
        onChange(preset === 'custom' ? { preset, from: value.from, to: value.to } : { preset });
      }} options={PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] }))} />
      {value.preset === 'custom' && (
        <div className="lr-grid-2 lr-mt-sm">
          <DateInput aria-label={referenceT("From date")} value={value.from ?? ''} min="2016-01-01" onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <DateInput aria-label={referenceT("To date")} value={value.to ?? ''} min="2016-01-01" onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

/**
 * Shows how the selected period compares with the report's on-screen limit, before anything runs.
 * Over the limit, the report is produced in the background and delivered as a file.
 */
export function RangeMeter({ range, timezone, policy, detail, rowsPerDay, branchShare, onBackground }: {
  range: DateRangeValue;
  timezone: string;
  policy: ReportPolicy;
  detail: boolean;
  rowsPerDay: number;
  branchShare: number;
  onBackground?: () => void;
}) {
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const { from, to } = resolveRange(range, timezone);
  const days = rangeDays(from, to);
  const estRows = Math.round(days * rowsPerDay * branchShare);
  const overDays = days > policy.maxOnlineRangeDays;
  const overRows = detail && estRows > policy.maxOnlineRows;
  const over = overDays || overRows;
  const scale = Math.max(policy.maxOnlineRangeDays * 1.25, days);
  const pct = Math.min(100, (days / scale) * 100);
  const limitPct = (policy.maxOnlineRangeDays / scale) * 100;
  return (
    <div className={`lr-meter${over ? ' lr-meter-over' : ''}`}>
      <div className="lr-row lr-row-between lr-xs">
        <span className="lr-num">
          {t('{from} to {to}:', { from: fmt.value(from, 'date'), to: fmt.value(to, 'date') })} <strong>{t('{days} days', { days: fmt.count(days) })}</strong>
          {detail && <>{t(', about {rows} rows', { rows: fmt.count(estRows) })}</>}
        </span>
        <span className={`lr-num${over ? ' lr-warn-ink lr-medium' : ' lr-muted'}`}>
          {t('On-screen limit {days} days', { days: fmt.count(policy.maxOnlineRangeDays) })}{detail ? t(', {rows} rows', { rows: fmt.count(policy.maxOnlineRows) }) : ''}
        </span>
      </div>
      <div className="lr-meter-track" aria-hidden>
        <div className="lr-meter-fill" style={{ width: `${pct}%` }} />
        <div className="lr-meter-limit" style={{ insetInlineStart: `${limitPct}%` }} />
      </div>
      {over && (
        <div className="lr-row lr-row-between lr-mt-sm">
          <p className="lr-xs lr-warn-ink">
            {t(overDays ? 'This period is longer than the screen allows.' : 'This period returns more rows than the screen allows.')} {t('It will be prepared in the background and sent to you.')}
          </p>
          {onBackground && (
            <Button size="sm" variant="signal" icon={<Clock className="lr-icon-sm" />} onClick={onBackground}><ReferenceText message="Run in background" /></Button>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterFields({ defs, values, onChange, options, lockedBranches }: {
  defs: FilterDef[];
  values: FilterValues;
  onChange: (key: string, v: FilterValues[string]) => void;
  options: Record<string, string[]>;
  lockedBranches?: string[] | null;
}) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  return (
    <>
      {defs.filter((f) => f.type !== 'daterange').map((f) => {
        const v = values[f.key];
        if (f.type === 'multiselect') {
          return (
            <div key={f.key} className="lr-filter-field">
              <MultiSelect label={f.label} options={options[f.key] ?? []} value={Array.isArray(v) ? v : []} onChange={(x) => onChange(f.key, x)}
                placeholder={f.key === 'branch' && lockedBranches ? t('Your branches ({count})', { count: lockedBranches.length }) : 'All'} />
            </div>
          );
        }
        if (f.type === 'select') {
          return (
            <div key={f.key} className="lr-filter-field">
              <SelectInput label={f.label} value={typeof v === 'string' ? v : ''} onChange={(e) => onChange(f.key, e.target.value || undefined)}
                options={[...(!f.default ? [{ value: '', label: 'All' }] : []), ...(options[f.key] ?? []).map((o) => ({ value: o, label: o }))]} />
            </div>
          );
        }
        return (
          <div key={f.key} className="lr-filter-field lr-filter-field-text">
            <TextInput label={f.label} placeholder={referenceT("Contains…")} value={typeof v === 'string' ? v : ''} onChange={(e) => onChange(f.key, e.target.value || undefined)} />
          </div>
        );
      })}
    </>
  );
}
