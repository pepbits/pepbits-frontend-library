'use client';
// Flow, fields, validation and API calls from the AllyVora clinical workspace (components/frontdesk/StartVisit.tsx,
// commit 1ede87f), rebuilt on the shared @pepbits components and semantic tokens. See provenance.json.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BedDouble, Building2, CalendarClock, CalendarPlus, Check, CheckCircle2, ChevronRight, ClipboardList,
  Copy, CreditCard, FolderHeart, House, IdCard, Inbox, Lock, Phone, Search, Share2, ShieldAlert, Siren, Stethoscope, UserPlus, Video, X, type LucideIcon,
} from '@pepbits/icons';
import {Avatar, Badge, Button, IconButton, Input, Radio, Segmented, Select, Skeleton, cn} from '@pepbits/ui';
import {EmptyState, ErrorState} from '@pepbits/components';
import {WizardStepper, type WizardStep} from '@pepbits/patterns/wizard';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {Link, useRouter} from './link';
import {api, type Clinic, type Department, type PatientLite} from './lib';
import {EMPTY_REFERRAL, ReferralSourceFields, referralProblems, type ReferralSource} from './ReferralSource';
import {Choice, Kbd, LINK_BUTTON, Panel, ProblemList, TEXT, fieldGap, useDebounced, useShortcuts, useToast} from './parts';
import {Notice, useTimeFormat} from '../support';

/** GET /api/patients/{id}/visit-context (mirrors VisitRegistration.context). */
interface Context {
  patient: PatientLite;
  coverage?: {payer?: string; plan?: string; memberId?: string; expiry?: string; eligibility?: string} | null;
  blocked: string[];
  openVisits: {id: string; class: string; status: string; department: string; arrivedAt: string; ward?: string; bed?: string}[];
  appointments: {id: string; startsAt: string; clinic: string; clinicianName?: string; reason?: string}[];
  referrals: {id: string; status: string; specialty: string; referrerName: string; organisation?: string; priority: string; referralDate: string; reason: string}[];
  clinicians: {id: string; name: string; role: string}[];
  departments: Department[];
  clinics: Clinic[];
  arrivalModes: string[];
  actions: {key: string; label: string; description: string; href?: string | null; allowed: boolean; unavailable?: string | null}[];
}
/** Appointments due soon, from the front desk overview (reception only). */
interface Expected {id: string; startsAt: string; clinic: string; clinicianName?: string; mode: string; patient: PatientLite | null}
type Hit = PatientLite & {activeEncounter?: {id: string; class: string; status: string} | null};
type StepId = 'find' | 'service' | 'details' | 'done';

const ACTION_ICON: Record<string, LucideIcon> = {'start-visit': Stethoscope, appointments: CalendarPlus, 'referrals-in': Inbox, admissions: BedDouble, 'home-care': House, 'long-term-care': Building2, referrals: Share2};
const ARRIVAL: Record<string, string> = {'walk-in': 'Walked in', ambulance: 'Ambulance', police: 'Police', 'inter-facility-transfer': 'Transfer from another facility', other: 'Other'};
const EPISODE_LABEL: Record<string, string> = {IP: 'Admitted', PRE: 'Awaiting admission', OBS: 'Under observation', DAY: 'Day case', ER: 'Open emergency visit', OP: 'Open outpatient visit'};
const STEPS: readonly WizardStep<StepId>[] = [{id: 'find', title: 'Find patient'}, {id: 'service', title: 'Choose service'}, {id: 'details', title: 'Visit details'}, {id: 'done', title: 'Done'}];
const NO_JUMP = new Set<StepId>();
/** The shared vertical stepper, laid out as one row in the page header. */
const STEPPER_ROW = {
  list: 'flex flex-wrap items-center gap-1', connector: 'hidden', button: 'flex items-center gap-2 rounded-[var(--radius)] px-2.5 py-1.5 text-start disabled:cursor-default',
  marker: 'grid size-6 shrink-0 place-items-center rounded-full text-[length:calc(11px*var(--fs-scale))] font-semibold tabular-nums',
  title: 'block whitespace-nowrap text-[length:calc(12px*var(--fs-scale))] font-semibold leading-tight',
};
const identityTone = (status?: PatientLite['identityStatus']) => status === 'unknown' ? 'danger' as const : status === 'unverified' ? 'warning' as const : 'success' as const;

/**
 * Encounter registration: find the patient, choose what they need, and (for a visit now) record
 * the encounter. New patients are registered, with their first visit, on Register a patient.
 */
export function StartVisit({patient}: {patient?: string}) {
  const router = useRouter(), toast = useToast(), time = useTimeFormat(), shortcutsOn = useShortcuts();
  const {preferences} = usePreferences(), {t} = useLocalization();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [expected, setExpected] = useState<Expected[] | null>(null);
  const [pid, setPid] = useState(patient ?? '');
  const [ctx, setCtx] = useState<Context | null>(null);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<'OP' | 'ER'>('OP');
  const [visitType, setVisitType] = useState<'walk-in' | 'referral'>('walk-in');
  const [department, setDepartment] = useState('');
  const [clinicianId, setClinicianId] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [arrivalMode, setArrivalMode] = useState('walk-in');
  const [billing, setBilling] = useState<'insurance' | 'self-pay'>('self-pay');
  const [reason, setReason] = useState('');
  const [referralId, setReferralId] = useState('');
  const [referral, setReferral] = useState<ReferralSource>(EMPTY_REFERRAL);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState<{id: string; class: string} | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const focusSearch = () => document.getElementById('sv-search')?.focus();

  useEffect(() => {
    if (dq.trim().length < 2) {setHits([]); setSearched(false); return;}
    api<Hit[]>(`/patients?q=${encodeURIComponent(dq.trim())}`).then(r => {setHits(r); setCursor(0); setSearched(true);}).catch(() => setHits([]));
  }, [dq]);
  useEffect(() => {
    // Expected patients only for roles that can see the front desk overview; others simply don't get the list.
    api<{appointments: {upcoming: Expected[]}}>('/front-desk/overview').then(r => setExpected(r.appointments.upcoming)).catch(() => setExpected([]));
  }, []);
  useEffect(() => {
    // "/" focuses the search from anywhere on the page, while keyboard shortcuts are enabled.
    if (!shortcutsOn) return;
    const onKey = (e: KeyboardEvent) => {if (e.key === '/' && !pid && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {e.preventDefault(); focusSearch();}};
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pid, shortcutsOn]);
  const load = useCallback(async (id: string) => {
    setError(''); setCtx(null);
    try {
      const c = await api<Context>(`/patients/${id}/visit-context`);
      setCtx(c);
      const op = c.departments.filter(d => d.services.includes('outpatient')).map(d => d.name);
      setDepartment(d => (d && op.includes(d) ? d : op[0] ?? ''));
      const insured = !!c.coverage?.payer && c.coverage.payer !== 'Self-pay';
      setBilling(insured ? 'insurance' : 'self-pay');
      // Starting a visit now is the usual reason to be here, so open its form unless it is unavailable.
      const start = c.actions.find(x => x.key === 'start-visit');
      setStartOpen(!!start?.allowed && !(start.unavailable && c.blocked.length));
    } catch (e) {setError((e as Error).message);}
  }, []);
  useEffect(() => {if (pid) void load(pid);}, [pid, load]);
  const choose = (id: string) => {setPid(id); setQ(''); setHits([]); setStarted(null); setStartOpen(false); router.replace(`/front-desk/visits/new?patient=${id}`);};
  const clear = () => {setPid(''); setCtx(null); setStarted(null); setStartOpen(false); setReferralId(''); setProblems([]); router.replace('/front-desk/visits/new'); setTimeout(focusSearch, 50);};
  const openForm = () => {setStartOpen(true); setTimeout(() => formRef.current?.querySelector<HTMLElement>('select, input, button')?.focus(), 50);};

  const opDepartments = ctx?.departments.filter(d => d.services.includes('outpatient')) ?? [];
  const erDepartment = ctx?.departments.find(d => d.services.includes('emergency'))?.name ?? 'Emergency';
  const effectiveDept = kind === 'ER' ? erDepartment : department;
  const deptInfo = opDepartments.find(d => d.name === department);
  const insured = !!ctx?.coverage?.payer && ctx.coverage.payer !== 'Self-pay';
  const submit = async () => {
    if (!ctx) return;
    const p: string[] = [];
    if (!effectiveDept) p.push('Choose a department.');
    if (kind === 'OP' && visitType === 'referral' && !referralId) p.push(...referralProblems(referral));
    setProblems(p);
    if (p.length) return;
    setBusy(true);
    try {
      const visit = {
        type: kind === 'ER' ? 'emergency' : visitType, department: effectiveDept, reason: reason || undefined,
        clinicianId: clinicianId || undefined, billing,
        ...(kind === 'OP' ? {priority} : {arrivalMode}),
        ...(kind === 'OP' && visitType === 'referral' ? (referralId ? {referralId} : {referral}) : {}),
      };
      const r = await api<{encounter: {id: string; class: string}}>(`/patients/${ctx.patient.id}/visits`, {json: {visit}});
      setStarted(r.encounter);
      toast(`Visit started for ${ctx.patient.name}.`, 'success');
    } catch (e) {setProblems([(e as Error).message]);} finally {setBusy(false);}
  };

  const blocked = ctx?.blocked ?? [];
  const step = started ? 3 : startOpen ? 2 : ctx ? 1 : 0;
  const current = STEPS[step]!.id;
  const completed = useMemo(() => new Set(STEPS.slice(0, step).map(s => s.id)), [step]);
  const services = ctx?.actions.filter(a => a.allowed) ?? [];
  const isOff = (a: Context['actions'][number]) => !!a.unavailable && !(a.key === 'start-visit' && !blocked.length);
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcuts.current = e => {
    if (!ctx || started) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && startOpen && !busy && !blocked.length) {e.preventDefault(); void submit(); return;}
    const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
    const n = Number(e.key);
    if (typing || e.ctrlKey || e.metaKey || e.altKey || !Number.isInteger(n) || n < 1 || n > services.length) return;
    const a = services[n - 1]!;
    if (isOff(a)) return;
    e.preventDefault();
    if (a.key === 'start-visit') openForm(); else if (a.href) router.push(a.href);
  };
  useEffect(() => {
    if (!shortcutsOn) return;
    const onKey = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOn]);
  const clinicianName = ctx?.clinicians.find(u => u.id === clinicianId)?.name;
  const alerts = ctx ? ctx.openVisits.length + ctx.appointments.length + ctx.referrals.length + (ctx.patient.identityStatus === 'unknown' || ctx.patient.identityStatus === 'unverified' ? 1 : 0) : 0;
  const gap = fieldGap(preferences.density);
  const copyMrn = (mrn: string) => {void navigator.clipboard?.writeText(mrn).then(() => {setCopied(true); setTimeout(() => setCopied(false), 1500);}).catch(() => {});};

  return <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-3 py-4 sm:px-4 lg:px-6" data-start-visit={STEPS[step]!.id}>
    {/* Header: title, progress and actions on one line */}
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className={cn(TEXT.eyebrow, 'text-[var(--primary)]')}>{t('Front desk')}</p>
        <h1 className={TEXT.title}>{t('Start a visit')}</h1>
      </div>
      <div className="order-3 w-full overflow-x-auto lg:order-none lg:w-auto lg:flex-1 lg:justify-items-center">
        <div className="inline-block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-sm)]">
          <WizardStepper label="Progress" steps={STEPS} current={current} completed={completed} reachable={NO_JUMP} onJump={() => {}} classNames={STEPPER_ROW}/>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Link href="/front-desk/identity" className={LINK_BUTTON.ghost}><IdCard className="size-4" aria-hidden="true"/>{t('Identity follow-up')}</Link>
        <Link href="/registration" className={LINK_BUTTON.primary}><UserPlus className="size-4" aria-hidden="true"/>{t('New patient')}</Link>
      </div>
    </header>

    {/* 1. Find the patient */}
    {!pid && <Panel aria-labelledby="sv-search-label" bodyClassName="">
      <div className="border-b border-[var(--border)] bg-[var(--primary-soft)] px-4 pb-4 pt-4">
        <h2 id="sv-search-label" className={cn(TEXT.heading, 'text-[length:calc(15px*var(--fs-scale))]')}>{t('Who is the patient?')}</h2>
        <p className={TEXT.muted}>{t('Search by name, MRN, national ID or mobile number.')}</p>
        <div className="mt-3">
          <Input id="sv-search" autoFocus value={q} onChange={e => setQ(e.target.value)} autoComplete="off" aria-label="Search patients"
            role="combobox" aria-expanded={hits.length > 0} aria-controls="sv-results" aria-activedescendant={hits[cursor] ? `sv-hit-${hits[cursor]!.id}` : undefined}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {e.preventDefault(); setCursor(c => Math.min(c + 1, hits.length - 1));}
              if (e.key === 'ArrowUp') {e.preventDefault(); setCursor(c => Math.max(c - 1, 0));}
              if (e.key === 'Enter' && hits[cursor]) {e.preventDefault(); choose(hits[cursor]!.id);}
              if (e.key === 'Escape') setQ('');
            }}
            placeholder="Name, MRN, identity document or mobile" prefix={<Search className="size-4" aria-hidden="true"/>}
            suffix={shortcutsOn ? <span className="hidden items-center gap-1 sm:flex">{q ? <><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>Enter</Kbd></> : <>{t('Press')} <Kbd>/</Kbd></>}</span> : undefined}
            className="[&_input]:h-11 [&_input]:pe-28 [&_input]:text-[length:calc(14px*var(--fs-scale))]"/>
        </div>
      </div>
      {hits.length > 0 ? (
        <ul id="sv-results" role="listbox" aria-label={t('Matching patients')} className="max-h-[min(440px,calc(100dvh-300px))] divide-y divide-[var(--border)] overflow-y-auto" data-sv-results="">
          {hits.map((h, i) => <li key={h.id} id={`sv-hit-${h.id}`} role="option" aria-selected={i === cursor}>
            <button type="button" onMouseEnter={() => setCursor(i)} onClick={() => choose(h.id)}
              className={cn('focus-ring flex w-full items-center gap-3 px-4 py-2.5 text-start', i === cursor ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-2)]')}>
              <Avatar name={h.name} size="sm" decorative/>
              <span className="min-w-0 flex-1">
                <span data-phi className={cn('block truncate font-semibold', TEXT.body)}>{h.name}</span>
                <span className={cn('block tabular-nums', TEXT.muted)}><span data-phi>{h.mrn}</span>{h.age !== undefined ? ` · ${h.age} y · ${h.sex ?? ''}` : ''}</span>
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {h.identityStatus === 'unknown' && <Badge tone="danger">Unidentified</Badge>}
                {h.identityStatus === 'unverified' && <Badge tone="warning">Not verified</Badge>}
                {h.restricted && <Badge tone="warning">Restricted</Badge>}
                {h.deceasedAt && <Badge>Deceased</Badge>}
                {h.activeEncounter && <Badge tone="brand">Open visit</Badge>}
              </span>
              <ChevronRight className={cn('size-4 shrink-0 rtl:rotate-180', i === cursor ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]')} aria-hidden="true"/>
            </button>
          </li>)}
        </ul>
      ) : searched ? (
        <div className="p-4" data-sv-empty=""><EmptyState title="No matching patient." description="Check the spelling, or search by MRN or national ID."
          action={<Link href="/registration" className={LINK_BUTTON.primary}><UserPlus className="size-4" aria-hidden="true"/>{t('Register a new patient')}</Link>}/></div>
      ) : (
        <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <h3 className={cn(TEXT.eyebrow, 'text-[var(--text-muted)]')}>{t('Expected in the next two hours')}</h3>
            {expected === null ? <div className="mt-2 grid gap-2"><Skeleton className="h-9"/><Skeleton className="h-9"/></div> : expected.length === 0 ? (
              <p className={cn('mt-2', TEXT.muted)}>{t('No more booked appointments soon.')}</p>
            ) : (
              <ul className="mt-2 grid gap-1">
                {expected.filter(a => a.patient).slice(0, 5).map(a => <li key={a.id}>
                  <button type="button" onClick={() => choose(a.patient!.id)} className="focus-ring flex w-full items-center gap-3 rounded-[var(--radius)] px-2 py-1.5 text-start hover:bg-[var(--surface-2)]">
                    <Badge tone="brand" className="w-14 justify-center tabular-nums">{time.clock(a.startsAt)}</Badge>
                    <span className="min-w-0 flex-1"><span data-phi className={cn('block truncate font-semibold', TEXT.body)}>{a.patient!.name}</span><span className={cn('block truncate', TEXT.small)}>{a.clinic}{a.clinicianName ? ` · ${a.clinicianName}` : ''}</span></span>
                    {a.mode === 'video' && <Video className="size-4 text-[var(--info-ink)]" aria-label={t('Video')}/>}{a.mode === 'phone' && <Phone className="size-4 text-[var(--info-ink)]" aria-label={t('Telephone')}/>}
                    <ChevronRight className="size-4 text-[var(--text-muted)] rtl:rotate-180" aria-hidden="true"/>
                  </button>
                </li>)}
              </ul>
            )}
          </div>
          <div className={cn('grid content-start gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-3.5', TEXT.body)}>
            <p className="font-bold">{t('Before you start')}</p>
            <Tip icon={<Search className="size-4"/>}>{t('Search first, even for a returning patient, so the record is not duplicated.')}</Tip>
            <Tip icon={<CalendarClock className="size-4"/>}>{t('Patients with an appointment today are checked in from the appointment.')}</Tip>
            <Tip icon={<Siren className="size-4"/>}>{t('Unknown or unconscious emergency patients: use')} <Link href="/front-desk/emergency" className={LINK_BUTTON.inline}>{t('emergency registration')}</Link>.</Tip>
          </div>
        </div>
      )}
    </Panel>}

    {pid && !ctx && (error ? <ErrorState title="The patient could not be loaded" detail={error} onRetry={() => void load(pid)}
      action={<Button variant="ghost" onClick={clear} leftIcon={<X className="size-4" aria-hidden="true"/>}>Change patient</Button>}/> : (
      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]" data-sv-loading=""><Skeleton className="h-72"/><Skeleton className="h-72"/></div>
    ))}

    {ctx && <div className="grid items-start gap-3 lg:grid-cols-[clamp(300px,26vw,400px)_minmax(0,1fr)]">
      {/* Left: who the patient is, what to know, and what they need */}
      <aside className="grid items-start gap-3 md:grid-cols-2 lg:sticky lg:top-4 lg:grid-cols-1" aria-label={t('Patient')}>
        <Panel data-sv-patient={ctx.patient.id}>
          <div className="h-1 bg-[var(--primary)]" aria-hidden="true"/>
          <div className="flex items-start gap-3 p-3.5">
            <Avatar name={ctx.patient.name} size="lg" decorative/>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate font-bold', TEXT.heading, 'text-[length:calc(15px*var(--fs-scale))]')} data-phi>{ctx.patient.name}</p>
              <div className={cn('mt-1 flex flex-wrap items-center gap-x-2 gap-y-1', TEXT.muted)}>
                <span className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-[var(--surface-2)] ps-2 font-semibold tabular-nums text-[var(--text)]">
                  <span data-phi>{ctx.patient.mrn}</span>
                  <IconButton label={`MRN ${ctx.patient.mrn}, copy`} onClick={() => copyMrn(ctx.patient.mrn)} className="size-6">{copied ? <Check className="size-3.5 text-[var(--success-ink)]"/> : <Copy className="size-3.5"/>}</IconButton>
                </span>
                {ctx.patient.age !== undefined && <span>{ctx.patient.age} y · {ctx.patient.sex}</span>}
              </div>
            </div>
          </div>
          <dl className="mx-3.5 mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)]">
            <div className="bg-[var(--surface-2)] px-2.5 py-1.5">
              <dt className={TEXT.small}>{t('Identity')}</dt>
              <dd className="mt-0.5"><Badge tone={identityTone(ctx.patient.identityStatus)}>
                {ctx.patient.identityStatus === 'unknown' || ctx.patient.identityStatus === 'unverified' ? <ShieldAlert className="size-3" aria-hidden="true"/> : <BadgeCheck className="size-3" aria-hidden="true"/>}
                {t(ctx.patient.identityStatus === 'unknown' ? 'Unidentified' : ctx.patient.identityStatus === 'unverified' ? 'Not verified' : 'Verified')}
              </Badge></dd>
            </div>
            <div className="min-w-0 bg-[var(--surface-2)] px-2.5 py-1.5">
              <dt className={TEXT.small}>{t('Coverage')}</dt>
              <dd className="mt-0.5 min-w-0"><Badge tone={!insured ? 'neutral' : ctx.coverage?.eligibility === 'verified' ? 'success' : ctx.coverage?.eligibility === 'failed' ? 'danger' : 'neutral'} className="max-w-full">
                {insured ? <BadgeCheck className="size-3 shrink-0" aria-hidden="true"/> : <CreditCard className="size-3 shrink-0" aria-hidden="true"/>}
                <span className="truncate" title={insured ? `${ctx.coverage?.payer}${ctx.coverage?.eligibility ? ` · ${ctx.coverage.eligibility}` : ''}` : t('No insurance on record')}>{insured ? `${ctx.coverage?.payer}${ctx.coverage?.eligibility ? ` · ${ctx.coverage.eligibility}` : ''}` : t('Self-pay')}</span>
              </Badge></dd>
            </div>
          </dl>
          {(ctx.patient.restricted || ctx.patient.deceasedAt) && <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
            {ctx.patient.restricted && <Badge tone="warning"><ShieldAlert className="size-3" aria-hidden="true"/>{t('Restricted record')}</Badge>}
            {ctx.patient.deceasedAt && <Badge>Deceased</Badge>}
          </div>}
          <div className="grid grid-cols-2 gap-1 border-t border-[var(--border)] p-1.5">
            <Link href={`/patients/${ctx.patient.id}`} target="_blank" className={LINK_BUTTON.ghost}><FolderHeart className="size-4" aria-hidden="true"/>{t('Open chart')}</Link>
            <Button variant="ghost" onClick={clear} leftIcon={<X className="size-4" aria-hidden="true"/>}>Change patient</Button>
          </div>
        </Panel>

        {alerts > 0 && <section className="grid max-h-[260px] gap-1.5 overflow-y-auto md:col-start-1" aria-label={t('Before starting')}>
          {ctx.openVisits.map(v => <Notice key={v.id} tone="info" icon={<Activity className="size-4"/>}>
            <p className="font-bold">{t(EPISODE_LABEL[v.class] ?? `Open ${v.class} episode`)}</p>
            <p className="text-[var(--text-muted)]">{v.class === 'IP' ? [v.department, v.ward !== v.department ? v.ward : null, v.bed].filter(Boolean).join(' · ') : `${v.department} · ${v.status}`} · {t('since')} {time.clock(v.arrivedAt)}</p>
          </Notice>)}
          {ctx.appointments.map(a => <Notice key={a.id} tone="info" icon={<CalendarClock className="size-4"/>} actions={<Link href="/front-desk/appointments" className={LINK_BUTTON.inline}>{t('Check in')}</Link>}>
            <p className="font-bold">{t('Appointment today at {time}', {time: time.clock(a.startsAt)})}</p>
            <p className="text-[var(--text-muted)]">{a.clinic}{a.clinicianName ? ` with ${a.clinicianName}` : ''}. {t('Check in from the appointment so the booking is closed.')}</p>
          </Notice>)}
          {ctx.referrals.map(r => <Notice key={r.id} tone="info" icon={<Inbox className="size-4"/>}>
            <p className="font-bold">{t('Referral {status}: {specialty}', {status: r.status, specialty: r.specialty})}</p>
            <p className="text-[var(--text-muted)]">{t('From')} {r.referrerName}{r.organisation ? `, ${r.organisation}` : ''} · {r.referralDate}</p>
          </Notice>)}
          {(ctx.patient.identityStatus === 'unknown' || ctx.patient.identityStatus === 'unverified') && ctx.actions.find(a => a.key === 'start-visit')?.allowed && (
            <Notice tone={ctx.patient.identityStatus === 'unknown' ? 'danger' : 'warn'} icon={<ShieldAlert className="size-4"/>}
              actions={<Link href={`/front-desk/identify/${ctx.patient.id}`} className={LINK_BUTTON.inline}>{t(ctx.patient.identityStatus === 'unknown' ? 'Identify' : 'Verify')}</Link>}>
              <p className="font-bold">{t(ctx.patient.identityStatus === 'unknown' ? 'Unidentified patient' : 'Identity not verified')}</p>
              <p className="text-[var(--text-muted)]">{t(ctx.patient.identityStatus === 'unknown' ? 'Record who this patient is as soon as it is known.' : 'See an identity document or confirm with the next of kin.')}</p>
            </Notice>
          )}
        </section>}

        {!started && <Panel className="md:col-start-2 md:row-span-2 md:row-start-1 lg:col-start-auto lg:row-span-1 lg:row-start-auto" data-sv-services=""
          title={t('What does the patient need?')} actions={shortcutsOn ? <span className={cn('hidden lg:inline', TEXT.small)}>{t('Press a number')}</span> : undefined}>
          {ctx.actions.every(a => !a.allowed) ? <p className={cn('p-3.5', TEXT.muted)}>{t('Your role can view this patient but not start any of these.')}</p> : (
            <ul className="divide-y divide-[var(--border)]">
              {services.map((a, index) => {
                const Icon = ACTION_ICON[a.key] ?? ArrowRight;
                const off = isOff(a);
                const selected = a.key === 'start-visit' && startOpen;
                const body = <>
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-[var(--radius)]', off ? 'bg-[var(--surface-3)] text-[var(--text-muted)]' : selected ? 'bg-[var(--primary-fill)] text-white' : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]')}>
                    {off ? <Lock className="size-4" aria-hidden="true"/> : <Icon className="size-4" aria-hidden="true"/>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block font-bold', TEXT.body)}>{a.label}</span>
                    <span className={cn('block leading-snug', TEXT.muted, off && 'text-[var(--warning-ink)]')}>{off ? a.unavailable : a.description}</span>
                  </span>
                  {!off && shortcutsOn && index < 9 && <span className="hidden lg:inline-flex"><Kbd>{index + 1}</Kbd></span>}
                  {!off && (selected ? <Check className="size-4 shrink-0 text-[var(--primary)]" aria-hidden="true"/> : <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)] rtl:rotate-180" aria-hidden="true"/>)}
                </>;
                const cls = cn('focus-ring flex w-full items-center gap-3 px-3.5 py-2.5 text-start', off ? 'cursor-not-allowed opacity-75' : selected ? 'bg-[var(--primary-soft)] shadow-[inset_3px_0_0_var(--primary)]' : 'hover:bg-[var(--surface-2)]');
                return <li key={a.key} data-service={a.key}>
                  {a.key === 'start-visit' ? <button type="button" disabled={off} aria-pressed={selected} onClick={openForm} className={cls}>{body}</button>
                    : off || !a.href ? <div className={cls} aria-disabled>{body}</div> : <Link href={a.href} className={cls}>{body}</Link>}
                </li>;
              })}
            </ul>
          )}
        </Panel>}
      </aside>

      {/* Right: the visit, or what happened */}
      <div className="min-w-0">
        {started ? (
          <Panel tone="success" bodyClassName="px-6 py-10" data-sv-started={started.id}>
            <div className="mx-auto grid max-w-md justify-items-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success-ink)]"><CheckCircle2 className="size-6" aria-hidden="true"/></span>
              <div>
                <h2 className={cn(TEXT.heading, 'text-[length:calc(17px*var(--fs-scale))]')}>{t('Visit started')}</h2>
                <p className={cn('mt-0.5', TEXT.muted)}><span data-phi>{ctx.patient.name}</span> {t(started.class === 'ER' ? 'is now on the emergency board, waiting for triage.' : 'is now in the clinic queue.')}</p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {started.class === 'ER' ? <Link href={`/emergency/triage/${started.id}`} className={LINK_BUTTON.danger}><Siren className="size-4" aria-hidden="true"/>{t('Triage now')}</Link>
                  : <Link href={`/outpatient/intake/${started.id}`} className={LINK_BUTTON.primary}><ClipboardList className="size-4" aria-hidden="true"/>{t('Start nurse intake')}</Link>}
                <Link href={started.class === 'ER' ? '/emergency' : '/outpatient'} className={LINK_BUTTON.secondary}>{t(started.class === 'ER' ? 'Go to emergency board' : 'Go to clinic queue')}</Link>
                <Button variant="ghost" onClick={clear}>Start another visit</Button>
              </div>
            </div>
          </Panel>
        ) : startOpen ? (
          <div ref={formRef}><Panel className="flex min-h-0 flex-col lg:max-h-[calc(100dvh-176px)]" bodyClassName="flex min-h-0 flex-1 flex-col" data-sv-form={kind}
            title={t('Visit details')} subtitle={t(kind === 'ER' ? 'Goes to the emergency board for triage.' : 'Clinic visit; goes to the clinic queue for nurse intake.')}
            actions={<Segmented label="Type of visit" value={kind} onChange={v => setKind(v as typeof kind)}
              options={[{value: 'OP', label: 'Outpatient', icon: <Stethoscope className="size-4" aria-hidden="true"/>, disabled: blocked.length > 0}, {value: 'ER', label: 'Emergency', icon: <Siren className="size-4" aria-hidden="true"/>, disabled: blocked.length > 0}]}/>}>
            <div className="min-h-0 flex-1 px-4 py-4 lg:overflow-y-auto">
              {blocked.length > 0 && <ProblemList items={blocked} className="mb-4"/>}
              <fieldset disabled={blocked.length > 0} className={cn('grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4', gap)}>
                {kind === 'OP' ? <>
                  <Select label="Department" placeholder="" value={department} onChange={e => setDepartment(e.target.value)} hint={deptInfo?.specialties.length ? deptInfo.specialties.join(', ') : undefined} options={opDepartments.map(d => ({value: d.name, label: d.name}))}/>
                  <Select label="Responsible clinician (optional)" placeholder="Assign when seen" value={clinicianId} onChange={e => setClinicianId(e.target.value)} options={ctx.clinicians.map(u => ({value: u.id, label: `${u.name}${u.role === 'resident' ? ' (resident)' : ''}`}))}/>
                  <Choice label="How the patient came"><Segmented label="How the patient came" value={visitType} onChange={v => setVisitType(v as typeof visitType)} options={[{value: 'walk-in', label: 'Walk-in'}, {value: 'referral', label: 'Referred'}]}/></Choice>
                  <Choice label="Priority"><Segmented label="Priority" value={priority} onChange={v => setPriority(v as typeof priority)} options={[{value: 'routine', label: 'Routine'}, {value: 'urgent', label: 'Urgent'}]}
                    classes={priority === 'urgent' ? {selected: 'bg-[color-mix(in_srgb,var(--warning)_20%,var(--surface))] text-[var(--warning-ink)] shadow-[var(--shadow-sm)]'} : undefined}/></Choice>
                </> : <>
                  <Select label="Arrival mode" placeholder="" className="2xl:col-span-2" value={arrivalMode} onChange={e => setArrivalMode(e.target.value)} options={ctx.arrivalModes.map(a => ({value: a, label: ARRIVAL[a] ?? a}))}/>
                  <div className="self-end 2xl:col-span-2"><Notice tone="danger" icon={<Siren className="size-4"/>}>{t('Priority is set at triage (ESI).')}</Notice></div>
                </>}
                <Input label="Reason for visit (for the queue)" className="2xl:col-span-2" value={reason} onChange={e => setReason(e.target.value)} hint="Administrative note only. The nurse records the clinical complaint."/>
                <Choice label="Billing" className="2xl:col-span-2">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Billing for this visit')}>
                    {([['insurance', 'Insurance', insured ? `${ctx.coverage?.payer}${ctx.coverage?.memberId ? ` · ${ctx.coverage.memberId}` : ''}` : 'No insurance on record'],
                      ['self-pay', 'Self-pay', 'The patient pays for this visit.']] as const).map(([k, label, text]) => (
                      <Radio key={k} name="sv-billing" value={k} checked={billing === k} onChange={() => setBilling(k)} label={label} description={text}
                        className={cn('rounded-[var(--radius)] border px-2.5 py-2', billing === k ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-[var(--border)] hover:bg-[var(--surface-2)]')}/>
                    ))}
                  </div>
                </Choice>
                {billing === 'insurance' && !insured && <div className="md:col-span-2 2xl:col-span-4"><Notice tone="warn" icon={<AlertTriangle className="size-4"/>}>{t("No insurance on record. Update the patient's coverage first, or choose self-pay.")}</Notice></div>}
                {billing === 'insurance' && insured && ctx.coverage?.eligibility && ctx.coverage.eligibility !== 'verified' && <div className="md:col-span-2 2xl:col-span-4"><Notice tone="warn" icon={<AlertTriangle className="size-4"/>}>{t('Eligibility is {status}. Check it before the visit is billed.', {status: ctx.coverage.eligibility})}</Notice></div>}
                {kind === 'OP' && visitType === 'referral' && <div className="grid gap-3 md:col-span-2 2xl:col-span-4">
                  {ctx.referrals.length > 0 && <Select label="Link an accepted referral" placeholder="Enter the referral details below" value={referralId} onChange={e => setReferralId(e.target.value)}
                    options={ctx.referrals.map(r => ({value: r.id, label: `${r.specialty} · ${r.referrerName}${r.organisation ? `, ${r.organisation}` : ''} · ${r.referralDate} (${r.status})`}))}/>}
                  {!referralId && <ReferralSourceFields value={referral} onChange={setReferral}/>}
                </div>}
              </fieldset>
            </div>

            {/* Action bar: live summary, problems and the one button that matters */}
            <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
              <ProblemList items={problems} className="mb-3"/>
              <div className="flex flex-wrap items-center gap-3">
                <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label={t('Visit summary')}>
                  <Summary done label={kind === 'ER' ? t('Emergency') : `${t('Outpatient')}${priority === 'urgent' ? ` · ${t('urgent')}` : ''}`}/>
                  <Summary done={!!effectiveDept} label={effectiveDept || t('Choose a department')}/>
                  <Summary done label={kind === 'OP' ? clinicianName ?? t('Clinician assigned when seen') : t(ARRIVAL[arrivalMode] ?? arrivalMode)}/>
                  <Summary done={billing === 'self-pay' || insured} label={billing === 'self-pay' ? t('Self-pay') : ctx.coverage?.payer ?? t('No insurance on record')}/>
                  {kind === 'OP' && visitType === 'referral' && <Summary done={!!referralId || !!referral.referrerName} label={referralId ? t('Accepted referral linked') : referral.referrerName || t('Enter the referral source')}/>}
                </ul>
                <div className="grid justify-items-end gap-1">
                  <Button variant={kind === 'ER' ? 'danger' : 'primary'} size="lg" loading={busy} disabled={blocked.length > 0} onClick={() => void submit()}
                    leftIcon={kind === 'ER' ? <Siren className="size-4" aria-hidden="true"/> : <Stethoscope className="size-4" aria-hidden="true"/>}>
                    {kind === 'ER' ? 'Start emergency visit' : 'Start outpatient visit'}
                  </Button>
                  <p className={cn('flex items-center gap-1', TEXT.small)}>{shortcutsOn && <span className="hidden items-center gap-0.5 lg:inline-flex"><Kbd>Ctrl/⌘</Kbd><Kbd>Enter</Kbd><span className="mx-1">·</span></span>}{t('Recorded in the audit log.')}</p>
                </div>
              </div>
            </div>
          </Panel></div>
        ) : (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-6" data-sv-choose="">
            <EmptyState title="Choose what the patient needs" description="Pick a service on the left. Starting a visit now opens its details here."/>
          </div>
        )}
      </div>
    </div>}
  </div>;
}

function Tip({icon, children}: {icon: React.ReactNode; children: React.ReactNode}) {
  return <p className="flex items-start gap-2 text-[var(--text-muted)]"><span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span><span>{children}</span></p>;
}

/** One item in the visit summary: complete, or still needed. */
function Summary({done, label}: {done: boolean; label: string}) {
  return <li className="max-w-full"><Badge tone={done ? 'neutral' : 'warning'} className="max-w-full">
    {done ? <Check className="size-3 shrink-0 text-[var(--success-ink)]" aria-hidden="true"/> : <AlertTriangle className="size-3 shrink-0" aria-hidden="true"/>}<span className="truncate" data-phi>{label}</span>
  </Badge></li>;
}
