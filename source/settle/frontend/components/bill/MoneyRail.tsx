'use client';

import clsx from 'clsx';
import { Banknote, CheckCircle2, CreditCard, Gift, Landmark, Loader2, Nfc, PiggyBank, Plus, Smartphone, Trash2, X, XCircle } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { api, revalidateAll, useMutation } from '@/lib/api';
import { money, round2 } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { BillPayload, PaymentMode } from '@/lib/types';
import { Dialog, useErrorToast, useToast } from '../ui/overlay';
import { Button, Input, MoneyInput, Segmented } from '../ui/primitives';

type Kind = 'advance' | 'settlement' | 'refund' | 'sponsor_settlement' | 'sponsor_advance';
interface Row { modeId: number; amount: string; bank: string; reference: string; cardLast4: string }
export interface PaymentHandle { focusAmount: () => void }

const MODE_ICON: Record<string, React.ElementType> = { CASH: Banknote, CARD: CreditCard, DEBIT: CreditCard, UPI: Smartphone, CHEQUE: Landmark, DD: Landmark, NEFT: Landmark };

export const PaymentPanel = forwardRef<PaymentHandle, { data: BillPayload }>(function PaymentPanel({ data }, ref) {
  const { bill } = data;
  const { meta, can } = useSession();
  const toast = useToast();
  const fail = useErrorToast();
  const { run, pending } = useMutation();
  const amountRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focusAmount: () => amountRef.current?.querySelector('input')?.focus() }));

  const due = bill.patient_due;
  const kinds = useMemo(() => {
    const k: { value: Kind; label: string }[] = [];
    if (bill.status === 'X' || bill.status === 'C') return k;
    if (due > 0.004) k.push({ value: 'settlement', label: 'Settle' });
    if (bill.bill_type === 'C' && bill.status === 'A') k.push({ value: 'advance', label: 'Advance' });
    if (can('allow_refund') && bill.total_receipts > 0.004) k.push({ value: 'refund', label: 'Refund' });
    if (bill.is_tpa && bill.sponsor_due > 0.004) k.push({ value: 'sponsor_settlement', label: 'Sponsor' });
    return k;
  }, [bill, due, can]);

  const defaultKind = (): Kind | null => {
    if (due < -0.004 && kinds.some((k) => k.value === 'refund') && bill.status !== 'A') return 'refund';
    return kinds[0]?.value ?? null;
  };
  const [kind, setKind] = useState<Kind | null>(defaultKind);
  const modes = meta?.paymentModes || [];
  const cash = modes.find((m) => m.code === 'CASH')?.id ?? 1;
  const suggested = (k: Kind | null) => {
    if (k === 'settlement') return Math.max(0, due);
    if (k === 'refund') return Math.min(Math.max(0, -due), bill.total_receipts);
    if (k === 'sponsor_settlement' || k === 'sponsor_advance') return Math.max(0, bill.sponsor_due);
    return 0;
  };
  const blank = (amount = 0): Row => ({ modeId: cash, amount: amount > 0 ? amount.toFixed(2) : '', bank: '', reference: '', cardLast4: '' });
  const [rows, setRows] = useState<Row[]>([blank(suggested(defaultKind()))]);
  const [sponsorIndex, setSponsorIndex] = useState<'P' | 'S'>('P');
  const [card, setCard] = useState<{ id: string; amount: number; terminal: string } | null>(null);

  // Reset when the bill's money position changes (after any save).
  const sig = `${bill.bill_no}|${bill.status}|${bill.patient_due}|${bill.sponsor_due}|${kinds.map((k) => k.value).join()}`;
  useEffect(() => { const k = defaultKind(); setKind(k); setRows([blank(suggested(k))]); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data.actions.takePayment.allowed && !(bill.status === 'C' || bill.status === 'X')) {
    return <RailCard title="Take payment"><p className="text-[13px] text-marigold-800">{data.actions.takePayment.reasons[0]}.</p></RailCard>;
  }
  if (!kind) {
    return (
      <RailCard title="Take payment">
        <p className="text-[13px] text-ink-soft">{bill.status === 'C' ? 'This bill is closed and fully settled.' : bill.status === 'X' ? 'This bill is cancelled.' : 'Nothing to collect right now.'}</p>
      </RailCard>
    );
  }

  const total = round2(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0));
  const target = suggested(kind);
  const isRefund = kind === 'refund';
  const canCloseToo = kind === 'settlement' && Math.abs(total - due) < 0.005 && (bill.status === 'F' || (bill.status === 'A' && bill.bill_type === 'P'))
    && !(bill.is_tpa && bill.sponsor_due > 0.004);
  const modeOf = (id: number) => modes.find((m) => m.id === id) as PaymentMode | undefined;
  const rowError = (r: Row) => {
    const m = modeOf(r.modeId);
    if (!m) return 'Choose a mode';
    if (m.requires_bank && !r.bank) return 'Bank name needed';
    if (m.requires_reference && !r.reference) return 'Reference number needed';
    return null;
  };
  const invalid = !(total > 0) || rows.some((r) => !(Number(r.amount) > 0) || rowError(r));

  async function submit(close = false) {
    const body = {
      rows: rows.map((r) => ({
        kind: kind === 'sponsor_settlement' && bill.status === 'A' ? 'sponsor_advance' : kind, amount: Number(r.amount), modeId: r.modeId,
        bank: r.bank || undefined, reference: r.reference || undefined, cardLast4: r.cardLast4 || undefined, sponsorIndex,
        manualCard: !meta?.prefs.card_integration,
      })),
      finalize: close, close,
    };
    try {
      const res = await run<BillPayload & { cardTxn?: { id: string; amount: number; terminal: string } }>(`/bills/${bill.bill_no}/payments`, 'POST', body);
      if (res.status === 202 && res.data.cardTxn) { setCard(res.data.cardTxn); return; }
      announce(res.data);
    } catch (e) { fail(e, isRefund ? 'Refund not recorded' : 'Payment not recorded'); }
  }

  function announce(p: BillPayload) {
    const nos = p.result?.receipts || [];
    toast({
      tone: 'success',
      title: `${isRefund ? 'Refunded' : 'Received'} ${money(total)}`,
      body: [nos.join(', '), ...(p.result?.notes || [])].filter(Boolean).join('. '),
      action: nos[0] ? { label: 'Print receipt', onClick: () => window.open(`/print/receipt/${nos[0]}`, '_blank') } : undefined,
    });
  }

  return (
    <RailCard title={isRefund ? 'Refund to patient' : kind.startsWith('sponsor') ? 'Sponsor payment' : 'Take payment'}
      right={kinds.length > 1 ? <Segmented size="sm" value={kind} onChange={(k) => { setKind(k); setRows([blank(suggested(k))]); }} options={kinds} /> : undefined}>
      {kind === 'advance' && <p className="-mt-1 mb-3 text-[12.5px] text-ink-soft">Advances sit on this bill and are applied when it’s finalized.</p>}
      {isRefund && <p className="-mt-1 mb-3 text-[12.5px] text-ink-soft">Advance balance {money(bill.advance_balance || 0)}. Refunds draw on advances first, then settlements.</p>}
      {due < -0.004 && bill.status === 'A' && !isRefund && (
        <p className="-mt-1 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">Overpaid by {money(-due)}. Finalizing moves the excess to the patient’s deposit automatically.</p>
      )}
      {kind.startsWith('sponsor') && data.claims.length > 1 && (
        <Segmented size="sm" className="mb-3" value={sponsorIndex} onChange={setSponsorIndex}
          options={data.claims.map((c) => ({ value: c.priority === 1 ? 'P' as const : 'S' as const, label: c.sponsor_name }))} />
      )}

      <div className="space-y-3">
        {rows.map((r, i) => {
          const m = modeOf(r.modeId);
          return (
            <div key={i} className={clsx(rows.length > 1 && 'rounded-xl border border-line p-2.5')}>
              <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Payment mode">
                {modes.filter((x) => !isRefund || !x.requires_card).map((x) => {
                  const Icon = MODE_ICON[x.code] || Banknote;
                  return (
                    <button key={x.id} type="button" role="radio" aria-checked={r.modeId === x.id}
                      onClick={() => setRows(rows.map((y, j) => (j === i ? { ...y, modeId: x.id } : y)))}
                      className={clsx('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors',
                        r.modeId === x.id ? 'border-pine-600 bg-pine-600 text-white' : 'border-line bg-white text-ink-soft hover:border-line-strong hover:text-ink')}>
                      <Icon className="h-3.5 w-3.5" />{x.code === 'NEFT' ? 'Transfer' : x.name.replace(' card', '')}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2" ref={i === 0 ? amountRef : undefined}>
                <MoneyInput value={r.amount} onChange={(v) => setRows(rows.map((y, j) => (j === i ? { ...y, amount: v } : y)))} className="flex-1" autoFocus={false} />
                {rows.length > 1 && (
                  <button type="button" aria-label="Remove row" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-md p-2 text-ink-mute hover:bg-mist hover:text-ink">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {m && (m.requires_bank || m.requires_reference || (m.requires_card && !meta?.prefs.card_integration)) ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {m.requires_bank ? <Input placeholder="Bank" value={r.bank} onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, bank: e.target.value } : y)))} /> : null}
                  {m.requires_reference ? <Input placeholder={m.code === 'UPI' ? 'UPI transaction ID' : m.code === 'CHEQUE' ? 'Cheque number' : 'Reference'} value={r.reference}
                    onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, reference: e.target.value } : y)))} className={clsx(!m.requires_bank && 'col-span-2')} /> : null}
                  {m.requires_card && !meta?.prefs.card_integration ? <Input placeholder="Last 4 digits" maxLength={4} value={r.cardLast4}
                    onChange={(e) => setRows(rows.map((y, j) => (j === i ? { ...y, cardLast4: e.target.value.replace(/\D/g, '') } : y)))} /> : null}
                </div>
              ) : null}
              {m?.requires_card && meta?.prefs.card_integration && !isRefund ? <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-mute"><Nfc className="h-3.5 w-3.5" />Goes to the card terminal at your counter</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[12.5px]">
        <button type="button" className="inline-flex items-center gap-1 font-medium text-pine-700 hover:underline"
          onClick={() => setRows([...rows, { ...blank(Math.max(0, round2(target - total))), modeId: modes.find((m) => m.id !== rows[rows.length - 1].modeId)?.id ?? cash }])}>
          <Plus className="h-3.5 w-3.5" />Split across modes
        </button>
        {target > 0 && Math.abs(total - target) > 0.004 && (
          <button type="button" className="text-ink-soft hover:text-ink" onClick={() => setRows([{ ...rows[0], amount: target.toFixed(2) }])}>
            Use {money(target)}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {canCloseToo && (
          <Button variant="primary" size="lg" loading={pending} disabled={invalid} onClick={() => submit(true)}>Collect {money(total)} and close bill</Button>
        )}
        <Button variant={canCloseToo ? 'secondary' : isRefund ? 'danger' : 'primary'} size={canCloseToo ? 'md' : 'lg'} loading={pending && !canCloseToo} disabled={invalid} onClick={() => submit(false)}>
          {isRefund ? `Refund ${money(total)}` : `Collect ${money(total)}`}
        </Button>
      </div>

      <CardTerminalDialog txn={card} onClose={() => setCard(null)} onApproved={(p) => { setCard(null); if (p) announce(p); }} />
    </RailCard>
  );
});

/* ---------------------------------------------------------------- Card terminal */
export function CardTerminalDialog({ txn, onClose, onApproved }: {
  txn: { id: string; amount: number; terminal: string } | null; onClose: () => void; onApproved: (bill: BillPayload | null, meta?: { auth: string }) => void;
}) {
  const [stage, setStage] = useState<'waiting' | 'working' | 'approved' | 'declined'>('waiting');
  const [result, setResult] = useState<{ auth: string; rrn: string; last4: string } | null>(null);
  const fail = useErrorToast();
  useEffect(() => { if (txn) { setStage('waiting'); setResult(null); } }, [txn]);
  if (!txn) return null;

  async function approve() {
    setStage('working');
    try {
      await new Promise((r) => setTimeout(r, 900));
      const { data } = await api<{ meta: { auth: string; rrn: string; last4: string }; bill: BillPayload | null }>(`/card-txns/${txn!.id}/approve`, { method: 'POST', body: {} });
      setResult(data.meta);
      setStage('approved');
      revalidateAll();
      setTimeout(() => onApproved(data.bill, data.meta), 1100);
    } catch (e) { setStage('waiting'); fail(e, 'Card payment failed'); }
  }
  async function decline(reason = 'Declined by card issuer') {
    try { await api(`/card-txns/${txn!.id}/decline`, { method: 'POST', body: { reason } }); } catch { /* already resolved */ }
    setStage('declined');
  }

  return (
    <Dialog open onClose={stage === 'working' ? () => {} : stage === 'waiting' ? () => { decline('Cancelled at counter'); onClose(); } : onClose}
      size="sm" title={`Card terminal ${txn.terminal}`} sub="Payment is recorded only after the terminal approves it.">
      <div className="flex flex-col items-center py-4 text-center">
        <div className={clsx('flex h-20 w-20 items-center justify-center rounded-full',
          stage === 'approved' ? 'bg-pine-50 text-pine-600' : stage === 'declined' ? 'bg-rose-50 text-rose-500' : 'bg-mist text-ink-soft')}>
          {stage === 'approved' ? <CheckCircle2 className="h-10 w-10" /> : stage === 'declined' ? <XCircle className="h-10 w-10" />
            : stage === 'working' ? <Loader2 className="h-10 w-10 animate-spin" /> : <Nfc className="h-10 w-10 animate-pulse2" />}
        </div>
        <p className="mt-4 text-[28px] font-semibold tracking-[-0.02em]">{money(txn.amount)}</p>
        <p className="mt-1 text-[14px] text-ink-soft">
          {stage === 'waiting' && 'Ask the patient to tap, insert or swipe their card.'}
          {stage === 'working' && 'Authorizing with the bank…'}
          {stage === 'approved' && result && `Approved. Card ending ${result.last4}, auth code ${result.auth}.`}
          {stage === 'declined' && 'Declined. Nothing was recorded — try another card or mode.'}
        </p>
      </div>
      {stage === 'waiting' && (
        <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
          <p className="col-span-2 text-center text-[12px] text-ink-mute">Demo terminal — choose the outcome</p>
          <Button variant="secondary" onClick={() => decline()}>Simulate decline</Button>
          <Button variant="primary" onClick={approve}>Simulate approval</Button>
        </div>
      )}
      {stage === 'declined' && <div className="flex justify-end border-t border-line pt-4"><Button onClick={onClose}>Close</Button></div>}
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Deposits & points */
export function DepositPointsPanel({ data }: { data: BillPayload }) {
  const { bill, deposits, points, setoffs } = data;
  const { can, meta } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const open = bill.status === 'A' || bill.status === 'F';
  const due = Math.max(0, bill.patient_due);
  const maxSet = round2(Math.min(deposits.usable, due));
  const [amt, setAmt] = useState('');
  const maxPts = Math.floor(Math.min(points.balance, due / (points.rate || 1)));
  const [pts, setPts] = useState('');
  useEffect(() => { setAmt(maxSet > 0 ? maxSet.toFixed(2) : ''); setPts(maxPts > 0 ? String(maxPts) : ''); }, [maxSet, maxPts]);

  const showDeposits = deposits.usable > 0.004 || setoffs.length > 0 || deposits.pending > 0;
  const showPoints = meta?.prefs.reward_points_enabled && (points.balance > 0 || bill.points_redeemed > 0);
  if (!showDeposits && !showPoints) return null;

  return (
    <RailCard title="Deposits and points">
      {showDeposits && (
        <div>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="flex items-center gap-1.5 text-ink-soft"><PiggyBank className="h-4 w-4 text-pine-600" />Usable deposit</span>
            <span className="font-semibold">{money(deposits.usable)}</span>
          </div>
          {deposits.pending > 0 && <p className="mt-0.5 text-[12px] text-ink-mute">{money(deposits.pending)} more after cheques clear</p>}
          {setoffs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {setoffs.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg bg-pine-50 px-2.5 py-1.5 text-[12.5px]">
                  <span>{s.deposit_no} set off</span>
                  <span className="flex items-center gap-2 font-medium">{money(s.amount)}
                    {open && can('allow_deposit_setoff') && (
                      <button type="button" aria-label={`Remove set-off from ${s.deposit_no}`} className="text-ink-mute hover:text-rose-600"
                        onClick={async () => { try { await run(`/bills/${bill.bill_no}/deposit-setoff/${s.id}`, 'DELETE'); toast({ tone: 'success', title: 'Set-off removed' }); } catch (e) { fail(e); } }}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {open && can('allow_deposit_setoff') && maxSet > 0 && (
            <div className="mt-2 flex gap-2">
              <MoneyInput value={amt} onChange={setAmt} className="flex-1" />
              <Button loading={pending} disabled={!(Number(amt) > 0) || Number(amt) > maxSet + 0.004}
                onClick={async () => { try { await run(`/bills/${bill.bill_no}/deposit-setoff`, 'POST', { amount: Number(amt) }); toast({ tone: 'success', title: `Set off ${money(Number(amt))} from deposits` }); } catch (e) { fail(e, 'Set-off failed'); } }}>
                Set off
              </Button>
            </div>
          )}
        </div>
      )}
      {showPoints && (
        <div className={clsx(showDeposits && 'mt-4 border-t border-line pt-3')}>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="flex items-center gap-1.5 text-ink-soft"><Gift className="h-4 w-4 text-indigo-500" />Reward points</span>
            <span className="font-semibold">{points.balance.toLocaleString('en-IN')} <span className="font-normal text-ink-mute">= {money(points.balance * points.rate)}</span></span>
          </div>
          {bill.points_redeemed > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[12.5px]">
              <span>{bill.points_redeemed} points used</span>
              <span className="flex items-center gap-2 font-medium">{money(bill.points_amount)}
                {open && <button type="button" aria-label="Release points" className="text-ink-mute hover:text-rose-600"
                  onClick={async () => { try { await run(`/bills/${bill.bill_no}/points`, 'DELETE'); toast({ tone: 'success', title: 'Points released' }); } catch (e) { fail(e); } }}><X className="h-3.5 w-3.5" /></button>}
              </span>
            </div>
          )}
          {open && maxPts > 0 && (
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <Input inputMode="numeric" value={pts} onChange={(e) => setPts(e.target.value.replace(/\D/g, ''))} className="pr-14 text-right" aria-label="Points to redeem" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">points</span>
              </div>
              <Button loading={pending} disabled={!(Number(pts) > 0) || Number(pts) > maxPts}
                onClick={async () => { try { await run(`/bills/${bill.bill_no}/points`, 'POST', { points: Number(pts) }); toast({ tone: 'success', title: `Redeemed ${pts} points` }); } catch (e) { fail(e, 'Points not redeemed'); } }}>
                Redeem
              </Button>
            </div>
          )}
        </div>
      )}
    </RailCard>
  );
}

export function RailCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="whitespace-nowrap text-[14px] font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

