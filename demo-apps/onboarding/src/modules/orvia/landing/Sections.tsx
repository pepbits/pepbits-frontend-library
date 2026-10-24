'use client';
import React, {useRef, useState, type KeyboardEvent} from 'react';
import {Building2, Check, FileLock2, FlaskConical, Globe, History, Hospital, KeyRound, LockKeyhole, Pill, ShieldCheck, Stethoscope, Workflow} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {cn} from '@pepbits/ui';
import {BRAND} from '../brand';
import {CARE_SETTINGS, FACILITY_TYPES, MODULE_GROUPS, NETWORK_PROFILE, STANDARD_GROUPS, type IconName} from '../catalog';
import {ButtonLink} from '../ui/Button';
import {CatalogIcon} from '../ui/CatalogIcon';
import {CarePathway} from './CarePathway';

const PROOF = [{icon: ShieldCheck, text: 'HIPAA and GDPR controls'}, {icon: Workflow, text: 'HL7 v2 and FHIR R4 interfaces'}, {icon: Globe, text: 'Data stored in your region'}];
export function Hero() {
  const {t} = useLocalization();
  return <section className="grid w-full grid-cols-1 items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12 lg:px-10 lg:py-8 2xl:gap-20 2xl:px-16">
    <div className="min-w-0 max-w-[40rem]">
      <h1 className="font-display text-[length:calc(2.7rem*var(--fs-scale))] font-semibold leading-[0.98] tracking-[-0.035em] text-ink-900 sm:text-6xl xl:text-[length:calc(4.6rem*var(--fs-scale))] 2xl:text-[length:calc(5.4rem*var(--fs-scale))]">{t('One record of care, from front desk to final claim.')}</h1>
      <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-600 xl:text-xl xl:leading-relaxed">{t('Orvia runs hospitals, clinics, pharmacies, laboratories and imaging centers on one platform. Each organization gets its own secure workspace, with clinical care, dispensing and billing working from the same patient record.')}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="orvia-register" size="lg">{t('Register your organization')}</ButtonLink>
        <ButtonLink to="orvia-workspace" variant="secondary" size="lg">{t('Sign in to your workspace')}</ButtonLink>
      </div>
      <ul className="mt-9 flex flex-col gap-2.5 text-sm text-ink-600 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {PROOF.map(({icon: Icon, text}) => <li key={text} className="flex items-center gap-2"><Icon className="h-4 w-4 text-scrub-600" aria-hidden="true"/>{t(text)}</li>)}
      </ul>
    </div>
    <CarePathway/>
  </section>;
}

interface Profile {id: string; label: string; noun: string; icon: IconName; summary: string; description: string; careSettings: string[]; modules: string[]}
const PROFILES: Profile[] = [...FACILITY_TYPES, NETWORK_PROFILE];
/** Organization-type tabs (vertical tablist) showing each profile's care settings and starting modules. */
export function FacilityExplorer() {
  const {t, direction} = useLocalization(), format = useFormatters();
  const [activeId, setActiveId] = useState<string>(PROFILES[0]!.id);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = PROFILES.find(profile => profile.id === activeId)!, activeIndex = PROFILES.indexOf(active);
  const groups = MODULE_GROUPS.map(group => ({...group, modules: group.modules.filter(module => active.modules.includes(module.id))})).filter(group => group.modules.length > 0);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const forward = event.key === 'ArrowDown' || event.key === (direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    const back = event.key === 'ArrowUp' || event.key === (direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    if (!forward && !back) return;
    event.preventDefault();
    const next = (activeIndex + (forward ? 1 : -1) + PROFILES.length) % PROFILES.length;
    setActiveId(PROFILES[next]!.id); tabs.current[next]?.focus();
  }
  const article = /^[aeiou]/i.test(active.noun) ? 'an' : 'a';
  return <section id="platform" className="scroll-mt-16 border-t border-ink-100 bg-surface">
    <div className="grid w-full grid-cols-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,2.25fr)] lg:gap-12 lg:px-10 lg:py-20 2xl:px-16">
      <div className="min-w-0">
        <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[length:calc(2.6rem*var(--fs-scale))]">{t('Set up for the way you deliver care')}</h2>
        <p className="mt-4 max-w-md leading-relaxed text-ink-600">{t('Pick the kind of organization you run to see what it starts with. Every module shares one patient record, so you can switch more on as you grow.')}</p>
        <div role="tablist" aria-label={t('Organization types')} aria-orientation="vertical" onKeyDown={onKeyDown} className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
          {PROFILES.map((profile, i) => {
            const selected = profile.id === activeId;
            return <button key={profile.id} ref={element => {tabs.current[i] = element;}} id={`tab-${profile.id}`} role="tab" type="button" aria-selected={selected} aria-controls="facility-panel" tabIndex={selected ? 0 : -1} onClick={() => setActiveId(profile.id)}
              className={cn('flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors duration-150 lg:w-full', selected ? 'border-scrub-700 bg-scrub-700 text-white' : 'border-ink-100 bg-surface text-ink-700 hover:border-ink-200 hover:bg-ink-50 lg:border-transparent')}>
              <CatalogIcon name={profile.icon} className="h-[18px] w-[18px] shrink-0"/>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-semibold">{t(profile.label)}</span>
                <span className={cn('hidden text-[length:calc(0.8rem*var(--fs-scale))] leading-snug lg:block', selected ? 'text-white' : 'text-ink-500')}>{t(profile.summary)}</span>
              </span>
            </button>;
          })}
        </div>
      </div>
      <div id="facility-panel" role="tabpanel" aria-labelledby={`tab-${active.id}`} className="min-w-0 rounded-3xl border border-ink-100 bg-paper p-5 sm:p-8 xl:p-10">
        <div key={active.id} className="animate-fade-up">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-3xl">{t(active.label)}</h3>
              <p className="mt-3 leading-relaxed text-ink-600">{t(active.description)}</p>
            </div>
            <ButtonLink to="orvia-register" params={active.id === 'network' ? {structure: 'network'} : {type: active.id}} variant="secondary" className="self-start">
              {t(`Register as ${article} {noun}`, {noun: t(active.noun)})}
            </ButtonLink>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="me-1 text-sm font-medium text-ink-700">{t('Care settings')}</span>
            {active.careSettings.map(id => {
              const setting = CARE_SETTINGS.find(item => item.id === id);
              return setting ? <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface px-3 py-1 text-sm text-ink-700"><CatalogIcon name={setting.icon} className="h-3.5 w-3.5 text-scrub-600"/>{t(setting.label)}</span> : null;
            })}
          </div>
          <div className="mt-8 grid gap-x-8 gap-y-7 border-t border-ink-100 pt-7 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map(group => <div key={group.id}>
              <p className="text-sm font-semibold text-ink-900">{t(group.label)}<span className="ms-2 font-normal tabular-nums text-ink-500">{format.number(group.modules.length)}</span></p>
              <ul className="mt-2.5 space-y-2">
                {group.modules.map(module => <li key={module.id} className="flex items-start gap-2 text-[length:calc(0.92rem*var(--fs-scale))] leading-snug text-ink-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-scrub-600" strokeWidth={2.5} aria-hidden="true"/>{t(module.label)}</li>)}
              </ul>
            </div>)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

const SAFEGUARDS = [
  {icon: LockKeyhole, title: 'Encrypted everywhere', text: 'AES-256 at rest and TLS 1.3 in transit, with keys managed per tenant.'},
  {icon: History, title: 'Every access is logged', text: 'An immutable audit trail records who opened which chart, and when.'},
  {icon: KeyRound, title: 'Least-privilege access', text: 'Role-based permissions, MFA for all clinical users and break-the-glass with review.'},
  {icon: FileLock2, title: 'Agreements at signup', text: 'Business associate and data processing agreements are signed during registration.'},
];
export function Compliance() {
  const {t} = useLocalization();
  return <section id="compliance" className="scroll-mt-16 border-t border-ink-100 bg-paper">
    <div className="grid w-full grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,2.25fr)] lg:gap-12 lg:px-10 lg:py-20 2xl:px-16">
      <div>
        <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[length:calc(2.6rem*var(--fs-scale))]">{t('Built for regulated care')}</h2>
        <p className="mt-4 max-w-md leading-relaxed text-ink-600">{t("Patient data never leaves the region you choose, and each organization's data is isolated in its own tenant.")}</p>
      </div>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] xl:gap-12">
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
          {SAFEGUARDS.map(({icon: Icon, title, text}) => <li key={title} className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-scrub-100 text-scrub-800"><Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.8}/></span>
            <div><p className="font-semibold text-ink-900">{t(title)}</p><p className="mt-1 text-[length:calc(0.92rem*var(--fs-scale))] leading-relaxed text-ink-600">{t(text)}</p></div>
          </li>)}
        </ul>
        <dl className="divide-y divide-ink-200 border-y border-ink-200">
          {STANDARD_GROUPS.map(group => <div key={group.id} className="grid gap-3 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
            <dt><p className="font-semibold text-ink-900">{t(group.label)}</p><p className="mt-0.5 text-[length:calc(0.8rem*var(--fs-scale))] leading-snug text-ink-500">{t(group.description)}</p></dt>
            <dd className="flex flex-wrap content-start gap-2">{group.items.map(item => <span key={item.id} dir="ltr" className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-sm font-medium text-ink-800">{item.label}</span>)}</dd>
          </div>)}
        </dl>
      </div>
    </div>
  </section>;
}

const STEPS = [
  {title: 'Register your organization', text: 'About ten minutes. Choose your facilities, modules and an address for your workspace.'},
  {title: 'We verify your license', text: 'Our compliance team checks your registration within one business day.'},
  {title: 'Your team signs in', text: 'Staff sign in at your own address, like {address}, with MFA from day one.'},
];
const TREE = [
  {icon: Hospital, name: "St. Mary's Main Hospital", meta: '420 beds'},
  {icon: Stethoscope, name: 'Northside Family Clinic', meta: 'Outpatient'},
  {icon: Pill, name: "St. Mary's Pharmacy", meta: 'Retail and inpatient'},
  {icon: FlaskConical, name: 'Central Lab and Imaging', meta: 'LIS and RIS'},
];
export function HowWorkspaces() {
  const {t} = useLocalization(), format = useFormatters();
  return <section id="workspaces" className="scroll-mt-16 border-t border-ink-100 bg-surface">
    <div className="grid w-full grid-cols-1 items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-20 2xl:px-16">
      <div>
        <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[length:calc(2.6rem*var(--fs-scale))]">{t('Every organization gets its own workspace')}</h2>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-600">{t('A workspace is your private tenant. Groups with several hospitals, clinics or pharmacies run each one as an entity inside it, with one patient index and consolidated reporting.')}</p>
        <ol className="mt-8 space-y-5">
          {STEPS.map((step, i) => <li key={step.title} className="flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-scrub-300 font-display text-sm font-semibold text-scrub-800">{format.number(i + 1)}</span>
            <div><p className="font-semibold text-ink-900">{t(step.title)}</p><p className="mt-0.5 text-[length:calc(0.95rem*var(--fs-scale))] leading-relaxed text-ink-600">{t(step.text, {address: `stmarys.${BRAND.domain}`})}</p></div>
          </li>)}
        </ol>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="orvia-register" size="lg">{t('Register your organization')}</ButtonLink>
          <ButtonLink to="orvia-workspace" variant="secondary" size="lg">{t('Find my workspace')}</ButtonLink>
        </div>
      </div>
      <div className="rounded-3xl border border-ink-100 bg-paper p-4 sm:p-6" aria-hidden="true">
        <div dir="ltr" className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3.5 py-2.5 text-sm">
          <LockKeyhole className="h-4 w-4 text-scrub-600"/>
          <span className="truncate"><span className="text-ink-500">https://</span><span className="font-semibold text-ink-900">stmarys</span><span className="text-ink-500">.{BRAND.domain}</span></span>
        </div>
        <div className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-ink-100">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-scrub-700 text-white"><Building2 className="h-5 w-5"/></span>
            <div><p className="font-semibold text-ink-900">St. Mary&apos;s Medical Center</p><p className="text-sm text-ink-500">{t('Workspace with {count} entities', {count: format.number(4)})}</p></div>
          </div>
          <ul className="relative ms-5 mt-4 space-y-2 border-s border-dashed border-ink-200 ps-5">
            {TREE.map(({icon: Icon, name, meta}) => <li key={name} className="relative flex items-center gap-3 rounded-xl bg-paper px-3 py-2.5">
              <span className="absolute -start-5 top-1/2 h-px w-5 border-t border-dashed border-ink-200"/>
              <Icon className="h-4 w-4 shrink-0 text-scrub-700"/>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800">{name}</span>
              <span className="hidden text-[length:calc(0.8rem*var(--fs-scale))] text-ink-500 sm:block">{t(meta)}</span>
            </li>)}
          </ul>
        </div>
      </div>
    </div>
  </section>;
}
