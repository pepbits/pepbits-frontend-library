'use client';
// Modes, fields, validation and API calls from the AllyVora clinical workspace (components/frontdesk/EmergencyRegistration.tsx,
// commit 1ede87f), rebuilt on the shared @pepbits components and semantic tokens. See provenance.json.
import React, {useEffect, useState} from 'react';
import {CheckCircle2, ChevronRight, CircleHelp, ClipboardList, FolderHeart, ShieldAlert, Siren, Truck, UserPlus, UserRound, UserX} from '@pepbits/icons';
import {Avatar, Badge, Button, Checkbox, DateInput, Input, Segmented, Select, Textarea, cn} from '@pepbits/ui';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {Link} from './link';
import {ApiError, api, departmentsFor, useServices, type IdentityLibrary, type PatientLite} from './lib';
import {Choice, LINK_BUTTON, Panel, ProblemList, TEXT, fieldGap, useDebounced, useToast} from './parts';
import {Notice} from '../support';

type Mode = 'known' | 'unknown';
type Dup = {patient: PatientLite; reasons: string[]; score: number};
type Done = {patient: PatientLite; encounter: {id: string; class: string} | null; existing: boolean};

/** Arrival modes the unknown-patient record accepts, and the subset an emergency visit accepts (the rest record as "other"). */
const ARRIVAL: [string, string][] = [['ambulance', 'Ambulance'], ['police', 'Police'], ['bystander', 'Brought by a bystander'], ['walk-in', 'Walked in'], ['inter-facility-transfer', 'Transfer from another facility'], ['other', 'Other']];
const VISIT_ARRIVAL = new Set(['ambulance', 'police', 'walk-in', 'inter-facility-transfer', 'other']);
const DEFERRED = 'Emergency registration: signature to be captured at the bedside when the patient is able.';
const toOptions = (pairs: [string, string][]) => pairs.map(([value, label]) => ({value, label}));

/**
 * Emergency registration for patients who cannot show identity: either they can say who they are
 * (no documents, verified later) or they cannot be identified (alias and temporary MRN). Both use the
 * same patient record and registration API as standard registration, and start the emergency visit.
 */
export function EmergencyRegistration() {
  const toast = useToast(), services = useServices();
  const {preferences} = usePreferences(), {t} = useLocalization();
  const erDept = departmentsFor(services, 'emergency')[0]?.name ?? 'Emergency';
  const [mode, setMode] = useState<Mode>('unknown');
  const [countries, setCountries] = useState<IdentityLibrary['countries']>([]);
  useEffect(() => {api<IdentityLibrary>('/identity-policy/library').then(l => setCountries(l.countries)).catch(() => {});}, []);

  // Shared
  const [arrivalMode, setArrivalMode] = useState('ambulance');
  const [reason, setReason] = useState('');
  // Known but undocumented
  const [k, setK] = useState({givenName: '', familyName: '', birthDate: '', birthDateEstimated: false, sex: '' as '' | 'male' | 'female' | 'other' | 'unknown', mobile: '', nationality: ''});
  const setKnown = <F extends keyof typeof k>(f: F, v: (typeof k)[F]) => setK(x => ({...x, [f]: v}));
  const [unable, setUnable] = useState(false);
  const [treatment, setTreatment] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [deferred, setDeferred] = useState(DEFERRED);
  // Unknown
  const [u, setU] = useState({sex: 'unknown' as 'male' | 'female' | 'unknown', estimatedAge: '', broughtBy: '', foundAt: '', referenceNumber: '', description: '', belongings: ''});
  const setUnknown = <F extends keyof typeof u>(f: F, v: (typeof u)[F]) => setU(x => ({...x, [f]: v}));

  const [dups, setDups] = useState<Dup[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  // A patient who can say who they are may already have a record: offer it before creating another.
  const dq = useDebounced({givenName: k.givenName, familyName: k.familyName, birthDate: k.birthDate, mobile: k.mobile, identifiers: []}, 400);
  useEffect(() => {
    if (mode !== 'known' || (dq.familyName.trim().length < 2 && dq.mobile.length < 9)) {setDups([]); return;}
    api<Dup[]>('/patients/duplicates', {json: dq}).then(setDups).catch(() => {});
  }, [dq, mode]);

  const visit = () => ({type: 'emergency', department: erDept, reason: reason.trim() || undefined, arrivalMode: VISIT_ARRIVAL.has(arrivalMode) ? arrivalMode : 'other'});
  const age = Number(u.estimatedAge);
  const ageOk = u.estimatedAge !== '' && Number.isInteger(age) && age >= 0 && age <= 120;
  const validate = () => {
    const e: string[] = [];
    if (mode === 'unknown') {if (!ageOk) e.push('Enter the estimated age in whole years (0–120).'); return e;}
    if (!k.givenName.trim() || !k.familyName.trim()) e.push('Enter the name the patient gives.');
    if (!k.birthDate) e.push('Enter the date of birth, or an estimate marked as estimated.');
    if (!k.sex) e.push('Choose administrative sex.');
    if (!unable && (!treatment || !privacy)) e.push('Record consent to treatment and the privacy notice, or that the patient is unable to consent.');
    if (!unable && deferred.trim().length < 10) e.push('Say why the signature is deferred (at least 10 characters).');
    return e;
  };

  const register = async () => {
    const e = validate(); setErrors(e);
    if (e.length) return;
    setBusy(true);
    try {
      const body = mode === 'unknown' ? {
        identityMode: 'unknown',
        unidentified: {estimatedAge: age, arrivalMode, broughtBy: u.broughtBy, foundAt: u.foundAt, referenceNumber: u.referenceNumber, description: u.description, belongings: u.belongings},
        sex: u.sex, sensitivity: 'normal', consents: {emergencyException: true}, visit: visit(),
      } : {
        identityMode: 'unverified',
        givenName: k.givenName.trim(), familyName: k.familyName.trim(), birthDate: k.birthDate, birthDateEstimated: k.birthDateEstimated, sex: k.sex,
        nationality: k.nationality || 'ZZ', preferredLanguage: 'und', mobile: k.mobile.trim() || undefined, identifiers: [], sensitivity: 'normal',
        consents: {treatment: unable ? false : treatment, privacy: unable ? false : privacy, hie: 'not-asked', sms: false, treatmentVersion: '4', privacyVersion: '2', signatureCaptured: false, signature: null,
          signatureDeferredReason: unable ? 'Patient unable to consent on arrival (emergency exception).' : deferred.trim(), emergencyException: unable},
        visit: visit(),
      };
      const r = await api<{patient: PatientLite; encounter: {id: string; class: string} | null}>('/patients', {json: body});
      setDone({...r, existing: false});
      toast(`${r.patient.name} registered · ${r.patient.mrn}`, 'success');
    } catch (err) {
      const ae = err as ApiError;
      setErrors([ae.message + (typeof ae.body?.mrn === 'string' ? ` MRN: ${ae.body.mrn}.` : '')]);
    } finally {setBusy(false);}
  };
  const useExisting = async (p: PatientLite) => {
    setBusy(true); setErrors([]);
    try {
      const r = await api<{encounter: {id: string; class: string}}>(`/patients/${p.id}/visits`, {json: {visit: visit()}});
      setDone({patient: p, encounter: r.encounter, existing: true});
      toast(`Emergency visit started for ${p.name} · ${p.mrn}`, 'success');
    } catch (err) {setErrors([(err as Error).message]);} finally {setBusy(false);}
  };
  const reset = () => {
    setDone(null); setErrors([]); setDups([]); setReason(''); setArrivalMode('ambulance');
    setK({givenName: '', familyName: '', birthDate: '', birthDateEstimated: false, sex: '', mobile: '', nationality: ''});
    setUnable(false); setTreatment(false); setPrivacy(false); setDeferred(DEFERRED);
    setU({sex: 'unknown', estimatedAge: '', broughtBy: '', foundAt: '', referenceNumber: '', description: '', belongings: ''});
  };

  const unknown = mode === 'unknown';
  const grid = cn('grid grid-cols-1 md:grid-cols-2', fieldGap(preferences.density));
  return <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-3 py-4 sm:px-4 lg:px-6" data-emergency-mode={done ? 'done' : mode}>
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className={cn(TEXT.eyebrow, 'text-[var(--danger-ink)]')}>{t('Front desk · Emergency')}</p>
        <h1 className={TEXT.title}>{t('Emergency registration')}</h1>
      </div>
      {!done && <Segmented label="Who is the patient?" value={mode} onChange={m => {setMode(m as Mode); setErrors([]);}}
        options={[{value: 'known', label: 'Can say who they are', icon: <UserRound className="size-4" aria-hidden="true"/>}, {value: 'unknown', label: 'Cannot be identified', icon: <UserX className="size-4" aria-hidden="true"/>}]}
        classes={unknown ? {selected: 'bg-[var(--danger-fill)] text-white shadow-[var(--shadow-sm)]'} : undefined}/>}
      <div className="flex items-center gap-1.5">
        <Link href="/front-desk/visits/new" className={LINK_BUTTON.ghost}><ClipboardList className="size-4" aria-hidden="true"/>{t('Start a visit')}</Link>
        <Link href="/registration" className={LINK_BUTTON.secondary}><UserPlus className="size-4" aria-hidden="true"/>{t('Standard registration')}</Link>
      </div>
    </header>

    {done ? (
      <Panel tone="success" bodyClassName="px-6 py-10" data-emergency-done={done.patient.id}>
        <div className="mx-auto grid max-w-lg justify-items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success-ink)]"><CheckCircle2 className="size-6" aria-hidden="true"/></span>
          <h2 className={cn(TEXT.heading, 'text-[length:calc(17px*var(--fs-scale))]')}>{t(done.existing ? 'Emergency visit started on the existing record' : 'Registered and sent to triage')}</h2>
          <div className="grid w-full gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
            <p className={cn(TEXT.eyebrow, 'text-[var(--text-muted)]')}>{t('Name and MRN for the wristband')}</p>
            <p data-phi className="text-[length:calc(24px*var(--fs-scale))] font-bold tracking-tight text-[var(--text)]">{done.patient.name}</p>
            <p data-phi className="text-[length:calc(20px*var(--fs-scale))] font-bold tabular-nums text-[var(--primary-strong)]">{done.patient.mrn}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {done.patient.identityStatus === 'unknown' && <Badge tone="danger"><ShieldAlert className="size-3" aria-hidden="true"/>{t('Unidentified · identify within 4 hours')}</Badge>}
              {done.patient.identityStatus === 'unverified' && <Badge tone="warning">Identity not verified · verify within 24 hours</Badge>}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {done.encounter && <Link href={`/emergency/triage/${done.encounter.id}`} className={LINK_BUTTON.danger}><Siren className="size-4" aria-hidden="true"/>{t('Triage now')}</Link>}
            <Link href={`/patients/${done.patient.id}`} className={LINK_BUTTON.secondary}><FolderHeart className="size-4" aria-hidden="true"/>{t('Open chart')}</Link>
            <Link href="/emergency" className={LINK_BUTTON.secondary}>{t('Emergency board')}</Link>
            <Button variant="ghost" onClick={reset}>Register another</Button>
          </div>
        </div>
      </Panel>
    ) : (
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel tone={unknown ? 'danger' : undefined} className="flex min-h-0 flex-col lg:max-h-[calc(100dvh-176px)]" bodyClassName="flex min-h-0 flex-1 flex-col" data-emergency-form={mode}
          icon={<span className={cn('grid size-9 shrink-0 place-items-center rounded-[var(--radius)] text-white', unknown ? 'bg-[var(--danger-fill)]' : 'bg-[var(--primary-fill)]')}>{unknown ? <UserX className="size-5" aria-hidden="true"/> : <UserRound className="size-5" aria-hidden="true"/>}</span>}
          title={t(unknown ? 'Unknown patient' : 'Patient can say who they are')}
          subtitle={t(unknown ? 'Unconscious, confused, or no one can identify them. A distinct alias and a temporary MRN are assigned.' : 'Record the identity the patient gives. It is verified later against a document or next of kin.')}>
          <div className="min-h-0 flex-1 px-4 py-4 lg:overflow-y-auto">
            {unknown ? (
              <div className={grid}>
                <Choice label="Administrative sex" required><Segmented label="Administrative sex (required)" value={u.sex} onChange={v => setUnknown('sex', v as typeof u.sex)} options={toOptions([['male', 'Male'], ['female', 'Female'], ['unknown', 'Unknown']])}/></Choice>
                <Input label="Estimated age (years)" required type="number" min={0} max={120} inputMode="numeric" value={u.estimatedAge} onChange={e => setUnknown('estimatedAge', e.target.value)} hint="A birth date of 1 January of that year is recorded as estimated." className="[&_input]:tabular-nums"/>
                <Select label="Arrival" placeholder="" value={arrivalMode} onChange={e => setArrivalMode(e.target.value)} options={toOptions(ARRIVAL)}/>
                <Input label="Brought by (optional)" value={u.broughtBy} maxLength={200} onChange={e => setUnknown('broughtBy', e.target.value)} placeholder="Ambulance crew, police officer, passer-by"/>
                <Input label="Where found (optional)" value={u.foundAt} maxLength={200} onChange={e => setUnknown('foundAt', e.target.value)}/>
                <Input label="Police or ambulance reference (optional)" value={u.referenceNumber} maxLength={80} onChange={e => setUnknown('referenceNumber', e.target.value)}/>
                <Textarea label="Description (optional)" rows={2} className="md:col-span-2" value={u.description} maxLength={1000} onChange={e => setUnknown('description', e.target.value)} placeholder="Build, hair, distinguishing marks, clothing" hint="Helps relatives and police identify the patient later."/>
                <Input label="Belongings (optional)" value={u.belongings} maxLength={1000} onChange={e => setUnknown('belongings', e.target.value)} placeholder="Items kept with the patient"/>
                <Input label="Reason for visit (for the queue)" value={reason} maxLength={500} onChange={e => setReason(e.target.value)}/>
              </div>
            ) : (
              <div className={grid}>
                <Input label="Given name" required autoComplete="off" value={k.givenName} maxLength={60} onChange={e => setKnown('givenName', e.target.value)}/>
                <Input label="Family name" required autoComplete="off" value={k.familyName} maxLength={80} onChange={e => setKnown('familyName', e.target.value)}/>
                <div className="min-w-0">
                  <DateInput label="Date of birth" required value={k.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={e => setKnown('birthDate', e.target.value)} className="[&_input]:tabular-nums"/>
                  <Checkbox label="Estimated" checked={k.birthDateEstimated} onChange={e => setKnown('birthDateEstimated', e.target.checked)} className="mt-1.5"/>
                </div>
                <Choice label="Administrative sex" required><Segmented label="Administrative sex (required)" value={k.sex} onChange={v => setKnown('sex', v as typeof k.sex)} options={toOptions([['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['unknown', 'Unknown']])}/></Choice>
                <Input label="Mobile (if known)" type="tel" autoComplete="off" value={k.mobile} maxLength={30} onChange={e => setKnown('mobile', e.target.value)} placeholder="Include the country calling code" className="[&_input]:tabular-nums"/>
                <Select label="Nationality (if known)" placeholder="Not known" value={k.nationality} onChange={e => setKnown('nationality', e.target.value)} options={countries.map(c => ({value: c.code, label: c.label}))}/>
                <Select label="Arrival" placeholder="" value={arrivalMode} onChange={e => setArrivalMode(e.target.value)} options={toOptions(ARRIVAL.filter(([v]) => VISIT_ARRIVAL.has(v)))}/>
                <Input label="Reason for visit (for the queue)" value={reason} maxLength={500} onChange={e => setReason(e.target.value)}/>
                <fieldset className={cn('grid gap-3 rounded-[var(--radius)] border border-[var(--border)] p-3 md:col-span-2')} data-consent="">
                  <legend className={cn('px-1 font-bold', TEXT.muted)}>{t('Consent')}</legend>
                  <Checkbox label="The patient is unable to consent now." description="Treat under the emergency exception and obtain consent when able." checked={unable} onChange={e => setUnable(e.target.checked)}/>
                  {!unable && <div className="grid gap-3 md:grid-cols-2">
                    <Checkbox label="Consents to examination and treatment" checked={treatment} onChange={e => setTreatment(e.target.checked)}/>
                    <Checkbox label="Privacy notice acknowledged" checked={privacy} onChange={e => setPrivacy(e.target.checked)}/>
                    <Input label="Why the signature is deferred" className="md:col-span-2" value={deferred} maxLength={500} onChange={e => setDeferred(e.target.value)}/>
                  </div>}
                </fieldset>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <ProblemList items={errors} className="mb-3"/>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={TEXT.muted}>{t('Goes to')} <b className="text-[var(--text)]">{erDept}</b> {t('triage. Registration is recorded in the audit log.')}</p>
              <Button variant="danger" size="lg" loading={busy} onClick={() => void register()} leftIcon={<Siren className="size-4" aria-hidden="true"/>}>
                {unknown ? 'Register unknown patient' : 'Register and send to triage'}
              </Button>
            </div>
          </div>
        </Panel>

        <aside className="grid gap-3 lg:sticky lg:top-4" aria-label={t('Guidance')}>
          {!unknown && dups.length > 0 && <Panel tone="warning" title={t('Possible existing record')} data-emergency-duplicates="">
            <ul className="max-h-[260px] divide-y divide-[var(--border)] overflow-y-auto">
              {dups.slice(0, 5).map(d => <li key={d.patient.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <Avatar name={d.patient.name} size="sm" decorative/>
                <span className="min-w-0 flex-1"><span data-phi className={cn('block truncate font-semibold', TEXT.body)}>{d.patient.name}</span><span className={cn('block truncate tabular-nums', TEXT.small)}><span data-phi>{d.patient.mrn}</span> · {d.reasons.join(', ')}</span></span>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void useExisting(d.patient)} title={t('Start the emergency visit on this record instead of registering again')} rightIcon={<ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden="true"/>}>Use</Button>
              </li>)}
            </ul>
          </Panel>}
          <Panel title={t(unknown ? 'What happens' : 'When to use this')} icon={<CircleHelp className="mt-0.5 size-4 text-[var(--primary)]" aria-hidden="true"/>} bodyClassName="p-3.5">
            {unknown ? (
              <ul className={cn('grid list-disc gap-1.5 ps-4', TEXT.muted)}>
                <li>{t('A distinct alias (for example Unknown Kilo-0042) and a temporary MRN (TMP-######) are assigned, so two unknown patients are never confused.')}</li>
                <li>{t('Treatment proceeds under the emergency consent exception.')}</li>
                <li>{t('An urgent task asks reception to identify the patient within 4 hours.')}</li>
                <li>{t("When identified, Identify patient renames this record or merges it into the patient's existing one. Nothing recorded is lost.")}</li>
              </ul>
            ) : (
              <ul className={cn('grid list-disc gap-1.5 ps-4', TEXT.muted)}>
                <li>{t('The patient is conscious and tells you who they are, but has no identity document or phone.')}</li>
                <li>{t('A normal MRN is assigned; the identity is marked not verified.')}</li>
                <li>{t('A task asks reception to verify it within 24 hours, against a document or with next of kin.')}</li>
                <li>{t('If they already have a record, use it from Possible existing record instead of registering again.')}</li>
              </ul>
            )}
          </Panel>
          <Notice tone="info" icon={<Truck className="size-4"/>}>
            <p className="font-bold">{t('Has an identity document?')}</p>
            <p className="text-[var(--text-muted)]">{t('Use')} <Link href="/registration" className={LINK_BUTTON.inline}>{t('standard registration')}</Link>, {t('or')} <Link href="/front-desk/visits/new" className={LINK_BUTTON.inline}>{t('Start a visit')}</Link> {t('for a registered patient.')}</p>
          </Notice>
        </aside>
      </div>
    )}
  </div>;
}
