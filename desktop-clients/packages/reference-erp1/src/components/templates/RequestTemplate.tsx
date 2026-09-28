'use client';
import { cx, daysBetween, todayISO, useFormat, useEntityApi, Avatar, Button, Drawer, Progress, StatusBadge, Textarea, useToast, missingRequired, RecordForm, WorkList, useAuth, Card, Frame, nounOf, type PageDef, type Row, approverAt } from '@pepbits/reference-keystone-core';
import { useMemo, useState } from 'react';
import { Check, CircleX, Send, Undo2, X } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type StepState = 'done' | 'current' | 'waiting' | 'rejected' | 'withdrawn';

function trail(steps: string[], status: string): StepState[] {
  return steps.map((_, i) => {
    if (status === 'Approved' || status === 'Paid') return status === 'Approved' && i === steps.length - 1 && steps.length > 3 ? 'current' : 'done';
    if (status === 'Rejected') return i === 0 ? 'done' : i === 1 ? 'rejected' : 'waiting';
    if (status === 'Withdrawn') return i === 0 ? 'withdrawn' : 'waiting';
    return i === 0 ? 'done' : i === 1 ? 'current' : 'waiting';
  });
}


function RequestDetail({ def, row, onDone }: { def: PageDef; row: Row; onDone: (msg: string) => void }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency, fmtDate } = useFormat();
  const toast = useToast();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const states = trail(def.steps ?? [], String(row.status));
  const act = async (status: string, label: string) => {
    setBusy(status);
    try {
      await entityApi.update(def.entity, row.id, { status, lastComment: comment });
      onDone(`${row.code} ${label}`);
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(null); }
  };
  const fields = def.fields.filter((f) => f.type !== 'code' && f.type !== 'status');
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
        <Avatar name={row.employee} size={38} />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{row.employee}</div>
          <div className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">{row.leaveType ?? row.category} {row.days ? referenceT(row.days === 1 ? "for {count} day" : "for {count} days", { count: row.days }) : row.amount ? referenceT("for {amount}", { amount: fmtCurrency(row.amount) }) : ''}</div>
        </div>
        <StatusBadge value={row.status} />
      </div>
      <RecordForm fields={fields} value={row} onChange={() => {}} readOnly columns={2} />
      <div>
        <h3 className="mb-2 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Approval trail" /></h3>
        <ol className="relative ml-2 border-l border-line pl-5">
          {(def.steps ?? []).map((s, i) => {
            const st = states[i];
            return (
              <li key={s} className="relative pb-4 last:pb-0">
                <span className={cx('absolute -left-[27px] top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-surface', st === 'done' ? 'bg-brand' : st === 'current' ? 'bg-accent' : st === 'rejected' || st === 'withdrawn' ? 'bg-danger' : 'bg-line-strong')} />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[length:calc(13px*var(--fs-scale))] font-medium"><ReferenceText message={s} /></span>
                  <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{st === 'done' ? referenceT('Done') : st === 'current' ? referenceT("Waiting now") : st === 'rejected' ? referenceT("Rejected") : st === 'withdrawn' ? referenceT("Withdrawn") : referenceT("Not started")}</span>
                </div>
                <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{i === 0 ? row.employee : approverAt(def, i)}</div>
              </li>
            );
          })}
        </ol>
      </div>
      {row.status === 'Pending' && (
        <div className="space-y-2 rounded-lg border border-line p-3">
          <label htmlFor="cmt" className="text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Your decision" /></label>
          <Textarea id="cmt" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={referenceT("Add a note for the requester (optional)")} rows={2} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={Check} loading={busy === 'Approved'} onClick={() => act('Approved', 'approved')}><ReferenceText message="Approve" /></Button>
            <Button variant="danger" icon={CircleX} loading={busy === 'Rejected'} onClick={() => act('Rejected', 'rejected')}><ReferenceText message="Reject" /></Button>
            <span className="flex-1" />
            <Button variant="ghost" icon={Undo2} loading={busy === 'Withdrawn'} onClick={() => act('Withdrawn', 'withdrawn')}><ReferenceText message="Withdraw" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Self-service requests (leave, expenses): balances up top, list, apply and approve in drawers. */
export default function RequestTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency, fmtNumber } = useFormat();
  const toast = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState<Row | null>(null);
  const [applying, setApplying] = useState(false);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [errors, setErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const money = def.balances?.[0] && def.balances[0].total > 100;
  const formFields = def.fields.filter((f) => !['code', 'status', 'days', 'employee'].includes(f.key));
  const days = useMemo(() => (draft.from && draft.to ? Math.max(0, daysBetween(String(draft.from), String(draft.to)) + 1) : 0), [draft.from, draft.to]);

  const submit = async () => {
    const miss = missingRequired(formFields, draft);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    if (draft.from && draft.to && String(draft.to) < String(draft.from)) { toast(referenceT("The end date is before the start date"), 'danger'); return; }
    setBusy(true);
    try {
      const saved = await entityApi.create(def.entity, { ...draft, employee: user?.name ?? 'You', status: 'Pending', ...(draft.from ? { days } : {}) });
      toast(referenceT("{value0} submitted for approval", {value0: saved.code}));
      setApplying(false);
      setDraft({});
      setErrors(false);
      setReloadKey((k) => k + 1);
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setBusy(false); }
  };

  return (
    <Frame>
      {def.balances && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {def.balances.map((b) => {
            const left = b.total - b.used;
            const pct = (b.used / b.total) * 100;
            return (
              <div key={b.label} className="rounded-lg border border-line bg-surface px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message={b.label} /></span>
                  <span className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3 tnum">{money ? fmtCurrency(b.used) : b.used} <ReferenceText message="used" /></span>
                </div>
                <div className="mt-0.5 text-[length:calc(18px*var(--fs-scale))] font-semibold tracking-tight tnum">{money ? fmtCurrency(left) : fmtNumber(left)} <span className="text-[length:calc(12px*var(--fs-scale))] font-normal text-ink-3"><ReferenceText message="left of" /> {money ? fmtCurrency(b.total) : b.total}</span></div>
                <Progress value={pct} tone={pct > 80 ? 'danger' : pct > 55 ? 'warn' : 'brand'} className="mt-1.5" />
              </div>
            );
          })}
        </div>
      )}
      <Card className="min-h-[420px] flex-1">
        <WorkList def={def} reloadKey={reloadKey} onOpen={setOpen} onNew={() => setApplying(true)} newLabel={def.entity === 'leave-requests' ? 'Apply for leave' : `New ${nounOf(def)}`} />
      </Card>

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} title={open ? `${open.code}` : ''} subtitle={def.title} width="md">
        {open && <RequestDetail def={def} row={open} onDone={(m) => { toast(m); setOpen(null); setReloadKey((k) => k + 1); }} />}
      </Drawer>
      <Drawer
        open={applying}
        onClose={() => setApplying(false)}
        title={def.entity === 'leave-requests' ? 'Apply for leave' : `New ${nounOf(def)}`}
        subtitle={referenceT("Goes to {value0}", {value0: (def.steps ?? []).slice(1).join(', then ')})}
        width="md"
        footer={<><Button icon={X} onClick={() => setApplying(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" icon={Send} loading={busy} onClick={submit}><ReferenceText message="Submit for approval" /></Button></>}
      >
        <div className="space-y-4">
          <RecordForm fields={formFields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} columns={2} showErrors={errors} />
          {draft.from !== undefined && (
            <div className="rounded-lg bg-brand-soft px-3 py-2 text-[length:calc(13px*var(--fs-scale))] text-brand-ink">{days ? referenceT(days === 1 ? "{count} day requested" : "{count} days requested", { count: days }) : referenceT("Pick both dates to see the number of days")}</div>
          )}
        </div>
      </Drawer>
    </Frame>
  );
}
