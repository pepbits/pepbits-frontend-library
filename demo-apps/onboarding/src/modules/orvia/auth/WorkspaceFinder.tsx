'use client';
import React, {useEffect, useRef, useState, type FormEvent} from 'react';
import {Check, ChevronRight, CircleAlert, Clock3, LoaderCircle, Mail, SearchX} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {cn} from '@pepbits/ui';
import {BRAND} from '../brand';
import {EMAIL_RE} from '../registration';
import {initials, normalizeSlug, SLUG_RE, type WorkspaceRecord} from '../workspaces';
import {OrviaLink, useOnboarding, useOpen} from '../services';
import {Button} from '../ui/Button';
import {Segmented} from '../ui/Choice';
import {AffixInput, Field, Input} from '../ui/Field';

type Mode = 'address' | 'email';
type Lookup = {state: 'idle'} | {state: 'checking'} | {state: 'found'; record: WorkspaceRecord} | {state: 'missing'} | {state: 'invalid'} | {state: 'failed'};

/** Find a workspace by address (debounced live lookup) or by work email. */
export function WorkspaceFinder() {
  const {t} = useLocalization(), format = useFormatters(), services = useOnboarding(), open = useOpen();
  const [mode, setMode] = useState<Mode>('address');
  const [slug, setSlug] = useState(''), [lookup, setLookup] = useState<Lookup>({state: 'idle'}), [continuing, setContinuing] = useState(false), [retry, setRetry] = useState(0);
  const [recent] = useState<WorkspaceRecord[]>(() => services.recentWorkspaces());
  const slugRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(''), [emailError, setEmailError] = useState<string>(), [searching, setSearching] = useState(false), [results, setResults] = useState<WorkspaceRecord[] | null>(null), [searchFailed, setSearchFailed] = useState(false);
  const emailRequest = useRef<AbortController | null>(null);
  useEffect(() => () => emailRequest.current?.abort(), []);

  useEffect(() => {
    const normalized = normalizeSlug(slug);
    if (!normalized) {setLookup({state: 'idle'}); return;}
    if (!SLUG_RE.test(normalized)) {setLookup(normalized.length < 3 ? {state: 'idle'} : {state: 'invalid'}); return;}
    setLookup({state: 'checking'});
    const controller = new AbortController();
    const timer = setTimeout(() => {
      services.lookupWorkspace(normalized, controller.signal).then(record => {if (!controller.signal.aborted) setLookup(record ? {state: 'found', record} : {state: 'missing'});},
        () => {if (!controller.signal.aborted) setLookup({state: 'failed'});});
    }, 350);
    return () => {controller.abort(); clearTimeout(timer);};
  }, [slug, services, retry]);

  function go(record: WorkspaceRecord) {setContinuing(true); services.rememberWorkspace(record.slug); open('orvia-sign-in', {ws: record.slug});}
  function onAddressSubmit(event: FormEvent) {event.preventDefault(); if (lookup.state === 'found') go(lookup.record); else slugRef.current?.focus();}
  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {setEmailError('Enter your work email, like name@hospital.org'); return;}
    emailRequest.current?.abort();
    const controller = new AbortController(); emailRequest.current = controller;
    setEmailError(undefined); setSearching(true); setSearchFailed(false);
    try {const matches = await services.lookupByEmail(email, controller.signal); if (!controller.signal.aborted) setResults(matches);}
    catch {if (!controller.signal.aborted) setSearchFailed(true);}
    finally {if (!controller.signal.aborted) setSearching(false);}
  }
  function changeEmail(value: string) {
    emailRequest.current?.abort(); setEmail(value); setResults(null); setSearching(false); setSearchFailed(false);
  }
  const status = lookup.state === 'checking' ? <LoaderCircle className="h-4 w-4 animate-spin text-ink-500" aria-hidden="true"/>
    : lookup.state === 'found' ? <span className="grid h-5 w-5 animate-pop place-items-center rounded-full bg-scrub-600 text-white"><Check className="h-3 w-3" strokeWidth={3} aria-hidden="true"/></span>
    : lookup.state === 'missing' || lookup.state === 'invalid' || lookup.state === 'failed' ? <CircleAlert className="h-4 w-4 text-signal" aria-hidden="true"/> : null;
  const domain = email.split('@')[1] ?? '';

  return <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col justify-center py-8 lg:py-12">
    <h1 className="font-display text-[length:calc(2.1rem*var(--fs-scale))] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[length:calc(2.6rem*var(--fs-scale))]">{t('Find your workspace')}</h1>
    <p className="mt-3 leading-relaxed text-ink-600">{t('Your organization has its own address on {brand}. Enter it below, or look it up with your work email.', {brand: BRAND.name})}</p>
    <Segmented<Mode> className="mt-7" label="How to find your workspace" value={mode} onChange={setMode} options={[{value: 'address', label: 'Workspace address'}, {value: 'email', label: 'Work email'}]}/>
    {mode === 'address' ? <form onSubmit={onAddressSubmit} className="mt-6 animate-fade-in" noValidate>
      <Field label="Workspace address" htmlFor="ws-slug" hint="This is in your invite email or the sign-in link your IT team shared." error={lookup.state === 'invalid' ? 'Use letters, numbers and hyphens only' : undefined}>
        <AffixInput ref={slugRef} id="ws-slug" hasHint value={slug} onChange={event => setSlug(event.target.value)} placeholder="your-organization" suffix={`.${BRAND.domain}`} status={status} invalid={lookup.state === 'invalid'} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false}/>
      </Field>
      <div aria-live="polite" className="mt-4 min-h-[4.75rem]">
        {lookup.state === 'found' && <WorkspaceCard record={lookup.record}/>}
        {lookup.state === 'missing' && <div className="flex animate-fade-up gap-3 rounded-2xl border border-ink-200 bg-surface p-4">
          <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" aria-hidden="true"/>
          <div className="text-sm leading-relaxed text-ink-600">
            <p className="font-semibold text-ink-900">{t('No workspace at {address}', {address: `${normalizeSlug(slug)}.${BRAND.domain}`})}</p>
            <p className="mt-0.5">{t('Check the spelling, or')}{' '}<button type="button" onClick={() => setMode('email')} className="font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('find it with your email')}</button>.</p>
          </div>
        </div>}
        {lookup.state === 'failed' && <div role="alert" className="flex animate-fade-up items-center justify-between gap-3 rounded-2xl border border-signal/30 bg-surface p-4 text-sm text-signal">
          {t('The workspace lookup did not respond.')}<button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('Try again')}</button>
        </div>}
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={lookup.state !== 'found'} loading={continuing}>{t('Continue to sign in')}</Button>
    </form> : <form onSubmit={onEmailSubmit} className="mt-6 animate-fade-in" noValidate>
      <Field label="Work email" htmlFor="ws-email" error={emailError} hint="We'll list every workspace this email belongs to.">
        <Input id="ws-email" hasHint type="email" value={email} onChange={event => changeEmail(event.target.value)} placeholder="name@hospital.org" leading={<Mail className="h-4 w-4" aria-hidden="true"/>} invalid={!!emailError} autoComplete="email" autoFocus/>
      </Field>
      <Button type="submit" variant={results ? 'secondary' : 'primary'} size="lg" className="mt-5 w-full" loading={searching}>{t('Find workspaces')}</Button>
      <div aria-live="polite" className="mt-5">
        {searchFailed && <p role="alert" className="rounded-2xl border border-signal/30 bg-surface p-4 text-sm text-signal">{t('The lookup did not respond. Your email is kept; try again.')}</p>}
        {results && results.length > 0 && <div className="animate-fade-up">
          <p className="mb-2 text-sm font-medium text-ink-700">{t(results.length === 1 ? '{count} workspace for {domain}' : '{count} workspaces for {domain}', {count: format.number(results.length), domain})}</p>
          <ul className="space-y-2">{results.map(record => <li key={record.slug}><WorkspaceRow record={record} onSelect={() => go(record)}/></li>)}</ul>
        </div>}
        {results && results.length === 0 && <div className="animate-fade-up rounded-2xl border border-ink-200 bg-surface p-4 text-sm leading-relaxed text-ink-600">
          <p className="font-semibold text-ink-900">{t('No workspaces use {domain}', {domain})}</p>
          <p className="mt-0.5">{t('Ask your administrator for an invite, or')}{' '}<OrviaLink to="orvia-register" className="font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('register your organization')}</OrviaLink>.</p>
        </div>}
      </div>
    </form>}
    <div className="mt-8 border-t border-ink-100 pt-6">
      <p className="mb-2.5 flex items-center gap-1.5 text-sm font-medium text-ink-700">{recent.length > 0 ? <><Clock3 className="h-4 w-4 text-ink-500" aria-hidden="true"/> {t('Recently used on this device')}</> : t('Try a sample workspace')}</p>
      <ul className="space-y-2">{(recent.length > 0 ? recent : services.sampleWorkspaces()).map(record => <li key={record.slug}><WorkspaceRow record={record} onSelect={() => go(record)} compact/></li>)}</ul>
    </div>
    <p className="mt-8 text-sm text-ink-600">{t('New to {brand}?', {brand: BRAND.name})}{' '}<OrviaLink to="orvia-register" className="font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('Register your organization')}</OrviaLink></p>
  </div>;
}

export function WorkspaceAvatar({name, size = 'md'}: {name: string; size?: 'sm' | 'md'}) {
  return <span className={cn('grid shrink-0 place-items-center rounded-xl bg-rail font-display font-semibold text-mint', size === 'md' ? 'h-11 w-11 text-base' : 'h-9 w-9 text-sm')} aria-hidden="true">{initials(name)}</span>;
}
function WorkspaceCard({record}: {record: WorkspaceRecord}) {
  const {t} = useLocalization(), format = useFormatters();
  return <div className="flex animate-fade-up items-center gap-3.5 rounded-2xl border border-scrub-200 bg-scrub-50/60 p-4">
    <WorkspaceAvatar name={record.name}/>
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold text-ink-900">{record.name}</p>
      <p className="truncate text-sm text-ink-600">{t(record.facilities === 1 ? '{kind}, 1 facility' : '{kind}, {count} facilities', {kind: t(record.kind), count: format.number(record.facilities)})}</p>
    </div>
    {record.status === 'pending' && <span className="rounded-full bg-caution-soft px-2 py-0.5 text-xs font-semibold text-caution">{t('Pending review')}</span>}
  </div>;
}
function WorkspaceRow({record, onSelect, compact}: {record: WorkspaceRecord; onSelect: () => void; compact?: boolean}) {
  return <button type="button" onClick={onSelect} className="group flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-surface p-3 text-start transition-[border-color,background-color] duration-150 hover:border-scrub-300 hover:bg-scrub-50/40">
    <WorkspaceAvatar name={record.name} size={compact ? 'sm' : 'md'}/>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[length:calc(0.95rem*var(--fs-scale))] font-semibold text-ink-900">{record.name}</span>
      <span dir="ltr" className="block truncate text-start text-[length:calc(0.8rem*var(--fs-scale))] text-ink-500">{record.slug}.{BRAND.domain}</span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-scrub-600 rtl:rotate-180" aria-hidden="true"/>
  </button>;
}
