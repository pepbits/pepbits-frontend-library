"use client";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceSelect, SourceButton, Table } from "@pepbits/ops-ui";

import { useState } from "react";
import { useSourceApi } from "./../../lib/api";
import { useDiagnoses, useLookups, useProcedures, useStaff } from "./../../lib/masters";
import { useSourceFormat} from "./../../lib/format";
import { Badge, Button, ErrorNote, PanelHeader, Select, cx, useAction } from "../ui";
import { IconClose } from "../icons";
import { CodePicker } from "../BookCase";
import type { TabProps } from "./types";

export function CodingTab({ c, reload }: TabProps) {
 const {money}=useSourceFormat();
 const api=useSourceApi();
  const diagnoses = useDiagnoses();
  const procedures = useProcedures();
  const lookups = useLookups();
  const staff = useStaff();
  const { run, error } = useAction();
  const [newRole, setNewRole] = useState("Secondary");
  const signed = c.report.status === "Signed";
  const locked = signed || c.status === "CANCELLED";
  const started = ["IN_SURGERY", "RECOVERY", "COMPLETED"].includes(c.status);
  const surgeons = staff.filter((s) => s.role === "SURGEON" || s.role === "ANESTHESIOLOGIST");

  const patchProc = (rowId: number, body: Record<string, unknown>, msg?: string) =>
    run(() => api(`/cases/${c.id}/procedures/${rowId}`, { method: "PATCH", body }), msg).then((r) => r && reload());

  return (
    <div className="flex flex-col gap-3">
      {signed && <p className="rounded-[8px] bg-ceil-soft px-4 py-2 text-[13px] text-ceil-2"><LocalizedText message={"The operative report is signed, so coding is locked. Start an amendment on the report tab to change it."}/></p>}
      <ErrorNote error={error} />
      <section className="panel">
        <PanelHeader title="Diagnoses (ICD-10)">
          {!locked && (
            <div className="w-80">
              <CodePicker
                label=""
                items={diagnoses}
                itemKey={(d) => d.id}
                render={(d) => (<><span className="font-medium">{d.icd10}</span> <span className="text-muted">{d.description}</span></>)}
                match={(d, q) => `${d.icd10} ${d.description}`.toLowerCase().includes(q)}
                onPick={(d) => run(() => api(`/cases/${c.id}/diagnoses`, { body: { diagnosisId: d.id, isPrimary: c.diagnoses.length === 0 } }), `${d.icd10} added`).then((r) => r && reload())}
              />
            </div>
          )}
        </PanelHeader>
        <ul className="divide-y divide-line">
          {c.diagnoses.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-24 font-cond text-[16px] font-semibold">{d.icd10}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{d.description}</span>
                <span className="text-[12px] text-muted">{d.category}</span>
              </span>
              {d.is_primary ? (
                <Badge tone="ceil"><LocalizedText message={"Primary"}/></Badge>
              ) : (
                !locked && <Button size="sm" variant="ghost" onClick={() => run(() => api(`/cases/${c.id}/diagnoses`, { body: { diagnosisId: d.diagnosis_id, isPrimary: true } }), "Primary diagnosis changed").then((r) => r && reload())}><LocalizedText message={"Make primary"}/></Button>
              )}
              {!locked && !d.is_primary && (
                <SourceButton aria-label="Remove diagnosis" className="rounded p-1 text-muted hover:bg-stop-soft hover:text-stop" onClick={() => run(() => api(`/cases/${c.id}/diagnoses/${d.id}`, { method: "DELETE" }), "Diagnosis removed").then((r) => r && reload())}>
                  <IconClose size={15} />
                </SourceButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <PanelHeader title="Procedures (CPT)">
          {!locked && (
            <div className="flex items-center gap-2">
              <SourceSelect className="input h-[34px] w-32" value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Role for new procedure">
                {(lookups.PROC_ROLE ?? ["Primary", "Secondary", "Add-on"]).map((r) => <option key={r}>{r}</option>)}
              </SourceSelect>
              <div className="w-80">
                <CodePicker
                  label=""
                  items={procedures}
                  itemKey={(p) => p.id}
                  render={(p) => (<><span className="font-medium">{p.cpt}</span> {p.name}{p.is_addon ? <span className="text-muted"> {" "}<LocalizedText message={"(add-on)"}/></span> : null}</>)}
                  match={(p, q) => `${p.cpt} ${p.name}`.toLowerCase().includes(q)}
                  onPick={(p) => run(() => api(`/cases/${c.id}/procedures`, { body: { procedureId: p.id, role: p.is_addon ? "Add-on" : newRole } }), `${p.cpt} added`).then((r) => r && reload())}
                />
              </div>
            </div>
          )}
        </PanelHeader>
        {started && !locked && <p className="border-b border-line bg-amber-soft/60 px-4 py-1.5 text-[12px] text-amber"><LocalizedText message={"Procedures added now are recorded as unplanned and flagged in the activity log."}/></p>}
        <div className="scroll-x">
          <Table className="w-full min-w-[980px] text-[13px]">
            <thead className="bg-steel/60 text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium"><LocalizedText message={"CPT"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Procedure"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Role"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Surgeon"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Approach"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Side"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Modifiers"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"ICD link"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Performed"}/></th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.procedures.map((p) => (
                <tr key={p.id} className={cx(!p.planned && "bg-amber-soft/40")}>
                  <td className="px-4 py-2 font-cond text-[16px] font-semibold">{p.cpt}</td>
                  <td className="px-2 py-2">
                    {p.name}
                    <span className="block text-[12px] text-muted">{p.specialty}<LocalizedText message={", base fee"}/>{" "}{money(p.fee)}{!p.planned && ", unplanned"}</span>
                  </td>
                  <td className="w-32 px-2 py-2">
                    <Select disabled={locked} className="input h-8" value={p.role} onChange={(e) => patchProc(p.id, { role: e.target.value }, "Role changed")} options={lookups.PROC_ROLE ?? []} />
                  </td>
                  <td className="w-48 px-2 py-2">
                    <Select disabled={locked} className="input h-8" value={String(p.surgeon_id ?? "")} placeholder="—" onChange={(e) => patchProc(p.id, { surgeon_id: e.target.value ? Number(e.target.value) : null }, "Surgeon changed")} options={surgeons.map((s) => ({ value: String(s.id), label: s.name }))} />
                  </td>
                  <td className="w-36 px-2 py-2">
                    <Select disabled={locked} className="input h-8" value={p.approach ?? ""} onChange={(e) => patchProc(p.id, { approach: e.target.value })} options={lookups.APPROACH ?? []} />
                  </td>
                  <td className="w-28 px-2 py-2">
                    <Select disabled={locked} className="input h-8" value={p.laterality} onChange={(e) => patchProc(p.id, { laterality: e.target.value })} options={lookups.LATERALITY ?? []} />
                  </td>
                  <td className="w-28 px-2 py-2">
                    <SourceInput
                      disabled={locked}
                      className="input h-8"
                      defaultValue={p.modifiers}
                      placeholder="e.g. 59"
                      onBlur={(e) => e.target.value !== p.modifiers && patchProc(p.id, { modifiers: e.target.value.toUpperCase() }, "Modifiers saved")}
                    />
                  </td>
                  <td className="px-2 py-2">
                    {p.is_addon ? <Badge tone="muted"><LocalizedText message={"Add-on"}/></Badge> : p.mapped_dx === 0 ? <Badge tone="muted"><LocalizedText message={"No mapping"}/></Badge> : p.linked_dx > 0 ? <Badge tone="go"><LocalizedText message={"Supported"}/></Badge> : <Badge tone="amber"><LocalizedText message={"Check diagnosis"}/></Badge>}
                  </td>
                  <td className="px-2 py-2">
                    <label className="flex items-center gap-2">
                      <SourceInput type="checkbox" className="h-4 w-4 accent-[#2e8b62]" disabled={locked || !started} checked={!!p.performed} onChange={(e) => patchProc(p.id, { performed: e.target.checked ? 1 : 0 }, e.target.checked ? "Marked performed" : "Marked not performed")} />
                      <span className="text-[12px] text-muted">{p.performed ? "Yes" : started ? "No" : "After incision"}</span>
                    </label>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {!locked && p.role !== "Primary" && (
                      <SourceButton aria-label="Remove procedure" className="rounded p-1 text-muted hover:bg-stop-soft hover:text-stop" onClick={() => run(() => api(`/cases/${c.id}/procedures/${p.id}`, { method: "DELETE" }), "Procedure removed").then((r) => r && reload())}>
                        <IconClose size={15} />
                      </SourceButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <p className="border-t border-line px-4 py-2 text-[12px] text-muted">
          <LocalizedText message={"The claim applies -51 to lower-value secondary procedures, -50 for bilateral, LT/RT for sided procedures and -80 for an assistant surgeon. ICD link checks the CPT–diagnosis mapping in Masters."}/></p>
      </section>
    </div>
  );
}
