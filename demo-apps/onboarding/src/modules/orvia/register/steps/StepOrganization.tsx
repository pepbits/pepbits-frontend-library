'use client';
import React from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {FACILITY_TYPES} from '../../catalog';
import {CatalogIcon} from '../../ui/CatalogIcon';
import {SelectTile} from '../../ui/Choice';
import {Section} from '../Section';
import {toggle, type StepProps} from '../types';

export function StepOrganization({data, errors, setData}: StepProps) {
  const {t} = useLocalization(), format = useFormatters();
  return <div className="space-y-10">
    <Section title="How is your organization set up?" error={errors.structure} errorId="structure">
      <div id="structure" tabIndex={-1} data-invalid={errors.structure ? 'true' : undefined} aria-describedby={errors.structure ? 'structure-error' : undefined} className="grid gap-3 focus:outline-none sm:grid-cols-2">
        <SelectTile kind="single" selected={data.structure === 'single'} onToggle={() => setData(d => ({...d, structure: 'single'}))} icon={<CatalogIcon name="single"/>} title="Single facility" description="One hospital, clinic, pharmacy, lab or imaging center at one location." invalid={!!errors.structure}/>
        <SelectTile kind="single" selected={data.structure === 'network'} onToggle={() => setData(d => ({...d, structure: 'network'}))} icon={<CatalogIcon name="network"/>} title="Multi-facility network" description="A group running several hospitals, clinics, pharmacies or labs under one organization." invalid={!!errors.structure}/>
      </div>
    </Section>
    <Section title="What do you operate?" description="Select everything that applies. We use this to suggest care settings and modules." error={errors.facilityTypes} errorId="facilityTypes"
      aside={data.facilityTypes.length > 0 ? <span className="text-sm tabular-nums text-ink-500">{t('{count} selected', {count: format.number(data.facilityTypes.length)})}</span> : null}>
      <div id="facilityTypes" tabIndex={-1} data-invalid={errors.facilityTypes ? 'true' : undefined} aria-describedby={errors.facilityTypes ? 'facilityTypes-error' : undefined} className="grid gap-3 focus:outline-none sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {FACILITY_TYPES.map(type => <SelectTile key={type.id} selected={data.facilityTypes.includes(type.id)} onToggle={() => setData(d => ({...d, facilityTypes: toggle(d.facilityTypes, type.id)}))} icon={<CatalogIcon name={type.icon}/>} title={type.label} description={type.summary} invalid={!!errors.facilityTypes}/>)}
      </div>
    </Section>
  </div>;
}
