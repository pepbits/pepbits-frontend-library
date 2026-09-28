'use client';
import { useRouter, cx, daysBetween, todayISO, useFormat, useEntityApi, Avatar, Button, Input, Progress, StatusBadge, Textarea, useToast, missingRequired, RecordForm, useAuth, type Row, approverAt } from '@pepbits/reference-keystone-core';
import { Table } from '@pepbits/ops-ui';
import { useCallback, useEffect, useState } from 'react';
import { Check, CircleCheck, CircleX, PauseCircle, Pencil, Save, Send, Undo2, X } from 'lucide-react';
import { nounOf, pagePath, recordPath } from '../../lib/registry';
import { usePageTitle } from '../shell/pageTitle';
import { Page, RecordBar, RecordLoading, Section, useRecord, useSaveShortcut, useUnsavedGuard, type RecordProps } from './RecordShell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* ═════════════════ Requests (leave, expenses) ═════════════════ */
type StepState = 'done' | 'current' | 'waiting' | 'rejected' | 'withdrawn';
function trail(steps: string[], status: string): StepState[] {
  return steps.map((_, i) => {
    if (status === 'Paid') return 'done';
    if (status === 'Approved') return steps.length > 3 && i === steps.length - 1 ? 'current' : 'done';
    if (status === 'Rejected') return i === 0 ? 'done' : i === 1 ? 'rejected' : 'waiting';
    if (status === 'Withdrawn') return i === 0 ? 'withdrawn' : 'waiting';
    return i === 0 ? 'done' : i === 1 ? 'current' : 'waiting';
  });
}

export function RequestRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency, fmtDate, fmtNumber } = useFormat();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { row, loading, error, reload } = useRecord(def, id);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [errors, setErrors] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { if (row) setDraft(row); }, [row]);
  const noun = nounOf(def);
  const editing = mode !== 'view';
  const formFields = def.fields.filter((f) => !['code', 'status', 'days', 'employee'].includes(f.key));
  const days = draft.from && draft.to ? Math.max(0, daysBetween(String(draft.from), String(draft.to)) + 1) : 0;
  const money = (def.balances?.[0]?.total ?? 0) > 100;
  const dirty = editing && Object.keys(draft).length > 0 && JSON.stringify(draft) !== JSON.stringify(row ?? {});
  useUnsavedGuard(dirty);
  usePageTitle(mode === 'new' ? (def.entity === 'leave-requests' ? 'Apply for leave' : `New ${noun}`) : row ? `${row.code}` : '');

  const submit = useCallback(async () => {
    const miss = missingRequired(formFields, draft);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    if (draft.from && draft.to && String(draft.to) < String(draft.from)) { toast(referenceT("The end date is before the start date"), 'danger'); return; }
    setBusy('save');
    try {
      const body = { ...draft, employee: draft.employee ?? user?.name ?? 'You', status: 'Pending', ...(draft.from ? { days } : {}) };
      const saved = mode === 'new' ? await entityApi.create(def.entity, body) : await entityApi.update(def.entity, id!, body);
      toast(referenceT("{value0} {value1}", {value0: saved.code, value1: mode === 'new' ? 'submitted for approval' : 'updated'}));
      router.replace(recordPath(def, saved.id));
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  }, [formFields, draft, days, user, mode, def, id, router, toast]);
  useSaveShortcut(editing ? submit : null);

  const decide = async (status: string) => {
    setBusy(status);
    await entityApi.update(def.entity, id!, { status, lastComment: note });
    toast(referenceT("{value0} {value1}", {value0: row?.code, value1: referenceT(status)}));
    setBusy(null);
    setNote('');
    reload();
  };

  if (mode !== 'new' && (loading || error || !row)) return <RecordLoading error={error} onRetry={reload} />;

  if (editing) {
    return (
      <>
        <RecordBar def={def} id={id} mode={mode} dirty={dirty}>
          <Button icon={X} onClick={() => router.push(mode === 'new' ? pagePath(def) : recordPath(def, id!))}><ReferenceText message="Cancel" /></Button>
          <Button variant="primary" icon={Send} loading={busy === 'save'} onClick={submit}>{mode === 'new' ? referenceT("Submit for approval") : referenceT("Save and resubmit")}</Button>
        </RecordBar>
        <Page>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <Section title={referenceT("Request details")} description={referenceT("Your manager is notified as soon as you submit.")}>
                <RecordForm fields={formFields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} columns={2} showErrors={errors} />
                {'from' in draft || def.entity === 'leave-requests' ? (
                  <div className="mt-4 rounded-lg bg-brand-soft px-3.5 py-2.5 text-[length:calc(13px*var(--fs-scale))] text-brand-ink">
                    {days ? referenceT(days === 1 ? "{count} day requested, {from} to {to}" : "{count} days requested, {from} to {to}", { count: days, from: fmtDate(draft.from), to: fmtDate(draft.to) }) : referenceT("Pick both dates to see the number of days.")}
                  </div>
                ) : null}
              </Section>
            </div>
            <aside className="space-y-4">
              {def.balances && (
                <Section title={referenceT("Your balances")} bodyClass="p-4 space-y-3">
                  {def.balances.map((b) => {
                    const pct = (b.used / b.total) * 100;
                    const selected = draft.leaveType === b.label || draft.category === b.label.replace(' budget', '');
                    return (
                      <div key={b.label} className={cx('rounded-md', selected && 'bg-accent-soft -mx-2 px-2 py-1')}>
                        <div className="flex justify-between text-[length:calc(12.5px*var(--fs-scale))]"><span><ReferenceText message={b.label} /></span><span className="font-medium tnum">{money ? fmtCurrency(b.total - b.used) : b.total - b.used} <ReferenceText message="left" /></span></div>
                        <Progress value={pct} tone={pct > 80 ? 'danger' : pct > 55 ? 'warn' : 'brand'} className="mt-1" />
                      </div>
                    );
                  })}
                </Section>
              )}
              <Section title={referenceT("Approval route")} bodyClass="p-4">
                <ol className="space-y-2 text-[length:calc(13px*var(--fs-scale))]">
                  {(def.steps ?? []).map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 text-[length:calc(11px*var(--fs-scale))] font-semibold text-ink-3">{i + 1}</span>
                      <span className="flex-1"><ReferenceText message={s} /></span>
                      <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{i === 0 ? referenceT("You") : approverAt(def, i)}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </aside>
          </div>
        </Page>
      </>
    );
  }

  const r = row!;
  const states = trail(def.steps ?? [], String(r.status));
  return (
    <>
      <RecordBar def={def} id={id} mode={mode}>
        {r.status === 'Pending' && <Button icon={Undo2} loading={busy === 'Withdrawn'} onClick={() => decide('Withdrawn')}><ReferenceText message="Withdraw" /></Button>}
        {r.status === 'Pending' && <Button icon={Pencil} onClick={() => router.push(recordPath(def, id!, true))}><ReferenceText message="Edit" /></Button>}
      </RecordBar>
      <Page>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5">
          <Avatar name={r.employee} size={52} className="text-[length:calc(17px*var(--fs-scale))]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[length:calc(16px*var(--fs-scale))] font-semibold">{r.employee}</span><StatusBadge value={r.status} /></div>
            <div className="text-[length:calc(13px*var(--fs-scale))] text-ink-3">{r.leaveType ?? r.category}{r.from ? `, ${fmtDate(r.from)} to ${fmtDate(r.to)}` : r.date ? `, ${fmtDate(r.date)}` : ''}</div>
          </div>
          <div className="text-right">
            <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{r.days ? referenceT("Duration") : referenceT("Amount")}</div>
            <div className="text-[length:calc(24px*var(--fs-scale))] font-semibold tracking-tight tnum">{r.days ? referenceT(r.days === 1 ? "{count} day" : "{count} days", { count: fmtNumber(r.days) }) : fmtCurrency(r.amount)}</div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Section title={referenceT("Details")}>
            <RecordForm fields={formFields} value={r} onChange={() => {}} readOnly columns={2} />
          </Section>
          <div className="space-y-4">
            <Section title={referenceT("Approval trail")} bodyClass="p-4">
              <ol className="relative ml-2 border-l border-line pl-5">
                {(def.steps ?? []).map((s, i) => {
                  const st = states[i];
                  return (
                    <li key={s} className="relative pb-4 last:pb-0">
                      <span className={cx('absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface', st === 'done' ? 'bg-brand' : st === 'current' ? 'bg-accent' : st === 'rejected' || st === 'withdrawn' ? 'bg-danger' : 'bg-line-strong')} />
                      <div className="flex items-center justify-between gap-2"><span className="text-[length:calc(13px*var(--fs-scale))] font-medium"><ReferenceText message={s} /></span><span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{st === 'done' ? referenceT('Done') : st === 'current' ? referenceT("Waiting now") : st === 'rejected' ? referenceT("Rejected") : st === 'withdrawn' ? referenceT("Withdrawn") : referenceT("Not started")}</span></div>
                      <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{i === 0 ? r.employee : approverAt(def, i)}</div>
                    </li>
                  );
                })}
              </ol>
            </Section>
            {r.status === 'Pending' && (
              <Section title={referenceT("Your decision")} bodyClass="p-4 space-y-2.5">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={referenceT("Note to the requester (optional)")} rows={2} />
                <div className="flex gap-2">
                  <Button variant="danger" icon={CircleX} loading={busy === 'Rejected'} onClick={() => decide('Rejected')} className="flex-1"><ReferenceText message="Reject" /></Button>
                  <Button variant="primary" icon={Check} loading={busy === 'Approved'} onClick={() => decide('Approved')} className="flex-1"><ReferenceText message="Approve" /></Button>
                </div>
              </Section>
            )}
          </div>
        </div>
      </Page>
    </>
  );
}

/* ═════════════════ Inspection sheet ═════════════════ */
type Check_ = { parameter: string; spec: string; observed: string; result: string; remarks: string };
const RESULT_STYLE: Record<string, string> = { Pass: 'bg-ok text-white border-ok', Fail: 'bg-danger text-white border-danger', NA: 'bg-ink-3 text-white border-ink-3' };

export function ChecklistRecord({ def, id, mode }: RecordProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtValue } = useFormat();
  const toast = useToast();
  const router = useRouter();
  const { row, loading, error, reload } = useRecord(def, id);
  const [checks, setChecks] = useState<Check_[]>([]);
  const [head, setHead] = useState<Partial<Row>>({ status: 'Pending', date: todayISO() });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (row) { setChecks(((row.checks as Check_[]) ?? []).map((c) => ({ ...c }))); setHead(row); setDirty(false); }
    else if (mode === 'new') setChecks((def.checks ?? []).map((c) => ({ ...c, observed: '', result: '', remarks: '' })));
  }, [row, mode, def.checks]);
  useUnsavedGuard(dirty);
  usePageTitle(mode === 'new' ? 'New inspection' : row ? String(row.code) : '');

  const set = (i: number, patch: Partial<Check_>) => { setChecks((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c))); setDirty(true); };
  const done = checks.filter((c) => c.result).length;
  const fails = checks.filter((c) => c.result === 'Fail').length;
  const passes = checks.filter((c) => c.result === 'Pass').length;
  const complete = checks.length > 0 && done === checks.length;
  const locked = head.status === 'Passed' || head.status === 'Failed';
  const verdict = !complete ? referenceT(checks.length - done === 1 ? "{count} parameter still to check" : "{count} parameters still to check", { count: checks.length - done }) : fails ? referenceT(fails === 1 ? "{count} parameter out of spec. Reject or hold for rework." : "{count} parameters out of spec. Reject or hold for rework.", { count: fails }) : referenceT("Every parameter is within spec. Ready to accept.");

  const persist = useCallback(async (status?: string) => {
    setBusy(status ?? 'save');
    try {
      const body = { ...head, checks, ...(status ? { status } : {}) };
      const saved = mode === 'new' ? await entityApi.create(def.entity, body) : await entityApi.update(def.entity, id!, body);
      toast(status ? referenceT('{record} marked {status}', {record: saved.code, status: referenceT(status)}) : referenceT('Results saved'));
      setDirty(false);
      if (mode === 'new') router.replace(recordPath(def, saved.id)); else reload();
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  }, [head, checks, mode, def, id, router, reload, toast]);
  useSaveShortcut(!locked ? () => persist() : null);

  if (mode !== 'new' && (loading || error || !row)) return <RecordLoading error={error} onRetry={reload} />;
  const meta = def.fields.filter((f) => !['code', 'status'].includes(f.key));

  return (
    <>
      <RecordBar def={def} id={id} mode={mode === 'edit' ? 'view' : mode} dirty={dirty}>
        {!locked && (
          <>
            <Button icon={Save} disabled={!dirty && mode !== 'new'} loading={busy === 'save'} onClick={() => persist()}><ReferenceText message="Save" /></Button>
            <Button icon={PauseCircle} loading={busy === 'On hold'} onClick={() => persist('On hold')} className="hidden sm:inline-flex"><ReferenceText message="Hold" /></Button>
            <Button variant="danger" icon={CircleX} disabled={!complete || !fails} loading={busy === 'Failed'} onClick={() => persist('Failed')}><ReferenceText message="Reject" /></Button>
            <Button variant="primary" icon={CircleCheck} disabled={!complete || fails > 0} loading={busy === 'Passed'} onClick={() => persist('Passed')}><ReferenceText message="Accept" /></Button>
          </>
        )}
      </RecordBar>
      <Page>
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{mode === 'new' ? referenceT("New inspection") : String(head.code)}</span>
            <StatusBadge value={head.status} />
            <span className="flex-1" />
            <span className={cx('text-[length:calc(12.5px*var(--fs-scale))]', !complete ? 'text-ink-3' : fails ? 'text-danger' : 'text-ok')}>{locked ? `Closed as ${String(head.status).toLowerCase()}` : verdict}</span>
          </div>
          {mode === 'new' ? (
            <RecordForm fields={meta} value={head} onChange={(k, v) => { setHead((h) => ({ ...h, [k]: v })); setDirty(true); }} columns={4} compact />
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
              {meta.map((f) => <div key={f.key}><dt className="text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message={f.label} /></dt><dd className="truncate text-[length:calc(13.5px*var(--fs-scale))] font-medium">{fmtValue(f, head[f.key])}</dd></div>)}
            </dl>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Progress value={(done / Math.max(1, checks.length)) * 100} tone={fails ? 'danger' : complete ? 'ok' : 'brand'} className="flex-1" />
            <span className="whitespace-nowrap text-[length:calc(12.5px*var(--fs-scale))] text-ink-2 tnum">{done}/{checks.length} <ReferenceText message="checked," /> {passes} <ReferenceText message="pass," /> {fails} <ReferenceText message="fail" /></span>
          </div>
        </div>
        <Section title={referenceT("Inspection parameters")} description={locked ? undefined : 'Mark every parameter. Accept unlocks when all pass.'} bodyClass="overflow-x-auto">
          <Table className="w-full min-w-[720px] text-[length:calc(13px*var(--fs-scale))]">
            <thead className="bg-surface-2 text-left text-[length:calc(12px*var(--fs-scale))] text-ink-2">
              <tr><th className="w-10 px-4 py-2 font-medium">#</th><th className="px-2 py-2 font-medium"><ReferenceText message="Parameter" /></th><th className="w-44 px-2 py-2 font-medium"><ReferenceText message="Observed" /></th><th className="w-48 px-2 py-2 font-medium"><ReferenceText message="Result" /></th><th className="w-56 px-2 py-2 pr-4 font-medium"><ReferenceText message="Remarks" /></th></tr>
            </thead>
            <tbody>
              {checks.map((c, i) => (
                <tr key={c.parameter} className={cx('border-t border-line', c.result === 'Fail' && 'bg-danger-soft/40')}>
                  <td className="px-4 py-2.5 text-ink-3 tnum">{i + 1}</td>
                  <td className="px-2 py-2.5"><div className="font-medium">{c.parameter}</div><div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{c.spec}</div></td>
                  <td className="px-2 py-2.5"><Input value={c.observed} readOnly={locked} onChange={(e) => set(i, { observed: e.target.value })} className="h-7 text-[length:calc(12.5px*var(--fs-scale))]" placeholder={referenceT("Reading")} /></td>
                  <td className="px-2 py-2.5">
                    <div className="inline-flex overflow-hidden rounded-md border border-line">
                      {['Pass', 'Fail', 'NA'].map((res) => (
                        <button key={res} disabled={locked} onClick={() => set(i, { result: c.result === res ? '' : res, observed: c.observed || (res === 'Pass' ? 'Within spec' : res === 'Fail' ? 'Out of spec' : '') })} className={cx('h-7 w-14 border-l border-line text-[length:calc(12px*var(--fs-scale))] font-medium first:border-l-0 disabled:cursor-not-allowed', c.result === res ? RESULT_STYLE[res] : 'bg-surface text-ink-2 hover:bg-surface-3')}>{res === 'NA' ? referenceT("N/A") : res}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 pr-4"><Input value={c.remarks} readOnly={locked} onChange={(e) => set(i, { remarks: e.target.value })} className="h-7 text-[length:calc(12.5px*var(--fs-scale))]" placeholder={referenceT("Optional")} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>
      </Page>
    </>
  );
}
