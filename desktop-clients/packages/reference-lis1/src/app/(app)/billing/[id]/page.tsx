'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';

import {useParams} from '@pepbits/reference-diagnostics';
import { Ban, Printer, Undo2, Wallet } from 'lucide-react';

import { useAuth } from '../../../../lib/auth';
import { useApi } from '../../../../lib/hooks';

import { Badge, Button, ErrorNote, Field, Input, Loading, Modal, PageHeader, ReasonDialog, Select, useAction } from '../../../../components/ui';
import { PAY_MODES } from '../../../../components/InvoiceDialog';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function InvoicePage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime,money}=useDiagnosticFormat();

  const { id } = useParams<{ id: string }>();
  const { data: inv, error, reload } = useApi<any>(`/billing/invoices/${id}`);
  const { can } = useAuth();
  const [pay, setPay] = useState<null | 'PAYMENT' | 'REFUND'>(null);
  const [f, setF] = useState({ amount: '', mode: 'CASH', reference: '' });
  const [cancel, setCancel] = useState(false);
  const { busy, run } = useAction();

  if (error) return <ErrorNote error={error} />;
  if (!inv) return <Loading />;
  const c = inv.currency;
  const due = Math.max(0, inv.netAmount - inv.paidAmount);

  const openPay = (type: 'PAYMENT' | 'REFUND') => { setF({ amount: type === 'PAYMENT' ? String(due) : '', mode: 'CASH', reference: '' }); setPay(type); };
  const submitPay = () => run('pay', () => api.post(`/billing/invoices/${inv.id}/payments`, { amount: Number(f.amount), mode: f.mode, reference: f.reference || undefined, type: pay }), pay === 'REFUND' ? 'Refund recorded' : 'Payment recorded')
    .then((r) => { if (r) { setPay(null); reload(); } });

  return (
    <div>
      <PageHeader title={referenceT("Invoice {value0}", {value0: inv.invoiceNo})} subtitle={<><ReferenceText message="Order" /> <Link className="font-mono text-lab-700 hover:underline" href={`/orders/${inv.orderId}`}>{inv.order?.orderNo}</Link> · <Badge value={inv.status} /></>}
        actions={<>
          {can('RECEPTION') && inv.status !== 'CANCELLED' && due > 0 && <Button variant="primary" icon={Wallet} onClick={() => openPay('PAYMENT')}><ReferenceText message="Receive payment" /></Button>}
          {can('RECEPTION') && inv.status !== 'CANCELLED' && inv.paidAmount > 0 && <Button icon={Undo2} onClick={() => openPay('REFUND')}><ReferenceText message="Refund" /></Button>}
          {can('RECEPTION') && inv.status !== 'CANCELLED' && <Button variant="danger" icon={Ban} onClick={() => setCancel(true)}><ReferenceText message="Cancel invoice" /></Button>}
          <Button icon={Printer} onClick={() => window.print()}><ReferenceText message="Print" /></Button>
        </>} />

      <div className="print-area card mx-auto max-w-3xl bg-white p-8">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <div className="text-lg font-semibold">{inv.lab?.name}</div>
            <div className="whitespace-pre-line text-xs text-ink-soft">{inv.lab?.address}</div>
            <div className="text-xs text-ink-soft">{[inv.lab?.phone, inv.lab?.email].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="text-right">
            <div className="text-base font-semibold">{inv.status === 'CANCELLED' ? 'Cancelled invoice' : 'Invoice'}</div>
            <div className="font-mono text-sm">{inv.invoiceNo}</div>
            <div className="text-xs text-ink-soft">{fmtDateTime(inv.createdAt)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div><div className="label"><ReferenceText message="Bill to" /></div><div className="font-medium">{inv.patient?.fullName}</div><div className="font-mono text-xs">{inv.patient?.mrn}</div></div>
          <div className="text-right"><div className="label"><ReferenceText message="Payer" /></div>{inv.payerType}{inv.payerName ? ` · ${inv.payerName}` : ''}<div className="text-xs text-ink-soft"><ReferenceText message="Order" /> {inv.order?.orderNo}</div></div>
        </div>
        <DiagnosticTable className="tbl">
          <TableHeader><TableRow><TableHead>#</TableHead><TableHead><ReferenceText message="Description" /></TableHead><TableHead className="text-right"><ReferenceText message="Amount" /></TableHead></TableRow></TableHeader>
          <TableBody>{inv.items.map((it: any, i: number) => <TableRow key={it.id}><TableCell className="w-8 text-ink-mute">{i + 1}</TableCell><TableCell>{it.description}</TableCell><TableCell className="num text-right">{money(it.amount, c)}</TableCell></TableRow>)}</TableBody>
        </DiagnosticTable>
        <div className="ml-auto mt-3 w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span><ReferenceText message="Gross" /></span><span className="num">{money(inv.grossAmount, c)}</span></div>
          <div className="flex justify-between"><span><ReferenceText message="Discount" /></span><span className="num">− {money(inv.discountAmount, c)}</span></div>
          <div className="flex justify-between"><span><ReferenceText message="Tax" /></span><span className="num">{money(inv.taxAmount, c)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 font-semibold"><span><ReferenceText message="Net" /></span><span className="num">{money(inv.netAmount, c)}</span></div>
          <div className="flex justify-between"><span><ReferenceText message="Paid" /></span><span className="num">{money(inv.paidAmount, c)}</span></div>
          <div className="flex justify-between font-semibold"><span><ReferenceText message="Balance due" /></span><span className="num">{money(due, c)}</span></div>
        </div>
        {inv.payments.length > 0 && (
          <div className="mt-6">
            <div className="mb-1 text-sm font-semibold"><ReferenceText message="Payments" /></div>
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow><TableHead><ReferenceText message="Date" /></TableHead><TableHead><ReferenceText message="Type" /></TableHead><TableHead><ReferenceText message="Mode" /></TableHead><TableHead><ReferenceText message="Reference" /></TableHead><TableHead className="text-right"><ReferenceText message="Amount" /></TableHead></TableRow></TableHeader>
              <TableBody>{inv.payments.map((p: any) => (
                <TableRow key={p.id}><TableCell className="text-xs">{fmtDateTime(p.createdAt)}</TableCell><TableCell>{p.type === 'REFUND' ? 'Refund' : 'Payment'}</TableCell><TableCell>{p.mode}</TableCell><TableCell>{p.reference || '—'}</TableCell>
                  <TableCell className={`num text-right ${p.type === 'REFUND' ? 'text-flag-crit' : ''}`}>{p.type === 'REFUND' ? '− ' : ''}{money(p.amount, c)}</TableCell></TableRow>
              ))}</TableBody>
            </DiagnosticTable>
          </div>
        )}
        {inv.notes && <div className="mt-4 text-xs text-ink-soft"><ReferenceText message="Notes:" /> {inv.notes}</div>}
      </div>

      <Modal open={!!pay} onClose={() => setPay(null)} title={pay === 'REFUND' ? 'Record refund' : 'Receive payment'} width="max-w-md"
        footer={<><Button onClick={() => setPay(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy === 'pay'} onClick={submitPay}><ReferenceText message="Save" /></Button></>}>
        <div className="space-y-3">
          <Field label={referenceT("Amount")} hint={pay === 'PAYMENT' ? `Balance due ${money(due, c)}` : `Paid so far ${money(inv.paidAmount, c)}`}><Input type="number" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label={referenceT("Mode")}><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={PAY_MODES} /></Field>
          <Field label={referenceT("Reference")}><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        </div>
      </Modal>
      <ReasonDialog open={cancel} title={referenceT("Cancel invoice")} label={referenceT("Reason")} confirmLabel={referenceT("Cancel invoice")} variant="danger" onClose={() => setCancel(false)}
        onSubmit={async (reason) => { await api.post(`/billing/invoices/${inv.id}/cancel`, { reason }); reload(); }} />
    </div>
  );
}
