'use client';
import React, {type ReactNode} from 'react';
import {Pencil} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {BRAND} from '../../brand';
import {ADMIN_ROLES, EMRAM_TARGETS, INTEGRATIONS, MODULE_GROUPS, STANDARD_GROUPS, careSetting, country, facilityType, regionLabel} from '../../catalog';
import type {Consents, StepId} from '../../registration';
import {CheckRow} from '../../ui/Choice';
import {Section} from '../Section';
import type {StepProps} from '../types';

export function StepReview({data, errors, setData, onJump}: StepProps) {
  const {t} = useLocalization(), format = useFormatters();
  const o = data.org, w = data.workspace, c = country(o.country);
  const standards = STANDARD_GROUPS.flatMap(group => group.items).filter(item => data.standards.includes(item.id));
  const integrations = INTEGRATIONS.filter(item => data.integrations.includes(item.id));
  const setConsent = (key: keyof Consents, value: boolean) => setData(d => ({...d, consents: {...d.consents, [key]: value}}));
  const list = (values: string[]) => values.map(value => t(value)).join(', ');
  const specialties = data.specialties.length === 0 ? t('None yet') : data.specialties.length <= 4 ? list(data.specialties) : t('{first} and {count} more', {first: list(data.specialties.slice(0, 3)), count: format.number(data.specialties.length - 3)});
  return <div className="space-y-10">
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      <Card title="Organization" step="organization" onJump={onJump}>
        <Row label="Setup">{t(data.structure === 'network' ? 'Multi-facility network' : 'Single facility')}</Row>
        <Row label="Operates">{list(data.facilityTypes.map(type => facilityType(type)?.label ?? type))}</Row>
      </Card>
      <Card title="Details" step="details" onJump={onJump}>
        <Row label="Legal name">{o.legalName}</Row>
        {o.displayName && <Row label="Display name">{o.displayName}</Row>}
        <Row label="License">{o.licenseNumber}</Row>
        <Row label="Location">{[o.city, c ? t(c.name) : ''].filter(Boolean).join(', ')}</Row>
        <Row label="Phone"><span dir="ltr">{c?.dial} {o.phone}</span></Row>
        <Row label="Regional">{o.timezone.replace(/_/g, ' ')}, {o.currency}</Row>
        {o.beds && data.structure !== 'network' && <Row label="Beds">{format.number(Number(o.beds))}</Row>}
      </Card>
      {data.structure === 'network' && <Card title={t('Facilities ({count})', {count: format.number(data.facilities.length)})} step="facilities" onJump={onJump}>
        <ul className="space-y-1.5">{data.facilities.map(f => <li key={f.id} className="flex justify-between gap-3 text-sm"><span className="truncate font-medium text-ink-900">{f.name}</span><span className="shrink-0 text-ink-600">{t(facilityType(f.type)?.label ?? '')}, {f.city}</span></li>)}</ul>
      </Card>}
      <Card title="Clinical scope" step="scope" onJump={onJump}>
        <Row label="Care settings">{data.careSettings.length ? list(data.careSettings.map(id => careSetting(id)?.label ?? id)) : t('None')}</Row>
        <Row label="Specialties">{specialties}</Row>
      </Card>
      <Card title={t('Modules ({count})', {count: format.number(data.modules.length)})} step="modules" onJump={onJump}>
        {MODULE_GROUPS.map(group => {const n = group.modules.filter(m => data.modules.includes(m.id)).length; return n ? <Row key={group.id} label={group.label}>{t('{count} of {total}', {count: format.number(n), total: format.number(group.modules.length)})}</Row> : null;})}
        <Row label="Standards"><span dir="ltr">{standards.map(s => s.label).join(', ') || t('None')}</span></Row>
        <Row label="Integrations">{list(integrations.map(i => i.label)) || t('None')}</Row>
        {data.emramTarget !== 'none' && <Row label="EMRAM target">{t(EMRAM_TARGETS.find(target => target.value === data.emramTarget)?.label ?? '')}</Row>}
      </Card>
      <Card title="Workspace and administrator" step="workspace" onJump={onJump}>
        <Row label="Address"><span dir="ltr" className="font-semibold text-scrub-800">{w.slug}.{BRAND.domain}</span></Row>
        <Row label="Data stored in">{t(regionLabel(w.region))}</Row>
        <Row label="Administrator">{w.adminName}{ADMIN_ROLES.includes(w.adminRole) && <span className="text-ink-600">, {t(w.adminRole)}</span>}</Row>
        <Row label="Email">{w.adminEmail}</Row>
        <Row label="Sign-in step">{t(w.mfa === 'authenticator' ? 'Authenticator app' : w.mfa === 'sms' ? 'SMS code' : 'Email code')}</Row>
      </Card>
    </div>
    <Section title="Agreements" description="Required to store and process patient health information on your behalf.">
      <div className="max-w-3xl space-y-1 rounded-2xl border border-ink-200 bg-surface p-2">
        <Consent id="consents.terms" checked={data.consents.terms} onChange={value => setConsent('terms', value)} error={errors['consents.terms']} label={<>{t('I accept the')} <DocLink href="/legal/terms">{t('terms of service')}</DocLink> {t('on behalf of {organization}', {organization: o.legalName || t('my organization')})}</>}/>
        <Consent id="consents.baa" checked={data.consents.baa} onChange={value => setConsent('baa', value)} error={errors['consents.baa']} label={<>{t('I accept the')} <DocLink href="/legal/baa">{t('business associate agreement')}</DocLink> (HIPAA)</>}/>
        <Consent id="consents.dpa" checked={data.consents.dpa} onChange={value => setConsent('dpa', value)} error={errors['consents.dpa']} label={<>{t('I accept the')} <DocLink href="/legal/dpa">{t('data processing agreement')}</DocLink> ({t('GDPR and local privacy law')})</>}/>
        <CheckRow id="consents.updates" checked={data.consents.updates} onChange={value => setConsent('updates', value)} label="Email me product updates and release notes" description="Optional. You can unsubscribe at any time."/>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-600">{t("After you submit, we'll email {email} to confirm the address. Our compliance team reviews your license within one business day, then your workspace goes live.", {email: w.adminEmail || t('the administrator')})}</p>
    </Section>
  </div>;
}
function Card({title, step, onJump, children}: {title: string; step: StepId; onJump?: (id: StepId) => void; children: ReactNode}) {
  const {t} = useLocalization();
  return <section className="flex flex-col rounded-2xl border border-ink-200 bg-surface" aria-label={t(title)}>
    <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
      <h2 className="font-semibold text-ink-900">{t(title)}</h2>
      <button type="button" onClick={() => onJump?.(step)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-scrub-800 hover:bg-scrub-50" aria-label={t('Edit {section}', {section: t(title)})}><Pencil className="h-3.5 w-3.5" aria-hidden="true"/>{t('Edit')}</button>
    </header>
    <div className="space-y-2 px-4 py-3.5">{children}</div>
  </section>;
}
function Row({label, children}: {label: string; children: ReactNode}) {
  const {t} = useLocalization();
  return <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-sm"><span className="text-ink-600">{t(label)}</span><span className="break-words text-ink-900">{children}</span></div>;
}
function DocLink({href, children}: {href: string; children: ReactNode}) {
  return <a href={href} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="font-semibold text-scrub-800 underline decoration-scrub-300 underline-offset-2 hover:decoration-scrub-700">{children}</a>;
}
function Consent({id, checked, onChange, label, error}: {id: string; checked: boolean; onChange: (value: boolean) => void; label: ReactNode; error?: string}) {
  const {t} = useLocalization();
  return <div><CheckRow id={id} checked={checked} onChange={onChange} label={label} invalid={!!error}/>{error && <p id={`${id}-error`} className="animate-fade-in px-11 pb-1 text-[length:calc(0.8rem*var(--fs-scale))] font-medium text-signal">{t(error)}</p>}</div>;
}
