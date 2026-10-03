"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceTextarea, Table } from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { useSourceApi, useApi } from "./../../lib/api";
import { toLocalInput , useSourceFormat} from "./../../lib/format";
import { Badge, Button, ErrorNote, Field, Modal, PanelHeader, Spinner, cx, useAction } from "../ui";
import { IconCheck, IconLock, IconPen } from "../icons";
import { SignDialog } from "../SignDialog";
import { useUser } from "../Shell";
import type { TabProps } from "./types";

const FIELDS: [key: string, label: string, rows: number][] = [
  ["indication", "Indication", 2],
  ["findings", "Operative findings", 3],
  ["technique", "Procedure and technique", 5],
  ["specimens", "Specimens", 1],
  ["drains", "Drains and implants", 1],
  ["complications", "Complications", 1],
  ["postop_plan", "Post-operative plan", 3],
];

export function ReportTab({ c, reload }: TabProps) {
 const {dateTime}=useSourceFormat();
 const api=useSourceApi();
  const user = useUser();
  const r = c.report;
  const init = Object.fromEntries(FIELDS.map(([k]) => [k, (r as Record<string, any>)[k] ?? ""])) as Record<string, string>;
  const [f, setF] = useState(init);
  useEffect(() => setF(init), [r.version, r.status, r.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const [signOpen, setSignOpen] = useState(false);
  const [cosignOpen, setCosignOpen] = useState(false);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [amend, setAmend] = useState<string | null>(null);
  const { data: ver, reload: reloadVer } = useApi<{ signed: boolean; valid: boolean; hash?: string; versions: { id: number; version: number; reason: string; amended_by_name: string; ts: string; signature_hash: string }[] }>(`/cases/${c.id}/report/verify`);
  const { run, busy, error } = useAction();
  const signed = r.status === "Signed";
  const dirty = FIELDS.some(([k]) => f[k] !== init[k]);
  const isOperator = c.team.some((t) => t.staff_id === user.id && ["Primary Surgeon", "Secondary Surgeon"].includes(t.role));
  const primary = c.procedures.filter((p) => p.performed || p.role === "Primary");

  const saveDraft = () => run(() => api(`/cases/${c.id}/report`, { method: "PUT", body: f }), "Draft saved").then((x) => x && reload());
  const startSign = async () => {
    if (dirty) await api(`/cases/${c.id}/report`, { method: "PUT", body: f });
    const res = await run(() => api<{ blockers: string[] }>(`/cases/${c.id}/report/check`));
    if (!res) return;
    if (res.blockers.length) setBlockers(res.blockers);
    else setSignOpen(true);
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
      <section className="panel">
        <PanelHeader title={<span className="flex items-center gap-2"><LocalizedText message={"Operative report"}/>{" "}<Badge tone={signed ? "go" : "amber"}>{signed ? "Signed" : "Draft"}</Badge><span className="text-[12px] font-normal text-muted"><LocalizedText message={"Version"}/>{" "}{r.version}</span></span>}>
          {!signed && c.status !== "CANCELLED" && (
            <>
              <Button size="sm" disabled={!dirty} busy={busy} onClick={saveDraft}><LocalizedText message={"Save draft"}/></Button>
              <Button size="sm" variant="primary" busy={busy} onClick={startSign} disabled={!isOperator && user.role !== "ADMIN"} title={!isOperator ? "Only the operating surgeon can sign" : undefined}>
                <IconPen size={15} /> {" "}<LocalizedText message={"Sign report"}/></Button>
            </>
          )}
        </PanelHeader>
        <div className="border-b border-line bg-steel/40 px-4 py-2 text-[12px] text-muted">
          {c.patient.name}, {c.patient.mrn}. {primary.map((p) => `${p.cpt} ${p.name}${p.laterality !== "N/A" ? ` (${p.laterality.toLowerCase()})` : ""}`).join("; ")}<LocalizedText message={". Anesthesia"}/>{" "}{c.anesthesia_type ?? "—"}<LocalizedText message={", blood loss"}/>{" "}{c.ebl_ml ?? "—"} {" "}<LocalizedText message={"ml."}/></div>
        {signed ? (
          <article className="space-y-4 px-5 py-4">
            {FIELDS.map(([k, label]) => (
              <div key={k}>
                <h4 className="text-[12px] font-semibold text-muted">{label}</h4>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{f[k] || "—"}</p>
              </div>
            ))}
          </article>
        ) : (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {FIELDS.map(([k, label, rows]) => (
              <Field key={k} label={label} className={rows > 1 ? "md:col-span-2" : ""}>
                <SourceTextarea className="input" rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={c.status === "CANCELLED"} />
              </Field>
            ))}
          </div>
        )}
        <ErrorNote error={error} className="mx-4 mb-4" />
      </section>

      <div className="flex flex-col gap-3">
        <section className="panel">
          <PanelHeader title="Signatures" />
          <dl className="divide-y divide-line text-[13px]">
            <SigRow label="Surgeon" who={r.signed_by_name} when={r.signed_at} />
            <SigRow label="Witness" who={r.witness_name} when={r.witnessed_at} />
            <SigRow label="Co-signature" who={r.cosigned_by_name} when={r.cosigned_at} />
          </dl>
          {signed && ver && (
            <div className={cx("mx-4 my-3 flex items-start gap-2 rounded-[6px] px-3 py-2 text-[12px]", ver.valid ? "bg-go-soft text-go" : "bg-stop-soft text-stop")}>
              {ver.valid ? <IconCheck size={15} /> : <IconLock size={15} />}
              <span>
                {ver.valid ? "Signature verified: the report hasn't changed since it was signed." : "Signature doesn't match the content. Review the audit log."}
                <span className="mt-0.5 block break-all font-mono text-[11px] opacity-80"><LocalizedText message={"SHA-256"}/>{" "}{ver.hash}</span>
              </span>
            </div>
          )}
          {signed && (
            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
              <Button size="sm" onClick={() => reloadVer()}><LocalizedText message={"Re-verify"}/></Button>
              {!r.cosigned_by_name && ["SURGEON", "APPROVER", "ADMIN"].includes(user.role) && <Button size="sm" onClick={() => setCosignOpen(true)}><LocalizedText message={"Co-sign"}/></Button>}
              {user.role === "SURGEON" || user.role === "ADMIN" ? <Button size="sm" variant="danger" onClick={() => setAmend("")}><LocalizedText message={"Amend report"}/></Button> : null}
            </div>
          )}
        </section>
        <section className="panel">
          <PanelHeader title="Previous versions" />
          <ul className="divide-y divide-line">
            {(ver?.versions ?? []).length === 0 && <li className="px-4 py-4 text-[13px] text-muted"><LocalizedText message={"No amendments. Signed versions are kept here when a report is amended."}/></li>}
            {ver?.versions.map((v) => (
              <li key={v.id} className="px-4 py-2 text-[13px]">
                <div className="font-medium"><LocalizedText message={"Version"}/>{" "}{v.version}</div>
                <div className="text-muted"><LocalizedText message={"Amended by"}/>{" "}{v.amended_by_name}, {dateTime(v.ts)}: {v.reason}</div>
                <div className="font-mono text-[11px] text-faint">{v.signature_hash?.slice(0, 24)}…</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Modal open={!!blockers} onClose={() => setBlockers(null)} title="Finish these before signing" footer={<Button onClick={() => setBlockers(null)}><LocalizedText message={"Back to the report"}/></Button>}>
        <ul className="space-y-1.5">
          {blockers?.map((b) => <li key={b} className="rounded-[6px] bg-amber-soft px-3 py-2 text-[13px]">{b}</li>)}
        </ul>
      </Modal>
      <SignDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title="Sign operative report"
        action="sign this operative report as accurate and complete"
        witness="optional"
        confirmLabel="Sign report"
        onSign={async (s) => {
          await api(`/cases/${c.id}/report/sign`, { body: s });
          reload();
          reloadVer();
          return true;
        }}
      >
        <p className="text-[13px] text-muted"><LocalizedText message={"After signing, the report and the case coding are locked. Changes need an amendment, and the signed version is kept."}/></p>
      </SignDialog>
      <SignDialog open={cosignOpen} onClose={() => setCosignOpen(false)} title="Co-sign report" action="co-sign this report" confirmLabel="Co-sign" onSign={async (s) => { await api(`/cases/${c.id}/report/cosign`, { body: s }); reload(); return true; }} />
      <Modal
        open={amend !== null}
        onClose={() => setAmend(null)}
        title="Amend signed report"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAmend(null)}><LocalizedText message={"Cancel"}/></Button>
            <Button variant="danger" busy={busy} disabled={!amend} onClick={() => run(() => api(`/cases/${c.id}/report/amend`, { body: { reason: amend } }), "Amendment started").then((x) => { if (x) { setAmend(null); reload(); reloadVer(); } })}><LocalizedText message={"Start amendment"}/></Button>
          </>
        }
      >
        <Field label="Reason for amendment"><SourceTextarea className="input" rows={3} value={amend ?? ""} onChange={(e) => setAmend(e.target.value)} /></Field>
        <p className="mt-2 text-[12px] text-muted"><LocalizedText message={"The signed version is archived with its signature. The new version must be signed again."}/></p>
        <ErrorNote error={error} className="mt-3" />
      </Modal>
    </div>
  );
}

function SigRow({ label, who, when }: { label: string; who: string | null; when: string | null }) {
 const {dateTime}=useSourceFormat();
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{who ? <><span className="font-medium">{who}</span><span className="block text-[12px] text-muted">{dateTime(when)}</span></> : <span className="text-faint"><LocalizedText message={"Not signed"}/></span>}</dd>
    </div>
  );
}

type Claim = {
  payer: string; policyNo: string | null; authorization: string | null; diagnoses: string[]; total: number; readyToSubmit: boolean;
  totals: Record<string, number>; issues: { level: string; message: string }[];
  lines: { group: string; code: string; description: string; modifiers: string; units: number; amount: number; note?: string }[];
};

export function BillingTab({ c }: TabProps) {
 const {money}=useSourceFormat();
  const { data, loading, reload } = useApi<Claim>(`/cases/${c.id}/claim`);
  useEffect(() => { reload(); }, [c.milestones.length, c.procedures.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const groups = [...new Set(data.lines.map((l) => l.group))];
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
      <section className="panel">
        <PanelHeader title="Charge lines">
          <Button size="sm" onClick={() => reload()}><LocalizedText message={"Recalculate"}/></Button>
        </PanelHeader>
        <div className="scroll-x">
          <Table className="w-full min-w-[720px] text-[13px]">
            <thead className="bg-steel/60 text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium"><LocalizedText message={"Code"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Description"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Modifiers"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Units"}/></th>
                <th className="px-4 py-2 text-right font-medium"><LocalizedText message={"Amount"}/></th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g} className="divide-y divide-line">
                <tr className="bg-steel/30"><td colSpan={4} className="px-4 py-1 text-[12px] font-semibold text-muted">{g}</td><td className="px-4 py-1 text-right text-[12px] font-semibold">{money(data.totals[g])}</td></tr>
                {data.lines.filter((l) => l.group === g).map((l, i) => (
                  <tr key={i}>
                    <td className="px-4 py-1.5 font-cond text-[15px] font-semibold">{l.code}</td>
                    <td className="px-2 py-1.5">{l.description}{l.note && <span className="block text-[11px] text-muted">{l.note}</span>}</td>
                    <td className="px-2 py-1.5">{l.modifiers || "—"}</td>
                    <td className="px-2 py-1.5">{l.units}</td>
                    <td className="px-4 py-1.5 text-right">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </Table>
        </div>
        <div className="flex justify-between border-t border-line px-4 py-3">
          <span className="font-medium"><LocalizedText message={"Total charges"}/></span>
          <span className="font-cond text-[22px] font-semibold">{money(data.total)}</span>
        </div>
      </section>
      <div className="flex flex-col gap-3">
        <section className="panel">
          <PanelHeader title="Claim">
            <Badge tone={data.readyToSubmit ? "go" : "stop"}>{data.readyToSubmit ? "Ready to submit" : "Needs fixing"}</Badge>
          </PanelHeader>
          <dl className="space-y-2 px-4 py-3 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted"><LocalizedText message={"Payer"}/></dt><dd className="font-medium">{data.payer}</dd></div>
            <div className="flex justify-between"><dt className="text-muted"><LocalizedText message={"Policy"}/></dt><dd>{data.policyNo ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted"><LocalizedText message={"Authorization"}/></dt><dd>{data.authorization ?? "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted"><LocalizedText message={"Diagnoses"}/></dt><dd>{data.diagnoses.join(", ") || "—"}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <PanelHeader title="Coding checks" />
          <ul className="space-y-1.5 p-3">
            {data.issues.length === 0 && <li className="flex items-center gap-2 px-1 text-[13px] text-go"><IconCheck size={15} /> {" "}<LocalizedText message={"No coding issues found."}/></li>}
            {data.issues.map((i) => (
              <li key={i.message} className={cx("rounded-[6px] px-3 py-2 text-[13px]", i.level === "error" ? "bg-stop-soft text-stop" : "bg-amber-soft text-amber")}>{i.message}</li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-[12px] text-muted"><LocalizedText message={"Fee schedule and anesthesia conversion factor are sample values. Load your payer contracts in production."}/></p>
        </section>
      </div>
    </div>
  );
}

export function ActivityTab({ c, reload }: TabProps) {
 const {t:translateSource}=useLocalization();
 const {dateTime,time}=useSourceFormat();
 const api=useSourceApi();
  const { data: audit } = useApi<{ id: number; ts: string; staff_name: string; entity: string; action: string; detail: string | null }[]>(`/cases/${c.id}/audit`);
  const [note, setNote] = useState("");
  const [fix, setFix] = useState<{ code: string; ts: string; reason: string } | null>(null);
  const { run, busy, error } = useAction();
  const label = Object.fromEntries(c.milestoneDefs.map((m) => [m.code, m.label]));
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <section className="panel">
          <PanelHeader title="Case timeline" />
          <div className="flex gap-2 border-b border-line p-3">
            <SourceInput className="input" placeholder="Add a note to the case record" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="primary" disabled={!note} busy={busy} onClick={() => run(() => api(`/cases/${c.id}/events`, { body: { text: note } }), "Note added").then((x) => { if (x) { setNote(""); reload(); } })}><LocalizedText message={"Add"}/></Button>
          </div>
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {c.events.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-2 text-[13px]">
                <span className="w-24 shrink-0 text-[12px] text-muted">{dateTime(e.ts).replace(/, \d{4}/, "")}</span>
                <span className={cx("min-w-0", e.severity === "critical" && "font-medium text-stop", e.severity === "warning" && "text-amber")}>
                  {e.text} {e.staff_name && <span className="text-muted">{e.staff_name}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <PanelHeader title="Milestone times" />
          <ul className="divide-y divide-line">
            {c.milestones.length === 0 && <li className="px-4 py-4 text-[13px] text-muted"><LocalizedText message={"No milestones recorded."}/></li>}
            {c.milestones.map((m) => (
              <li key={m.code} className="flex items-center gap-3 px-4 py-1.5 text-[13px]">
                <span className="w-40">{label[m.code]}</span>
                <span className="font-cond text-[15px] font-semibold">{time(m.ts)}</span>
                <span className="flex-1 text-[12px] text-muted">{m.recorded_by}</span>
                <Button size="sm" variant="ghost" onClick={() => setFix({ code: m.code, ts: toLocalInput(m.ts), reason: "" })}><LocalizedText message={"Correct"}/></Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel">
        <PanelHeader title="Audit log" />
        <div className="scroll-x">
          <Table className="w-full text-[12px]">
            <thead className="bg-steel/60 text-left text-muted">
              <tr><th className="px-4 py-2 font-medium"><LocalizedText message={"When"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Who"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"What"}/></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(audit ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-4 py-1.5 text-muted">{dateTime(a.ts).replace(/, \d{4}/, "")}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{a.staff_name}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{a.entity.replace(/_/g, " ")} {a.action}</span>
                    {a.detail && a.detail !== "null" && <span className="block max-w-md truncate font-mono text-[11px] text-faint" title={a.detail}>{a.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </section>
      <Modal
        open={!!fix}
        onClose={() => setFix(null)}
        title={translateSource("Correct {value0} time",{value0:fix ? label[fix.code]?.toLowerCase() : ""})}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFix(null)}><LocalizedText message={"Cancel"}/></Button>
            <Button variant="primary" busy={busy} disabled={!fix?.reason} onClick={() => run(() => api(`/cases/${c.id}/milestones/${fix!.code}`, { method: "PATCH", body: { ts: new Date(fix!.ts).toISOString(), reason: fix!.reason } }), "Time corrected").then((x) => { if (x) { setFix(null); reload(); } })}><LocalizedText message={"Save correction"}/></Button>
          </>
        }
      >
        {fix && (
          <div className="space-y-3">
            <Field label="Correct time"><SourceInput type="datetime-local" className="input" value={fix.ts} onChange={(e) => setFix({ ...fix, ts: e.target.value })} /></Field>
            <Field label="Reason"><SourceInput className="input" value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} placeholder="e.g. entered late from paper record" /></Field>
            <p className="text-[12px] text-muted"><LocalizedText message={"The original time and the reason are kept in the audit log."}/></p>
          </div>
        )}
        <ErrorNote error={error} className="mt-3" />
      </Modal>
    </div>
  );
}
