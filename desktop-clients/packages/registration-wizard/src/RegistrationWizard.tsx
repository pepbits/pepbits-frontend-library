"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "./cn";
import { codesOf, useList } from "./lists";
import {
  DEFAULT_DRAFT_KEY,
  STEPS,
  emptyRegistration,
  humanizeCode,
  hydrateDraft,
  newId,
  readHostError,
  resolveFieldPath,
  suggestSlug,
  toSubmission,
  validateStep,
  visibleSteps,
  type Errors,
  type StepId,
  type ValidationContext,
} from "./registration";
import { CodeStage } from "./stages/CodeStage";
import { DocumentsStage } from "./stages/DocumentsStage";
import type { StepProps, WizardLists } from "./step-types";
import { Stepper } from "./Stepper";
import { StepDetails } from "./steps/StepDetails";
import { StepFacilities } from "./steps/StepFacilities";
import { StepOrganisation } from "./steps/StepOrganisation";
import { StepReview } from "./steps/StepReview";
import { StepScope } from "./steps/StepScope";
import { StepWorkspace } from "./steps/StepWorkspace";
import { SuccessScreen } from "./SuccessScreen";
import type {
  Receipt,
  RegistrationBrand,
  RegistrationData,
  RegistrationHost,
  RegistrationHostError,
  RegistrationPrefill,
} from "./types";
import { Button } from "./ui/Button";

export interface RegistrationWizardProps {
  host: RegistrationHost;
  /** Applied only when no draft is restored. Unknown facility type codes are dropped once the list loads. */
  initial?: RegistrationPrefill;
  /** Seconds before the email code can be resent. Default 30. */
  resendDelaySeconds?: number;
  className?: string;
}

/** Only form fields are stored: never codes, tokens, sessions, uploads or stage state. */
interface StoredDraft {
  data?: unknown;
  stepId?: StepId;
  completed?: StepId[];
  reached?: StepId[];
  savedAt?: number;
}

type Phase = "editing" | "code" | "documents" | "submitting" | "done";

interface ServerError {
  message: string;
  /** Field value when the error arrived; the error is shown until the value changes. */
  value: string;
}

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => ReactNode> = {
  organisation: StepOrganisation,
  details: StepDetails,
  facilities: StepFacilities,
  scope: StepScope,
  workspace: StepWorkspace,
  review: StepReview,
};

function valueAt(data: RegistrationData, key: string): string {
  let cur: unknown = data;
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[part];
  }
  return JSON.stringify(cur ?? "");
}

const timeFormat = () => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return null;
  }
};

export function RegistrationWizard({ host, initial, resendDelaySeconds = 30, className }: RegistrationWizardProps) {
  const draftKey = host.draftKey || DEFAULT_DRAFT_KEY;
  const [data, setData] = useState<RegistrationData>(emptyRegistration);
  const [stepId, setStepId] = useState<StepId>("organisation");
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());
  const [reached, setReached] = useState<Set<StepId>>(new Set(["organisation"]));
  const [errors, setErrors] = useState<Errors>({});
  const [serverErrors, setServerErrors] = useState<Record<string, ServerError>>({});
  const [shake, setShake] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>("editing");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [focusTick, setFocusTick] = useState(0);
  const recommendationApplied = useRef(false);

  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /* ---------------- Host lists ---------------- */
  const L = host.lists;
  const country = data.profile.country;
  const state = data.profile.state;
  const lists: WizardLists = {
    facilityTypes: useList("facilityTypes", () => L.facilityTypes()),
    careSettings: useList("careSettings", () => L.careSettings()),
    specialties: useList("specialties", () => L.specialties()),
    administratorRoles: useList("administratorRoles", () => L.administratorRoles()),
    countries: useList("countries", () => L.countries()),
    states: useList(country ? `states:${country}` : null, () => L.states(country)),
    districts: useList(country && state ? `districts:${country}:${state}` : null, () => L.districts(country, state)),
    timeZones: useList(country ? `timeZones:${country}` : null, () => L.timeZones(country)),
    currencies: useList(country ? `currencies:${country}` : null, () => L.currencies(country)),
    offers: useList(country ? `offers:${country}` : null, () => L.offers(country)),
  };
  const ready = <T,>(l: { status: string; items: T[] }) => l.status === "ready";

  const ctx: ValidationContext = {
    facilityTypes: ready(lists.facilityTypes) ? codesOf(lists.facilityTypes.items) : undefined,
    states: country && ready(lists.states) ? codesOf(lists.states.items) : undefined,
    districts: state && ready(lists.districts) ? codesOf(lists.districts.items) : undefined,
    timeZones: country && ready(lists.timeZones) ? codesOf(lists.timeZones.items) : [],
    currencies: country && ready(lists.currencies) ? codesOf(lists.currencies.items) : [],
    offers: country && ready(lists.offers) ? lists.offers.items.map((o) => o.id) : [],
    administratorRoles: ready(lists.administratorRoles) ? codesOf(lists.administratorRoles.items) : undefined,
    callingCode: lists.countries.items.find((c) => c.code === country)?.callingCode,
  };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const offer = lists.offers.items.find((o) => o.id === data.workspace.offerId);

  /* ---------------- Keep dependent fields consistent with loaded lists ---------------- */
  const tz = lists.timeZones;
  useEffect(() => {
    if (tz.status !== "ready") return;
    const codes = codesOf(tz.items);
    setData((d) => {
      const cur = d.profile.timeZone;
      const next = codes.length === 1 ? codes[0]! : cur && !codes.includes(cur) ? "" : cur;
      return next === cur ? d : { ...d, profile: { ...d.profile, timeZone: next } };
    });
  }, [tz.status, tz.items]);

  const cur = lists.currencies;
  useEffect(() => {
    if (cur.status !== "ready") return;
    setData((d) => {
      const value = d.profile.currency;
      if (value && cur.items.some((c) => c.code === value)) return d;
      const next = cur.items.find((c) => c.primary)?.code ?? (cur.items.length === 1 ? cur.items[0]!.code : "");
      return next === value ? d : { ...d, profile: { ...d.profile, currency: next } };
    });
  }, [cur.status, cur.items]);

  const st = lists.states;
  useEffect(() => {
    if (st.status !== "ready") return;
    setData((d) =>
      d.profile.state && !st.items.some((s) => s.code === d.profile.state)
        ? { ...d, profile: { ...d.profile, state: "", district: "" } }
        : d,
    );
  }, [st.status, st.items]);

  const di = lists.districts;
  useEffect(() => {
    if (di.status !== "ready") return;
    setData((d) =>
      d.profile.district && !di.items.some((s) => s.code === d.profile.district)
        ? { ...d, profile: { ...d.profile, district: "" } }
        : d,
    );
  }, [di.status, di.items]);

  const of = lists.offers;
  useEffect(() => {
    if (of.status !== "ready") return;
    setData((d) =>
      d.workspace.offerId && !of.items.some((o) => o.id === d.workspace.offerId)
        ? { ...d, workspace: { ...d.workspace, offerId: "" }, agreements: { ...d.agreements, terms: false } }
        : d,
    );
  }, [of.status, of.items]);

  // Drop codes the host no longer offers (from an older draft or a prefill).
  const ft = lists.facilityTypes;
  const cs = lists.careSettings;
  const sp = lists.specialties;
  const ar = lists.administratorRoles;
  useEffect(() => {
    if (ft.status === "ready") prune("facilityTypes", codesOf(ft.items));
  }, [ft.status, ft.items]);
  useEffect(() => {
    if (cs.status === "ready") prune("careSettings", codesOf(cs.items));
  }, [cs.status, cs.items]);
  useEffect(() => {
    if (sp.status === "ready") prune("specialties", codesOf(sp.items));
  }, [sp.status, sp.items]);
  useEffect(() => {
    if (ar.status !== "ready") return;
    setData((d) =>
      d.administrator.role && !ar.items.some((r) => r.code === d.administrator.role)
        ? { ...d, administrator: { ...d.administrator, role: "" } }
        : d,
    );
  }, [ar.status, ar.items]);

  function prune(key: "facilityTypes" | "careSettings" | "specialties", allowed: string[]) {
    setData((d) => {
      const kept = d[key].filter((c) => allowed.includes(c));
      return kept.length === d[key].length ? d : { ...d, [key]: kept };
    });
  }

  /* ---------------- Steps ---------------- */
  const steps = useMemo(() => visibleSteps(data), [data.structure]); // eslint-disable-line react-hooks/exhaustive-deps
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index]!;
  const isLast = index === steps.length - 1;
  const needsDocuments = !!offer && offer.documents.length > 0;
  const units = steps.length + 1 + (needsDocuments ? 1 : 0);
  const position =
    phase === "done"
      ? units
      : phase === "code"
        ? steps.length
        : phase === "documents" || phase === "submitting"
          ? steps.length + (needsDocuments ? 1 : 0)
          : index + (completed.has(stepId) ? 1 : 0);
  const progress = position / units;

  /* ---------------- Restore draft or apply prefill ---------------- */
  useEffect(() => {
    let restored = false;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as StoredDraft;
        const d = hydrateDraft(draft.data);
        restored = !!(d.structure || d.facilityTypes.length || d.profile.legalName);
        if (restored) {
          setData(d);
          const valid = (id: unknown): id is StepId => STEPS.some((s) => s.id === id);
          setStepId(valid(draft.stepId) && visibleSteps(d).some((s) => s.id === draft.stepId) ? draft.stepId : "organisation");
          setCompleted(new Set((draft.completed ?? []).filter(valid)));
          setReached(new Set(["organisation", ...(draft.reached ?? []).filter(valid)]));
          setSavedAt(typeof draft.savedAt === "number" ? draft.savedAt : null);
          setNotice("We restored your draft from this device.");
        }
      }
    } catch {
      /* corrupt or blocked storage: start fresh */
    }
    if (!restored && initial) {
      setData((d) => ({
        ...d,
        structure: initial.structure === "SINGLE" || initial.structure === "NETWORK" ? initial.structure : d.structure,
        facilityTypes: Array.isArray(initial.facilityTypes) ? initial.facilityTypes.filter((c) => typeof c === "string") : d.facilityTypes,
      }));
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Autosave form fields only ---------------- */
  useEffect(() => {
    if (!hydrated || phase !== "editing") return;
    // Don't save an untouched form
    if (stepId === "organisation" && JSON.stringify(data) === JSON.stringify(emptyRegistration)) return;
    const t = setTimeout(() => {
      try {
        const now = Date.now();
        const draft: StoredDraft = {
          data: hydrateDraft(data),
          stepId,
          completed: Array.from(completed),
          reached: Array.from(reached),
          savedAt: now,
        };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
        setSavedAt(now);
      } catch {
        /* storage full or blocked */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [data, stepId, completed, reached, hydrated, phase, draftKey]);

  /* ---------------- Clear client errors as they get fixed ---------------- */
  useEffect(() => {
    setErrors((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const now = validateStep(stepId, data, ctxRef.current);
      const next: Errors = {};
      keys.forEach((k) => {
        if (now[k]) next[k] = now[k]!;
      });
      return Object.keys(next).length === keys.length ? prev : next;
    });
  }, [data, stepId]);

  // Host field errors stay until the person changes that field.
  const visibleErrors: Errors = { ...errors };
  for (const [key, e] of Object.entries(serverErrors)) if (valueAt(data, key) === e.value) visibleErrors[key] = e.message;

  /* ---------------- Move focus and scroll on step change ---------------- */
  useEffect(() => {
    if (focusTick === 0) return;
    scrollRef.current?.scrollTo?.({ top: 0 });
    if (typeof window.scrollTo === "function") {
      try {
        window.scrollTo({ top: 0 });
      } catch {
        /* not implemented (tests) */
      }
    }
    const id = requestAnimationFrame(() => {
      const auto = formRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (auto ?? headingRef.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [focusTick]);

  /* ---------------- Smart defaults when entering a step ---------------- */
  function prepare(id: StepId) {
    let note: string | null = null;
    const d = data;
    let next = d;
    if (id === "facilities" && d.facilities.length === 0) {
      next = {
        ...d,
        facilities: [
          { id: newId(), name: d.profile.displayName || d.profile.legalName, type: d.facilityTypes[0] ?? "", city: d.profile.city, beds: "" },
          { id: newId(), name: "", type: d.facilityTypes[1] ?? d.facilityTypes[0] ?? "", city: d.profile.city, beds: "" },
        ],
      };
      note = "We started your list with your head office. Rename it and add the rest of your facilities.";
    }
    if (id === "scope" && d.careSettings.length === 0 && host.recommendedCareSettings && !recommendationApplied.current && ready(lists.careSettings)) {
      const allowed = codesOf(lists.careSettings.items);
      const rec = Array.from(new Set(host.recommendedCareSettings(d.facilityTypes))).filter((c) => allowed.includes(c));
      recommendationApplied.current = true;
      if (rec.length) {
        next = { ...d, careSettings: rec };
        note = `We pre-selected ${rec.length} care ${rec.length === 1 ? "setting" : "settings"} that match your facility types. Change anything.`;
      }
    }
    if (id === "workspace" && !d.workspace.slug) {
      const slug = suggestSlug(d);
      if (slug) next = { ...d, workspace: { ...d.workspace, slug } };
    }
    if (next !== d) setData(next);
    setNotice(note);
  }

  function goTo(id: StepId) {
    prepare(id);
    setStepId(id);
    setReached((r) => new Set(r).add(id));
    setErrors({});
    setSubmitError(null);
    setPhase("editing");
    setFocusTick((t) => t + 1);
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      el?.focus({ preventScroll: true });
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    });
  }

  function fail(errs: Errors) {
    setErrors(errs);
    setShake((k) => k + 1);
    focusFirstInvalid();
  }

  function validateCurrent(): boolean {
    const errs = validateStep(stepId, data, ctx);
    if (Object.keys(errs).length) {
      fail(errs);
      return false;
    }
    setCompleted((c) => new Set(c).add(stepId));
    return true;
  }

  function onJump(id: StepId) {
    const target = steps.findIndex((s) => s.id === id);
    if (target === index && phase === "editing") return;
    if (phase === "editing" && target > index && !validateCurrent()) return;
    goTo(id);
  }

  /** Show a host error next to its field and open that field's step. False when the path is unknown. */
  const showFieldError = useCallback(
    (e: RegistrationHostError): boolean => {
      const target = e.field ? resolveFieldPath(e.field) : null;
      if (!target) return false;
      const stepVisible = visibleSteps(data).some((s) => s.id === target.step);
      const destination = stepVisible ? target.step : "review";
      prepare(destination);
      setStepId(destination);
      setReached((r) => new Set(r).add(destination));
      setPhase("editing");
      setErrors({});
      setSubmitError(stepVisible ? null : e.message);
      setServerErrors((s) => ({ ...s, [target.key]: { message: e.message, value: valueAt(data, target.key) } }));
      setNotice(null);
      setShake((k) => k + 1);
      setFocusTick((t) => t + 1);
      focusFirstInvalid();
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const email = data.administrator.email.trim().toLowerCase();

  async function submitNow() {
    setPhase("submitting");
    setSubmitError(null);
    try {
      const result = await host.submit(toSubmission(data, offer, host.agreements));
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setReceipt(result);
      setCompleted(new Set(steps.map((s) => s.id)));
      setServerErrors({});
      setPhase("done");
    } catch (err) {
      const e = readHostError(err, "We couldn't submit your registration. Check your connection and try again.");
      if (e.field && showFieldError(e)) return;
      if (needsDocuments) {
        setPhase("documents");
        setSubmitError(e.message);
      } else {
        setPhase("editing");
        setStepId("review");
        setSubmitError(e.message);
        setShake((k) => k + 1);
      }
    }
  }

  function afterVerified() {
    setVerifiedEmail(email);
    if (needsDocuments && !offer!.documents.every((t) => uploaded[t])) {
      setSubmitError(null);
      setPhase("documents");
    } else void submitNow();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase !== "editing") return;
    if (!validateCurrent()) return;
    if (!isLast) return goTo(steps[index + 1]!.id);

    // Final check across every step before sending
    for (const s of steps) {
      const errs = validateStep(s.id, data, ctx);
      if (Object.keys(errs).length) {
        goTo(s.id);
        setNotice(`Some details in ${s.title.toLowerCase()} need attention before you can submit.`);
        setTimeout(() => fail(errs), 60);
        return;
      }
    }

    setSubmitError(null);
    if (verifiedEmail !== email) setPhase("code");
    else afterVerified();
  }

  const StepComponent = STEP_COMPONENTS[step.id];
  const errorCount = Object.keys(visibleErrors).length;
  const fmt = useMemo(timeFormat, []);
  const savedLabel = savedAt && fmt ? `Draft saved at ${fmt.format(new Date(savedAt))}` : null;
  const stepProps: StepProps = { data, errors: visibleErrors, setData, onJump, lists, host };
  const editing = phase === "editing";
  const statusLabel =
    phase === "done"
      ? "Registration complete"
      : phase === "code"
        ? "Confirm your email"
        : phase === "documents" || phase === "submitting"
          ? needsDocuments
            ? "Upload documents"
            : "Submitting"
          : (savedLabel ?? "Your progress saves on this device");

  return (
    <div className={cn("pb-registration flex min-h-dvh w-full flex-col bg-paper font-sans text-ink-900 antialiased lg:h-dvh lg:flex-row", className)}>
      {/* ---------------- Brand rail with stepper (desktop) ---------------- */}
      <aside className="relative hidden w-[19.5rem] shrink-0 overflow-hidden bg-scrub-900 text-white lg:flex xl:w-[22rem] 2xl:w-[25rem]">
        <div className="bg-chart-grid absolute inset-0" aria-hidden="true" />
        <div className="scrollbar-none relative flex h-full w-full flex-col overflow-y-auto p-6 xl:p-8">
          <BrandMark brand={host.brand} tone="light" />
          <div className="mt-9 px-3">
            <p className="font-display text-[1.65rem] font-semibold leading-[1.1] tracking-[-0.02em]">Register your organisation</p>
            <p className="mt-2 text-sm leading-relaxed text-scrub-200">About 10 minutes. Progress saves on this device as you go.</p>
          </div>
          <div className="mt-8">
            <Stepper
              steps={steps}
              current={editing ? stepId : ""}
              completed={phase === "editing" ? completed : new Set(steps.map((s) => s.id))}
              reachable={editing ? reached : new Set()}
              onJump={onJump}
            />
          </div>
          {host.brand.supportEmail && (
            <p className="mt-auto px-3 pt-8 text-[0.8rem] leading-relaxed text-scrub-300">
              Questions about registering?{" "}
              <a href={`mailto:${host.brand.supportEmail}`} className="font-semibold text-mint underline-offset-2 hover:underline">
                {host.brand.supportEmail}
              </a>
            </p>
          )}
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-h-dvh flex-1 flex-col lg:min-h-0">
        <header className="pt-safe sticky top-0 z-20 shrink-0 border-b border-ink-100 bg-paper/90 backdrop-blur-md lg:static lg:bg-paper">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10 2xl:px-16">
            <div className="lg:hidden">
              <BrandMark brand={host.brand} tone="dark" />
            </div>
            <p className="hidden text-sm text-ink-500 lg:block" aria-live="polite">
              {statusLabel}
            </p>
            <div className="flex items-center gap-2">
              {editing && (
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-700 lg:hidden">
                  {index + 1} of {steps.length}
                </span>
              )}
              {phase !== "done" && host.brand.homeHref && (
                <a
                  href={host.brand.homeHref}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900"
                >
                  Save and exit
                </a>
              )}
            </div>
          </div>
          <div
            className="h-1 w-full bg-ink-100"
            role="progressbar"
            aria-label="Registration progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={editing ? `Step ${index + 1} of ${steps.length}` : statusLabel}
          >
            <div
              className="h-full origin-left bg-scrub-600 transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${Math.max(progress, 0.02)})` }}
            />
          </div>
        </header>

        <div ref={scrollRef} className="scrollbar-thin flex flex-1 flex-col lg:overflow-y-auto">
          {phase === "done" && receipt ? (
            <div className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10 2xl:px-16">
              <SuccessScreen
                slug={data.workspace.slug}
                domain={host.workspaceDomain}
                reference={receipt.reference}
                message={receipt.message}
                homeHref={host.brand.homeHref}
              />
            </div>
          ) : phase === "code" ? (
            <div className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10 2xl:px-16">
              <CodeStage
                email={email}
                requestCode={(m) => host.requestCode(m)}
                verifyCode={(m, c) => host.verifyCode(m, c)}
                resendDelaySeconds={resendDelaySeconds}
                onVerified={afterVerified}
                onBack={() => goTo("review")}
                onChangeEmail={() => goTo("workspace")}
                onFieldError={showFieldError}
              />
            </div>
          ) : (phase === "documents" || phase === "submitting") && needsDocuments ? (
            <div className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10 2xl:px-16">
              <DocumentsStage
                documents={offer!.documents}
                labelFor={(t) => host.documentTypeLabel?.(t) ?? humanizeCode(t)}
                uploadDocument={(t, f) => host.uploadDocument(t, f)}
                uploaded={uploaded}
                onUploaded={(t, name) => setUploaded((u) => ({ ...u, [t]: name }))}
                onSubmit={() => void submitNow()}
                submitting={phase === "submitting"}
                submitError={submitError}
                onBack={() => goTo("review")}
              />
            </div>
          ) : (
            <form
              id="pb-registration-form"
              ref={formRef}
              onSubmit={onSubmit}
              noValidate
              className="w-full flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9 2xl:px-16"
            >
              <fieldset disabled={phase === "submitting"} className="mx-auto w-full max-w-[76rem]">
                <div key={step.id} className="animate-step-in">
                  <p className="text-sm font-medium text-scrub-700">
                    Step {index + 1} of {steps.length}
                  </p>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-1 font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 focus:outline-none sm:text-[2.5rem]"
                  >
                    {step.title}
                  </h1>
                  <p className="mt-2.5 max-w-[68ch] leading-relaxed text-ink-600">{step.intro}</p>

                  {notice && (
                    <div className="mt-5 flex animate-fade-up items-start gap-3 rounded-2xl border border-scrub-200 bg-scrub-50 px-4 py-3 text-sm text-scrub-900">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-scrub-600" aria-hidden="true" />
                      <p className="flex-1 leading-relaxed">{notice}</p>
                      <button
                        type="button"
                        onClick={() => setNotice(null)}
                        className="-m-1 grid h-7 w-7 place-items-center rounded-lg text-scrub-700 hover:bg-scrub-100"
                        aria-label="Dismiss"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {(errorCount > 0 || submitError) && (
                    <div
                      key={shake}
                      role="alert"
                      className="mt-5 flex animate-shake items-start gap-3 rounded-2xl border border-signal/25 bg-[#FFF5F5] px-4 py-3 text-sm text-signal"
                    >
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p className="leading-relaxed">
                        {submitError ??
                          (errorCount === 1
                            ? "1 item needs your attention before you continue."
                            : `${errorCount} items need your attention before you continue.`)}
                      </p>
                    </div>
                  )}

                  <div className="mt-8">
                    <StepComponent {...stepProps} />
                  </div>
                </div>
              </fieldset>
            </form>
          )}
        </div>

        {(editing || (phase === "submitting" && !needsDocuments)) && (
          <footer className="pb-safe sticky bottom-0 z-20 shrink-0 border-t border-ink-100 bg-white/95 backdrop-blur-md lg:static">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10 2xl:px-16">
              <Button
                variant="ghost"
                onClick={() => goTo(steps[index - 1]!.id)}
                className={cn(index === 0 && "invisible")}
                disabled={index === 0 || !editing}
              >
                Back
              </Button>
              <div className="flex min-w-0 items-center gap-4">
                {!isLast && <span className="hidden truncate text-sm text-ink-500 md:block">Next: {steps[index + 1]!.title}</span>}
                {isLast && (
                  <span className="hidden items-center gap-1.5 text-sm text-ink-500 md:flex">
                    <CircleCheck className="h-4 w-4 text-scrub-600" aria-hidden="true" />
                    {steps.length - 1} of {steps.length} steps complete
                  </span>
                )}
                <Button
                  type="submit"
                  form="pb-registration-form"
                  size="lg"
                  loading={phase === "submitting"}
                  disabled={!editing}
                  className="min-w-[9.5rem]"
                >
                  {phase === "submitting" ? "Submitting" : isLast ? "Submit registration" : "Continue"}
                </Button>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function BrandMark({ brand, tone }: { brand: RegistrationBrand; tone: "light" | "dark" }) {
  const custom = typeof brand.logo === "function" ? brand.logo(tone) : brand.logo;
  const content = custom ?? (
    <span
      className={cn(
        "font-display text-[1.4rem] font-semibold tracking-[-0.02em]",
        tone === "light" ? "text-white" : "text-ink-900",
      )}
    >
      {brand.name}
    </span>
  );
  return brand.homeHref ? (
    <a href={brand.homeHref} className="inline-flex items-center gap-2.5 rounded-lg" aria-label={`${brand.name} home`}>
      {content}
    </a>
  ) : (
    <span className="inline-flex items-center gap-2.5">{content}</span>
  );
}
