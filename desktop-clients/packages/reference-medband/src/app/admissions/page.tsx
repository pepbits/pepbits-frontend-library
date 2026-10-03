"use client";

import { ArrowRightLeft, BedDouble, CalendarClock, CircleDollarSign, FileCheck2, Plus, Siren, XCircle } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useRouter } from "../../lib/navigation";
import { useMemo, useState } from "react";
import { canAdmit, pendingReason, REQUEST_TONE, URGENCY_TONE } from "../../lib/admission";
import { useCounter, useStore } from "../../lib/store";
import type { AdmissionRequest, AdmissionRequestStatus } from "../../lib/types";
import { cx, fullName, toDateTimeInput } from "../../lib/utils";
import { DateTimeInput, Field, Input, Segmented, Textarea } from "../../components/ui/form";
import { Modal, useErrorToast, useToast } from "../../components/ui/overlay";
import { Badge, Button, EmptyState, LinkButton, Panel, PanelHeader } from "../../components/ui/primitives";
import { useMaster } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { medbandPaths } from "../../routes";

type Tab = "Ready" | "Pending" | "Admitted" | "Cancelled";
type Dialog =
  | { kind: "authorize"; r: AdmissionRequest; authNumber: string; decision: "Approved" | "Rejected" }
  | { kind: "deposit"; r: AdmissionRequest }
  | { kind: "reschedule"; r: AdmissionRequest; plannedDate: string }
  | { kind: "cancel"; r: AdmissionRequest; reason: string };

export default function AdmissionsPage() {
  const { COUNTERS, WARDS, department, payer, plan, practitioner, ward } = useMaster();
  const { fmtAmount, fmtDateTime, relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  /** Amounts follow the host currency and number preferences; the backend reports no currency of its own. */
  const money = (n?: number) => (n === undefined ? tr("Not estimated") : fmtAmount(n));
  const store = useStore();
  const desk = useCounter();
  const router = useRouter();
  const toast = useToast();
  const fail = useErrorToast();
  const [tab, setTab] = useState<Tab>("Ready");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  // The admissions desk is the counter that opens inpatient visits; which counter that is comes from the backend master data.
  const admissionsDesk = COUNTERS.find((c) => c.encounterTypes.includes("IP"));
  const atDesk = !!desk?.encounterTypes.includes("IP");

  const byStatus = useMemo(() => {
    const m: Record<AdmissionRequestStatus, AdmissionRequest[]> = { Pending: [], Ready: [], Admitted: [], Cancelled: [] };
    store.admissionRequests.forEach((r) => m[r.status].push(r));
    // Emergencies first, then by planned time.
    const rank = { Emergency: 0, Urgent: 1, Elective: 2 } as const;
    Object.values(m).forEach((list) => list.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.plannedDate.localeCompare(b.plannedDate)));
    m.Admitted.reverse();
    return m;
  }, [store.admissionRequests]);

  const occupied = new Set(store.encounters.filter((e) => e.bed && ["Planned", "Arrived", "In progress"].includes(e.status)).map((e) => e.bed!));
  const wards = WARDS.filter((w) => w.category !== "Day care");

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title: ok });
      setDialog(null);
    } catch (e) {
      fail(e, "Could not update the request");
    } finally {
      setBusy(false);
    }
  };

  const admit = (r: AdmissionRequest) => router.push(medbandPaths.encounterNew({ type: "IP", patientId: r.patientId, admissionRequest: r.id }));
  const list = byStatus[tab];

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight"><LocalizedText message="Admissions" /></h1>
          <p className="text-[13.5px] text-ink-soft"><LocalizedText message="Requests from clinicians wait here until they are cleared, then the admissions desk admits them to a bed." /></p>
        </div>
        <LinkButton href={medbandPaths.admissionNew()}>
          <Plus className="size-4" /> {" "}<LocalizedText message="New admission request" /></LinkButton>
      </div>

      {!atDesk && admissionsDesk && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-950">
          <ArrowRightLeft className="size-4 shrink-0 text-sky-700" />
          <p className="min-w-0 flex-1"><LocalizedText message="You can review and clear requests from any counter. Admitting a patient to a bed is done at the" />{" "}<b>{admissionsDesk.name}</b>.</p>
          <Button size="sm" variant="secondary" onClick={() => store.setCounterId(admissionsDesk.id)}><LocalizedText message="Switch to {value0}" values={{ value0: admissionsDesk.name }} /></Button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel className="flex min-h-[420px] flex-col">
          <div className="scroll-thin flex items-center gap-3 overflow-x-auto border-b border-line-soft px-5 py-3">
            <Segmented<Tab>
              ariaLabel="Request status"
              value={tab}
              onChange={setTab}
              options={(["Ready", "Pending", "Admitted", "Cancelled"] as Tab[]).map((s) => ({
                value: s,
                label: tr("{value0} ({value1})", { value0: s === "Ready" ? tr("Ready to admit") : s === "Pending" ? tr("Pending clearance") : tr(s), value1: byStatus[s].length }),
              }))}
            />
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-auto p-3">
            {list.length === 0 && (
              <EmptyState
                icon={<BedDouble className="size-5" />}
                title={tab === "Ready" ? tr("Nothing ready to admit") : tab === "Pending" ? tr("Nothing waiting for clearance") : tr("No {value0} requests", { value0: tr(tab ?? "").toLowerCase() })}
                body={tab === "Ready" ? tr("Requests appear here once pre-authorization is approved or the deposit is collected.") : undefined}
              />
            )}
            <ul className="flex flex-col gap-2">
              {list.map((r) => {
                const p = store.patientById(r.patientId);
                const kase = store.caseById(r.caseId);
                const enc = store.encounterById(r.admittedEncounterId);
                const cov = p?.coverages.find((c) => c.id === r.coverageId);
                const overdue = (r.status === "Ready" || r.status === "Pending") && new Date(r.plannedDate) < new Date(Date.now() - 60 * 60_000);
                return (
                  <li key={r.id} className={cx("rounded-xl border p-4", r.urgency === "Emergency" && r.status !== "Admitted" && r.status !== "Cancelled" ? "border-rose-200" : "border-line")}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1 basis-80">
                        <p className="flex flex-wrap items-center gap-2">
                          <Link href={medbandPaths.patient(r.patientId)} className="text-[15px] font-semibold hover:underline">
                            {p ? fullName(p) : tr("Unknown patient")}
                          </Link>
                          <span className="text-[12.5px] text-ink-faint">{p?.mrn}</span>
                          <Badge tone={URGENCY_TONE[r.urgency]}>{r.urgency === "Emergency" && <Siren className="size-3" />} <LocalizedText message={r.urgency} /></Badge>
                          <Badge tone={REQUEST_TONE[r.status]}><LocalizedText message={r.status ?? ""} /></Badge>
                          {kase?.medicoLegal && <Badge tone="bg-rose-50 text-rose-700"><LocalizedText message="MLC" /></Badge>}
                        </p>
                        <p className="mt-1 text-[14px] font-medium">{r.reason}</p>
                        {r.plannedProcedure && <p className="text-[13px] text-ink-soft"><LocalizedText message={"Procedure: {value0}"} values={{ value0: (r.plannedProcedure) ?? "" }} /></p>}
                        <p className="mt-1 text-[12.5px] text-ink-soft">
                          <LocalizedText message={"{value0}, case {value1}, {value2} under {value3}, requested by {value4}"} values={{ value0: (r.code) ?? "", value1: (kase?.code) ?? "", value2: (department(r.admittingDepartmentId)?.name) ?? "", value3: (practitioner(r.admittingPractitionerId)?.name) ?? "", value4: (practitioner(r.requestedById)?.name) ?? "" }} />
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                          <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5", overdue ? "bg-rose-50 font-semibold text-rose-700" : "bg-canvas text-ink-soft")}>
                            <CalendarClock className="size-3.5" /> {fmtDateTime(r.plannedDate)} ({relativeDay(r.plannedDate)})
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-canvas px-2 py-0.5 text-ink-soft"><BedDouble className="size-3.5" /> {" "}<LocalizedText message={"{value0}, {value1} days"} values={{ value0: tr(r.bedCategory ?? ""), value1: (r.expectedStayDays) ?? "" }} /></span>
                          {r.isolation !== "None" && <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-900"><LocalizedText message={"{value0} isolation"} values={{ value0: tr(r.isolation ?? "") }} /></span>}
                          {r.specialNeeds.map((n) => (
                            <span key={n} className="rounded-md bg-canvas px-2 py-0.5 text-ink-soft">{n}</span>
                          ))}
                        </div>
                      </div>

                      <div className="w-full shrink-0 rounded-lg bg-canvas/70 p-3 text-[12.5px] sm:w-64">
                        <p className="font-semibold text-ink-soft"><LocalizedText message={r.billingMode ?? ""} /></p>
                        {r.billingMode === "Insurance" && (
                          <>
                            <p>{payer(cov?.payerId)?.name}, {plan(cov?.planId)?.name}</p>
                            <p className={cx("font-medium", r.authStatus === "Approved" ? "text-emerald-700" : r.authStatus === "Rejected" ? "text-rose-700" : "text-amber-800")}>
                              {r.authNumber ? tr("Pre-authorization {value0}, {value1}", { value0: tr(r.authStatus).toLowerCase(), value1: r.authNumber }) : tr("Pre-authorization {value0}", { value0: tr(r.authStatus).toLowerCase() })}
                            </p>
                          </>
                        )}
                        {r.billingMode === "Self pay" && <p className={r.depositCollected ? "text-emerald-700" : "text-amber-800"}>{r.depositCollected ? tr("Deposit collected") : tr("Deposit not collected")}</p>}
                        <p className="text-ink-faint"><LocalizedText message={"Estimate {value0}"} values={{ value0: (money(r.estimatedCost)) ?? "" }} /></p>
                      </div>
                    </div>

                    {(r.status === "Pending" || r.status === "Ready") && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
                        {r.status === "Pending" && <p className="mr-auto text-[12.5px] text-amber-800"><LocalizedText message={"Waiting because {value0}."} values={{ value0: (pendingReason(r, tr)) ?? "" }} />{r.urgency === "Emergency" && tr(" Emergencies can be admitted now.")}</p>}
                        {r.status === "Ready" && <p className="mr-auto text-[12.5px] text-emerald-700"><LocalizedText message="Cleared for admission." /></p>}
                        {r.status === "Pending" && r.billingMode === "Insurance" && (
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "authorize", r, authNumber: "", decision: "Approved" })}>
                            <FileCheck2 className="size-3.5" /> {" "}<LocalizedText message="Record authorization" /></Button>
                        )}
                        {r.status === "Pending" && r.billingMode === "Self pay" && (
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "deposit", r })}>
                            <CircleDollarSign className="size-3.5" /> {" "}<LocalizedText message="Collect deposit" /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "reschedule", r, plannedDate: toDateTimeInput(new Date(r.plannedDate)) })}>
                          <LocalizedText message="Reschedule" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "cancel", r, reason: "" })}>
                          <XCircle className="size-3.5" /> {" "}<LocalizedText message="Cancel" /></Button>
                        {canAdmit(r) && (
                          <Button size="sm" disabled={!atDesk} title={atDesk ? undefined : admissionsDesk ? tr("Admit from {value0}", { value0: admissionsDesk.name }) : tr("Admit from a counter that opens inpatient visits")} onClick={() => admit(r)}>
                            <BedDouble className="size-3.5" /> {" "}<LocalizedText message="Admit" /></Button>
                        )}
                      </div>
                    )}
                    {r.status === "Admitted" && enc && (
                      <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] text-violet-800">
                        <LocalizedText message={"Admitted as {value0} on {value1}, {value2} bed {value3}. Stay is {value4}."} values={{ value0: (enc.code) ?? "", value1: (fmtDateTime(enc.start)) ?? "", value2: (ward(enc.wardId)?.name) ?? "", value3: (enc.bed) ?? "", value4: tr(enc.status ?? "").toLowerCase() }} /></p>
                    )}
                    {r.status === "Cancelled" && r.cancelReason && <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] text-ink-soft"><LocalizedText message={"Cancelled: {value0}"} values={{ value0: (r.cancelReason) ?? "" }} /></p>}
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>

        <Panel className="flex min-h-0 flex-col">
          <PanelHeader title="Bed board" sub="Free beds by ward" />
          <div className="scroll-thin min-h-0 flex-1 overflow-auto px-5 pb-5">
            {wards.map((w) => {
              const free = w.beds.filter((b) => !occupied.has(b)).length;
              return (
                <div key={w.id} className="border-b border-line-soft py-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13.5px] font-semibold">{w.name}</p>
                    <p className={cx("text-[12.5px] font-semibold", free ? "text-emerald-700" : "text-rose-700")}><LocalizedText message={"{value0} free"} values={{ value0: (free) ?? "" }} /></p>
                  </div>
                  <p className="text-[12px] text-ink-faint"><LocalizedText message={w.category} /></p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {w.beds.map((b) => (
                      <span
                        key={b}
                        title={occupied.has(b) ? tr("{value0}, occupied", { value0: (b) ?? "" }) : tr("{value0}, free", { value0: (b) ?? "" })}
                        className={cx("rounded px-1.5 py-0.5 text-[11px] font-semibold", occupied.has(b) ? "bg-violet-600 text-white" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200")}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={
          dialog?.kind === "authorize" ? tr("Pre-authorization for {value0}", { value0: (dialog.r.code) ?? "" }) : dialog?.kind === "deposit" ? tr("Deposit for {value0}", { value0: (dialog.r.code) ?? "" }) : dialog?.kind === "reschedule" ? tr("Reschedule {value0}", { value0: (dialog.r.code) ?? "" }) : tr("Cancel {value0}", { value0: (dialog?.r.code) ?? "" })
        }
        footer={
          dialog && (
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}><LocalizedText message="Close" /></Button>
              {dialog.kind === "authorize" && (
                <Button
                  disabled={busy || (dialog.decision === "Approved" && !dialog.authNumber.trim())}
                  onClick={() =>
                    act(
                      () => store.admissionAction(dialog.r.id, { action: "authorize", decision: dialog.decision, authNumber: dialog.authNumber.trim() || undefined }),
                      dialog.decision === "Approved" ? `${dialog.r.code} is cleared for admission` : `${dialog.r.code} marked as rejected`,
                    )
                  }
                >
                  <LocalizedText message="Save decision" /></Button>
              )}
              {dialog.kind === "deposit" && (
                <Button disabled={busy} onClick={() => act(() => store.admissionAction(dialog.r.id, { action: "deposit" }), `${dialog.r.code} is cleared for admission`)}>
                  <LocalizedText message="Deposit received" /></Button>
              )}
              {dialog.kind === "reschedule" && (
                <Button disabled={busy || !dialog.plannedDate} onClick={() => act(() => store.admissionAction(dialog.r.id, { action: "reschedule", plannedDate: new Date(dialog.plannedDate).toISOString() }), `${dialog.r.code} rescheduled`)}>
                  <LocalizedText message="Save date" /></Button>
              )}
              {dialog.kind === "cancel" && (
                <Button variant="danger" disabled={busy || !dialog.reason.trim()} onClick={() => act(() => store.admissionAction(dialog.r.id, { action: "cancel", reason: dialog.reason.trim() }), `${dialog.r.code} cancelled`)}>
                  <LocalizedText message="Cancel request" /></Button>
              )}
            </>
          )
        }
      >
        {dialog?.kind === "authorize" && (
          <div className="flex flex-col gap-4">
            <p className="text-[13.5px] text-ink-soft"><LocalizedText message="Record the insurer's or TPA's decision. An approved request moves to Ready to admit." /></p>
            <Segmented<"Approved" | "Rejected">
              value={dialog.decision}
              onChange={(v) => setDialog({ ...dialog, decision: v })}
              options={[
                { value: "Approved", label: "Approved" },
                { value: "Rejected", label: "Rejected" },
              ]}
            />
            {dialog.decision === "Approved" && (
              <Field label="Authorization number" required>
                <Input autoFocus value={dialog.authNumber} onChange={(e) => setDialog({ ...dialog, authNumber: e.target.value.toUpperCase() })} placeholder="AUTH-" />
              </Field>
            )}
          </div>
        )}
        {dialog?.kind === "deposit" && (
          <p className="text-[13.5px] text-ink-soft">
            <LocalizedText message="Confirm the admission deposit has been paid at the cash counter. The estimated cost is" />{" "}<b className="text-ink">{money(dialog.r.estimatedCost)}</b>.
          </p>
        )}
        {dialog?.kind === "reschedule" && (
          <Field label="Planned admission">
            <DateTimeInput value={dialog.plannedDate} onChange={(e) => setDialog({ ...dialog, plannedDate: e.target.value })} />
          </Field>
        )}
        {dialog?.kind === "cancel" && (
          <Field label="Reason" required hint="Kept on the request for the audit trail">
            <Textarea autoFocus rows={3} value={dialog.reason} onChange={(e) => setDialog({ ...dialog, reason: e.target.value })} placeholder="e.g. Patient chose another hospital" />
          </Field>
        )}
      </Modal>
    </div>
  );
}
