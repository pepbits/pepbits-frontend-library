"use client";

import { CalendarCheck, CalendarX, CheckCheck, Clock, FileText, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, CardGrid, CardHeader, DateInput, ErrorNote, Field, Input, Kpi, LineChart, Modal, Ring, Segmented, Skeleton, Textarea, useToast } from "../ui";
import { AttendanceCalendar, ATT_LABEL } from "../components/shared/attendance-calendar";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { AttendanceRoster, StudentAttendanceMonth } from "../lib/contract";
import type { AttendanceRow } from "../lib/types";
import { cn, isoDay } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type St = AttendanceRow["status"];
const TONES: Record<St, string> = { P: "bg-ok text-white", A: "bg-bad text-white", L: "bg-warn text-white", E: "bg-info text-white" };

export function AttendancePage() {
  const { role } = useSession();
  return role === "student" || role === "parent" ? <MyAttendance /> : <Register />;
}

function lastSchoolDay() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return isoDay(d);
}

function Register() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtShort } = useFormat();
  const api = useSchoolApi();
  const toast = useToast();
  const { cls, tch } = useLookups();
  const { classes, homeClassId } = useMyClasses();
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(lastSchoolDay);
  const [rows, setRows] = useState<AttendanceRow[] | null>(null);
  const [initial, setInitial] = useState<string>("");
  const [trend, setTrend] = useState<{ date: string; pct: number }[]>([]);
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!classId && homeClassId) setClassId(homeClassId); }, [homeClassId, classId]);
  const load = useCallback(() => {
    if (!classId) return;
    setRows(null); setError(null);
    api.get<AttendanceRoster>(`/attendance?classId=${encodeURIComponent(classId)}&date=${date}`)
      .then((j) => { setRows(j.data); setInitial(JSON.stringify(j.data)); setTaken(j.taken); setTrend(j.trend); })
      .catch((e: Error) => setError(e.message));
  }, [api, classId, date]);
  useEffect(load, [load]);

  const wd = new Date(date + "T00:00:00").getDay();
  const weekend = wd === 0 || wd === 6;
  const future = date > isoDay(new Date());
  const dirty = rows !== null && JSON.stringify(rows) !== initial;
  const counts = useMemo(() => (rows ?? []).reduce<Record<St, number>>((a, r) => { a[r.status]++; return a; }, { P: 0, A: 0, L: 0, E: 0 }), [rows]);
  const pct = rows?.length ? Math.round(((rows.length - counts.A) / rows.length) * 1000) / 10 : 0;
  const setAll = (s: St) => setRows((r) => r?.map((x) => ({ ...x, status: s })) ?? r);
  const setOne = (id: string, s: St) => setRows((r) => r?.map((x) => (x.studentId === id ? { ...x, status: s } : x)) ?? r);

  const save = async () => {
    if (!rows) return;
    setSaving(true);
    try {
      await api.post("/attendance", { date, rows: rows.map((r) => ({ studentId: r.studentId, status: r.status })) });
      setInitial(JSON.stringify(rows)); setTaken(true);
      toast(referenceT(counts.A ? "Attendance saved for {value0} · {value1} absent — guardians notified by SMS" : "Attendance saved for {value0} · {value1} absent", { value0: cls(classId)?.name ?? "", value1: counts.A }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(false); }
  };

  const c = cls(classId);
  return (
    <CardGrid className="grid gap-2.5 xl:grid-cols-12">
      <Card className="flex min-h-[560px] flex-col xl:col-span-9">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
          <ClassSelect value={classId} onChange={setClassId} classes={classes} />
          <DateInput value={date} max={isoDay(new Date())} onChange={(e) => setDate(e.target.value)} className="w-36" aria-label={referenceT("Date")} />
          <span className="text-[11px] text-muted">{fmtDate(date, { weekday: "long", day: "numeric", month: "long" })} · {c?.strength} <ReferenceText message="students · class teacher" /> {tch(c?.classTeacherId)?.name}</span>
          <div className="ml-auto flex items-center gap-1.5">
            {taken && !dirty && <span className="flex items-center gap-1 text-[11px] text-ok"><ShieldCheck className="size-3.5" /><ReferenceText message="Register saved" /></span>}
            <Button icon={CheckCheck} onClick={() => setAll("P")} disabled={weekend || future}><ReferenceText message="All present" /></Button>
            <Button icon={RotateCcw} variant="ghost" disabled={!dirty} onClick={() => setRows(JSON.parse(initial))}><ReferenceText message="Reset" /></Button>
            <Button variant="primary" icon={Save} loading={saving} disabled={!dirty || weekend || future} onClick={save}><ReferenceText message="Save register" /></Button>
          </div>
        </div>
        {error && <div className="p-2"><ErrorNote message={error} onRetry={load} /></div>}
        {weekend || future ? (
          <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted"><div><CalendarX className="mx-auto mb-2 size-6 text-faint" />{weekend ? referenceT("No school on weekends. Pick a weekday.") : referenceT("You can't take attendance for a future date.")}</div></div>
        ) : !rows ? <div className="grid grid-cols-2 gap-1.5 p-2 lg:grid-cols-3">{Array.from({ length: 24 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div> : (
          <div className="grid flex-1 content-start gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div key={r.studentId} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5", r.status === "A" ? "border-bad/40 bg-bad/5" : r.status === "L" ? "border-warn/40 bg-warn/5" : "border-line")}>
                <span className="w-5 text-right text-[11px] text-muted tabular">{r.rollNo}</span>
                <Avatar name={r.name} size={24} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{r.name}</span>
                <Segmented size="sm" label={referenceT("Attendance for {value0}", {value0: r.name})} value={r.status} onChange={(v) => setOne(r.studentId, v as St)}
                  options={(["P", "A", "L", "E"] as St[]).map((s) => ({ value: s, label: s, icon: r.status === s ? <span className={cn("size-1.5 rounded-full", TONES[s])} aria-hidden /> : undefined }))} />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3 border-t border-line px-3 py-1.5 text-[11px] text-muted">
          {(["P", "A", "L", "E"] as St[]).map((s) => <span key={s} className="flex items-center gap-1"><span className={cn("size-2.5 rounded-sm", TONES[s])} />{ATT_LABEL[s]} <b className="text-fg tabular">{counts[s]}</b></span>)}
          <span className="ml-auto"><ReferenceText message="Keyboard-friendly: Tab to a student, then use the arrow keys to choose P / A / L / E" /></span>
        </div>
      </Card>
      <CardGrid className="grid content-start gap-2.5 xl:col-span-3">
        <Card className="flex items-center gap-3 p-3">
          <Ring value={pct} size={64} stroke={7} label={referenceT("{value0}%", {value0: pct})} />
          <div className="text-xs"><p className="font-semibold"><ReferenceText message="Present on" /> {fmtShort(date)}</p><p className="text-muted">{rows ? rows.length - counts.A : "…"} <ReferenceText message="of" /> {rows?.length ?? "…"} <ReferenceText message="students" /></p><p className="text-muted">{counts.L} <ReferenceText message="late ·" /> {counts.E} <ReferenceText message="excused" /></p></div>
        </Card>
        <Card>
          <CardHeader title={referenceT("Last 20 school days")} sub={c?.name} />
          <div className="p-3">{trend.length ? <LineChart height={130} suffix="%" min={70} max={100} labels={trend.map((t) => fmtShort(t.date))} series={[{ name: "Present", values: trend.map((t) => t.pct), fill: true }]} /> : <Skeleton className="h-32" />}</div>
        </Card>
        <Card className="p-3 text-[11px] text-muted">
          <p className="mb-1 font-semibold text-fg"><ReferenceText message="Absence policy" /></p><ReferenceText message="Guardians of absent students receive an automatic SMS after the register is saved. Three unexplained absences in a month trigger a counsellor follow-up." /></Card>
      </CardGrid>
    </CardGrid>
  );
}

function MyAttendance() {
  const { fmtPct } = useFormat();
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { role } = useSession();
  const toast = useToast();
  const { studentId } = useActiveStudent();
  const [sum, setSum] = useState<StudentAttendanceMonth["summary"] | null>(null);
  const [leave, setLeave] = useState(false);
  const [sending, setSending] = useState(false);
  const [f, setF] = useState({ from: "", to: "", reason: "" });
  useEffect(() => {
    setSum(null);
    if (!studentId) return;
    let alive = true;
    api.get<StudentAttendanceMonth>(`/attendance?studentId=${encodeURIComponent(studentId)}`).then((j) => { if (alive) setSum(j.summary); }).catch(() => {});
    return () => { alive = false; };
  }, [api, studentId]);
  const requestLeave = async () => {
    setSending(true);
    try {
      await api.post("/leave-requests", { studentId, from: f.from, to: f.to || f.from, reason: f.reason.trim() });
      setLeave(false); toast("Leave request sent to the class teacher"); setF({ from: "", to: "", reason: "" });
    } catch (e) { toast((e as Error).message, "error"); } finally { setSending(false); }
  };
  const pct = sum?.total ? Math.round(((sum.total - sum.absent) / sum.total) * 1000) / 10 : 0;

  return (
    <CardGrid className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ChildSwitcher />
        <Button variant="primary" icon={FileText} className="ml-auto" onClick={() => setLeave(true)}>{role === "parent" ? referenceT("Report absence / request leave") : referenceT("Request leave")}</Button>
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Kpi icon={CalendarCheck} label={referenceT("Attendance (last 60 days)")} value={sum ? fmtPct(pct) : "…"} tone={pct >= 90 ? "ok" : "warn"} sub={pct >= 90 ? "Meets the 90% target" : "Below the 90% target"} />
        <Kpi icon={CheckCheck} label={referenceT("Present")} tone="ok" value={sum?.present ?? "…"} sub={referenceT("days")} />
        <Kpi icon={CalendarX} label={referenceT("Absent")} tone="bad" value={sum?.absent ?? "…"} sub={referenceT("days")} />
        <Kpi icon={Clock} label={referenceT("Late")} tone="warn" value={sum?.late ?? "…"} sub={referenceT("arrivals")} />
        <Kpi icon={ShieldCheck} label={referenceT("Excused")} tone="info" value={sum?.excused ?? "…"} sub={referenceT("approved leave")} />
      </div>
      <Card className="p-3"><AttendanceCalendar studentId={studentId} /></Card>
      <Modal open={leave} onClose={() => setLeave(false)} title={referenceT("Leave request")} sub={referenceT("Sent to the class teacher for approval")}
        footer={<><Button variant="ghost" onClick={() => setLeave(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={sending} disabled={!f.from || !f.reason.trim()} onClick={requestLeave}><ReferenceText message="Submit request" /></Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={referenceT("From")} required><DateInput value={f.from} onChange={(e) => setF((x) => ({ ...x, from: e.target.value }))} /></Field>
          <Field label={referenceT("To")}><DateInput value={f.to} min={f.from} onChange={(e) => setF((x) => ({ ...x, to: e.target.value }))} /></Field>
          <Field label={referenceT("Reason")} required className="col-span-2"><Textarea value={f.reason} onChange={(e) => setF((x) => ({ ...x, reason: e.target.value }))} placeholder={referenceT("e.g. Medical appointment")} /></Field>
        </div>
      </Modal>
    </CardGrid>
  );
}
