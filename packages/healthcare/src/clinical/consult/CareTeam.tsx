"use client";
import React, {useEffect, useState} from "react";
import {Button, Input, Textarea, Select, Badge} from "@pepbits/ui";
import {Drawer} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {useConsultPort} from "../context/consult-host";
import {useClinicalActor} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import {ClinicalPanel, ProblemNotice} from "../layout/panel";
import type {CareTeamData, CareTeamHandover} from "../models/consult-workflow";
import {useWorkflow} from "./useWorkflow";

export function CareTeam({encounterId, onChanged, onBusyChange, disabled = false}: {
  encounterId: string; onChanged?: () => void | Promise<void>; onBusyChange?: (busy: boolean) => void; disabled?: boolean;
}) {
  const port = useConsultPort(), {t} = useLocalization(), format = useFormatters(), {can} = useClinicalActor();
  const [data, setData] = useState<CareTeamData | null>(null), [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<"handover" | "reassign" | "member" | "history" | null>(null);
  const [form, setForm] = useState({userId: "", reason: "", illnessSeverity: "stable", summary: "", actions: "", contingency: "", role: "primary-nurse", note: ""});
  const [synthesis, setSynthesis] = useState(""), [declineReason, setDeclineReason] = useState(""), [declining, setDeclining] = useState(false);
  const action = useWorkflow(onBusyChange, (mode !== null && mode !== "history") || !!synthesis || !!declineReason);
  const set = (key: keyof typeof form, value: string) => setForm(current => ({...current, [key]: value}));
  useEffect(() => {
    const abort = new AbortController(); setData(null); action.setProblems([]);
    void port.loadCareTeam(encounterId, abort.signal).then(value => {if (!abort.signal.aborted) setData(value);}, error => {if (!abort.signal.aborted) action.setProblems(problemsOf(error));});
    return () => abort.abort();
  }, [port, encounterId, attempt]);
  const act = (allowed: boolean, write: () => Promise<CareTeamData>) => {
    if (disabled || !allowed) return;
    void action.run(write, async next => {setData(next); setMode(null); setSynthesis(""); setDeclineReason(""); setDeclining(false); await onChanged?.();});
  };
  const open = (next: typeof mode) => {setForm({userId: "", reason: "", illnessSeverity: "stable", summary: "", actions: "", contingency: "", role: data?.roles.find(r => can("note.write") || r.code === "primary-nurse")?.code ?? "primary-nurse", note: ""}); setMode(next);};
  const locked = disabled || action.busy;
  const doctors = data?.staff.filter(u => (data.class === "IP" ? u.role === "doctor" : u.role !== "nurse") && u.id !== data.responsible?.userId) ?? [];
  const roles = data?.roles.filter(r => can("note.write") || r.code === "primary-nurse") ?? [];
  const people = data?.staff.filter(u => form.role === "primary-nurse" ? u.role === "nurse" : u.role !== "nurse") ?? [];
  const pending = data?.pending;
  const handoverValid = doctors.some(u => u.id === form.userId) && form.reason.trim().length >= 3 && form.summary.trim().length >= 10 && form.actions.trim().length >= 3;
  return <ClinicalPanel title="Care team">
    <div className="grid gap-3"><ProblemNotice problems={action.problems}/>
      {!data ? <>{!action.problems.length && <p>{t("Loading care team…")}</p>}<Button onClick={() => setAttempt(n => n + 1)}>{t("Retry")}</Button></> : <>
        <p>{t("Responsible clinician")}: {data.responsible ? `${data.responsible.name} · ${format.dateTime(data.responsible.from)}` : t("Not assigned")}</p>
        <div className="flex gap-2">{data.can.handover && <Button disabled={locked} onClick={() => open("handover")}>{t("Hand over")}</Button>}{data.can.reassign && <Button disabled={locked} onClick={() => open("reassign")}>{t("Reassign")}</Button>}</div>
        {pending && <div className="grid gap-2 rounded-[var(--radius)] border border-[var(--border)] p-3">
          <p>{t("Handover")}: {pending.fromName} → {pending.toName} <Badge tone={pending.ipass.illnessSeverity === "unstable" ? "danger" : pending.ipass.illnessSeverity === "watcher" ? "warning" : "success"}>{t(pending.ipass.illnessSeverity)}</Badge></p>
          <p>{pending.requestedByName} · {format.dateTime(pending.requestedAt)} · {pending.reason}</p>
          {data.can.respond ? <><IpassView handover={pending}/>{declining ? <>
            <Input label="Reason for declining" disabled={locked} value={declineReason} onChange={e => setDeclineReason(e.target.value)}/>
            <Button disabled={locked} onClick={() => setDeclining(false)}>{t("Back")}</Button>
            <Button disabled={locked || declineReason.trim().length < 3} onClick={() => act(data.can.respond && declineReason.trim().length >= 3, () => port.declineHandover(encounterId, pending.id, declineReason))}>{t("Decline handover")}</Button>
          </> : <><Textarea label="Synthesis by receiver" required disabled={locked} value={synthesis} onChange={e => setSynthesis(e.target.value)}/>
            <p>{t("Summarise back what you are taking on: key problems, actions and what to watch for.")}</p>
            <Button disabled={locked} onClick={() => setDeclining(true)}>{t("Decline")}</Button><Button disabled={locked || synthesis.trim().length < 10} onClick={() => act(data.can.respond && synthesis.trim().length >= 10, () => port.acceptHandover(encounterId, pending.id, synthesis))}>{t("Accept responsibility")}</Button>
          </>}</> : <p>{t("The current clinician remains responsible until the receiving clinician accepts.")}</p>}
          {data.can.cancel && !data.can.respond && <Button disabled={locked} onClick={() => act(data.can.cancel, () => port.cancelHandover(encounterId, pending.id))}>{t("Cancel handover")}</Button>}
        </div>}
        <p className="font-semibold">{t("Team")}</p>
        {!data.team.some(m => m.role !== "attending") && <p>{t("No other team members.")}</p>}
        <ul>{data.team.filter(m => m.role !== "attending").map(member => <li key={member.id}>{member.name} · {t(member.roleLabel)} · {member.note}
          {data.can.addMember && (can("note.write") || member.role === "primary-nurse") && <Button disabled={locked} aria-label={`${t("Remove")} ${member.name}`} onClick={() => act(data.can.addMember && (can("note.write") || member.role === "primary-nurse"), () => port.endCareTeamMember(encounterId, member.id))}>{t("Remove")}</Button>}</li>)}</ul>
        {data.can.addMember && <Button disabled={locked} onClick={() => open("member")}>{t("Add to team")}</Button>}
        {(data.history.length > 0 || data.handovers.length > 0) && <Button onClick={() => setMode("history")}>{t("History")}</Button>}
        <Drawer open={mode !== null} onClose={() => {if (!action.busy) setMode(null);}} title={t(mode === "handover" ? "Hand over responsibility (I-PASS)" : mode === "reassign" ? "Reassign responsibility" : mode === "member" ? "Add team member" : "Care team history")} width="lg">
          <div className="grid gap-3"><ProblemNotice problems={action.problems}/>
            {(mode === "handover" || mode === "reassign") && <>
              <p>{t(mode === "handover" ? "The receiving clinician must accept, with a read-back of what they are taking on. Until then you remain responsible." : "Use only when the responsible clinician is unavailable. Responsibility moves at once, any waiting handover is superseded, and the new clinician gets an urgent task.")}</p>
              <Select label={mode === "handover" ? "Hand over to" : "New responsible clinician"} disabled={locked} value={form.userId} onChange={e => set("userId", e.target.value)} options={doctors.map(u => ({value: u.id, label: u.name}))}/>
              <Input label="Reason" disabled={locked} value={form.reason} onChange={e => set("reason", e.target.value)}/>
            </>}
            {mode === "handover" && <>
              <Select label="I · Illness severity" disabled={locked} value={form.illnessSeverity} onChange={e => set("illnessSeverity", e.target.value)} options={[{value: "stable", label: "Stable"}, {value: "watcher", label: "Watcher"}, {value: "unstable", label: "Unstable"}]}/>
              <Textarea label="P · Patient summary" required disabled={locked} value={form.summary} onChange={e => set("summary", e.target.value)}/>
              <Textarea label="A · Action list" required disabled={locked} value={form.actions} onChange={e => set("actions", e.target.value)}/>
              <Textarea label="S · Situation awareness and contingency" disabled={locked} value={form.contingency} onChange={e => set("contingency", e.target.value)}/>
              <p>{t("S · Synthesis by receiver is recorded when they accept.")}</p>
              <Button disabled={locked || !handoverValid} onClick={() => act(data.can.handover && handoverValid, () => port.requestHandover(encounterId, {toUserId: form.userId, reason: form.reason, ipass: {illnessSeverity: form.illnessSeverity, summary: form.summary, actions: form.actions, contingency: form.contingency}}))}>{t("Send handover")}</Button>
            </>}
            {mode === "reassign" && <Button disabled={locked || !form.userId || form.reason.trim().length < 5} onClick={() => act(data.can.reassign && doctors.some(u => u.id === form.userId) && form.reason.trim().length >= 5, () => port.reassignAttending(encounterId, {userId: form.userId, reason: form.reason}))}>{t("Reassign")}</Button>}
            {mode === "member" && <><Select label="Role" disabled={locked} value={form.role} onChange={e => {set("role", e.target.value); set("userId", "");}} options={roles.map(r => ({value: r.code, label: r.label}))}/>
              <Select label="Person" disabled={locked} value={form.userId} onChange={e => set("userId", e.target.value)} options={people.map(u => ({value: u.id, label: u.name}))}/>
              <Input label="Note (optional)" disabled={locked} value={form.note} onChange={e => set("note", e.target.value)}/>
              <Button disabled={locked || !people.some(u => u.id === form.userId) || !roles.some(r => r.code === form.role)} onClick={() => act(data.can.addMember && people.some(u => u.id === form.userId) && roles.some(r => r.code === form.role), () => port.addCareTeamMember(encounterId, {role: form.role, userId: form.userId, note: form.note}))}>{t("Add to team")}</Button></>}
            {mode === "history" && <><h3>{t("Handovers")}</h3>{data.handovers.map(h => <article key={h.id}><p>{h.fromName} → {h.toName} · {t(h.status)} · {format.dateTime(h.requestedAt)} · {h.reason}</p><IpassView handover={h}/><p>{h.synthesis}</p><p>{h.declineReason}</p>{h.respondedAt && <p>{format.dateTime(h.respondedAt)}</p>}</article>)}
              <h3>{t("Previous team members")}</h3>{data.history.map(m => <p key={m.id}>{m.name} · {t(m.roleLabel)} · {format.dateTime(m.from)} – {m.to ? format.dateTime(m.to) : ""} · {m.endReason}</p>)}</>}
          </div>
        </Drawer>
      </>}
    </div>
  </ClinicalPanel>;
}
function IpassView({handover: h}: {handover: CareTeamHandover}) {
  const {t} = useLocalization();
  return <dl>{[["P · Patient summary", h.ipass.summary], ["A · Action list", h.ipass.actions], ["S · Situation awareness and contingency", h.ipass.contingency]].map(([label, value]) => value && <div key={label}><dt>{t(label!)}</dt><dd className="whitespace-pre-wrap" data-phi>{value}</dd></div>)}</dl>;
}
