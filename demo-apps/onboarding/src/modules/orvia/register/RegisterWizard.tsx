'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {CircleAlert, CircleCheck, Info, X} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {focusFirstInvalid, useWizard, WizardProgress, WizardStepper} from '@pepbits/patterns/wizard';
import {cn} from '@pepbits/ui';
import {BRAND} from '../brand';
import {INTEGRATIONS, country, isFacilityType, recommendedCareSettings, recommendedModules} from '../catalog';
import {hydrateDraft, initialData, newId, STEPS, validateStep, visibleSteps, type RegistrationData, type StepId} from '../registration';
import {slugify} from '../workspaces';
import {OrviaLink, useOnboarding, useTargetParams} from '../services';
import {Button} from '../ui/Button';
import {Logo} from '../ui/Logo';
import {SuccessScreen} from './SuccessScreen';
import {StepDetails} from './steps/StepDetails';
import {StepFacilities} from './steps/StepFacilities';
import {StepModules} from './steps/StepModules';
import {StepOrganization} from './steps/StepOrganization';
import {StepReview} from './steps/StepReview';
import {StepScope} from './steps/StepScope';
import {StepWorkspace} from './steps/StepWorkspace';
import type {StepProps} from './types';

const STEP_COMPONENTS: Record<StepId, (props: StepProps) => React.ReactNode> = {organization: StepOrganization, details: StepDetails, facilities: StepFacilities, scope: StepScope, modules: StepModules, workspace: StepWorkspace, review: StepReview};
/** Orvia presentation of the generic stepper on the dark brand rail. */
const RAIL_STEPPER = {
  connectorPending: 'bg-white/15', connectorDone: 'bg-mint/60',
  button: 'group flex w-full items-start gap-3.5 rounded-xl px-3 py-2.5 text-start disabled:cursor-default', buttonCurrent: 'bg-white/[0.08]', buttonJumpable: 'hover:bg-white/[0.06]',
  marker: 'relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[length:calc(0.8rem*var(--fs-scale))] font-semibold tabular-nums',
  markerDone: 'bg-mint text-rail', markerCurrent: 'bg-white text-rail ring-4 ring-mint/25', markerPending: 'border border-white/20 text-rail-200',
  title: 'block text-[length:calc(0.92rem*var(--fs-scale))] font-semibold leading-tight', titleActive: 'text-white', titlePending: 'text-rail-200', caption: 'mt-0.5 block text-[length:calc(0.8rem*var(--fs-scale))] leading-snug text-rail-200',
};

/** Multi-step organization registration (6 steps, 7 for networks). Generic step state comes from `@pepbits/patterns/wizard`. */
export function RegisterWizard() {
  const {t} = useLocalization(), format = useFormatters(), {preferences} = usePreferences(), services = useOnboarding(), params = useTargetParams();
  const [data, setData] = useState<RegistrationData>(initialData);
  const [notice, setNotice] = useState<string | null>(null), [savedAt, setSavedAt] = useState<number | null>(null), [hydrated, setHydrated] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [status, setStatus] = useState<'editing' | 'submitting' | 'done'>('editing'), [submitError, setSubmitError] = useState<string | null>(null), [reference, setReference] = useState('');
  const formRef = useRef<HTMLFormElement>(null), scrollRef = useRef<HTMLDivElement>(null), headingRef = useRef<HTMLHeadingElement>(null), successRef = useRef<HTMLDivElement>(null);
  const steps = useMemo(() => visibleSteps(data), [data]);
  const validate = useCallback((id: StepId, value: RegistrationData) => validateStep(id, value, {isSlugTaken: services.isSlugTaken}), [services]);

  /** Smart defaults when entering a step (source behaviour); people can change everything. */
  const prepare = (id: StepId) => {
    let next = data, note: string | null = null;
    const d = data;
    if (id === 'facilities' && d.facilities.length === 0) {
      next = {...d, facilities: [{id: newId(), name: d.org.displayName || d.org.legalName, type: d.facilityTypes[0] ?? '', city: d.org.city, beds: ''}, {id: newId(), name: '', type: d.facilityTypes[1] ?? d.facilityTypes[0] ?? '', city: d.org.city, beds: ''}]};
      note = t('We started your list with your head office. Rename it and add the rest of your facilities.');
    }
    if (id === 'scope' && d.careSettings.length === 0) {
      const recommended = recommendedCareSettings(d.facilityTypes);
      if (recommended.length) {next = {...d, careSettings: recommended}; note = t('We pre-selected {count} care settings that match your facility types.', {count: format.number(recommended.length)});}
    }
    if (id === 'modules' && d.modules.length === 0) {
      const modules = recommendedModules(d.facilityTypes, d.structure === 'network');
      const local = INTEGRATIONS.filter(item => item.countries.includes(d.org.country)).map(item => item.id);
      next = {...d, modules, integrations: d.integrations.length ? d.integrations : local};
      note = local.length ? t('We suggested {modules} modules and {integrations} local integrations for your organization. Adjust anything.', {modules: format.number(modules.length), integrations: format.number(local.length)})
        : t('We suggested {modules} modules for your organization. Adjust anything.', {modules: format.number(modules.length)});
    }
    if (id === 'workspace') {
      const workspace = {...d.workspace};
      if (!workspace.slug) {let slug = slugify(d.org.displayName || d.org.legalName); if (slug && services.isSlugTaken(slug)) slug = slugify(`${slug}-${d.org.city || 'health'}`); workspace.slug = slug;}
      if (!workspace.region) workspace.region = country(d.org.country)?.region ?? '';
      if (workspace.slug !== d.workspace.slug || workspace.region !== d.workspace.region) next = {...d, workspace};
    }
    if (next !== d) setData(next);
    setNotice(note); setSubmitError(null);
  };
  const wizard = useWizard({steps, data, validate, onEnter: prepare});
  const {current, index, step, isLast} = wizard;

  // Restore the device draft, or apply ?type= / ?structure= deep links to step 1.
  useEffect(() => {
    let restored = false;
    const draft = services.loadDraft();
    if (draft) {
      const value = hydrateDraft(draft.data);
      const stepId = draft.stepId && STEPS.some(candidate => candidate.id === draft.stepId) ? draft.stepId : 'organization';
      restored = !!(value.structure || value.facilityTypes.length || value.org.legalName);
      if (restored) {
        setData(value); wizard.restore({current: stepId, completed: draft.completed, reached: draft.reached}); setSavedAt(draft.savedAt ?? null);
        const pastWorkspace = STEPS.findIndex(candidate => candidate.id === stepId) >= STEPS.findIndex(candidate => candidate.id === 'workspace');
        setNotice(t(pastWorkspace ? 'We restored your draft from this device. For security, re-enter the administrator password.' : 'We restored your draft from this device.'));
      }
    }
    if (!restored) {
      const type = params.get('type'), structure = params.get('structure');
      setData(value => ({...value, facilityTypes: type && isFacilityType(type) ? [type] : value.facilityTypes, structure: structure === 'network' ? 'network' : value.structure}));
    }
    setHydrated(true);
    // Mount-only: later deep-link changes do not overwrite a form in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave form fields to this device (never the password); untouched forms are not saved.
  const snapshot = wizard.snapshot();
  const snapshotKey = JSON.stringify(snapshot);
  function saveProgress() {
    const now = Date.now();
    const saved = services.saveDraft({data, stepId: snapshot.current, completed: snapshot.completed, reached: snapshot.reached, savedAt: now});
    setSaveFailed(!saved);
    if (saved) setSavedAt(now);
    return saved;
  }
  useEffect(() => {
    if (!hydrated || status !== 'editing') return;
    if (current === 'organization' && JSON.stringify(data) === JSON.stringify(initialData)) return;
    const timer = setTimeout(saveProgress, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, snapshotKey, hydrated, status, services]);

  // Focus moves to the new step's first field or heading; invalid attempts focus the first problem.
  useEffect(() => {
    if (!wizard.moves) return;
    scrollRef.current?.scrollTo?.({top: 0});
    const frame = requestAnimationFrame(() => {(formRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? headingRef.current)?.focus({preventScroll: true});});
    return () => cancelAnimationFrame(frame);
  }, [wizard.moves]);
  useEffect(() => {
    if (!wizard.failures) return;
    const frame = requestAnimationFrame(() => focusFirstInvalid(formRef.current, preferences.reducedMotion));
    return () => cancelAnimationFrame(frame);
  }, [wizard.failures, preferences.reducedMotion]);
  useEffect(() => {if (status === 'done') successRef.current?.querySelector<HTMLElement>('[data-success-heading]')?.focus();}, [status]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (status !== 'editing') return;
    if (!isLast) {wizard.next(); return;}
    if (!wizard.validateCurrent()) return;
    // Final check across every visible step before sending.
    const invalid = wizard.firstInvalid();
    if (invalid) {
      const title = steps.find(candidate => candidate.id === invalid.id)!.title;
      wizard.goTo(invalid.id); setNotice(t('Some details in {step} need attention before you can submit.', {step: t(title).toLowerCase()})); wizard.fail(invalid.errors);
      return;
    }
    setStatus('submitting'); setSubmitError(null);
    try {
      const receipt = await services.submitRegistration(data);
      services.clearDraft();
      setReference(receipt.reference); wizard.completeAll(); setStatus('done');
    } catch (failure) {
      setStatus('editing');
      setSubmitError(failure instanceof Error ? failure.message : "We couldn't submit your registration. Check your connection and try again.");
    }
  }

  const StepComponent = STEP_COMPONENTS[step.id];
  const errorCount = Object.keys(wizard.errors).length;
  const progress = status === 'done' ? 1 : wizard.progress;
  const savedLabel = savedAt ? t('Draft saved at {time}', {time: format.time(new Date(savedAt))}) : null;
  return <div className="flex min-h-full w-full flex-1 flex-col lg:min-h-0 lg:flex-row">
    <aside data-orvia-rail className="relative hidden w-[19.5rem] shrink-0 overflow-hidden rounded-2xl bg-rail text-white lg:flex xl:w-[22rem] 2xl:w-[25rem]">
      <div className="bg-chart-grid absolute inset-0" aria-hidden="true"/>
      <div className="scrollbar-none relative flex h-full w-full flex-col overflow-y-auto p-6 xl:p-8">
        <Logo tone="light"/>
        <div className="mt-9 px-3">
          <p className="font-display text-[length:calc(1.65rem*var(--fs-scale))] font-semibold leading-[1.1] tracking-[-0.02em]">{t('Register your organization')}</p>
          <p className="mt-2 text-sm leading-relaxed text-rail-100">{t('About 10 minutes. Progress saves on this device as you go.')}</p>
        </div>
        <div className="mt-8">
          <WizardStepper label="Registration steps" steps={steps} current={status === 'done' ? null : current} completed={wizard.completed} reachable={status === 'editing' ? wizard.reached : new Set<StepId>()} onJump={id => wizard.jump(id)} classNames={RAIL_STEPPER}/>
        </div>
        <p className="mt-auto px-3 pt-8 text-[length:calc(0.8rem*var(--fs-scale))] leading-relaxed text-rail-100">{t('Questions about registering?')}{' '}
          <a href={`mailto:${BRAND.supportEmail}`} className="font-semibold text-mint underline-offset-2 hover:underline">{BRAND.supportEmail}</a>
        </p>
      </div>
    </aside>
    <div className="flex min-h-full flex-1 flex-col lg:min-h-0">
      <header className="sticky top-0 z-20 shrink-0 border-b border-ink-100 bg-paper/90 backdrop-blur-md lg:static lg:bg-paper">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10 2xl:px-16">
          <div className="lg:hidden"><Logo/></div>
          <p className="hidden text-sm text-ink-600 lg:block" aria-live="polite">{status === 'done' ? t('Registration complete') : savedLabel ?? t('Your progress saves automatically')}</p>
          <div className="flex items-center gap-2">
            {status !== 'done' && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-700 lg:hidden">{t('{current} of {total}', {current: format.number(index + 1), total: format.number(steps.length)})}</span>}
            {status !== 'done' && <OrviaLink to="orvia-landing" onClick={event => {if (!saveProgress()) event.preventDefault();}} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900">{t('Save and exit')}</OrviaLink>}
          </div>
        </div>
        <WizardProgress label="Registration progress" value={progress} className="h-1 w-full bg-ink-100" barClassName="bg-scrub-600"/>
      </header>
      <div ref={scrollRef} className="scrollbar-thin flex flex-1 flex-col lg:overflow-y-auto">
        {status === 'done' ? <div ref={successRef} className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10 2xl:px-16"><SuccessScreen slug={data.workspace.slug} email={data.workspace.adminEmail} reference={reference}/></div>
          : <form id="registration" ref={formRef} onSubmit={onSubmit} noValidate className="w-full flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9 2xl:px-16" aria-labelledby="registration-step-title">
            <fieldset disabled={status === 'submitting'} className="mx-auto w-full max-w-[76rem]">
              <div key={step.id} className="animate-step-in">
                <p className="text-sm font-medium text-scrub-800">{t('Step {current} of {total}', {current: format.number(index + 1), total: format.number(steps.length)})}</p>
                <h1 id="registration-step-title" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-[length:calc(2rem*var(--fs-scale))] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 focus:outline-none sm:text-[length:calc(2.5rem*var(--fs-scale))]">{t(step.title)}</h1>
                <p className="mt-2.5 max-w-[68ch] leading-relaxed text-ink-600">{t(step.intro ?? '')}</p>
                {saveFailed && <p role="alert" className="mt-4 text-sm text-signal">{t('This browser could not save your draft. Keep this page open, allow site storage and try again.')}</p>}
                {notice && <div className="mt-5 flex animate-fade-up items-start gap-3 rounded-2xl border border-scrub-200 bg-scrub-50 px-4 py-3 text-sm text-ink-900" role="status">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-scrub-600" aria-hidden="true"/><p className="flex-1 leading-relaxed">{notice}</p>
                  <button type="button" onClick={() => setNotice(null)} className="-m-1 grid h-7 w-7 place-items-center rounded-lg text-scrub-800 hover:bg-scrub-100" aria-label={t('Dismiss')}><X className="h-4 w-4" aria-hidden="true"/></button>
                </div>}
                {(errorCount > 0 || submitError) && <div key={wizard.failures} role="alert" className="mt-5 flex animate-shake items-start gap-3 rounded-2xl border border-signal/25 bg-[color-mix(in_srgb,var(--danger)_6%,var(--surface))] px-4 py-3 text-sm text-signal">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>
                  <p className="leading-relaxed">{submitError ? t(submitError) : t(errorCount === 1 ? '1 item needs your attention before you continue.' : '{count} items need your attention before you continue.', {count: format.number(errorCount)})}</p>
                </div>}
                <div className="mt-8"><StepComponent data={data} errors={wizard.errors} setData={setData} onJump={id => wizard.jump(id)}/></div>
              </div>
            </fieldset>
          </form>}
      </div>
      {status !== 'done' && <footer className="sticky bottom-0 z-20 shrink-0 border-t border-ink-100 bg-surface/95 backdrop-blur-md lg:static">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10 2xl:px-16">
          <Button variant="ghost" onClick={wizard.back} className={cn(index === 0 && 'invisible')} disabled={status !== 'editing'}>{t('Back')}</Button>
          <div className="flex min-w-0 items-center gap-4">
            {!isLast && <span className="hidden truncate text-sm text-ink-600 md:block">{t('Next: {step}', {step: t(steps[index + 1]!.title)})}</span>}
            {isLast && <span className="hidden items-center gap-1.5 text-sm text-ink-600 md:flex"><CircleCheck className="h-4 w-4 text-scrub-600" aria-hidden="true"/>{t('{done} of {total} steps complete', {done: format.number(steps.length - 1), total: format.number(steps.length)})}</span>}
            <Button type="submit" form="registration" size="lg" loading={status === 'submitting'} className="min-w-[9.5rem]">{t(status === 'submitting' ? 'Submitting' : isLast ? 'Submit registration' : 'Continue')}</Button>
          </div>
        </div>
      </footer>}
    </div>
  </div>;
}
