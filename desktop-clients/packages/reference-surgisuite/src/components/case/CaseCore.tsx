"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceButton, Table } from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { useSourceApi } from "./../../lib/api";
import { TEAM_ROLE_STAFF, useEquipment, useLookups, useStaff, useTheatres } from "./../../lib/masters";
import { APPROVAL_LABEL, CONSENT_LABEL, duration, minutesBetween, toLocalInput , useSourceFormat} from "./../../lib/format";
import { Badge, Button, ErrorNote, Field, PanelHeader, Select, cx, useAction } from "../ui";
import { IconAlert, IconCheck, IconClose, IconPlus } from "../icons";
import type { TabProps } from "./types";

export function OverviewTab({ c, reload }: TabProps) {
 const {time}=useSourceFormat();
 const api=useSourceApi();
  const lookups = useLookups();
  const theatres = useTheatres();
  const { run, busy, error } = useAction();
  const initial = {
    theatre_id: String(c.theatre_id ?? ""), scheduled_start: toLocalInput(c.scheduled_start), est_duration_min: String(c.est_duration_min),
    case_class: c.case_class, op_type: c.op_type, anesthesia_type: c.anesthesia_type ?? "", asa_class: c.asa_class, position: c.position ?? "",
    laterality: c.laterality, wound_class: c.wound_class, notes: c.notes ?? "",
  };
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial), [c.id, c.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = !["REQUESTED", "PENDING_APPROVAL", "SCHEDULED", "CHECKED_IN", "POSTPONED"].includes(c.status);
  const locked = c.status === "CANCELLED";
  const changed = Object.entries(f).filter(([k, v]) => v !== (initial as Record<string, string>)[k]);

  const save = async () => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of changed) {
      if (k === "theatre_id" || k === "est_duration_min") body[k] = Number(v);
      else if (k === "scheduled_start") body[k] = new Date(v).toISOString();
      else body[k] = v || null;
    }
    const ok = await run(() => api(`/cases/${c.id}`, { method: "PATCH", body }), "Case updated");
    if (ok) reload();
  };

  const r = c.readiness;
  const checks: { ok: boolean; label: string; detail?: string }[] = [
    { ok: r.approvals.length === 0, label: "Approvals", detail: r.approvals.map((a) => APPROVAL_LABEL[a.kind]).join(", ") || "All approved" },
    { ok: r.consents.length === 0 || c.case_class === "Emergency", label: "Consents", detail: r.consents.length ? `Missing: ${r.consents.map((k) => CONSENT_LABEL[k]).join(", ")}` : "Signed and witnessed" },
    { ok: r.signIn, label: "Sign-in checklist" },
    { ok: r.timeOut, label: "Time-out checklist" },
    { ok: r.signOut, label: "Sign-out checklist" },
    { ok: r.counts, label: "Counts reconciled and witnessed" },
    { ok: r.sterileTraysPending === 0, label: "Instrument trays sterile", detail: r.sterileTraysPending ? `${r.sterileTraysPending} tray(s) still in CSSD` : undefined },
    { ok: r.stockShort.length === 0, label: "Stock available", detail: r.stockShort.join(", ") || undefined },
  ];
  const inRoom = c.milestones.find((m) => m.code === "IN_ROOM")?.ts;
  const outRoom = c.milestones.find((m) => m.code === "OUT_OF_ROOM")?.ts;
  const inc = c.milestones.find((m) => m.code === "INCISION")?.ts;
  const clo = c.milestones.find((m) => m.code === "CLOSURE_END")?.ts;

  return (
    <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
      <section className="panel">
        <PanelHeader title="Case details">
          {changed.length > 0 && !locked && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setF(initial)}><LocalizedText message={"Discard"}/></Button>
              <Button size="sm" variant="primary" busy={busy} onClick={save}><LocalizedText message={"Save"}/>{" "}{changed.length} {" "}<LocalizedText message={"change"}/>{changed.length > 1 ? "s" : ""}</Button>
            </>
          )}
        </PanelHeader>
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
          <Field label="Theatre"><Select disabled={started || locked} value={f.theatre_id} onChange={(e) => setF({ ...f, theatre_id: e.target.value })} options={theatres.map((t) => ({ value: String(t.id), label: `${t.code} ${t.name}` }))} /></Field>
          <Field label="Scheduled start"><SourceInput disabled={started || locked} type="datetime-local" step={900} className="input" value={f.scheduled_start} onChange={(e) => setF({ ...f, scheduled_start: e.target.value })} /></Field>
          <Field label="Booked duration (min)"><SourceInput disabled={started || locked} type="number" step={15} min={15} className="input" value={f.est_duration_min} onChange={(e) => setF({ ...f, est_duration_min: e.target.value })} /></Field>
          <Field label="Case class"><Select disabled={locked} value={f.case_class} onChange={(e) => setF({ ...f, case_class: e.target.value })} options={lookups.CASE_CLASS ?? []} /></Field>
          <Field label="Operation type"><Select disabled={locked} value={f.op_type} onChange={(e) => setF({ ...f, op_type: e.target.value })} options={lookups.OP_TYPE ?? []} /></Field>
          <Field label="Anesthesia"><Select disabled={locked} value={f.anesthesia_type} placeholder="Not set" onChange={(e) => setF({ ...f, anesthesia_type: e.target.value })} options={lookups.ANESTHESIA ?? []} /></Field>
          <Field label="ASA class"><Select disabled={locked} value={f.asa_class} onChange={(e) => setF({ ...f, asa_class: e.target.value })} options={lookups.ASA ?? []} /></Field>
          <Field label="Position"><Select disabled={locked} value={f.position} placeholder="Not set" onChange={(e) => setF({ ...f, position: e.target.value })} options={lookups.POSITION ?? []} /></Field>
          <Field label="Laterality"><Select disabled={locked} value={f.laterality} onChange={(e) => setF({ ...f, laterality: e.target.value })} options={lookups.LATERALITY ?? []} /></Field>
          <Field label="Wound class"><Select disabled={locked} value={f.wound_class} onChange={(e) => setF({ ...f, wound_class: e.target.value })} options={(lookups.WOUND_CLASS ?? []).map((w) => ({ value: w, label: { I: "I Clean", II: "II Clean-contaminated", III: "III Contaminated", IV: "IV Dirty" }[w] ?? w }))} /></Field>
          <Field label="Notes" className="col-span-2"><SourceInput disabled={locked} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Special requests, isolation, interpreter…" /></Field>
        </div>
        {started && <p className="px-4 pb-3 text-[12px] text-muted"><LocalizedText message={"The case has started, so theatre and time are fixed. Correct milestone times from the activity tab if needed."}/></p>}
        {c.cancel_reason && <p className="mx-4 mb-3 rounded-[6px] bg-stop-soft px-3 py-2 text-[13px] text-stop"><LocalizedText message={"Cancelled:"}/>{" "}{c.cancel_reason}</p>}
        <ErrorNote error={error} className="mx-4 mb-4" />
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          {[
            ["In room", inRoom ? time(inRoom) : "—"],
            ["Room time", duration(minutesBetween(inRoom, outRoom ?? (inRoom ? new Date().toISOString() : null)))],
            ["Incision to closure", duration(minutesBetween(inc, clo ?? (inc ? new Date().toISOString() : null)))],
            ["Blood loss", c.ebl_ml === null ? "—" : `${c.ebl_ml} ml`],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-2.5">
              <div className="text-[11px] text-muted">{k}</div>
              <div className="font-cond text-[18px] font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <section className="panel">
          <PanelHeader title="Readiness" />
          <ul className="divide-y divide-line">
            {checks.map((x) => (
              <li key={x.label} className="flex items-start gap-3 px-4 py-2">
                <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", x.ok ? "bg-go-soft text-go" : "bg-amber-soft text-amber")}>
                  {x.ok ? <IconCheck size={13} /> : <IconAlert size={12} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium">{x.label}</span>
                  {x.detail && <span className="block text-[12px] text-muted">{x.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <PanelHeader title="Recent activity" />
          <ul className="divide-y divide-line">
            {c.events.slice(0, 6).map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-2 text-[13px]">
                <span className="w-12 shrink-0 font-cond font-semibold text-muted">{time(e.ts)}</span>
                <span className={cx("min-w-0", e.severity === "critical" && "text-stop", e.severity === "warning" && "text-amber")}>
                  {e.text}
                  {e.staff_name && <span className="text-muted"> {e.staff_name}</span>}
                </span>
              </li>
            ))}
            {c.events.length === 0 && <li className="px-4 py-3 text-[13px] text-muted"><LocalizedText message={"Nothing recorded yet."}/></li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function TeamTab({ c, reload }: TabProps) {
 const {t:translateSource}=useLocalization();
 const {time,dateTime}=useSourceFormat();
 const api=useSourceApi();
  const staff = useStaff();
  const equipment = useEquipment();
  const { run, busy, error } = useAction();
  const [role, setRole] = useState("Assistant Surgeon");
  const [who, setWho] = useState("");
  const [force, setForce] = useState(false);
  const locked = c.status === "CANCELLED";
  const equipIds = c.equipment.map((e) => e.id);

  const add = async () => {
    const ok = await run(() => api(`/cases/${c.id}/team`, { body: { staffId: Number(who), role, force } }), "Team member added");
    if (ok) {
      setWho("");
      setForce(false);
      reload();
    }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
      <section className="panel">
        <PanelHeader title="Surgical team" />
        <div className="scroll-x">
          <Table className="w-full text-[13px]">
            <thead className="bg-steel/60 text-left text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2 font-medium"><LocalizedText message={"Role"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Name"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"In"}/></th>
                <th className="px-2 py-2 font-medium"><LocalizedText message={"Out"}/></th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.team.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 font-medium">{t.role}</td>
                  <td className="px-2 py-2">
                    {t.name}
                    <span className="block text-[12px] text-muted">{t.title}</span>
                  </td>
                  <td className="px-2 py-2 font-cond text-[14px]">{time(t.time_in)}</td>
                  <td className="px-2 py-2 font-cond text-[14px]">{time(t.time_out)}</td>
                  <td className="px-4 py-2 text-right">
                    {!locked && (
                      <div className="flex justify-end gap-1">
                        {!t.time_in && ["IN_OR", "IN_SURGERY"].includes(c.status) && (
                          <Button size="sm" onClick={() => run(() => api(`/cases/${c.id}/team/${t.id}`, { method: "PATCH", body: { action: "in" } }), `${t.name} signed in`).then((r) => r && reload())}><LocalizedText message={"Sign in"}/></Button>
                        )}
                        {t.time_in && !t.time_out && (
                          <Button size="sm" onClick={() => run(() => api(`/cases/${c.id}/team/${t.id}`, { method: "PATCH", body: { action: "out" } }), `${t.name} signed out`).then((r) => r && reload())}><LocalizedText message={"Hand over"}/></Button>
                        )}
                        {!t.time_in && (
                          <SourceButton aria-label={translateSource("Remove {value0}",{value0:t.name})} className="rounded p-1 text-muted hover:bg-stop-soft hover:text-stop" onClick={() => run(() => api(`/cases/${c.id}/team/${t.id}`, { method: "DELETE" }), "Removed").then((r) => r && reload())}>
                            <IconClose size={15} />
                          </SourceButton>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {!locked && (
          <div className="flex flex-wrap items-end gap-2 border-t border-line p-4">
            <Field label="Role" className="w-48">
              <Select value={role} onChange={(e) => { setRole(e.target.value); setWho(""); }} options={Object.keys(TEAM_ROLE_STAFF)} />
            </Field>
            <Field label="Person" className="min-w-56 flex-1">
              <Select value={who} placeholder="Choose" onChange={(e) => setWho(e.target.value)} options={staff.filter((s) => TEAM_ROLE_STAFF[role].includes(s.role) && s.active).map((s) => ({ value: String(s.id), label: `${s.name}${s.specialty ? ` — ${s.specialty}` : ""}` }))} />
            </Field>
            <Button variant="primary" disabled={!who} busy={busy} onClick={add}><IconPlus size={16} /> {" "}<LocalizedText message={"Add to team"}/></Button>
            {!!error && (error as { status?: number }).status === 409 && (
              <label className="flex items-center gap-2 text-[13px]"><SourceInput type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> {" "}<LocalizedText message={"Assign anyway"}/></label>
            )}
            <ErrorNote error={error} className="w-full" />
          </div>
        )}
        <p className="px-4 pb-3 text-[12px] text-muted"><LocalizedText message={"Team members are checked against their credentials. People with a recorded time in stay on the record; use hand over to sign them out."}/></p>
      </section>

      <section className="panel">
        <PanelHeader title="Equipment" />
        <div className="flex flex-wrap gap-1.5 p-4">
          {equipment.map((e) => {
            const on = equipIds.includes(e.id);
            return (
              <SourceButton
                key={e.id}
                disabled={locked || busy}
                onClick={async () => {
                  const next = on ? equipIds.filter((x) => x !== e.id) : [...equipIds, e.id];
                  const r = await run(() => api<{ warnings: string[] }>(`/cases/${c.id}/equipment`, { method: "PUT", body: { equipmentIds: next } }), on ? `${e.name} removed` : `${e.name} added`);
                  if (r) reload();
                }}
                className={cx("rounded-[6px] border px-2.5 py-1 text-left text-[13px]", on ? "border-ceil bg-ceil-soft text-ceil-2" : "border-line hover:bg-steel")}
              >
                {e.name}
                {e.status !== "Ready" && <Badge tone="stop" className="ml-1.5">{e.status}</Badge>}
              </SourceButton>
            );
          })}
        </div>
        <p className="px-4 pb-3 text-[12px] text-muted"><LocalizedText message={"Booking equipment checks for overlap with other cases at the same time."}/></p>
        <div className="border-t border-line px-4 py-3 text-[12px] text-muted">
          <LocalizedText message={"Everyone on the team is signed in automatically when the patient enters the room, and signed out when the patient leaves. Last change"}/>{" "}{dateTime(c.events[0]?.ts)}.
        </div>
      </section>
    </div>
  );
}
