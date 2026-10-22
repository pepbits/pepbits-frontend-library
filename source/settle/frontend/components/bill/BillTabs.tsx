'use client';

import clsx from 'clsx';
import { ArrowUpRight, Printer, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { claimStatusLabel, dateTime, kindLabel, money, round2 } from '@/lib/format';
import type { AuditEntry, BillPayload } from '@/lib/types';
import { Badge, Empty } from '../ui/primitives';

/* ---------------------------------------------------------------- Sponsor */
export function SponsorTab({ data }: { data: BillPayload }) {
  const { bill, claims, charges } = data;
  const active = charges.filter((c) => c.status === 'A' && !c.is_system);
  const p2 = claims.find((c) => c.priority === 2);
  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        {claims.map((c) => {
          const claimed = c.priority === 1 ? bill.primary_claim : bill.secondary_claim;
          const received = data.receipts.filter((r) => r.payment_type === 'S' && r.sponsor_index === (c.priority === 1 ? 'P' : 'S')).reduce((s, r) => s + r.amount + r.tds_amount, 0);
          return (
            <div key={c.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] text-indigo-700">{c.priority === 1 ? 'Primary sponsor' : 'Secondary sponsor'}</p>
                  <p className="text-[16px] font-semibold">{c.sponsor_name}</p>
                  <p className="text-[13px] text-ink-soft">{c.plan_name}</p>
                </div>
                <Badge tone={c.claim_status === 'O' ? 'gray' : c.claim_status === 'S' ? 'indigo' : 'pine'}>{claimStatusLabel(c.claim_status)}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
                <div><dt className="text-ink-mute">Copay</dt><dd className="font-medium">{c.copay_pct}%</dd></div>
                <div><dt className="text-ink-mute">Claim cap</dt><dd className="font-medium">{c.claim_cap ? money(c.claim_cap, { whole: true }) : 'None'}</dd></div>
                <div><dt className="text-ink-mute">Claimed</dt><dd className="font-medium">{money(claimed)}</dd></div>
                <div><dt className="text-ink-mute">Received</dt><dd className="font-medium">{money(received)}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl">
          <thead>
            <tr><th>Item</th><th className="num">Net</th><th className="num">Primary</th>{p2 && <th className="num">Secondary</th>}<th className="num">Sponsor GST</th><th className="num">Patient</th></tr>
          </thead>
          <tbody>
            {active.map((c) => {
              const net = round2(c.amount - c.discount);
              return (
                <tr key={c.charge_id}>
                  <td>
                    <span className="font-medium">{c.description}</span>
                    {!c.insurance_payable && <Badge className="ml-2">Not covered</Badge>}
                    {c.claim_override ? <Badge tone="indigo" className="ml-2">Edited</Badge> : null}
                  </td>
                  <td className="num">{money(net)}</td>
                  <td className="num text-indigo-600">{money(c.primary_claim)}</td>
                  {p2 && <td className="num text-indigo-600">{money(c.secondary_claim)}</td>}
                  <td className="num">{money(c.sponsor_vat)}</td>
                  <td className="num font-medium">{money(net + c.vat - c.primary_claim - c.secondary_claim - c.sponsor_vat)}</td>
                </tr>
              );
            })}
            <tr className="bg-mist/60 font-semibold">
              <td>Total</td>
              <td className="num">{money(bill.total_amount - bill.round_off - bill.total_discount)}</td>
              <td className="num">{money(bill.primary_claim)}</td>
              {p2 && <td className="num">{money(bill.secondary_claim)}</td>}
              <td className="num">{money(bill.sponsor_vat)}</td>
              <td className="num">{money(bill.patient_amount - bill.round_off)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-2 text-[12.5px] text-ink-mute"><ShieldCheck className="h-4 w-4" />Open any charge to set its claim by hand. Edited claims are kept when the bill recalculates.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- Payments */
export function PaymentsTab({ data }: { data: BillPayload }) {
  const { receipts, setoffs, bill } = data;
  if (!receipts.length && !setoffs.length && !bill.points_redeemed) {
    return <Empty title="No money recorded yet" body="Payments, refunds, deposit set-offs and points used on this bill will appear here." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr><th>Number</th><th>When</th><th>Type</th><th>Mode</th><th className="hidden md:table-cell">Counter</th><th className="hidden md:table-cell">By</th><th className="num">Amount</th><th className="w-16" /></tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.receipt_no} className={clsx(r.status === 'X' && 'text-ink-mute')}>
              <td className="whitespace-nowrap font-medium">
                <Link href={`/receipts?open=${r.receipt_no}`} className="hover:text-pine-700 hover:underline">{r.receipt_no}</Link>
                {r.status === 'X' && <Badge tone="rose" className="ml-2">Cancelled</Badge>}
                {r.reversal_of && <Badge className="ml-2">Reverses {r.reversal_of}</Badge>}
                {r.source === 'system' && <Badge tone="sky" className="ml-2">Automatic</Badge>}
              </td>
              <td className="whitespace-nowrap text-ink-soft">{dateTime(r.created_at)}</td>
              <td>{r.reversal_of ? 'Cancellation' : r.label}</td>
              <td className="whitespace-nowrap">{r.mode_name}{r.card_last4 ? ` ••${r.card_last4}` : ''}{r.reference ? <span className="text-ink-mute"> {r.reference}</span> : ''}</td>
              <td className="hidden text-ink-soft md:table-cell">{r.counter_name}</td>
              <td className="hidden text-ink-soft md:table-cell">{r.username}</td>
              <td className={clsx('num font-medium', r.status === 'X' && 'line-through')}>{money(r.amount + r.tds_amount)}</td>
              <td className="text-right">
                <a href={`/print/receipt/${r.receipt_no}`} target="_blank" rel="noreferrer" aria-label={`Print ${r.receipt_no}`} className="inline-flex rounded-md p-1.5 text-ink-mute hover:bg-mist hover:text-ink">
                  <Printer className="h-3.5 w-3.5" />
                </a>
              </td>
            </tr>
          ))}
          {setoffs.map((s) => (
            <tr key={`s${s.id}`}>
              <td className="font-medium"><Link href={`/patients/${bill.mr_no}`} className="hover:text-pine-700 hover:underline">{s.deposit_no}</Link></td>
              <td className="text-ink-soft">{dateTime(s.created_at)}</td>
              <td>Deposit set-off</td><td className="text-ink-soft">From deposit</td>
              <td className="hidden md:table-cell" /><td className="hidden text-ink-soft md:table-cell">{s.username}</td>
              <td className="num font-medium">{money(s.amount)}</td><td />
            </tr>
          ))}
          {bill.points_redeemed > 0 && (
            <tr><td className="font-medium">Points</td><td /><td>{bill.points_redeemed} reward points</td><td className="text-ink-soft">Redeemed</td>
              <td className="hidden md:table-cell" /><td className="hidden md:table-cell" /><td className="num font-medium">{money(bill.points_amount)}</td><td /></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- Approvals */
export function ApprovalsTab({ data }: { data: BillPayload }) {
  if (!data.approvals.length) return <Empty title="No approvals on this bill" body="Discounts above the limit, write-offs and cancellations land here with their decision." />;
  return (
    <ul className="divide-y divide-line">
      {data.approvals.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium">{kindLabel(a.kind)} of {money(a.amount)}</p>
            <p className="text-[13px] text-ink-soft">{a.reason || 'No reason given'}</p>
            {a.payload.changes?.map((c) => <p key={c.chargeId} className="text-[12.5px] text-ink-mute">{c.description}: {money(c.from)} → {money(c.to)}</p>)}
            <p className="mt-1 text-[12px] text-ink-mute">Requested by {a.requested_by}, {dateTime(a.requested_at)}{a.decided_by ? `. ${a.status === 'approved' ? 'Approved' : 'Rejected'} by ${a.decided_by}, ${dateTime(a.decided_at)}` : ''}</p>
            {a.decision_note && <p className="text-[12.5px] italic text-ink-soft">“{a.decision_note}”</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={a.status === 'pending' ? 'marigold' : a.status === 'approved' ? 'pine' : 'rose'}>{a.status === 'pending' ? 'Waiting' : a.status === 'approved' ? 'Approved' : 'Rejected'}</Badge>
            {a.status === 'pending' && <Link href={`/approvals?id=${a.id}`} className="inline-flex items-center text-[13px] font-medium text-pine-700 hover:underline">Review<ArrowUpRight className="h-3.5 w-3.5" /></Link>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- Timeline */
const ACTION_TONE: Record<string, string> = {
  create: 'bg-pine-500', finalize: 'bg-indigo-500', close: 'bg-pine-700', reopen: 'bg-marigold-500', cancel: 'bg-rose-500',
  discount_requested: 'bg-marigold-500', writeoff_requested: 'bg-marigold-500', cancel_requested: 'bg-rose-500', claim_sent: 'bg-indigo-500',
};

export function Timeline({ entries, showBill }: { entries: AuditEntry[]; showBill?: boolean }) {
  if (!entries.length) return <Empty title="No history yet" />;
  let lastDay = '';
  return (
    <ol className="relative px-4 py-2">
      {entries.map((h) => {
        const day = new Date(h.at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <li key={h.id}>
            {showDay && <p className="sticky top-0 z-[1] -mx-4 bg-white/95 px-4 pb-1 pt-3 text-[12px] font-semibold text-ink-soft backdrop-blur">{day}</p>}
            <div className="relative flex gap-3 border-l border-line py-2 pl-5">
              <span className={clsx('absolute -left-[5px] top-3.5 h-[9px] w-[9px] rounded-full ring-4 ring-white', ACTION_TONE[h.action] || 'bg-line-strong')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-ink">{h.summary}</p>
                <p className="text-[12px] text-ink-mute">
                  {new Date(h.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })} by {h.username}
                  {showBill && h.bill_no ? <> on <Link href={`/bills/${h.bill_no}`} className="text-pine-700 hover:underline">{h.bill_no}</Link></> : null}
                  {!showBill && h.entity !== 'bill' ? ` (${h.entity} ${h.entity_id})` : ''}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
