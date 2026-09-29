'use client';
import {TableContainer} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { HeartPulse } from 'lucide-react';
import { useFormat } from '../../lib/format';
import { Row } from '../../lib/types';
import { StatusBadge } from '../ui/display';

/** A4-friendly invoice. Wrapped in .print-area so window.print() prints only this. */
export function InvoiceView({ inv, currency }: { inv: Row; currency: string }) {
  const { fmtDate, fmtDateTime, money } = useFormat();
  const p = inv.patient ?? {};
  const insured = inv.paymentClass === 'Insurance';
  const lines: Row[] = inv.lines ?? [];
  const adjustments: Row[] = inv.adjustments ?? [];
  const payments: Row[] = inv.payments ?? [];
  return (
    <TableContainer className="print-area space-y-4 text-hc-sm">
      <div className="flex items-start justify-between gap-4 border-b border-hc-line pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-hc-petrol-600 text-white"><HeartPulse className="h-5 w-5" /></span>
          <div>
            <p className="text-hc-base font-semibold">{inv.facility?.name ?? 'Al Noor Medical Center'}</p>
            <p className="text-hc-xs text-hc-ink-mute">{inv.facility?.city} <LocalizedText message="· Licence" /> {inv.facility?.licenseNo}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-hc-base font-semibold">{inv.category === 'Pharmacy' ? <LocalizedText message="Pharmacy invoice"/> : <LocalizedText message="Hospital invoice"/>}</p>
          <p className="font-mono text-hc-xs">{inv.invoiceNo}</p>
          <p className="text-hc-xs text-hc-ink-mute">{fmtDateTime(inv.createdAt)}</p>
          <div className="mt-1 flex justify-end gap-1"><StatusBadge status={inv.status} />{insured && inv.status !== 'Cancelled' && <StatusBadge status={inv.claimStatus} />}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-hc-xs sm:grid-cols-4">
        <div><p className="text-hc-ink-mute"><LocalizedText message="Patient" /></p><p className="font-medium">{p.fullName}</p><p className="font-mono">{p.mrn}</p></div>
        <div><p className="text-hc-ink-mute"><LocalizedText message="Encounter" /></p><p className="font-mono">{inv.encNo}</p><p>{inv.providerName || 'Pharmacy counter'}</p></div>
        <div className="col-span-2">
          <p className="text-hc-ink-mute"><LocalizedText message="Bill to" /></p>
          {insured && inv.policy ? (
            <><p className="font-medium">{inv.policy.payerName} · {inv.policy.planName}</p><p>{inv.policy.tpaName} · {inv.policy.networkName} · <span className="font-mono">{inv.policy.memberId}</span></p></>
          ) : <p className="font-medium"><LocalizedText message="Self-pay" /></p>}
        </div>
      </div>
      <Table className="w-full text-hc-xs">
        <TableHeader className="border-y border-hc-line bg-[#F6F8F7] text-hc-ink-mute">
          <TableRow className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-medium">
            <TableHead className="text-left"><LocalizedText message="Description" /></TableHead><TableHead className="text-right"><LocalizedText message="Qty" /></TableHead><TableHead className="text-right"><LocalizedText message="Unit" /></TableHead><TableHead className="text-right"><LocalizedText message="Gross" /></TableHead><TableHead className="text-right"><LocalizedText message="Discount" /></TableHead><TableHead className="text-right"><LocalizedText message="Net" /></TableHead>
            <TableHead className="text-right"><LocalizedText message="Patient" /></TableHead>{insured && <TableHead className="text-right"><LocalizedText message="Payer" /></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l, i) => (
            <TableRow key={i} className="border-b border-hc-line/70 [&>td]:px-2 [&>td]:py-1.5">
              <TableCell><span className="font-medium">{l.name}</span> <span className="font-mono text-hc-ink-mute">{l.code}</span>
                {(l.authorizationNo || l.note) && <span className="block text-hc-2xs text-hc-ink-mute">{l.authorizationNo ? <LocalizedText message="Auth {v0}" values={{v0:l.authorizationNo}}/> : ''}{l.authorizationNo && l.note ? ' · ' : ''}{l.note}</span>}</TableCell>
              <TableCell className="hc-num text-right">{l.qty}</TableCell><TableCell className="hc-num text-right">{money(l.unitPrice)}</TableCell><TableCell className="hc-num text-right">{money(l.gross)}</TableCell>
              <TableCell className="hc-num text-right">{money(l.discount)}</TableCell><TableCell className="hc-num text-right">{money(l.net)}</TableCell><TableCell className="hc-num text-right">{money(l.patientShare)}</TableCell>
              {insured && <TableCell className="hc-num text-right">{money(l.payerShare)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-[220px] space-y-1 text-hc-xs">
          <p className="font-medium text-hc-ink-soft"><LocalizedText message="Payments" /></p>
          {payments.length === 0 ? <p className="text-hc-ink-mute"><LocalizedText message="None collected" /></p> : payments.map((pm, i) => (
            <p key={i} className="hc-num flex justify-between gap-6"><span>{pm.mode}{pm.reference ? <LocalizedText message=" · {v0}" values={{v0:pm.reference}}/> : ''} · {fmtDate(pm.at)}</span><span>{money(pm.amount)}</span></p>
          ))}
          {inv.status === 'Cancelled' && <p className="mt-2 text-hc-danger-700"><LocalizedText message="Cancelled" /> {fmtDateTime(inv.cancelledAt)}: {inv.cancelReason}</p>}
        </div>
        <dl className="hc-num w-72 space-y-1 text-hc-xs">
          <div className="flex justify-between"><dt><LocalizedText message="Gross" /></dt><dd>{money(inv.gross)}</dd></div>
          <div className="flex justify-between"><dt><LocalizedText message="Discount" /></dt><dd>-{money(inv.discount)}</dd></div>
          <div className="flex justify-between font-medium"><dt><LocalizedText message="Net" /></dt><dd>{money(inv.net)}</dd></div>
          {adjustments.map((a, i) => <div key={i} className="flex justify-between text-hc-ink-mute"><dt>{a.label}</dt><dd>{money(a.amount)}</dd></div>)}
          {insured && <div className="flex justify-between text-hc-petrol-700"><dt><LocalizedText message="Claimed from payer" /></dt><dd>{money(inv.payerShare)}</dd></div>}
          <div className="flex justify-between border-t border-hc-line pt-1 text-hc-sm font-semibold"><dt><LocalizedText message="Patient share ({currency})" values={{currency}}/></dt><dd>{money(inv.patientShare)}</dd></div>
          <div className="flex justify-between"><dt><LocalizedText message="Paid" /></dt><dd>{money(inv.paid)}</dd></div>
          <div className={clsx('flex justify-between font-semibold', inv.balance > 0 ? 'text-hc-danger-700' : 'text-hc-ok-700')}><dt><LocalizedText message="Balance due" /></dt><dd>{money(inv.balance)}</dd></div>
        </dl>
      </div>
    </TableContainer>
  );
}
