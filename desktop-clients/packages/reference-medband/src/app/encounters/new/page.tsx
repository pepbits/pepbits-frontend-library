"use client";

import {
  AlertCircle, ArrowRightLeft, BedDouble, Check, ChevronLeft, ChevronRight, FolderHeart, Link2, Lock, RotateCcw, Siren, Sparkles,
  Stethoscope, Undo2,
} from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useHotkeys } from "../../../lib/hooks";
import { useRouter, useSearchParams } from "../../../lib/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { admissionStartType, canAdmit, pendingReason, REQUEST_TONE, URGENCY_TONE } from "../../../lib/admission";
import { ApiRequestError } from "../../../lib/api";
import { COMPLAINT_REQUIRED, ENCOUNTER_TYPES, START_TYPES, encounterType } from "../../../lib/encounter-config";
import { deriveFollowUp } from "../../../lib/followup";
import { useCounter, useStore } from "../../../lib/store";
import type {
  AdmissionRequest, BillingMode, Case, ComplaintEntry, Encounter, EncounterType, Episode, EpisodeKind, Priority, StartType,
  TeleChannel, TriageLevel,
} from "../../../lib/types";
import { coverageActive, cx, fullName, toDateTimeInput } from "../../../lib/utils";
import { ComplaintPicker } from "../../../components/encounter/complaint-picker";
import { PatientContext } from "../../../components/encounter/patient-context";
import { StatusPill, TYPE_ICON, TypeTag } from "../../../components/encounter/type-tag";
import { Checkbox, Chip, DateTimeInput, Field, Input, Segmented, Select } from "../../../components/ui/form";
import { Modal, useErrorToast, useToast } from "../../../components/ui/overlay";
import { Badge, Button, Kbd, LinkButton, Panel } from "../../../components/ui/primitives";
import { SourceButton } from "../../../components/controls";
import { useMaster, type Master } from "../../../lib/master";
import { useMedbandFormat } from "../../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Copy } from "../../../components/copy";
import { medbandPaths } from "../../../routes";

type Step = "visit" | "details" | "case" | "billing";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "visit", label: "Visit" },
  { id: "details", label: "Details" },
  { id: "case", label: "Case" },
  { id: "billing", label: "Billing" },
];

interface Form {
  type: EncounterType;
  startType: StartType;
  priority: Priority;
  start: string;
  departmentId: string;
  practitionerId: string;
  complaints: ComplaintEntry[];
  parentEncounterId: string;
  followUpDerived: boolean;
  admissionRequestId: string;
  wardId: string;
  bed: string;
  admissionReason: string;
  expectedStayDays: string;
  teleChannel: TeleChannel;
  teleLink: string;
  visitAddress: string;
  visitTeam: string;
  referringFacility: string;
  referringDoctor: string;
  referralNote: string;
  services: string[];
  triage: TriageLevel | "";
  packageId: string;
  broughtBy: string;
  broughtByPhone: string;
  caseChoice: string; // "" = suggested, a case id, or "new"
  caseTitle: string;
  provisionalDiagnosis: string;
  medicoLegal: boolean;
  mlcNumber: string;
  policeStation: string;
  episodeChoice: string; // for a new case: "" = suggested, an episode id, or "new"
  newEpisodeTitle: string;
  newEpisodeKind: EpisodeKind | "";
  billingMode: BillingMode | "";
  coverageIds: string[] | null; // null = use the suggested coverages
  authNumber: string;
  corporateName: string;
}

const initialForm = (type: EncounterType = "OP", departmentId = ""): Form => {
  const t = encounterType(type);
  return {
    type,
    startType: t.defaultStart,
    priority: t.defaultPriority,
    start: toDateTimeInput(new Date()),
    // The source pre-selected seed departments by visit type (ER, laboratory...). Department ids belong to the backend, so none is assumed.
    departmentId,
    practitionerId: "",
    complaints: [],
    parentEncounterId: "",
    followUpDerived: false,
    admissionRequestId: "",
    wardId: type === "DAY_CARE" ? "w-day" : "",
    bed: "",
    admissionReason: "",
    expectedStayDays: "",
    teleChannel: "Video",
    teleLink: "",
    visitAddress: "",
    visitTeam: "Doctor + nurse",
    referringFacility: "",
    referringDoctor: "",
    referralNote: "",
    services: [],
    triage: "",
    packageId: "",
    broughtBy: "",
    broughtByPhone: "",
    caseChoice: "",
    caseTitle: "",
    provisionalDiagnosis: "",
    medicoLegal: false,
    mlcNumber: "",
    policeStation: "",
    episodeChoice: "",
    newEpisodeTitle: "",
    newEpisodeKind: "",
    billingMode: "",
    coverageIds: null,
    authNumber: "",
    corporateName: "",
  };
};

/** Prefills an admission from its request: who admits, how it started, stay, billing and bed class. */
function fromRequest(f: Form, r: AdmissionRequest, wardsForCategory: Master["wardsForCategory"], source?: Encounter): Form {
  return {
    ...f,
    type: "IP",
    admissionRequestId: r.id,
    departmentId: r.admittingDepartmentId,
    practitionerId: r.admittingPractitionerId,
    startType: admissionStartType(source),
    priority: r.urgency === "Elective" ? "Routine" : r.urgency,
    expectedStayDays: String(r.expectedStayDays),
    admissionReason: r.reason,
    wardId: wardsForCategory(r.bedCategory)[0]?.id ?? "",
    bed: "",
    billingMode: r.billingMode,
    coverageIds: r.coverageId ? [r.coverageId] : [],
    authNumber: r.authNumber ?? "",
    caseChoice: "",
  };
}

const TRIAGE: Array<{ level: TriageLevel; label: string; tone: string }> = [
  { level: "Level 1", label: "Resuscitation", tone: "bg-rose-600 text-white border-rose-600" },
  { level: "Level 2", label: "Emergent", tone: "bg-orange-500 text-white border-orange-500" },
  { level: "Level 3", label: "Urgent", tone: "bg-amber-400 text-ink border-amber-400" },
  { level: "Level 4", label: "Less urgent", tone: "bg-emerald-500 text-white border-emerald-500" },
  { level: "Level 5", label: "Non-urgent", tone: "bg-sky-500 text-white border-sky-500" },
];

const KINDS: EpisodeKind[] = ["Acute illness", "Chronic care", "Maternity", "Surgical", "Rehabilitation", "Preventive", "Oncology"];

/** Which step a server-side validation field belongs to. */
function stepForField(field?: string): Step {
  if (!field) return "visit";
  if (field.startsWith("case")) return "case";
  if (["coverageIds", "authNumber", "corporateName", "billingMode"].some((f) => field.startsWith(f))) return "billing";
  if (["parentEncounterId", "wardId", "bed", "triage", "teleLink", "visitAddress", "referringFacility", "services", "packageId", "admissionReason"].some((f) => field.startsWith(f)))
    return "details";
  return "visit";
}

export default function NewEncounterPage() {
  return (
    <Suspense>
      <NewEncounter />
    </Suspense>
  );
}

function NewEncounter() {
  const { COUNTERS, DEPARTMENTS, PACKAGES, SERVICES, WARDS, department, healthPackage, network, payer, plan, practitioner, practitionersFor, ward, wardsForCategory } = useMaster();
  const { fmtDate, fmtDateTime, relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const desk = useCounter();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const fail = useErrorToast();
  const allowed = useMemo(() => desk?.encounterTypes ?? [], [desk]);

  const requestedType = (params.get("type") as EncounterType) || "";
  const [patientId, setPatientId] = useState(params.get("patientId") ?? "");
  const [form, setForm] = useState<Form>(() => {
    const req = store.requestById(params.get("admissionRequest") ?? undefined);
    const firstAllowed = requestedType && allowed.includes(requestedType) ? requestedType : allowed[0] ?? "OP";
    const base = { ...initialForm(firstAllowed, params.get("department") ?? ""), caseChoice: params.get("case") ?? "" };
    if (params.get("episode")) Object.assign(base, { caseChoice: "new", episodeChoice: params.get("episode") });
    return req && allowed.includes("IP") ? fromRequest(base, req, wardsForCategory, store.encounterById(req.sourceEncounterId)) : base;
  });
  const [step, setStep] = useState<Step>("visit");
  const [autoFollow, setAutoFollow] = useState(true);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ encounter: Encounter; kase: Case; episode: Episode } | null>(null);

  const patient = store.patientById(patientId);
  const t = encounterType(form.type);
  const dept = department(form.departmentId);
  const at = useMemo(() => new Date(form.start || Date.now()), [form.start]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // A visit type this counter does not serve, asked for by link or by switching counter.
  const blockedType = requestedType && !allowed.includes(requestedType) ? requestedType : null;
  const servingCounter = blockedType ? COUNTERS.find((c) => c.encounterTypes.includes(blockedType)) : undefined;
  // After a counter switch, fall back to a type this counter serves, keeping any request from the link.
  useEffect(() => {
    if (!allowed.length || allowed.includes(form.type)) return;
    const type = requestedType && allowed.includes(requestedType) ? requestedType : allowed[0];
    const req = store.requestById(params.get("admissionRequest") ?? undefined);
    setForm((f) => {
      const base = { ...initialForm(type), start: f.start, complaints: f.complaints };
      return req && type === "IP" ? fromRequest(base, req, wardsForCategory, store.encounterById(req.sourceEncounterId)) : base;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, form.type]);

  // ─── Follow-up derivation ───
  const fu = useMemo(
    () => deriveFollowUp(store.encounters, { patientId, departmentId: form.departmentId, practitionerId: form.practitionerId, at }, department, tr),
    [store.encounters, patientId, form.departmentId, form.practitionerId, at],
  );
  const followUpHere = allowed.includes("FOLLOW_UP");

  useEffect(() => {
    if (!autoFollow || !followUpHere) return;
    setForm((f) => {
      if (f.type !== "OP" && f.type !== "FOLLOW_UP") return f;
      if (fu.parent) {
        if (f.type === "FOLLOW_UP" && f.parentEncounterId) return f; // already linked, keep the user's choice
        const fuStarts = encounterType("FOLLOW_UP").startTypes;
        return {
          ...f,
          type: "FOLLOW_UP",
          startType: fuStarts.includes(f.startType) ? f.startType : "APPOINTMENT",
          parentEncounterId: fu.parent.id,
          followUpDerived: true,
          practitionerId: f.practitionerId || fu.parent.practitionerId || "",
        };
      }
      if (f.followUpDerived) return { ...f, type: "OP", startType: "WALK_IN", parentEncounterId: "", followUpDerived: false };
      return f;
    });
  }, [fu.parent, autoFollow, followUpHere]);

  const chooseType = (code: EncounterType) => {
    const nt = encounterType(code);
    setForm((f) => {
      const deptOk = deptOptions(code, DEPARTMENTS).some((d) => d.id === f.departmentId);
      const departmentId = deptOk ? f.departmentId : "";
      const pracOk = f.practitionerId && practitioner(f.practitionerId)?.departmentId === departmentId && (!nt.needsTele || practitioner(f.practitionerId)?.tele);
      return {
        ...f,
        type: code,
        startType: nt.startTypes.includes(f.startType) ? f.startType : nt.defaultStart,
        priority: nt.defaultPriority,
        departmentId,
        practitionerId: pracOk ? f.practitionerId : "",
        wardId: code === "DAY_CARE" ? "w-day" : code === "IP" && f.wardId === "w-day" ? "" : f.wardId,
        bed: "",
        admissionRequestId: code === "IP" ? f.admissionRequestId : "",
        parentEncounterId: code === "FOLLOW_UP" ? f.parentEncounterId || fu.parent?.id || "" : "",
        followUpDerived: code === "FOLLOW_UP" && !f.parentEncounterId && !!fu.parent,
        caseChoice: "",
        medicoLegal: code === "EMERGENCY" ? f.medicoLegal : false,
        visitAddress: code === "HOME_VISIT" && !f.visitAddress && patient ? [patient.address, patient.city].filter(Boolean).join(", ") : f.visitAddress,
      };
    });
    // Choosing OP by hand while a follow-up is detected means "treat as a new visit".
    if (code === "OP" && fu.parent) setAutoFollow(false);
    if (code === "FOLLOW_UP") setAutoFollow(true);
  };

  const pickPatient = (id: string) => {
    setPatientId(id);
    setAutoFollow(true);
    setForm((f) => ({
      ...f,
      parentEncounterId: "",
      followUpDerived: false,
      admissionRequestId: "",
      type: f.type === "FOLLOW_UP" ? "OP" : f.type,
      caseChoice: "",
      episodeChoice: "",
      coverageIds: null,
      billingMode: "",
    }));
  };

  // ─── Admission requests (inpatient) ───
  const patientRequests = useMemo(
    () => store.admissionRequests.filter((r) => r.patientId === patientId && (r.status === "Pending" || r.status === "Ready")).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
    [store.admissionRequests, patientId],
  );
  const request = store.requestById(form.admissionRequestId);

  // ─── Case and episode ───
  const parent = store.encounterById(form.parentEncounterId);
  const lockedCase =
    form.type === "FOLLOW_UP" && parent ? store.caseById(parent.caseId) : form.type === "IP" && request ? store.caseById(request.caseId) : undefined;
  const openCases = useMemo(
    () => store.cases.filter((c) => c.patientId === patientId && c.status === "Open").sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    [store.cases, patientId],
  );
  const codes = form.complaints.map((c) => c.code);
  const suggestedCase =
    openCases.find((c) => c.id === params.get("case"))?.id ||
    openCases.find((c) => c.departmentId === form.departmentId && (codes.length === 0 || c.complaints.some((x) => codes.includes(x.code))))?.id ||
    "new";
  const caseChoice = lockedCase ? lockedCase.id : form.caseChoice || suggestedCase;

  const patientEpisodes = useMemo(
    () => store.episodes.filter((e) => e.patientId === patientId && e.status !== "Closed").sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [store.episodes, patientId],
  );
  const suggestedEpisode = patientEpisodes.find((e) => e.departmentId === form.departmentId && e.status === "Active")?.id || "new";
  const episodeChoice = form.episodeChoice || suggestedEpisode;
  const suggestedKind: EpisodeKind =
    form.type === "HEALTH_CHECK" ? "Preventive" : form.type === "DAY_CARE" ? "Surgical" : "Acute illness";
  const complaintTitle = form.complaints.map((c) => c.label).slice(0, 2).join(" and ");
  const caseTitle = form.caseTitle || complaintTitle || (form.type === "HEALTH_CHECK" ? healthPackage(form.packageId)?.name ?? "" : "");
  const episodeTitle = form.newEpisodeTitle || caseTitle || (dept ? `${dept.name} care` : "New episode");
  const mlcRequired = form.startType === "POLICE_CASE";
  const resolvedCase = caseChoice !== "new" ? store.caseById(caseChoice) : undefined;

  // ─── Billing suggestion ───
  const coverageCheck = (c: NonNullable<typeof patient>["coverages"][number]) => {
    const p = plan(c.planId);
    if (!coverageActive(c, at)) return { ok: false, note: tr("Expired {value0}", { value0: (fmtDate(c.validTo)) ?? "" }) };
    if ((form.type === "IP" || form.type === "DAY_CARE") && !p?.ipCovered) return { ok: false, note: "Plan excludes admission" };
    if (form.type === "TELE" && !p?.teleCovered) return { ok: false, note: "Plan excludes tele" };
    return { ok: true, note: tr("Co-pay {value0}%", { value0: (p?.copayPct ?? 0) ?? "" }) };
  };
  const eligibleCoverages = patient?.coverages.filter((c) => coverageCheck(c).ok) ?? [];
  const billingMode: BillingMode = form.billingMode || (eligibleCoverages.length ? "Insurance" : "Self pay");
  const coverageIds = form.coverageIds ?? eligibleCoverages.map((c) => c.id);
  const authLater = form.type === "IP" && request?.urgency === "Emergency";

  // ─── Current admission: a patient can only hold one open inpatient stay ───
  const currentAdmission = store.encounters.find((e) => e.patientId === patientId && e.type === "IP" && ["Planned", "Arrived", "In progress"].includes(e.status));

  // ─── Beds ───
  const occupied = new Set(store.encounters.filter((e) => e.bed && ["Planned", "Arrived", "In progress"].includes(e.status)).map((e) => e.bed!));

  // ─── Validation (the server checks all of this again) ───
  const issues = useMemo(() => {
    const list: Array<{ step: Step; msg: string }> = [];
    if (!patient) list.push({ step: "visit", msg: "Pick a patient" });
    if (!allowed.includes(form.type)) list.push({ step: "visit", msg: tr("{value0} is not opened at this counter", { value0: tr(t.label ?? "") }) });
    if (form.type === "IP" && currentAdmission) list.push({ step: "visit", msg: tr("Already admitted under {value0}", { value0: (currentAdmission.code) ?? "" }) });
    if (form.type === "IP" && !request) list.push({ step: "visit", msg: "Select the admission request" });
    if (form.type === "IP" && request && !canAdmit(request)) list.push({ step: "visit", msg: `${request.code}: ${pendingReason(request, tr)}` });
    if (!form.departmentId) list.push({ step: "visit", msg: "Choose a department" });
    if (t.needsPractitioner && !form.practitionerId) list.push({ step: "visit", msg: "Choose the clinician" });
    if (!form.start) list.push({ step: "visit", msg: "Set the date and time" });
    if (COMPLAINT_REQUIRED.includes(form.type) && form.complaints.length === 0) list.push({ step: "visit", msg: "Select the chief complaint" });
    if (t.needsParent && !form.parentEncounterId) list.push({ step: "details", msg: "Link the earlier visit this follows" });
    if (t.needsBed && !form.wardId) list.push({ step: "details", msg: "Choose a ward" });
    if (t.needsBed && !form.bed) list.push({ step: "details", msg: "Assign a bed" });
    if (t.needsTriage && !form.triage) list.push({ step: "details", msg: "Set the triage level" });
    if (t.needsAddress && !form.visitAddress.trim()) list.push({ step: "details", msg: "Enter the visit address" });
    if (t.needsReferral && !form.referringFacility.trim()) list.push({ step: "details", msg: "Enter the referring facility" });
    if (t.needsServices && form.services.length === 0) list.push({ step: "details", msg: "Pick at least one service" });
    if (t.needsPackage && !form.packageId) list.push({ step: "details", msg: "Choose a health check package" });
    if (t.needsTele && !form.teleLink) list.push({ step: "details", msg: "Enter the call link" });
    if (!lockedCase && caseChoice === "new") {
      if (form.complaints.length === 0 && !COMPLAINT_REQUIRED.includes(form.type)) list.push({ step: "case", msg: "Add a complaint to open a new case" });
      if (mlcRequired && !form.medicoLegal) list.push({ step: "case", msg: "Mark the case as medico-legal" });
      if (form.medicoLegal && !form.mlcNumber.trim()) list.push({ step: "case", msg: "Enter the MLC number" });
      if (episodeChoice === "new" && !episodeTitle.trim()) list.push({ step: "case", msg: "Name the new episode" });
    }
    if (!lockedCase && caseChoice !== "new" && mlcRequired && !resolvedCase?.medicoLegal) list.push({ step: "case", msg: "Police cases need a medico-legal case" });
    if (billingMode === "Insurance" && coverageIds.length === 0) list.push({ step: "billing", msg: "Select a coverage, or switch to self pay" });
    if (billingMode === "Insurance" && (form.type === "IP" || form.type === "DAY_CARE") && !form.authNumber.trim() && !authLater)
      list.push({ step: "billing", msg: "Enter the pre-authorization number" });
    if (billingMode === "Corporate" && !form.corporateName.trim()) list.push({ step: "billing", msg: "Enter the company name" });
    return list;
  }, [patient, allowed, form, t, currentAdmission, request, lockedCase, caseChoice, mlcRequired, episodeChoice, episodeTitle, resolvedCase, billingMode, coverageIds, authLater]);

  const idx = STEPS.findIndex((s) => s.id === step);

  const submit = useCallback(async () => {
    setTried(true);
    if (issues.length) {
      setStep(issues[0].step);
      return;
    }
    if (!patient || saving) return;
    setSaving(true);
    const opt = (v: string) => v.trim() || undefined;
    try {
      const result = await store.createEncounter({
        patientId: patient.id,
        type: form.type,
        startType: form.startType,
        priority: form.priority,
        start: new Date(form.start).toISOString(),
        departmentId: form.departmentId,
        practitionerId: opt(form.practitionerId),
        complaints: form.complaints,
        case: lockedCase
          ? undefined
          : caseChoice === "new"
            ? {
                mode: "new",
                title: opt(form.caseTitle),
                provisionalDiagnosis: opt(form.provisionalDiagnosis),
                medicoLegal: form.medicoLegal,
                mlcNumber: form.medicoLegal ? opt(form.mlcNumber) : undefined,
                policeStation: form.medicoLegal ? opt(form.policeStation) : undefined,
                episode: episodeChoice === "new" ? { mode: "new", title: episodeTitle, kind: form.newEpisodeKind || suggestedKind } : { mode: "existing", episodeId: episodeChoice },
              }
            : { mode: "existing", caseId: caseChoice },
        parentEncounterId: t.needsParent ? form.parentEncounterId : undefined,
        admissionRequestId: form.type === "IP" ? form.admissionRequestId : undefined,
        billingMode,
        coverageIds: billingMode === "Insurance" ? coverageIds : [],
        authNumber: opt(form.authNumber),
        corporateName: billingMode === "Corporate" ? opt(form.corporateName) : undefined,
        wardId: t.needsBed ? form.wardId : undefined,
        bed: t.needsBed ? form.bed : undefined,
        admissionReason: form.type === "IP" ? opt(form.admissionReason) : undefined,
        expectedStayDays: form.type === "IP" && form.expectedStayDays ? Number(form.expectedStayDays) : undefined,
        teleChannel: t.needsTele ? form.teleChannel : undefined,
        teleLink: t.needsTele ? form.teleLink : undefined,
        visitAddress: t.needsAddress ? form.visitAddress : undefined,
        visitTeam: t.needsAddress ? form.visitTeam : undefined,
        referringFacility: t.needsReferral ? form.referringFacility : undefined,
        referringDoctor: t.needsReferral ? opt(form.referringDoctor) : undefined,
        referralNote: t.needsReferral ? opt(form.referralNote) : undefined,
        services: t.needsServices ? form.services : [],
        triage: t.needsTriage && form.triage ? form.triage : undefined,
        packageId: t.needsPackage ? form.packageId : undefined,
        broughtBy: form.type === "EMERGENCY" ? opt(form.broughtBy) : undefined,
        broughtByPhone: form.type === "EMERGENCY" ? opt(form.broughtByPhone) : undefined,
      });
      setCreated(result);
      toast({ title: tr("{value0} created", { value0: (result.encounter.code) ?? "" }), body: tr("Case {value0}, {value1}", { value0: (result.kase.code) ?? "", value1: (result.episode.title) ?? "" }) });
    } catch (e) {
      fail(e, "The server did not accept this encounter");
      if (e instanceof ApiRequestError) setStep(stepForField(e.field));
    } finally {
      setSaving(false);
    }
  }, [issues, patient, saving, store, form, lockedCase, caseChoice, episodeChoice, episodeTitle, suggestedKind, t, billingMode, coverageIds, toast, fail]);

  // Ctrl/Cmd+Enter creates the encounter, only while the host's keyboard-shortcut preference is on.
  useHotkeys({ "mod+enter": () => void submit() });

  const stepIssues = (s: Step) => issues.filter((i) => i.step === s).length;
  const visibleTypes = ENCOUNTER_TYPES.filter((et) => allowed.includes(et.code));
  const complaintsRequired = COMPLAINT_REQUIRED.includes(form.type);

  return (
    <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[19rem_minmax(0,1fr)_21rem]">
      <PatientContext patient={patient} onPick={(p) => pickPatient(p.id)} onClear={() => setPatientId("")} />

      {/* ─── Main workspace ─── */}
      <Panel className={cx("flex min-h-[560px] flex-col", !patient && "opacity-60")}>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-line-soft px-3 pt-3">
          {STEPS.map((s, i) => {
            const on = s.id === step;
            const n = stepIssues(s.id);
            return (
              <SourceButton
                key={s.id}
                onClick={() => setStep(s.id)}
                aria-current={on ? "step" : undefined}
                className={cx(
                  "relative flex h-11 shrink-0 items-center gap-2 rounded-t-lg px-4 text-[13.5px] font-semibold transition-colors",
                  on ? "text-ink" : "text-ink-faint hover:text-ink-soft",
                )}
              >
                <span
                  className={cx(
                    "grid size-5 place-items-center rounded-full text-[11px]",
                    tried && n ? "bg-rose-500 text-white" : n === 0 && patient ? "bg-scrub-600 text-white" : on ? "bg-band text-ink" : "bg-canvas text-ink-soft",
                  )}
                >
                  {tried && n ? "!" : n === 0 && patient ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <LocalizedText message={s.label ?? ""} />
                {on && <span className={cx("absolute inset-x-3 -bottom-px h-[3px] rounded-full", t.tone.band)} />}
              </SourceButton>
            );
          })}
          <span className="ml-auto hidden shrink-0 pr-2 text-[12px] text-ink-faint md:block">
            <Kbd><LocalizedText message="Ctrl" /></Kbd> <Kbd><LocalizedText message="Enter" /></Kbd> {" "}<LocalizedText message="to create" /></span>
        </div>

        <div key={step} className="animate-fade scroll-thin min-h-0 flex-1 overflow-auto p-5">
          {step === "visit" && (
            <div className="flex flex-col gap-5">
              {blockedType && servingCounter && (
                <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-950">
                  <ArrowRightLeft className="size-4 shrink-0 text-sky-700" />
                  <p className="min-w-0 flex-1">
                    <b><LocalizedText message={encounterType(blockedType).label ?? ""} /></b> {" "}<LocalizedText message="encounters are opened at" />{" "}<b>{servingCounter.name}</b><LocalizedText message={", not at {value0}."} values={{ value0: (desk?.name) ?? "" }} /></p>
                  <Button size="sm" variant="secondary" onClick={() => store.setCounterId(servingCounter.id)}>
                    <LocalizedText message={"Switch to {value0}"} values={{ value0: (servingCounter.name) ?? "" }} />
                  </Button>
                </div>
              )}

              {/* Encounter types this counter serves, as colour-coded bands */}
              <div>
                <p className="mb-2 text-[12.5px] text-ink-faint">
                  <LocalizedText message="Visit types at" />{" "}<span className="font-semibold text-ink-soft">{desk?.name}</span><LocalizedText message=". Other types are opened at their own counter." /></p>
                <div role="radiogroup" aria-label={tr("Encounter type")} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {visibleTypes.map((et) => {
                    const Icon = TYPE_ICON[et.code];
                    const on = et.code === form.type;
                    return (
                      <SourceButton
                        key={et.code}
                        role="radio"
                        aria-checked={on}
                        onClick={() => chooseType(et.code)}
                        className={cx(
                          "group relative flex flex-col items-start gap-1 overflow-hidden rounded-xl border px-3 pt-3.5 pb-2.5 text-left transition-all",
                          on ? cx("border-transparent ring-2", et.tone.ring, et.tone.soft) : "border-line bg-paper hover:border-ink-faint",
                        )}
                      >
                        <span className={cx("absolute inset-x-0 top-0 h-1", et.tone.band, !on && "opacity-50 group-hover:opacity-100")} />
                        <span className="flex w-full items-center justify-between">
                          <Icon className={cx("size-[18px]", on ? et.tone.text : "text-ink-soft")} />
                          {et.code === "FOLLOW_UP" && fu.parent && <span className="rounded bg-amber-200 px-1 text-[10px] font-bold text-amber-900"><LocalizedText message="Detected" /></span>}
                        </span>
                        <span className={cx("w-full min-w-0 text-[13.5px] leading-tight font-semibold hyphens-manual", on && et.tone.text)}>
                          {tr(et.label).replace("Teleconsultation", "Tele\u00ADconsultation")}
                        </span>
                        <span className="line-clamp-2 text-[11.5px] leading-snug text-ink-faint"><LocalizedText message={et.description} /></span>
                      </SourceButton>
                    );
                  })}
                </div>
              </div>

              {currentAdmission && (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-[13px] text-violet-900">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p className="min-w-0">
                    <span className="font-semibold">
                      <LocalizedText message={"Currently admitted under {value0}"} values={{ value0: (currentAdmission.code) ?? "" }} />
                      {currentAdmission.bed ? tr(", {value0} bed {value1}", { value0: (ward(currentAdmission.wardId)?.name ?? "ward") ?? "", value1: (currentAdmission.bed) ?? "" }) : ""}
                    </span>
                    <LocalizedText message={", admitted {value0}."} values={{ value0: (fmtDate(currentAdmission.start)) ?? "" }} />{" "}
                    {form.type === "IP" ? tr("Discharge or cancel that stay before creating a new admission.") : tr("Other visit types are allowed and will appear on the same record.")}
                  </p>
                </div>
              )}

              {form.type === "IP" && (
                <Field
                  label="Admission request"
                  required
                  hint="Every admission starts from a clinician's request. Cleared requests can be admitted; emergencies can be admitted before clearance."
                  error={tried && !request ? tr("Select the admission request") : undefined}
                >
                  <RequestPicker
                    requests={patientRequests}
                    value={form.admissionRequestId}
                    patientId={patientId}
                    onPick={(r) => setForm((f) => fromRequest(f, r, wardsForCategory, store.encounterById(r.sourceEncounterId)))}
                  />
                </Field>
              )}

              {followUpHere && (
                <FollowUpBanner
                  fu={fu}
                  type={form.type}
                  autoFollow={autoFollow}
                  linkedId={form.parentEncounterId}
                  onApply={() => {
                    setAutoFollow(true);
                    chooseType("FOLLOW_UP");
                  }}
                  onTreatAsNew={() => {
                    setAutoFollow(false);
                    setForm((f) => ({ ...f, type: "OP", startType: "WALK_IN", parentEncounterId: "", followUpDerived: false, caseChoice: "" }));
                  }}
                />
              )}

              {form.type !== "IP" && (
                <Field
                  label={complaintsRequired ? tr("Chief complaint") : tr("Chief complaint (optional)")}
                  required={complaintsRequired}
                  hint={form.type === "FOLLOW_UP" ? tr("The follow-up continues the earlier case. Add complaints only if something new is reported.") : tr("Pick from the list. The first one is the chief complaint; add how long it has lasted.")}
                  error={tried && complaintsRequired && form.complaints.length === 0 ? tr("Select the chief complaint") : undefined}
                >
                  <ComplaintPicker value={form.complaints} onChange={(v) => set("complaints", v)} invalid={tried && complaintsRequired && form.complaints.length === 0} />
                </Field>
              )}

              <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
                <Field label={form.type === "IP" ? tr("Admitting department") : tr("Department")} required error={tried && !form.departmentId ? tr("Choose a department") : undefined}>
                  <Select
                    value={form.departmentId}
                    invalid={tried && !form.departmentId}
                    placeholder="Choose department"
                    onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, practitionerId: "", parentEncounterId: f.followUpDerived ? "" : f.parentEncounterId, caseChoice: "" }))}
                    options={deptOptions(form.type, DEPARTMENTS).map((d) => ({ value: d.id, label: d.name }))}
                  />
                </Field>
                <Field
                  label={form.type === "IP" ? tr("Admitting consultant") : t.needsPractitioner ? tr("Clinician") : tr("Clinician (optional)")}
                  required={t.needsPractitioner}
                  error={tried && t.needsPractitioner && !form.practitionerId ? tr("Choose the clinician") : undefined}
                >
                  <Select
                    value={form.practitionerId}
                    disabled={!form.departmentId}
                    invalid={tried && t.needsPractitioner && !form.practitionerId}
                    placeholder={form.departmentId ? tr("Choose clinician") : tr("Choose department first")}
                    onChange={(e) => set("practitionerId", e.target.value)}
                    options={practitionersFor(form.departmentId)
                      .filter((p) => !t.needsTele || p.tele)
                      .map((p) => ({ value: p.id, label: `${p.name}, ${p.title}` }))}
                  />
                </Field>
                <Field label={form.type === "IP" ? tr("Admission time") : tr("Date and time")} required>
                  <DateTimeInput value={form.start} onChange={(e) => set("start", e.target.value)} />
                </Field>
                <Field label="Priority">
                  <Segmented<Priority>
                    size="md"
                    value={form.priority}
                    onChange={(v) => set("priority", v)}
                    options={(["Routine", "Urgent", "Emergency"] as Priority[]).map((p) => ({ value: p, label: p }))}
                    className="w-full"
                  />
                </Field>
              </div>

              <Field label="How did this encounter start?" required hint={START_TYPES[form.startType].hint}>
                <div className="flex flex-wrap gap-1.5">
                  {t.startTypes.map((s) => (
                    <Chip key={s} on={form.startType === s} onClick={() => setForm((f) => ({ ...f, startType: s, medicoLegal: s === "POLICE_CASE" ? true : f.medicoLegal }))}>
                      <LocalizedText message={START_TYPES[s].label ?? ""} />
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === "details" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <TypeTag type={form.type} />
                <span className="text-[13px] text-ink-faint"><LocalizedText message="Fields below change with the visit type." /></span>
              </div>

              {form.type === "FOLLOW_UP" && (
                <Field label="This visit follows" required error={tried && !form.parentEncounterId ? tr("Link the earlier visit") : undefined}>
                  <ParentPicker
                    candidates={store.encounters
                      .filter((e) => e.patientId === patientId && encounterType(e.type).isConsultation && e.status !== "Cancelled" && new Date(e.start) <= at)
                      .sort((a, b) => b.start.localeCompare(a.start))
                      .slice(0, 6)}
                    value={form.parentEncounterId}
                    derivedId={fu.parent?.id}
                    onChange={(id) => setForm((f) => ({ ...f, parentEncounterId: id, followUpDerived: id === fu.parent?.id }))}
                  />
                </Field>
              )}

              {t.needsTriage && (
                <>
                  <Field label="Triage level" required error={tried && !form.triage ? tr("Set the triage level") : undefined}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {TRIAGE.map((tr) => (
                        <SourceButton
                          key={tr.level}
                          onClick={() => setForm((f) => ({ ...f, triage: tr.level, priority: tr.level === "Level 1" || tr.level === "Level 2" ? "Emergency" : tr.level === "Level 3" ? "Urgent" : "Routine" }))}
                          className={cx("rounded-lg border px-3 py-2 text-left transition-colors", form.triage === tr.level ? tr.tone : "border-line hover:border-ink-faint")}
                        >
                          <span className="block text-[13px] font-bold"><LocalizedText message={tr.level} /></span>
                          <span className="block text-[11.5px] opacity-80"><LocalizedText message={tr.label ?? ""} /></span>
                        </SourceButton>
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Brought in by" hint="Relative, bystander, ambulance crew or police officer">
                      <Input value={form.broughtBy} onChange={(e) => set("broughtBy", e.target.value)} />
                    </Field>
                    <Field label="Their phone">
                      <Input value={form.broughtByPhone} onChange={(e) => set("broughtByPhone", e.target.value)} />
                    </Field>
                  </div>
                </>
              )}

              {t.needsBed && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2fr]">
                  <Field label="Ward" required hint={request ? tr("Requested bed class: {value0}", { value0: tr(request.bedCategory ?? "") }) : undefined}>
                    <Select
                      value={form.wardId}
                      placeholder="Choose ward"
                      onChange={(e) => setForm((f) => ({ ...f, wardId: e.target.value, bed: "" }))}
                      options={WARDS.filter((w) => (form.type === "DAY_CARE" ? w.category === "Day care" : w.category !== "Day care")).map((w) => ({
                        value: w.id,
                        label: `${w.name} (${w.category})${request && w.category === request.bedCategory ? ", matches request" : ""}`,
                      }))}
                    />
                  </Field>
                  <Field label="Bed" required hint="Occupied beds are greyed out" error={tried && !form.bed ? tr("Assign a bed") : undefined}>
                    <div className="flex flex-wrap gap-1.5">
                      {!form.wardId && <span className="py-2 text-[13px] text-ink-faint"><LocalizedText message="Choose a ward to see beds" /></span>}
                      {ward(form.wardId)?.beds.map((b) => {
                        const taken = occupied.has(b);
                        return (
                          <SourceButton
                            key={b}
                            disabled={taken}
                            onClick={() => set("bed", b)}
                            aria-label={taken ? tr("Bed {value0}, occupied", { value0: b }) : tr("Bed {value0}", { value0: b })}
                            className={cx(
                              "h-9 rounded-lg border px-3 text-[13px] font-semibold transition-colors",
                              taken ? "cursor-not-allowed border-line-soft bg-canvas text-ink-faint line-through" : form.bed === b ? "border-violet-600 bg-violet-600 text-white" : "border-line hover:border-violet-400",
                            )}
                          >
                            {b}
                          </SourceButton>
                        );
                      })}
                    </div>
                  </Field>
                  {form.type === "IP" && (
                    <>
                      <Field label="Reason for admission" hint="From the admission request">
                        <Input value={form.admissionReason} onChange={(e) => set("admissionReason", e.target.value)} />
                      </Field>
                      <Field label="Expected stay (days)">
                        <Input type="number" min={1} value={form.expectedStayDays} onChange={(e) => set("expectedStayDays", e.target.value)} className="max-w-32" />
                      </Field>
                    </>
                  )}
                </div>
              )}

              {t.needsTele && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
                  <Field label="Channel">
                    <Segmented<TeleChannel> value={form.teleChannel} onChange={(v) => set("teleChannel", v)} options={(["Video", "Audio", "Chat"] as TeleChannel[]).map((c) => ({ value: c, label: c }))} />
                  </Field>
                  <Field label="Call link" required hint="Sent to the patient by SMS and email">
                    {/* The source's "Create link" invented a placeholder address in the browser; this host has no link service, so the link is entered. */}
                    <Input value={form.teleLink} onChange={(e) => set("teleLink", e.target.value)} placeholder={"https://"} />
                  </Field>
                </div>
              )}

              {t.needsAddress && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
                  <Field label="Visit address" required hint={patient?.address ? tr("Taken from the patient record, edit if different") : undefined}>
                    <Input value={form.visitAddress} onChange={(e) => set("visitAddress", e.target.value)} />
                  </Field>
                  <Field label="Visiting team">
                    <Select value={form.visitTeam} onChange={(e) => set("visitTeam", e.target.value)} options={["Doctor", "Nurse", "Doctor + nurse", "Physio + nurse", "Phlebotomist"].map((x) => ({ value: x, label: x }))} />
                  </Field>
                </div>
              )}

              {t.needsReferral && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Referring facility" required>
                    <Input value={form.referringFacility} onChange={(e) => set("referringFacility", e.target.value)} placeholder="Clinic or hospital name" />
                  </Field>
                  <Field label="Referring doctor">
                    <Input value={form.referringDoctor} onChange={(e) => set("referringDoctor", e.target.value)} />
                  </Field>
                  <Field label="Referral note" className="md:col-span-2">
                    <Input value={form.referralNote} onChange={(e) => set("referralNote", e.target.value)} placeholder="What the referrer is asking for" />
                  </Field>
                </div>
              )}

              {t.needsServices && (
                <Field label="Services" required error={tried && form.services.length === 0 ? tr("Pick at least one service") : undefined}>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICES.map((s) => (
                      <Chip key={s} on={form.services.includes(s)} onClick={() => set("services", form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s])}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                </Field>
              )}

              {t.needsPackage && (
                <Field label="Health check package" required>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {PACKAGES.map((p) => (
                      <SourceButton
                        key={p.id}
                        onClick={() => set("packageId", p.id)}
                        className={cx("rounded-xl border px-3 py-2.5 text-left transition-colors", form.packageId === p.id ? "border-pink-500 bg-pink-50 ring-1 ring-pink-500" : "border-line hover:border-pink-300")}
                      >
                        <span className="block text-[13.5px] font-semibold">{p.name}</span>
                        <span className="block text-[12px] text-ink-faint"><LocalizedText message={"{value0} tests and reviews"} values={{ value0: (p.items) ?? "" }} /></span>
                      </SourceButton>
                    ))}
                  </div>
                </Field>
              )}

              {form.type === "OP" && <p className="rounded-xl bg-canvas p-4 text-[13.5px] text-ink-soft"><LocalizedText message="Nothing extra is needed for an outpatient visit. Continue to the case." /></p>}
            </div>
          )}

          {step === "case" && (
            <div className="flex flex-col gap-4">
              <p className="text-[13.5px] text-ink-soft">
                A <b className="text-ink"><LocalizedText message="case" /></b> {" "}<LocalizedText message="is the clinical problem this visit is for. It holds the chief complaint, gathers its follow-ups and any admission, and sits inside an" />{" "}<b className="text-ink"><LocalizedText message="episode" /></b> {" "}<LocalizedText message="of care." /></p>

              {lockedCase ? (
                <div className="flex flex-col gap-2">
                  <CaseCard c={lockedCase} on locked visits={store.encounters.filter((e) => e.caseId === lockedCase.id).length} episode={store.episodeById(lockedCase.episodeId)} />
                  <p className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
                    <Lock className="size-3.5" />
                    {form.type === "FOLLOW_UP" ? tr("A follow-up continues the case of {value0}.", { value0: (parent?.code) ?? "" }) : tr("This admission continues the case of {value0}.", { value0: (request?.code) ?? "" })}
                  </p>
                </div>
              ) : (
                <div role="radiogroup" aria-label={tr("Case")} className="flex flex-col gap-2">
                  {openCases.map((c) => (
                    <CaseCard
                      key={c.id}
                      c={c}
                      on={caseChoice === c.id}
                      suggested={c.id === suggestedCase}
                      visits={store.encounters.filter((e) => e.caseId === c.id).length}
                      episode={store.episodeById(c.episodeId)}
                      onClick={() => set("caseChoice", c.id)}
                    />
                  ))}
                  <div
                    role="radio"
                    aria-checked={caseChoice === "new"}
                    tabIndex={0}
                    onClick={() => set("caseChoice", "new")}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && set("caseChoice", "new")}
                    className={cx("flex cursor-pointer items-start gap-3 rounded-xl border border-dashed p-3 transition-colors", caseChoice === "new" ? "border-scrub-500 bg-scrub-50/60" : "border-line hover:border-scrub-200")}
                  >
                    <Radio on={caseChoice === "new"} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                        <LocalizedText message="Open a new case" />{suggestedCase === "new" && <Badge tone="bg-band/30 text-amber-900"><Sparkles className="size-3" /> {" "}<LocalizedText message="Suggested" /></Badge>}
                      </p>
                      {caseChoice !== "new" ? (
                        <p className="text-[12.5px] text-ink-faint"><LocalizedText message="For a new problem not covered above." /></p>
                      ) : (
                        <div className="mt-3 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label="Case title" hint="Defaults to the chief complaint">
                              <Input value={form.caseTitle} onChange={(e) => set("caseTitle", e.target.value)} placeholder={complaintTitle || tr("Add a complaint on the Visit step")} />
                            </Field>
                            <Field label="Working diagnosis (optional)">
                              <Input value={form.provisionalDiagnosis} onChange={(e) => set("provisionalDiagnosis", e.target.value)} placeholder="If the clinician has given one" />
                            </Field>
                          </div>
                          {form.complaints.length === 0 && (
                            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                              <AlertCircle className="size-4" /> {" "}<LocalizedText message="A new case needs the chief complaint." />{" "}
                              <SourceButton className="font-semibold underline" onClick={() => setStep("visit")}><LocalizedText message="Add it on the Visit step" /></SourceButton>
                            </p>
                          )}

                          {(form.type === "EMERGENCY" || form.medicoLegal) && (
                            <div className={cx("rounded-xl border p-3", form.medicoLegal ? "border-rose-200 bg-rose-50/50" : "border-line")}>
                              <Checkbox
                                checked={form.medicoLegal}
                                onChange={(v) => set("medicoLegal", v)}
                                label={<span className="flex items-center gap-1.5"><Siren className="size-4 text-rose-600" /> {" "}<LocalizedText message="Medico-legal case" /></span>}
                                sub={mlcRequired ? tr("Required for a police case") : tr("Assault, road traffic injury, poisoning, burns and similar cases that must be reported")}
                              />
                              {form.medicoLegal && (
                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <Field label="MLC number" required error={tried && !form.mlcNumber.trim() ? tr("Enter the MLC number") : undefined}>
                                    <Input value={form.mlcNumber} onChange={(e) => set("mlcNumber", e.target.value.toUpperCase())} placeholder="MLC-" />
                                  </Field>
                                  <Field label="Police station informed">
                                    <Input value={form.policeStation} onChange={(e) => set("policeStation", e.target.value)} />
                                  </Field>
                                </div>
                              )}
                            </div>
                          )}

                          <Field label="Episode of care" hint="The longer-running care this problem belongs to">
                            <div className="flex flex-col gap-1.5">
                              {patientEpisodes.map((ep) => (
                                <SourceButton
                                  key={ep.id}
                                  onClick={() => set("episodeChoice", ep.id)}
                                  className={cx("flex items-center gap-3 rounded-lg border px-3 py-2 text-left", episodeChoice === ep.id ? "border-scrub-500 bg-paper ring-1 ring-scrub-500" : "border-line bg-paper hover:border-scrub-200")}
                                >
                                  <Radio on={episodeChoice === ep.id} />
                                  <FolderHeart className="size-4 text-scrub-600" />
                                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                                    <b>{ep.title}</b> <span className="text-ink-faint">{ep.code}, {department(ep.departmentId)?.name}</span>
                                  </span>
                                  {ep.id === suggestedEpisode && <Badge tone="bg-band/30 text-amber-900"><LocalizedText message="Same department" /></Badge>}
                                  {ep.status === "On hold" && <Badge tone="bg-canvas text-ink-soft"><LocalizedText message="On hold, will reopen" /></Badge>}
                                </SourceButton>
                              ))}
                              <div className={cx("rounded-lg border px-3 py-2", episodeChoice === "new" ? "border-scrub-500 bg-paper ring-1 ring-scrub-500" : "border-dashed border-line bg-paper")}>
                                <SourceButton onClick={() => set("episodeChoice", "new")} className="flex w-full items-center gap-3 text-left">
                                  <Radio on={episodeChoice === "new"} />
                                  <span className="text-[13.5px] font-semibold"><LocalizedText message="Start a new episode" /></span>
                                </SourceButton>
                                {episodeChoice === "new" && (
                                  <div className="mt-2 grid grid-cols-1 gap-3 pl-8 sm:grid-cols-[2fr_1fr]">
                                    <Field label="Episode name">
                                      <Input value={form.newEpisodeTitle} onChange={(e) => set("newEpisodeTitle", e.target.value)} placeholder={episodeTitle} />
                                    </Field>
                                    <Field label="Kind of care">
                                      <Select value={form.newEpisodeKind || suggestedKind} onChange={(e) => set("newEpisodeKind", e.target.value as EpisodeKind)} options={KINDS.map((k) => ({ value: k, label: k }))} />
                                    </Field>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Field>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "billing" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Segmented<BillingMode>
                  ariaLabel="Billing"
                  value={billingMode}
                  onChange={(v) => set("billingMode", v)}
                  options={[
                    { value: "Insurance", label: "Insurance" },
                    { value: "Self pay", label: "Self pay" },
                    { value: "Corporate", label: "Corporate" },
                  ]}
                />
                {form.type === "FOLLOW_UP" && form.parentEncounterId && (
                  <Badge tone={fu.state === "free" && form.parentEncounterId === fu.parent?.id ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}>
                    {fu.state === "free" && form.parentEncounterId === fu.parent?.id ? tr("Free follow-up, no consultation fee") : tr("Paid follow-up")}
                  </Badge>
                )}
                {request && <Badge tone="bg-violet-50 text-violet-800"><LocalizedText message={"Billing taken from {value0}"} values={{ value0: (request.code) ?? "" }} /></Badge>}
              </div>

              {billingMode === "Insurance" && (
                <>
                  {!patient?.coverages.length && <p className="rounded-xl bg-canvas p-4 text-[13.5px] text-ink-soft"><LocalizedText message="This patient has no insurance on file. Add it from their record, or bill as self pay." /></p>}
                  <div className="flex flex-col gap-2">
                    {patient?.coverages.map((c) => {
                      const chk = coverageCheck(c);
                      const on = coverageIds.includes(c.id);
                      return (
                        <div key={c.id} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5", !chk.ok ? "border-line-soft bg-canvas/60" : on ? "border-scrub-500 bg-scrub-50" : "border-line")}>
                          <Checkbox
                            checked={on && chk.ok}
                            onChange={(v) => chk.ok && set("coverageIds", v ? [...coverageIds, c.id] : coverageIds.filter((x) => x !== c.id))}
                            label={<span><LocalizedText message={c.priority} />: {payer(c.payerId)?.name}</span>}
                            sub={tr("{value0}, {value1}, member {value2}", { value0: (network(c.networkId)?.name) ?? "", value1: (plan(c.planId)?.name) ?? "", value2: (c.memberId) ?? "" })}
                          />
                          <span className="ml-auto shrink-0">
                            <Badge tone={chk.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{chk.ok ? tr("Eligible, {value0}", { value0: (chk.note) ?? "" }) : chk.note}</Badge>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(form.type === "IP" || form.type === "DAY_CARE") && (
                    <Field
                      label="Pre-authorization number"
                      required={!authLater}
                      hint={authLater ? tr("Emergency admission: the authorization can follow within the insurer's deadline") : tr("Issued by the insurer or TPA before admission")}
                      className="max-w-sm"
                    >
                      <Input value={form.authNumber} onChange={(e) => set("authNumber", e.target.value.toUpperCase())} placeholder="AUTH-" />
                    </Field>
                  )}
                </>
              )}
              {billingMode === "Corporate" && (
                <Field label="Company" required className="max-w-sm">
                  <Input value={form.corporateName} onChange={(e) => set("corporateName", e.target.value)} placeholder="Employer paying for the visit" />
                </Field>
              )}
              {billingMode === "Self pay" && (
                <p className="rounded-xl bg-canvas p-4 text-[13.5px] text-ink-soft">
                  {request && !request.depositCollected && form.type === "IP" ? tr("The admission deposit has not been collected yet. Collect it at the cash counter after admission.") : tr("The patient pays at the counter. Insurance can be attached later before the bill is closed.")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line-soft px-5 py-3">
          <Button variant="ghost" disabled={idx === 0} onClick={() => setStep(STEPS[idx - 1].id)}>
            <ChevronLeft className="size-4" /> <span className="hidden sm:inline"><LocalizedText message="Back" /></span>
          </Button>
          <div className="ml-auto flex gap-2">
            {idx < STEPS.length - 1 && (
              <Button variant="secondary" onClick={() => setStep(STEPS[idx + 1].id)}>
                <span className="hidden sm:inline"><LocalizedText message={"Next: {value0}"} values={{ value0: tr(STEPS[idx + 1].label ?? "") }} /></span>
                <span className="sm:hidden"><LocalizedText message="Next" /></span> <ChevronRight className="size-4" />
              </Button>
            )}
            <Button onClick={() => void submit()} disabled={!patient || saving} className="2xl:hidden">
              {saving ? tr("Creating") : form.type === "IP" ? tr("Admit patient") : tr("Create encounter")}
            </Button>
          </div>
        </div>
      </Panel>

      {/* ─── Encounter slip ─── */}
      <aside className="hidden min-h-0 flex-col gap-4 2xl:flex">
        <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={cx("h-2 shrink-0", t.tone.band)} />
          <div className="scroll-thin min-h-0 flex-1 overflow-auto p-4">
            <p className="text-[12.5px] text-ink-faint"><LocalizedText message={"Encounter slip, {value0}"} values={{ value0: (desk?.name) ?? "" }} /></p>
            <p className="mt-0.5 text-lg font-bold tracking-tight">{patient ? fullName(patient) : tr("No patient yet")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TypeTag type={form.type} />
              <Badge tone="bg-canvas text-ink-soft"><LocalizedText message={START_TYPES[form.startType].label ?? ""} /></Badge>
              {form.priority !== "Routine" && <Badge tone="bg-rose-50 text-rose-700"><LocalizedText message={form.priority ?? ""} /></Badge>}
            </div>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <SlipRow k="When" v={fmtDateTime(new Date(form.start).toISOString())} />
              {form.type === "IP" && <SlipRow k="Request" v={request ? `${request.code}, ${tr(request.urgency)}` : undefined} />}
              <SlipRow k="Complaint" v={form.complaints.map((c) => c.label + (c.duration ? ` (${c.duration} ${c.unit})` : "")).join(", ") || (lockedCase ? lockedCase.complaints.map((c) => c.label).join(", ") : undefined)} />
              <SlipRow k="Department" v={dept?.name} />
              <SlipRow k="Clinician" v={practitioner(form.practitionerId)?.name} />
              {form.type === "FOLLOW_UP" && (
                <SlipRow
                  k="Follows"
                  v={parent ? `${parent.code}, ${relativeDay(parent.start, at)}` : undefined}
                  extra={form.followUpDerived ? <Badge tone="bg-band/30 text-amber-900"><Sparkles className="size-3" /> {" "}<LocalizedText message="Derived" /></Badge> : undefined}
                />
              )}
              {t.needsBed && <SlipRow k="Bed" v={form.bed ? `${ward(form.wardId)?.name}, ${form.bed}` : undefined} />}
              {t.needsTriage && <SlipRow k="Triage" v={form.triage || undefined} />}
              {t.needsServices && <SlipRow k="Services" v={form.services.length ? form.services.join(", ") : undefined} />}
              {t.needsPackage && <SlipRow k="Package" v={healthPackage(form.packageId)?.name} />}
              {t.needsTele && <SlipRow k="Call" v={form.teleLink ? tr("{value0} link ready", { value0: tr(form.teleChannel) }) : undefined} />}
              <SlipRow
                k="Case"
                v={caseChoice === "new" ? (caseTitle ? tr("New: {value0}", { value0: caseTitle }) : undefined) : resolvedCase ? `${resolvedCase.code}, ${resolvedCase.title}` : undefined}
                extra={<Link2 className="size-3.5 text-scrub-600" />}
              />
              <SlipRow
                k="Episode"
                v={
                  caseChoice !== "new"
                    ? store.episodeById(resolvedCase?.episodeId)?.title
                    : episodeChoice === "new"
                      ? tr("New: {value0}", { value0: episodeTitle })
                      : patientEpisodes.find((e) => e.id === episodeChoice)?.title
                }
              />
              <SlipRow
                k="Billing"
                v={
                  billingMode === "Insurance"
                    ? coverageIds.map((id) => payer(patient?.coverages.find((c) => c.id === id)?.payerId)?.short).filter(Boolean).join(" then ") || undefined
                    : billingMode === "Corporate"
                      ? form.corporateName || undefined
                      : "Self pay"
                }
              />
            </dl>
          </div>
          <div className="border-t border-line-soft p-4">
            {issues.length > 0 ? (
              <div className="mb-3 space-y-1">
                <p className="text-[12.5px] font-semibold text-ink-soft"><LocalizedText message={issues.length === 1 ? "{value0} thing left" : "{value0} things left"} values={{ value0: issues.length }} /></p>
                {issues.slice(0, 5).map((i) => (
                  <SourceButton key={i.msg} onClick={() => setStep(i.step)} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-[12.5px] text-ink-soft hover:bg-canvas">
                    <AlertCircle className="size-3.5 shrink-0 text-amber-500" /> <Copy>{i.msg}</Copy>
                  </SourceButton>
                ))}
              </div>
            ) : (
              <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
                <Check className="size-4" /> {" "}<LocalizedText message="Ready to create" /></p>
            )}
            <Button size="lg" className="w-full" onClick={() => void submit()} disabled={!patient || saving}>
              {saving ? tr("Creating") : form.type === "IP" ? tr("Admit patient") : tr("Create encounter")}
            </Button>
          </div>
        </Panel>
      </aside>

      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title={created?.encounter.type === "IP" ? tr("Patient admitted") : tr("Encounter created")}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => router.push(created?.encounter.type === "IP" ? medbandPaths.admissions() : medbandPaths.today())}>
              {created?.encounter.type === "IP" ? tr("Back to admissions") : tr("Back to today")}
            </Button>
            <Button variant="secondary" onClick={() => created && router.push(medbandPaths.patient(created.encounter.patientId))}><LocalizedText message="Open patient record" /></Button>
            <Button
              onClick={() => {
                setCreated(null);
                setTried(false);
                setAutoFollow(true);
                setStep("visit");
                setForm(initialForm(allowed[0]));
              }}
            >
              <LocalizedText message="Another for this patient" /></Button>
          </>
        }
      >
        {created && (
          <div className="flex flex-col gap-3">
            <div className={cx("flex items-center gap-3 rounded-xl p-3", encounterType(created.encounter.type).tone.soft)}>
              <TypeTag type={created.encounter.type} />
              <span className="text-lg font-bold">{created.encounter.code}</span>
              <span className="ml-auto"><StatusPill status={created.encounter.status} /></span>
            </div>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5 text-[13.5px]">
              <dt className="text-ink-faint"><LocalizedText message="Case" /></dt>
              <dd><b>{created.kase.code}</b>, {created.kase.title}{created.kase.medicoLegal && <Badge className="ml-2" tone="bg-rose-50 text-rose-700"><LocalizedText message={"MLC {value0}"} values={{ value0: (created.kase.mlcNumber) ?? "" }} /></Badge>}</dd>
              <dt className="text-ink-faint"><LocalizedText message="Episode" /></dt>
              <dd><b>{created.episode.code}</b>, {created.episode.title}</dd>
              {created.encounter.parentEncounterId && (
                <>
                  <dt className="text-ink-faint"><LocalizedText message="Follows" /></dt>
                  <dd>{store.encounterById(created.encounter.parentEncounterId)?.code}{created.encounter.followUpChargeable === false && tr(", free follow-up")}</dd>
                </>
              )}
              {created.encounter.bed && (
                <>
                  <dt className="text-ink-faint"><LocalizedText message="Bed" /></dt>
                  <dd>{ward(created.encounter.wardId)?.name}, {created.encounter.bed}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

function deptOptions(type: EncounterType, departments: Master["DEPARTMENTS"]) {
  if (type === "NO_CONSULT" || type === "OUTSIDE") return [...departments].sort((a, b) => Number(a.consults) - Number(b.consults));
  return departments.filter((d) => d.consults);
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={cx("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2", on ? "border-scrub-600" : "border-line")}>
      {on && <span className="size-2 rounded-full bg-scrub-600" />}
    </span>
  );
}

function CaseCard({ c, on, suggested, locked, visits, episode, onClick }: { c: Case; on: boolean; suggested?: boolean; locked?: boolean; visits: number; episode?: Episode; onClick?: () => void }) {
  const { department } = useMaster();
  const { fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  return (
    <SourceButton
      role="radio"
      aria-checked={on}
      disabled={locked}
      onClick={onClick}
      className={cx("flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-scrub-500 bg-scrub-50 ring-1 ring-scrub-500" : "border-line hover:border-scrub-200", locked && "cursor-default")}
    >
      {locked ? <Lock className="mt-0.5 size-4 shrink-0 text-scrub-600" /> : <Radio on={on} />}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <Stethoscope className="size-4 text-scrub-600" />
          <span className="text-[14px] font-semibold">{c.title}</span>
          <span className="text-[12px] text-ink-faint">{c.code}</span>
          {suggested && <Badge tone="bg-band/30 text-amber-900"><Sparkles className="size-3" /> {" "}<LocalizedText message="Suggested" /></Badge>}
          {c.medicoLegal && <Badge tone="bg-rose-50 text-rose-700"><Siren className="size-3" /> {" "}<LocalizedText message={"MLC {value0}"} values={{ value0: (c.mlcNumber) ?? "" }} /></Badge>}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {c.complaints.map((x) => (
            <span key={x.code + x.label} className="rounded-full bg-paper px-2 py-0.5 text-[11.5px] font-medium text-scrub-800 ring-1 ring-scrub-100"><LocalizedText message={x.label ?? ""} /></span>
          ))}
        </span>
        <span className="mt-1 block text-[12px] text-ink-faint">
          <LocalizedText message={visits === 1 ? "In {value0}, {value1}, {value2} visit, opened {value3}" : "In {value0}, {value1}, {value2} visits, opened {value3}"} values={{ value0: episode?.title ?? tr("episode"), value1: department(c.departmentId)?.name ?? "", value2: visits, value3: fmtDate(c.openedAt) }} />
        </span>
      </span>
    </SourceButton>
  );
}

function RequestPicker({ requests, value, patientId, onPick }: { requests: AdmissionRequest[]; value: string; patientId: string; onPick: (r: AdmissionRequest) => void }) {
  const { department, practitioner } = useMaster();
  const { fmtDateTime } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  if (!patientId) return <p className="rounded-xl bg-canvas p-3 text-[13px] text-ink-soft"><LocalizedText message="Pick the patient to see their admission requests." /></p>;
  if (requests.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line p-4">
        <BedDouble className="size-5 text-violet-600" />
        <p className="min-w-0 flex-1 text-[13px] text-ink-soft"><LocalizedText message="No open admission request for this patient. The admitting clinician raises one first, from a clinic or ER visit or as an elective booking." /></p>
        <LinkButton size="sm" variant="secondary" href={medbandPaths.admissionNew({ patientId: patientId })}><LocalizedText message="Create admission request" /></LinkButton>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
      {requests.map((r) => {
        const ok = canAdmit(r);
        const on = r.id === value;
        const kase = store.caseById(r.caseId);
        return (
          <SourceButton
            key={r.id}
            disabled={!ok}
            onClick={() => onPick(r)}
            className={cx(
              "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
              !ok ? "cursor-not-allowed border-line-soft bg-canvas/60" : on ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-line hover:border-violet-300",
            )}
          >
            <Radio on={on} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13.5px] font-bold">{r.code}</span>
                <Badge tone={URGENCY_TONE[r.urgency]}><LocalizedText message={r.urgency ?? ""} /></Badge>
                <Badge tone={REQUEST_TONE[r.status]}>{r.status === "Ready" ? tr("Cleared") : tr("Pending")}</Badge>
              </span>
              <span className="mt-0.5 block text-[13px] font-medium">{r.reason}</span>
              <span className="block text-[12px] text-ink-soft">
                <LocalizedText message={"{value0}, {value1}, {value2} bed, {value3} days"} values={{ value0: (department(r.admittingDepartmentId)?.name) ?? "", value1: (practitioner(r.admittingPractitionerId)?.name) ?? "", value2: tr(r.bedCategory ?? ""), value3: (r.expectedStayDays) ?? "" }} /></span>
              <span className="block text-[12px] text-ink-faint"><LocalizedText message={"Planned {value0}, case {value1}"} values={{ value0: (fmtDateTime(r.plannedDate)) ?? "", value1: (kase?.code) ?? "" }} /></span>
              {r.status === "Pending" && (
                <span className={cx("mt-1 flex items-center gap-1 text-[12px] font-medium", ok ? "text-rose-700" : "text-amber-800")}>
                  <AlertCircle className="size-3.5" />
                  {ok ? tr("Emergency: can be admitted now, {value0}", { value0: (pendingReason(r, tr)) ?? "" }) : tr("Not cleared: {value0}", { value0: (pendingReason(r, tr)) ?? "" })}
                </span>
              )}
            </span>
          </SourceButton>
        );
      })}
      {requests.some((r) => !canAdmit(r)) && (
        <Link href={medbandPaths.admissions()} className="flex items-center gap-1 text-[12.5px] font-semibold text-scrub-700 hover:underline xl:col-span-2">
          <RotateCcw className="size-3.5" /> {" "}<LocalizedText message="Clear pending requests in the admissions queue" /></Link>
      )}
    </div>
  );
}

function SlipRow({ k, v, extra }: { k: string; v?: string; extra?: React.ReactNode }) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-ink-faint"><Copy>{k}</Copy></dt>
      <dd className={cx("flex min-w-0 flex-1 items-start gap-1.5", v ? "font-medium" : "text-ink-faint")}>
        <span className="min-w-0 break-words"><Copy>{v || tr("Not set")}</Copy></span>
        {v && extra}
      </dd>
    </div>
  );
}

function FollowUpBanner({
  fu,
  type,
  autoFollow,
  linkedId,
  onApply,
  onTreatAsNew,
}: {
  fu: ReturnType<typeof deriveFollowUp>;
  type: EncounterType;
  autoFollow: boolean;
  linkedId: string;
  onApply: () => void;
  onTreatAsNew: () => void;
}) {
  const { department, practitioner } = useMaster();
  const { t: tr } = useLocalization();
  if (!["OP", "FOLLOW_UP", "TELE"].includes(type)) return null;
  if (fu.state === "not-applicable") return null;

  if (!fu.parent) {
    if (type !== "FOLLOW_UP") return fu.message && fu.windowDays ? <p className="-mt-1 text-[12.5px] text-ink-faint">{fu.message}</p> : null;
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p><LocalizedText message={"{value0} You can still link an older visit on the Details step; it will be billed as a paid follow-up."} values={{ value0: (fu.message) ?? "" }} /></p>
      </div>
    );
  }

  const p = fu.parent;
  const applied = type === "FOLLOW_UP" && linkedId === p.id;
  return (
    <div className={cx("animate-rise flex flex-wrap items-center gap-3 rounded-xl px-4 py-3", applied ? "bg-amber-50 ring-1 ring-amber-300" : "bg-paper ring-1 ring-amber-300")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-band text-ink">
        <RotateCcw className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">
          {applied ? tr("Set as a follow-up of ") : tr("Follow-up available for ")}
          <LocalizedText message={"{value0}, {value1} with"} values={{ value0: (p.code) ?? "", value1: (department(p.departmentId)?.name) ?? "" }} />{" "}{practitioner(p.practitionerId)?.name ?? tr("the team")}, {fu.daysSince === 0 ? tr("today") : tr("{value0} days ago", { value0: (fu.daysSince) ?? "" })}
        </p>
        <p className="text-[12.5px] text-ink-soft">
          {fu.message}
          {!fu.sameDoctor && tr(" A different clinician is selected; the visit still counts as a follow-up for this department.")}
        </p>
      </div>
      {applied ? (
        <Button size="sm" variant="ghost" onClick={onTreatAsNew}>
          <Undo2 className="size-3.5" /> {" "}<LocalizedText message="Treat as new visit" /></Button>
      ) : (
        <Button size="sm" variant="band" onClick={onApply}>
          {autoFollow ? tr("Apply follow-up") : tr("Use follow-up")}
        </Button>
      )}
    </div>
  );
}

function ParentPicker({ candidates, value, derivedId, onChange }: { candidates: Encounter[]; value: string; derivedId?: string; onChange: (id: string) => void }) {
  const { department, practitioner } = useMaster();
  const { fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  if (candidates.length === 0) return <p className="rounded-xl bg-canvas p-3 text-[13px] text-ink-soft"><LocalizedText message="No earlier consultation for this patient. Choose Outpatient instead." /></p>;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {candidates.map((e) => {
        const on = e.id === value;
        return (
          <SourceButton
            key={e.id}
            onClick={() => onChange(e.id)}
            className={cx("flex items-start gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400" : "border-line hover:border-amber-300")}
          >
            <Radio on={on} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13.5px] font-semibold">{e.code}</span>
                <TypeTag type={e.type} withLabel={false} />
                {e.id === derivedId && <Badge tone="bg-band/30 text-amber-900"><Sparkles className="size-3" /> {" "}<LocalizedText message="In free window" /></Badge>}
              </span>
              <span className="block truncate text-[12.5px] text-ink-soft">
                {department(e.departmentId)?.name}, {practitioner(e.practitionerId)?.name ?? tr("team")}
              </span>
              <span className="block truncate text-[12px] text-ink-faint">
                {fmtDate(e.start)}, {e.chiefComplaint ?? tr("consultation")}
              </span>
            </span>
          </SourceButton>
        );
      })}
    </div>
  );
}
