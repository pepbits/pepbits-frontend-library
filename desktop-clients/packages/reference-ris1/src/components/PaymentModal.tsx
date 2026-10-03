'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {useFmt} from '../lib/client';
import { Field, Modal, useToast } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Takes a payment or applies a discount on an invoice. */
export default function PaymentModal({ invoice, onClose, onDone }: { invoice: any | null; onClose: () => void; onDone: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api}=useDiagnosticClient();

  const toast = useToast();
  const balance = invoice ? Math.max(0, invoice.net - invoice.paid) : 0;
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [reference, setReference] = useState('');
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (invoice) { setAmount(balance.toFixed(2)); setDiscount(String(invoice.discount || 0)); setReference(''); setMode('CASH'); }
  }, [invoice, balance]);

  if (!invoice) return null;

  const pay = async () => {
    setBusy(true);
    try {
      await api(`/api/billing/${invoice.id}`, { method: 'POST', json: { action: 'pay', amount: Number(amount), mode, reference } });
      toast('ok', `Payment of ${fmt.money(Number(amount))} recorded on ${invoice.invoice_no}`);
      onDone();
    } catch (e: any) { toast('error', e.message); } finally { setBusy(false); }
  };
  const adjust = async () => {
    setBusy(true);
    try {
      await api(`/api/billing/${invoice.id}`, { method: 'POST', json: { action: 'adjust', discount: Number(discount) } });
      toast('ok', 'Discount applied');
      onDone();
    } catch (e: any) { toast('error', e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={referenceT("Invoice {value0}", {value0: invoice.invoice_no})}
      footer={<><DiagnosticButton className="btn-secondary" onClick={onClose}><ReferenceText message="Close" /></DiagnosticButton><DiagnosticButton className="btn-primary" disabled={busy || !(Number(amount) > 0) || balance <= 0} onClick={pay}><ReferenceText message="Record payment" /></DiagnosticButton></>}>
      <dl className="mb-4 grid grid-cols-4 gap-2 rounded-md bg-paper p-3 text-sm">
        <div><dt className="text-ink-soft"><ReferenceText message="Charge" /></dt><dd className="font-bold tabular-nums">{fmt.money(invoice.amount)}</dd></div>
        <div><dt className="text-ink-soft"><ReferenceText message="Discount" /></dt><dd className="font-bold tabular-nums">{fmt.money(invoice.discount)}</dd></div>
        <div><dt className="text-ink-soft"><ReferenceText message="Paid" /></dt><dd className="font-bold tabular-nums text-ok">{fmt.money(invoice.paid)}</dd></div>
        <div><dt className="text-ink-soft"><ReferenceText message="Balance" /></dt><dd className={`font-bold tabular-nums ${balance > 0 ? 'text-stat' : 'text-ok'}`}>{fmt.money(balance)}</dd></div>
      </dl>
      {balance > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={referenceT("Amount")}><DiagnosticInput type="number" step="0.01" min="0" max={balance} className="field tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
          <Field label={referenceT("Method")}>
            <DiagnosticSelect className="field" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="CASH"><ReferenceText message="Cash" /></option><option value="CARD"><ReferenceText message="Card" /></option><option value="UPI"><ReferenceText message="UPI / mobile" /></option><option value="INSURANCE"><ReferenceText message="Insurance claim" /></option><option value="BANK"><ReferenceText message="Bank transfer" /></option>
            </DiagnosticSelect>
          </Field>
          <Field label={referenceT("Reference")} className="col-span-2" hint={referenceT("Card slip, transaction or claim number")}><DiagnosticInput className="field" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
      ) : <p className="text-sm font-bold text-ok"><ReferenceText message="This invoice is fully paid." /></p>}
      {invoice.paid === 0 && (
        <div className="mt-4 flex items-end gap-2 border-t border-line pt-4">
          <Field label={referenceT("Adjust discount")} className="flex-1"><DiagnosticInput type="number" min="0" className="field" value={discount} onChange={(e) => setDiscount(e.target.value)} /></Field>
          <DiagnosticButton className="btn-secondary" disabled={busy} onClick={adjust}><ReferenceText message="Apply" /></DiagnosticButton>
        </div>
      )}
    </Modal>
  );
}
