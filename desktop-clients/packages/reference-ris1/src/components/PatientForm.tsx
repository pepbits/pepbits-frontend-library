'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticButton,DiagnosticInput,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';

import { Field, Modal, useToast } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const EMPTY = { first_name: '', last_name: '', dob: '', sex: '', phone: '', email: '', address: '', insurance: '', allergies: '', mrn: '' };

/** Registers a new patient or edits an existing one. MRN is generated when left blank. */
export default function PatientForm({ open, onClose, onSaved, patient }: { open: boolean; onClose: () => void; onSaved: (p: any) => void; patient?: any }) {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();

  const [f, setF] = useState<any>(patient ? { ...EMPTY, ...patient } : EMPTY);
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<string | null>(null);
  const toast = useToast();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const save = async (force = false) => {
    setBusy(true);
    try {
      const p = patient
        ? await api(`/api/patients/${patient.id}`, { method: 'PUT', json: f })
        : await api('/api/patients', { method: 'POST', json: { ...f, force } });
      toast('ok', patient ? 'Patient details updated' : `Registered ${p.first_name} ${p.last_name} as ${p.mrn}`);
      setF(EMPTY); setDup(null);
      onSaved(p);
    } catch (e: any) {
      if (e.message.includes('same name and date of birth')) setDup(e.message);
      else toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={patient ? 'Edit patient' : 'Register patient'} width="max-w-2xl"
      footer={<>
        <DiagnosticButton className="btn-secondary" onClick={onClose}><ReferenceText message="Cancel" /></DiagnosticButton>
        {dup && <DiagnosticButton className="btn-danger" disabled={busy} onClick={() => save(true)}><ReferenceText message="Register anyway" /></DiagnosticButton>}
        <DiagnosticButton className="btn-primary" disabled={busy} onClick={() => save()}>{patient ? 'Save changes' : 'Register patient'}</DiagnosticButton>
      </>}>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label={referenceT("First name")}><DiagnosticInput className="field" value={f.first_name} onChange={set('first_name')} autoFocus required /></Field>
        <Field label={referenceT("Last name")}><DiagnosticInput className="field" value={f.last_name} onChange={set('last_name')} required /></Field>
        <Field label={referenceT("Date of birth")}><DiagnosticDateInput  className="field" value={f.dob || ''} onChange={set('dob')} max={new Date().toISOString().slice(0, 10)} required /></Field>
        <Field label={referenceT("Sex")}>
          <DiagnosticSelect className="field" value={f.sex || ''} onChange={set('sex')} required>
            <option value=""><ReferenceText message="Choose" /></option><option value="F"><ReferenceText message="Female" /></option><option value="M"><ReferenceText message="Male" /></option><option value="O"><ReferenceText message="Other" /></option><option value="U"><ReferenceText message="Unknown" /></option>
          </DiagnosticSelect>
        </Field>
        <Field label={referenceT("Phone")}><DiagnosticInput className="field" value={f.phone || ''} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label={referenceT("Email")}><DiagnosticInput className="field" type="email" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label={referenceT("Address")} className="sm:col-span-2"><DiagnosticInput className="field" value={f.address || ''} onChange={set('address')} /></Field>
        <Field label={referenceT("Insurance / payer")}><DiagnosticInput className="field" value={f.insurance || ''} onChange={set('insurance')} placeholder={referenceT("Self pay if blank")} /></Field>
        <Field label={referenceT("Allergies")} hint={referenceT("Contrast allergies are shown to technologists.")}><DiagnosticInput className="field" value={f.allergies || ''} onChange={set('allergies')} placeholder={referenceT("None known")} /></Field>
        {!patient && <Field label={referenceT("MRN")} hint={referenceT("Leave blank to generate one.")} className="sm:col-span-2"><DiagnosticInput className="field font-mono" value={f.mrn} onChange={set('mrn')} /></Field>}
        {dup && <p className="rounded-md border border-urgent/40 bg-urgent-bg px-3 py-2 text-sm text-urgent sm:col-span-2">{dup}</p>}
        <DiagnosticButton type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
