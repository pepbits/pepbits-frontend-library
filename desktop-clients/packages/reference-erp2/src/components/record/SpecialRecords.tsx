'use client';
import { RecordDocuments, useShortcutsEnabled, useRouter, cx, daysBetween, todayISO, useFormat, useEntityApi, APP, Avatar, Badge, Button, Checkbox, IconButton, Kbd, Progress, Segmented, StatusBadge, Textarea, useToast, PrintTable, RecordForm, lineTotals, LogoMark, useAuth, type PageDef, type Row, type Line, KeystoneInvoice, CompanyGate, useCompanyProfile, useProcessRunner, playProcessEvents, type ProcessRunResult, useEntitySupport, ErrorNote } from '@pepbits/reference-keystone-core';
import { useReducedMotion } from '@pepbits/reference-keystone-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, CircleX, FileText, LoaderCircle, Play, Printer, ZoomIn, ZoomOut } from 'lucide-react';
import { ownerDef, pagePath, recordPath } from '../../lib/registry';
import { usePageTitle } from '../shell/pageTitle';
import { Page, RecordBar, RecordLoading, Section, StatStrip, useNeighbours, useRecord, type RecordProps } from './RecordShell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* ═════════════════ Print preview ═════════════════ */
const A4_W = 794;

export function PrintRecord({ def, id }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  // Printing waits for the server company profile (no invented identity on paper).
  const companyReady = useCompanyProfile().status === 'ready';
  const entityApi = useEntityApi();
  const source = ownerDef(def.entity) ?? def;
  const { row, loading, error, reload } = useRecord(source, id);
  const [customer, setCustomer] = useState<Row | null>(null);
  const [copy, setCopy] = useState<'Original' | 'Duplicate'>('Original');
  const [terms, setTerms] = useState(true);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  usePageTitle(row ? `Print ${row.code}` : null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.min(1, (el.clientWidth - 48) / A4_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [row]);
  useEffect(() => {
    if (!row?.customer) return;
    entityApi.list('customers', { q: String(row.customer), size: 1 }).then((r) => setCustomer(r.rows[0] ?? null)).catch(() => {});
  }, [row]);
  if (loading || error || !row) return <RecordLoading error={error} onRetry={reload} />;
  const scale = Math.max(0.3, fit + zoom);
  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <RecordBar def={def} id={id} mode="view">
        <Segmented size="sm" value={copy} onChange={setCopy} options={[{ value: 'Original', label: 'Original' }, { value: 'Duplicate', label: 'Duplicate' }]} />
        <Checkbox checked={terms} onChange={setTerms} label={referenceT("Terms")} className="mx-1" />
        <IconButton icon={ZoomOut} label={referenceT("Zoom out")} onClick={() => setZoom((z) => z - 0.1)} />
        <span className="w-10 text-center text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{Math.round(scale * 100)}%</span>
        <IconButton icon={ZoomIn} label={referenceT("Zoom in")} onClick={() => setZoom((z) => z + 0.1)} />
        <Button variant="primary" icon={Printer} disabled={!companyReady} onClick={() => window.print()}><ReferenceText message="Print or save PDF" /></Button>
      </RecordBar>
      <div ref={box} className="min-h-0 flex-1 overflow-auto bg-surface-3 p-6">
        <div style={{ width: A4_W * scale, height: 1123 * scale }} className="print-reset mx-auto">
          <div className="print-reset" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <CompanyGate>{(company) => <KeystoneInvoice row={row} customer={customer} copy={copy} showTerms={terms} company={company} />}</CompanyGate>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════ Approval decision ═════════════════ */
export function InboxRecord({ def, id }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency, fmtDate } = useFormat();
  const router = useRouter();
  const toast = useToast();
  const { row, loading, error, reload } = useRecord(def, id);
  const nb = useNeighbours(def, id);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  usePageTitle(row ? `${row.type} from ${row.requester}` : null);

  const decide = useCallback(async (status: string) => {
    if (!row || row.status !== 'Pending') return;
    setBusy(status);
    await entityApi.update(def.entity, row.id, { status, decisionNote: note });
    toast(referenceT("{value0} {value1}", {value0: row.code, value1: referenceT(status)}));
    setBusy(null);
    setNote('');
    if (nb.next) router.push(recordPath(def, nb.next)); else router.push(pagePath(def));
  }, [row, def, note, nb.next, router, toast]);

  const shortcuts = useShortcutsEnabled();
  useEffect(() => {
    if (!shortcuts) return;
    const h = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || e.ctrlKey || e.metaKey) return;
      if (e.key === 'j' && nb.next) router.push(recordPath(def, nb.next));
      if (e.key === 'k' && nb.prev) router.push(recordPath(def, nb.prev));
      if (e.key === 'a') decide('Approved');
      if (e.key === 'r') decide('Rejected');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [shortcuts, nb, def, router, decide]);

  if (loading || error || !row) return <RecordLoading error={error} onRetry={reload} />;
  const overdue = row.status === 'Pending' && row.due < todayISO();
  return (
    <>
      <RecordBar def={def} id={id} mode="view">
        {row.status === 'Pending' ? (
          <>
            <span className="hidden text-[length:calc(12px*var(--fs-scale))] text-ink-3 md:inline"><Kbd><ReferenceText message="J" /></Kbd> <Kbd><ReferenceText message="K" /></Kbd> <ReferenceText message="move," /> <Kbd><ReferenceText message="A" /></Kbd> <ReferenceText message="approve," /> <Kbd><ReferenceText message="R" /></Kbd> <ReferenceText message="reject" /></span>
            <Button variant="danger" icon={CircleX} loading={busy === 'Rejected'} onClick={() => decide('Rejected')}><ReferenceText message="Reject" /></Button>
            <Button variant="primary" icon={Check} loading={busy === 'Approved'} onClick={() => decide('Approved')}><ReferenceText message="Approve" /></Button>
          </>
        ) : <StatusBadge value={row.status} />}
      </RecordBar>
      <Page>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5">
          <Avatar name={row.requester} size={52} className="text-[length:calc(17px*var(--fs-scale))]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[length:calc(13px*var(--fs-scale))] font-semibold text-brand-ink tnum">{row.code}</span><Badge tone="brand">{row.type}</Badge>{row.priority !== 'Normal' && <Badge tone={row.priority === 'Urgent' ? 'danger' : 'warn'}>{row.priority}</Badge>}</div>
            <div className="mt-0.5 text-[length:calc(13px*var(--fs-scale))] text-ink-3">{row.requester}, {row.department}</div>
          </div>
          <div className="text-right">
            <div className="text-[length:calc(26px*var(--fs-scale))] font-semibold tracking-tight tnum">{row.type === 'Leave' ? referenceT(row.days === 1 ? "{count} day" : "{count} days", { count: row.days }) : fmtCurrency(row.amount)}</div>
            <div className={cx('text-[length:calc(12.5px*var(--fs-scale))]', overdue ? 'font-medium text-danger' : 'text-ink-3')}>{overdue ? referenceT(daysBetween(row.due, todayISO()) === 1 ? "Overdue by {count} day" : "Overdue by {count} days", { count: daysBetween(row.due, todayISO()) }) : referenceT("Due {date}", { date: fmtDate(row.due) })}</div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Section title={referenceT("Request")}><p className="max-w-prose text-[length:calc(14px*var(--fs-scale))] leading-relaxed text-ink-2">{row.summary}</p></Section>
            <Section title={referenceT("Attachments")} bodyClass="p-0">
              <RecordDocuments entity={def.entity} id={row.id} compact includeLocalAttachments={false} />
            </Section>
          </div>
          <div className="space-y-4">
            <Section title={referenceT("Route")} bodyClass="p-4">
              <ol className="space-y-2.5 text-[length:calc(13px*var(--fs-scale))]">
                {[[row.requester, 'Submitted', 'done'], ['You', row.status === 'Pending' ? 'Waiting on you' : row.status, row.status === 'Pending' ? 'current' : 'done'], ['Finance controller', 'Next', 'waiting']].map(([who, what, st]) => (
                  <li key={who} className="flex items-center gap-2.5">
                    <span className={cx('h-2.5 w-2.5 rounded-full', st === 'done' ? 'bg-brand' : st === 'current' ? 'bg-accent' : 'bg-line-strong')} />
                    <span className="flex-1">{who}</span><span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{what}</span>
                  </li>
                ))}
              </ol>
            </Section>
            {row.status === 'Pending' && (
              <Section title={referenceT("Note to requester")} bodyClass="p-4">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={referenceT("Optional. Sent with your decision.")} rows={3} />
              </Section>
            )}
            <StatStrip items={[{ label: 'Submitted', value: fmtDate(row.submitted, false) }, { label: 'Due', value: fmtDate(row.due, false) }]} />
          </div>
        </div>
      </Page>
    </>
  );
}

/* ═════════════════ Batch process ═════════════════ */
type StepState = 'idle' | 'running' | 'done' | 'warn';

function RunLog({ lines }: { lines: { t: string; text: string; warn?: boolean }[] }) {
  const reducedMotion = useReducedMotion();
 const referenceT = useReferenceLocalization().t;

  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' }); }, [lines, reducedMotion]);
  return (
    <ol ref={ref} className="h-56 overflow-y-auto rounded-lg bg-rail p-3 text-[length:calc(12px*var(--fs-scale))] leading-5 text-rail-ink">
      {!lines.length && <li className="text-rail-ink-2"><ReferenceText message="The run log appears here once you start." /></li>}
      {lines.map((l, i) => <li key={i} className={l.warn ? 'text-accent' : ''}><span className="text-rail-ink-2 tnum">{l.t}</span> {l.text}</li>)}
    </ol>
  );
}
function Steps({ steps, states }: { steps: string[]; states: StepState[] }) {
 const referenceT = useReferenceLocalization().t;

  return (
    <ol className="space-y-1">
      {steps.map((s, i) => {
        const st = states[i];
        return (
          <li key={s} className={cx('flex items-center gap-3 rounded-md px-2.5 py-2 text-[length:calc(13px*var(--fs-scale))]', st === 'running' && 'bg-accent-soft')}>
            <span className={cx('grid h-6 w-6 place-items-center rounded-full text-[length:calc(11px*var(--fs-scale))] font-semibold', st === 'done' ? 'bg-brand text-white' : st === 'warn' ? 'bg-warn text-white' : st === 'running' ? 'text-warn' : 'bg-surface-3 text-ink-3')}>
              {st === 'done' ? <Check size={13} strokeWidth={3} /> : st === 'warn' ? <CircleAlert size={13} /> : st === 'running' ? <LoaderCircle size={17} className="animate-spin" /> : i + 1}
            </span>
            <span className={cx('flex-1', st === 'idle' ? 'text-ink-3' : 'text-ink')}>{s}</span>
            {st === 'warn' && <span className="text-[length:calc(12px*var(--fs-scale))] text-warn"><ReferenceText message="Needs review" /></span>}
            {st === 'done' && <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Done" /></span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ProcessRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCompact, fmtDate, fmtTime } = useFormat();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const steps = def.steps ?? [];
  const support = useEntitySupport(def.entity, mode === 'view' ? id : undefined);
  const { row, loading, error, reload } = useRecord(def, mode === 'view' ? id : undefined);
  const [params, setParams] = useState<Partial<Row>>(() => Object.fromEntries((def.params ?? []).map((f) => [f.key, f.options?.[0] ?? (f.type === 'boolean' ? true : f.type === 'date' ? todayISO(5) : '')])));
  const [states, setStates] = useState<StepState[]>(steps.map(() => 'idle'));
  const [log, setLog] = useState<{ t: string; text: string; warn?: boolean }[]>([]);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  usePageTitle(mode === 'new' ? `New ${def.title.toLowerCase()}` : row ? `${row.code}, ${row.period}` : null);
  const stamp = () => fmtTime(new Date(), true);

  const runProcess = useProcessRunner(def.entity);
  const run = async () => {
    setRunning(true);
    setStates(steps.map(() => 'idle'));
    setLog([{ t: stamp(), text: `Started for ${params.period ?? 'the period'}` }]);
    let result: ProcessRunResult;
    try {
      result = await runProcess(params);
    } catch (err) {
      const message = (err as Error).message || 'The run could not be started';
      setLog((l) => [...l, { t: stamp(), text: `Run failed: ${message}`, warn: true }]);
      setRunning(false);
      toast(message, 'danger');
      return;
    }
    const saved = result.row;
    const took = playProcessEvents(result.events, steps.length, { setStates, setLog, timers: timers.current });
    timers.current.push(setTimeout(() => {
      setStates((st) => st.map((x) => (x === 'running' ? 'done' : x)));
      setLog((l) => [...l, { t: stamp(), text: `Finished. Saved as ${saved.code}.` }]);
      setRunning(false);
      toast(referenceT("{value0} completed", {value0: saved.code}));
      timers.current.push(setTimeout(() => router.replace(recordPath(def, saved.id)), 900));
    }, took + 200));
  };


  if (mode === 'view' && (loading || error || !row)) return <RecordLoading error={error} onRetry={reload} />;

  if (mode === 'view' && row) {
    const statsFields = def.fields.filter((f) => f.type === 'number' || f.type === 'currency');
    const ok = row.status === 'Completed';
    return (
      <>
        <RecordBar def={def} id={id} mode="view">
          <Button variant="primary" icon={Play} onClick={() => router.push(`${pagePath(def)}/new`)}><ReferenceText message="Start new run" /></Button>
        </RecordBar>
        <Page>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5">
            <div className={cx('grid h-12 w-12 place-items-center rounded-xl', ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>{ok ? <Check size={22} /> : <CircleAlert size={22} />}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="text-[length:calc(16px*var(--fs-scale))] font-semibold">{row.period}</span><StatusBadge value={row.status} /></div>
              <div className="text-[length:calc(13px*var(--fs-scale))] text-ink-3"><ReferenceText message="Run" /> {row.code} <ReferenceText message="by" /> {row.runBy} <ReferenceText message="on" /> {fmtDate(row.runAt)}</div>
            </div>
            <div className="min-w-[320px] flex-1"><StatStrip items={statsFields.map((f) => ({ label: f.label, value: f.type === 'currency' ? fmtCompact(row[f.key]) : String(row[f.key] ?? '—') }))} /></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title={referenceT("Steps")} bodyClass="p-3"><Steps steps={steps} states={steps.map((_, index) => { const events = support.data?.processEvents?.filter((event) => event.step === index) ?? []; return events.some((event) => event.tone === 'warn' || event.tone === 'danger') ? 'warn' : events.some((event) => event.progress === undefined || event.progress >= 100) ? 'done' : 'idle'; })} /></Section>
            <Section title={referenceT("Run log")} bodyClass="p-3">
              {support.status === 'error' ? <ErrorNote message={support.error ?? 'Run history could not be loaded'} onRetry={support.retry} /> : !support.data ? <p aria-busy="true"><ReferenceText message="Loading run history…" /></p> : <RunLog lines={(support.data.processEvents ?? []).map((event) => ({ t: event.time, text: event.text, warn: event.tone === 'warn' || event.tone === 'danger' }))} />}
            </Section>
          </div>
          <Section title={referenceT("Run details")}><RecordForm fields={def.fields.filter((f) => f.type !== 'code')} value={row} onChange={() => {}} readOnly columns={4} /></Section>
        </Page>
      </>
    );
  }

  const doneCount = states.filter((s) => s === 'done' || s === 'warn').length;
  return (
    <>
      <RecordBar def={def} mode="new">
        <Button onClick={() => router.push(pagePath(def))} disabled={running}><ReferenceText message="Cancel" /></Button>
        <Button variant="primary" icon={Play} loading={running} onClick={run}>{running ? referenceT("Running") : referenceT("Start run")}</Button>
      </RecordBar>
      <Page>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Section title={referenceT("Parameters")} description={referenceT("Check these before starting. They cannot change while the run is in progress.")}>
            <RecordForm fields={def.params ?? []} value={params} onChange={(k, v) => setParams((p) => ({ ...p, [k]: v }))} readOnly={running} columns={2} />
          </Section>
          <Section title={referenceT("Progress")} description={referenceT("{value0} of {value1} steps", {value0: doneCount, value1: steps.length})} bodyClass="p-4 space-y-3">
            <Progress value={(doneCount / Math.max(1, steps.length)) * 100} tone={states.includes('warn') ? 'warn' : 'brand'} />
            <Steps steps={steps} states={states} />
          </Section>
        </div>
        <Section title={referenceT("Run log")} bodyClass="p-3"><RunLog lines={log} /></Section>
      </Page>
    </>
  );
}

export type { PageDef };
