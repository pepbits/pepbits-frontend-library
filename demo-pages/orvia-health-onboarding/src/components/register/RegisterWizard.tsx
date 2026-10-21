"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { submitRegistration } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import {
  INTEGRATIONS,
  country,
  facilityType,
  isFacilityType,
  recommendedCareSettings,
  recommendedModules,
  regionLabel,
} from "@/lib/catalog";
import { cn } from "@/lib/cn";
import {
  STEPS,
  hydrateDraft,
  initialData,
  newId,
  validateStep,
  visibleSteps,
  type Errors,
  type RegistrationData,
  type StepId,
} from "@/lib/registration";
import { addRegistered, isSlugTaken, slugify } from "@/lib/workspaces";
import { Stepper } from "./Stepper";
import { SuccessScreen } from "./SuccessScreen";
import { StepDetails } from "./steps/StepDetails";
import { StepFacilities } from "./steps/StepFacilities";
import { StepModules } from "./steps/StepModules";
import { StepOrganization } from "./steps/StepOrganization";
import { StepReview } from "./steps/StepReview";
import { StepScope } from "./steps/StepScope";
import { StepWorkspace } from "./steps/StepWorkspace";
import type { StepProps } from "./types";

const DRAFT_KEY = "orvia.registration.draft.v1";
const ctx = { isSlugTaken };

interface StoredDraft {
  data?: Partial<RegistrationData>;
  stepId?: StepId;
  completed?: StepId[];
  reached?: StepId[];
  savedAt?: number;
}

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactNode> = {
  organization: StepOrganization,
  details: StepDetails,
  facilities: StepFacilities,
  scope: StepScope,
  modules: StepModules,
  workspace: StepWorkspace,
  review: StepReview,
};

export function RegisterWizard() {
  const params = useSearchParams();
  const [data, setData] = useState<RegistrationData>(initialData);
  const [stepId, setStepId] = useState<StepId>("organization");
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());
  const [reached, setReached] = useState<Set<StepId>>(new Set(["organization"]));
  const [errors, setErrors] = useState<Errors>({});
  const [shake, setShake] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<"editing" | "submitting" | "done">("editing");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [focusTick, setFocusTick] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = useMemo(() => visibleSteps(data), [data]);
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step = steps[index]!;
  const isLast = index === steps.length - 1;
  const progress = status === "done" ? 1 : (index + (completed.has(stepId) ? 1 : 0)) / steps.length;

  /* ---------------- Restore draft or apply ?type= prefill ---------------- */
  useEffect(() => {
    let restored = false;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as StoredDraft;
        const d = hydrateDraft(draft.data);
        setData(d);
        const sid = draft.stepId && STEPS.some((s) => s.id === draft.stepId) ? draft.stepId : "organization";
        setStepId(sid);
        setCompleted(new Set(draft.completed ?? []));
        setReached(new Set(draft.reached ?? ["organization"]));
        setSavedAt(draft.savedAt ?? null);
        restored = !!(d.structure || d.facilityTypes.length || d.org.legalName);
        if (restored) {
          const pastWorkspace = STEPS.findIndex((s) => s.id === sid) >= STEPS.findIndex((s) => s.id === "workspace");
          setNotice(
            pastWorkspace
              ? "We restored your draft from this device. For security, re-enter the administrator password."
              : "We restored your draft from this device.",
          );
        }
      }
    } catch {
      /* corrupt or blocked storage: start fresh */
    }
    if (!restored) {
      const type = params.get("type");
      const structure = params.get("structure");
      setData((d) => ({
        ...d,
        facilityTypes: type && isFacilityType(type) ? [type] : d.facilityTypes,
        structure: structure === "network" ? "network" : d.structure,
      }));
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Autosave (never stores the password) ---------------- */
  useEffect(() => {
    if (!hydrated || status !== "editing") return;
    // Don't save an untouched form
    if (stepId === "organization" && JSON.stringify(data) === JSON.stringify(initialData)) return;
    const t = setTimeout(() => {
      try {
        const now = Date.now();
        const draft: StoredDraft = {
          data: { ...data, workspace: { ...data.workspace, password: "" } },
          stepId,
          completed: Array.from(completed),
          reached: Array.from(reached),
          savedAt: now,
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(now);
      } catch {
        /* storage full or blocked */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [data, stepId, completed, reached, hydrated, status]);

  /* ---------------- Clear errors as they get fixed ---------------- */
  useEffect(() => {
    setErrors((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const now = validateStep(stepId, data, ctx);
      const next: Errors = {};
      keys.forEach((k) => {
        if (now[k]) next[k] = now[k]!;
      });
      return next;
    });
  }, [data, stepId]);

  /* ---------------- Move focus and scroll on step change ---------------- */
  useEffect(() => {
    if (focusTick === 0) return;
    scrollRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
    const id = requestAnimationFrame(() => {
      const auto = formRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (auto ?? headingRef.current)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [focusTick]);

  /* ---------------- Smart defaults when entering a step ---------------- */
  function prepare(id: StepId) {
    let next = data;
    let note: string | null = null;
    const d = data;
    if (id === "facilities" && d.facilities.length === 0) {
      next = {
        ...d,
        facilities: [
          { id: newId(), name: d.org.displayName || d.org.legalName, type: d.facilityTypes[0] ?? "", city: d.org.city, beds: "" },
          { id: newId(), name: "", type: d.facilityTypes[1] ?? d.facilityTypes[0] ?? "", city: d.org.city, beds: "" },
        ],
      };
      note = "We started your list with your head office. Rename it and add the rest of your facilities.";
    }
    if (id === "scope" && d.careSettings.length === 0) {
      const rec = recommendedCareSettings(d.facilityTypes);
      if (rec.length) {
        next = { ...d, careSettings: rec };
        note = `We pre-selected ${rec.length} care settings that match your facility types.`;
      }
    }
    if (id === "modules" && d.modules.length === 0) {
      const mods = recommendedModules(d.facilityTypes, d.structure === "network");
      const local = INTEGRATIONS.filter((i) => i.countries.includes(d.org.country)).map((i) => i.id);
      next = { ...d, modules: mods, integrations: d.integrations.length ? d.integrations : local };
      note = `We suggested ${mods.length} modules${local.length ? ` and ${local.length} local integrations` : ""} for your organization. Adjust anything.`;
    }
    if (id === "workspace") {
      const ws = { ...d.workspace };
      if (!ws.slug) {
        let s = slugify(d.org.displayName || d.org.legalName);
        if (s && isSlugTaken(s)) s = slugify(`${s}-${d.org.city || "health"}`);
        ws.slug = s;
      }
      if (!ws.region) ws.region = country(d.org.country)?.region ?? "";
      if (ws.slug !== d.workspace.slug || ws.region !== d.workspace.region) next = { ...d, workspace: ws };
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
    setFocusTick((t) => t + 1);
  }

  function fail(errs: Errors) {
    setErrors(errs);
    setShake((k) => k + 1);
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
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
    if (target === index) return;
    if (target > index && !validateCurrent()) return;
    goTo(id);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status !== "editing") return;
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

    setStatus("submitting");
    setSubmitError(null);
    try {
      const receipt = await submitRegistration(data);
      const types = data.facilityTypes;
      addRegistered({
        slug: data.workspace.slug,
        name: data.org.displayName || data.org.legalName,
        kind: data.structure === "network" ? "Multi-facility network" : (facilityType(types[0] ?? "")?.label ?? "Healthcare provider"),
        region: regionLabel(data.workspace.region),
        facilities: data.structure === "network" ? data.facilities.length : 1,
        sso: false,
        status: "pending",
        domains: [data.workspace.adminEmail.split("@")[1]?.toLowerCase() ?? ""],
      });
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setReference(receipt.reference);
      setCompleted(new Set(steps.map((s) => s.id)));
      setStatus("done");
      setFocusTick((t) => t + 1);
    } catch (err) {
      setStatus("editing");
      setSubmitError(err instanceof Error ? err.message : "We couldn't submit your registration. Check your connection and try again.");
    }
  }

  const StepComponent = STEP_COMPONENTS[step.id];
  const errorCount = Object.keys(errors).length;
  const savedLabel = savedAt
    ? `Draft saved at ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : null;

  return (
    <div className="flex min-h-dvh w-full flex-col lg:h-dvh lg:flex-row">
      {/* ---------------- Brand rail with stepper (desktop) ---------------- */}
      <aside className="relative hidden w-[19.5rem] shrink-0 overflow-hidden bg-scrub-900 text-white lg:flex xl:w-[22rem] 2xl:w-[25rem]">
        <div className="bg-chart-grid absolute inset-0" aria-hidden="true" />
        <div className="scrollbar-none relative flex h-full w-full flex-col overflow-y-auto p-6 xl:p-8">
          <Logo tone="light" />
          <div className="mt-9 px-3">
            <p className="font-display text-[1.65rem] font-semibold leading-[1.1] tracking-[-0.02em]">Register your organization</p>
            <p className="mt-2 text-sm leading-relaxed text-scrub-200">
              About 10 minutes. Progress saves on this device as you go.
            </p>
          </div>
          <div className="mt-8">
            <Stepper
              steps={steps}
              current={status === "done" ? ("" as StepId) : stepId}
              completed={completed}
              reachable={status === "editing" ? reached : new Set()}
              onJump={onJump}
            />
          </div>
          <p className="mt-auto px-3 pt-8 text-[0.8rem] leading-relaxed text-scrub-300">
            Questions about registering?{" "}
            <a href={`mailto:${BRAND.supportEmail}`} className="font-semibold text-mint underline-offset-2 hover:underline">
              {BRAND.supportEmail}
            </a>
          </p>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-h-dvh flex-1 flex-col lg:min-h-0">
        <header className="pt-safe sticky top-0 z-20 shrink-0 border-b border-ink-100 bg-paper/90 backdrop-blur-md lg:static lg:bg-paper">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-10 2xl:px-16">
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="hidden text-sm text-ink-500 lg:block" aria-live="polite">
              {status === "done" ? "Registration complete" : savedLabel ?? "Your progress saves automatically"}
            </p>
            <div className="flex items-center gap-2">
              {status !== "done" && (
                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-700 lg:hidden">
                  {index + 1} of {steps.length}
                </span>
              )}
              {status !== "done" && (
                <Link
                  href="/"
                  className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100/70 hover:text-ink-900"
                >
                  Save and exit
                </Link>
              )}
            </div>
          </div>
          <div className="h-1 w-full bg-ink-100" role="progressbar" aria-label="Registration progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div
              className="h-full origin-left bg-scrub-600 transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${Math.max(progress, 0.02)})` }}
            />
          </div>
        </header>

        <div ref={scrollRef} className="scrollbar-thin flex flex-1 flex-col lg:overflow-y-auto">
          {status === "done" ? (
            <div className="flex flex-1 flex-col px-4 sm:px-6 lg:px-10 2xl:px-16">
              <SuccessScreen slug={data.workspace.slug} email={data.workspace.adminEmail} reference={reference} />
            </div>
          ) : (
            <form
              id="registration"
              ref={formRef}
              onSubmit={onSubmit}
              noValidate
              className="w-full flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9 2xl:px-16"
            >
              <fieldset disabled={status === "submitting"} className="mx-auto w-full max-w-[76rem]">
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
                    <StepComponent data={data} errors={errors} setData={setData} onJump={onJump} />
                  </div>
                </div>
              </fieldset>
            </form>
          )}
        </div>

        {status !== "done" && (
          <footer className="pb-safe sticky bottom-0 z-20 shrink-0 border-t border-ink-100 bg-white/95 backdrop-blur-md lg:static">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10 2xl:px-16">
              <Button
                variant="ghost"
                onClick={() => goTo(steps[index - 1]!.id)}
                className={cn(index === 0 && "invisible")}
                disabled={status !== "editing"}
              >
                Back
              </Button>
              <div className="flex min-w-0 items-center gap-4">
                {!isLast && (
                  <span className="hidden truncate text-sm text-ink-500 md:block">Next: {steps[index + 1]!.title}</span>
                )}
                {isLast && (
                  <span className="hidden items-center gap-1.5 text-sm text-ink-500 md:flex">
                    <CircleCheck className="h-4 w-4 text-scrub-600" aria-hidden="true" />
                    {steps.length - 1} of {steps.length} steps complete
                  </span>
                )}
                <Button type="submit" form="registration" size="lg" loading={status === "submitting"} className="min-w-[9.5rem]">
                  {status === "submitting" ? "Submitting" : isLast ? "Submit registration" : "Continue"}
                </Button>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
