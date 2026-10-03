'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';


import { Button, Field, Input, Modal, Select } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function PaymentModal({ bill, open, onClose, onPaid }: { bill: any; open: boolean; onClose: () => void; onPaid: (b: any) => void }) {
 const referenceT = useReferenceLocalization().t;

 const {post}=useDiagnosticClient();
 const {money}=useDiagnosticFormat();

  const balance = bill ? Math.max(0, Number(bill.net) - Number(bill.paid)) : 0;
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setAmount(balance ? balance.toFixed(2) : ''); setMode('CASH'); setRef(''); setErr(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = async () => {
    setBusy(true); setErr(null);
    try { onPaid(await post(`/billing/${bill.id}/payments`, { amount: Number(amount), mode, reference: ref || undefined })); onClose(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  if (!bill) return null;
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Payment for {value0}", {value0: bill.bill_no})}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={pay}>{mode === 'REFUND' ? 'Record refund' : 'Record payment'}</Button></>}>
      <p className="mb-3 text-sm text-ink-soft"><ReferenceText message="Net" /> {money(bill.net)}<ReferenceText message=", paid" /> {money(bill.paid)}<ReferenceText message=", balance" /> <span className="font-semibold text-ink">{money(balance)}</span></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={referenceT("Amount")}><Input type="number" min="0" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={referenceT("Mode")}><Select value={mode} onChange={setMode} options={['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE', 'REFUND']} /></Field>
        <Field label={referenceT("Reference")} className="sm:col-span-2" hint={referenceT("Card approval code, UPI reference, claim number…")}><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-crit">{err}</p>}
    </Modal>
  );
}
