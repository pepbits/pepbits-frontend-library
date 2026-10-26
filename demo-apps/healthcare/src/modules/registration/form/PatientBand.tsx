'use client';
import React, {type ReactNode} from 'react';
import {computeAge, deriveDisplayName, lookupLabel, type FormValues, type Lookups, type PatientStatus} from '@allyvora/shared';
import {useLocalization} from '@pepbits/i18n/react';
import {RecordSummaryBand} from '@pepbits/patterns/record-form';
import {useTimeFormat} from '../support';

const SEX_LABEL: Record<string, string> = {male: 'Male', female: 'Female', other: 'Other', unknown: 'Sex unknown'};

/** Wristband-style patient summary: allergy stripe, identity facts, MRN code and completeness. */
export function PatientBand({values, lookups, mrn, mrnPending, completion, sectionsLabel, size = 'compact', status, actions, className}: {
  values: FormValues; lookups: Lookups; mrn?: string | null; mrnPending?: string | null; completion?: number; sectionsLabel?: string;
  size?: 'compact' | 'full'; status?: PatientStatus; actions?: ReactNode; className?: string;
}) {
  const {t} = useLocalization(), time = useTimeFormat();
  const full = size === 'full';
  const name = (values.displayName as string) || deriveDisplayName(values, lookups);
  const age = computeAge(values);
  const sex = values.administrativeSex as string | undefined;
  const allergy = values.allergyStatus as string | undefined;
  const allergens = Array.isArray(values.allergens) ? values.allergens : [];
  const allergyText = allergy === 'known'
    ? allergens.length ? t('Allergic to {list}', {list: allergens.map(code => lookupLabel(lookups, 'allergen', code)).join(', ')}) : t('Has allergies')
    : allergy === 'nka' ? t('No known allergies') : t('Allergies not recorded');
  const tone = allergy === 'known' ? 'danger' : allergy === 'nka' ? 'ok' : 'accent';
  const dob = values.dobPrecision === 'exact' && values.dateOfBirth ? time.date(String(values.dateOfBirth))
    : values.birthYear ? t('Born {when}', {when: `${values.birthMonth ? lookupLabel(lookups, 'month', values.birthMonth).slice(0, 3) + ' ' : ''}${values.birthYear}`}) : null;
  const facts = [
    [age.label, sex ? t(SEX_LABEL[sex] ?? sex) : null].filter(Boolean).join(', ') || null,
    dob,
    values.bloodGroup ? t('Blood {group}', {group: lookupLabel(lookups, 'bloodGroup', values.bloodGroup)}) : null,
    values.mobile ? `+91 ${values.mobile}` : null,
    full && values.payerType ? lookupLabel(lookups, 'payerType', values.payerType) : null,
  ].filter(Boolean) as string[];
  const code = mrn ?? mrnPending ?? '';
  return <RecordSummaryBand title={name || t('New patient')} subtitle={values.localName ? String(values.localName) : undefined}
    badge={status === 'inactive' ? t('Inactive') : undefined} label="Patient summary" facts={facts} emptyFacts={t('Details appear here as you type')}
    alert={{label:allergyText,tone:tone === 'ok' ? 'success' : tone === 'accent' ? 'warning' : 'danger'}} code={code} codePending={!mrn}
    codeCaption={mrn ?? (mrnPending ? t('{mrn} on save', {mrn:mrnPending}) : t('MRN on save'))}
    completion={completion} completionCaption={sectionsLabel} size={size} actions={actions} className={className}/>;
}
