'use client';

import clsx from 'clsx';
import { ArrowLeft, BedDouble, FilePlus2, Gift, Package, PiggyBank, Printer, Stethoscope, Undo2, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Timeline } from '@/components/bill/BillTabs';
import { CardTerminalDialog } from '@/components/bill/MoneyRail';
import { useShell } from '@/components/shell/AppShell';
import { Dialog, Drawer, useErrorToast, useToast } from '@/components/ui/overlay';
import { Badge, Button, Empty, ErrorNote, Field, Input, Money, MoneyInput, Segmented, Skeleton, StatusBadge, Tabs, Textarea } from '@/components/ui/primitives';
import { useApi, useMutation } from '@/lib/api';
import { age, availabilityLabel, billTypeLabel, date, dateTime, money, round2 } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AuditEntry, Bill, Deposit, Patient, Receipt, SetOff, Visit } from '@/lib/types';

interface Account {
  patient: Patient; visits: Visit[]; bills: Bill[]; deposits: Deposit[]; usage: SetOff[]; receipts: Receipt[]; history: AuditEntry[];
  packages: { name: string; collected: number; balance: number }[];
  summary: { collected: number; pending: number; setOff: number; refunded: number; balance: number; hospital: number; pharmacy: number; dues: number; lifetime: number };
  points: { earned: number; redeemed: number; balance: number; rate: number };
}
type Tab = 'bills' | 'deposits' | 'visits' | 'receipts' | 'history';

export default function PatientAccountPage() {
  const { mrNo } = useParams<{ mrNo: string }>();
  const router = useRouter();
  const { can } = useSession();
  const { openNewBill } = useShell();
  const { data, error, loading, reload } = useApi<Account>(`/patients/${mrNo}`);
  const [tab, setTab] = useState<Tab>('bills');
  const [collect, setCollect] = useState(false);
  const [refund, setRefund] = useState(false);
  const [editing, setEditing] = useState<Deposit | null>(null);

  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (loading || !data) return <div className="space-y-4"><Skeleton className="h-14 w-96" /><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  const { patient: p, summary: s } = data;
  const activeBills = data.bills.filter((b) => b.status === 'A' || b.status === 'F');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/patients" aria-label="Back to patients" className="mt-1 rounded-lg p-1.5 text-ink-soft hover:bg-white hover:text-ink"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.01em]">{p.name}</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-soft">
              {p.mr_no}{p.gender ? `, ${p.gender === 'F' ? 'female' : p.gender === 'M' ? 'male' : 'other'}` : ''}{age(p.dob) !== null ? `, ${age(p.dob)} years` : ''}
              {p.phone ? ` — ${p.phone}` : ''}{p.city ? `, ${p.city}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-11 lg:pl-0">
          {can('collect_deposit') && <Button variant="primary" icon={<PiggyBank className="h-4 w-4" />} onClick={() => setCollect(true)}>Collect deposit</Button>}
          {can('allow_refund') && <Button icon={<Undo2 className="h-4 w-4" />} disabled={s.balance <= 0} onClick={() => setRefund(true)}>Refund deposit</Button>}
          {can('edit_bill') && <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => openNewBill(p.mr_no)}>New bill</Button>}
        </div>
      </div>

      <div className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Deposit balance" value={money(s.balance)} tone="pine" sub={`Hospital ${money(s.hospital, { whole: true })}, pharmacy ${money(s.pharmacy, { whole: true })}${s.pending ? `. ${money(s.pending, { whole: true })} awaiting cheque clearance` : ''}`} />
        <Tile label="Owes across bills" value={money(s.dues)} tone={s.dues > 0 ? 'due' : undefined} sub={`${activeBills.length} open or finalized bill${activeBills.length === 1 ? '' : 's'}`} />
        <Tile label="Reward points" value={data.points.balance.toLocaleString('en-IN')} sub={`Worth ${money(data.points.balance * data.points.rate)}. ${data.points.redeemed} used so far`} icon={<Gift className="h-4 w-4 text-indigo-500" />} />
        <Tile label="Billed to patient, lifetime" value={money(s.lifetime, { whole: true })} sub={`${data.visits.length} visit${data.visits.length === 1 ? '' : 's'}, ${data.bills.length} bills`} />
      </div>

      {data.packages.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {data.packages.map((pk) => (
            <div key={pk.name} className="flex items-center gap-3 rounded-xl border border-pine-100 bg-pine-50/60 px-4 py-2.5">
              <Package className="h-5 w-5 text-pine-600" />
              <div className="text-[13px]"><p className="font-medium">{pk.name}</p><p className="text-ink-soft">Collected {money(pk.collected)}, {money(pk.balance)} left</p></div>
            </div>
          ))}
        </div>
      )}

      <section className="panel overflow-hidden">
        <Tabs className="px-2" value={tab} onChange={setTab} tabs={[
          { value: 'bills', label: 'Bills', count: data.bills.length },
          { value: 'deposits', label: 'Deposits', count: data.deposits.length },
          { value: 'visits', label: 'Visits', count: data.visits.length },
          { value: 'receipts', label: 'Receipts', count: data.receipts.length },
          { value: 'history', label: 'History' },
        ]} />
        <div className="overflow-x-auto">
          {tab === 'bills' && (data.bills.length ? (
            <table className="tbl">
              <thead><tr><th>Bill</th><th>Opened</th><th>Status</th><th className="num">Patient share</th><th className="num">Paid</th><th className="num">Due</th></tr></thead>
              <tbody>{data.bills.map((b) => (
                <tr key={b.bill_no} className="row-link" onClick={() => router.push(`/bills/${b.bill_no}`)}>
                  <td className="font-semibold">{b.bill_no}<div className="text-[12px] font-normal text-ink-mute">{billTypeLabel(b.bill_type)}{b.restriction_type === 'P' ? ', pharmacy' : ''}{b.is_tpa ? ', insured' : ''}</div></td>
                  <td className="text-ink-soft">{date(b.created_at)}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="num">{money(b.patient_amount)}</td>
                  <td className="num text-ink-soft">{money(b.total_receipts + b.deposit_set_off + b.points_amount)}</td>
                  <td className="num">{Math.abs(b.patient_due) > 0.004 ? <Money value={b.patient_due} tone="due" /> : <span className="text-ink-mute">—</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <Empty title="No bills yet" action={<Button size="sm" onClick={() => openNewBill(p.mr_no)}>Create a bill</Button>} />)}

          {tab === 'deposits' && (data.deposits.length ? (
            <table className="tbl">
              <thead><tr><th>Deposit</th><th>Date</th><th>Mode</th><th className="hidden lg:table-cell">Usable for</th><th className="hidden lg:table-cell">Paid by</th><th className="num">Amount</th><th className="num">Used</th><th className="num">Balance</th></tr></thead>
              <tbody>{data.deposits.map((d) => (
                <tr key={d.deposit_no} className={clsx('row-link', d.status === 'X' && 'text-ink-mute')} onClick={() => setEditing(d)}>
                  <td className="whitespace-nowrap font-semibold">{d.deposit_no}
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {d.deposit_type === 'F' && <Badge tone="rose">Refund</Badge>}
                      {!d.realized && d.status === 'A' && <Badge tone="marigold">Cheque not cleared</Badge>}
                      {d.status === 'X' && <Badge tone="rose">Cancelled</Badge>}
                      {d.origin === 'overpayment' && <Badge tone="sky">From {d.origin_ref}</Badge>}
                      {d.package_name && <Badge tone="pine">{d.package_name}</Badge>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-ink-soft">{dateTime(d.created_at)}</td>
                  <td className="whitespace-nowrap">{d.mode_name}{d.reference ? <div className="text-[12px] text-ink-mute">{d.bank ? `${d.bank} ` : ''}{d.reference}</div> : null}</td>
                  <td className="hidden lg:table-cell">{d.deposit_type === 'R' ? availabilityLabel(d.available_for) : '—'}</td>
                  <td className="hidden text-ink-soft lg:table-cell">{d.payer_name || '—'}</td>
                  <td className="num font-medium"><Money value={d.amount} /></td>
                  <td className="num text-ink-soft">{d.deposit_type === 'R' && d.set_off + d.refunded > 0 ? money(d.set_off + d.refunded) : '—'}</td>
                  <td className="num font-semibold">{d.deposit_type === 'R' && d.status === 'A' ? <span className={d.balance > 0 ? 'text-pine-700' : 'text-ink-mute'}>{money(d.balance)}</span> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <Empty icon={<PiggyBank className="h-5 w-5" />} title="No deposits" body="Deposits belong to the patient and can be set off on any of their bills." action={can('collect_deposit') && <Button size="sm" variant="primary" onClick={() => setCollect(true)}>Collect deposit</Button>} />)}

          {tab === 'visits' && (
            <ul className="divide-y divide-line">{data.visits.map((v) => (
              <li key={v.visit_id} className="flex items-start gap-3 px-4 py-3">
                {v.visit_type === 'i' ? <BedDouble className="mt-0.5 h-4 w-4 text-indigo-500" /> : <Stethoscope className="mt-0.5 h-4 w-4 text-sky-500" />}
                <div className="flex-1 text-[13.5px]">
                  <p className="font-medium">{v.visit_id} <span className="font-normal text-ink-soft">{v.visit_type === 'i' ? 'Inpatient' : 'Outpatient'}, {date(v.admitted_at)}</span></p>
                  <p className="text-ink-soft">{v.doctor || 'No doctor'}{v.department ? `, ${v.department}` : ''}{v.ward ? `, ${v.ward}` : ''}</p>
                  {v.primary_sponsor && <p className="text-indigo-600">{v.primary_sponsor} — {v.primary_plan}{v.secondary_sponsor ? `, then ${v.secondary_sponsor}` : ''}</p>}
                </div>
              </li>
            ))}</ul>
          )}

          {tab === 'receipts' && (data.receipts.length ? (
            <table className="tbl">
              <thead><tr><th>Receipt</th><th>Date</th><th>Bill</th><th>Type</th><th>Mode</th><th className="num">Amount</th><th className="w-10" /></tr></thead>
              <tbody>{data.receipts.map((r) => (
                <tr key={r.receipt_no} className={clsx(r.status === 'X' && 'text-ink-mute')}>
                  <td className="font-medium"><Link href={`/receipts?open=${r.receipt_no}`} className="hover:underline">{r.receipt_no}</Link>{r.status === 'X' && <Badge tone="rose" className="ml-2">Cancelled</Badge>}</td>
                  <td className="text-ink-soft">{dateTime(r.created_at)}</td>
                  <td><Link href={`/bills/${r.bill_no}`} className="text-pine-700 hover:underline">{r.bill_no}</Link></td>
                  <td>{r.reversal_of ? 'Cancellation' : r.label}</td><td>{r.mode_name}</td>
                  <td className="num font-medium"><Money value={r.amount} /></td>
                  <td><a href={`/print/receipt/${r.receipt_no}`} target="_blank" rel="noreferrer" aria-label="Print" className="text-ink-mute hover:text-ink"><Printer className="h-3.5 w-3.5" /></a></td>
                </tr>
              ))}</tbody>
            </table>
          ) : <Empty title="No receipts yet" />)}

          {tab === 'history' && <Timeline entries={data.history} showBill />}
        </div>
      </section>

      <CollectDepositDialog open={collect} onClose={() => setCollect(false)} mrNo={p.mr_no} patientName={p.name} />
      <RefundDepositDialog open={refund} onClose={() => setRefund(false)} mrNo={p.mr_no} deposits={data.deposits} />
      <DepositDrawer deposit={editing} usage={data.usage} onClose={() => setEditing(null)} />
    </div>
  );
}

function Tile({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: 'pine' | 'due'; icon?: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">{icon}{label}</p>
      <p className={clsx('mt-0.5 text-[22px] font-semibold tracking-[-0.01em]', tone === 'pine' && 'text-pine-700', tone === 'due' && 'text-marigold-800')}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-ink-mute">{sub}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Collect */
function CollectDepositDialog({ open, onClose, mrNo, patientName }: { open: boolean; onClose: () => void; mrNo: string; patientName: string }) {
  const { meta } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const modes = meta?.paymentModes || [];
  const blank = { amount: '', modeId: modes[0]?.id || 1, bank: '', reference: '', availableFor: 'B' as 'H' | 'P' | 'B', payerName: '', payerPhone: '', packageName: '', remarks: '' };
  const [f, setF] = useState(blank);
  const [card, setCard] = useState<{ id: string; amount: number; terminal: string } | null>(null);
  useEffect(() => { if (open) setF({ ...blank, modeId: modes[0]?.id || 1 }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const mode = modes.find((m) => m.id === f.modeId);
  const ok = Number(f.amount) > 0 && (!mode?.requires_bank || f.bank) && (!mode?.requires_reference || f.reference);

  async function submit() {
    try {
      const res = await run<{ depositNo?: string; cardTxn?: { id: string; amount: number; terminal: string } }>(`/patients/${mrNo}/deposits`, 'POST', {
        type: 'R', ...f, amount: Number(f.amount), manualCard: !meta?.prefs.card_integration,
      });
      if (res.data.cardTxn) { setCard(res.data.cardTxn); return; }
      done(res.data.depositNo);
    } catch (e) { fail(e, 'Deposit not recorded'); }
  }
  function done(no?: string) {
    toast({ tone: 'success', title: `Deposit of ${money(Number(f.amount))} collected`, body: mode?.realization_required ? `${no || ''} counts toward the balance once the cheque clears.` : no,
      action: no ? { label: 'Print receipt', onClick: () => window.open(`/print/receipt/${no}`, '_blank') } : undefined });
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Collect deposit" sub={`From or for ${patientName}. Deposits can be set off on any future bill.`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} loading={pending} onClick={submit}>Collect {Number(f.amount) > 0 ? money(Number(f.amount)) : ''}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount"><MoneyInput autoFocus value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
        <Field label="Usable for">
          <Segmented size="sm" value={f.availableFor} onChange={(v) => setF({ ...f, availableFor: v })} options={[{ value: 'B', label: 'Both' }, { value: 'H', label: 'Hospital' }, { value: 'P', label: 'Pharmacy' }]} />
        </Field>
        <Field label="Mode" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {modes.map((m) => (
              <button key={m.id} type="button" onClick={() => setF({ ...f, modeId: m.id })} aria-pressed={f.modeId === m.id}
                className={clsx('h-8 rounded-lg border px-3 text-[13px] font-medium', f.modeId === m.id ? 'border-pine-600 bg-pine-600 text-white' : 'border-line hover:border-line-strong')}>{m.name}</button>
            ))}
          </div>
        </Field>
        {mode?.requires_bank ? <Field label="Bank"><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field> : null}
        {mode?.requires_reference ? <Field label={mode.code === 'CHEQUE' ? 'Cheque number' : 'Reference'}><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field> : null}
        {mode?.realization_required && meta?.prefs.deposit_cheque_realization_flow ? <p className="text-[12.5px] text-marigold-800 sm:col-span-2">Cheque deposits count toward the balance only after finance realizes them.</p> : null}
        <Field label="Paid by" optional><Input value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} placeholder="If not the patient" /></Field>
        <Field label="Payer phone" optional><Input inputMode="tel" value={f.payerPhone} onChange={(e) => setF({ ...f, payerPhone: e.target.value })} /></Field>
        <Field label="Package" optional hint="For multi-visit packages, e.g. maternity"><Input value={f.packageName} onChange={(e) => setF({ ...f, packageName: e.target.value })} /></Field>
        <Field label="Remarks" optional><Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
      </div>
      <CardTerminalDialog txn={card} onClose={() => setCard(null)} onApproved={() => { setCard(null); done(); }} />
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Refund */
function RefundDepositDialog({ open, onClose, mrNo, deposits }: { open: boolean; onClose: () => void; mrNo: string; deposits: Deposit[] }) {
  const { meta } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const usable = useMemo(() => deposits.filter((d) => d.deposit_type === 'R' && d.status === 'A' && d.realized && d.balance > 0.004).sort((a, b) => a.created_at.localeCompare(b.created_at)), [deposits]);
  const total = round2(usable.reduce((s, d) => s + d.balance, 0));
  const [amount, setAmount] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [modeId, setModeId] = useState(1);
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const modes = (meta?.paymentModes || []).filter((m) => !m.requires_card);

  const autoAlloc = (amt: number) => {
    let left = amt;
    const out: Record<string, string> = {};
    for (const d of usable) { const t = Math.min(left, d.balance); out[d.deposit_no] = t > 0 ? t.toFixed(2) : ''; left = round2(left - t); }
    return out;
  };
  useEffect(() => { if (open) { setAmount(total.toFixed(2)); setAlloc(autoAlloc(total)); setModeId(modes[0]?.id || 1); setReference(''); setRemarks(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const allocSum = round2(Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0));
  const mode = modes.find((m) => m.id === modeId);
  const ok = Number(amount) > 0 && Number(amount) <= total + 0.004 && Math.abs(allocSum - Number(amount)) < 0.005 && (!mode?.requires_reference || reference);

  return (
    <Dialog open={open} onClose={onClose} title="Refund deposit" sub={`${money(total)} can be refunded.`} size="lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!ok} loading={pending} onClick={async () => {
        try {
          const { data } = await run<{ depositNo: string }>(`/patients/${mrNo}/deposits`, 'POST', {
            type: 'F', amount: Number(amount), modeId, reference: reference || undefined, remarks: remarks || undefined,
            allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([depositNo, v]) => ({ depositNo, amount: Number(v) })),
          });
          toast({ tone: 'success', title: `Refunded ${money(Number(amount))}`, body: data.depositNo, action: { label: 'Print', onClick: () => window.open(`/print/receipt/${data.depositNo}`, '_blank') } });
          onClose();
        } catch (e) { fail(e, 'Refund not recorded'); }
      }}>Refund {Number(amount) > 0 ? money(Number(amount)) : ''}</Button></>}>
      <div className="grid gap-5 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Field label="Refund amount"><MoneyInput autoFocus value={amount} onChange={(v) => { setAmount(v); setAlloc(autoAlloc(Number(v) || 0)); }} invalid={Number(amount) > total + 0.004} /></Field>
          <Field label="Pay back by">
            <div className="flex flex-wrap gap-1.5">{modes.map((m) => (
              <button key={m.id} type="button" onClick={() => setModeId(m.id)} aria-pressed={modeId === m.id}
                className={clsx('h-8 rounded-lg border px-3 text-[13px] font-medium', modeId === m.id ? 'border-pine-600 bg-pine-600 text-white' : 'border-line hover:border-line-strong')}>{m.name}</button>
            ))}</div>
          </Field>
          {mode?.requires_reference ? <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field> : null}
          <Field label="Remarks" optional><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        </div>
        <div>
          <p className="label mb-2">Taken from (oldest first — adjust if needed)</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {usable.map((d) => (
              <li key={d.deposit_no} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1 text-[13px]">
                  <p className="font-medium">{d.deposit_no}</p>
                  <p className="text-ink-mute">{date(d.created_at)}, {availabilityLabel(d.available_for)}, {money(d.balance)} left</p>
                </div>
                <MoneyInput value={alloc[d.deposit_no] || ''} onChange={(v) => setAlloc({ ...alloc, [d.deposit_no]: v })} className="w-[130px]" invalid={Number(alloc[d.deposit_no]) > d.balance + 0.004} />
              </li>
            ))}
          </ul>
          {Math.abs(allocSum - (Number(amount) || 0)) > 0.004 && <p className="mt-2 text-[12.5px] text-rose-600">Allocations add up to {money(allocSum)} — they must equal the refund.</p>}
        </div>
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Edit */
function DepositDrawer({ deposit: d, usage, onClose }: { deposit: Deposit | null; usage: SetOff[]; onClose: () => void }) {
  const { can } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [f, setF] = useState({ availableFor: 'B', payerName: '', payerPhone: '', reference: '', remarks: '', packageName: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (d) setF({ availableFor: d.available_for, payerName: d.payer_name || '', payerPhone: d.payer_phone || '', reference: d.reference || '', remarks: d.remarks || '', packageName: d.package_name || '' });
    setConfirm(false); setCancelReason('');
  }, [d]);
  if (!d) return null;
  const used = usage.filter((u) => u.deposit_no === d.deposit_no || u.refund_no === d.deposit_no);
  const editable = can('edit_receipt') && d.status === 'A';
  return (
    <Drawer open onClose={onClose} title={`${d.deposit_type === 'R' ? 'Deposit' : 'Deposit refund'} ${d.deposit_no}`} sub={`${money(d.amount)} by ${d.mode_name}, ${dateTime(d.created_at)} by ${d.username}`}
      footer={confirm ? (
        <><Input autoFocus value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason" className="flex-1" />
          <Button variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
          <Button variant="danger" disabled={!cancelReason.trim()} loading={pending} onClick={async () => { try { await run(`/deposits/${d.deposit_no}/cancel`, 'POST', { reason: cancelReason }); toast({ tone: 'success', title: `${d.deposit_no} cancelled` }); onClose(); } catch (e) { fail(e); } }}>Cancel deposit</Button></>
      ) : (
        <>{editable && <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" onClick={() => setConfirm(true)}>Cancel deposit</Button>}
          <Button variant="ghost" onClick={() => window.open(`/print/receipt/${d.deposit_no}`, '_blank')} icon={<Printer className="h-4 w-4" />}>Print</Button>
          {editable && <Button variant="primary" loading={pending} onClick={async () => { try { await run(`/deposits/${d.deposit_no}`, 'PATCH', f); toast({ tone: 'success', title: 'Deposit updated' }); onClose(); } catch (e) { fail(e); } }}>Save</Button>}</>
      )}>
      <div className="space-y-4">
        {d.deposit_type === 'R' && (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-mist p-3 text-[12.5px]">
            <div><p className="text-ink-mute">Set off</p><p className="font-semibold">{money(d.set_off)}</p></div>
            <div><p className="text-ink-mute">Refunded</p><p className="font-semibold">{money(d.refunded)}</p></div>
            <div><p className="text-ink-mute">Balance</p><p className="font-semibold text-pine-700">{money(d.balance)}</p></div>
          </div>
        )}
        {d.deposit_type === 'R' && (
          <Field label="Usable for">
            <Segmented size="sm" value={f.availableFor} onChange={(v) => setF({ ...f, availableFor: v })} options={[{ value: 'B', label: 'Both' }, { value: 'H', label: 'Hospital' }, { value: 'P', label: 'Pharmacy' }]} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by"><Input disabled={!editable} value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} /></Field>
          <Field label="Payer phone"><Input disabled={!editable} value={f.payerPhone} onChange={(e) => setF({ ...f, payerPhone: e.target.value })} /></Field>
          <Field label="Reference"><Input disabled={!editable} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          <Field label="Package"><Input disabled={!editable} value={f.packageName} onChange={(e) => setF({ ...f, packageName: e.target.value })} /></Field>
        </div>
        <Field label="Remarks"><Textarea disabled={!editable} rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
        <div>
          <p className="label mb-2">Where it was used</p>
          {used.length ? (
            <ul className="divide-y divide-line rounded-lg border border-line text-[13px]">
              {used.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-3 py-2">
                  <span>{u.set_off_type === 'R' ? <>Set off on <Link className="font-medium text-pine-700 hover:underline" href={`/bills/${u.bill_no}`}>{u.bill_no}</Link></> : <>Refunded via {u.refund_no}</>}<span className="ml-2 text-ink-mute">{date(u.created_at)}</span></span>
                  <span className="font-medium">{money(u.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-ink-soft"><Wallet className="mr-1 inline h-3.5 w-3.5" />Not used yet.</p>}
        </div>
      </div>
    </Drawer>
  );
}
