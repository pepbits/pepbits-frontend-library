'use client';
import {Button, Checkbox, Input, Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useState} from 'react';

export type ReportFilterValue = string | boolean | string[] | {from?: string; to?: string; min?: number; max?: number};
export type ReportFilters = Record<string, ReportFilterValue>;
export interface ReportFilterDefinition {key: string; label: string; type: 'text' | 'choice' | 'date' | 'number' | 'boolean'; options?: string[]}
export function activeReportFilter(value: ReportFilterValue | undefined): boolean {
  return value !== undefined && value !== '' && (Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? Object.values(value).some(item => item !== undefined && item !== '') : true);
}
export function validReportFilters(values: ReportFilters): boolean {
  return Object.values(values).every(value => {
    if (!value || Array.isArray(value) || typeof value !== 'object') return true;
    return (!('from' in value) || !value.from || !value.to || value.from <= value.to) &&
      (!('min' in value) || value.min === undefined || Number.isFinite(value.min)) &&
      (!('max' in value) || value.max === undefined || Number.isFinite(value.max)) &&
      (!('min' in value) || !('max' in value) || value.min === undefined || value.max === undefined || value.min <= value.max);
  });
}
/** Controlled typed conditions; the host owns fetching, application and persistence. */
export function ReportFilterField({definition, value, onChange, disabled = false}: {definition: ReportFilterDefinition; value?: ReportFilterValue; onChange: (value?: ReportFilterValue) => void; disabled?: boolean}) {
  const change = (value?: ReportFilterValue) => {if (!disabled) onChange(value);};
  const {t} = useLocalization(), [search, setSearch] = useState('');
  const {label, type} = definition;
  const range = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const choices = Array.isArray(value) ? value : [];
  return <fieldset disabled={disabled} className="min-w-0 space-y-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
    <legend>{t(label)}</legend>
    {type === 'choice' ? <><Input label={t('Search {value0}', {value0: t(label)})} value={search} onChange={event => setSearch(event.target.value)}/><div className="max-h-40 overflow-auto space-y-1">{(definition.options ?? []).filter(option => option.toLowerCase().includes(search.toLowerCase())).map(option => <Checkbox key={option} label={option} checked={choices.includes(option)} onChange={event => change(event.target.checked ? [...choices, option] : choices.filter(item => item !== option))}/>)}</div></> :
      type === 'date' ? <><Input type="date" label={`${t(label)} ${t('From')}`} value={range.from ?? ''} onChange={event => change({...range, from: event.target.value})}/><Input type="date" label={`${t(label)} ${t('To')}`} value={range.to ?? ''} onChange={event => change({...range, to: event.target.value})}/></> :
      type === 'number' ? <><Input type="number" label={`${t(label)} ${t('Min')}`} value={range.min ?? ''} onChange={event => change({...range, min: event.target.value === '' ? undefined : Number(event.target.value)})}/><Input type="number" label={`${t(label)} ${t('Max')}`} value={range.max ?? ''} onChange={event => change({...range, max: event.target.value === '' ? undefined : Number(event.target.value)})}/></> :
      type === 'boolean' ? <Select label={label} value={value === true ? 'yes' : value === false ? 'no' : ''} options={[{value: '', label: 'Any'}, {value: 'yes', label: 'Yes'}, {value: 'no', label: 'No'}]} onChange={event => change(event.target.value === '' ? undefined : event.target.value === 'yes')}/> :
      <Input label={label} value={typeof value === 'string' ? value : ''} onChange={event => change(event.target.value)}/>}
    <Button disabled={disabled || !activeReportFilter(value)} onClick={() => change(undefined)}>{t('Clear')} {t(label)}</Button>
  </fieldset>;
}
