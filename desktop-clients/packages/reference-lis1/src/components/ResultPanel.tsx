'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertOctagon, History, RotateCcw, Save, ShieldCheck } from 'lucide-react';


import { Badge, Button, Flag, Input, Loading, Select, Tabs, Textarea, TubeChip, useAction } from './ui';
import { StatusRail } from './Rail';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const list = (s?: string | null) => (s || '').split(/[,|;\n]/).map((x) => x.trim()).filter(Boolean);

/** Client-side preview of the flag; the server re-evaluates authoritatively on save. */
export function previewFlag(p: any, range: any, raw: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (p.resultType === 'NUMERIC' || p.resultType === 'CALCULATED') {
    const n = parseFloat(v.replace(/^[<>]=?/, ''));
    if (isNaN(n) || !range) return '';
    if (range.criticalLow != null && n < range.criticalLow) return 'LL';
    if (range.criticalHigh != null && n > range.criticalHigh) return 'HH';
    if (range.lowNormal != null && n < range.lowNormal) return 'L';
    if (range.highNormal != null && n > range.highNormal) return 'H';
    return 'N';
  }
  const low = v.toLowerCase();
  if (list(p.criticalValues).some((x) => x.toLowerCase() === low)) return 'AA';
  if (list(p.abnormalValues).some((x) => x.toLowerCase() === low)) return 'A';
  if (range?.normalText && range.normalText.toLowerCase() !== low && list(p.options).length === 0) return '';
  return 'N';
}

type Mode = 'entry' | 'review';

export function ResultPanel({ orderTestId, mode = 'entry', onChanged, actions }: { orderTestId: number; mode?: Mode; onChanged?: () => void; actions?: (d: any, reload: () => void) => React.ReactNode }) {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const [d, setD] = useState<any>(null);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [tab, setTab] = useState('results');
  const [err, setErr] = useState<string | null>(null);
  const { busy, run } = useAction();
  const refs = useRef<(HTMLElement | null)[]>([]);

  const load = async () => {
    try {
      const r = await api.get(`/results/order-tests/${orderTestId}`);
      setD(r); setErr(null);
      const v: Record<number, string> = {}; const c: Record<number, string> = {};
      for (const row of r.parameters) {
        v[row.parameter.id] = row.result?.value ?? (r.editable && !row.result ? row.parameter.defaultValue ?? '' : '');
        c[row.parameter.id] = row.result?.comment ?? '';
      }
      setVals(v); setComments(c);
    } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { setD(null); setTab('results'); load(); /* eslint-disable-next-line */ }, [orderTestId]);

  const dirty = useMemo(() => d?.parameters.some((row: any) => (vals[row.parameter.id] ?? '') !== (row.result?.value ?? '') || (comments[row.parameter.id] ?? '') !== (row.result?.comment ?? '')), [d, vals, comments]);

  if (err) return <div className="p-4 text-sm text-flag-crit">{err}</div>;
  if (!d) return <Loading />;
  const editable = mode === 'entry' && d.editable;

  const save = async (andValidate = false) => {
    const results = d.parameters
      .filter((row: any) => row.parameter.resultType !== 'CALCULATED')
      .filter((row: any) => (vals[row.parameter.id] ?? '') !== (row.result?.value ?? '') || (comments[row.parameter.id] ?? '') !== (row.result?.comment ?? ''))
      .map((row: any) => ({ parameterId: row.parameter.id, value: vals[row.parameter.id] ?? '', comment: comments[row.parameter.id] || undefined }));
    if (results.length) {
      const r = await run('save', () => api.post(`/results/order-tests/${orderTestId}`, { results }), andValidate ? undefined : 'Results saved');
      if (!r) return;
    }
    if (andValidate) {
      const v = await run('save', () => api.post('/results/validate', { ids: [orderTestId] }), 'Saved and validated');
      if (!v) { await load(); onChanged?.(); return; }
    }
    await load(); onChanged?.();
  };

  const focusNext = (i: number) => { const el = refs.current.slice(i + 1).find(Boolean); el?.focus(); };
  const critical = d.parameters.some((r: any) => r.result?.isCritical);
  let inputIndex = -1;

  return (
    <div>
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">{d.test?.name}<Badge value={d.status} />{d.order?.priority === 'STAT' && <Badge value="STAT" />}{d.isOutsourced && <Badge value="OUTSOURCED" label={referenceT("Reference lab")} />}</div>
            <div className="mt-0.5 text-sm text-ink-soft">
              {d.patient?.fullName} · <span className="font-mono text-xs">{d.patient?.mrn}</span> · {d.patient?.gender} · {d.patient?.age}{d.patient?.isPregnant ? ' · pregnant' : ''}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute">
              <TubeChip size="sm" color={d.container?.capColor} /><span className="font-mono">{d.sample?.sampleNo}</span> · {d.sampleType?.name}{d.bodySite ? ` · ${d.bodySite.name}` : ''} <ReferenceText message="· order" /> <span className="font-mono">{d.order?.orderNo}</span>{d.doctor ? ` · ${d.doctor.name}` : ''}
            </div>
          </div>
          <StatusRail status={d.status} />
        </div>
        {d.openAmendment && <div className="mt-2 rounded border border-[#F0CDB6] bg-[#FDF0E7] px-3 py-1.5 text-sm text-flag-high"><ReferenceText message="Amendment open:" /> {d.openAmendment.reason}<ReferenceText message=". Correct the results, validate, and re-sign to issue a new report version." /></div>}
        {critical && <div className="mt-2 flex items-center gap-2 rounded border border-[#E7B7B2] bg-[#FDF3F2] px-3 py-1.5 text-sm text-flag-crit"><AlertOctagon className="h-4 w-4" /><ReferenceText message="Critical value present – notify the clinician from Critical alerts." /></div>}
        {d.order?.clinicalNotes && <div className="mt-2 text-xs text-ink-soft"><ReferenceText message="Clinical notes:" /> {d.order.clinicalNotes}</div>}
        {d.technicalNote && <div className="mt-1 text-xs text-ink-soft"><ReferenceText message="Technical note:" /> {d.technicalNote}</div>}
      </div>
      <div className="px-4 pt-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'results', label: 'Results' }, { value: 'history', label: `Audit trail (${d.history.length})` }]} />
      </div>
      {tab === 'results' ? (
        <div className="overflow-x-auto px-4 pb-3">
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Parameter" /></TableHead><TableHead className="w-52"><ReferenceText message="Result" /></TableHead><TableHead><ReferenceText message="Flag" /></TableHead><TableHead><ReferenceText message="Unit" /></TableHead><TableHead><ReferenceText message="Reference" /></TableHead><TableHead><ReferenceText message="Source" /></TableHead><TableHead className="w-48"><ReferenceText message="Comment" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {d.parameters.map((row: any, idx: number) => {
                const p = row.parameter;
                const v = vals[p.id] ?? '';
                const flag = editable ? previewFlag(p, row.range, v) : row.result?.flag;
                const section = row.testParameter.sectionHeading && row.testParameter.sectionHeading !== d.parameters[idx - 1]?.testParameter.sectionHeading;
                const calc = p.resultType === 'CALCULATED';
                const myIndex = calc ? -1 : ++inputIndex;
                const common = {
                  ref: (el: any) => { if (myIndex >= 0) refs.current[myIndex] = el; },
                  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' && p.resultType !== 'MEMO') { e.preventDefault(); focusNext(myIndex); } },
                  disabled: !editable,
                };
                return [
                  section && <TableRow key={`s${idx}`}><TableCell colSpan={7} className="bg-paper text-xs font-semibold text-ink-soft">{row.testParameter.sectionHeading}</TableCell></TableRow>,
                  <TableRow key={p.id} className={['LL', 'HH', 'AA'].includes(flag) ? 'bg-[#FFF8F7]' : ''}>
                    <TableCell>
                      <div className="font-medium">{p.name}{row.testParameter.isMandatory && editable && <span className="text-flag-crit"> *</span>}</div>
                      <div className="text-xs2 text-ink-mute">{p.code}{p.loincCode ? ` · LOINC ${p.loincCode}` : ''}{p.method ? ` · ${p.method}` : ''}</div>
                    </TableCell>
                    <TableCell>
                      {calc ? <div className="num py-1.5 font-medium">{row.result?.value || <span className="text-xs text-ink-mute"><ReferenceText message="calculated" /></span>}</div>
                        : p.resultType === 'OPTION' ? (
                          <Select {...common} value={v} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} placeholder="—" options={list(p.options).map((o) => ({ value: o, label: o }))} />
                        ) : p.resultType === 'MEMO' ? (
                          <Textarea {...common} rows={2} value={v} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} />
                        ) : (
                          <Input {...common} className={`num ${p.resultType === 'NUMERIC' ? 'text-right' : ''}`} inputMode={p.resultType === 'NUMERIC' ? 'decimal' : undefined} value={v} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} />
                        )}
                    </TableCell>
                    <TableCell><Flag flag={flag} /></TableCell>
                    <TableCell className="text-xs">{p.unit || ''}</TableCell>
                    <TableCell className="text-xs text-ink-soft">{row.range?.text || row.result?.referenceText || '—'}{row.range?.condition ? <div className="text-xs2 text-ink-mute">{row.range.condition.toLowerCase()}</div> : null}</TableCell>
                    <TableCell className="text-xs2 text-ink-mute">{row.result ? <>{row.result.source?.toLowerCase().replace('_', ' ')}{row.result.enteredByName ? <div>{row.result.enteredByName}</div> : null}</> : ''}</TableCell>
                    <TableCell><Input disabled={!editable} className="text-xs" value={comments[p.id] ?? ''} onChange={(e) => setComments({ ...comments, [p.id]: e.target.value })} /></TableCell>
                  </TableRow>,
                ];
              })}
            </TableBody>
          </DiagnosticTable>
          {d.test?.interpretation && <div className="mt-2 text-xs text-ink-soft"><ReferenceText message="Interpretation guide:" /> {d.test.interpretation}</div>}
        </div>
      ) : (
        <div className="px-4 pb-3">
          {!d.history.length ? <div className="py-6 text-center text-sm text-ink-mute"><ReferenceText message="No changes recorded yet." /></div> : (
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow><TableHead><ReferenceText message="When" /></TableHead><TableHead><ReferenceText message="Parameter" /></TableHead><TableHead><ReferenceText message="Old" /></TableHead><TableHead><ReferenceText message="New" /></TableHead><TableHead><ReferenceText message="By" /></TableHead><TableHead><ReferenceText message="Reason" /></TableHead></TableRow></TableHeader>
              <TableBody>{d.history.map((h: any) => (
                <TableRow key={h.id}><TableCell className="text-xs">{fmtDateTime(h.createdAt)}</TableCell><TableCell>{h.parameterName}</TableCell><TableCell className="num text-ink-mute line-through">{h.oldValue ?? '—'}</TableCell><TableCell className="num font-medium">{h.newValue}</TableCell><TableCell className="text-xs">{h.changedByName ?? h.source ?? 'system'}</TableCell><TableCell className="text-xs">{h.reason ?? ''}</TableCell></TableRow>
              ))}</TableBody>
            </DiagnosticTable>
          )}
          {d.amendments?.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /><ReferenceText message="Amendments" /></div>
              {d.amendments.map((a: any) => <div key={a.id} className="text-sm">{fmtDateTime(a.createdAt)} · {a.reason} · <Badge value={a.status} /></div>)}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-4 py-3">
        {editable && <>
          {d.analyzerId && !d.isOutsourced && <Button icon={RotateCcw} loading={busy === 'rerun'} onClick={() => run('rerun', () => api.post(`/results/order-tests/${orderTestId}/rerun`), 'Rerun requested from the analyzer').then(() => { load(); onChanged?.(); })}><ReferenceText message="Rerun on analyzer" /></Button>}
          <Button icon={Save} loading={busy === 'save'} disabled={!dirty} onClick={() => save(false)}><ReferenceText message="Save" /></Button>
          {(['RESULTED', 'AMENDING'].includes(d.status) || (dirty && ['ACCESSIONED', 'IN_ANALYZER', 'OUTSOURCED'].includes(d.status))) && <Button variant="primary" icon={ShieldCheck} loading={busy === 'save'} onClick={() => save(true)}><ReferenceText message="Save and validate" /></Button>}
        </>}
        {actions?.(d, () => { load(); onChanged?.(); })}
      </div>
    </div>
  );
}
