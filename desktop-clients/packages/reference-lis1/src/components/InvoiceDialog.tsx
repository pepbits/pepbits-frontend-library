'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';


import { Button, ErrorNote, Field, Input, Modal, Select } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export const PAY_MODES = [{ value: 'CASH', label: 'Cash' }, { value: 'CARD', label: 'Card' }, { value: 'UPI', label: 'UPI / mobile' }, { value: 'BANK', label: 'Bank transfer' }, { value: 'INSURANCE', label: 'Insurance' }];

/** Bills all unbilled tests of an order, optionally taking a payment at the same time. */
export function InvoiceDialog({ open, order, onClose, onDone }: { open: boolean; order: any; onClose: () => void; onDone: (inv: any) => void }) {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {money}=useDiagnosticFormat();

  const unbilled = (order?.tests || []).filter((t: any) => !t.isBilled && t.status !== 'CANCELLED');
  const gross = unbilled.reduce((s: number, t: any) => s + (t.price || 0), 0);
  const [f, setF] = useState<any>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ discountPercent: '', discountAmount: '', payerType: 'SELF', payerName: '', pay: String(gross), mode: 'CASH', reference: '' }); setErr(null); } }, [open, gross]);
  const discount = f.discountPercent ? (gross * Number(f.discountPercent)) / 100 : Number(f.discountAmount) || 0;

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const inv = await api.post(`/billing/orders/${order.id}/invoice`, {
        discountPercent: f.discountPercent ? Number(f.discountPercent) : undefined,
        discountAmount: !f.discountPercent && f.discountAmount ? Number(f.discountAmount) : undefined,
        payerType: f.payerType, payerName: f.payerName || undefined,
        payment: Number(f.pay) > 0 ? { amount: Number(f.pay), mode: f.mode, reference: f.reference || undefined } : undefined,
      });
      onDone(inv); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={referenceT("Bill order {value0}", {value0: order?.orderNo ?? ''})}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={!unbilled.length} onClick={submit}><ReferenceText message="Create invoice" /></Button></>}>
      <ErrorNote error={err} />
      {!unbilled.length ? <div className="text-sm text-ink-soft"><ReferenceText message="All tests on this order are already billed." /></div> : (
        <div className="space-y-4">
          <DiagnosticTable className="tbl card">
            <TableHeader><TableRow><TableHead><ReferenceText message="Test" /></TableHead><TableHead className="text-right"><ReferenceText message="Price" /></TableHead></TableRow></TableHeader>
            <TableBody>{unbilled.map((t: any) => <TableRow key={t.id}><TableCell>{t.test?.name}</TableCell><TableCell className="num text-right">{money(t.price)}</TableCell></TableRow>)}</TableBody>
          </DiagnosticTable>
          <div className="grid grid-cols-2 gap-3">
            <Field label={referenceT("Payer")}>
              <Select value={f.payerType} onChange={(e) => setF({ ...f, payerType: e.target.value })} options={[{ value: 'SELF', label: 'Self pay' }, { value: 'INSURANCE', label: 'Insurance' }, { value: 'CORPORATE', label: 'Corporate' }]} />
            </Field>
            <Field label={referenceT("Payer name / policy")}><Input value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} disabled={f.payerType === 'SELF'} /></Field>
            <Field label={referenceT("Discount %")}><Input type="number" min={0} max={100} value={f.discountPercent} onChange={(e) => setF({ ...f, discountPercent: e.target.value, discountAmount: '' })} /></Field>
            <Field label={referenceT("or discount amount")}><Input type="number" min={0} value={f.discountAmount} onChange={(e) => setF({ ...f, discountAmount: e.target.value, discountPercent: '' })} /></Field>
          </div>
          <div className="rounded border border-line bg-paper p-3 text-sm">
            <div className="flex justify-between"><span><ReferenceText message="Gross" /></span><span className="num">{money(gross)}</span></div>
            <div className="flex justify-between text-ink-soft"><span><ReferenceText message="Discount" /></span><span className="num">− {money(discount)}</span></div>
            <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><span><ReferenceText message="Net (before tax)" /></span><span className="num">{money(gross - discount)}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={referenceT("Collect now")}><Input type="number" min={0} value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value })} /></Field>
            <Field label={referenceT("Mode")}><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={PAY_MODES} /></Field>
            <Field label={referenceT("Reference")}><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder={referenceT("Card / txn no.")} /></Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
