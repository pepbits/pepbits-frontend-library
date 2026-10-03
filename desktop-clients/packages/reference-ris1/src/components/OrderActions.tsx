'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {toLocalInput,useApi} from '../lib/client';
import { Field, Modal, useToast } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Calls PATCH /api/orders/:id with a workflow action and reports the outcome. */
export function useOrderAction(after?: () => void) {
 const {api}=useDiagnosticClient();

  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (orderId: number, action: string, data: Record<string, unknown> = {}, success?: string) => {
    setBusy(true);
    try {
      const o = await api(`/api/orders/${orderId}`, { method: 'PATCH', json: { action, ...data } });
      if (success) toast('ok', success);
      after?.();
      return o;
    } catch (e: any) {
      toast('error', e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

export function ScheduleModal({ order, onClose, onDone }: { order: any | null; onClose: () => void; onDone: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();

  const { data: lk } = useApi<any>('/api/lookups');
  const [at, setAt] = useState(toLocalInput(order?.scheduled_at));
  const [room, setRoom] = useState(order?.room || '');
  const { run, busy } = useOrderAction(onDone);
  if (!order) return null;
  const rooms = (lk?.modalities || []).filter((m: any) => m.code === order.modality_code);
  return (
    <Modal open onClose={onClose} title={order.scheduled_at ? 'Reschedule exam' : 'Book appointment'}
      footer={<><DiagnosticButton className="btn-secondary" onClick={onClose}><ReferenceText message="Cancel" /></DiagnosticButton>
        <DiagnosticButton className="btn-primary" disabled={busy} onClick={() => run(order.id, 'schedule', { scheduled_at: new Date(at).toISOString(), room: room || null }, 'Appointment booked. The modality worklist and HIS were updated.')}><ReferenceText message="Save appointment" /></DiagnosticButton></>}>
      <p className="mb-3 text-sm text-ink-soft">{order.procedure_name} <ReferenceText message="for" /> {order.first_name} {order.last_name}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("Date and time")}><DiagnosticInput type="datetime-local" className="field" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
        <Field label={referenceT("Room")}>
          <DiagnosticSelect className="field" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value=""><ReferenceText message="Any" /> {order.modality_code} <ReferenceText message="room" /></option>
            {rooms.map((m: any) => <option key={m.id} value={m.room}>{m.room} · {m.name}</option>)}
          </DiagnosticSelect>
        </Field>
      </div>
      {order.prep && <p className="mt-3 rounded-md bg-urgent-bg px-3 py-2 text-sm text-urgent"><b><ReferenceText message="Preparation:" /></b> {order.prep}</p>}
    </Modal>
  );
}

const CANCEL_REASONS = ['Patient did not attend', 'Patient declined', 'Duplicate order', 'Requested by referrer', 'Contraindication found', 'Protocol changed'];

export function CancelModal({ order, onClose, onDone }: { order: any | null; onClose: () => void; onDone: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const [reason, setReason] = useState('');
  const { run, busy } = useOrderAction(onDone);
  if (!order) return null;
  return (
    <Modal open onClose={onClose} title={referenceT("Cancel order")}
      footer={<><DiagnosticButton className="btn-secondary" onClick={onClose}><ReferenceText message="Keep order" /></DiagnosticButton>
        <DiagnosticButton className="btn-danger" disabled={busy || !reason.trim()} onClick={() => run(order.id, 'cancel', { reason }, `Order ${order.accession} cancelled`)}><ReferenceText message="Cancel order" /></DiagnosticButton></>}>
      <p className="mb-3 text-sm"><ReferenceText message="Cancelling" /> <b>{order.procedure_name}</b> (<span className="id">{order.accession}</span><ReferenceText message=") sends an ORM cancel to connected systems and voids unpaid charges. Paid invoices are marked for refund." /></p>
      <Field label={referenceT("Reason")}>
        <DiagnosticInput className="field" list="cancel-reasons" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <datalist id="cancel-reasons">{CANCEL_REASONS.map((r) => <option key={r} value={r} />)}</datalist>
      </Field>
    </Modal>
  );
}
