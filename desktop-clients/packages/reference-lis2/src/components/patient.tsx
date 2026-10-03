'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';

import {age,fullName} from '../lib/format';
import { RefSelect } from './refselect';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, cx , DateInput} from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function PatientBanner({ p, children, className }: { p: any; children?: React.ReactNode; className?: string }) {
 const {fmtDate}=useDiagnosticFormat();

  if (!p) return null;
  return (
    <div className={cx('panel flex flex-wrap items-center gap-x-6 gap-y-1 border-l-4 border-l-hema-600 px-4 py-2.5', className)}>
      <div className="min-w-0">
        <Link href={`/patients/${p.patient_id ?? p.id}`} className="text-base font-semibold hover:underline">{fullName(p)}</Link>
        <div className="text-xs text-ink-soft tnum">
          {p.mrn} <span className="mx-1 text-line-strong">|</span> {[age(p.dob), p.gender].filter(Boolean).join(' ') || 'Age/sex not recorded'}
          {p.dob && <><span className="mx-1 text-line-strong">|</span><ReferenceText message="born" /> {fmtDate(p.dob)}</>}
        </div>
      </div>
      {children}
    </div>
  );
}

const EMPTY = { first_name: '', last_name: '', dob: '', gender: 'U', ethnicity_id: '', pregnant: 0, phone: '', email: '', address: '', national_id: '' };

export function PatientFormModal({ open, onClose, onSaved, patient }: { open: boolean; onClose: () => void; onSaved: (p: any) => void; patient?: any }) {
 const referenceT = useReferenceLocalization().t;

 const {post,put}=useDiagnosticClient();

  const [f, setF] = useState<any>(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(patient ? { ...EMPTY, ...patient, ethnicity_id: patient.ethnicity_id ?? '' } : EMPTY); setErr(null); } }, [open, patient]);
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = { ...f, ethnicity_id: f.ethnicity_id ? Number(f.ethnicity_id) : null, pregnant: f.pregnant ? 1 : 0 };
      const saved = patient ? await put(`/patients/${patient.id}`, body) : await post('/patients', body);
      onSaved(saved); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl" title={patient ? `Edit ${fullName(patient)}` : 'Register patient'}
      footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}>{patient ? 'Save changes' : 'Register patient'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={referenceT("First name *")}><Input autoFocus value={f.first_name} onChange={(e) => set('first_name')(e.target.value)} /></Field>
        <Field label={referenceT("Last name")}><Input value={f.last_name || ''} onChange={(e) => set('last_name')(e.target.value)} /></Field>
        <Field label={referenceT("Date of birth")}><DateInput  value={f.dob || ''} onChange={(e) => set('dob')(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label={referenceT("Sex")}><Select value={f.gender} onChange={set('gender')} options={[{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }, { value: 'O', label: 'Other' }, { value: 'U', label: 'Unknown' }]} /></Field>
        <Field label={referenceT("Ethnicity")} hint={referenceT("Used when a reference range is ethnicity-specific")}><RefSelect entity="ethnicities" value={f.ethnicity_id} onChange={set('ethnicity_id')} placeholder={referenceT("Not recorded")} /></Field>
        <Field label={referenceT("National ID")}><Input value={f.national_id || ''} onChange={(e) => set('national_id')(e.target.value)} /></Field>
        <Field label={referenceT("Phone")}><Input value={f.phone || ''} onChange={(e) => set('phone')(e.target.value)} /></Field>
        <Field label={referenceT("Email")}><Input type="email" value={f.email || ''} onChange={(e) => set('email')(e.target.value)} /></Field>
        <Field label={referenceT("Address")} className="sm:col-span-2"><Textarea className="min-h-[56px]" value={f.address || ''} onChange={(e) => set('address')(e.target.value)} /></Field>
        {f.gender === 'F' && <Checkbox checked={!!f.pregnant} onChange={set('pregnant')} label={referenceT("Currently pregnant (selects pregnancy reference ranges)")} />}
      </div>
      {err && <p className="mt-3 rounded-md bg-crit-bg px-3 py-2 text-sm text-crit">{err}</p>}
    </Modal>
  );
}
