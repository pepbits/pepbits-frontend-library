'use client';
// Fields and validation from the AllyVora clinical workspace (components/clinical/ReferralSource.tsx, commit 1ede87f);
// controls are the shared @pepbits/ui ones. See provenance.json.
import React from 'react';
import {Checkbox, DateInput, Input, Select, Textarea} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import {cn} from '@pepbits/ui';
import {TEXT, fieldGap} from './parts';

/** Inbound referral source, matching the API's Referrals.source validation (HL7 FHIR request priorities). */
export interface ReferralSource {
  sourceType: 'external-clinician' | 'external-facility' | 'insurer' | 'community-service' | 'self' | 'other';
  referrerName: string; organisation: string; referrerIdentifier: string; contact: string; reference: string;
  referralDate: string; priority: 'routine' | 'urgent' | 'asap' | 'stat'; reason: string; letterReceived: boolean;
}

export const EMPTY_REFERRAL: ReferralSource = {
  sourceType: 'external-clinician', referrerName: '', organisation: '', referrerIdentifier: '', contact: '', reference: '',
  referralDate: '', priority: 'routine', reason: '', letterReceived: false,
};

export const SOURCE_LABELS: Record<ReferralSource['sourceType'], string> = {
  'external-clinician': 'External clinician', 'external-facility': 'Other hospital or clinic', insurer: 'Insurer or payer',
  'community-service': 'Community or social service', self: 'Self-referral', other: 'Other',
};
export const PRIORITY_LABELS: Record<ReferralSource['priority'], string> = {routine: 'Routine', urgent: 'Urgent', asap: 'As soon as possible', stat: 'Immediate (stat)'};
const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({value, label}));

export function referralProblems(r: ReferralSource): string[] {
  const out: string[] = [];
  if (r.referrerName.trim().length < 2) out.push('Enter who referred the patient.');
  if (!r.referralDate) out.push('Enter the referral date.');
  else if (r.referralDate > new Date().toISOString().slice(0, 10)) out.push('The referral date cannot be in the future.');
  if (r.reason.trim().length < 5) out.push('Enter the reason for referral.');
  return out;
}

export function ReferralSourceFields({value, onChange}: {value: ReferralSource; onChange: (v: ReferralSource) => void}) {
  const {preferences} = usePreferences();
  const set = <K extends keyof ReferralSource>(k: K, v: ReferralSource[K]) => onChange({...value, [k]: v});
  return <fieldset className={cn('grid grid-cols-1 rounded-[var(--radius)] border border-[var(--border)] p-3 sm:grid-cols-2 lg:grid-cols-3', fieldGap(preferences.density))} data-referral-source="">
    <legend className={cn('px-1 font-bold', TEXT.muted)}>Referral source</legend>
    <Select label="Referred by" placeholder="" options={options(SOURCE_LABELS)} value={value.sourceType} onChange={e => set('sourceType', e.target.value as ReferralSource['sourceType'])}/>
    <Input label="Referrer name" required value={value.referrerName} onChange={e => set('referrerName', e.target.value)} autoComplete="off"/>
    <Input label="Organisation" value={value.organisation} onChange={e => set('organisation', e.target.value)} autoComplete="off"/>
    <Input label="Referrer licence or registration no." value={value.referrerIdentifier} onChange={e => set('referrerIdentifier', e.target.value)} autoComplete="off"/>
    <Input label="Referrer contact" value={value.contact} onChange={e => set('contact', e.target.value)} hint="Phone or secure email for the reply" autoComplete="off"/>
    <Input label="Referral reference" value={value.reference} onChange={e => set('reference', e.target.value)} hint="The referrer's own number" autoComplete="off"/>
    <DateInput label="Referral date" required max={new Date().toISOString().slice(0, 10)} value={value.referralDate} onChange={e => set('referralDate', e.target.value)} className="[&_input]:tabular-nums"/>
    <Select label="Priority" placeholder="" options={options(PRIORITY_LABELS)} value={value.priority} onChange={e => set('priority', e.target.value as ReferralSource['priority'])}/>
    <div className="self-end pb-2"><Checkbox label="Referral letter is on file" checked={value.letterReceived} onChange={e => set('letterReceived', e.target.checked)}/></div>
    <Textarea label="Reason for referral" required rows={2} value={value.reason} onChange={e => set('reason', e.target.value)} className="sm:col-span-2 lg:col-span-3"/>
  </fieldset>;
}
