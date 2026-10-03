'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat, useDiagnosticWorklist} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import {useParams} from '@pepbits/reference-diagnostics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, ChevronLeft, ChevronRight, History, Save, Siren } from 'lucide-react';

import {titleCase} from '../../../../../lib/format';
import { Badge, Button, ErrorBanner, FlagBadge, Kbd, Loading, PriorityBadge, StatusBadge, cx, flagTextClass, useToast } from '../../../../../components/ui';
import { PatientBanner } from '../../../../../components/patient';
import { CriticalNotifyModal } from '../../../../../components/critical';
import { ReportItemDrawer } from '../../../../../components/reportitem';
import { can, useUser } from '../../../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const EDITABLE = ['RECEIVED', 'OUTSOURCED', 'IN_PROCESS', 'RESULTED', 'VALIDATED', 'AMENDING'];

/** Mirrors the server's flagging so the technologist sees flags while typing. */
function liveFlag(p: any, value: string) {
  if (value === '' || value === null || value === undefined) return { flag: null as string | null, critical: false, absurd: false };
  const r = p.range;
  if (p.result_type === 'NUMERIC' || p.result_type === 'CALCULATED') {
    const n = Number(String(value).replace(/^[<>]=?\s*/, ''));
    if (Number.isNaN(n)) return { flag: '?', critical: false, absurd: false };
    if (!r) return { flag: null, critical: false, absurd: false };
    const absurd = (r.absurd_low != null && n < r.absurd_low) || (r.absurd_high != null && n > r.absurd_high);
    if (r.critical_low != null && n < r.critical_low) return { flag: 'LL', critical: true, absurd };
    if (r.critical_high != null && n > r.critical_high) return { flag: 'HH', critical: true, absurd };
    if (r.low != null && n < r.low) return { flag: 'L', critical: false, absurd };
    if (r.high != null && n > r.high) return { flag: 'H', critical: false, absurd };
    return { flag: 'N', critical: false, absurd };
  }
  if (p.result_type === 'OPTION') {
    const o = p.options.find((x: any) => x.value === value || x.code === value);
    return { flag: o ? (o.is_abnormal ? 'A' : 'N') : null, critical: false, absurd: false };
  }
  if (r?.normal_text) return { flag: String(value).trim().toLowerCase() === r.normal_text.toLowerCase() ? 'N' : 'A', critical: false, absurd: false };
  return { flag: null, critical: false, absurd: false };
}

export default function ResultEntryPage() {
 const {ids:worklistIds}=useDiagnosticWorklist();
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [interp, setInterp] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState<any>(null);
  const [drawer, setDrawer] = useState<number | null>(null);
  const [openComment, setOpenComment] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const dept = sp.get('departmentId') || '';

  const load = useCallback(async () => {
    try {
      const d = await get(`/results/sample/${id}`, { departmentId: dept });
      setData(d); setError(null);
      const v: Record<string, string> = {}, c: Record<string, string> = {}, it: Record<number, string> = {};
      d.items.forEach((i: any) => { it[i.id] = i.interpretation || ''; i.parameters.forEach((p: any) => { v[`${i.id}:${p.id}`] = p.value ?? ''; c[`${i.id}:${p.id}`] = p.comment ?? ''; }); });
      setVals(v); setComments(c); setInterp(it);
    } catch (e: any) { setError(e.message); }
  }, [id, dept]);
  useEffect(() => { load(); }, [load]);

  // Worklist order for previous / next sample.
  const nav = useMemo(() => {
    try {
      const ids: number[] = worklistIds;
      const i = ids.indexOf(Number(id));
      return { prev: i > 0 ? ids[i - 1] : null, next: i >= 0 && i < ids.length - 1 ? ids[i + 1] : null, pos: i >= 0 ? `${i + 1} of ${ids.length}` : null };
    } catch { return { prev: null, next: null, pos: null }; }
  }, [id, worklistIds]);

  const dirtyItems = useMemo(() => {
    if (!data) return [] as any[];
    return data.items.filter((i: any) => EDITABLE.includes(i.status) && (
      (interp[i.id] ?? '') !== (i.interpretation || '') ||
      i.parameters.some((p: any) => p.result_type !== 'CALCULATED' && ((vals[`${i.id}:${p.id}`] ?? '') !== (p.value ?? '') || (comments[`${i.id}:${p.id}`] ?? '') !== (p.comment ?? '')))));
  }, [data, vals, comments, interp]);

  const save = async (validate: boolean) => {
    if (!data) return;
    const absurd = data.items.flatMap((i: any) => i.parameters.filter((p: any) => liveFlag(p, vals[`${i.id}:${p.id}`]).absurd).map((p: any) => p.name));
    if (absurd.length) { toast.error(`Check ${absurd.join(', ')}: value is outside the physiologically possible range.`); return; }
    setSaving(true);
    let saved = 0;
    let allDone = false;
    try {
      for (const i of dirtyItems) {
        const entries = i.parameters.filter((p: any) => p.result_type !== 'CALCULATED')
          .filter((p: any) => (vals[`${i.id}:${p.id}`] ?? '') !== (p.value ?? '') || (comments[`${i.id}:${p.id}`] ?? '') !== (p.comment ?? ''))
          .map((p: any) => ({ parameterId: p.id, value: vals[`${i.id}:${p.id}`] === '' ? null : vals[`${i.id}:${p.id}`], comment: comments[`${i.id}:${p.id}`] || null }));
        await post(`/results/item/${i.id}`, { entries, interpretation: interp[i.id] || null });
        saved++;
      }
      if (validate) {
        const fresh = await get(`/results/sample/${id}`, { departmentId: dept });
        const ready = fresh.items.filter((i: any) => i.status === 'RESULTED' || (i.status === 'AMENDING' && i.parameters.every((p: any) => !p.mandatory || (p.value !== null && p.value !== ''))));
        allDone = fresh.items.every((i: any) => ready.includes(i) || ['VALIDATED', 'SIGNED', 'OUTSOURCE_PENDING', 'OUTSOURCED'].includes(i.status));
        if (ready.length) {
          const r = await post('/results/validate', { itemIds: ready.map((i: any) => i.id) });
          toast.ok(`Validated ${r.validated.length} test${r.validated.length === 1 ? '' : 's'}; ready for signature.`);
        } else if (!saved) toast.warn('Nothing is complete enough to validate yet.');
        else toast.ok('Saved. Some tests still have missing results.');
      } else if (saved) toast.ok(`Saved ${saved} test${saved === 1 ? '' : 's'}.`);
      await load();
      if (validate && allDone && nav.next) router.push(`/results/sample/${nav.next}${dept ? `?departmentId=${dept}` : ''}`);
    } catch (e: any) { toast.error(e.message); await load(); } finally { setSaving(false); }
  };

  // Keyboard: Enter/↓ next field, ↑ previous, Ctrl+S save, Ctrl+Enter save & validate, Alt+←/→ other samples.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(true); }
      else if (e.altKey && e.key === 'ArrowRight' && nav.next) router.push(`/results/sample/${nav.next}`);
      else if (e.altKey && e.key === 'ArrowLeft' && nav.prev) router.push(`/results/sample/${nav.prev}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const move = (e: React.KeyboardEvent, dir: 1 | -1) => {
    const fields = Array.from(formRef.current?.querySelectorAll<HTMLElement>('[data-nav]') || []);
    const i = fields.indexOf(e.currentTarget as HTMLElement);
    const next = fields[i + dir];
    if (next) { e.preventDefault(); next.focus(); if (next instanceof HTMLInputElement) next.select(); }
  };
  const fieldKeys = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' && !(e.currentTarget instanceof HTMLTextAreaElement)) move(e, 1);
    else if (e.key === 'ArrowDown' && !(e.currentTarget instanceof HTMLTextAreaElement) && !(e.currentTarget instanceof HTMLSelectElement)) move(e, 1);
    else if (e.key === 'ArrowUp' && !(e.currentTarget instanceof HTMLTextAreaElement) && !(e.currentTarget instanceof HTMLSelectElement)) move(e, -1);
  };

  if (error) return <ErrorBanner error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const s = data.sample;
  const canEdit = user && ['ADMIN', 'TECHNOLOGIST', 'PATHOLOGIST'].includes(user.role);

  return (
    <div className="pb-20" ref={formRef}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/worklist" className="text-sm text-ink-soft hover:text-ink"><ReferenceText message="Worklist" /></Link><span className="text-ink-faint">/</span>
        <h1 className="text-lg font-semibold tnum"><ReferenceText message="Sample" /> {s.sample_no}</h1>
        {s.external_sample_no && <Badge><ReferenceText message="client" /> {s.external_sample_no}</Badge>}
        <PriorityBadge priority={s.priority} />
        <div className="ml-auto flex items-center gap-1">
          {nav.pos && <span className="mr-2 text-xs text-ink-soft">{nav.pos} <ReferenceText message="in worklist" /></span>}
          <Button size="sm" disabled={!nav.prev} onClick={() => router.push(`/results/sample/${nav.prev}`)} icon={<ChevronLeft className="h-4 w-4" />} title={referenceT("Alt+←")}><ReferenceText message="Previous" /></Button>
          <Button size="sm" disabled={!nav.next} onClick={() => router.push(`/results/sample/${nav.next}`)} title={referenceT("Alt+→")}><ReferenceText message="Next" /> <ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <PatientBanner p={s} className="mb-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span><span className="text-ink-soft"><ReferenceText message="Specimen" /> </span>{s.sample_type}{s.body_site ? `, ${s.body_site}` : ''}</span>
          <span><span className="text-ink-soft"><ReferenceText message="Collected" /> </span>{fmtDateTime(s.collected_at)}</span>
          <span><span className="text-ink-soft"><ReferenceText message="Received" /> </span>{fmtDateTime(s.received_at)}</span>
          {s.facility && <span><span className="text-ink-soft"><ReferenceText message="From" /> </span>{s.facility}</span>}
          {s.pregnant ? <Badge tone="eosin"><ReferenceText message="Pregnant" /></Badge> : null}
          {s.ethnicity && <span className="text-ink-soft">{s.ethnicity}</span>}
        </div>
      </PatientBanner>

      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label={referenceT("Tests on this sample")}>
          <ul className="sticky top-20 space-y-1">
            {data.items.map((i: any) => {
              const filled = i.parameters.filter((p: any) => (vals[`${i.id}:${p.id}`] ?? '') !== '').length;
              return (
                <li key={i.id}><a href={`#item-${i.id}`} className="block rounded-md border border-line bg-white px-2.5 py-1.5 hover:border-hema-200">
                  <div className="flex items-center justify-between gap-1"><span className="text-sm font-medium">{i.test_code}</span>{i.is_critical ? <FlagBadge flag="HH" critical /> : null}</div>
                  <div className="flex items-center justify-between gap-1"><StatusBadge status={i.status} /><span className="text-2xs text-ink-soft tnum">{filled}/{i.parameters.length}</span></div>
                </a></li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-4">
          {data.items.map((i: any) => {
            const editable = canEdit && EDITABLE.includes(i.status);
            const pending = i.criticals.filter((c: any) => c.status === 'PENDING');
            let section = '';
            return (
              <section key={i.id} id={`item-${i.id}`} className={cx('panel scroll-mt-20 overflow-hidden', i.status === 'AMENDING' && 'border-high')}>
                <header className="flex flex-wrap items-center gap-2 border-b border-line bg-[#F1F3F0] px-4 py-2">
                  <h2 className="font-semibold">{i.test_name}</h2>
                  <span className="text-xs text-ink-soft">{i.test_code}, {i.department}{i.sub_department ? ` / ${i.sub_department}` : ''}{i.method ? `, ${i.method}` : ''}</span>
                  <StatusBadge status={i.status} />
                  {i.report_version > 0 && <Badge tone="hema"><ReferenceText message="v" />{i.report_version}</Badge>}
                  <span className="ml-auto text-xs text-ink-soft">{i.order_no}{i.due_at ? `, due ${fmtDateTime(i.due_at)}` : ''}</span>
                  <DiagnosticButton className="rounded p-1 text-ink-soft hover:bg-black/5" title={referenceT("History, versions and delivery")} aria-label={referenceT("History")} onClick={() => setDrawer(i.id)}><History className="h-4 w-4" /></DiagnosticButton>
                </header>
                {(i.clinical_info || i.diagnosis) && <p className="border-b border-line px-4 py-1.5 text-xs text-ink-soft"><ReferenceText message="Clinical:" /> {[i.diagnosis, i.clinical_info].filter(Boolean).join('. ')}</p>}
                {i.status === 'AMENDING' && <p className="flex items-center gap-2 border-b border-line bg-high-bg px-4 py-2 text-sm text-high"><AlertTriangle className="h-4 w-4" /><ReferenceText message="Amendment:" /> {i.amend_reason}<ReferenceText message=". Correct, then save and validate; the pathologist signs the corrected report." /></p>}
                {i.sent_back_reason && ['RESULTED', 'IN_PROCESS', 'AMENDING'].includes(i.status) && <p className="flex items-center gap-2 border-b border-line bg-high-bg px-4 py-2 text-sm text-high"><AlertTriangle className="h-4 w-4" /><ReferenceText message="Sent back by pathologist:" /> {i.sent_back_reason}</p>}
                {i.status === 'SIGNED' && <p className="border-b border-line bg-ok-bg px-4 py-1.5 text-sm text-ok"><ReferenceText message="Signed by" /> {i.signed_by_name}, {fmtDateTime(i.signed_at)}<ReferenceText message=". Open an amendment from the report to change it." /></p>}
                {i.status === 'OUTSOURCE_PENDING' && <p className="border-b border-line bg-violet-50 px-4 py-1.5 text-sm text-violet-800"><ReferenceText message="Waiting to be shipped to the reference lab." /></p>}
                {pending.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-2 border-b border-crit/30 bg-crit-bg px-4 py-2 text-sm text-crit">
                    <Siren className="h-4 w-4" /><span className="flex-1"><ReferenceText message="Critical" /> {c.parameter} <ReferenceText message="must be phoned through before this report can be signed." /></span>
                    <Button size="sm" variant="danger" onClick={() => setNotify({ n: c, item: i })}><ReferenceText message="Record notification" /></Button>
                  </div>
                ))}
                <div className="overflow-x-auto">
                  <DiagnosticTable className="w-full text-sm">
                    <TableHeader><TableRow>
                      <TableHead className="th w-[26%]"><ReferenceText message="Parameter" /></TableHead><TableHead className="th w-[18%]"><ReferenceText message="Result" /></TableHead><TableHead className="th w-12"><ReferenceText message="Flag" /></TableHead><TableHead className="th"><ReferenceText message="Unit" /></TableHead>
                      <TableHead className="th"><ReferenceText message="Reference" /></TableHead><TableHead className="th"><ReferenceText message="Previous" /></TableHead><TableHead className="th"><ReferenceText message="Source" /></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {i.parameters.map((p: any) => {
                        const k = `${i.id}:${p.id}`;
                        const v = vals[k] ?? '';
                        const lf = liveFlag(p, v);
                        const changed = v !== (p.value ?? '');
                        const heading = p.section_title && p.section_title !== section ? (section = p.section_title) : null;
                        const ro = !editable || p.result_type === 'CALCULATED';
                        const control = p.result_type === 'OPTION' ? (
                          <DiagnosticSelect data-nav disabled={ro} value={v} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} onKeyDown={fieldKeys} aria-label={p.name}
                            className={cx('input h-8 py-0.5', flagTextClass(lf.flag, lf.critical))}>
                            <option value="" />{p.options.map((o: any) => <option key={o.code} value={o.value}>{o.value}</option>)}
                          </DiagnosticSelect>
                        ) : p.result_type === 'MEMO' ? (
                          <DiagnosticTextarea data-nav disabled={ro} value={v} rows={4} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} onKeyDown={fieldKeys} aria-label={p.name} className="input min-h-[96px]" />
                        ) : (
                          <DiagnosticInput data-nav disabled={ro} value={v} inputMode={p.result_type === 'NUMERIC' ? 'decimal' : 'text'} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} onKeyDown={fieldKeys}
                            onFocus={(e) => e.currentTarget.select()} aria-label={p.name} placeholder={p.result_type === 'CALCULATED' ? 'calculated' : ''}
                            className={cx('input h-8 py-0.5 text-right tnum', lf.critical ? 'border-crit bg-crit-bg' : lf.absurd ? 'border-crit' : '', flagTextClass(lf.flag, lf.critical), changed && 'ring-2 ring-eosin-100')} />
                        );
                        return (
                          <FragmentRows key={p.id} heading={heading}>
                            <TableRow className={cx(lf.critical && 'bg-crit-bg/40')}>
                              <TableCell className="td"><div className="font-medium">{p.name}</div>{p.loinc_num && <div className="text-2xs text-ink-faint"><ReferenceText message="LOINC" /> {p.loinc_num}</div>}</TableCell>
                              <TableCell className={cx('td', p.result_type === 'MEMO' && 'min-w-[380px]')} colSpan={p.result_type === 'MEMO' ? 5 : 1}>
                                {control}
                                {lf.absurd && <div className="mt-0.5 text-2xs text-crit"><ReferenceText message="Outside the possible range" /></div>}
                                {openComment === k || comments[k] ? (
                                  <DiagnosticInput className="input mt-1 h-7 py-0.5 text-xs" disabled={ro} placeholder={referenceT("Comment for this result")} value={comments[k] || ''} onChange={(e) => setComments({ ...comments, [k]: e.target.value })} aria-label={referenceT("{value0} comment", {value0: p.name})} />
                                ) : editable && p.result_type !== 'MEMO' && <DiagnosticButton type="button" tabIndex={-1} className="mt-0.5 text-2xs text-ink-faint hover:text-hema-600" onClick={() => setOpenComment(k)}><ReferenceText message="Add comment" /></DiagnosticButton>}
                              </TableCell>
                              {p.result_type !== 'MEMO' && <>
                                <TableCell className="td"><FlagBadge flag={lf.flag === '?' ? null : lf.flag} critical={lf.critical} />{lf.flag === '?' && <span className="text-2xs text-crit"><ReferenceText message="not a number" /></span>}{p.delta_flag ? <Badge tone="violet" title={referenceT("Delta check")}>Δ</Badge> : null}</TableCell>
                                <TableCell className="td text-ink-soft">{p.unit}</TableCell>
                                <TableCell className="td text-ink-soft tnum">{p.range?.text}{p.range && (p.range.critical_low != null || p.range.critical_high != null) && <div className="text-2xs text-crit/80"><ReferenceText message="critical" /> {p.range.critical_low ?? '–'} / {p.range.critical_high ?? '–'}</div>}</TableCell>
                              </>}
                              <TableCell className="td tnum">{p.prev_value ? <span title={fmtDateTime(p.prev_at)} className={flagTextClass(p.prev_flag)}>{p.prev_value}<span className="block text-2xs font-normal text-ink-faint">{fmtDateTime(p.prev_at)}</span></span> : <span className="text-ink-faint">–</span>}</TableCell>
                              <TableCell className="td text-2xs text-ink-soft">{p.source ? <>{titleCase(p.source)}{p.analyzer ? `, ${p.analyzer}` : ''}{p.history_count > 1 && <DiagnosticButton className="ml-1 link" onClick={() => setDrawer(i.id)}>{p.history_count - 1} <ReferenceText message="change" />{p.history_count > 2 ? 's' : ''}</DiagnosticButton>}</> : ''}</TableCell>
                            </TableRow>
                          </FragmentRows>
                        );
                      })}
                    </TableBody>
                  </DiagnosticTable>
                </div>
                <div className="border-t border-line px-4 py-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <label htmlFor={`interp-${i.id}`} className="text-xs font-medium text-ink-soft"><ReferenceText message="Interpretation / report comment" /></label>
                    {editable && data.comments.length > 0 && (
                      <DiagnosticSelect className="ml-auto rounded border border-line bg-white px-1.5 py-0.5 text-xs" value="" aria-label={referenceT("Insert canned comment")}
                        onChange={(e) => { const c = data.comments.find((x: any) => String(x.id) === e.target.value); if (c) setInterp({ ...interp, [i.id]: [interp[i.id], c.text].filter(Boolean).join(' ') }); }}>
                        <option value=""><ReferenceText message="Insert canned comment…" /></option>
                        {data.comments.map((c: any) => <option key={c.id} value={c.id}>{c.code}: {c.text.slice(0, 60)}</option>)}
                      </DiagnosticSelect>
                    )}
                  </div>
                  <DiagnosticTextarea id={`interp-${i.id}`} data-nav disabled={!editable} rows={2} value={interp[i.id] || ''} onChange={(e) => setInterp({ ...interp, [i.id]: e.target.value })} className="input min-h-[44px] text-sm" />
                  {i.validated_by_name && i.status === 'VALIDATED' && <p className="mt-1 text-2xs text-ink-soft"><ReferenceText message="Validated by" /> {i.validated_by_name}, {fmtDateTime(i.validated_at)}<ReferenceText message=". Changing a result sends it back for re-validation." /></p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="no-print fixed bottom-0 left-0 right-0 z-10 border-t border-line bg-white/95 backdrop-blur md:left-[60px]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-6 py-2.5">
          <span className="text-sm text-ink-soft">{dirtyItems.length ? <><b className="text-eosin-600">{dirtyItems.length}</b> <ReferenceText message="test" />{dirtyItems.length > 1 ? 's' : ''} <ReferenceText message="with unsaved changes" /></> : 'All changes saved'}</span>
          <span className="hidden items-center gap-1.5 text-2xs text-ink-faint xl:flex"><Kbd><ReferenceText message="Enter" /></Kbd> <ReferenceText message="next field" /> <Kbd>↑</Kbd><Kbd>↓</Kbd> <ReferenceText message="move" /> <Kbd><ReferenceText message="Ctrl S" /></Kbd> <ReferenceText message="save" /> <Kbd><ReferenceText message="Ctrl Enter" /></Kbd> <ReferenceText message="save and validate" /> <Kbd><ReferenceText message="Alt ←/→" /></Kbd> <ReferenceText message="sample" /></span>
          <div className="ml-auto flex gap-2">
            <Button loading={saving} disabled={!dirtyItems.length || !canEdit} icon={<Save className="h-4 w-4" />} onClick={() => save(false)}><ReferenceText message="Save" /></Button>
            {can(user, 'TECHNOLOGIST', 'PATHOLOGIST') && <Button variant="primary" loading={saving} icon={<CheckCheck className="h-4 w-4" />} onClick={() => save(true)}><ReferenceText message="Save and validate" />{nav.next ? ', next sample' : ''}</Button>}
          </div>
        </div>
      </div>
      {notify && <CriticalNotifyModal open notification={notify.n} onClose={() => setNotify(null)} onDone={() => { toast.ok('Notification recorded.'); load(); }}
        context={<p className="mb-3 text-sm">{notify.item.test_name}: <b className="text-crit">{notify.n.parameter}</b></p>} />}
      <ReportItemDrawer itemId={drawer} onClose={() => setDrawer(null)} onChanged={load} />
    </div>
  );
}

function FragmentRows({ heading, children }: { heading: string | null; children: React.ReactNode }) {
  return <>{heading && <TableRow><TableCell colSpan={7} className="bg-paper px-4 py-1 text-xs font-semibold text-ink-soft">{heading}</TableCell></TableRow>}{children}</>;
}
