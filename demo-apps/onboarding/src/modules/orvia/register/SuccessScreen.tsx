'use client';
import React, {useState} from 'react';
import {Check, Copy, LockKeyhole} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {BRAND} from '../brand';
import {ButtonLink} from '../ui/Button';

export function SuccessScreen({slug, email, reference}: {slug: string; email: string; reference: string}) {
  const {t} = useLocalization(), format = useFormatters();
  const [copied, setCopied] = useState<'idle' | 'copied' | 'blocked'>('idle');
  const address = `https://${slug}.${BRAND.domain}`;
  async function copy() {
    try {await navigator.clipboard.writeText(address); setCopied('copied'); setTimeout(() => setCopied('idle'), 1800);}
    catch {setCopied('blocked');}
  }
  const next = [
    {title: 'Confirm your email', text: 'Open the link we sent to {email}. It expires in 24 hours.', when: 'Now'},
    {title: 'License review', text: 'Our compliance team checks your license and may call your main number.', when: 'Within 1 business day'},
    {title: 'Workspace goes live', text: "We email you when it's ready. Sign in to invite staff and set up facilities.", when: 'Right after review'},
  ];
  return <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">
    <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
      <circle cx="32" cy="32" r="30" className="origin-fill-center animate-pop fill-scrub-700"/>
      <path d="M20 33l8 8 16-17" fill="none" stroke="var(--color-mint)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" style={{animation: 'orvia-trace 600ms cubic-bezier(.65,0,.35,1) 300ms both'}}/>
    </svg>
    <h1 tabIndex={-1} data-success-heading className="mt-6 font-display text-[length:calc(2.3rem*var(--fs-scale))] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 focus:outline-none sm:text-5xl">{t('Registration submitted')}</h1>
    <p className="mt-3 text-lg leading-relaxed text-ink-600">{t('Your reference is')} <span dir="ltr" className="font-semibold tabular-nums text-ink-900" data-reference>{reference}</span>. {t('Keep it handy if you contact us.')}</p>
    <div className="mt-7 flex items-center gap-2 rounded-2xl border border-ink-200 bg-surface p-2 ps-4">
      <LockKeyhole className="h-4 w-4 shrink-0 text-scrub-600" aria-hidden="true"/>
      <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[length:calc(0.95rem*var(--fs-scale))]"><span className="text-ink-500">https://</span><span className="font-semibold text-ink-900">{slug}</span><span className="text-ink-500">.{BRAND.domain}</span></span>
      <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-scrub-800 transition-colors hover:bg-scrub-50">
        {copied === 'copied' ? <Check className="h-4 w-4 animate-pop" aria-hidden="true"/> : <Copy className="h-4 w-4" aria-hidden="true"/>}
        <span aria-live="polite">{t(copied === 'copied' ? 'Copied' : copied === 'blocked' ? 'Copy blocked; select the address' : 'Copy address')}</span>
      </button>
    </div>
    <ol className="mt-8 space-y-0">
      {next.map((item, i) => <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0">
        {i < next.length - 1 && <span className="absolute bottom-0 start-[15.5px] top-9 w-px bg-ink-200" aria-hidden="true"/>}
        <span className={i === 0 ? 'grid h-8 w-8 shrink-0 place-items-center rounded-full bg-scrub-700 text-sm font-semibold text-white' : 'grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 bg-surface text-sm font-semibold text-ink-600'}>{format.number(i + 1)}</span>
        <div className="pt-1">
          <p className="font-semibold text-ink-900">{t(item.title)}<span className="ms-2 text-sm font-normal text-ink-500">{t(item.when)}</span></p>
          <p className="mt-0.5 text-[length:calc(0.95rem*var(--fs-scale))] leading-relaxed text-ink-600">{t(item.text, {email})}</p>
        </div>
      </li>)}
    </ol>
    <div className="mt-9 flex flex-col gap-3 sm:flex-row">
      <ButtonLink to="orvia-sign-in" params={{ws: slug}} size="lg">{t('Go to workspace sign-in')}</ButtonLink>
      <ButtonLink to="orvia-landing" variant="secondary" size="lg">{t('Back to home')}</ButtonLink>
    </div>
  </div>;
}
