'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, History, ListChecks, Save, UsersRound, X } from 'lucide-react';
import {
  FIELDS,
  NAME_PARTS,
  SECTIONS,
  completion,
  computeAge,
  deriveDisplayName,
  firstErrorField,
  optionsFor,
  sanitizeValues,
  sectionDef,
  sectionIndex,
  sectionOf,
  sectionProgress,
  todayISO,
  validateForm,
  visibleFields,
  type DuplicateCandidate,
  type FieldErrors,
  type FieldValue,
  type FormValues,
  type LayoutSettings,
  type Lookups,
  type MrnPreview,
  type SectionId,
  type SectionProgress,
} from '@allyvora/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { clock, SEX_SHORT } from '@/lib/format';
import { storage, useHotkey } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { PatientBand } from '@/components/patients/PatientBand';
import { FormProvider, focusField, scrollWithin, sectionDomId, type FormCtx } from './parts';
import { RulesDrawer } from './RulesDrawer';
import { AccordionLayout } from './layouts/AccordionLayout';
import { overall, type LayoutProps } from './layouts/nav';
import { ScrollLayout } from './layouts/ScrollLayout';
import { StepperLayout } from './layouts/StepperLayout';
import { TabsLayout } from './layouts/TabsLayout';
import { WizardLayout } from './layouts/WizardLayout';

export type SubmitResult = { ok: true } | { ok: false; errors?: FieldErrors };

export interface PatientFormProps {
  mode: 'new' | 'edit' | 'preview';
  initialValues: FormValues;
  settings: LayoutSettings;
  lookups: Lookups;
  identity?: { mrn?: string | null; orgNumber?: string | null; patientId?: number; branchName?: string };
  initialSection?: SectionId;
  onSubmit: (values: FormValues) => Promise<SubmitResult>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  draftKey?: string | null;
  className?: string;
}

const PIN_TARGETS: Record<string, Record<string, string>> = {
  pincode: { city: 'city', district: 'district', state: 'state' },
  permPincode: { city: 'permCity', state: 'permState' },
};

const LAYOUTS = {
  scroll: ScrollLayout,
  tabs: TabsLayout,
  wizard: WizardLayout,
  stepper: StepperLayout,
  accordion: AccordionLayout,
} as const;

function Notice({ tone, icon, children, actions, onDismiss }: { tone: 'info' | 'warn' | 'danger'; icon: ReactNode; children: ReactNode; actions?: ReactNode; onDismiss?: () => void }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex shrink-0 animate-field-in flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 text-[13.5px]',
        tone === 'info' && 'border-brand/25 bg-brand-soft/60',
        tone === 'warn' && 'border-accent/40 bg-accent-soft',
        tone === 'danger' && 'border-danger/30 bg-danger-soft',
      )}
    >
      <span className={cn('shrink-0', tone === 'info' && 'text-brand', tone === 'warn' && 'text-accent-ink', tone === 'danger' && 'text-danger')}>{icon}</span>
      <div className="min-w-0 flex-1 text-ink">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="rounded p-1 text-ink-3 hover:bg-black/5 hover:text-ink">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

export function PatientForm(props: PatientFormProps) {
  const { mode, settings, lookups, identity, draftKey } = props;
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
  const [dupDismissed, setDupDismissed] = useState<string>('');
  const [draftOffer, setDraftOffer] = useState<{ values: FormValues; savedAt: string } | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const manualName = useRef(
    typeof props.initialValues.displayName === 'string' &&
      props.initialValues.displayName !== '' &&
      props.initialValues.displayName !== deriveDisplayName(props.initialValues, lookups),
  );
  const autoFilled = useRef<Record<string, string>>({});
  const initialJson = useMemo(() => JSON.stringify(sanitizeValues(props.initialValues)), [props.initialValues]);
  const locked = useMemo(() => new Set(mode === 'edit' ? ['branchId'] : []), [mode]);

  /* ---------------- validation state ---------------- */

  const allErrors = useMemo(() => ({ ...validateForm(values, today), ...serverErrors }), [values, today, serverErrors]);
  const shownErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const [k, msg] of Object.entries(allErrors)) {
      const sec = sectionOf(k);
      if (revealAll || (sec && revealed.has(sec)) || serverErrors[k] || (settings.validateOn !== 'submit' && touched.has(k))) out[k] = msg;
    }
    return out;
  }, [allErrors, revealAll, revealed, serverErrors, settings.validateOn, touched]);

  const progress = useMemo(
    () => Object.fromEntries(SECTIONS.map((s) => [s.id, sectionProgress(s.id, values, allErrors, shownErrors)])) as Record<SectionId, SectionProgress>,
    [values, allErrors, shownErrors],
  );
  const pct = useMemo(() => completion(values, today), [values, today]);
  const dirty = useMemo(() => JSON.stringify(sanitizeValues(values)) !== initialJson, [values, initialJson]);

  useEffect(() => props.onDirtyChange?.(dirty), [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- edits ---------------- */

  const setValue = useCallback(
    (id: string, v: FieldValue) => {
      if (locked.has(id)) return;
      setValues((prev) => {
        const next: FormValues = { ...prev, [id]: v };
        if (id === 'displayName') manualName.current = typeof v === 'string' && v.trim() !== '' && v !== deriveDisplayName(next, lookups);
        else if (NAME_PARTS.includes(id) && !manualName.current) next.displayName = deriveDisplayName(next, lookups);
        // Clear dependent choices that no longer fit (consultant after department changes).
        for (const f of FIELDS) {
          if (f.lookupParent === id && next[f.id] && !optionsFor(f, next, lookups).some((o) => o.code === next[f.id])) next[f.id] = null;
        }
        return next;
      });
      setServerErrors((e) => {
        if (!(id in e)) return e;
        const { [id]: _, ...rest } = e;
        return rest;
      });
      if (settings.validateOn === 'change') setTouched((t) => (t.has(id) ? t : new Set(t).add(id)));
      setDraftOffer(null);
    },
    [locked, lookups, settings.validateOn],
  );

  const blur = useCallback(
    (id: string) => {
      if (settings.validateOn === 'submit') return;
      setTouched((t) => (t.has(id) ? t : new Set(t).add(id)));
    },
    [settings.validateOn],
  );

  /* ---------------- PIN code lookup ---------------- */

  const runPin = (field: string, pin: FieldValue) => {
    if (typeof pin !== 'string' || !/^[1-9][0-9]{5}$/.test(pin)) {
      setPinHints((h) => (h[field] ? { ...h, [field]: '' } : h));
      return;
    }
    let live = true;
    api
      .pincode(pin)
      .then((r) => {
        if (!live) return;
        const map = PIN_TARGETS[field]!;
        setValues((prev) => {
          const next = { ...prev };
          for (const [src, dest] of Object.entries(map)) {
            const val = r[src as keyof typeof r];
            const cur = prev[dest];
            if (!cur || cur === autoFilled.current[dest]) {
              next[dest] = val;
              autoFilled.current[dest] = val;
            }
          }
          return next;
        });
        setPinHints((h) => ({ ...h, [field]: `${r.city}, ${r.district}, filled in` }));
      })
      .catch(() => live && setPinHints((h) => ({ ...h, [field]: 'Not in the PIN directory. Enter city and state yourself.' })));
    return () => {
      live = false;
    };
  };
  useEffect(() => runPin('pincode', values.pincode), [values.pincode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => runPin('permPincode', values.permPincode), [values.permPincode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- MRN preview ---------------- */

  useEffect(() => {
    if (mode === 'edit' || !values.branchId) {
      setMrnPreview(null);
      return;
    }
    let live = true;
    api
      .mrnPreview(Number(values.branchId))
      .then((p) => live && setMrnPreview(p))
      .catch(() => live && setMrnPreview(null));
    return () => {
      live = false;
    };
  }, [mode, values.branchId]);

  /* ---------------- duplicate detection ---------------- */

  const dupKey = mode === 'new' ? [values.givenName, values.familyName, values.dateOfBirth, values.mobile].map((v) => String(v ?? '').trim().toLowerCase()).join('|') : '';
  useEffect(() => {
    if (!dupKey) return;
    const given = String(values.givenName ?? '').trim();
    const mobile = String(values.mobile ?? '');
    const enough = /^[6-9][0-9]{9}$/.test(mobile) || (given.length >= 2 && (values.familyName || values.dateOfBirth));
    if (!enough) {
      setDuplicates([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      api.patients
        .duplicates({
          givenName: given,
          familyName: (values.familyName as string) || undefined,
          dateOfBirth: (values.dateOfBirth as string) || undefined,
          mobile: /^[6-9][0-9]{9}$/.test(mobile) ? mobile : undefined,
        })
        .then((d) => live && setDuplicates(d))
        .catch(() => {});
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [dupKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dupSignature = duplicates.map((d) => d.id).join(',');

  /* ---------------- drafts ---------------- */

  const draftsOn = !!draftKey && settings.autosaveDraft && mode === 'new';
  useEffect(() => {
    if (!draftsOn) return;
    const d = storage.get<{ values: FormValues; savedAt: string }>(draftKey!);
    if (d && JSON.stringify(sanitizeValues(d.values)) !== initialJson) setDraftOffer(d);
  }, [draftsOn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!draftsOn || draftOffer) return;
    const t = setTimeout(() => {
      if (dirty) {
        const savedAt = new Date().toISOString();
        storage.set(draftKey!, { values, savedAt });
        setDraftSavedAt(savedAt);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [values, dirty, draftsOn, draftOffer, draftKey]);

  /* ---------------- navigation ---------------- */

  const goTo = useCallback(
    (s: SectionId, fieldId?: string) => {
      setActive(s);
      setTimeout(
        () => {
          if (fieldId) focusField(uid, fieldId);
          else if (settings.layout === 'scroll') {
            const node = document.getElementById(sectionDomId(uid, s));
            if (node) scrollWithin(node, 'start');
          }
        },
        settings.layout === 'scroll' ? 20 : 80,
      );
    },
    [settings.layout, uid],
  );

  const select = useCallback(
    (s: SectionId) => {
      if (s === active) {
        if (settings.layout === 'scroll') goTo(s);
        return;
      }
      const p = progress[active];
      if (settings.layout !== 'scroll' && p.filled > 0 && p.state !== 'complete') setRevealed((r) => new Set(r).add(active));
      goTo(s);
    },
    [active, goTo, progress, settings.layout],
  );

  const idx = sectionIndex(active);
  const isLast = idx === SECTIONS.length - 1;

  const next = useCallback(() => {
    const problems = visibleFields(active, values).filter((f) => allErrors[f.id]);
    setRevealed((r) => new Set(r).add(active));
    if (settings.layout === 'wizard' && problems.length) {
      setTimeout(() => focusField(uid, problems[0]!.id), 30);
      return;
    }
    if (!isLast) goTo(SECTIONS[idx + 1]!.id);
  }, [active, values, allErrors, settings.layout, isLast, goTo, idx, uid]);

  const prev = useCallback(() => {
    if (idx > 0) goTo(SECTIONS[idx - 1]!.id);
  }, [idx, goTo]);

  /* ---------------- submit ---------------- */

  const submit = useCallback(async () => {
    if (saving) return;
    setRevealAll(true);
    const errs = validateForm(values, today);
    const first = firstErrorField(errs);
    if (first) {
      goTo(sectionOf(first)!, first);
      return;
    }
    setSaving(true);
    try {
      const res = await props.onSubmit(sanitizeValues(values));
      if (res.ok) {
        if (draftKey) storage.remove(draftKey);
      } else if (res.errors) {
        setServerErrors(res.errors);
        const f = firstErrorField(res.errors);
        if (f) goTo(sectionOf(f)!, f);
      }
    } finally {
      setSaving(false);
    }
  }, [saving, values, today, goTo, props, draftKey]);

  useHotkey('mod+s', (e) => {
    e.preventDefault();
    void submit();
  }, !preview);
  useHotkey('alt+arrowright', (e) => {
    e.preventDefault();
    next();
  }, !preview);
  useHotkey('alt+arrowleft', (e) => {
    e.preventDefault();
    prev();
  }, !preview);

  /* ---------------- context ---------------- */

  const ctx = useMemo<FormCtx>(
    () => ({
      uid,
      values,
      errors: shownErrors,
      lookups,
      density: settings.density,
      columns: settings.columns,
      setValue,
      blur,
      locked,
      readonlyText: (id) => {
        if (id === 'mrn') {
          if (identity?.mrn) return { text: identity.mrn, muted: false };
          return { text: mrnPreview ? `${mrnPreview.next} when saved` : 'Assigned when saved', muted: true };
        }
        if (id === 'orgNumber') return identity?.orgNumber ? { text: identity.orgNumber, muted: false } : { text: 'Assigned when saved', muted: true };
        return { text: String(values[id] ?? ''), muted: false };
      },
      hintFor: (id) => {
        switch (id) {
          case 'dateOfBirth':
          case 'birthYear':
          case 'estimatedAge': {
            const a = computeAge(values, today);
            if (a.years === null || shownErrors[id]) return null;
            if (id === 'estimatedAge') return `Born around ${Number(today.slice(0, 4)) - a.years}`;
            return a.label?.endsWith(' y') ? `${a.approximate ? 'About ' : ''}${a.years} years old` : `${a.label?.replace('~', '')} old`;
          }
          case 'pincode':
          case 'permPincode':
            return pinHints[id] || null;
          case 'branchId':
            if (mode === 'edit') return 'The registering branch can’t change after the MRN is assigned';
            return mrnPreview ? `Numbering rule ${mrnPreview.rule}` : null;
          case 'displayName':
            return manualName.current ? 'Edited by hand. Clear it to rebuild from the name fields.' : null;
          case 'consultant':
            return values.department ? null : 'Choose a department to narrow this list';
          default:
            return null;
        }
      },
      sectionNote: (s) => {
        if (s !== 'mrn') return null;
        if (mode === 'edit' && identity?.mrn)
          return (
            <>
              MRN <b className="tabular font-semibold">{identity.mrn}</b> was assigned by {identity.branchName ?? 'the registering branch'} and stays with this patient for life.
            </>
          );
        return 'The branch MRN is assigned when you save, using the selected branch’s numbering rule. Organisation numbers follow their own rule.';
      },
      progress,
    }),
    [uid, values, shownErrors, lookups, settings.density, settings.columns, setValue, blur, locked, identity, mrnPreview, today, pinHints, mode, progress],
  );

  /* ---------------- render ---------------- */

  const errorCount = Object.keys(shownErrors).length;
  const sectionsWithErrors = SECTIONS.filter((s) => progress[s.id].errorCount > 0);
  const { done } = overall(progress);
  const stepped = settings.layout === 'wizard' || settings.layout === 'stepper' || settings.layout === 'tabs';
  const Layout = LAYOUTS[settings.layout];
  const layoutProps: LayoutProps = {
    uid,
    active,
    onSelect: select,
    onActiveChange: setActive,
    progress,
    compact: settings.density === 'compact',
    onNext: next,
  };

  const visibleDupes = duplicates.length > 0 && dupDismissed !== dupSignature;

  return (
    <FormProvider value={ctx}>
      <div className={cn('flex h-full min-h-0 flex-col', settings.density === 'compact' ? 'gap-2' : 'gap-3', props.className)}>
        {settings.showSummary && (
          <PatientBand
            values={values}
            lookups={lookups}
            mrn={identity?.mrn}
            mrnPending={mrnPreview?.next}
            completion={pct}
            sectionsLabel={`${done} of ${SECTIONS.length} sections done`}
            className="shrink-0"
          />
        )}

        {draftOffer && (
          <Notice
            tone="info"
            icon={<History className="size-[18px]" />}
            actions={
              <>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setValues(draftOffer.values);
                    setDraftOffer(null);
                  }}
                >
                  Restore draft
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    storage.remove(draftKey!);
                    setDraftOffer(null);
                  }}
                >
                  Discard
                </Button>
              </>
            }
          >
            You have an unsaved registration from {clock(new Date(draftOffer.savedAt))}
            {draftOffer.values.displayName ? ` for ${draftOffer.values.displayName}` : ''}.
          </Notice>
        )}

        {visibleDupes && (
          <Notice tone="warn" icon={<UsersRound className="size-[18px]" />} onDismiss={() => setDupDismissed(dupSignature)}>
            <p className="font-medium">This may be a returning patient. Check before creating a new record.</p>
            <ul className="mt-1.5 space-y-1">
              {duplicates.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                  <Link href={`/patients?mode=view&id=${d.id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-accent/60 underline-offset-2 hover:decoration-accent">
                    {d.displayName}
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                  <span className="tabular text-ink-2">
                    {d.mrn}
                    {d.ageLabel ? `, ${d.ageLabel}` : ''}
                    {d.sex ? ` ${SEX_SHORT[d.sex]}` : ''}
                  </span>
                  <span className="text-accent-ink">{d.reasons.map((r, i) => (i ? r.charAt(0).toLowerCase() + r.slice(1) : r)).join(', ')}</span>
                </li>
              ))}
            </ul>
          </Notice>
        )}

        {revealAll && errorCount > 0 && (
          <Notice tone="danger" icon={<AlertTriangle className="size-[18px]" />}>
            <span className="font-medium">
              {errorCount} {errorCount === 1 ? 'field needs' : 'fields need'} attention.
            </span>{' '}
            <span className="inline-flex flex-wrap gap-1.5 align-middle">
              {sectionsWithErrors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const f = visibleFields(s.id, values).find((x) => shownErrors[x.id]);
                    goTo(s.id, f?.id);
                  }}
                  className="tabular rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-danger ring-1 ring-danger/30 hover:bg-danger hover:text-white"
                >
                  {s.short} ({progress[s.id].errorCount})
                </button>
              ))}
            </span>
          </Notice>
        )}

        <div className="min-h-0 flex-1">
          <Layout {...layoutProps} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-2.5 py-2 shadow-lift sm:px-3">
          <Button variant="ghost" onClick={props.onCancel} icon={<ArrowLeft className="size-4" />}>
            <span className="hidden sm:inline">{mode === 'edit' ? 'Cancel' : 'Back to patients'}</span>
          </Button>
          <span className="hidden text-xs text-ink-3 lg:inline" aria-live="polite">
            {preview
              ? 'Preview with sample data. Nothing is saved.'
              : draftsOn && draftSavedAt && dirty
                ? `Draft kept on this device at ${clock(new Date(draftSavedAt))}`
                : dirty
                  ? 'Unsaved changes'
                  : mode === 'edit'
                    ? 'No changes yet'
                    : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => setRulesOpen(true)} icon={<ListChecks className="size-4" />}>
              <span className="hidden md:inline">Check form rules</span>
              <span className="md:hidden">Rules</span>
            </Button>
            {stepped && (
              <Button variant="secondary" onClick={prev} disabled={idx === 0} icon={<ChevronLeft className="size-4" />} aria-label="Previous section">
                <span className="hidden xl:inline">Previous</span>
              </Button>
            )}
            {stepped && !isLast && (
              <Button variant={settings.layout === 'wizard' ? 'primary' : 'secondary'} onClick={next} aria-label={`Next section: ${sectionDef(SECTIONS[idx + 1]!.id).title}`}>
                <span className="hidden sm:inline">Next: {SECTIONS[idx + 1]!.short}</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            )}
            <Button
              variant={settings.layout === 'wizard' && !isLast ? 'secondary' : 'primary'}
              onClick={() => void submit()}
              loading={saving}
              icon={<Save className="size-4" />}
              kbd="⌘S"
            >
              {mode === 'edit' ? 'Save changes' : 'Save patient'}
            </Button>
          </div>
        </div>
      </div>

      <RulesDrawer
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        values={values}
        errors={allErrors}
        lookups={lookups}
        progress={progress}
        onJump={(s, f) => goTo(s, f)}
        onRevealAll={() => setRevealAll(true)}
      />
    </FormProvider>
  );
}
