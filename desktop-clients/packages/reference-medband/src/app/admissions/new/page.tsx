"use client";

import { AlertCircle, BedDouble, Check, FolderHeart, Lock, RefreshCw, Stethoscope } from "lucide-react";
import { useRouter, useSearchParams } from "../../../lib/navigation";
import { Suspense, useMemo, useState } from "react";
import { computeRequestStatus, pendingReason, SPECIAL_NEEDS } from "../../../lib/admission";
import { ApiRequestError } from "../../../lib/api";
import { encounterType } from "../../../lib/encounter-config";
import { useStore } from "../../../lib/store";
import type { AdmissionRequest, AdmissionUrgency, BedCategory, BillingMode, ComplaintEntry, EpisodeKind, Isolation } from "../../../lib/types";
import { coverageActive, cx, fullName, toDateTimeInput } from "../../../lib/utils";
import { ComplaintPicker } from "../../../components/encounter/complaint-picker";
import { TypeTag } from "../../../components/encounter/type-tag";
import { PatientPicker } from "../../../components/patient/patient-picker";
import { Wristband } from "../../../components/patient/wristband";
import { Checkbox, Chip, DateTimeInput, Field, Input, Segmented, Select, Textarea } from "../../../components/ui/form";
import { Modal, useErrorToast, useToast } from "../../../components/ui/overlay";
import { Badge, Button, Panel } from "../../../components/ui/primitives";
import { SourceButton } from "../../../components/controls";
import { useReferenceHost } from "@pepbits/reference-host";
import { useMaster } from "../../../lib/master";
import { useMedbandFormat } from "../../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Copy } from "../../../components/copy";
import { medbandPaths } from "../../../routes";

type RequestBed = Exclude<BedCategory, "Day care" | "Observation">;
const CATEGORIES: RequestBed[] = ["General", "Semi-private", "Private", "ICU", "Maternity"];
const KINDS: EpisodeKind[] = ["Acute illness", "Chronic care", "Maternity", "Surgical", "Rehabilitation", "Preventive", "Oncology"];

export default function NewAdmissionRequestPage() {
  return (
    <Suspense>
      <NewAdmissionRequest />
    </Suspense>
  );
}

function NewAdmissionRequest() {
  /** The estimate is typed in the host currency (the backend reports none of its own). */
  const { currencyCode } = useReferenceHost().preferences;
  const { DEPARTMENTS, PRACTITIONERS, WARDS, department, payer, plan, practitioner, practitionersFor } = useMaster();
  const { fmtDate, fmtDateTime } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const fail = useErrorToast();

  const [patientId, setPatientId] = useState(params.get("patientId") ?? "");
  const [sourceId, setSourceId] = useState<string>(() => {
    const from = store.encounterById(params.get("fromEncounter") ?? undefined);
    return from?.id ?? (params.get("case") ? "none" : "");
  });
  const [caseChoice, setCaseChoice] = useState(params.get("case") ?? "");
  const [complaints, setComplaints] = useState<ComplaintEntry[]>([]);
  const [episodeChoice, setEpisodeChoice] = useState("");
  const [newEpisode, setNewEpisode] = useState({ title: "", kind: "Surgical" as EpisodeKind });

  const [requestedById, setRequestedById] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [consultantId, setConsultantId] = useState("");
  const [urgency, setUrgency] = useState<AdmissionUrgency>("Elective");
  const [plannedDate, setPlannedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return toDateTimeInput(d);
  });
  const [stay, setStay] = useState("2");
  const [reason, setReason] = useState("");
  const [procedure, setProcedure] = useState("");
  const [bedCategory, setBedCategory] = useState<RequestBed>("General");
  const [isolation, setIsolation] = useState<Isolation>("None");
  const [needs, setNeeds] = useState<string[]>([]);
  const [billingMode, setBillingMode] = useState<BillingMode | "">("");
  const [coverageId, setCoverageId] = useState("");
  const [authNumber, setAuthNumber] = useState("");
  const [estimate, setEstimate] = useState("");
  const [deposit, setDeposit] = useState(false);
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<AdmissionRequest | null>(null);

  const patient = store.patientById(patientId);
  const planned = new Date(plannedDate || Date.now());

  // Visits an admission is usually requested from: recent consultations and ER visits.
  const sources = useMemo(
    () =>
      store.encounters
        .filter((e) => e.patientId === patientId && ["OP", "FOLLOW_UP", "EMERGENCY", "TELE"].includes(e.type) && e.status !== "Cancelled")
        .filter((e) => Date.now() - new Date(e.start).getTime() < 30 * 86_400_000)
        .sort((a, b) => b.start.localeCompare(a.start))
        .slice(0, 5),
    [store.encounters, patientId],
  );
  const source = store.encounterById(sourceId === "none" ? undefined : sourceId);
  const openCases = store.cases.filter((c) => c.patientId === patientId && c.status === "Open");
  const sourceCase = source ? store.caseById(source.caseId) : undefined;
  const chosenCase = sourceCase ?? (caseChoice && caseChoice !== "new" ? store.caseById(caseChoice) : undefined);
  const newCase = !sourceCase && (caseChoice === "new" || (!caseChoice && openCases.length === 0));
  const episodes = store.episodes.filter((e) => e.patientId === patientId && e.status !== "Closed");
  const episodeSel = episodeChoice || episodes.find((e) => e.departmentId === departmentId)?.id || "new";
  const openRequestOnCase = chosenCase && store.admissionRequests.find((r) => r.caseId === chosenCase.id && (r.status === "Pending" || r.status === "Ready"));
  const admitted = store.encounters.find((e) => e.patientId === patientId && e.type === "IP" && ["Planned", "Arrived", "In progress"].includes(e.status));

  const eligible = (patient?.coverages ?? []).filter((c) => coverageActive(c, planned) && plan(c.planId)?.ipCovered);
  const mode: BillingMode = billingMode || (eligible.length ? "Insurance" : "Self pay");
  const cov = coverageId || eligible[0]?.id || "";

  const previewStatus = computeRequestStatus({ billingMode: mode, authStatus: mode === "Insurance" ? (authNumber.trim() ? "Approved" : "Pending") : "Not required", depositCollected: deposit });
  const freeBeds = (cat: RequestBed) => {
    const occupied = new Set(store.encounters.filter((e) => e.bed && ["Planned", "Arrived", "In progress"].includes(e.status)).map((e) => e.bed!));
    return WARDS.filter((w) => w.category === cat).flatMap((w) => w.beds).filter((b) => !occupied.has(b)).length;
  };

  const pickPatient = (id: string) => {
    setPatientId(id);
    setSourceId("");
    setCaseChoice("");
    setEpisodeChoice("");
    setCoverageId("");
    setBillingMode("");
  };
  const pickSource = (id: string) => {
    setSourceId(id);
    const e = store.encounterById(id);
    if (e) {
      if (!requestedById && e.practitionerId) setRequestedById(e.practitionerId);
      if (e.type === "EMERGENCY") setUrgency("Emergency");
    }
  };

  const issues = [
    !patient && "Pick the patient",
    admitted && `Already admitted under ${admitted.code}`,
    !sourceId && "Choose where the request comes from",
    sourceId === "none" && !chosenCase && !newCase && "Choose the case",
    newCase && complaints.length === 0 && "Add the chief complaint for the new case",
    openRequestOnCase && `${chosenCase?.code} already has ${openRequestOnCase.code}`,
    !requestedById && "Choose the requesting clinician",
    !departmentId && "Choose the admitting department",
    !consultantId && "Choose the admitting consultant",
    !reason.trim() && "Enter the reason for admission",
    !Number(stay) && "Enter the expected stay",
    mode === "Insurance" && !cov && "Choose the coverage, or bill as self pay",
  ].filter(Boolean) as string[];

  const submit = async () => {
    setTried(true);
    if (issues.length || !patient || saving) return;
    setSaving(true);
    try {
      const r = await store.createAdmissionRequest({
        patientId: patient.id,
        sourceEncounterId: source?.id,
        case: source
          ? undefined
          : newCase
            ? { mode: "new", medicoLegal: false, episode: episodeSel === "new" ? { mode: "new", title: newEpisode.title.trim() || reason.trim() || complaints[0]?.label, kind: newEpisode.kind } : { mode: "existing", episodeId: episodeSel } }
            : { mode: "existing", caseId: chosenCase!.id },
        complaints: newCase ? complaints : [],
        requestedById,
        admittingDepartmentId: departmentId,
        admittingPractitionerId: consultantId,
        urgency,
        plannedDate: new Date(plannedDate).toISOString(),
        expectedStayDays: Number(stay),
        bedCategory,
        isolation,
        reason: reason.trim(),
        plannedProcedure: procedure.trim() || undefined,
        specialNeeds: needs,
        billingMode: mode,
        coverageId: mode === "Insurance" ? cov : undefined,
        authNumber: mode === "Insurance" ? authNumber.trim() || undefined : undefined,
        estimatedCost: estimate ? Number(estimate) : undefined,
        depositCollected: mode === "Self pay" ? deposit : false,
        notes: notes.trim() || undefined,
      });
      setCreated(r);
      toast({ title: tr("{value0} requested", { value0: (r.code) ?? "" }), body: r.status === "Ready" ? tr("Cleared and ready to admit") : tr("Pending: {value0}", { value0: (pendingReason(r, tr)) ?? "" }) });
    } catch (e) {
      fail(e, "The server did not accept this request");
      if (e instanceof ApiRequestError && e.field) document.getElementById(`sec-${e.field.split(".")[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setSaving(false);
    }
  };

  const show = (cond: boolean, msg: string) => (tried && cond ? msg : undefined);

  return (
    <div className="mx-auto grid h-full max-w-[1500px] grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Panel className="scroll-thin min-h-0 overflow-auto">
        <div className="border-b border-line-soft px-5 py-4">
          <h1 className="text-xl font-bold tracking-tight"><LocalizedText message="Admission request" /></h1>
          <p className="text-[13.5px] text-ink-soft"><LocalizedText message="Raised by the admitting clinician. The admissions desk clears it with the insurer or cashier and admits the patient to a bed." /></p>
        </div>

        <div className="flex flex-col gap-6 p-5">
          {/* 1. Patient */}
          <Section n={1} title="Patient">
            {patient ? (
              <div className="flex flex-wrap items-center gap-3">
                <Wristband patient={patient} size="sm" className="min-w-0 flex-1 basis-80" />
                <Button size="sm" variant="ghost" onClick={() => pickPatient("")}>
                  <RefreshCw className="size-3.5" /> {" "}<LocalizedText message="Change" /></Button>
              </div>
            ) : (
              <PatientPicker autoFocus onPick={(p) => pickPatient(p.id)} />
            )}
            {admitted && (
              <p className="mt-2 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-[13px] text-violet-900">
                <AlertCircle className="size-4" /> {" "}<LocalizedText message={"Already admitted under {value0}, bed {value1}. A new request can be raised after discharge."} values={{ value0: (admitted.code) ?? "", value1: (admitted.bed) ?? "" }} /></p>
            )}
          </Section>

          {/* 2. Source and case */}
          {patient && (
            <Section n={2} title="Requested from" id="sec-case">
              <p className="mb-2 text-[13px] text-ink-soft"><LocalizedText message="The admission joins the case of the visit it was requested from, so the stay, the clinic visit and its follow-ups stay together." /></p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {sources.map((e) => (
                  <Option key={e.id} on={sourceId === e.id} onClick={() => pickSource(e.id)}>
                    <span className="flex items-center gap-1.5">
                      <TypeTag type={e.type} withLabel={false} />
                      <span className="text-[13.5px] font-semibold">{e.code}</span>
                      <span className="text-[12px] text-ink-faint">{fmtDate(e.start)}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-soft">
                      <LocalizedText message={encounterType(e.type).label} />, {department(e.departmentId)?.name}, {practitioner(e.practitionerId)?.name ?? tr("team")}
                    </span>
                    <span className="block truncate text-[12px] text-ink-faint">{e.chiefComplaint ?? tr("Visit")}</span>
                  </Option>
                ))}
                <Option on={sourceId === "none"} onClick={() => setSourceId("none")}>
                  <span className="text-[13.5px] font-semibold"><LocalizedText message="No visit here, elective booking" /></span>
                  <span className="block text-[12.5px] text-ink-soft"><LocalizedText message="For a planned admission booked from outside, or a request on paper." /></span>
                </Option>
              </div>
              {show(!sourceId, "Choose where the request comes from") && <p className="mt-1 text-[12.5px] text-rose-700"><LocalizedText message="Choose where the request comes from" /></p>}

              {sourceCase && (
                <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-scrub-50 px-3 py-2 text-[13px]">
                  <Lock className="size-3.5 text-scrub-700" /> {" "}<LocalizedText message="Case" />{" "}<b>{sourceCase.code}</b> {sourceCase.title}
                  <span className="text-ink-faint"><LocalizedText message={"in {value0}"} values={{ value0: (store.episodeById(sourceCase.episodeId)?.title) ?? "" }} /></span>
                </p>
              )}

              {sourceId === "none" && (
                <div className="mt-3 flex flex-col gap-2">
                  {openCases.map((c) => (
                    <Option key={c.id} on={caseChoice === c.id} onClick={() => setCaseChoice(c.id)}>
                      <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                        <Stethoscope className="size-4 text-scrub-600" /> {c.title} <span className="font-normal text-ink-faint">{c.code}</span>
                      </span>
                      <span className="block text-[12px] text-ink-faint"><LocalizedText message={"{value0}, in {value1}"} values={{ value0: (c.complaints.map((x) => x.label).join(", ")) ?? "", value1: (store.episodeById(c.episodeId)?.title) ?? "" }} /></span>
                    </Option>
                  ))}
                  <Option on={newCase} onClick={() => setCaseChoice("new")} dashed>
                    <span className="text-[13.5px] font-semibold"><LocalizedText message="Open a new case" /></span>
                    {newCase && (
                      <div className="mt-2 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                        <Field label="Chief complaint" required error={show(complaints.length === 0, "Add the chief complaint")}>
                          <ComplaintPicker value={complaints} onChange={setComplaints} invalid={tried && complaints.length === 0} />
                        </Field>
                        <Field label="Episode of care">
                          <div className="flex flex-col gap-1.5">
                            {episodes.map((ep) => (
                              <SourceButton key={ep.id} onClick={() => setEpisodeChoice(ep.id)} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px]", episodeSel === ep.id ? "border-scrub-500 bg-scrub-50" : "border-line")}>
                                <FolderHeart className="size-4 text-scrub-600" /> <b>{ep.title}</b> <span className="text-ink-faint">{ep.code}</span>
                              </SourceButton>
                            ))}
                            <div className={cx("rounded-lg border px-3 py-2", episodeSel === "new" ? "border-scrub-500 bg-scrub-50" : "border-dashed border-line")}>
                              <SourceButton onClick={() => setEpisodeChoice("new")} className="text-[13px] font-semibold"><LocalizedText message="Start a new episode" /></SourceButton>
                              {episodeSel === "new" && (
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
                                  <Input value={newEpisode.title} onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })} placeholder={reason || tr("Episode name")} aria-label="Episode name" />
                                  <Select value={newEpisode.kind} onChange={(e) => setNewEpisode({ ...newEpisode, kind: e.target.value as EpisodeKind })} options={KINDS.map((k) => ({ value: k, label: k }))} />
                                </div>
                              )}
                            </div>
                          </div>
                        </Field>
                      </div>
                    )}
                  </Option>
                </div>
              )}
              {openRequestOnCase && (
                <p className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  <AlertCircle className="size-4" /> {" "}<LocalizedText message={"{value0} already has an open request, {value1}. Update that one from the admissions queue."} values={{ value0: (chosenCase?.code) ?? "", value1: (openRequestOnCase.code) ?? "" }} /></p>
              )}
            </Section>
          )}

          {/* 3. Clinical */}
          <Section n={3} title="Clinical details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Requesting clinician" required error={show(!requestedById, "Required")}>
                <Select value={requestedById} placeholder="Choose" invalid={tried && !requestedById} onChange={(e) => setRequestedById(e.target.value)} options={PRACTITIONERS.map((p) => ({ value: p.id, label: `${p.name}, ${department(p.departmentId)?.name}` }))} />
              </Field>
              <Field label="Admitting department" required error={show(!departmentId, "Required")}>
                <Select
                  value={departmentId}
                  placeholder="Choose"
                  invalid={tried && !departmentId}
                  onChange={(e) => (setDepartmentId(e.target.value), setConsultantId(""))}
                  options={DEPARTMENTS.filter((d) => d.consults).map((d) => ({ value: d.id, label: d.name }))}
                />
              </Field>
              <Field label="Admitting consultant" required error={show(!consultantId, "Required")}>
                <Select value={consultantId} disabled={!departmentId} placeholder={departmentId ? tr("Choose") : tr("Department first")} invalid={tried && !consultantId} onChange={(e) => setConsultantId(e.target.value)} options={practitionersFor(departmentId).map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
              <Field label="Reason for admission" required className="md:col-span-2" hint="Provisional diagnosis or the problem being treated" error={show(!reason.trim(), "Required")}>
                <Input value={reason} invalid={tried && !reason.trim()} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Symptomatic gallstones" />
              </Field>
              <Field label="Planned procedure">
                <Input value={procedure} onChange={(e) => setProcedure(e.target.value)} placeholder="If surgery is planned" />
              </Field>
              <Field label="Urgency">
                <Segmented<AdmissionUrgency> value={urgency} onChange={setUrgency} options={(["Elective", "Urgent", "Emergency"] as AdmissionUrgency[]).map((u) => ({ value: u, label: u }))} className="w-full" />
              </Field>
              <Field label="Planned admission">
                <DateTimeInput value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
              </Field>
              <Field label="Expected stay (days)" required>
                <Input type="number" min={1} max={365} value={stay} onChange={(e) => setStay(e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* 4. Bed */}
          <Section n={4} title="Bed and care needs">
            <Field label="Bed class">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {CATEGORIES.map((c) => {
                  const free = freeBeds(c);
                  return (
                    <SourceButton key={c} onClick={() => setBedCategory(c)} className={cx("rounded-lg border px-3 py-2 text-left", bedCategory === c ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "border-line hover:border-violet-300")}>
                      <span className="block text-[13.5px] font-semibold"><LocalizedText message={c} /></span>
                      <span className={cx("block text-[12px]", free ? "text-emerald-700" : "text-rose-700")}><LocalizedText message={"{value0} free now"} values={{ value0: (free) ?? "" }} /></span>
                    </SourceButton>
                  );
                })}
              </div>
            </Field>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
              <Field label="Isolation">
                <Segmented<Isolation> value={isolation} onChange={setIsolation} options={(["None", "Contact", "Droplet", "Airborne"] as Isolation[]).map((x) => ({ value: x, label: x }))} />
              </Field>
              <Field label="Special needs">
                <div className="flex flex-wrap gap-1.5">
                  {SPECIAL_NEEDS.map((n) => (
                    <Chip key={n} on={needs.includes(n)} onClick={() => setNeeds(needs.includes(n) ? needs.filter((x) => x !== n) : [...needs, n])}>
                      {n}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          {/* 5. Billing */}
          <Section n={5} title="Financial clearance" id="sec-coverageId">
            <Segmented<BillingMode>
              value={mode}
              onChange={setBillingMode}
              options={[
                { value: "Insurance", label: "Insurance" },
                { value: "Self pay", label: "Self pay" },
                { value: "Corporate", label: "Corporate" },
              ]}
            />
            {mode === "Insurance" && (
              <div className="mt-3 flex flex-col gap-2">
                {patient?.coverages.map((c) => {
                  const ok = eligible.includes(c);
                  return (
                    <Option key={c.id} on={cov === c.id} disabled={!ok} onClick={() => ok && setCoverageId(c.id)}>
                      <span className="text-[13.5px] font-semibold">
                        <LocalizedText message={c.priority} />: {payer(c.payerId)?.name}, {plan(c.planId)?.name}
                      </span>
                      <span className={cx("block text-[12px]", ok ? "text-ink-faint" : "text-rose-700")}>
                        {ok ? tr("Member {value0}, co-pay {value1}%", { value0: (c.memberId) ?? "", value1: (plan(c.planId)?.copayPct) ?? "" }) : !coverageActive(c, planned) ? tr("Not active on the planned date") : tr("Plan does not cover admission")}
                      </span>
                    </Option>
                  );
                })}
                {!patient?.coverages.length && <p className="rounded-lg bg-canvas p-3 text-[13px] text-ink-soft"><LocalizedText message="No insurance on file. Bill as self pay, or add coverage on the patient record first." /></p>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Pre-authorization number" hint="Leave blank to send for pre-authorization; the request stays pending until it is approved">
                    <Input value={authNumber} onChange={(e) => setAuthNumber(e.target.value.toUpperCase())} placeholder="AUTH-" />
                  </Field>
                  <Field label={tr("Estimated cost ({value0})", { value0: currencyCode })}>
                    <Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}
            {mode === "Self pay" && (
              <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <Field label={tr("Estimated cost ({value0})", { value0: currencyCode })}>
                  <Input type="number" min={0} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
                </Field>
                <Checkbox checked={deposit} onChange={setDeposit} label="Deposit collected" sub="Otherwise the request waits for the deposit" />
              </div>
            )}
            {mode === "Corporate" && <p className="mt-3 rounded-lg bg-canvas p-3 text-[13px] text-ink-soft"><LocalizedText message="The employer is billed after discharge. Corporate requests are cleared straight away." /></p>}
            <Field label="Notes for the admissions desk" className="mt-4">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </Section>
        </div>
      </Panel>

      {/* Summary */}
      <aside className="flex min-h-0 flex-col">
        <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="h-2 shrink-0 bg-violet-500" />
          <div className="scroll-thin min-h-0 flex-1 overflow-auto p-4">
            <p className="text-[12.5px] text-ink-faint"><LocalizedText message="Request summary" /></p>
            <p className="mt-0.5 text-lg font-bold tracking-tight">{patient ? fullName(patient) : tr("No patient yet")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={urgency === "Emergency" ? "bg-rose-50 text-rose-700" : urgency === "Urgent" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"}><LocalizedText message={urgency} /></Badge>
              <Badge tone="bg-violet-50 text-violet-800"><BedDouble className="size-3" /> <LocalizedText message={bedCategory} /></Badge>
            </div>
            <dl className="mt-4 space-y-2 text-[13px]">
              <Row k="Reason" v={reason} />
              <Row k="Case" v={chosenCase ? `${chosenCase.code}, ${chosenCase.title}` : newCase && complaints.length ? tr("New: {value0}", { value0: complaints.map((c) => c.label).join(", ") }) : undefined} />
              <Row k="Admit under" v={consultantId ? `${practitioner(consultantId)?.name}, ${department(departmentId)?.name}` : undefined} />
              <Row k="Planned" v={plannedDate ? tr("{value0}, {value1} days", { value0: fmtDateTime(planned.toISOString()), value1: stay }) : undefined} />
              <Row k="Billing" v={mode === "Insurance" ? payer(patient?.coverages.find((c) => c.id === cov)?.payerId)?.short : mode} />
            </dl>
            <div className={cx("mt-4 rounded-xl p-3 text-[13px]", previewStatus === "Ready" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900")}>
              <p className="font-semibold">{previewStatus === "Ready" ? tr("Will be ready to admit") : tr("Will wait for clearance")}</p>
              <p>
                {previewStatus === "Ready" ? tr("The admissions desk can admit as soon as a bed is assigned.") : mode === "Insurance" ? tr("Pre-authorization is needed first.") : tr("The deposit needs to be collected first.")}
                {previewStatus !== "Ready" && urgency === "Emergency" && tr(" As an emergency, it can still be admitted now.")}
              </p>
            </div>
          </div>
          <div className="border-t border-line-soft p-4">
            {issues.length > 0 && tried && (
              <ul className="mb-3 space-y-1">
                {issues.slice(0, 5).map((i) => (
                  <li key={i} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                    <AlertCircle className="size-3.5 shrink-0 text-amber-500" /> <Copy>{i}</Copy>
                  </li>
                ))}
              </ul>
            )}
            {issues.length === 0 && (
              <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
                <Check className="size-4" /> {" "}<LocalizedText message="Ready to send" /></p>
            )}
            <Button size="lg" className="w-full" disabled={saving} onClick={() => void submit()}>
              {saving ? tr("Sending") : tr("Send admission request")}
            </Button>
          </div>
        </Panel>
      </aside>

      <Modal
        open={!!created}
        onClose={() => router.push(medbandPaths.admissions())}
        title={tr("{value0} requested", { value0: (created?.code) ?? "" })}
        footer={
          <>
            <Button variant="ghost" onClick={() => created && router.push(medbandPaths.patient(created.patientId))}><LocalizedText message="Open patient record" /></Button>
            <Button onClick={() => router.push(medbandPaths.admissions())}><LocalizedText message="Go to admissions queue" /></Button>
          </>
        }
      >
        {created && (
          <p className="text-[13.5px] text-ink-soft">
            {created.status === "Ready" ? tr("The request is cleared. The admissions desk can admit the patient from the queue.") : tr("The request is waiting because {value0}. Record the decision or deposit from the admissions queue.", { value0: (pendingReason(created, tr)) ?? "" })}{" "}<LocalizedText message="It is linked to case" />{" "}<b className="text-ink">{store.caseById(created.caseId)?.code}</b>.
          </p>
        )}
      </Modal>
    </div>
  );
}

function Section({ n, title, id, children }: { n: number; title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-band text-[12px] font-bold">{n}</span>
        <Copy>{title}</Copy>
      </h2>
      {children}
    </section>
  );
}

function Option({ on, onClick, children, disabled, dashed }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; dashed?: boolean }) {
  return (
    <div
      role="radio"
      aria-checked={on}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick()}
      onKeyDown={(e) => !disabled && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className={cx(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        dashed && !on && "border-dashed",
        disabled ? "cursor-not-allowed border-line-soft bg-canvas/60" : on ? "border-scrub-500 bg-scrub-50 ring-1 ring-scrub-500" : "border-line hover:border-scrub-200",
      )}
    >
      <span className={cx("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-2", on ? "border-scrub-600" : "border-line")}>
        {on && <span className="size-2 rounded-full bg-scrub-600" />}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-ink-faint"><Copy>{k}</Copy></dt>
      <dd className={cx("min-w-0 flex-1 break-words", v ? "font-medium" : "text-ink-faint")}><Copy>{v || tr("Not set")}</Copy></dd>
    </div>
  );
}
