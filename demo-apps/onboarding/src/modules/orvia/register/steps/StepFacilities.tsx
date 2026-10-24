'use client';
import React, {useEffect, useRef, useState} from 'react';
import {Plus, Trash2} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {cn} from '@pepbits/ui';
import {FACILITY_TYPES, facilityType} from '../../catalog';
import {newId, pluralize, type FacilityEntry} from '../../registration';
import {Field, Input, Select} from '../../ui/Field';
import {Section} from '../Section';
import type {StepProps} from '../types';

export function StepFacilities({data, errors, setData}: StepProps) {
  const {t} = useLocalization(), format = useFormatters();
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {if (lastAdded) nameRefs.current[lastAdded]?.focus();}, [lastAdded]);
  const update = (id: string, patch: Partial<FacilityEntry>) => setData(d => ({...d, facilities: d.facilities.map(f => f.id === id ? {...f, ...patch} : f)}));
  const remove = (id: string) => setData(d => ({...d, facilities: d.facilities.filter(f => f.id !== id)}));
  function add() {const id = newId(); setData(d => ({...d, facilities: [...d.facilities, {id, name: '', type: d.facilityTypes[0] ?? '', city: d.org.city, beds: ''}]})); setLastAdded(id);}
  const counts = new Map<string, number>();
  data.facilities.forEach(f => {if (f.type) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);});
  const mix = [...counts.entries()].map(([type, n]) => `${format.number(n)} ${t(pluralize(facilityType(type)?.noun ?? type, n))}`).join(', ');
  // Types the organization said it runs come first in each picker.
  const orderedTypes = [...FACILITY_TYPES.filter(type => data.facilityTypes.includes(type.id)), ...FACILITY_TYPES.filter(type => !data.facilityTypes.includes(type.id))];
  const columns = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_6.5rem_2.5rem]';
  return <Section title={t(data.facilities.length === 1 ? '1 facility' : '{count} facilities', {count: format.number(data.facilities.length)})} description={mix || 'Add each site that will use the workspace.'} error={errors.facilities} errorId="facilities">
    <div id="facilities" tabIndex={-1} data-invalid={errors.facilities ? 'true' : undefined} aria-describedby={errors.facilities ? 'facilities-error' : undefined} className="focus:outline-none">
      <div className={cn('hidden gap-3 px-4 pb-2 text-sm font-medium text-ink-600 md:grid', columns)} aria-hidden="true"><span>{t('Facility name')}</span><span>{t('Type')}</span><span>{t('City')}</span><span>{t('Beds')}</span><span/></div>
      <ul className="space-y-2.5">
        {data.facilities.map((f, i) => {
          const e = (key: string) => errors[`facilities.${i}.${key}`], isHospital = f.type === 'hospital';
          return <li key={f.id} className={cn('grid animate-fade-up gap-3 rounded-2xl border bg-surface p-4 md:items-start md:p-3', columns, Object.keys(errors).some(key => key.startsWith(`facilities.${i}.`)) ? 'border-signal/40' : 'border-ink-200')}>
            <Field label="Facility name" labelClassName="md:sr-only" htmlFor={`facilities.${i}.name`} error={e('name')}>
              <Input ref={element => {nameRefs.current[f.id] = element;}} id={`facilities.${i}.name`} value={f.name} onChange={event => update(f.id, {name: event.target.value})} invalid={!!e('name')} placeholder={i === 0 ? 'e.g. Main Hospital' : 'e.g. Northside Clinic'}/>
            </Field>
            <Field label="Type" labelClassName="md:sr-only" htmlFor={`facilities.${i}.type`} error={e('type')}>
              <Select id={`facilities.${i}.type`} value={f.type} onChange={event => update(f.id, {type: event.target.value as FacilityEntry['type']})} invalid={!!e('type')} placeholder="Choose type">
                {orderedTypes.map(type => <option key={type.id} value={type.id}>{t(type.label)}</option>)}
              </Select>
            </Field>
            <Field label="City" labelClassName="md:sr-only" htmlFor={`facilities.${i}.city`} error={e('city')}><Input id={`facilities.${i}.city`} value={f.city} onChange={event => update(f.id, {city: event.target.value})} invalid={!!e('city')}/></Field>
            <Field label="Beds" labelClassName="md:sr-only" htmlFor={`facilities.${i}.beds`} error={e('beds')}>
              <Input id={`facilities.${i}.beds`} type="number" inputMode="numeric" min={1} value={isHospital ? f.beds : ''} onChange={event => update(f.id, {beds: event.target.value})} disabled={!isHospital} placeholder={isHospital ? 'Beds' : 'n/a'} invalid={!!e('beds')}/>
            </Field>
            <button type="button" onClick={() => remove(f.id)} disabled={data.facilities.length <= 1} aria-label={t('Remove {name}', {name: f.name || t('facility {number}', {number: i + 1})})}
              className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink-600 transition-colors hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] hover:text-signal disabled:opacity-30 md:mt-0 md:w-10">
              <Trash2 className="h-4 w-4" aria-hidden="true"/><span className="md:hidden">{t('Remove')}</span>
            </button>
          </li>;
        })}
      </ul>
      <button type="button" onClick={add} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 text-sm font-semibold text-scrub-800 transition-colors hover:border-scrub-500 hover:bg-scrub-50/50">
        <Plus className="h-4 w-4" aria-hidden="true"/>{t('Add facility')}
      </button>
      <p className="mt-3 text-sm text-ink-500">{t('Departments, wards, pharmacies-in-hospital and price lists are set up per facility after your workspace goes live.')}</p>
    </div>
  </Section>;
}
