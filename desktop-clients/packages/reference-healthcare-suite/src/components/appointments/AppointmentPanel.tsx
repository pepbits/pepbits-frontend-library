'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import { ArrowRightLeft, Ban, CalendarClock, CheckCircle2, ExternalLink, LogIn, Phone, UserPlus, UserRoundX, X } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useState } from 'react';
import { useApiClient, errorMessage } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { PatientSummary, Row } from '../../lib/types';
import { QuickRegister } from '../patients/QuickRegister';
import { Button, Field, Input } from '../ui/controls';
import { KV, StatusBadge } from '../ui/display';
import { Modal } from '../ui/overlay';
import { useToast } from '../ui/Toast';

export function AppointmentPanel({ appt, onChanged, onReschedule, onClose, rescheduling }: {
  appt: Row; onChanged: (a: Row) => void; onReschedule: () => void; onClose: () => void; rescheduling: boolean;
}) {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const api = useApiClient();
  const { fmtDateTime, fmtDay , fmtTime } = useFormat();
  const router = useReferenceRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [registering, setRegistering] = useState(false);
  const guest = !appt.patientId;
  const open = ['Booked', 'Confirmed'].includes(appt.status);

  const setStatus = async (status: string, why?: string) => {
    setBusy(status);
    try {
      const a = await api<Row>(`/appointments/${appt.id}/status`, { method: 'PATCH', body: { status, reason: why } });
      toast({ tone: status === 'Cancelled' || status === 'No-show' ? 'info' : 'ok', title: healthcareT("{v0} {v1}",{v0:appt.apptNo,v1:status.toLowerCase()}) });
      onChanged(a);
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not update appointment"), body: errorMessage(e) }); }
    finally { setBusy(null); setCancelOpen(false); }
  };

  const [first, ...rest] = String(appt.guestName ?? '').split(' ');
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-hc-line p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="font-mono text-hc-xs text-hc-ink-mute">{appt.apptNo}</span><StatusBadge status={appt.status} /></div>
          <p className="mt-1 flex items-center gap-1.5 truncate text-[15px] font-semibold">
            {guest && <UserRoundX className="h-4 w-4 shrink-0 text-hc-selfpay-600" />}{appt.patientName || appt.guestName}
          </p>
          <p className="hc-num text-hc-xs text-hc-ink-mute">{appt.mrn || 'No MRN yet'} · <Phone className="inline h-3 w-3" /> {appt.phone || appt.guestPhone}</p>
        </div>
        <Button size="xs" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={onClose} aria-label="Close" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <dl className="grid grid-cols-2 gap-3">
          <KV label="When" className="col-span-2">{fmtDay(appt.date)} · {fmtTime(appt.startTime)}-{fmtTime(appt.endTime)}</KV>
          <KV label="With">{appt.resourceName}</KV>
          <KV label="Department">{appt.departmentName}</KV>
          <KV label="Reason" className="col-span-2">{appt.reason}</KV>
          {appt.notes && <KV label="Notes" className="col-span-2">{appt.notes}</KV>}
          <KV label="Booked">{fmtDateTime(appt.createdAt)}</KV>
        </dl>
        {guest && open && (
          <div className="rounded-md border border-hc-selfpay-100 bg-hc-selfpay-50 p-2.5 text-hc-xs text-hc-selfpay-700"><LocalizedText message="Booked without an MRN. Register the patient on arrival, then create the encounter." /></div>
        )}
        {rescheduling && <div className="rounded-md border border-hc-warn-100 bg-hc-warn-50 p-2.5 text-hc-xs text-hc-warn-700"><LocalizedText message="Pick any free slot on the board to move this appointment. Other resources are allowed." /></div>}
      </div>
      <div className="space-y-1.5 border-t border-hc-line p-3">
        {appt.encounterId ? (
          <Link href={`/encounters/${appt.encounterId}`} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded bg-hc-petrol-600 text-hc-sm font-medium text-white hover:bg-hc-petrol-700"><LocalizedText message="Open encounter" /><ExternalLink className="h-3.5 w-3.5" /></Link>
        ) : open ? (
          guest ? (
            <Button mutation size="lg" variant="primary" className="w-full" icon={<UserPlus className="h-4 w-4" />} onClick={() => setRegistering(true)}><LocalizedText message="Register & check in" /></Button>
          ) : (
            <Button mutation size="lg" variant="primary" className="w-full" icon={<LogIn className="h-4 w-4" />} onClick={() => router.push(`/encounters/new?appointmentId=${appt.id}`)}><LocalizedText message="Check in & create encounter" /></Button>
          )
        ) : null}
        {open && (
          <div className="grid grid-cols-2 gap-1.5">
            {appt.status === 'Booked' && <Button mutation size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={busy === 'Confirmed'} onClick={() => setStatus('Confirmed')}><LocalizedText message="Confirm" /></Button>}
            <Button size="sm" icon={<ArrowRightLeft className="h-3.5 w-3.5" />} mutation onClick={onReschedule} variant={rescheduling ? 'subtle' : 'secondary'}>{rescheduling ? <LocalizedText message="Picking slot"/> : <LocalizedText message="Reschedule"/>}</Button>
            <Button mutation size="sm" icon={<CalendarClock className="h-3.5 w-3.5" />} loading={busy === 'No-show'} onClick={() => setStatus('No-show')}><LocalizedText message="No-show" /></Button>
            <Button size="sm" icon={<Ban className="h-3.5 w-3.5" />} className="hover:border-hc-danger-600 hover:text-hc-danger-700" mutation onClick={() => setCancelOpen(true)}><LocalizedText message="Cancel" /></Button>
          </div>
        )}
        {appt.status === 'No-show' && <Button mutation size="sm" className="w-full" loading={busy === 'Booked'} onClick={() => setStatus('Booked')}><LocalizedText message="Restore booking" /></Button>}
      </div>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t("Cancel {v0}",{v0:appt.apptNo})} width="max-w-md"
        footer={<><Button variant="ghost" onClick={() => setCancelOpen(false)}><LocalizedText message="Keep" /></Button><Button mutation variant="danger" loading={busy === 'Cancelled'} onClick={() => setStatus('Cancelled', reason)}><LocalizedText message="Cancel appointment" /></Button></>}>
        <Field label="Reason" hint="Stored with the appointment"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient called to cancel" /></Field>
      </Modal>
      <QuickRegister
        open={registering}
        onClose={() => setRegistering(false)}
        title={t("Register {v0}",{v0:appt.guestName})}
        submitLabel="Register & continue"
        initial={{ firstName: first, lastName: rest.join(' '), phone: appt.guestPhone, gender: appt.guestGender, dob: appt.guestDob }}
        submit={async (body) => (await api<{ patient: PatientSummary }>(`/appointments/${appt.id}/register`, { method: 'POST', body })).patient}
        onCreated={() => { setRegistering(false); router.push(`/encounters/new?appointmentId=${appt.id}`); }}
      />
    </div>
  );
}
