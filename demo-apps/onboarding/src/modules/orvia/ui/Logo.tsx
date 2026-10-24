'use client';
import React from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {cn} from '@pepbits/ui';
import {BRAND} from '../brand';
import {OrviaLink} from '../services';

export function LogoMark({className}: {className?: string}) {
  return <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8 shrink-0', className)}>
    <rect width="32" height="32" rx="9" className="fill-scrub-700"/>
    <path d="M5 17.5h5.5l2.6-6.5 4.2 12 2.7-5.5H27" fill="none" stroke="var(--color-mint)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
/** Product mark linking to the landing page. `light` is for the dark brand rails. */
export function Logo({tone = 'dark', className}: {tone?: 'dark' | 'light'; className?: string}) {
  const {t} = useLocalization();
  return <OrviaLink to="orvia-landing" className={cn('inline-flex items-center gap-2.5 rounded-lg', className)} aria-label={t('{product} home', {product: BRAND.product})}>
    <LogoMark/>
    <span dir="ltr" className={cn('font-display text-[length:calc(1.4rem*var(--fs-scale))] font-semibold tracking-[-0.02em]', tone === 'light' ? 'text-white' : 'text-ink-900')}>{BRAND.name}</span>
  </OrviaLink>;
}
