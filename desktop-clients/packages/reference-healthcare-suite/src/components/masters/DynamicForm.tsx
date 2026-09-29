'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { Check, Minus } from 'lucide-react';
import { useFormat } from '../../lib/format';
import { useLookup } from '../../lib/lookups';
import { FieldDef, SectionDef } from '../../lib/masters';
import { Row } from '../../lib/types';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/controls';
import { StatusBadge } from '../ui/display';
import { DaysPicker } from './DaysPicker';
import { RefSelect } from './RefSelect';

function RefLabel({ f, value }: { f: FieldDef; value: string }) {
  const { options } = useLookup(f.ref!.entity, { includeInactive: 'true' });
  const o = options.find((x) => (f.ref!.valueField === 'code' ? x.code : x.value) === value);
  return <>{o ? o.label : value}</>;
}

function ReadValue({ f, row }: { f: FieldDef; row: Row }) {
  const { fmtDate, fmtTime, money,number } = useFormat();
  const v = row[f.key];
  if (f.type === 'checkbox') return v ? <span className="inline-flex items-center gap-1 text-hc-ok-700"><Check className="h-3.5 w-3.5" /><LocalizedText message="Yes" /></span> : <span className="inline-flex items-center gap-1 text-hc-ink-mute"><Minus className="h-3.5 w-3.5" /><LocalizedText message="No" /></span>;
  if (v === '' || v === null || v === undefined) return <span className="text-hc-ink-faint"><LocalizedText message="Not set" /></span>;
  if (f.key === 'status') return <StatusBadge status={v} />;
  if (f.type === 'ref') return f.ref?.display && row[f.ref.display] ? <>{row[f.ref.display]}</> : <RefLabel f={f} value={v} />;
  if (f.type === 'date') return <>{fmtDate(v)}</>;
  if (f.type === 'time') return <>{fmtTime(v)}</>;
  if (f.type === 'number') return <>{number(Number(v))}</>;
  if (f.type === 'money') return <span className="hc-num">{money(v)}</span>;
  if (f.type === 'percent') return <span className="hc-num">{v}%</span>;
  if (f.type === 'days') return <>{String(v).split('|').join(', ')}</>;
  return <span className={clsx(f.key === 'code' && 'font-mono text-[12.5px]')}>{String(v)}</span>;
}

export function DynamicForm({ sections, value, onChange, errors = {}, readOnly, idPrefix = 'f' }: {
  sections: SectionDef[]; value: Row; onChange: (next: Row) => void; errors?: Record<string, string>; readOnly?: boolean; idPrefix?: string;
}) {
  const { money } = useFormat();
  const multi = sections.length > 1;
  const cols = multi ? 2 : 4;

  const set = (f: FieldDef, v: unknown, meta?: Row) => {
    const next: Row = { ...value, [f.key]: v };
    // Clear dependents whose filter uses this field (department -> specialty etc.)
    for (const s of sections) for (const d of s.fields) {
      if (d.ref?.filterBy && Object.values(d.ref.filterBy).includes(f.key) && d.key !== f.key) next[d.key] = '';
    }
    if (f.onPick) Object.assign(next, f.onPick(meta));
    onChange(next);
  };

  return (
    <div className={clsx('grid gap-3', multi && 'xl:grid-cols-2')}>
      {sections.map((s) => (
        <section key={s.title} className="rounded-md border border-hc-line bg-hc-surface">
          <h3 className="border-b border-hc-line px-3 py-2 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message={s.title}/></h3>
          <div className={clsx('grid gap-x-3 gap-y-3 p-3', cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}>
            {s.fields.filter((f) => !f.visibleIf || f.visibleIf(value)).map((f) => {
              const span = Math.min(f.span ?? 1, cols);
              const id = `${idPrefix}-${f.key}`;
              const err = errors[f.key];
              const spanCls = span === 4 ? 'col-span-2 lg:col-span-4' : span === 3 ? 'col-span-2 lg:col-span-3' : span === 2 ? 'col-span-2' : '';
              if (readOnly) {
                return (
                  <div key={f.key} className={spanCls}>
                    <p className="text-hc-2xs text-hc-ink-mute">{f.label}</p>
                    <div className="mt-0.5 min-h-[20px] truncate text-hc-sm text-hc-ink"><ReadValue f={f} row={value} /></div>
                  </div>
                );
              }
              const v = value[f.key] ?? '';
              let control: React.ReactNode;
              switch (f.type) {
                case 'select': control = <Select id={id} options={f.options ?? []} value={String(v)} invalid={!!err} onChange={(x) => set(f, x)} />; break;
                case 'ref': {
                  const filter = f.ref!.filterBy;
                  const missing = filter && Object.values(filter).some((src) => !value[src]);
                  const params = missing ? null : { ...(f.ref!.staticFilter ?? {}), ...Object.fromEntries(Object.entries(filter ?? {}).map(([p, src]) => [p, String(value[src] ?? '')])) };
                  const parentLabel = filter ? sections.flatMap((x) => x.fields).find((x) => x.key === Object.values(filter)[0])?.label.toLowerCase() : undefined;
                  control = <RefSelect id={id} entity={f.ref!.entity} params={params} valueField={f.ref!.valueField} value={String(v)} invalid={!!err} waitingFor={parentLabel} onChange={(x, o) => set(f, x, o?.meta)} />;
                  break;
                }
                case 'checkbox': control = <div className="flex h-8 items-center"><Checkbox checked={!!v} onChange={(x) => set(f, x)} label={v ? 'Yes' : 'No'} /></div>; break;
                case 'textarea': control = <Textarea id={id} value={String(v)} invalid={!!err} onChange={(e) => set(f, e.target.value)} />; break;
                case 'days': control = <DaysPicker value={String(v)} invalid={!!err} onChange={(x) => set(f, x)} />; break;
                default: {
                  const numeric = ['number', 'money', 'percent'].includes(f.type);
                  control = (
                    <div className="relative">
                      <Input
                        id={id}
                        type={numeric ? 'number' : f.type === 'tel' ? 'tel' : f.type}
                        step={f.type === 'money' ? '0.01' : undefined}
                        min={numeric ? 0 : undefined}
                        max={f.type === 'percent' ? 100 : undefined}
                        value={String(v)}
                        placeholder={f.placeholder}
                        invalid={!!err}
                        className={clsx(numeric && 'hc-num text-right', f.type === 'percent' && 'pr-7', f.key === 'code' && 'font-mono uppercase')}
                        onChange={(e) => set(f, f.key === 'code' ? e.target.value.toUpperCase() : e.target.value)}
                      />
                      {f.type === 'percent' && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hc-xs text-hc-ink-mute">%</span>}
                    </div>
                  );
                }
              }
              return <Field key={f.key} htmlFor={id} label={f.label} required={f.required} error={err} hint={f.hint} className={spanCls}>{control}</Field>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
