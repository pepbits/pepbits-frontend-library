'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CornerUpLeft, PenLine, Siren } from 'lucide-react';

import { useDebounced } from '../../../lib/hooks';
import {age,fullName,titleCase} from '../../../lib/format';
import { Badge, Button, Checkbox, Empty, ErrorBanner, FlagBadge, Kbd, Loading, PageHeader, Pagination, PriorityBadge, PromptModal, Select, cx, flagTextClass, useToast } from '../../../components/ui';
import { RefSelect } from '../../../components/refselect';
import { CriticalNotifyModal } from '../../../components/critical';
import { can, useUser } from '../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Cat = 'critical' | 'abnormal' | 'normal' | 'delta' | 'amended' | 'all';
const CATS: { value: Cat; label: string; tone: string }[] = [
  { value: 'critical', label: 'Critical', tone: 'bg-crit text-white' },
  { value: 'abnormal', label: 'Abnormal', tone: 'bg-high-bg text-high' },
  { value: 'normal', label: 'Normal', tone: 'bg-ok-bg text-ok' },
  { value: 'delta', label: 'Delta failures', tone: 'bg-violet-50 text-violet-800' },
  { value: 'amended', label: 'Amendments', tone: 'bg-hema-50 text-hema-700' },
  { value: 'all', label: 'All', tone: 'bg-slate-100 text-slate-700' },
];
const stripe = (r: any) => (r.is_critical ? 'bg-crit' : r.is_abnormal ? 'bg-high' : 'bg-ok');

export default function SigningConsole() {
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const user = useUser();
  const toast = useToast();
  const [cat, setCat] = useState<Cat | null>(null);
  const [dept, setDept] = useState('');
  const [priority, setPriority] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [interp, setInterp] = useState<Record<number, string>>({});
  const [sendBack, setSendBack] = useState<any>(null);
  const [notify, setNotify] = useState<any>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pageSize = 50;

  const load = useCallback(async (keepCursor = false) => {
    setLoading(true);
    try {
      let category = cat;
      if (!category) {
        // Review order: critical first, then abnormal, then normal.
        const c = (await get('/results/signing-queue', { pageSize: 1, departmentId: dept, priority, q: dq })).counts;
        category = c.critical ? 'critical' : c.abnormal ? 'abnormal' : c.normal ? 'normal' : 'all';
        setCat(category);
        return;
      }
      const r = await get('/results/signing-queue', { category, departmentId: dept, priority, q: dq, page, pageSize });
      setData(r); setError(null);
      setCursor((c) => (keepCursor ? Math.min(c, Math.max(0, r.data.length - 1)) : 0));
      setSel((s) => new Set([...s].filter((id) => r.data.some((x: any) => x.id === id))));
      setInterp(Object.fromEntries(r.data.map((x: any) => [x.id, x.interpretation || ''])));
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [cat, dept, priority, dq, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [cat, dept, priority, dq]);

  const rows: any[] = useMemo(() => data?.data || [], [data]);
  const cur = rows[cursor];
  useEffect(() => { listRef.current?.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const sign = async (ids: number[]) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      // A changed interpretation is saved first; saving re-opens the report, so validate again before signing.
      for (const id of ids) {
        const row = rows.find((r) => r.id === id);
        if (row && (interp[id] || '') !== (row.interpretation || '')) {
          await post(`/results/item/${id}`, { entries: [], interpretation: interp[id] || null });
          await post('/results/validate', { itemIds: [id] });
        }
      }
      const r = await post('/results/sign', { itemIds: ids });
      if (r.signed.length) toast.ok(`Signed ${r.signed.length} report${r.signed.length === 1 ? '' : 's'}.`);
      if (r.skipped.length) toast.warn(`${r.skipped.length} not signed: ${[...new Set(r.skipped.map((s: any) => s.reason))].join('; ')}.`);
      setSel(new Set());
      await load(true);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  // Keyboard: J/K or ↓/↑ move, S sign current, X select, B send back, Shift+S sign selected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[role=dialog]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
      else if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if (k === 'x' && cur) { e.preventDefault(); setSel((s) => { const n = new Set(s); n.has(cur.id) ? n.delete(cur.id) : n.add(cur.id); return n; }); }
      else if (k === 's' && e.shiftKey && sel.size) { e.preventDefault(); sign([...sel]); }
      else if (k === 's' && cur && !busy) { e.preventDefault(); sign([cur.id]); }
      else if (k === 'b' && cur) { e.preventDefault(); setSendBack(cur); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const isPathologist = can(user, 'PATHOLOGIST');
  const counts = data?.counts || {};
  const signableOnPage = rows.filter((r) => !r.critical_pending).map((r) => r.id);

  return (
    <>
      <PageHeader title={referenceT("Signing console")} subtitle={referenceT("Validated reports awaiting a pathologist’s signature. Critical results are reviewed first, then abnormal, then normal.")} />
      {!isPathologist && <p className="mb-3 rounded-md bg-high-bg px-3 py-2 text-sm text-high"><ReferenceText message="You can review this queue, but only pathologists can sign." /></p>}

      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label={referenceT("Report categories")}>
        {CATS.map((c) => (
          <DiagnosticButton key={c.value} role="tab" aria-selected={cat === c.value} onClick={() => setCat(c.value)}
            className={cx('flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors', cat === c.value ? 'border-ink bg-white font-semibold shadow-sm' : 'border-line bg-white/60 text-ink-soft hover:bg-white')}>
            <ReferenceText message={c.label} /><span className={cx('min-w-6 rounded-full px-1.5 text-center text-2xs font-semibold tnum', c.tone)}>{c.value === 'all' ? counts.total ?? 0 : counts[c.value] ?? 0}</span>
          </DiagnosticButton>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DiagnosticInput className="input h-8 w-52 py-1" placeholder={referenceT("Patient, MRN, sample, order")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search queue")} />
          <RefSelect entity="departments" className="h-8 w-44 py-1" value={dept} onChange={setDept} placeholder={referenceT("All departments")} />
          <Select className="h-8 w-36 py-1" value={priority} onChange={setPriority} placeholder={referenceT("Any priority")} options={['STAT', 'URGENT', 'ROUTINE']} />
        </div>
      </div>
      <ErrorBanner error={error} onRetry={() => load()} />

      <div className="grid min-h-[calc(100vh-230px)] gap-3 lg:grid-cols-[380px_1fr]">
        {/* Queue */}
        <div className="panel flex max-h-[calc(100vh-230px)] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Checkbox checked={rows.length > 0 && sel.size === signableOnPage.length && sel.size > 0} indeterminate={sel.size > 0 && sel.size < signableOnPage.length}
              onChange={(v) => setSel(new Set(v ? signableOnPage : []))} label={<span className="text-xs text-ink-soft">{sel.size ? `${sel.size} selected` : `${data?.total ?? 0} in this view`}</span>} />
            {isPathologist && sel.size > 0 && <Button size="sm" variant="primary" className="ml-auto" loading={busy} onClick={() => sign([...sel])} title={referenceT("Shift+S")}><ReferenceText message="Sign" /> {sel.size}</Button>}
            {isPathologist && !sel.size && cat === 'normal' && signableOnPage.length > 1 && <Button size="sm" className="ml-auto" onClick={() => setSel(new Set(signableOnPage))}><ReferenceText message="Select all normal" /></Button>}
          </div>
          {loading && !data && <Loading />}
          {data && !rows.length && <Empty icon={<PenLine className="h-6 w-6" />} title={referenceT("Nothing to sign here")}>{cat !== 'all' ? 'Try another category.' : 'Validated reports will appear as technologists complete them.'}</Empty>}
          <ul ref={listRef} className="flex-1 overflow-y-auto" role="listbox" aria-label={referenceT("Reports awaiting signature")}>
            {rows.map((r, i) => {
              const abn = r.results.filter((x: any) => x.flag && x.flag !== 'N');
              return (
                <li key={r.id} data-row={i} role="option" aria-selected={i === cursor} onClick={() => setCursor(i)}
                  className={cx('relative flex cursor-pointer gap-2 border-b border-line py-2 pl-4 pr-3', i === cursor ? 'bg-hema-50' : 'hover:bg-paper')}>
                  <span className={cx('absolute bottom-0 left-0 top-0 w-1', stripe(r))} aria-hidden />
                  <Checkbox className="mt-0.5" checked={sel.has(r.id)} onChange={(v) => setSel((s) => { const n = new Set(s); v ? n.add(r.id) : n.delete(r.id); return n; })} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate font-medium">{fullName(r)}</span><span className="shrink-0 text-2xs text-ink-soft">{r.age} {r.gender}</span><span className="ml-auto shrink-0"><PriorityBadge priority={r.priority} /></span></div>
                    <div className="truncate text-xs text-ink-soft">{r.test_name}{r.report_version > 0 ? ', amendment' : ''}</div>
                    {abn.length > 0 && <div className="mt-0.5 truncate text-2xs">{abn.slice(0, 4).map((x: any) => <span key={x.id} className={cx('mr-2 tnum', flagTextClass(x.flag, x.is_critical))}>{x.code} {x.value} {x.flag}</span>)}</div>}
                    {r.critical_pending > 0 && <div className="mt-0.5 flex items-center gap-1 text-2xs font-medium text-crit"><Siren className="h-3 w-3" /><ReferenceText message="Notify before signing" /></div>}
                  </div>
                </li>
              );
            })}
          </ul>
          {data && data.total > pageSize && <div className="border-t border-line"><Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} /></div>}
        </div>

        {/* Report under review */}
        <div className="panel flex max-h-[calc(100vh-230px)] flex-col overflow-hidden">
          {!cur ? <Empty title={referenceT("Select a report to review")} /> : (
            <>
              <div className={cx('border-b border-line px-5 py-3', cur.is_critical ? 'bg-crit-bg/60' : cur.is_abnormal ? 'bg-high-bg/50' : '')}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link href={`/patients/${cur.patient_id}`} className="text-lg font-semibold hover:underline">{fullName(cur)}</Link>
                  <span className="text-sm text-ink-soft tnum">{cur.mrn}, {age(cur.dob)} {cur.gender}</span>
                  {cur.facility && <Badge>{cur.facility}</Badge>}
                  <span className="ml-auto text-xs text-ink-soft">{cursor + 1} <ReferenceText message="of" /> {rows.length}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{cur.test_name}</span><span className="text-ink-soft">{cur.department}</span>
                  <PriorityBadge priority={cur.priority} />
                  <span className="text-xs text-ink-soft tnum">{cur.sample_no}, {cur.order_no}</span>
                  <span className="text-xs text-ink-soft"><ReferenceText message="validated by" /> {cur.validated_by_name || 'auto-verification'}, {fmtDateTime(cur.validated_at)}</span>
                </div>
                {(cur.diagnosis || cur.clinical_info) && <p className="mt-1 text-sm"><span className="text-ink-soft"><ReferenceText message="Clinical:" /> </span>{[cur.diagnosis, cur.clinical_info].filter(Boolean).join('. ')}</p>}
                {cur.report_version > 0 && <p className="mt-1 text-sm text-high"><ReferenceText message="Amendment of version" /> {cur.report_version}: {cur.amend_reason}</p>}
              </div>
              {cur.critical_pending > 0 && (
                <div className="flex items-center gap-2 border-b border-crit/30 bg-crit-bg px-5 py-2 text-sm text-crit">
                  <Siren className="h-4 w-4" /><span className="flex-1"><ReferenceText message="A critical value has not been phoned through yet. Signing is blocked until it is recorded." /></span>
                  <Button size="sm" variant="danger" onClick={async () => { const c = await get('/critical', { status: 'PENDING', q: cur.order_no }); const n = c.data.find((x: any) => x.order_item_id === cur.id); if (n) setNotify({ n, row: cur }); }}><ReferenceText message="Record notification" /></Button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-5 py-3">
                <DiagnosticTable className="w-full text-sm">
                  <TableHeader><TableRow><TableHead className="th"><ReferenceText message="Parameter" /></TableHead><TableHead className="th text-right"><ReferenceText message="Result" /></TableHead><TableHead className="th"><ReferenceText message="Flag" /></TableHead><TableHead className="th"><ReferenceText message="Unit" /></TableHead><TableHead className="th"><ReferenceText message="Reference" /></TableHead><TableHead className="th text-right"><ReferenceText message="Previous" /></TableHead><TableHead className="th"><ReferenceText message="Source" /></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cur.results.map((x: any) => (
                      <TableRow key={x.id} className={cx(x.is_critical && 'bg-crit-bg/50')}>
                        <TableCell className="td">{x.name}{x.comment && <div className="text-2xs text-ink-soft">{x.comment}</div>}</TableCell>
                        <TableCell className={cx('td text-right tnum', x.result_type === 'MEMO' && 'whitespace-pre-wrap text-left', flagTextClass(x.flag, x.is_critical))}>{x.value}</TableCell>
                        <TableCell className="td"><FlagBadge flag={x.flag} critical={x.is_critical} />{x.delta_flag ? <Badge tone="violet" title={referenceT("Change from previous exceeds the delta limit")}>Δ</Badge> : null}</TableCell>
                        <TableCell className="td text-ink-soft">{x.unit}</TableCell><TableCell className="td text-ink-soft tnum">{x.ref_text}</TableCell>
                        <TableCell className="td text-right tnum text-ink-soft" title={fmtDateTime(x.prev_at)}>{x.prev_value ?? '–'}</TableCell>
                        <TableCell className="td text-2xs text-ink-faint">{titleCase(x.source)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DiagnosticTable>
                <label htmlFor="sign-interp" className="mb-1 mt-4 block text-xs font-medium text-ink-soft"><ReferenceText message="Interpretation (printed on the report)" /></label>
                <DiagnosticTextarea id="sign-interp" rows={3} disabled={!isPathologist} className="input" value={interp[cur.id] ?? ''} onChange={(e) => setInterp({ ...interp, [cur.id]: e.target.value })} />
                <div className="mt-2 flex gap-3 text-xs"><Link className="link" href={`/results/sample/${cur.sample_id}`}><ReferenceText message="Open in result entry" /></Link><Link className="link" href={`/patients/${cur.patient_id}`}><ReferenceText message="Patient history" /></Link></div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/70 px-5 py-2.5">
                <span className="hidden items-center gap-1.5 text-2xs text-ink-faint xl:flex"><Kbd><ReferenceText message="J" /></Kbd><Kbd><ReferenceText message="K" /></Kbd> <ReferenceText message="move" /> <Kbd><ReferenceText message="S" /></Kbd> <ReferenceText message="sign" /> <Kbd><ReferenceText message="X" /></Kbd> <ReferenceText message="select" /> <Kbd><ReferenceText message="Shift S" /></Kbd> <ReferenceText message="sign selected" /> <Kbd><ReferenceText message="B" /></Kbd> <ReferenceText message="send back" /></span>
                <div className="ml-auto flex gap-2">
                  <Button onClick={() => setCursor((c) => Math.min(rows.length - 1, c + 1))} disabled={cursor >= rows.length - 1}><ReferenceText message="Skip" /></Button>
                  {isPathologist && <Button variant="danger" icon={<CornerUpLeft className="h-4 w-4" />} onClick={() => setSendBack(cur)}><ReferenceText message="Send back" /></Button>}
                  {isPathologist && <Button variant="primary" loading={busy} disabled={cur.critical_pending > 0} icon={<PenLine className="h-4 w-4" />} onClick={() => sign([cur.id])}><ReferenceText message="Sign and next" /></Button>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <PromptModal open={!!sendBack} onClose={() => setSendBack(null)} title={referenceT("Send back {value0}", {value0: sendBack?.test_name || ''})} label={referenceT("What should be rechecked?")} confirmText="Send back to bench" variant="danger"
        onConfirm={async (reason) => { await post('/results/send-back', { itemId: sendBack.id, reason }); toast.ok('Sent back to the technologist.'); await load(true); }} />
      {notify && <CriticalNotifyModal open notification={notify.n} onClose={() => setNotify(null)} onDone={() => { toast.ok('Notification recorded. The report can now be signed.'); load(true); }}
        context={<p className="mb-3 text-sm">{fullName(notify.row)}: <b className="text-crit">{notify.n.parameter} {notify.n.value} {notify.n.unit}</b>{notify.n.doctor ? `. Ordering doctor ${notify.n.doctor}${notify.n.doctor_phone ? `, ${notify.n.doctor_phone}` : ''}` : ''}{notify.n.location ? `, ${notify.n.location}` : ''}</p>} />}
    </>
  );
}
