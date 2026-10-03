"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceTextarea, SourceSelect, Table } from "@pepbits/ops-ui";

import { useState } from "react";
import { useSourceApi } from "./../../lib/api";
import { useLookups } from "./../../lib/masters";
import { APPROVAL_LABEL, CONSENT_LABEL, useSourceFormat} from "./../../lib/format";
import { Badge, Button, ErrorNote, Field, PanelHeader, Select, cx, useAction } from "../ui";
import { IconCheck, IconLock } from "../icons";
import { SignDialog } from "../SignDialog";
import { useUser } from "../Shell";
import type { CaseBundle, TabProps } from "./types";

const APPROVER_ROLES: Record<string, string[]> = {
  PRE_AUTH: ["BILLING", "OT_COORDINATOR"],
  ANESTHESIA_FITNESS: ["ANESTHESIOLOGIST"],
  HIGH_COST_IMPLANT: ["APPROVER"],
  HOD_APPROVAL: ["APPROVER"],
  ICU_BED: ["APPROVER", "OT_COORDINATOR"],
};

export function ApprovalsTab({ c, reload }: TabProps) {
 const {dateTime}=useSourceFormat();
 const api=useSourceApi();
  const user = useUser();
  const lookups = useLookups();
  const [deciding, setDeciding] = useState<CaseBundle["approvals"][number] | null>(null);
  const [decision, setDecision] = useState({ decision: "Approved", remarks: "", referenceNo: "", validUntil: "" });
  const [consentOpen, setConsentOpen] = useState(false);
  const [consent, setConsent] = useState({ kind: "SURGERY", signedByName: c.patient.name, relationship: "Self", risksExplained: "" });
  const [reqKind, setReqKind] = useState("");
  const { run, error } = useAction();
  const recorded = new Set(c.consents.map((x) => x.kind));
  const consentKinds = (lookups.CONSENT_KIND ?? Object.keys(CONSENT_LABEL)).filter((k) => !recorded.has(k));

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="panel">
        <PanelHeader title="Approvals">
          <SourceSelect className="input h-8 w-48" value={reqKind} onChange={(e) => setReqKind(e.target.value)} aria-label="Request approval type">
            <option value=""><LocalizedText message={"Request another approval"}/></option>
            {(lookups.APPROVAL_KIND ?? []).map((k) => <option key={k} value={k}>{APPROVAL_LABEL[k]}</option>)}
          </SourceSelect>
          {reqKind && <Button size="sm" variant="primary" onClick={() => run(() => api(`/cases/${c.id}/approvals`, { body: { kind: reqKind } }), "Approval requested").then((r) => { if (r) { setReqKind(""); reload(); } })}><LocalizedText message={"Request"}/></Button>}
        </PanelHeader>
        <ErrorNote error={error} className="m-4" />
        <ul className="divide-y divide-line">
          {c.approvals.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{APPROVAL_LABEL[a.kind] ?? a.kind}</span>
                    <Badge tone={a.status === "Approved" ? "go" : a.status === "Rejected" ? "stop" : "amber"}>{a.status}</Badge>
                    {!a.required && <Badge tone="muted"><LocalizedText message={"Not blocking"}/></Badge>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">
                    <LocalizedText message={"Requested by"}/>{" "}{a.requested_by_name} {" "}<LocalizedText message={"on"}/>{" "}{dateTime(a.requested_at)}
                    {a.decided_at && <>. {a.status} {" "}<LocalizedText message={"by"}/>{" "}{a.approver_name}, {dateTime(a.decided_at)}</>}
                  </div>
                </div>
                {a.status === "Pending" && (
                  <Button
                    size="sm"
                    variant={APPROVER_ROLES[a.kind]?.includes(user.role) || user.role === "ADMIN" ? "primary" : "secondary"}
                    onClick={() => { setDecision({ decision: "Approved", remarks: "", referenceNo: "", validUntil: "" }); setDeciding(a); }}
                  >
                    <LocalizedText message={"Decide"}/></Button>
                )}
              </div>
              {(a.reference_no || a.remarks || a.witness_name || a.signature_hash) && (
                <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-[6px] bg-steel/60 px-3 py-2 text-[12px] sm:grid-cols-2">
                  {a.reference_no && <div><dt className="inline text-muted"><LocalizedText message={"Reference"}/>{" "}</dt><dd className="inline font-medium">{a.reference_no}</dd></div>}
                  {a.valid_until && <div><dt className="inline text-muted"><LocalizedText message={"Valid until"}/>{" "}</dt><dd className="inline font-medium">{a.valid_until}</dd></div>}
                  {a.remarks && <div className="sm:col-span-2"><dt className="inline text-muted"><LocalizedText message={"Remarks"}/>{" "}</dt><dd className="inline">{a.remarks}</dd></div>}
                  {a.witness_name && <div><dt className="inline text-muted"><LocalizedText message={"Witness"}/>{" "}</dt><dd className="inline">{a.witness_name}</dd></div>}
                  {a.signature_hash && <div className="flex items-center gap-1 text-muted"><IconLock size={12} /> {" "}<LocalizedText message={"Signed"}/>{" "}{a.signature_hash.slice(0, 12)}</div>}
                </dl>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[12px] text-muted">
          <LocalizedText message={"Insurance pre-authorization is decided by billing or the theatre coordinator, fitness by an anesthesiologist, implants and high-risk cases by an approver. Emergency cases go ahead and are authorized afterwards."}/></p>
      </section>

      <section className="panel">
        <PanelHeader title="Consent">
          {consentKinds.length > 0 && c.status !== "CANCELLED" && (
            <Button size="sm" variant="primary" onClick={() => { setConsent({ kind: consentKinds[0], signedByName: c.patient.name, relationship: "Self", risksExplained: "" }); setConsentOpen(true); }}>
              <LocalizedText message={"Record consent"}/></Button>
          )}
        </PanelHeader>
        <ul className="divide-y divide-line">
          {c.consents.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted"><LocalizedText message={"No consent recorded. Surgical and anesthesia consent are needed before the patient enters the room."}/></li>}
          {c.consents.map((x) => (
            <li key={x.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <IconCheck size={16} className="text-go" />
                <span className="font-medium">{CONSENT_LABEL[x.kind] ?? x.kind}</span>
                <span className="ml-auto text-[12px] text-muted">{dateTime(x.ts)}</span>
              </div>
              <p className="mt-1 text-[13px]">
                <LocalizedText message={"Signed by"}/>{" "}{x.signed_by_name} ({x.relationship.toLowerCase()}<LocalizedText message={"). Taken by"}/>{" "}{x.obtained_by_name}<LocalizedText message={", witnessed by"}/>{" "}{x.witness_name}.
              </p>
              <p className="mt-1 text-[12px] text-muted"><LocalizedText message={"Risks explained:"}/>{" "}{x.risks_explained}</p>
            </li>
          ))}
        </ul>
        {c.readiness.consents.length > 0 && (
          <p className="border-t border-line bg-amber-soft/60 px-4 py-2 text-[12px] text-amber"><LocalizedText message={"Still needed:"}/>{" "}{c.readiness.consents.map((k) => CONSENT_LABEL[k].toLowerCase()).join(" and ")}.</p>
        )}
      </section>

      <SignDialog
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title={deciding ? `${APPROVAL_LABEL[deciding.kind]} for ${c.case_no}` : ""}
        action={`${decision.decision === "Approved" ? "approve" : "reject"} this request`}
        witness="optional"
        confirmLabel={decision.decision === "Approved" ? "Sign and approve" : "Sign and reject"}
        valid={decision.decision === "Approved" ? deciding?.kind !== "PRE_AUTH" || !!decision.referenceNo : !!decision.remarks}
        onSign={async (s) => {
          await api(`/approvals/${deciding!.id}/decide`, { body: { ...decision, referenceNo: decision.referenceNo || undefined, validUntil: decision.validUntil || undefined, ...s } });
          reload();
          return true;
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Decision">
            <Select value={decision.decision} onChange={(e) => setDecision({ ...decision, decision: e.target.value })} options={["Approved", "Rejected"]} />
          </Field>
          {deciding?.kind === "PRE_AUTH" && decision.decision === "Approved" && (
            <>
              <Field label="Authorization number"><SourceInput className="input" value={decision.referenceNo} onChange={(e) => setDecision({ ...decision, referenceNo: e.target.value })} placeholder={c.patient.insurer ?? ""} /></Field>
              <Field label="Valid until"><SourceInput type="date" className="input" value={decision.validUntil} onChange={(e) => setDecision({ ...decision, validUntil: e.target.value })} /></Field>
            </>
          )}
          <Field label={decision.decision === "Rejected" ? "Reason (required)" : "Remarks"} className="sm:col-span-2">
            <SourceTextarea className="input" rows={2} value={decision.remarks} onChange={(e) => setDecision({ ...decision, remarks: e.target.value })} />
          </Field>
        </div>
      </SignDialog>

      <SignDialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title="Record consent"
        action="confirm you explained the procedure, risks and alternatives"
        witness="required"
        confirmLabel="Sign consent"
        valid={!!consent.signedByName && consent.risksExplained.length > 5}
        onSign={async (s) => {
          await api(`/cases/${c.id}/consents`, { body: { ...consent, ...s } });
          reload();
          return true;
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Consent for"><Select value={consent.kind} onChange={(e) => setConsent({ ...consent, kind: e.target.value })} options={consentKinds.map((k) => ({ value: k, label: CONSENT_LABEL[k] ?? k }))} /></Field>
          <Field label="Relationship to patient"><Select value={consent.relationship} onChange={(e) => setConsent({ ...consent, relationship: e.target.value, signedByName: e.target.value === "Self" ? c.patient.name : "" })} options={["Self", "Parent", "Spouse or partner", "Legal guardian", "Next of kin"]} /></Field>
          <Field label="Signed by" className="sm:col-span-2"><SourceInput className="input" value={consent.signedByName} onChange={(e) => setConsent({ ...consent, signedByName: e.target.value })} /></Field>
          <Field label="Risks, benefits and alternatives explained" className="sm:col-span-2"><SourceTextarea className="input" rows={3} value={consent.risksExplained} onChange={(e) => setConsent({ ...consent, risksExplained: e.target.value })} placeholder="e.g. bleeding, infection, injury to bile duct, conversion to open surgery" /></Field>
        </div>
        <p className="text-[12px] text-muted"><LocalizedText message={"Surgical consent is taken by a surgeon, anesthesia consent by an anesthesiologist."}/></p>
      </SignDialog>
    </div>
  );
}

const PHASE_LABEL: Record<string, { title: string; when: string }> = {
  SIGN_IN: { title: "Sign-in", when: "Before induction" },
  TIME_OUT: { title: "Time-out", when: "Before incision" },
  SIGN_OUT: { title: "Sign-out", when: "Before the patient leaves" },
};

export function SafetyTab({ c, reload }: TabProps) {
 const {t:translateSource}=useLocalization();
 const {time}=useSourceFormat();
 const api=useSourceApi();
  const { run, error } = useAction();
  const [verify, setVerify] = useState<CaseBundle["counts"][number] | null>(null);
  const locked = c.status === "CANCELLED" || c.report.status === "Signed";

  return (
    <div className="flex flex-col gap-3">
      <ErrorNote error={error} />
      <div className="grid gap-3 lg:grid-cols-3">
        {(["SIGN_IN", "TIME_OUT", "SIGN_OUT"] as const).map((phase) => {
          const items = c.checklist.filter((i) => i.phase === phase);
          const done = items.filter((i) => i.checked).length;
          return (
            <section key={phase} className="panel flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <div>
                  <h3 className="font-cond text-[16px] font-semibold">{PHASE_LABEL[phase].title}</h3>
                  <p className="text-[12px] text-muted">{PHASE_LABEL[phase].when}</p>
                </div>
                <span className={cx("font-cond text-[18px] font-semibold", done === items.length ? "text-go" : "text-muted")}>{done}/{items.length}</span>
              </div>
              <div className="h-1 bg-steel-2"><div className="h-1 bg-go transition-all" style={{ width: `${(done / Math.max(1, items.length)) * 100}%` }} /></div>
              <ul className="flex-1 divide-y divide-line">
                {items.map((i) => (
                  <li key={i.id}>
                    <label className={cx("flex cursor-pointer gap-3 px-4 py-2.5 hover:bg-steel/50", locked && "cursor-default")}>
                      <SourceInput
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#2e8b62]"
                        checked={!!i.checked}
                        disabled={locked}
                        onChange={(e) => run(() => api(`/cases/${c.id}/checklist/${i.id}`, { method: "PATCH", body: { checked: e.target.checked } })).then((r) => r && reload())}
                      />
                      <span className="min-w-0">
                        <span className={cx("block text-[13px]", i.checked && "text-muted")}>{i.item}</span>
                        {i.checked ? <span className="block text-[11px] text-faint">{i.checked_by_name}, {time(i.ts)}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="panel">
        <PanelHeader title="Surgical counts" />
        <div className="scroll-x">
          <Table className="w-full min-w-[760px] text-[13px]">
            <thead className="bg-steel/60 text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium"><LocalizedText message={"Item"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Initial"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Added"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Expected"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Final"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Status"}/></th>
                <th className="px-4 py-2 font-medium"><LocalizedText message={"Verified"}/></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.counts.map((n) => {
                const expected = n.initial + n.added;
                const mismatch = n.final !== null && n.final !== expected;
                const save = (body: Record<string, unknown>) => run(() => api(`/cases/${c.id}/counts/${n.id}`, { method: "PATCH", body })).then((r) => r && reload());
                return (
                  <tr key={n.id} className={cx(mismatch && "bg-stop-soft/60")}>
                    <td className="px-4 py-2 font-medium">{n.item}</td>
                    {(["initial", "added"] as const).map((k) => (
                      <td key={k} className="w-24 px-2 py-2">
                        <SourceInput type="number" min={0} disabled={locked} className="input h-8" defaultValue={n[k]} key={`${n.id}-${k}-${n[k]}`} onBlur={(e) => Number(e.target.value) !== n[k] && save({ [k]: Number(e.target.value) })} />
                      </td>
                    ))}
                    <td className="px-2 py-2 font-cond text-[16px] font-semibold">{expected}</td>
                    <td className="w-24 px-2 py-2">
                      <SourceInput type="number" min={0} disabled={locked} className="input h-8" defaultValue={n.final ?? ""} key={`${n.id}-f-${n.final}`} onBlur={(e) => (e.target.value === "" ? null : Number(e.target.value)) !== n.final && save({ final: e.target.value === "" ? null : Number(e.target.value) })} />
                    </td>
                    <td className="px-2 py-2">
                      {n.final === null ? <Badge tone="muted"><LocalizedText message={"Open"}/></Badge> : mismatch ? <Badge tone="stop"><LocalizedText message={"Discrepancy"}/></Badge> : n.verified_by_name ? <Badge tone="go"><LocalizedText message={"Correct, witnessed"}/></Badge> : <Badge tone="amber"><LocalizedText message={"Needs witness"}/></Badge>}
                    </td>
                    <td className="px-4 py-2">
                      {n.verified_by_name ? (
                        <span className="text-[12px]">{n.verified_by_name} {" "}<LocalizedText message={"and"}/>{" "}{n.witness_name}, {time(n.ts)}</span>
                      ) : (
                        <Button size="sm" disabled={locked || n.final === null || mismatch} onClick={() => setVerify(n)}><LocalizedText message={"Verify with witness"}/></Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <p className="border-t border-line px-4 py-2 text-[12px] text-muted">
          <LocalizedText message={"A discrepancy raises a critical alert. Search the field, then order a portable X-ray from the imaging tab. The patient can't leave the room until every count is correct and witnessed."}/></p>
      </section>

      <SignDialog
        open={!!verify}
        onClose={() => setVerify(null)}
        title={translateSource("Verify {value0} count",{value0:verify?.item.toLowerCase()??""})}
        action={`confirm the ${verify?.item.toLowerCase()} count of ${verify?.final}`}
        witness="required"
        confirmLabel="Verify count"
        onSign={async (s) => {
          await api(`/cases/${c.id}/counts/${verify!.id}/verify`, { body: s });
          reload();
          return true;
        }}
      />
    </div>
  );
}
