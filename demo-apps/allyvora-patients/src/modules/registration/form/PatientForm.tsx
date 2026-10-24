'use client';
import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {
  FIELDS, NAME_PARTS, SECTIONS, completion, computeAge, deriveDisplayName, firstErrorField, optionsFor, sanitizeValues, sectionDef,
  sectionIndex, sectionOf, sectionProgress, todayISO, validateForm, visibleFields,
  type DuplicateCandidate, type FieldErrors, type FieldValue, type FormValues, type LayoutSettings, type Lookups, type MrnPreview, type SectionId, type SectionProgress,
} from '@allyvora/shared';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, History, ListChecks, Save, Users} from '@pepbits/icons';
import {useAllyVora} from '../context';
import {PAGE} from '../../../navigation';
import {KEYS, Notice, SEX_SHORT, useHotkey, useTimeFormat} from '../support';
import {FormProvider, focusField, scrollWithin, sectionDomId, type FormCtx} from './parts';
import {LAYOUT_COMPONENTS, overall, type LayoutProps} from './layouts';
import {PatientBand} from './PatientBand';
import {RulesDrawer} from './RulesDrawer';

export type SubmitResult = {ok: true} | {ok: false; errors?: FieldErrors};
export interface PatientFormProps {
  mode: 'new' | 'edit' | 'preview';
  initialValues: FormValues;
  settings: LayoutSettings;
  lookups: Lookups;
  identity?: {mrn?: string | null; orgNumber?: string | null; patientId?: number; branchName?: string};
  initialSection?: SectionId;
  onSubmit: (values: FormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Session-scoped draft key (in-memory, never browser storage); null disables drafts. */
  draftKey?: string | null;
  className?: string;
}

const PIN_TARGETS: Record<string, Record<string, string>> = {
  pincode: {city: 'city', district: 'district', state: 'state'},
  permPincode: {city: 'permCity', state: 'permState'},
};

/** One form controller for every layout, ported from the source PatientForm with shared controls and host preferences. */
export function PatientForm(props: PatientFormProps) {
  const {mode, settings, lookups, identity, draftKey} = props;
  const {client, draft, saveDraft} = useAllyVora();
  const {t} = useLocalization(), {preferences} = usePreferences(), navigation = useNavigation(), time = useTimeFormat();
  const reducedMotion = !!preferences.reducedMotion;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const today = useMemo(() => todayISO(), []);
  const preview = mode === 'preview';

  const [values, setValues] = useState<FormValues>(props.initialValues);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<SectionId>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [active, setActive] = useState<SectionId>(props.initialSection ?? 'mrn');
  const [saving, setSaving] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [mrnPreview, setMrnPreview] = useState<MrnPreview | null>(null);
  const [pinHints, setPinHints] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [dupDismissed, setDupDismissed] = useState('');
  const [draftOffer, setDraftOffer] = useState<{values: FormValues; savedAt: string} | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const manualName = useRef(typeof props.initialValues.displayName === 'string' && props.initialValues.displayName !== '' && props.initialValues.displayName !== deriveDisplayName(props.initialValues, lookups));
  const autoFilled = useRef<Record<string, string>>({});
  const initialJson = useMemo(() => JSON.stringify(sanitizeValues(props.initialValues)), [props.initialValues]);
  const locked = useMemo(() => new Set(mode === 'edit' ? ['branchId'] : []), [mode]);

  /* ---------------- validation state ---------------- */
  const allErrors = useMemo(() => ({...validateForm(values, today), ...serverErrors}), [values, today, serverErrors]);
  const shownErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [key, message] of Object.entries(allErrors)) {
      const section = sectionOf(key);
      if (revealAll || (section && revealed.has(section)) || serverErrors[key] || (settings.validateOn !== 'submit' && touched.has(key))) out[key] = message;
    }
    return out;
  }, [allErrors, revealAll, revealed, serverErrors, settings.validateOn, touched]);
  const progress = useMemo(() => Object.fromEntries(SECTIONS.map(section => [section.id, sectionProgress(section.id, values, allErrors, shownErrors)])) as Record<SectionId, SectionProgress>, [values, allErrors, shownErrors]);
  const percent = useMemo(() => completion(values, today), [values, today]);
  const dirty = useMemo(() => JSON.stringify(sanitizeValues(values)) !== initialJson, [values, initialJson]);
  const onDirtyChange = props.onDirtyChange;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  /* ---------------- edits ---------------- */
  const setValue = useCallback((id: string, value: FieldValue) => {
    if (locked.has(id)) return;
    setValues(previous => {
      const next: FormValues = {...previous, [id]: value};
      if (id === 'displayName') manualName.current = typeof value === 'string' && value.trim() !== '' && value !== deriveDisplayName(next, lookups);
      else if (NAME_PARTS.includes(id) && !manualName.current) next.displayName = deriveDisplayName(next, lookups);
      // Clear dependent choices that no longer fit (consultant after department changes).
      for (const field of FIELDS) if (field.lookupParent === id && next[field.id] && !optionsFor(field, next, lookups).some(option => option.code === next[field.id])) next[field.id] = null;
      return next;
    });
    setServerErrors(errors => {if (!(id in errors)) return errors; const {[id]: _removed, ...rest} = errors; return rest;});
    if (settings.validateOn === 'change') setTouched(current => current.has(id) ? current : new Set(current).add(id));
    setDraftOffer(null);
  }, [locked, lookups, settings.validateOn]);
  const blur = useCallback((id: string) => {
    if (settings.validateOn === 'submit') return;
    setTouched(current => current.has(id) ? current : new Set(current).add(id));
  }, [settings.validateOn]);

  /* ---------------- PIN code lookup ---------------- */
  const runPin = (field: string, pin: FieldValue) => {
    if (typeof pin !== 'string' || !/^[1-9][0-9]{5}$/.test(pin)) {setPinHints(hints => hints[field] ? {...hints, [field]: ''} : hints); return;}
    let live = true;
    client.pincode(pin).then(result => {
      if (!live) return;
      const map = PIN_TARGETS[field]!;
      setValues(previous => {
        const next = {...previous};
        for (const [source, target] of Object.entries(map)) {
          const value = result[source as keyof typeof result], current = previous[target];
          if (!current || current === autoFilled.current[target]) {next[target] = value; autoFilled.current[target] = value;}
        }
        return next;
      });
      setPinHints(hints => ({...hints, [field]: t('{city}, {district}, filled in', {city: result.city, district: result.district})}));
    }).catch(() => {if (live) setPinHints(hints => ({...hints, [field]: t('Not in the PIN directory. Enter city and state yourself.')}));});
    return () => {live = false;};
  };
  useEffect(() => runPin('pincode', values.pincode), [values.pincode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => runPin('permPincode', values.permPincode), [values.permPincode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- MRN preview ---------------- */
  useEffect(() => {
    if (mode === 'edit' || !values.branchId) {setMrnPreview(null); return;}
    let live = true;
    client.mrnPreview(Number(values.branchId)).then(next => {if (live) setMrnPreview(next);}).catch(() => {if (live) setMrnPreview(null);});
    return () => {live = false;};
  }, [mode, values.branchId, client]);

  /* ---------------- duplicate detection ---------------- */
  const dupKey = mode === 'new' ? [values.givenName, values.familyName, values.dateOfBirth, values.mobile].map(value => String(value ?? '').trim().toLowerCase()).join('|') : '';
  useEffect(() => {
    if (!dupKey) return;
    const given = String(values.givenName ?? '').trim(), mobile = String(values.mobile ?? '');
    const enough = /^[6-9][0-9]{9}$/.test(mobile) || (given.length >= 2 && (values.familyName || values.dateOfBirth));
    if (!enough) {setDuplicates([]); return;}
    let live = true;
    const timer = setTimeout(() => {
      client.patients.duplicates({givenName: given, familyName: (values.familyName as string) || undefined, dateOfBirth: (values.dateOfBirth as string) || undefined, mobile: /^[6-9][0-9]{9}$/.test(mobile) ? mobile : undefined})
        .then(found => {if (live) setDuplicates(found);}).catch(() => {});
    }, 450);
    return () => {live = false; clearTimeout(timer);};
  }, [dupKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dupSignature = duplicates.map(candidate => candidate.id).join(',');

  /* ---------------- session drafts ---------------- */
  const draftsOn = !!draftKey && settings.autosaveDraft && mode === 'new';
  useEffect(() => {
    if (!draftsOn) return;
    const saved = draft(draftKey!);
    if (saved && JSON.stringify(sanitizeValues(saved.values)) !== initialJson) setDraftOffer(saved);
  }, [draftsOn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftsOn || draftOffer) return;
    const timer = setTimeout(() => {
      if (!dirty) return;
      const savedAt = new Date().toISOString();
      saveDraft(draftKey!, {values, savedAt});
      setDraftSavedAt(savedAt);
    }, 800);
    return () => clearTimeout(timer);
  }, [values, dirty, draftsOn, draftOffer, draftKey, saveDraft]);

  /* ---------------- navigation ---------------- */
  const goTo = useCallback((section: SectionId, fieldId?: string) => {
    setActive(section);
    setTimeout(() => {
      if (fieldId) focusField(uid, fieldId, reducedMotion);
      else if (settings.layout === 'scroll') {const node = document.getElementById(sectionDomId(uid, section)); if (node) scrollWithin(node, 'start', reducedMotion);}
    }, settings.layout === 'scroll' ? 20 : 80);
  }, [settings.layout, uid, reducedMotion]);
  const select = useCallback((section: SectionId) => {
    if (section === active) {if (settings.layout === 'scroll') goTo(section); return;}
    const current = progress[active];
    if (settings.layout !== 'scroll' && current.filled > 0 && current.state !== 'complete') setRevealed(previous => new Set(previous).add(active));
    goTo(section);
  }, [active, goTo, progress, settings.layout]);
  const index = sectionIndex(active), isLast = index === SECTIONS.length - 1;
  const next = useCallback(() => {
    const problems = visibleFields(active, values).filter(field => allErrors[field.id]);
    setRevealed(previous => new Set(previous).add(active));
    if (settings.layout === 'wizard' && problems.length) {setTimeout(() => focusField(uid, problems[0]!.id, reducedMotion), 30); return;}
    if (!isLast) goTo(SECTIONS[index + 1]!.id);
  }, [active, values, allErrors, settings.layout, isLast, goTo, index, uid, reducedMotion]);
  const previous = useCallback(() => {if (index > 0) goTo(SECTIONS[index - 1]!.id);}, [index, goTo]);

  /* ---------------- submit ---------------- */
  const submitting = useRef(false);
  const submit = useCallback(async () => {
    if (submitting.current) return;
    setRevealAll(true);
    const errors = validateForm(values, today), first = firstErrorField(errors);
    if (first) {goTo(sectionOf(first)!, first); return;}
    submitting.current = true; setSaving(true);
    try {
      const result = await props.onSubmit(sanitizeValues(values));
      if (result.ok) {if (draftKey) saveDraft(draftKey, null);}
      else if (result.errors) {
        setServerErrors(result.errors);
        const field = firstErrorField(result.errors);
        if (field) goTo(sectionOf(field)!, field);
      }
    } finally {submitting.current = false; setSaving(false);}
  }, [values, today, goTo, props, draftKey, saveDraft]);

  useHotkey(KEYS.save, event => {event.preventDefault(); void submit();}, !preview);
  useHotkey(KEYS.next, event => {event.preventDefault(); next();}, !preview);
  useHotkey(KEYS.previous, event => {event.preventDefault(); previous();}, !preview);

  /* ---------------- context ---------------- */
  const ctx = useMemo<FormCtx>(() => ({
    uid, values, errors: shownErrors, lookups, density: settings.density, columns: settings.columns, reducedMotion, setValue, blur, locked, progress,
    readonlyText: id => {
      if (id === 'mrn') return identity?.mrn ? {text: identity.mrn, muted: false} : {text: mrnPreview ? t('{mrn} when saved', {mrn: mrnPreview.next}) : t('Assigned when saved'), muted: true};
      if (id === 'orgNumber') return identity?.orgNumber ? {text: identity.orgNumber, muted: false} : {text: t('Assigned when saved'), muted: true};
      return {text: String(values[id] ?? ''), muted: false};
    },
    hintFor: id => {
      switch (id) {
        case 'dateOfBirth': case 'birthYear': case 'estimatedAge': {
          const age = computeAge(values, today);
          if (age.years === null || shownErrors[id]) return null;
          if (id === 'estimatedAge') return t('Born around {year}', {year: Number(today.slice(0, 4)) - age.years});
          return age.label?.endsWith(' y') ? (age.approximate ? t('About {years} years old', {years: age.years}) : t('{years} years old', {years: age.years})) : t('{age} old', {age: age.label?.replace('~', '') ?? ''});
        }
        case 'pincode': case 'permPincode': return pinHints[id] || null;
        case 'branchId':
          if (mode === 'edit') return t('The registering branch can’t change after the MRN is assigned');
          return mrnPreview ? t('Numbering rule {rule}', {rule: mrnPreview.rule}) : null;
        case 'displayName': return manualName.current ? t('Edited by hand. Clear it to rebuild from the name fields.') : null;
        case 'consultant': return values.department ? null : t('Choose a department to narrow this list');
        default: return null;
      }
    },
    sectionNote: section => {
      if (section !== 'mrn') return null;
      if (mode === 'edit' && identity?.mrn) return t('MRN {mrn} was assigned by {branch} and stays with this patient for life.', {mrn: identity.mrn, branch: identity.branchName ?? t('the registering branch')});
      return t('The branch MRN is assigned when you save, using the selected branch’s numbering rule. Organisation numbers follow their own rule.');
    },
  }), [uid, values, shownErrors, lookups, settings.density, settings.columns, reducedMotion, setValue, blur, locked, identity, mrnPreview, today, pinHints, mode, progress, t]);

  /* ---------------- render ---------------- */
  const errorCount = Object.keys(shownErrors).length;
  const sectionsWithErrors = SECTIONS.filter(section => progress[section.id].errorCount > 0);
  const {done} = overall(progress);
  const stepped = settings.layout === 'wizard' || settings.layout === 'stepper' || settings.layout === 'tabs';
  const Layout = LAYOUT_COMPONENTS[settings.layout];
  const layoutProps: LayoutProps = {uid, active, onSelect: select, onActiveChange: setActive, progress, compact: settings.density === 'compact', reducedMotion, onNext: next};
  const visibleDupes = duplicates.length > 0 && dupDismissed !== dupSignature;
  const saveHint = preferences.showKeyboardHints && preferences.keyboardShortcuts ? ' (Ctrl+S)' : '';

  return <FormProvider value={ctx}>
    <div className={settings.density === 'compact' ? 'flex h-full min-h-0 flex-col gap-2' : 'flex h-full min-h-0 flex-col gap-3'} data-patient-form={mode} data-form-layout={settings.layout}>
      {settings.showSummary ? <PatientBand values={values} lookups={lookups} mrn={identity?.mrn} mrnPending={mrnPreview?.next} completion={percent} sectionsLabel={t('{done} of {total} sections done', {done, total: SECTIONS.length})} className="shrink-0"/> : null}
      {draftOffer ? <Notice tone="info" icon={<History className="size-[18px]"/>} actions={<>
        <Button size="sm" variant="primary" onClick={() => {
          manualName.current = !!draftOffer.values.displayName && draftOffer.values.displayName !== deriveDisplayName(draftOffer.values, lookups);
          setValues(draftOffer.values); setDraftOffer(null);
        }}>{t('Restore draft')}</Button>
        <Button size="sm" variant="ghost" onClick={() => {saveDraft(draftKey!, null); setDraftOffer(null);}}>{t('Discard')}</Button>
      </>}>{draftOffer.values.displayName ? t('You have an unsaved registration from {time} for {name}.', {time: time.clock(draftOffer.savedAt), name: String(draftOffer.values.displayName)}) : t('You have an unsaved registration from {time}.', {time: time.clock(draftOffer.savedAt)})}</Notice> : null}
      {visibleDupes ? <Notice tone="warn" icon={<Users className="size-[18px]"/>} onDismiss={() => setDupDismissed(dupSignature)}>
        <p className="font-semibold">{t('This may be a returning patient. Check before creating a new record.')}</p>
        <ul className="mt-1.5 space-y-1" data-duplicates="">
          {duplicates.map(candidate => <li key={candidate.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <a href={navigation.hrefFor({pageId: PAGE.register, mode: 'view', recordId: String(candidate.id)})} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--text)] underline underline-offset-2">{candidate.displayName}<ExternalLink className="size-3" aria-hidden="true"/><span className="sr-only"> {t('(opens in a new tab)')}</span></a>
            <span className="tabular-nums text-[var(--text-muted)]">{candidate.mrn}{candidate.ageLabel ? `, ${candidate.ageLabel}` : ''}{candidate.sex ? ` ${SEX_SHORT[candidate.sex]}` : ''}</span>
            <span className="text-[var(--warning-ink)]">{candidate.reasons.map((reason, i) => i ? reason.charAt(0).toLowerCase() + reason.slice(1) : reason).join(', ')}</span>
          </li>)}
        </ul>
      </Notice> : null}
      {revealAll && errorCount > 0 ? <Notice tone="danger" icon={<AlertTriangle className="size-[18px]"/>}>
        <span className="font-semibold">{t(errorCount === 1 ? '{count} field needs attention.' : '{count} fields need attention.', {count: errorCount})}</span>{' '}
        <span className="inline-flex flex-wrap gap-1.5 align-middle">{sectionsWithErrors.map(section => <button key={section.id} type="button" onClick={() => goTo(section.id, visibleFields(section.id, values).find(field => shownErrors[field.id])?.id)}
          className="focus-ring rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[length:calc(10.5px*var(--fs-scale))] font-semibold tabular-nums text-[var(--danger-ink)] ring-1 ring-[var(--danger)]">{t(section.short)} ({progress[section.id].errorCount})</button>)}</span>
      </Notice> : null}
      <div className="min-h-0 flex-1"><Layout {...layoutProps}/></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 shadow-[var(--shadow-sm)] sm:px-3" data-form-actions="">
        <Button variant="ghost" onClick={props.onCancel}><ArrowLeft className="size-4" aria-hidden="true"/>{t(mode === 'edit' ? 'Cancel' : 'Back to patients')}</Button>
        <span className="hidden text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)] lg:inline" aria-live="polite">
          {preview ? t('Preview with sample data. Nothing is saved.') : draftsOn && draftSavedAt && dirty ? t('Draft kept for this session at {time}', {time: time.clock(draftSavedAt)}) : dirty ? t('Unsaved changes') : mode === 'edit' ? t('No changes yet') : ''}
        </span>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => setRulesOpen(true)}><ListChecks className="size-4" aria-hidden="true"/>{t('Check form rules')}</Button>
          {stepped ? <Button variant="secondary" onClick={previous} disabled={index === 0} aria-label={t('Previous section')}><ChevronLeft className="size-4 rtl:rotate-180" aria-hidden="true"/><span className="hidden xl:inline">{t('Previous')}</span></Button> : null}
          {stepped && !isLast ? <Button variant={settings.layout === 'wizard' ? 'primary' : 'secondary'} onClick={next} title={t('Next section: {title}', {title: t(sectionDef(SECTIONS[index + 1]!.id).title)})}>
            <span className="hidden sm:inline">{t('Next: {section}', {section: t(SECTIONS[index + 1]!.short)})}</span><span className="sm:hidden">{t('Next')}</span><ChevronRight className="size-4 rtl:rotate-180" aria-hidden="true"/>
          </Button> : null}
          <Button variant={settings.layout === 'wizard' && !isLast ? 'secondary' : 'primary'} onClick={() => void submit()} disabled={saving} aria-busy={saving || undefined} title={saveHint ? t('Save') + saveHint : undefined}>
            <Save className="size-4" aria-hidden="true"/>{t(saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save patient')}
          </Button>
        </div>
      </div>
    </div>
    <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} values={values} errors={allErrors} lookups={lookups} progress={progress} onJump={(section, field) => goTo(section, field)} onRevealAll={() => setRevealAll(true)}/>
  </FormProvider>;
}
