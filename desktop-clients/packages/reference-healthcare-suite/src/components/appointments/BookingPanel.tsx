'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import { CalendarCheck2, Clock, UserRound, UserRoundX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApiClient, ApiError, errorMessage } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { PatientSummary, Row } from '../../lib/types';
import { PatientBanner } from '../patients/PatientBanner';
import { PatientSearch } from '../patients/PatientSearch';
import { prefillFromQuery, QuickRegister } from '../patients/QuickRegister';
import { Button, Field, Input, Segmented, Select, Textarea , DateInput} from '../ui/controls';
import { ErrorBanner } from '../ui/display';
import { useToast } from '../ui/Toast';
import { PickedSlot } from './types';

const REASONS = ['New complaint', 'Follow-up', 'Review results', 'Vaccination', 'Procedure', 'Physiotherapy session'];

/**
 * Book a free slot for a registered patient or for someone without an MRN yet
 * (a phone booking or a new caller). Guests are registered at check-in.
 */
export function BookingPanel({ picked, preset, onBooked, onCancel }: {
  picked: PickedSlot; preset: PatientSummary | null; onBooked: (a: Row) => void; onCancel: () => void;
}) {
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  const { fmtDay , fmtTime } = useFormat();
  const toast = useToast();
  const [who, setWho] = useState<'patient' | 'guest'>('patient');
  const [patient, setPatient] = useState<PatientSummary | null>(preset);
  const [guest, setGuest] = useState({ guestName: '', guestPhone: '', guestGender: '', guestDob: '' });
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [registerQuery, setRegisterQuery] = useState<string | null>(null);
  useEffect(() => { if (preset) setPatient(preset); }, [preset]);

  const book = async () => {
    setBanner(null); setErrors({});
    const e: Record<string, string> = {};
    if (who === 'patient' && !patient) e.patient = 'Find the patient or switch to No MRN yet';
    if (who === 'guest' && !guest.guestName.trim()) e.guestName = 'Name is required';
    if (who === 'guest' && !guest.guestPhone.trim()) e.guestPhone = 'A contact number is required';
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const body = { resourceId: picked.resource.id, date: picked.date, startTime: picked.slot.start, reason, notes, ...(who === 'patient' ? { patientId: patient!.id } : guest) };
      const a = await api<Row>('/appointments', { method: 'POST', body });
      toast({ tone: 'ok', title: healthcareT("Booked {v0}",{v0:a.apptNo}), body: healthcareT("{v0} with {v1} at {v2}",{v0:a.patientName || a.guestName,v1:a.resourceName,v2:a.startTime}) });
      onBooked(a);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields); else setBanner(errorMessage(err));
    } finally { setSaving(false); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-hc-line p-3">
        <div>
          <p className="text-hc-xs font-medium text-hc-petrol-700"><LocalizedText message="New appointment" /></p>
          <p className="mt-0.5 text-hc-sm font-semibold">{picked.resource.name}</p>
          <p className="hc-num mt-0.5 flex items-center gap-1.5 text-hc-xs text-hc-ink-mute"><Clock className="h-3 w-3" />{fmtDay(picked.date)} · {fmtTime(picked.slot.start)}-{fmtTime(picked.slot.end)}</p>
        </div>
        <Button size="xs" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={onCancel} aria-label="Cancel booking" />
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {banner && <ErrorBanner message={banner} />}
        <Segmented
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          value={who}
          onChange={setWho}
          options={[{ value: 'patient', label: 'Registered patient', icon: <UserRound className="h-3.5 w-3.5" /> }, { value: 'guest', label: 'No MRN yet', icon: <UserRoundX className="h-3.5 w-3.5" /> }]}
        />
        {who === 'patient' ? (
          patient ? (
            <PatientBanner patient={patient} policy={patient.primaryPolicy} compact right={<Button size="xs" variant="ghost" onClick={() => setPatient(null)}><LocalizedText message="Change" /></Button>} className="[&>div:nth-child(2)]:gap-y-1" />
          ) : (
            <Field label="Patient" error={errors.patient}>
              <PatientSearch autoFocus onSelect={setPatient} onCreate={(q) => setRegisterQuery(q)} />
            </Field>
          )
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Full name" required error={errors.guestName} className="col-span-2"><Input autoFocus value={guest.guestName} invalid={!!errors.guestName} onChange={(e) => setGuest({ ...guest, guestName: e.target.value })} /></Field>
            <Field label="Mobile" required error={errors.guestPhone} className="col-span-2"><Input type="tel" value={guest.guestPhone} invalid={!!errors.guestPhone} onChange={(e) => setGuest({ ...guest, guestPhone: e.target.value })} placeholder="+971 50 000 0000" /></Field>
            <Field label="Gender"><Select options={['Female', 'Male']} value={guest.guestGender} onChange={(v) => setGuest({ ...guest, guestGender: v })} /></Field>
            <Field label="Date of birth"><DateInput value={guest.guestDob} onChange={(e) => setGuest({ ...guest, guestDob: e.target.value })} /></Field>
            <p className="col-span-2 rounded bg-hc-selfpay-50 px-2.5 py-2 text-hc-2xs text-hc-selfpay-700"><LocalizedText message="The slot is held under this name. An MRN is issued when the person arrives and is registered at check-in." /></p>
          </div>
        )}
        <Field label="Reason for visit">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} list="appt-reasons" placeholder="e.g. Follow-up" />
          <datalist id="appt-reasons">{REASONS.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Notes for front desk"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
      </div>
      <div className="flex justify-end gap-1.5 border-t border-hc-line p-3">
        <Button variant="ghost" onClick={onCancel}><LocalizedText message="Cancel" /></Button>
        <Button mutation variant="primary" icon={<CalendarCheck2 className="h-3.5 w-3.5" />} loading={saving} onClick={book}><LocalizedText message="Book" /> {fmtTime(picked.slot.start)}</Button>
      </div>
      <QuickRegister open={registerQuery !== null} onClose={() => setRegisterQuery(null)} initial={prefillFromQuery(registerQuery ?? '')} onCreated={(p) => { setPatient(p); setRegisterQuery(null); }} />
    </div>
  );
}
