'use client';
import React, {type ReactNode} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import {cn} from '@pepbits/ui';
import {BRAND} from './brand';
import {SAMPLE_DIRECTORY} from '../../adapters/onboarding';
import {AuthShell} from './auth/AuthShell';
import {SignInFlow} from './auth/SignInFlow';
import {WorkspaceFinder} from './auth/WorkspaceFinder';
import {Compliance, FacilityExplorer, Hero, HowWorkspaces} from './landing/Sections';
import {SiteFooter, SiteHeader} from './landing/SiteHeader';
import {RegisterWizard} from './register/RegisterWizard';
import {ButtonLink} from './ui/Button';
import {Logo} from './ui/Logo';

/** Scoped Orvia surface: host theme mapping, effective reduced motion and the fictional-data notice. */
export function OrviaSurface({fill = false, children}: {fill?: boolean; children: ReactNode}) {
  const {preferences} = usePreferences(), {direction} = useLocalization();
  return <div className={cn('orvia flex w-full flex-col', fill && 'min-h-0 flex-1')} dir={direction} data-orvia-palette="host" data-reduced-motion={String(preferences.reducedMotion)} {...(fill ? {'data-reference-layout': 'fill'} : {})}>{children}</div>;
}

export function LandingRoute(_: PageRenderContext) {
  return <OrviaSurface><SiteHeader/><div><Hero/><FacilityExplorer/><Compliance/><HowWorkspaces/></div><SiteFooter/></OrviaSurface>;
}
export function WorkspaceRoute(_: PageRenderContext) {
  const {t} = useLocalization();
  return <OrviaSurface fill><AuthShell aside={<div className="max-w-md">
    <p className="font-display text-[length:calc(2.4rem*var(--fs-scale))] font-semibold leading-[1.05] tracking-[-0.025em] xl:text-[length:calc(2.8rem*var(--fs-scale))]">{t('Each organization signs in at its own address.')}</p>
    <p className="mt-5 leading-relaxed text-rail-100">{t('Your hospital, clinic or pharmacy group has a private workspace on {brand}. Patient records, users and settings stay inside it.', {brand: BRAND.name})}</p>
    <div className="mt-8 space-y-2" aria-hidden="true">
      {SAMPLE_DIRECTORY.slice(0, 3).map((record, i) => <div key={record.slug} dir="ltr" className="flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-3 text-[length:calc(0.95rem*var(--fs-scale))] ring-1 ring-white/10" style={{opacity: 1 - i * 0.28}}>
        <span className="h-2 w-2 rounded-full bg-mint"/><span><span className="font-semibold text-white">{record.slug}</span><span className="text-rail-200">.{BRAND.domain}</span></span>
      </div>)}
    </div>
  </div>}><WorkspaceFinder/></AuthShell></OrviaSurface>;
}
export function SignInRoute(_: PageRenderContext) {
  const {t} = useLocalization();
  return <OrviaSurface fill><AuthShell aside={<div className="max-w-md">
    <p className="font-display text-[length:calc(2.4rem*var(--fs-scale))] font-semibold leading-[1.05] tracking-[-0.025em] xl:text-[length:calc(2.8rem*var(--fs-scale))]">{t('Good to see you again.')}</p>
    <p className="mt-5 leading-relaxed text-rail-100">{t('Your worklists, patients and pending claims are where you left them. Sign-in codes are required for every account that can open a patient record.')}</p>
  </div>}><SignInFlow/></AuthShell></OrviaSurface>;
}
export function RegisterRoute(_: PageRenderContext) {return <OrviaSurface fill><RegisterWizard/></OrviaSurface>;}
/** Source not-found page. */
export function OrviaNotFound() {
  const {t} = useLocalization();
  return <OrviaSurface fill><div className="flex min-h-full flex-1 flex-col px-4 sm:px-6 lg:px-10">
    <div className="flex h-16 items-center"><Logo/></div>
    <div className="mx-auto flex max-w-md flex-1 flex-col justify-center pb-16">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.025em] text-ink-900">{t("This page doesn't exist")}</h1>
      <p className="mt-3 leading-relaxed text-ink-600">{t('Check the address, or go back to the start.')}</p>
      <div className="mt-7 flex gap-3"><ButtonLink to="orvia-landing">{t('Go to home')}</ButtonLink><ButtonLink to="orvia-workspace" variant="secondary">{t('Find your workspace')}</ButtonLink></div>
    </div>
  </div></OrviaSurface>;
}
