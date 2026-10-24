'use client';
import React, {useMemo, useState} from 'react';
import {Search, X} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {CARE_SETTINGS, SPECIALTIES, recommendedCareSettings} from '../../catalog';
import {needsCareSettings} from '../../registration';
import {CatalogIcon} from '../../ui/CatalogIcon';
import {SelectTile, ToggleChip} from '../../ui/Choice';
import {Input} from '../../ui/Field';
import {Section} from '../Section';
import {toggle, type StepProps} from '../types';

export function StepScope({data, errors, setData}: StepProps) {
  const {t} = useLocalization(), format = useFormatters();
  const [query, setQuery] = useState('');
  const required = needsCareSettings(data);
  const suggested = useMemo(() => new Set(recommendedCareSettings(data.facilityTypes)), [data.facilityTypes]);
  // Suggested settings first, then the rest.
  const settings = useMemo(() => [...CARE_SETTINGS.filter(c => suggested.has(c.id)), ...CARE_SETTINGS.filter(c => !suggested.has(c.id))], [suggested]);
  const filtered = useMemo(() => {const q = query.trim().toLowerCase(); return q ? SPECIALTIES.filter(s => s.toLowerCase().includes(q) || t(s).toLowerCase().includes(q)) : SPECIALTIES;}, [query, t]);
  const allShownSelected = filtered.length > 0 && filtered.every(s => data.specialties.includes(s));
  return <div className="space-y-10">
    <Section title="Care settings" description={required ? 'Where you deliver care. Each setting gets its own workflows, worklists and charge rules.' : 'Optional for pharmacies, laboratories and imaging centers.'}
      error={errors.careSettings} errorId="careSettings" aside={<span className="text-sm tabular-nums text-ink-500">{t('{count} selected', {count: format.number(data.careSettings.length)})}</span>}>
      <div id="careSettings" tabIndex={-1} data-invalid={errors.careSettings ? 'true' : undefined} aria-describedby={errors.careSettings ? 'careSettings-error' : undefined} className="grid gap-2.5 focus:outline-none sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {settings.map(c => <SelectTile key={c.id} size="sm" selected={data.careSettings.includes(c.id)} onToggle={() => setData(d => ({...d, careSettings: toggle(d.careSettings, c.id)}))} icon={<CatalogIcon name={c.icon} className="h-[18px] w-[18px]"/>} title={c.label} description={c.description} invalid={!!errors.careSettings}/>)}
      </div>
    </Section>
    <Section title="Specialties" description="Each specialty brings its own note templates, order sets and service codes. Optional; you can add more later."
      aside={<div className="flex items-center gap-3 text-sm"><span className="tabular-nums text-ink-500">{t('{count} selected', {count: format.number(data.specialties.length)})}</span>
        {data.specialties.length > 0 && <button type="button" onClick={() => setData(d => ({...d, specialties: []}))} className="font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('Clear')}</button>}</div>}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <Input id="specialty-search" aria-label="Search specialties" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search {count} specialties', {count: format.number(SPECIALTIES.length)})} leading={<Search className="h-4 w-4" aria-hidden="true"/>}
            trailing={query ? <button type="button" onClick={() => setQuery('')} className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-50 hover:text-ink-700" aria-label={t('Clear search')}><X className="h-4 w-4" aria-hidden="true"/></button> : null}/>
        </div>
        {filtered.length > 0 && <button type="button" onClick={() => setData(d => ({...d, specialties: allShownSelected ? d.specialties.filter(s => !filtered.includes(s)) : Array.from(new Set([...d.specialties, ...filtered]))}))} className="self-start rounded-lg px-2 py-1 text-sm font-semibold text-scrub-800 hover:bg-scrub-50 sm:self-auto">
          {query ? t(allShownSelected ? 'Deselect {count} shown' : 'Select {count} shown', {count: format.number(filtered.length)}) : t(allShownSelected ? 'Deselect all' : 'Select all')}
        </button>}
      </div>
      <div className="scrollbar-thin mt-4 max-h-[17rem] overflow-y-auto rounded-2xl border border-ink-100 bg-surface p-3 sm:p-4" tabIndex={0} role="group" aria-label={t('Specialties')}>
        {filtered.length > 0 ? <div className="flex flex-wrap gap-2">{filtered.map(s => <ToggleChip key={s} selected={data.specialties.includes(s)} onToggle={() => setData(d => ({...d, specialties: toggle(d.specialties, s)}))}>{t(s)}</ToggleChip>)}</div>
          : <p className="px-1 py-6 text-center text-sm text-ink-500">{t('No specialty matches "{query}". You can add custom specialties after setup.', {query})}</p>}
      </div>
    </Section>
  </div>;
}
