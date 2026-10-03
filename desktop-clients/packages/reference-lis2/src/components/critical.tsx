'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';

import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Documents that a critical value was phoned through with read-back (required before signing). */
export function CriticalNotifyModal({ notification, context, open, onClose, onDone }: { notification: any; context?: React.ReactNode; open: boolean; onClose: () => void; onDone: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const {post}=useDiagnosticClient();

  const [to, setTo] = useState('');
  const [method, setMethod] = useState('PHONE');
  const [readBack, setReadBack] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setTo(''); setMethod('PHONE'); setReadBack(false); setNotes(''); setErr(null); } }, [open]);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await post(`/critical/${notification.id}/notify`, { notifiedTo: to, method, readBack, notes }); onDone(); onClose(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Record critical value notification")}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={!to.trim() || !readBack} onClick={save}><ReferenceText message="Record notification" /></Button></>}>
      {context}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={referenceT("Informed person *")} className="sm:col-span-2" hint={referenceT("Name and role, e.g. Dr. Rao, ward 5 registrar")}><Input autoFocus value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label={referenceT("How")}><Select value={method} onChange={setMethod} options={['PHONE', 'IN_PERSON', 'SECURE_MESSAGE']} /></Field>
        <div className="flex items-end pb-1"><Checkbox checked={readBack} onChange={setReadBack} label={referenceT("Value was read back correctly")} /></div>
        <Field label={referenceT("Notes")} className="sm:col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-crit">{err}</p>}
    </Modal>
  );
}
