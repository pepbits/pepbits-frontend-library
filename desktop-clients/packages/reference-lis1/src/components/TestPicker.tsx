'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useMemo, useState } from 'react';
import { Layers, Search, Truck } from 'lucide-react';
import { useMaster } from '../lib/hooks';
import {cls,minutesLabel} from '../lib/format';
import { Input, TubeChip } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Searchable test & profile catalogue grouped by department. */
export function TestPicker({ selectedTests, selectedProfiles, onAddTest, onAddProfile, currency = 'USD', showProfiles = true, excludeTestIds = [] }: {
  selectedTests: number[]; selectedProfiles?: number[]; onAddTest: (t: any) => void; onAddProfile?: (p: any) => void; currency?: string; showProfiles?: boolean; excludeTestIds?: number[];
}) {
 const referenceT = useReferenceLocalization().t;

 const {money}=useDiagnosticFormat();

  const tests = useMaster('tests');
  const profiles = useMaster('profiles');
  const depts = useMaster('departments');
  const containers = useMaster('containers');
  const sampleTypes = useMaster('sample-types');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<number | 'ALL' | 'PROFILES'>('ALL');

  const term = q.trim().toLowerCase();
  const visible = useMemo(() => tests
    .filter((t) => t.active && !excludeTestIds.includes(t.id))
    .filter((t) => dept === 'ALL' || t.departmentId === dept)
    .filter((t) => !term || [t.code, t.name, t.shortName, t.loincCode].some((x) => x?.toLowerCase().includes(term)))
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.name.localeCompare(b.name)), [tests, dept, term, excludeTestIds]);
  const visibleProfiles = profiles.filter((p) => p.active && (!term || [p.code, p.name].some((x) => x?.toLowerCase().includes(term))));

  return (
    <div className="flex h-full flex-col">
      <div className="relative mb-2"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" />
        <Input autoFocus className="pl-8" placeholder={referenceT("Search test code, name or LOINC")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {[{ id: 'ALL', name: 'All tests' }, ...(showProfiles ? [{ id: 'PROFILES', name: 'Profiles' }] : []), ...depts.filter((d) => d.active)].map((d: any) => (
          <DiagnosticButton key={d.id} onClick={() => setDept(d.id)} className={cls('rounded border px-2 py-0.5 text-xs', dept === d.id ? 'border-lab-600 bg-lab-50 text-lab-800' : 'border-line-strong text-ink-soft hover:bg-paper')}>{d.name}</DiagnosticButton>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-line">
        {(dept === 'PROFILES' || (dept === 'ALL' && showProfiles && term)) && visibleProfiles.map((p) => {
          const on = selectedProfiles?.includes(p.id);
          return (
            <DiagnosticButton key={`p${p.id}`} disabled={on} onClick={() => onAddProfile?.(p)} className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left hover:bg-lab-50 disabled:opacity-40">
              <Layers className="h-4 w-4 text-lab-600" />
              <div className="flex-1"><div className="text-sm font-medium">{p.name}</div><div className="text-xs2 text-ink-mute">{p.code} · {(p.testIds || []).length} <ReferenceText message="tests · profile" /></div></div>
              <div className="num text-sm">{money(p.price, currency)}</div>
            </DiagnosticButton>
          );
        })}
        {dept !== 'PROFILES' && visible.map((t) => {
          const on = selectedTests.includes(t.id);
          const c = containers.find((x) => x.id === t.containerId);
          const st = sampleTypes.find((x) => x.id === t.sampleTypeId);
          return (
            <DiagnosticButton key={t.id} disabled={on} onClick={() => onAddTest(t)} className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left hover:bg-lab-50 disabled:opacity-40">
              <TubeChip color={c?.capColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.name}</div>
                <div className="text-xs2 text-ink-mute">{t.code} · {st?.name ?? 'No sample type'} <ReferenceText message="· TAT" /> {minutesLabel(t.tatRoutineMinutes)}{t.loincCode ? ` · LOINC ${t.loincCode}` : ''}</div>
              </div>
              {t.isOutsourced && <Truck className="h-3.5 w-3.5 text-flag-warn" aria-label={referenceT("Outsourced")} />}
              <div className="num text-sm">{money(t.price, currency)}</div>
            </DiagnosticButton>
          );
        })}
        {dept !== 'PROFILES' && !visible.length && <div className="p-4 text-sm text-ink-mute"><ReferenceText message="No tests match." /></div>}
      </div>
    </div>
  );
}
