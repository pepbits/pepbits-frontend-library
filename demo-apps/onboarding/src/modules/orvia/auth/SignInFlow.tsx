'use client';
import React, {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, Building2, CircleCheck, KeyRound, LoaderCircle, Mail, MailCheck, ShieldCheck, TriangleAlert} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {OtpInput} from '@pepbits/ui';
import {BRAND} from '../brand';
import {EMAIL_RE} from '../registration';
import {initials, type WorkspaceRecord} from '../workspaces';
import {OrviaLink, useOnboarding, useOpen, useTargetParams} from '../services';
import {Button, ButtonLink} from '../ui/Button';
import {Field, Input} from '../ui/Field';
import {PasswordInput} from '../ui/PasswordInput';

type Stage = 'credentials' | 'mfa' | 'reset' | 'reset-sent' | 'done';
const RESEND_SECONDS = 30;
const headingClass = 'font-display text-[length:calc(2.1rem*var(--fs-scale))] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900';

/** Workspace sign-in: SSO notice, email/password, 6-digit code, password reset (fictional adapter; nothing is authenticated). */
export function SignInFlow() {
  const {t} = useLocalization(), format = useFormatters(), services = useOnboarding(), open = useOpen();
  const slug = useTargetParams().get('ws') ?? '';
  const [record, setRecord] = useState<WorkspaceRecord | null | undefined>(undefined), [lookupFailed, setLookupFailed] = useState(false), [retry, setRetry] = useState(0);
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{email?: string; password?: string; form?: string}>({});
  const [busy, setBusy] = useState(false), [code, setCode] = useState(''), [codeError, setCodeError] = useState<string>(), [resendIn, setResendIn] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null), passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!slug) {setRecord(null); return;}
    const controller = new AbortController();
    setRecord(undefined); setLookupFailed(false);
    services.lookupWorkspace(slug, controller.signal).then(found => {if (controller.signal.aborted) return; if (found) services.rememberWorkspace(found.slug); setRecord(found);},
      () => {if (!controller.signal.aborted) setLookupFailed(true);});
    return () => controller.abort();
  }, [slug, services, retry]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  if (lookupFailed) return <div role="alert" className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center gap-4 py-10 text-signal">
    {t('The workspace lookup did not respond.')}<Button variant="secondary" onClick={() => setRetry(value => value + 1)}>{t('Try again')}</Button>
  </div>;
  if (record === undefined) return <div className="flex flex-1 items-center justify-center" aria-busy="true"><LoaderCircle className="h-6 w-6 animate-spin text-ink-500" role="img" aria-label={t('Loading workspace')}/></div>;
  if (record === null) return <div className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center py-10">
    <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] text-ink-900">{t('Choose a workspace first')}</h1>
    <p className="mt-3 leading-relaxed text-ink-600">{slug ? t('There is no workspace at {address}. Check the link you were sent, or look your workspace up.', {address: `${slug}.${BRAND.domain}`}) : t("Sign-in happens inside your organization's workspace. Find it first, then sign in.")}</p>
    <ButtonLink to="orvia-workspace" size="lg" className="mt-7">{t('Find your workspace')}</ButtonLink>
  </div>;
  const workspace = record;

  async function onCredentials(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter the email you use for this workspace';
    if (password.length < 8) next.password = 'Enter your password';
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    setBusy(true);
    try {await services.signIn(workspace.slug, email, password); setStage('mfa'); setResendIn(RESEND_SECONDS);}
    catch (failure) {setErrors({form: failure instanceof Error ? failure.message : 'Sign-in did not respond. Try again.'});}
    finally {setBusy(false);}
  }
  async function verify(value: string) {
    if (value.length !== 6) {setCodeError('Enter all 6 digits'); return;}
    setCodeError(undefined); setBusy(true);
    try {await services.verifySignInCode(workspace.slug, value); setStage('done');}
    catch (failure) {setCodeError(failure instanceof Error ? failure.message : 'The code could not be checked. Try again.');}
    finally {setBusy(false);}
  }
  async function onReset(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {setErrors({email: 'Enter the email you use for this workspace'}); emailRef.current?.focus(); return;}
    setErrors({}); setBusy(true);
    try {await services.requestPasswordReset(workspace.slug, email); setStage('reset-sent');}
    catch {setErrors({form: 'The reset request did not respond. Try again.'});}
    finally {setBusy(false);}
  }

  return <div className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center py-8 lg:py-12">
    <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-surface p-3 pe-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rail font-display text-sm font-semibold text-mint" aria-hidden="true">{initials(workspace.name)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[length:calc(0.95rem*var(--fs-scale))] font-semibold text-ink-900">{workspace.name}</p>
        <p dir="ltr" className="truncate text-start text-[length:calc(0.8rem*var(--fs-scale))] text-ink-500">{workspace.slug}.{BRAND.domain}</p>
      </div>
      <OrviaLink to="orvia-workspace" className="rounded-lg px-2 py-1 text-sm font-semibold text-scrub-800 hover:bg-scrub-50" aria-label={t('Change workspace')}>{t('Change')}</OrviaLink>
    </div>
    {workspace.status === 'pending' && stage !== 'done' && <p className="mt-3 flex gap-2 rounded-xl bg-caution-soft px-3.5 py-2.5 text-[length:calc(0.85rem*var(--fs-scale))] leading-snug text-caution">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>{t('This workspace is pending license review. The administrator can sign in to finish setup.')}
    </p>}

    {stage === 'credentials' && <form onSubmit={onCredentials} noValidate className="mt-8 animate-fade-in">
      <h1 className={headingClass}>{t('Sign in')}</h1>
      {workspace.sso && <>
        <Button variant="secondary" size="lg" className="mt-6 w-full" onClick={() => setErrors({form: "Single sign-on opens your organization's identity provider. Connect it in workspace settings."})}>
          <Building2 className="h-4 w-4" aria-hidden="true"/>{t('Continue with single sign-on')}
        </Button>
        <div className="my-6 flex items-center gap-3 text-[length:calc(0.8rem*var(--fs-scale))] text-ink-500"><span className="h-px flex-1 bg-ink-200"/>{t('or use your email')}<span className="h-px flex-1 bg-ink-200"/></div>
      </>}
      {errors.form && <p role="status" className="mb-4 mt-4 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[length:calc(0.85rem*var(--fs-scale))] text-ink-700">{t(errors.form)}</p>}
      <div className={workspace.sso ? 'space-y-5' : 'mt-6 space-y-5'}>
        <Field label="Email" htmlFor="login-email" error={errors.email}>
          <Input ref={emailRef} id="login-email" type="email" value={email} onChange={event => {setEmail(event.target.value); if (errors.email) setErrors(previous => ({...previous, email: undefined}));}} placeholder="name@hospital.org" leading={<Mail className="h-4 w-4"/>} autoComplete="username" invalid={!!errors.email} autoFocus/>
        </Field>
        <Field label="Password" htmlFor="login-password" error={errors.password} aside={<button type="button" onClick={() => {setErrors({}); setStage('reset');}} className="text-sm font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('Forgot password?')}</button>}>
          <PasswordInput ref={passwordRef} id="login-password" value={password} onChange={event => {setPassword(event.target.value); if (errors.password) setErrors(previous => ({...previous, password: undefined}));}} autoComplete="current-password" invalid={!!errors.password}/>
        </Field>
      </div>
      <label className="mt-5 flex cursor-pointer select-none items-center gap-2.5 text-sm text-ink-700">
        <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} className="h-4 w-4 cursor-pointer rounded border-ink-300 accent-[var(--primary-fill)]"/>
        {t('Trust this device for 30 days')}
      </label>
      <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>{t('Sign in')}</Button>
      <p className="mt-5 text-center text-[length:calc(0.8rem*var(--fs-scale))] leading-relaxed text-ink-500">{t('Shared workstation? Leave "Trust this device" unchecked so you\'re asked for a code every time.')}</p>
    </form>}

    {stage === 'mfa' && <div className="mt-8 animate-step-in">
      <button type="button" onClick={() => {setStage('credentials'); setCode(''); setCodeError(undefined);}} className="-ms-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-600 hover:bg-ink-100/60">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/> {t('Back')}
      </button>
      <span className="mt-4 grid h-12 w-12 place-items-center rounded-2xl bg-scrub-100 text-scrub-800"><KeyRound className="h-6 w-6" aria-hidden="true" strokeWidth={1.8}/></span>
      <h1 className={`mt-4 ${headingClass}`}>{t('Enter your sign-in code')}</h1>
      <p className="mt-2 leading-relaxed text-ink-600">{t('Open your authenticator app and enter the 6-digit code for {brand}.', {brand: BRAND.name})}</p>
      <form className="mt-7" onSubmit={event => {event.preventDefault(); void verify(code);}}>
        <OtpInput label="6-digit sign-in code" value={code} onChange={value => {setCode(value); if (codeError) setCodeError(undefined);}} onComplete={value => void verify(value)} invalid={!!codeError} disabled={busy} autoFocus
          describedBy={codeError ? 'login-code-error' : undefined} className="gap-2 sm:gap-3" boxClassName="h-14 rounded-xl bg-surface font-display text-2xl text-ink-900 transition-[border-color,box-shadow,transform] duration-150 focus:border-scrub-500 focus:outline-none focus:ring-4 focus:ring-scrub-100" idleClassName="border-ink-200" filledClassName="border-scrub-500 scale-[1.02]" invalidClassName="border-signal focus:ring-signal/15"/>
        {codeError && <p id="login-code-error" className="mt-2 text-[length:calc(0.8rem*var(--fs-scale))] font-medium text-signal">{t(codeError)}</p>}
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>{t('Verify and sign in')}</Button>
      </form>
      <p className="mt-5 text-sm text-ink-600">{t('No access to your app?')}{' '}
        {resendIn > 0 ? <span className="tabular-nums text-ink-500">{t('Text me a code in {seconds}s', {seconds: format.number(resendIn)})}</span>
          : <button type="button" onClick={() => setResendIn(RESEND_SECONDS)} className="font-semibold text-scrub-800 underline-offset-2 hover:underline">{t('Text me a code')}</button>}
      </p>
    </div>}

    {(stage === 'reset' || stage === 'reset-sent') && <div className="mt-8 animate-step-in">
      <button type="button" onClick={() => setStage('credentials')} className="-ms-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-600 hover:bg-ink-100/60">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/> {t('Back to sign in')}
      </button>
      {stage === 'reset' ? <form onSubmit={onReset} noValidate>
        <h1 className={`mt-4 ${headingClass}`}>{t('Reset your password')}</h1>
        <p className="mt-2 leading-relaxed text-ink-600">{t("We'll email you a link to choose a new one.")}</p>
        {errors.form && <p role="alert" className="mt-4 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[length:calc(0.85rem*var(--fs-scale))] text-signal">{t(errors.form)}</p>}
        <Field label="Email" htmlFor="reset-email" error={errors.email} className="mt-6">
          <Input ref={emailRef} id="reset-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@hospital.org" leading={<Mail className="h-4 w-4"/>} invalid={!!errors.email} autoComplete="email" autoFocus/>
        </Field>
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>{t('Send reset link')}</Button>
      </form> : <div className="animate-fade-up" role="status">
        <span className="mt-4 grid h-12 w-12 animate-pop place-items-center rounded-2xl bg-scrub-100 text-scrub-800"><MailCheck className="h-6 w-6" aria-hidden="true" strokeWidth={1.8}/></span>
        <h1 className={`mt-4 ${headingClass}`}>{t('Check your email')}</h1>
        <p className="mt-2 leading-relaxed text-ink-600">{t('If {email} has an account in this workspace, a reset link is on its way. It expires in 30 minutes.', {email})}</p>
      </div>}
    </div>}

    {stage === 'done' && <div className="mt-10 animate-fade-up text-center" role="status">
      <span className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full bg-scrub-700 text-white"><CircleCheck className="h-8 w-8" aria-hidden="true" strokeWidth={1.8}/></span>
      <h1 className={`mt-5 ${headingClass}`}>{t('Signed in to {name}', {name: workspace.name})}</h1>
      <p className="mx-auto mt-3 max-w-sm leading-relaxed text-ink-600">{t('Connect this screen to your session API to open the dashboard. Everything up to here is wired and ready.')}</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Button variant="secondary" onClick={() => {setStage('credentials'); setPassword(''); setCode('');}}>{t('Sign out')}</Button>
        <Button onClick={() => open('orvia-landing')}>{t('Back to home')}</Button>
      </div>
    </div>}

    {stage !== 'done' && <p className="mt-10 flex items-center gap-2 text-[length:calc(0.8rem*var(--fs-scale))] text-ink-500"><ShieldCheck className="h-4 w-4 text-scrub-600" aria-hidden="true"/>{t('Your session is encrypted and every sign-in is recorded in the audit log.')}</p>}
  </div>;
}
