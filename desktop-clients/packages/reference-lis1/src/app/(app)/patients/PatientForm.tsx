'use client';
import { useEffect, useState } from 'react';
import {useDiagnosticClient} from '@pepbits/reference-diagnostics';
import { useMaster } from '../../../lib/hooks';
import { Button, Checkbox, ErrorNote, Field, Input, Modal, Select, Textarea , DateInput} from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const EMPTY = { firstName: '', lastName: '', dob: '', gender: 'M', ethnicity: '', phone: '', email: '', address: '', nationalId: '', isPregnant: false };

export function PatientForm({ open, patient, onClose, onSaved }: { open: boolean; patient?: any; onClose: () => void; onSaved: (p: any) => void }) {
 const referenceT = useReferenceLocalization().t;

  const {api}=useDiagnosticClient();
  const [f, setF] = useState<any>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ethnicities = useMaster('ethnicities');
  useEffect(() => { if (open) { setF(patient ? { ...EMPTY, ...patient } : EMPTY); setErr(null); } }, [open, patient]);
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.firstName?.trim()) return setErr('First name is required.');
    if (!f.dob) return setErr('Date of birth is required – reference ranges depend on age.');
    setBusy(true); setErr(null);
    try {
      const body = { firstName: f.firstName, lastName: f.lastName, dob: f.dob, gender: f.gender, ethnicity: f.ethnicity || null, phone: f.phone, email: f.email, address: f.address, nationalId: f.nationalId, isPregnant: f.gender === 'F' ? !!f.isPregnant : false };
      const saved = patient?.id ? await api.put(`/patients/${patient.id}`, body) : await api.post('/patients', body);
      onSaved(saved); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={patient?.id ? `Edit ${patient.mrn}` : 'Register patient'}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Save patient" /></Button></>}>
      <ErrorNote error={err} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("First name")} required><Input autoFocus value={f.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
        <Field label={referenceT("Last name")}><Input value={f.lastName || ''} onChange={(e) => set('lastName', e.target.value)} /></Field>
        <Field label={referenceT("Date of birth")} required><DateInput  value={f.dob || ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('dob', e.target.value)} /></Field>
        <Field label={referenceT("Sex")}>
          <Select value={f.gender} onChange={(e) => set('gender', e.target.value)} options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }]} />
        </Field>
        <Field label={referenceT("Ethnicity")} hint={referenceT("Used where reference ranges differ by ethnicity")}>
          <Select value={f.ethnicity || ''} onChange={(e) => set('ethnicity', e.target.value)} placeholder={referenceT("Not recorded")} options={ethnicities.map((x) => ({ value: x.code, label: x.name }))} />
        </Field>
        <Field label={referenceT("National ID")}><Input value={f.nationalId || ''} onChange={(e) => set('nationalId', e.target.value)} /></Field>
        <Field label={referenceT("Phone")}><Input value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={referenceT("Email")}><Input type="email" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label={referenceT("Address")} className="col-span-2"><Textarea rows={2} value={f.address || ''} onChange={(e) => set('address', e.target.value)} /></Field>
        {f.gender === 'F' && <div className="col-span-2"><Checkbox label={referenceT("Currently pregnant (applies pregnancy-specific reference ranges)")} checked={f.isPregnant} onChange={(v) => set('isPregnant', v)} /></div>}
      </div>
    </Modal>
  );
}
