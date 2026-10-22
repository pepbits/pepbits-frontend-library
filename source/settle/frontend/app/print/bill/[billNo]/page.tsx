'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PrintSheet, rupeesInWords } from '@/components/PrintSheet';
import { ErrorNote, Skeleton } from '@/components/ui/primitives';
import { useApi } from '@/lib/api';
import { age, billTypeLabel, date, dateTime, GROUP_LABEL, money, STATUS } from '@/lib/format';
import type { BillPayload, Charge } from '@/lib/types';

export default function PrintBill() {
  return <Suspense fallback={<Skeleton className="mx-auto h-[600px] max-w-[210mm]" />}><Inner /></Suspense>;
}

function Inner() {
  const { billNo } = useParams<{ billNo: string }>();
  const detail = useSearchParams().get('detail') === '1';
  const { data, error } = useApi<BillPayload>(`/bills/${billNo}`);
  if (error) return <div className="mx-auto max-w-xl"><ErrorNote error={error} /></div>;
  if (!data) return <Skeleton className="mx-auto h-[600px] max-w-[210mm]" />;
  const { bill, patient, visit, charges, receipts, setoffs, claims } = data;
  const active = charges.filter((c) => c.status === 'A' && !c.is_system);
  const groups = new Map<string, Charge[]>();
  for (const c of active) groups.set(c.charge_group, [...(groups.get(c.charge_group) || []), c]);
  const paid = bill.total_receipts + bill.deposit_set_off + bill.points_amount;
  const title = detail ? 'Itemized statement' : bill.status === 'A' ? 'Interim bill' : bill.is_tpa ? 'Final bill (insured)' : 'Final bill';

  return (
    <PrintSheet title={title}>
      <section className="grid grid-cols-2 gap-x-8 gap-y-1 border-b border-line py-3">
        <p><span className="text-ink-mute">Patient </span><b>{patient.name}</b></p>
        <p><span className="text-ink-mute">Bill no. </span><b>{bill.bill_no}</b> ({billTypeLabel(bill.bill_type)}, {STATUS[bill.status].label})</p>
        <p><span className="text-ink-mute">MR no. </span>{patient.mr_no}{patient.gender ? `, ${patient.gender}` : ''}{age(patient.dob) !== null ? `, ${age(patient.dob)} y` : ''}</p>
        <p><span className="text-ink-mute">Bill date </span>{date(bill.finalized_at || bill.created_at)}</p>
        <p><span className="text-ink-mute">Visit </span>{visit.visit_id}, {visit.visit_type === 'i' ? 'inpatient' : 'outpatient'}</p>
        <p><span className="text-ink-mute">Doctor </span>{visit.doctor || '—'}{visit.department ? `, ${visit.department}` : ''}</p>
        {claims.length > 0 && <p className="col-span-2"><span className="text-ink-mute">Sponsor </span>{claims.map((c) => `${c.sponsor_name} (${c.plan_name})`).join(', then ')}</p>}
      </section>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-b border-ink text-left text-[11.5px] text-ink-soft">
            <th className="py-1.5 font-medium">Description</th>{detail && <th className="py-1.5 font-medium">Date</th>}
            <th className="py-1.5 text-right font-medium">Rate</th><th className="py-1.5 text-right font-medium">Qty</th>
            <th className="py-1.5 text-right font-medium">Discount</th><th className="py-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.entries()].map(([g, rows]) => (
            <GroupBlock key={g} label={GROUP_LABEL[g] || g} rows={rows} detail={detail} />
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="w-[300px] space-y-1">
          <Line label="Gross amount" v={bill.total_amount - bill.round_off} />
          {bill.total_discount > 0 && <Line label="Discount" v={-bill.total_discount} />}
          {bill.total_vat > 0 && <Line label="GST" v={bill.total_vat} />}
          {bill.is_tpa ? <Line label="Payable by sponsor" v={-(bill.total_claim + bill.sponsor_vat)} /> : null}
          {Math.abs(bill.round_off) > 0.004 && <Line label="Round-off" v={bill.round_off} />}
          <Line label="Patient amount" v={bill.patient_amount} strong />
          <Line label="Received" v={-paid} />
          <Line label={bill.patient_due < 0 ? 'Refundable' : 'Balance due'} v={Math.abs(bill.patient_due)} strong />
        </dl>
      </section>
      <p className="mt-2 text-right italic text-ink-soft">{rupeesInWords(bill.patient_amount)}</p>

      {(receipts.length > 0 || setoffs.length > 0) && (
        <section className="mt-5">
          <p className="mb-1 font-semibold">Payments</p>
          <table className="w-full border-collapse text-[11.5px]">
            <tbody>
              {receipts.filter((r) => r.status === 'A' || r.reversal_of).map((r) => (
                <tr key={r.receipt_no} className="border-b border-line/70"><td className="py-1">{r.receipt_no}</td><td>{dateTime(r.created_at)}</td><td>{r.reversal_of ? 'Cancellation' : r.label}</td><td>{r.mode_name}</td><td className="text-right">{money(r.amount)}</td></tr>
              ))}
              {setoffs.map((s) => <tr key={s.id} className="border-b border-line/70"><td className="py-1">{s.deposit_no}</td><td>{dateTime(s.created_at)}</td><td>Deposit set-off</td><td /><td className="text-right">{money(s.amount)}</td></tr>)}
            </tbody>
          </table>
        </section>
      )}
      <div className="mt-12 flex justify-between text-[11.5px] text-ink-soft">
        <span>Prepared by {bill.finalized_by || bill.created_by}</span><span>Authorized signatory</span>
      </div>
    </PrintSheet>
  );
}

function GroupBlock({ label, rows, detail }: { label: string; rows: Charge[]; detail: boolean }) {
  const total = rows.reduce((s, c) => s + c.amount - c.discount, 0);
  if (!detail) {
    return (
      <tr className="border-b border-line/70">
        <td className="py-1.5">{label} <span className="text-ink-mute">({rows.length} item{rows.length > 1 ? 's' : ''})</span></td>
        <td /><td /><td className="text-right">{money(rows.reduce((s, c) => s + c.discount, 0))}</td><td className="text-right">{money(total)}</td>
      </tr>
    );
  }
  return (
    <>
      <tr><td colSpan={6} className="pb-0.5 pt-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">{label}</td></tr>
      {rows.map((c) => (
        <tr key={c.charge_id} className="border-b border-line/60">
          <td className="py-1">{c.description}</td><td>{date(c.posted_at)}</td><td className="text-right">{money(c.rate)}</td><td className="text-right">{c.qty}</td>
          <td className="text-right">{c.discount ? money(c.discount) : ''}</td><td className="text-right">{money(c.amount - c.discount)}</td>
        </tr>
      ))}
    </>
  );
}

function Line({ label, v, strong }: { label: string; v: number; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? 'border-t border-ink pt-1 text-[13.5px] font-semibold' : ''}`}><dt>{label}</dt><dd className="tabular-nums">{money(v)}</dd></div>;
}
