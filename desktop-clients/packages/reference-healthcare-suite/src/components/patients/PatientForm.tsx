'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import { Field, Input, Select, Textarea } from '../ui/controls';
import { Row } from '../../lib/types';
import { todayIso } from '../../lib/format';
import { PolicyEditor } from './PolicyEditor';

export const blankPatient = (): Row => ({ firstName: '', lastName: '', gender: '', dob: '', phone: '', email: '', nationalId: '', nationality: '', address: '', allergies: '', status: 'Active', policies: [] });

const NATIONALITIES = ['Emirati', 'Indian', 'Pakistani', 'Filipino', 'Egyptian', 'Jordanian', 'Lebanese', 'British', 'American', 'Nigerian', 'Afghan', 'Other'];

export function Demographics({ value, onChange, errors = {}, compact }: { value: Row; onChange: (v: Row) => void; errors?: Record<string, string>; compact?: boolean }) {
  const set = (k: string) => (v: string) => onChange({ ...value, [k]: v });
  const inp = (k: string, label: string, props: Record<string, unknown> = {}, required = false, span = '') => (
    <Field label={label} required={required} error={errors[k]} className={span} htmlFor={`pt-${k}`}>
      <Input id={`pt-${k}`} value={value[k] ?? ''} invalid={!!errors[k]} onChange={(e) => set(k)(e.target.value)} {...props} />
    </Field>
  );
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 lg:grid-cols-4">
      {inp('firstName', 'First name', { autoFocus: true }, true)}
      {inp('lastName', 'Last name', {}, true)}
      <Field label="Gender" required error={errors.gender}><Select options={['Female', 'Male']} value={value.gender} invalid={!!errors.gender} onChange={set('gender')} /></Field>
      {inp('dob', 'Date of birth', { type: 'date', max: todayIso() })}
      {inp('phone', 'Mobile', { type: 'tel', placeholder: '+971 50 000 0000' }, true)}
      {inp('nationalId', 'National ID / Emirates ID', { placeholder: '784-YYYY-NNNNNNN-N', className: 'font-mono' })}
      {!compact && inp('email', 'Email', { type: 'email' })}
      <Field label="Nationality"><Select options={NATIONALITIES} value={value.nationality} onChange={set('nationality')} /></Field>
      {!compact && inp('address', 'Address', {}, false, 'col-span-2')}
      <Field label="Allergies" hint="Shown on the patient banner everywhere" className={compact ? 'col-span-2' : 'col-span-2'}>
        <Input value={value.allergies ?? ''} onChange={(e) => set('allergies')(e.target.value)} placeholder="e.g. Penicillin, peanuts" />
      </Field>
    </div>
  );
}

export function PatientForm({ value, onChange, errors = {} }: { value: Row; onChange: (v: Row) => void; errors?: Record<string, string> }) {
  return (
    <div className="grid gap-3 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="rounded-md border border-hc-line bg-hc-surface">
        <h3 className="border-b border-hc-line px-3 py-2 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Demographics" /></h3>
        <div className="p-3"><Demographics value={value} onChange={onChange} errors={errors} /></div>
      </section>
      <section className="rounded-md border border-hc-line bg-hc-surface">
        <h3 className="border-b border-hc-line px-3 py-2 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Insurance" /></h3>
        <div className="p-3"><PolicyEditor value={value.policies ?? []} onChange={(policies) => onChange({ ...value, policies })} errors={errors} /></div>
      </section>
    </div>
  );
}
