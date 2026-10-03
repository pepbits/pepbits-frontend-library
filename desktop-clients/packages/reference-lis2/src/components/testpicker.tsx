'use client';
import {DiagnosticButton,DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';


import { useOptions } from './refselect';
import { Badge, Select, cx } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface PickedTest { test: any; bodySiteId?: string }

/** Searchable catalogue on the left, the order basket on the right. */
export function TestPicker({ value, onChange }: { value: PickedTest[]; onChange: (v: PickedTest[]) => void }) {
 const referenceT = useReferenceLocalization().t;

 const {get}=useDiagnosticClient();
 const {money}=useDiagnosticFormat();

  const [tests, setTests] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [cursor, setCursor] = useState(0);
  const {options:bodySites,error:lookupError} = useOptions('body_sites');
  useEffect(() => { get('/masters/tests', { active: 1, pageSize: 500 }).then((r) => setTests(r.data)).catch(() => {}); }, []);
  const depts = useMemo(() => [...new Map(tests.map((t) => [t.department_id, t.department_id__label])).entries()], [tests]);
  const chosen = new Set(value.map((v) => v.test.id));
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tests.filter((t) => (!dept || String(t.department_id) === dept) && (!s || `${t.code} ${t.name} ${t.short_name || ''}`.toLowerCase().includes(s)));
  }, [tests, q, dept]);
  useEffect(() => setCursor(0), [q, dept]);
  const add = (t: any) => { if (!chosen.has(t.id)) onChange([...value, { test: t }]); };
  const total = value.reduce((s, v) => s + (Number(v.test.price) || 0), 0);
  return (
    <div className="grid gap-3 lg:grid-cols-2">{lookupError && <p role="alert">{lookupError}</p>}
      <div className="panel flex h-[420px] flex-col">
        <div className="flex gap-2 border-b border-line p-2">
          <DiagnosticInput className="input" placeholder={referenceT("Type a test code or name, Enter adds it")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search tests")}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(list.length - 1, c + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); if (list[cursor]) { add(list[cursor]); setQ(''); } }
            }} />
          <Select className="w-44" value={dept} onChange={setDept} placeholder={referenceT("All departments")} options={depts.map(([id, l]) => ({ value: id, label: String(l).replace(/^\w+ - /, '') }))} />
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list.map((t, i) => (
            <li key={t.id}>
              <DiagnosticButton type="button" onClick={() => add(t)} disabled={chosen.has(t.id)} onMouseEnter={() => setCursor(i)}
                className={cx('flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-40', i === cursor && 'bg-hema-50')}>
                <span className="w-16 shrink-0 text-xs font-semibold text-hema-700">{t.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{t.name}</span>
                  <span className="block truncate text-2xs text-ink-soft">{String(t.sample_type_id__label || '').replace(/^\w+ - /, '')}{t.is_outsourced ? ', sent to reference lab' : ''}{t.body_site_required ? ', body site needed' : ''}</span>
                </span>
                <span className="text-sm tnum text-ink-soft">{money(t.price)}</span>
                {!chosen.has(t.id) && <Plus className="h-4 w-4 text-hema-500" />}
              </DiagnosticButton>
            </li>
          ))}
          {!list.length && <li className="p-4 text-sm text-ink-soft"><ReferenceText message="No active test matches “" />{q}”.</li>}
        </ul>
      </div>
      <div className="panel flex h-[420px] flex-col">
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5 text-sm">
          <span className="font-semibold">{value.length} <ReferenceText message="test" />{value.length === 1 ? '' : 's'} <ReferenceText message="selected" /></span>
          <span className="tnum"><ReferenceText message="Gross" /> {money(total)}</span>
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {value.map((v, i) => (
            <li key={v.test.id} className="px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-hema-700">{v.test.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{v.test.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <Badge>{String(v.test.sample_type_id__label || '').replace(/^\w+ - /, '')}</Badge>
                    {v.test.is_outsourced ? <Badge tone="violet"><ReferenceText message="Reference lab" /></Badge> : null}
                    {v.test.patient_preparation && <Badge tone="high">{v.test.patient_preparation}</Badge>}
                  </div>
                  {!!v.test.body_site_required && (
                    <Select className="mt-1.5 h-8 py-1" value={v.bodySiteId || ''} placeholder={referenceT("Choose body site *")} aria-label={referenceT("Body site")}
                      onChange={(b) => onChange(value.map((x, j) => (j === i ? { ...x, bodySiteId: b } : x)))} options={bodySites.map((o) => ({ value: o.id, label: o.label }))} />
                  )}
                </div>
                <span className="pt-0.5 text-sm tnum">{money(v.test.price)}</span>
                <DiagnosticButton type="button" aria-label={referenceT("Remove {value0}", {value0: v.test.name})} onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded p-1 text-ink-faint hover:bg-crit-bg hover:text-crit"><Trash2 className="h-4 w-4" /></DiagnosticButton>
              </div>
            </li>
          ))}
          {!value.length && <li className="p-4 text-sm text-ink-soft"><ReferenceText message="Pick tests from the catalogue. Tests sharing a tube are collected together automatically." /></li>}
        </ul>
      </div>
    </div>
  );
}
