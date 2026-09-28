'use client';
import { RecordActivity } from '@pepbits/reference-keystone-core';
import { useRouter, cx, todayISO, useFormat, useEntityApi, Badge, Button, IconButton, Stepper, StatusBadge, Textarea, useToast, missingRequired, RecordForm, LinesEditor, lineTotals, WorkList, Card, Frame, nounOf, type PageDef, type Row, type Line, type LineKind } from '@pepbits/reference-keystone-core';
import { CardGrid } from '@pepbits/ops-ui';
import { useEffect, useState } from 'react';
import { ArrowLeft, Ban, CircleCheck, Copy, Printer, Save, Scale, Send } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TERMINAL = ['Cancelled', 'Reversed', 'Rejected'];
const ACTION: Record<string, string> = { Submitted: 'Submit', Approved: 'Approve', Delivered: 'Mark delivered', Received: 'Mark received', Paid: 'Record payment', Posted: 'Post', Unpaid: 'Issue invoice', Inspected: 'Mark inspected' };

export function flowState(def: PageDef, status: string) {
  const flow = def.statusFlow ?? [];
  const idx = flow.indexOf(status);
  const done = status === flow[flow.length - 1] || TERMINAL.includes(status);
  const next = done ? null : idx >= 0 ? flow[idx + 1] : flow[flow.length - 1];
  return { flow, idx: idx >= 0 ? idx : Math.max(0, flow.length - 2), done, next, locked: done };
}

export function DocEditor({ def, row, seed, kind, onClose, onSaved, onCopy }: { def: PageDef; row: Row | null; seed?: Partial<Row>; kind: LineKind; onClose: () => void; onSaved: (r: Row) => void; onCopy?: (d: Partial<Row>) => void }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { amountInWords, fmtCurrency, fmtDate } = useFormat();
  const toast = useToast();
  const router = useRouter();
  const flowStart = def.statusFlow?.[0] ?? 'Draft';
  const fresh = () => row ?? seed ?? { date: todayISO(), status: flowStart, lines: [] };
  const [draft, setDraft] = useState<Partial<Row>>(fresh);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState(false);
  useEffect(() => { setDraft(fresh()); }, [row, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = (draft.lines as Line[]) ?? [];
  const totals = lineTotals(kind, lines);
  const status = String(draft.status ?? flowStart);
  const { flow, idx, next, locked } = flowState(def, status);
  const balanced = kind !== 'voucher' || (totals.diff === 0 && totals.debit > 0);
  const headerFields = def.fields.filter((f) => !['code', 'status', 'total', 'narration'].includes(f.key));
  const narrationF = def.fields.find((f) => f.key === 'narration');
  const isNew = !row;

  const persist = async (patch: Partial<Row>, label: string) => {
    const body = { ...draft, ...patch, lines, total: totals.total };
    const miss = missingRequired(def.fields, body);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    if (!lines.length) { toast(referenceT("Add at least one line before saving"), 'danger'); return; }
    if (patch.status && kind === 'voucher' && !balanced) { toast(referenceT("Debits and credits must match before posting"), 'danger'); return; }
    setSaving(label);
    try {
      const saved = isNew ? await entityApi.create(def.entity, body) : await entityApi.update(def.entity, row!.id, body);
      toast(patch.status ? `${saved.code} ${String(patch.status).toLowerCase()}` : `${saved.code} saved as ${String(saved.status).toLowerCase()}`);
      setDraft(saved);
      onSaved(saved);
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setSaving(null); }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-3 bg-bg p-2 anim-drawer md:p-3">
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <IconButton icon={ArrowLeft} label={referenceT("Back to list")} onClick={onClose} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[length:calc(16px*var(--fs-scale))] font-semibold tracking-tight">{isNew ? `New ${nounOf(def)}` : String(draft.code)}</h2>
              <StatusBadge value={status} />
            </div>
            <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3">{isNew ? referenceT("Number is assigned when you save") : `Created ${fmtDate(draft.date)}`}</div>
          </div>
          <div className="mx-auto hidden px-4 lg:block">
            {flow.length > 0 && <Stepper steps={flow} current={locked && !TERMINAL.includes(status) ? flow.length : idx} failedAt={TERMINAL.includes(status) ? idx + 1 : undefined} />}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {!isNew && def.entity === 'sales-invoices' && <Button icon={Printer} onClick={() => router.push('/reports/invoice-print')}><ReferenceText message="Print" /></Button>}
            {!isNew && onCopy && <Button icon={Copy} className="hidden sm:inline-flex" onClick={() => { const { id: _id, code: _code, ...rest } = draft; void _id; void _code; onCopy({ ...rest, status: flowStart, date: todayISO() }); toast(referenceT("Copied into a new draft"), 'info'); }}><ReferenceText message="Copy" /></Button>}
            {!locked && !isNew && <Button variant="danger" icon={Ban} onClick={() => persist({ status: kind === 'voucher' && status === 'Posted' ? 'Reversed' : 'Cancelled' }, 'cancel')} loading={saving === 'cancel'}><ReferenceText message="Cancel" /></Button>}
            {!locked && <Button icon={Save} onClick={() => persist({}, 'save')} loading={saving === 'save'}><ReferenceText message="Save" /> {status === flowStart ? referenceT("draft") : ''}</Button>}
            {next && <Button variant="primary" icon={kind === 'voucher' ? CircleCheck : Send} onClick={() => persist({ status: next }, 'next')} loading={saving === 'next'} disabled={!balanced}>{ACTION[next] ?? `Move to ${next.toLowerCase()}`}</Button>}
          </div>
        </div>
      </Card>

      <CardGrid className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_300px] lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-3">
          <Card className="shrink-0 p-3.5">
            <RecordForm fields={headerFields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} readOnly={locked} columns={4} compact showErrors={errors} />
          </Card>
          <div className="flex min-h-[260px] flex-1 flex-col">
            <LinesEditor fields={def.lines!.fields} lines={lines} kind={kind} readOnly={locked} onChange={(l) => setDraft((d) => ({ ...d, lines: l }))} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          {kind === 'voucher' ? (
            <Card className="p-3.5">
              <div className="mb-2 flex items-center gap-2"><Scale size={15} className="text-ink-3" /><h3 className="text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Balance check" /></h3></div>
              <dl className="space-y-1.5 text-[length:calc(13px*var(--fs-scale))]">
                <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Total debit" /></dt><dd className="tnum">{fmtCurrency(totals.debit)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Total credit" /></dt><dd className="tnum">{fmtCurrency(totals.credit)}</dd></div>
                <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-medium"><ReferenceText message="Difference" /></dt><dd className={cx('font-semibold tnum', totals.diff ? 'text-danger' : 'text-ok')}>{fmtCurrency(Math.abs(totals.diff))}</dd></div>
              </dl>
              <div className={cx('mt-3 rounded-md px-2.5 py-2 text-[length:calc(12.5px*var(--fs-scale))]', balanced ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger')}>
                {balanced ? referenceT("Balanced. Ready to post.") : totals.debit === 0 ? referenceT("Enter debit and credit lines.") : `Out of balance: ${totals.diff > 0 ? 'credits' : 'debits'} are short by ${fmtCurrency(Math.abs(totals.diff))}.`}
              </div>
            </Card>
          ) : (
            <Card className="p-3.5">
              <h3 className="mb-2 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Summary" /></h3>
              <dl className="space-y-1.5 text-[length:calc(13px*var(--fs-scale))]">
                <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Subtotal" /></dt><dd className="tnum">{fmtCurrency(totals.subtotal)}</dd></div>
                {totals.tax !== 0 && <div className="flex justify-between"><dt className="text-ink-3"><ReferenceText message="Tax" /></dt><dd className="tnum">{fmtCurrency(totals.tax)}</dd></div>}
                <div className="flex items-baseline justify-between border-t border-line pt-2"><dt className="font-medium"><ReferenceText message="Total" /></dt><dd className="text-[length:calc(20px*var(--fs-scale))] font-semibold tracking-tight tnum">{fmtCurrency(totals.total)}</dd></div>
              </dl>
              <p className="mt-2 text-[length:calc(12px*var(--fs-scale))] leading-snug text-ink-3">{amountInWords(Math.abs(totals.total))}</p>
            </Card>
          )}
          {narrationF && (
            <Card className="p-3.5">
              <label className="mb-1.5 block text-[length:calc(13px*var(--fs-scale))] font-semibold" htmlFor="narr"><ReferenceText message="Narration" /></label>
              <Textarea id="narr" value={String(draft.narration ?? '')} readOnly={locked} onChange={(e) => setDraft((d) => ({ ...d, narration: e.target.value }))} rows={3} placeholder={referenceT("Why this entry is being made")} />
            </Card>
          )}
          <Card className="p-3.5">
            <h3 className="mb-2 text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="History" /></h3>
            {row ? <RecordActivity entity={def.entity} id={row.id} compact /> : <p className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="History appears after saving this document." /></p>}
          </Card>
        </div>
      </CardGrid>
    </div>
  );
}

/** Header + lines transactions (orders, invoices, receipts) and vouchers that must balance. */
export default function DocumentTemplate({ def }: { def: PageDef }) {
  const kind: LineKind = def.template === 'voucher' ? 'voucher' : 'document';
  const [open, setOpen] = useState<{ row: Row | null; seed?: Partial<Row> } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="relative h-full">
      <Frame>
        <Card className="flex-1">
          <WorkList def={def} onOpen={(r) => setOpen({ row: r })} onNew={() => setOpen({ row: null })} newLabel={`New ${nounOf(def)}`} reloadKey={reloadKey} showTotals />
        </Card>
      </Frame>
      {open && <DocEditor def={def} row={open.row} seed={open.seed} kind={kind} onClose={() => setOpen(null)} onCopy={(d) => setOpen({ row: null, seed: d })} onSaved={(r) => { setOpen({ row: r }); setReloadKey((k) => k + 1); }} />}
    </div>
  );
}
