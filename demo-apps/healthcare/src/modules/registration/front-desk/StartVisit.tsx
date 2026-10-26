"use client";
// Copied from the AllyVora clinical workspace (components/frontdesk/StartVisit.tsx) at commit 1ede87f; see provenance.json.

import {
  AlertTriangle, ArrowRight, BadgeCheck, BedDouble, Building2, CalendarClock, CalendarPlus, Check, CheckCircle2, ChevronRight, ClipboardList,
  CreditCard, House, IdCard, Inbox, Lock, Phone, Search, Share2, ShieldAlert, Siren, Stethoscope, UserPlus, Video, X, type LucideIcon,
} from "@pepbits/icons";
// Not exported by @pepbits/icons; lucide-react is the library @pepbits/icons wraps.
import { CircleDot, FolderOpen } from "lucide-react";
import { Link, useRouter } from "./link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, clock, type Clinic, type Department, type PatientLite } from "./lib";
import { Badge, Button, ErrorNote, Field, Kbd, SelectField, TextField, cn, useDebounced, useToast } from "./ui";
import { EMPTY_REFERRAL, ReferralSourceFields, referralProblems, type ReferralSource } from "./ReferralSource";
import { Avatar, MrnChip, Notice, Pills, Tip } from "./kit";
import styles from "./start-visit.module.css";

/** GET /api/patients/{id}/visit-context (mirrors VisitRegistration.context). */
interface Context {
  patient: PatientLite;
  coverage?: { payer?: string; plan?: string; memberId?: string; expiry?: string; eligibility?: string } | null;
  blocked: string[];
  openVisits: { id: string; class: string; status: string; department: string; arrivedAt: string; ward?: string; bed?: string }[];
  appointments: { id: string; startsAt: string; clinic: string; clinicianName?: string; reason?: string }[];
  referrals: { id: string; status: string; specialty: string; referrerName: string; organisation?: string; priority: string; referralDate: string; reason: string }[];
  clinicians: { id: string; name: string; role: string }[];
  departments: Department[];
  clinics: Clinic[];
  arrivalModes: string[];
  actions: { key: string; label: string; description: string; href?: string | null; allowed: boolean; unavailable?: string | null }[];
}
/** Appointments due soon, from the front desk overview (reception only). */
interface Expected { id: string; startsAt: string; clinic: string; clinicianName?: string; mode: string; patient: PatientLite | null }
type Hit = PatientLite & { activeEncounter?: { id: string; class: string; status: string } | null };

const ACTION_ICON: Record<string, LucideIcon> = { "start-visit": Stethoscope, appointments: CalendarPlus, "referrals-in": Inbox, admissions: BedDouble, "home-care": House, "long-term-care": Building2, referrals: Share2 };
const ARRIVAL: Record<string, string> = { "walk-in": "Walked in", ambulance: "Ambulance", police: "Police", "inter-facility-transfer": "Transfer from another facility", other: "Other" };
const EPISODE_LABEL: Record<string, string> = { IP: "Admitted", PRE: "Awaiting admission", OBS: "Under observation", DAY: "Day case", ER: "Open emergency visit", OP: "Open outpatient visit" };
const STEPS = ["Find patient", "Choose service", "Visit details", "Done"];

/**
 * Encounter registration: find the patient, choose what they need, and (for a visit now) record
 * the encounter. New patients are registered, with their first visit, on Register patient.
 */
export function StartVisit({ patient }: { patient?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [expected, setExpected] = useState<Expected[] | null>(null);
  const [pid, setPid] = useState(patient ?? "");
  const [ctx, setCtx] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"OP" | "ER">("OP");
  const [visitType, setVisitType] = useState<"walk-in" | "referral">("walk-in");
  const [department, setDepartment] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");
  const [arrivalMode, setArrivalMode] = useState("walk-in");
  const [billing, setBilling] = useState<"insurance" | "self-pay">("self-pay");
  const [reason, setReason] = useState("");
  const [referralId, setReferralId] = useState("");
  const [referral, setReferral] = useState<ReferralSource>(EMPTY_REFERRAL);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState<{ id: string; class: string } | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const searchBox = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dq.trim().length < 2) { setHits([]); setSearched(false); return; }
    api<Hit[]>(`/patients?q=${encodeURIComponent(dq.trim())}`).then((r) => { setHits(r); setCursor(0); setSearched(true); }).catch(() => setHits([]));
  }, [dq]);
  useEffect(() => {
    // Expected patients only for roles that can see the front desk overview; others simply don't get the list.
    api<{ appointments: { upcoming: Expected[] } }>("/front-desk/overview").then((r) => setExpected(r.appointments.upcoming)).catch(() => setExpected([]));
  }, []);
  useEffect(() => {
    // "/" focuses the search from anywhere on the page, as in most enterprise tools.
    const onKey = (e: KeyboardEvent) => { if (e.key === "/" && !pid && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") { e.preventDefault(); searchBox.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pid]);
  const load = useCallback(async (id: string) => {
    setError(""); setCtx(null);
    try {
      const c = await api<Context>(`/patients/${id}/visit-context`);
      setCtx(c);
      const op = c.departments.filter((d) => d.services.includes("outpatient")).map((d) => d.name);
      setDepartment((d) => (d && op.includes(d) ? d : op[0] ?? ""));
      const insured = !!c.coverage?.payer && c.coverage.payer !== "Self-pay";
      setBilling(insured ? "insurance" : "self-pay");
      // Starting a visit now is the usual reason to be here, so open its form unless it is unavailable.
      const start = c.actions.find((x) => x.key === "start-visit");
      setStartOpen(!!start?.allowed && !(start.unavailable && c.blocked.length));
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (pid) void load(pid); }, [pid, load]);
  const choose = (id: string) => { setPid(id); setQ(""); setHits([]); setStarted(null); setStartOpen(false); router.replace(`/front-desk/visits/new?patient=${id}`); };
  const clear = () => { setPid(""); setCtx(null); setStarted(null); setStartOpen(false); setReferralId(""); setProblems([]); router.replace("/front-desk/visits/new"); setTimeout(() => searchBox.current?.focus(), 50); };
  const openForm = () => { setStartOpen(true); setTimeout(() => formRef.current?.querySelector<HTMLElement>("select, input, button")?.focus(), 50); };

  const opDepartments = ctx?.departments.filter((d) => d.services.includes("outpatient")) ?? [];
  const erDepartment = ctx?.departments.find((d) => d.services.includes("emergency"))?.name ?? "Emergency";
  const effectiveDept = kind === "ER" ? erDepartment : department;
  const deptInfo = opDepartments.find((d) => d.name === department);
  const insured = !!ctx?.coverage?.payer && ctx.coverage.payer !== "Self-pay";
  const submit = async () => {
    if (!ctx) return;
    const p: string[] = [];
    if (!effectiveDept) p.push("Choose a department.");
    if (kind === "OP" && visitType === "referral" && !referralId) p.push(...referralProblems(referral));
    setProblems(p);
    if (p.length) return;
    setBusy(true);
    try {
      const visit = {
        type: kind === "ER" ? "emergency" : visitType, department: effectiveDept, reason: reason || undefined,
        clinicianId: clinicianId || undefined, billing,
        ...(kind === "OP" ? { priority } : { arrivalMode }),
        ...(kind === "OP" && visitType === "referral" ? (referralId ? { referralId } : { referral }) : {}),
      };
      const r = await api<{ encounter: { id: string; class: string } }>(`/patients/${ctx.patient.id}/visits`, { json: { visit } });
      setStarted(r.encounter);
      toast(`Visit started for ${ctx.patient.name}.`, "ok");
    } catch (e) { setProblems([(e as Error).message]); } finally { setBusy(false); }
  };

  const blocked = ctx?.blocked ?? [];
  const step = started ? 3 : startOpen ? 2 : ctx ? 1 : 0;
  const services = ctx?.actions.filter((a) => a.allowed) ?? [];
  const isOff = (a: Context["actions"][number]) => !!a.unavailable && !(a.key === "start-visit" && !blocked.length);
  const shortcuts = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcuts.current = (e) => {
    if (!ctx || started) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && startOpen && !busy && !blocked.length) { e.preventDefault(); void submit(); return; }
    const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName ?? "");
    const n = Number(e.key);
    if (typing || e.ctrlKey || e.metaKey || e.altKey || !Number.isInteger(n) || n < 1 || n > services.length) return;
    const a = services[n - 1];
    if (isOff(a)) return;
    e.preventDefault();
    if (a.key === "start-visit") openForm(); else if (a.href) router.push(a.href);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => shortcuts.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const clinicianName = ctx?.clinicians.find((u) => u.id === clinicianId)?.name;
  const alerts = ctx ? ctx.openVisits.length + ctx.appointments.length + ctx.referrals.length + (ctx.patient.identityStatus === "unknown" || ctx.patient.identityStatus === "unverified" ? 1 : 0) : 0;
  return (
    <div className={cn(styles.page, "mx-auto grid w-full max-w-[1680px] gap-3")}>
      {/* Header: title, progress and actions on one line */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-lapis">Front desk</p>
          <h1 className="text-[clamp(19px,0.6vw+12px,24px)] font-semibold leading-tight tracking-[-0.02em]">Start a visit</h1>
        </div>
        <div className="order-3 flex w-full justify-start lg:order-none lg:w-auto lg:flex-1 lg:justify-center">
          <ol className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(16,24,40,0.05)]" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === step ? "step" : undefined}
                className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] transition-colors",
                  i === step ? "bg-lapis font-semibold text-white shadow-sm dark:text-canvas" : i < step ? "text-ok" : "text-ink-3")}>
                <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-full text-[10.5px] font-semibold",
                  i === step ? "bg-white/20" : i < step ? "bg-ok-soft" : "bg-sunken")}>
                  {i < step ? <Check className="size-3" /> : <span className="num">{i + 1}</span>}
                </span>
                <span className={cn(i === step ? "inline" : "hidden sm:inline")}>{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href="/front-desk/identity" className="inline-flex h-8 items-center gap-1.5 rounded-ctl px-2.5 text-[12.5px] text-ink-2 hover:bg-raised"><IdCard className="size-4" />Identity follow-up</Link>
          <Link href="/registration" className="inline-flex h-8 items-center gap-1.5 rounded-ctl bg-lapis px-3 text-[13px] font-medium text-white hover:bg-lapis-hover dark:text-canvas"><UserPlus className="size-4" />New patient</Link>
        </div>
      </header>

      {/* 1. Find the patient */}
      {!pid && (
        <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="border-b border-line bg-[linear-gradient(180deg,var(--c-lapis-soft),transparent)] px-5 pb-4 pt-5">
            <label htmlFor="sv-search" className="text-[15px] font-semibold tracking-[-0.01em]">Who is the patient?</label>
            <p className="text-[12.5px] text-ink-3">Search by name, MRN, national ID or mobile number.</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" />
              <input id="sv-search" data-hero ref={searchBox} autoFocus value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" aria-label="Search patients"
                role="combobox" aria-expanded={hits.length > 0} aria-controls="sv-results" aria-activedescendant={hits[cursor] ? `sv-hit-${hits[cursor].id}` : undefined}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                  if (e.key === "Enter" && hits[cursor]) { e.preventDefault(); choose(hits[cursor].id); }
                  if (e.key === "Escape") setQ("");
                }}
                placeholder="Name, MRN, identity document or mobile"
                className="h-12 w-full rounded-[12px] border border-line-strong bg-surface pl-11 pr-28 text-[15px] shadow-[0_1px_2px_rgba(16,24,40,0.05)] outline-none transition focus:border-lapis focus:ring-4 focus:ring-lapis/15" />
              <span className="absolute right-3.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 text-[11.5px] text-ink-3 sm:flex">{q ? <><Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>Enter</Kbd></> : <>Press <Kbd>/</Kbd></>}</span>
            </div>
          </div>
          {hits.length > 0 ? (
            <ul id="sv-results" role="listbox" aria-label="Matching patients" className="max-h-[min(440px,calc(100dvh-300px))] divide-y divide-line overflow-y-auto">
              {hits.map((h, i) => (
                <li key={h.id} id={`sv-hit-${h.id}`} role="option" aria-selected={i === cursor}>
                  <button type="button" onMouseEnter={() => setCursor(i)} onClick={() => choose(h.id)}
                    className={cn("flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors", i === cursor ? "bg-lapis-soft/60" : "hover:bg-raised")}>
                    <Avatar name={h.name} />
                    <span className="min-w-0 flex-1">
                      <span data-phi className="block truncate text-[13.5px] font-medium">{h.name}</span>
                      <span className="num block text-[12.5px] text-ink-3"><span data-phi>{h.mrn}</span>{h.age !== undefined ? ` · ${h.age} y · ${h.sex ?? ""}` : ""}</span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {h.identityStatus === "unknown" && <Badge tone="crit">Unidentified</Badge>}
                      {h.identityStatus === "unverified" && <Badge tone="warn">Not verified</Badge>}
                      {h.restricted && <Badge tone="warn">Restricted</Badge>}
                      {h.deceasedAt && <Badge>Deceased</Badge>}
                      {h.activeEncounter && <Badge tone="lapis" dot>Open visit</Badge>}
                    </span>
                    <ChevronRight className={cn("size-4 shrink-0", i === cursor ? "text-lapis" : "text-ink-3")} />
                  </button>
                </li>
              ))}
            </ul>
          ) : searched ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <p className="text-[13.5px]"><b>No matching patient.</b> <span className="text-ink-3">Check the spelling, or search by MRN or national ID.</span></p>
              <Link href="/registration" className="inline-flex h-8 items-center gap-1.5 rounded-ctl bg-lapis px-3 text-[13px] font-medium text-white dark:text-canvas"><UserPlus className="size-4" />Register a new patient</Link>
            </div>
          ) : (
            <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Expected in the next two hours</p>
                {expected === null ? <p className="mt-2 text-[13px] text-ink-3">Loading…</p> : expected.length === 0 ? (
                  <p className="mt-2 text-[13px] text-ink-3">No more booked appointments soon.</p>
                ) : (
                  <ul className="mt-2 grid gap-1">
                    {expected.filter((a) => a.patient).slice(0, 5).map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => choose(a.patient!.id)} className="flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left hover:bg-raised">
                          <span className="num w-14 shrink-0 rounded-[10px] bg-lapis-soft py-1 text-center text-[13px] font-semibold text-lapis-ink">{clock(a.startsAt)}</span>
                          <span className="min-w-0 flex-1"><span data-phi className="block truncate text-[13.5px] font-medium">{a.patient!.name}</span><span className="block truncate text-[12px] text-ink-3">{a.clinic}{a.clinicianName ? ` · ${a.clinicianName}` : ""}</span></span>
                          {a.mode === "video" && <Video className="size-4 text-ai" aria-label="Video" />}{a.mode === "phone" && <Phone className="size-4 text-ai" aria-label="Telephone" />}
                          <ChevronRight className="size-4 text-ink-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid content-start gap-2 rounded-[12px] border border-line bg-raised p-3.5 text-[12.5px]">
                <p className="font-semibold">Before you start</p>
                <Tip icon={<Search className="size-4" />}>Search first, even for a returning patient, so the record is not duplicated.</Tip>
                <Tip icon={<CalendarClock className="size-4" />}>Patients with an appointment today are checked in from the appointment.</Tip>
                <Tip icon={<Siren className="size-4" />}>Unknown or unconscious emergency patients: use <Link href="/front-desk/emergency" className="text-lapis underline">emergency registration</Link>.</Tip>
              </div>
            </div>
          )}
        </section>
      )}

      {pid && !ctx && (error ? <ErrorNote>{error}</ErrorNote> : (
        <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)]"><div className="h-72 animate-pulse rounded-panel bg-surface" /><div className="h-72 animate-pulse rounded-panel bg-surface" /></div>
      ))}

      {ctx && (
        <div className="grid items-start gap-3 lg:grid-cols-[clamp(300px,26vw,400px)_minmax(0,1fr)]">
          {/* Left: who the patient is, what to know, and what they need */}
          <aside className="grid items-start gap-3 md:grid-cols-2 lg:sticky lg:top-[68px] lg:grid-cols-1">
            <section className="overflow-hidden rounded-panel border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="h-1 bg-[linear-gradient(90deg,var(--c-lapis),var(--c-ai))]" />
              <div className="flex items-start gap-3 p-3.5">
                <Avatar name={ctx.patient.name} large />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold leading-snug tracking-[-0.01em]" data-phi>{ctx.patient.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-2">
                    <MrnChip mrn={ctx.patient.mrn} />
                    {ctx.patient.age !== undefined && <span>{ctx.patient.age} y · {ctx.patient.sex}</span>}
                  </div>
                </div>
              </div>
              <dl className="mx-3.5 mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line text-[12px]">
                <div className="bg-raised px-2.5 py-1.5">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Identity</dt>
                  <dd className={cn("flex items-center gap-1 font-medium", ctx.patient.identityStatus === "unknown" ? "text-crit" : ctx.patient.identityStatus === "unverified" ? "text-warn" : "text-ok")}>
                    {ctx.patient.identityStatus === "unknown" || ctx.patient.identityStatus === "unverified" ? <ShieldAlert className="size-3.5" /> : <BadgeCheck className="size-3.5" />}
                    {ctx.patient.identityStatus === "unknown" ? "Unidentified" : ctx.patient.identityStatus === "unverified" ? "Not verified" : "Verified"}
                  </dd>
                </div>
                <div className="min-w-0 bg-raised px-2.5 py-1.5">
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">Coverage</dt>
                  <dd className={cn("flex min-w-0 items-center gap-1 font-medium", !insured ? "text-ink-2" : ctx.coverage?.eligibility === "verified" ? "text-ok" : ctx.coverage?.eligibility === "failed" ? "text-crit" : "text-ink-2")}>
                    {insured ? <BadgeCheck className="size-3.5 shrink-0" /> : <CreditCard className="size-3.5 shrink-0" />}
                    <span className="truncate" title={insured ? `${ctx.coverage?.payer}${ctx.coverage?.eligibility ? ` · ${ctx.coverage.eligibility}` : ""}` : "No insurance on record"}>{insured ? `${ctx.coverage?.payer}${ctx.coverage?.eligibility ? ` · ${ctx.coverage.eligibility}` : ""}` : "Self-pay"}</span>
                  </dd>
                </div>
              </dl>
              {(ctx.patient.restricted || ctx.patient.deceasedAt) && (
                <div className="flex flex-wrap gap-1.5 px-3.5 pb-3">
                  {ctx.patient.restricted && <Badge tone="warn"><ShieldAlert className="size-3" />Restricted record</Badge>}
                  {ctx.patient.deceasedAt && <Badge>Deceased</Badge>}
                </div>
              )}
              <div className="grid grid-cols-2 border-t border-line">
                <Link href={`/patients/${ctx.patient.id}`} target="_blank" className="inline-flex h-9 items-center justify-center gap-1.5 border-r border-line text-[12.5px] font-medium text-lapis hover:bg-raised"><FolderOpen className="size-4" />Open chart</Link>
                <button type="button" onClick={clear} className="inline-flex h-9 items-center justify-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:bg-raised"><X className="size-4" />Change patient</button>
              </div>
            </section>

            {alerts > 0 && (
              <section className="grid max-h-[220px] gap-1.5 overflow-y-auto md:col-start-1" aria-label="Before starting">
                {ctx.openVisits.map((v) => (
                  <Notice key={v.id} tone="lapis" icon={<CircleDot className="size-4" />} title={EPISODE_LABEL[v.class] ?? `Open ${v.class} episode`}>
                    {v.class === "IP" ? [v.department, v.ward !== v.department ? v.ward : null, v.bed].filter(Boolean).join(" · ") : `${v.department} · ${v.status}`} · since {clock(v.arrivedAt)}
                  </Notice>
                ))}
                {ctx.appointments.map((a) => (
                  <Notice key={a.id} tone="lapis" icon={<CalendarClock className="size-4" />} title={`Appointment today at ${clock(a.startsAt)}`} action={<Link href="/front-desk/appointments" className="font-medium underline">Check in</Link>}>
                    {a.clinic}{a.clinicianName ? ` with ${a.clinicianName}` : ""}. Check in from the appointment so the booking is closed.
                  </Notice>
                ))}
                {ctx.referrals.map((r) => (
                  <Notice key={r.id} tone="ai" icon={<Inbox className="size-4" />} title={`Referral ${r.status}: ${r.specialty}`}>
                    From {r.referrerName}{r.organisation ? `, ${r.organisation}` : ""} · {r.referralDate}
                  </Notice>
                ))}
                {(ctx.patient.identityStatus === "unknown" || ctx.patient.identityStatus === "unverified") && ctx.actions.find((a) => a.key === "start-visit")?.allowed && (
                  <Notice tone={ctx.patient.identityStatus === "unknown" ? "crit" : "warn"} icon={<ShieldAlert className="size-4" />} title={ctx.patient.identityStatus === "unknown" ? "Unidentified patient" : "Identity not verified"}
                    action={<Link href={`/front-desk/identify/${ctx.patient.id}`} className="font-medium underline">{ctx.patient.identityStatus === "unknown" ? "Identify" : "Verify"}</Link>}>
                    {ctx.patient.identityStatus === "unknown" ? "Record who this patient is as soon as it is known." : "See an identity document or confirm with the next of kin."}
                  </Notice>
                )}
              </section>
            )}

            {!started && (
              <section className="overflow-hidden rounded-panel border border-line bg-surface md:col-start-2 md:row-span-2 md:row-start-1 lg:col-start-auto lg:row-span-1 lg:row-start-auto">
                <h2 className="flex items-center justify-between border-b border-line px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">What does the patient need?<span data-kbd className="hidden font-normal normal-case tracking-normal lg:inline">Press a number</span></h2>
                {ctx.actions.every((a) => !a.allowed) ? <p className="p-3.5 text-[13px] text-ink-3">Your role can view this patient but not start any of these.</p> : (
                  <ul className="divide-y divide-line">
                    {services.map((a, index) => {
                      const Icon = ACTION_ICON[a.key] ?? ArrowRight;
                      const off = isOff(a);
                      const selected = a.key === "start-visit" && startOpen;
                      const body = (
                        <>
                          <span className={cn("grid size-8 shrink-0 place-items-center rounded-[9px] transition-colors", off ? "bg-sunken text-ink-3" : selected ? "bg-lapis text-white dark:text-canvas" : "bg-lapis-soft text-lapis-ink group-hover:bg-lapis group-hover:text-white dark:group-hover:text-canvas")}>
                            {off ? <Lock className="size-4" /> : <Icon className="size-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold">{a.label}</span>
                            <span className={cn("block text-[12px] leading-snug", off ? "text-warn" : "text-ink-3")}>{off ? a.unavailable : a.description}</span>
                          </span>
                          {!off && index < 9 && <span data-kbd className="hidden lg:inline-flex"><Kbd>{index + 1}</Kbd></span>}
                          {!off && (selected ? <Check className="size-4 shrink-0 text-lapis" /> : <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-lapis" />)}
                        </>
                      );
                      const cls = cn("group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors", off ? "cursor-not-allowed opacity-75" : selected ? "bg-lapis-soft/50 shadow-[inset_3px_0_0_var(--c-lapis)]" : "hover:bg-raised");
                      return (
                        <li key={a.key}>
                          {a.key === "start-visit" ? <button type="button" disabled={off} aria-pressed={selected} onClick={openForm} className={cls}>{body}</button>
                            : off || !a.href ? <div className={cls} aria-disabled>{body}</div> : <Link href={a.href} className={cls}>{body}</Link>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </aside>

          {/* Right: the visit, or what happened */}
          <div className="min-w-0">
            {started ? (
              <section className="relative overflow-hidden rounded-panel border border-ok/30 bg-surface px-6 py-10 text-center">
                <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--c-ok-soft),transparent_70%)]" />
                <div className="relative mx-auto grid max-w-md justify-items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 className="size-6" /></span>
                  <div>
                    <p className="text-[17px] font-semibold">Visit started</p>
                    <p className="mt-0.5 text-[13.5px] text-ink-2"><span data-phi>{ctx.patient.name}</span> is now {started.class === "ER" ? "on the emergency board, waiting for triage" : "in the clinic queue"}.</p>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {started.class === "ER" ? <Link href={`/emergency/triage/${started.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-ctl bg-crit px-4 text-[13px] font-medium text-white"><Siren className="size-4" />Triage now</Link>
                      : <Link href={`/outpatient/intake/${started.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-ctl bg-lapis px-4 text-[13px] font-medium text-white dark:text-canvas"><ClipboardList className="size-4" />Start nurse intake</Link>}
                    <Link href={started.class === "ER" ? "/emergency" : "/outpatient"} className="inline-flex h-9 items-center rounded-ctl border border-line px-4 text-[13px] hover:bg-raised">Go to {started.class === "ER" ? "emergency board" : "clinic queue"}</Link>
                    <Button variant="ghost" onClick={clear}>Start another visit</Button>
                  </div>
                </div>
              </section>
            ) : startOpen ? (
              <section ref={formRef} className="flex min-h-0 flex-col overflow-hidden rounded-panel lg:max-h-[calc(100dvh-176px)] border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <div>
                    <h2 className="text-[14.5px] font-semibold tracking-[-0.01em]">Visit details</h2>
                    <p className="text-[12px] text-ink-3">{kind === "ER" ? "Goes to the emergency board for triage." : "Clinic visit; goes to the clinic queue for nurse intake."}</p>
                  </div>
                  <div className="inline-flex rounded-[10px] bg-sunken p-1" role="radiogroup" aria-label="Type of visit">
                    {([["OP", "Outpatient", Stethoscope], ["ER", "Emergency", Siren]] as const).map(([k, label, Icon]) => (
                      <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={blocked.length > 0} onClick={() => setKind(k)}
                        className={cn("inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transition",
                          kind === k ? (k === "ER" ? "bg-crit text-white shadow-sm" : "bg-surface text-lapis-ink shadow-sm") : "text-ink-3 hover:text-ink")}>
                        <Icon className="size-4" />{label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="min-h-0 flex-1 px-4 py-4 lg:overflow-y-auto">
                  {blocked.length > 0 && <div className="mb-4"><ErrorNote><ul className="list-disc pl-5">{blocked.map((b) => <li key={b}>{b}</li>)}</ul></ErrorNote></div>}
                  <fieldset disabled={blocked.length > 0} className="grid gap-x-4 gap-y-4 md:grid-cols-2 2xl:grid-cols-4">
                    {kind === "OP" ? (
                      <>
                        <SelectField label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} hint={deptInfo?.specialties.length ? deptInfo.specialties.join(", ") : undefined}>{opDepartments.map((d) => <option key={d.code} value={d.name}>{d.name}</option>)}</SelectField>
                        <SelectField label="Responsible clinician (optional)" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}><option value="">Assign when seen</option>{ctx.clinicians.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role === "resident" ? " (resident)" : ""}</option>)}</SelectField>
                        <Field label="How the patient came"><Pills value={visitType} onChange={(v) => setVisitType(v as typeof visitType)} options={[["walk-in", "Walk-in"], ["referral", "Referred"]]} /></Field>
                        <Field label="Priority"><Pills value={priority} onChange={(v) => setPriority(v as typeof priority)} options={[["routine", "Routine"], ["urgent", "Urgent"]]} warnValue="urgent" /></Field>
                      </>
                    ) : (
                      <>
                        <SelectField label="Arrival mode" className="2xl:col-span-2" value={arrivalMode} onChange={(e) => setArrivalMode(e.target.value)}>{ctx.arrivalModes.map((a) => <option key={a} value={a}>{ARRIVAL[a] ?? a}</option>)}</SelectField>
                        <p className="flex items-center gap-2 self-end rounded-ctl bg-crit-soft px-3 py-2.5 text-[12.5px] text-crit 2xl:col-span-2"><Siren className="size-4" />Priority is set at triage (ESI).</p>
                      </>
                    )}
                    <TextField label="Reason for visit (for the queue)" className="2xl:col-span-2" value={reason} onChange={(e) => setReason(e.target.value)} hint="Administrative note only. The nurse records the clinical complaint." />
                    <Field label="Billing" className="2xl:col-span-2">
                      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Billing for this visit">
                        {([["insurance", "Insurance", BadgeCheck, insured ? `${ctx.coverage?.payer}${ctx.coverage?.memberId ? ` · ${ctx.coverage.memberId}` : ""}` : "No insurance on record"],
                          ["self-pay", "Self-pay", CreditCard, "The patient pays for this visit."]] as const).map(([k, label, Icon, text]) => (
                          <button key={k} type="button" role="radio" aria-checked={billing === k} onClick={() => setBilling(k)}
                            className={cn("flex min-w-0 items-center gap-2 rounded-ctl border px-2.5 py-1.5 text-left transition", billing === k ? "border-lapis bg-lapis-soft/40 ring-2 ring-lapis/10" : "border-line hover:border-line-strong hover:bg-raised")}>
                            <Icon className={cn("size-4 shrink-0", billing === k ? "text-lapis" : "text-ink-3")} />
                            <span className="min-w-0"><span className="block text-[12.5px] font-semibold">{label}</span><span className="block truncate text-[11.5px] text-ink-3" title={text}>{text}</span></span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {billing === "insurance" && !insured && <p className="flex items-center gap-1.5 text-[12.5px] text-warn md:col-span-2 2xl:col-span-4"><AlertTriangle className="size-4" />No insurance on record. Update the patient's coverage first, or choose self-pay.</p>}
                    {billing === "insurance" && insured && ctx.coverage?.eligibility && ctx.coverage.eligibility !== "verified" && <p className="flex items-center gap-1.5 text-[12.5px] text-warn md:col-span-2 2xl:col-span-4"><AlertTriangle className="size-4" />Eligibility is {ctx.coverage.eligibility}. Check it before the visit is billed.</p>}
                    {kind === "OP" && visitType === "referral" && (
                      <div className="grid gap-3 md:col-span-2 2xl:col-span-4">
                        {ctx.referrals.length > 0 && (
                          <SelectField label="Link an accepted referral" value={referralId} onChange={(e) => setReferralId(e.target.value)}>
                            <option value="">Enter the referral details below</option>
                            {ctx.referrals.map((r) => <option key={r.id} value={r.id}>{r.specialty} · {r.referrerName}{r.organisation ? `, ${r.organisation}` : ""} · {r.referralDate} ({r.status})</option>)}
                          </SelectField>
                        )}
                        {!referralId && <ReferralSourceFields value={referral} onChange={setReferral} />}
                      </div>
                    )}
                  </fieldset>
                </div>

                {/* Action bar: live summary, problems and the one button that matters */}
                <div className="border-t border-line bg-raised px-4 py-3">
                  {problems.length > 0 && <div className="mb-3"><ErrorNote><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></ErrorNote></div>}
                  <div className="flex flex-wrap items-center gap-3">
                    <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[12px]" aria-label="Visit summary">
                      <Summary done label={kind === "ER" ? "Emergency" : `Outpatient${priority === "urgent" ? " · urgent" : ""}`} />
                      <Summary done={!!effectiveDept} label={effectiveDept || "Choose a department"} />
                      <Summary done label={kind === "OP" ? clinicianName ?? "Clinician assigned when seen" : ARRIVAL[arrivalMode] ?? arrivalMode} />
                      <Summary done={billing === "self-pay" || insured} label={billing === "self-pay" ? "Self-pay" : ctx.coverage?.payer ?? "No insurance on record"} />
                      {kind === "OP" && visitType === "referral" && <Summary done={!!referralId || !!referral.referrerName} label={referralId ? "Accepted referral linked" : referral.referrerName || "Enter the referral source"} />}
                    </ul>
                    <div className="grid justify-items-end gap-1">
                      <Button variant={kind === "ER" ? "danger" : "primary"} loading={busy} disabled={blocked.length > 0} onClick={() => void submit()}
                        icon={kind === "ER" ? <Siren className="size-4" /> : <Stethoscope className="size-4" />} className="h-10 px-5">
                        {kind === "ER" ? "Start emergency visit" : "Start outpatient visit"}
                      </Button>
                      <p className="flex items-center gap-1 text-[11px] text-ink-3"><span data-kbd className="hidden items-center gap-0.5 lg:inline-flex"><Kbd>Ctrl/⌘</Kbd><Kbd>Enter</Kbd><span className="mx-1">·</span></span>Recorded in the audit log.</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <section className="grid min-h-[280px] place-items-center rounded-panel border border-dashed border-line-strong bg-surface/60 p-8 text-center">
                <div className="grid max-w-sm justify-items-center gap-2">
                  <span className="grid size-10 place-items-center rounded-full bg-lapis-soft text-lapis"><ArrowRight className="size-5 rotate-180" /></span>
                  <p className="text-[14px] font-semibold">Choose what the patient needs</p>
                  <p className="text-[12.5px] text-ink-3">Pick a service on the left. Starting a visit now opens its details here.</p>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One item in the visit summary: green when complete, amber when something is still needed. */
function Summary({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5", done ? "border-line bg-surface text-ink-2" : "border-warn/30 bg-warn-soft text-warn")}>
      {done ? <Check className="size-3 shrink-0 text-ok" /> : <AlertTriangle className="size-3 shrink-0" />}<span className="truncate" data-phi>{label}</span>
    </li>
  );
}
