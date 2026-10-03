"use client";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceTextarea, Table } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useState } from "react";
import { useSourceApi, useApi } from "./../../../lib/api";
import { APPROVAL_LABEL, useSourceFormat} from "./../../../lib/format";
import { Badge, Button, Empty, Field, Segmented, Select, Spinner, StatusBadge } from "./../../../components/ui";
import { SignDialog } from "./../../../components/SignDialog";
import { useUser } from "./../../../components/Shell";

type Row = {
  id: number; case_id: number; kind: string; status: string; required: number; requested_at: string; requested_by_name: string; approver_name: string | null;
  decided_at: string | null; reference_no: string | null; remarks: string | null; case_no: string; scheduled_start: string; case_class: string; case_status: string;
  patient_name: string; mrn: string; insurer: string | null; policy_no: string | null; cpt: string; procedure_name: string; surgeon: string;
};

const MY_KINDS: Record<string, string[]> = {
  BILLING: ["PRE_AUTH"], OT_COORDINATOR: ["PRE_AUTH", "ICU_BED"], ANESTHESIOLOGIST: ["ANESTHESIA_FITNESS"], APPROVER: ["HIGH_COST_IMPLANT", "HOD_APPROVAL", "ICU_BED"],
};

export default function ApprovalsPage() {
 const {time,dateTime,shortDate}=useSourceFormat();
 const api=useSourceApi();
  const user = useUser();
  const [status, setStatus] = useState("Pending");
  const mine = MY_KINDS[user.role];
  const [scope, setScope] = useState<"mine" | "all">(mine ? "mine" : "all");
  const { data, loading, reload } = useApi<Row[]>(`/approvals?status=${status}`);
  const [sel, setSel] = useState<Row | null>(null);
  const [d, setD] = useState({ decision: "Approved", remarks: "", referenceNo: "", validUntil: "" });
  const rows = (data ?? []).filter((r) => scope === "all" || !mine || mine.includes(r.kind));

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-cond text-[24px] font-semibold"><LocalizedText message={"Approvals"}/></h1>
        <Segmented value={status} onChange={setStatus} options={["Pending", "Approved", "Rejected", "All"].map((s) => ({ value: s, label: s }))} />
        {mine && <Segmented value={scope} onChange={setScope} options={[{ value: "mine", label: "For my role" }, { value: "all", label: "Everything" }]} />}
        <p className="ml-auto text-[12px] text-muted"><LocalizedText message={"Every decision is signed with your PIN. Cases move to scheduled once all blocking approvals are in."}/></p>
      </div>
      <section className="panel min-h-0 flex-1 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty title={status === "Pending" ? "Nothing waiting for you" : "No approvals here"}><LocalizedText message={"New requests appear when cases are booked."}/></Empty>
        ) : (
          <div className="scroll-y scroll-x h-full">
            <Table className="w-full min-w-[980px] text-[13px]">
              <thead className="sticky top-0 bg-white text-left text-[12px] text-muted shadow-[0_1px_0_#d5dbdf]">
                <tr>
                  <th className="px-4 py-2 font-medium"><LocalizedText message={"Request"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Case"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Surgery"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Payer"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Requested"}/></th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const soon = Date.parse(r.scheduled_start) - Date.now() < 2 * 86400000;
                  return (
                    <tr key={r.id} className="hover:bg-steel/40">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{APPROVAL_LABEL[r.kind] ?? r.kind}</span>
                        <span className="mt-0.5 flex gap-1">
                          <Badge tone={r.status === "Approved" ? "go" : r.status === "Rejected" ? "stop" : "amber"}>{r.status}</Badge>
                          {!r.required && <Badge tone="muted"><LocalizedText message={"Retrospective"}/></Badge>}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <Link href={`/cases/${r.case_id}`} className="font-medium text-ceil-2 hover:underline">{r.patient_name}</Link>
                        <span className="block text-[12px] text-muted">{r.case_no}, {r.mrn}</span>
                      </td>
                      <td className="max-w-[300px] px-2 py-2.5">
                        <span className="block truncate">{r.cpt} {r.procedure_name}</span>
                        <span className={soon && r.status === "Pending" ? "text-[12px] font-medium text-stop" : "text-[12px] text-muted"}>{shortDate(r.scheduled_start)} {time(r.scheduled_start)}, {r.surgeon}</span>
                      </td>
                      <td className="px-2 py-2.5">{r.insurer ?? "Self-pay"}<span className="block text-[12px] text-muted">{r.policy_no ?? ""}</span></td>
                      <td className="px-2 py-2.5 text-[12px]">
                        {r.requested_by_name}<span className="block text-muted">{dateTime(r.requested_at)}</span>
                        {r.decided_at && <span className="block text-muted">{r.status} {" "}<LocalizedText message={"by"}/>{" "}{r.approver_name}{r.reference_no ? `, ref ${r.reference_no}` : ""}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === "Pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <StatusBadge status={r.case_status} />
                            <Button size="sm" variant="primary" onClick={() => { setD({ decision: "Approved", remarks: "", referenceNo: "", validUntil: "" }); setSel(r); }}><LocalizedText message={"Decide"}/></Button>
                          </div>
                        ) : (
                          r.remarks && <span className="text-[12px] text-muted">{r.remarks}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </section>
      <SignDialog
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `${APPROVAL_LABEL[sel.kind]}: ${sel.patient_name}` : ""}
        action={`${d.decision === "Approved" ? "approve" : "reject"} this request`}
        witness="optional"
        confirmLabel={d.decision === "Approved" ? "Sign and approve" : "Sign and reject"}
        valid={d.decision === "Approved" ? sel?.kind !== "PRE_AUTH" || !!d.referenceNo : !!d.remarks}
        onSign={async (s) => {
          await api(`/approvals/${sel!.id}/decide`, { body: { ...d, referenceNo: d.referenceNo || undefined, validUntil: d.validUntil || undefined, ...s } });
          reload();
          return true;
        }}
      >
        {sel && (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-[13px] text-muted sm:col-span-2">{sel.cpt} {sel.procedure_name} {" "}<LocalizedText message={"on"}/>{" "}{shortDate(sel.scheduled_start)}. {sel.insurer ? `${sel.insurer}, policy ${sel.policy_no}.` : "Self-pay."}</p>
            <Field label="Decision"><Select value={d.decision} onChange={(e) => setD({ ...d, decision: e.target.value })} options={["Approved", "Rejected"]} /></Field>
            {sel.kind === "PRE_AUTH" && d.decision === "Approved" && (
              <>
                <Field label="Authorization number"><SourceInput className="input" value={d.referenceNo} onChange={(e) => setD({ ...d, referenceNo: e.target.value })} /></Field>
                <Field label="Valid until"><SourceInput type="date" className="input" value={d.validUntil} onChange={(e) => setD({ ...d, validUntil: e.target.value })} /></Field>
              </>
            )}
            <Field label={d.decision === "Rejected" ? "Reason (required)" : "Remarks"} className="sm:col-span-2"><SourceTextarea className="input" rows={2} value={d.remarks} onChange={(e) => setD({ ...d, remarks: e.target.value })} /></Field>
          </div>
        )}
      </SignDialog>
    </div>
  );
}
