'use client';
import { useId } from 'react';
import type { Field, Row } from '../../lib/types';
import { cx, useFormat } from '../../lib/format';
import { useRefOptions } from '../../lib/client';
import { Input, Label, Select, StatusBadge, Switch, Textarea, DateInput, TimeInput } from '../ui';
import { LocalizedText as ReferenceText, useLocalization } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export function FieldInput({ field, value, onChange, readOnly, invalid, compact, id }: { field: Field; value: unknown; onChange: (v: unknown) => void; readOnly?: boolean; invalid?: boolean; compact?: boolean; id?: string }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtValue } = useFormat();
  const { t } = useLocalization();
  const refOpts = useRefOptions(field.type === 'ref' ? field.ref : undefined);
  const listId = useId();
  const h = compact ? 'h-7 text-[length:calc(12.5px*var(--fs-scale))]' : '';
  const ro = readOnly || field.readOnly;
  const str = value === undefined || value === null ? '' : String(value);

  switch (field.type) {
    case 'status':
    case 'select':
      if (ro) return <Input id={id} value={str} readOnly className={h} />;
      return (
        <Select id={id} value={str} onChange={(e) => onChange(e.target.value)} className={h}>
          <option value=""><ReferenceText message="Select…" /></option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          {str && !(field.options ?? []).includes(str) && <option value={str}>{str}</option>}
        </Select>
      );
    case 'ref':
      return (
        <>
          <Input id={id} list={listId} value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value)} placeholder={ro ? '' : t('Search {field}', { field: t(field.label) })} className={h} />
          {!ro && <datalist id={listId}>{refOpts.map((o) => <option key={o} value={o} />)}</datalist>}
        </>
      );
    case 'boolean':
      return (
        <div className={cx('flex items-center', compact ? 'h-7' : 'h-8')}>
          <Switch checked={Boolean(value)} onChange={(v) => onChange(v)} disabled={ro} label={field.label} />
          <span className="ml-2 text-[length:calc(12.5px*var(--fs-scale))] text-ink-2">{t(value ? 'Yes' : 'No')}</span>
        </div>
      );
    case 'textarea':
      return <Textarea id={id} value={str} readOnly={ro} onChange={(e) => onChange(e.target.value)} rows={compact ? 2 : 3} />;
    case 'date':
      return <DateInput id={id} value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value)} className={h} />;
    case 'time':
      return <TimeInput id={id} step={1800} value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value)} className={h} />;
    case 'number':
    case 'currency':
    case 'percent':
      if (ro && field.type === 'currency') return <Input id={id} value={fmtValue(field, value)} readOnly className={cx(h, 'text-right tnum')} />;
      return <Input id={id} type="number" step={field.type === 'currency' ? '0.01' : 'any'} value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={cx(h, 'text-right tnum')} />;
    case 'email':
      return <Input id={id} type="email" value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value)} className={h} />;
    case 'phone':
      return <Input id={id} type="tel" value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value)} className={h} />;
    default:
      return <Input id={id} value={str} readOnly={ro} invalid={invalid} onChange={(e) => onChange(e.target.value)} className={h} />;
  }
}

export function missingRequired(fields: Field[], value: Partial<Row>) {
  return fields.filter((f) => f.required && (value[f.key] === undefined || value[f.key] === null || value[f.key] === ''));
}

/** Renders fields in a responsive grid. Pass `readOnly` for a view mode that still reads cleanly. */
export function RecordForm({ fields, value, onChange, readOnly, columns = 3, showErrors, compact }: { fields: Field[]; value: Partial<Row>; onChange: (key: string, v: unknown) => void; readOnly?: boolean; columns?: 2 | 3 | 4; showErrors?: boolean; compact?: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtValue } = useFormat();
  const base = useId();
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 xl:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' }[columns];
  return (
    <div data-reference-form={!readOnly || undefined} data-reference-result={readOnly || undefined} className={cx('grid grid-cols-1 gap-x-4', compact ? 'gap-y-2.5' : 'gap-y-3.5', cols)}>
      {fields.map((f) => {
        const id = `${base}-${f.key}`;
        const invalid = showErrors && f.required && (value[f.key] === undefined || value[f.key] === '');
        const wide = f.type === 'textarea' || f.span === 2;
        if (readOnly) {
          return (
            <div key={f.key} className={cx(wide && 'sm:col-span-full')}>
              <div className="mb-0.5 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message={f.label} /></div>
              <div className={cx('min-h-[22px] text-[length:calc(13.5px*var(--fs-scale))] text-ink', (f.type === 'currency' || f.type === 'number') && 'tnum')}>
                {f.type === 'status' ? <StatusBadge value={value[f.key]} /> : fmtValue(f, value[f.key])}
              </div>
            </div>
          );
        }
        return (
          <div key={f.key} className={cx(wide && 'sm:col-span-full')}>
            <Label htmlFor={id} required={f.required}><ReferenceText message={f.label} /></Label>
            <FieldInput id={id} field={f} value={value[f.key]} onChange={(v) => onChange(f.key, v)} invalid={invalid} compact={compact} />
            {invalid && <p className="mt-0.5 text-[length:calc(11.5px*var(--fs-scale))] text-danger"><ReferenceText message={f.label} /> <ReferenceText message="is required" /></p>}
          </div>
        );
      })}
    </div>
  );
}
