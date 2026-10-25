'use client';

import {TableRow} from '@pepbits/components';

import clsx from 'clsx';
import { ArrowUpRight, Printer, ShieldCheck } from '@pepbits/icons';
import { Link } from '../../host';
import { claimStatusLabel, kindLabel, round2, useFormat } from '../../lib/format';
import type { AuditEntry, BillPayload } from '../../lib/types';
import { Badge, Empty, SettleTable } from '../ui/primitives';

/* ---------------------------------------------------------------- Sponsor */
export function SponsorTab({ data }: { data: BillPayload }) {
  const { money } = useFormat();
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
                  <p className="text-[length:calc(12px*var(--fs-scale,1))] text-indigo-700">{c.priority === 1 ? 'Primary sponsor' : 'Secondary sponsor'}</p>
                  <p className="text-[length:calc(16px*var(--fs-scale,1))] font-semibold">{c.sponsor_name}</p>
                  <p className="text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">{c.plan_name}</p>
                </div>
                <Badge tone={c.claim_status === 'O' ? 'gray' : c.claim_status === 'S' ? 'indigo' : 'pine'}>{claimStatusLabel(c.claim_status)}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[length:calc(12.5px*var(--fs-scale,1))]">
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
        <SettleTable>
          <thead>
            <TableRow><th>Item</th><th className="num">Net</th><th className="num">Primary</th>{p2 && <th className="num">Secondary</th>}<th className="num">Sponsor GST</th><th className="num">Patient</th></TableRow>
          </thead>
          <tbody>
            {active.map((c) => {
              const net = round2(c.amount - c.discount);
              return (
                <TableRow key={c.charge_id}>
                  <td>
                    <span className="font-medium">{c.description}</span>
                    {!c.insurance_payable && <Badge className="ms-2">Not covered</Badge>}
                    {c.claim_override ? <Badge tone="indigo" className="ms-2">Edited</Badge> : null}
                  </td>
                  <td className="num">{money(net)}</td>
                  <td className="num text-indigo-600">{money(c.primary_claim)}</td>
                  {p2 && <td className="num text-indigo-600">{money(c.secondary_claim)}</td>}
                  <td className="num">{money(c.sponsor_vat)}</td>
                  <td className="num font-medium">{money(net + c.vat - c.primary_claim - c.secondary_claim - c.sponsor_vat)}</td>
                </TableRow>
              );
            })}
            <TableRow className="bg-mist/60 font-semibold">
              <td>Total</td>
              <td className="num">{money(bill.total_amount - bill.round_off - bill.total_discount)}</td>
              <td className="num">{money(bill.primary_claim)}</td>
              {p2 && <td className="num">{money(bill.secondary_claim)}</td>}
              <td className="num">{money(bill.sponsor_vat)}</td>
              <td className="num">{money(bill.patient_amount - bill.round_off)}</td>
            </TableRow>
          </tbody>
        </SettleTable>
      </div>
      <p className="flex items-center gap-2 text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-mute"><ShieldCheck className="h-4 w-4" />Open any charge to set its claim by hand. Edited claims are kept when the bill recalculates.</p>
    </div>
  );
}

/* ---------------------------------------------------------------- Payments */
export function PaymentsTab({ data }: { data: BillPayload }) {
  const { money, dateTime } = useFormat();
  const { receipts, setoffs, bill } = data;
  if (!receipts.length && !setoffs.length && !bill.points_redeemed) {
    return <Empty title="No money recorded yet" body="Payments, refunds, deposit set-offs and points used on this bill will appear here." />;
  }
  return (
    <div className="overflow-x-auto">
      <SettleTable>
        <thead>
          <TableRow><th>Number</th><th>When</th><th>Type</th><th>Mode</th><th className="hidden md:table-cell">Counter</th><th className="hidden md:table-cell">By</th><th className="num">Amount</th><th className="w-16"><span className="sr-only">Print</span></th></TableRow>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <TableRow key={r.receipt_no} className={clsx(r.status === 'X' && 'text-ink-mute')}>
              <td className="whitespace-nowrap font-medium">
                <Link href={`/receipts?open=${r.receipt_no}`} className="hover:text-pine-700 hover:underline">{r.receipt_no}</Link>
                {r.status === 'X' && <Badge tone="rose" className="ms-2">Cancelled</Badge>}
                {r.reversal_of && <Badge className="ms-2">Reverses {r.reversal_of}</Badge>}
                {r.source === 'system' && <Badge tone="sky" className="ms-2">Automatic</Badge>}
              </td>
              <td className="whitespace-nowrap text-ink-soft">{dateTime(r.created_at)}</td>
              <td>{r.reversal_of ? 'Cancellation' : r.label}</td>
              <td className="whitespace-nowrap">{r.mode_name}{r.card_last4 ? ` ••${r.card_last4}` : ''}{r.reference ? <span className="text-ink-mute"> {r.reference}</span> : ''}</td>
              <td className="hidden text-ink-soft md:table-cell">{r.counter_name}</td>
              <td className="hidden text-ink-soft md:table-cell">{r.username}</td>
              <td className={clsx('num font-medium', r.status === 'X' && 'line-through')}>{money(r.amount + r.tds_amount)}</td>
              <td className="text-end">
                <Link href={`/print/receipt/${r.receipt_no}`} target="_blank" rel="noreferrer" aria-label={`Print ${r.receipt_no}`} className="inline-flex rounded-md p-1.5 text-ink-mute hover:bg-mist hover:text-ink">
                  <Printer className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </td>
            </TableRow>
          ))}
          {setoffs.map((s) => (
            <TableRow key={`s${s.id}`}>
              <td className="font-medium"><Link href={`/patients/${bill.mr_no}`} className="hover:text-pine-700 hover:underline">{s.deposit_no}</Link></td>
              <td className="text-ink-soft">{dateTime(s.created_at)}</td>
              <td>Deposit set-off</td><td className="text-ink-soft">From deposit</td>
              <td className="hidden md:table-cell" /><td className="hidden text-ink-soft md:table-cell">{s.username}</td>
              <td className="num font-medium">{money(s.amount)}</td><td />
            </TableRow>
          ))}
          {bill.points_redeemed > 0 && (
            <TableRow><td className="font-medium">Points</td><td /><td>{bill.points_redeemed} reward points</td><td className="text-ink-soft">Redeemed</td>
              <td className="hidden md:table-cell" /><td className="hidden md:table-cell" /><td className="num font-medium">{money(bill.points_amount)}</td><td /></TableRow>
          )}
        </tbody>
      </SettleTable>
    </div>
  );
}

/* ---------------------------------------------------------------- Approvals */
export function ApprovalsTab({ data }: { data: BillPayload }) {
  const { money, dateTime } = useFormat();
  if (!data.approvals.length) return <Empty title="No approvals on this bill" body="Discounts above the limit, write-offs and cancellations land here with their decision." />;
  return (
    <ul className="divide-y divide-line">
      {data.approvals.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[length:calc(14px*var(--fs-scale,1))] font-medium">{kindLabel(a.kind)} of {money(a.amount)}</p>
            <p className="text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">{a.reason || 'No reason given'}</p>
            {a.payload.changes?.map((c) => <p key={c.chargeId} className="text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-mute">{c.description}: {money(c.from)} → {money(c.to)}</p>)}
            <p className="mt-1 text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">Requested by {a.requested_by}, {dateTime(a.requested_at)}{a.decided_by ? `. ${a.status === 'approved' ? 'Approved' : 'Rejected'} by ${a.decided_by}, ${dateTime(a.decided_at)}` : ''}</p>
            {a.decision_note && <p className="text-[length:calc(12.5px*var(--fs-scale,1))] italic text-ink-soft">“{a.decision_note}”</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={a.status === 'pending' ? 'marigold' : a.status === 'approved' ? 'pine' : 'rose'}>{a.status === 'pending' ? 'Waiting' : a.status === 'approved' ? 'Approved' : 'Rejected'}</Badge>
            {a.status === 'pending' && <Link href={`/approvals?id=${a.id}`} className="inline-flex items-center text-[length:calc(13px*var(--fs-scale,1))] font-medium text-pine-700 hover:underline">Review<ArrowUpRight className="rtl:-scale-x-100 h-3.5 w-3.5" /></Link>}
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
  const { weekdayDate, time } = useFormat();
  if (!entries.length) return <Empty title="No history yet" />;
  let lastDay = '';
  return (
    <ol className="relative px-4 py-2">
      {entries.map((h) => {
        const day = weekdayDate(h.at);
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <li key={h.id}>
            {showDay && <p className="sticky top-0 z-[1] -mx-4 bg-panel/95 px-4 pb-1 pt-3 text-[length:calc(12px*var(--fs-scale,1))] font-semibold text-ink-soft backdrop-blur">{day}</p>}
            <div className="relative flex gap-3 border-s border-line py-2 ps-5">
              <span className={clsx('absolute -start-[5px] top-3.5 h-[9px] w-[9px] rounded-full ring-4 ring-panel', ACTION_TONE[h.action] || 'bg-line-strong')} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[length:calc(13.5px*var(--fs-scale,1))] text-ink">{h.summary}</p>
                <p className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">
                  {time(h.at)} by {h.username}
                  {showBill && h.bill_no ? <> on <Link href={`/bills/${h.bill_no}`} className="text-pine-700 underline">{h.bill_no}</Link></> : null}
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
