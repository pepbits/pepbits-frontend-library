'use client';
import React, {useEffect, useState} from 'react';
import {Check, CircleAlert, LoaderCircle, LockKeyhole, Mail, MessageSquareText, Smartphone} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {BRAND} from '../../brand';
import {ADMIN_ROLES, DATA_REGIONS, country} from '../../catalog';
import {isFreeEmail, type MfaMethod, type WorkspaceSetup} from '../../registration';
import {normalizeSlug, SLUG_RE} from '../../workspaces';
import {useOnboarding} from '../../services';
import {Segmented} from '../../ui/Choice';
import {AffixInput, Field, Input, Select} from '../../ui/Field';
import {PasswordInput, PasswordStrength} from '../../ui/PasswordInput';
import {Section} from '../Section';
import type {StepProps} from '../types';

type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
export function StepWorkspace({data, errors, setData}: StepProps) {
  const {t} = useLocalization(), format = useFormatters(), services = useOnboarding();
  const w = data.workspace, c = country(data.org.country);
  const [slugState, setSlugState] = useState<SlugState>('idle');
  const set = (patch: Partial<WorkspaceSetup>) => setData(d => ({...d, workspace: {...d.workspace, ...patch}}));
  const err = (key: keyof WorkspaceSetup) => errors[`workspace.${key}`];
  useEffect(() => {
    if (!w.slug) {setSlugState('idle'); return;}
    if (!SLUG_RE.test(w.slug)) {setSlugState(w.slug.length < 3 ? 'idle' : 'invalid'); return;}
    setSlugState('checking');
    const timer = setTimeout(() => setSlugState(services.isSlugTaken(w.slug) ? 'taken' : 'available'), 400);
    return () => clearTimeout(timer);
  }, [w.slug, services]);
  const slugStatus = slugState === 'checking' ? <LoaderCircle className="h-4 w-4 animate-spin text-ink-500" aria-hidden="true"/>
    : slugState === 'available' ? <span className="grid h-5 w-5 animate-pop place-items-center rounded-full bg-scrub-600 text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden="true"/></span>
    : slugState === 'taken' || slugState === 'invalid' ? <CircleAlert className="h-4 w-4 text-signal" aria-hidden="true"/> : null;
  const slugHint = slugState === 'available' ? <span className="font-medium text-scrub-800">{t("{address} is available. It can't be changed later.", {address: `${w.slug}.${BRAND.domain}`})}</span>
    : slugState === 'taken' ? <span className="font-medium text-signal">{t('That address is taken. Try adding your city or a short code.')}</span>
    : t("Lowercase letters, numbers and hyphens. It can't be changed later.");
  const regionLabel = DATA_REGIONS.find(region => region.id === w.region)?.label;
  return <div className="grid gap-10 xl:grid-cols-2 xl:gap-12">
    <Section title="Workspace" description="Where your team signs in and where patient data lives.">
      <div className="space-y-5">
        <Field label="Workspace address" htmlFor="workspace.slug" required error={err('slug')} hint={<span aria-live="polite">{slugHint}</span>}>
          <AffixInput id="workspace.slug" hasHint value={w.slug} onChange={event => set({slug: normalizeSlug(event.target.value)})} suffix={`.${BRAND.domain}`} status={slugStatus} invalid={!!err('slug') || slugState === 'taken'} placeholder="your-organization" autoCapitalize="off" autoComplete="off" spellCheck={false} maxLength={32} data-autofocus="true"/>
        </Field>
        <Field label="Data residency" htmlFor="workspace.region" required error={err('region')} hint="Patient data is stored and processed only in this region.">
          <Select id="workspace.region" hasHint value={w.region} onChange={event => set({region: event.target.value})} invalid={!!err('region')} placeholder="Choose a region">
            {DATA_REGIONS.map(region => <option key={region.id} value={region.id}>{t(region.label)}{c?.region === region.id ? ` (${t('recommended')})` : ''}</option>)}
          </Select>
        </Field>
        <div data-orvia-rail className="rounded-2xl bg-rail p-4 text-white" aria-hidden="true">
          <div dir="ltr" className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 py-2.5 text-sm ring-1 ring-white/10">
            <LockKeyhole className="h-4 w-4 shrink-0 text-mint"/>
            <span className="truncate"><span className="text-rail-200">https://</span><span className="font-semibold">{w.slug || 'your-organization'}</span><span className="text-rail-200">.{BRAND.domain}</span></span>
          </div>
          <p className="mt-3 px-1 text-[length:calc(0.8rem*var(--fs-scale))] leading-relaxed text-rail-100">
            {t(data.structure === 'network' && data.facilities.length > 0 ? '{name} with {count} facilities, hosted in {region}.' : '{name}, hosted in {region}.', {
              name: data.org.displayName || data.org.legalName || t('Your organization'), count: format.number(data.facilities.length), region: regionLabel ? t(regionLabel) : t('the region you choose')})}
          </p>
        </div>
      </div>
    </Section>
    <Section title="First administrator" description="This person sets up users, roles and facilities. You can add more admins later.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="workspace.adminName" required error={err('adminName')}><Input id="workspace.adminName" value={w.adminName} onChange={event => set({adminName: event.target.value})} invalid={!!err('adminName')} autoComplete="name" placeholder="Dr. Amira Haddad"/></Field>
        <Field label="Role" htmlFor="workspace.adminRole" required error={err('adminRole')}>
          <Select id="workspace.adminRole" value={w.adminRole} onChange={event => set({adminRole: event.target.value})} invalid={!!err('adminRole')} placeholder="Choose a role">{ADMIN_ROLES.map(role => <option key={role} value={role}>{t(role)}</option>)}</Select>
        </Field>
        <Field label="Work email" htmlFor="workspace.adminEmail" required error={err('adminEmail')} hint={isFreeEmail(w.adminEmail) ? <span className="font-medium text-caution">{t("Personal email addresses take longer to verify. Use your organization's email if you can.")}</span> : "We'll send a verification link here."}>
          <Input id="workspace.adminEmail" hasHint type="email" value={w.adminEmail} onChange={event => set({adminEmail: event.target.value})} invalid={!!err('adminEmail')} autoComplete="email" placeholder="name@hospital.org"/>
        </Field>
        <Field label="Mobile number" htmlFor="workspace.adminPhone" required error={err('adminPhone')}>
          <AffixInput id="workspace.adminPhone" type="tel" inputMode="tel" value={w.adminPhone} onChange={event => set({adminPhone: event.target.value})} invalid={!!err('adminPhone')} prefix={c?.dial ?? '+'} autoComplete="tel-national"/>
        </Field>
        <Field label="Password" htmlFor="workspace.password" required error={err('password')} className="sm:col-span-2">
          <PasswordInput id="workspace.password" value={w.password} onChange={event => set({password: event.target.value})} invalid={!!err('password')} autoComplete="new-password"/>
        </Field>
        <div className="sm:col-span-2"><PasswordStrength password={w.password} personal={[w.adminEmail.split('@')[0] ?? '', w.slug]}/></div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <p className="text-sm font-medium text-ink-800" id="mfa-label">{t('Second sign-in step')}</p>
          <Segmented<MfaMethod> label="Second sign-in step" value={w.mfa} onChange={value => set({mfa: value})} options={[
            {value: 'authenticator', label: <><Smartphone className="h-4 w-4" aria-hidden="true"/><span>{t('App')}</span></>},
            {value: 'sms', label: <><MessageSquareText className="h-4 w-4" aria-hidden="true"/><span>{t('SMS')}</span></>},
            {value: 'email', label: <><Mail className="h-4 w-4" aria-hidden="true"/><span>{t('Email')}</span></>},
          ]}/>
          <p className="text-[length:calc(0.8rem*var(--fs-scale))] text-ink-500">{t(w.mfa === 'authenticator' ? 'Most secure. Works with Google Authenticator, Microsoft Authenticator or 1Password.' : w.mfa === 'sms' ? "We'll text a code to your mobile number each time you sign in on a new device." : "We'll email a code each time you sign in on a new device.")}</p>
        </div>
      </div>
    </Section>
  </div>;
}
