"use client";

import { Award, CalendarPlus, ClipboardList, Clock, DoorOpen, Printer, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "../lib/router";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, CardHeader, DataTable, DateInput, ErrorNote, Field, Input, Kpi, Modal, Select, Skeleton, statusTone, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TimeInput, type Column, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { qs, useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { Exam, Student } from "../lib/types";
import { cn, isoDay } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const daysUntil = (d: string) => Math.ceil((new Date(d + "T00:00:00").getTime() - new Date(isoDay(new Date()) + "T00:00:00").getTime()) / 864e5);
const endTime = (start: string, min: number) => { const [h, m] = start.split(":").map(Number); const t = h! * 60 + m! + min; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

export function ExamsPage() {
  const { role } = useSession();
  return role === "student" || role === "parent" ? <LearnerExams /> : <StaffExams />;
}

function StaffExams() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtTime } = useFormat();
  const { role, user } = useSession();
  const { meta, cls, sub, tch } = useLookups();
  const { classes } = useMyClasses();
  const [term, setTerm] = useState("UT2");
  const [classId, setClassId] = useState("");
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload, setData } = useApi<Exam[]>(`/exams${qs({ term, classId, sort: "date" })}`);
  const scope = new Set(classes.map((c) => c.id));
  const rows = (data ?? []).filter((e) => (role !== "teacher" || scope.has(e.classId) || e.invigilatorId === user.id) && (!mine || e.invigilatorId === user.id));
  const upcoming = rows.filter((e) => e.status === "Scheduled");
  const next = upcoming[0];

  const columns: Column<Exam>[] = [
    { key: "date", header: "Date", cell: (e) => <span><span className="block font-medium">{fmtDate(e.date, { weekday: "short", day: "2-digit", month: "short" })}</span><span className="text-[10.5px] text-muted tabular">{fmtTime(e.start)}–{fmtTime(endTime(e.start, e.durationMin))}</span></span> },
    { key: "classId", header: "Class", value: (e) => cls(e.classId)?.name, cell: (e) => cls(e.classId)?.name.replace("Grade ", "") },
    { key: "subjectId", header: "Subject", value: (e) => sub(e.subjectId)?.name, cell: (e) => <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: sub(e.subjectId)?.color }} />{sub(e.subjectId)?.name}</span> },
    { key: "name", header: "Exam" },
    { key: "durationMin", header: "Duration", cell: (e) => `${e.durationMin} min` },
    { key: "maxMarks", header: "Max", className: "tabular" },
    { key: "room", header: "Room" },
    { key: "invigilatorId", header: "Invigilator", value: (e) => tch(e.invigilatorId)?.name, cell: (e) => <span className={cn("flex items-center gap-1.5", e.invigilatorId === user.id && "font-semibold text-brand")}><Avatar name={tch(e.invigilatorId)?.name ?? "?"} size={20} />{tch(e.invigilatorId)?.name}{e.invigilatorId === user.id && referenceT(" (you)")}</span> },
    { key: "status", header: "Status", cell: (e) => <Badge tone={statusTone(e.status)}>{e.status}</Badge> },
  ];

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={ClipboardList} label={referenceT("Papers this term")} value={loading && !data ? "…" : rows.length} sub={meta.terms.find((t) => t.id === term)?.name} />
        <Kpi icon={Clock} label={referenceT("Next paper")} tone="info" value={next ? fmtDate(next.date, { day: "2-digit", month: "short" }) : "—"} sub={next ? `${sub(next.subjectId)?.name} · ${cls(next.classId)?.name.replace("Grade ", "")}` : "No upcoming papers"} />
        <Kpi icon={ShieldCheck} label={role === "teacher" ? "My invigilation duties" : "Invigilators assigned"} tone="warn" value={role === "teacher" ? rows.filter((e) => e.invigilatorId === user.id).length : new Set(rows.map((e) => e.invigilatorId)).size} />
        <Kpi icon={Award} label={referenceT("Completed papers")} tone="ok" value={rows.filter((e) => e.status === "Completed").length} sub={referenceT("marks in the mark list")} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <DataTable className="min-h-0 flex-1" rows={loading && !data ? null : rows} loading={loading} columns={columns} pageSize={15} exportName={`exams-${term}`} searchPlaceholder="Search subject, room, invigilator"
        toolbar={<>
          <Tabs value={term} onChange={setTerm} items={meta.terms.map((t) => ({ value: t.id, label: t.name }))} />
          <ClassSelect value={classId} onChange={setClassId} classes={classes} allLabel="All classes" />
          {role === "teacher" && <Button variant={mine ? "subtle" : "secondary"} icon={ShieldCheck} onClick={() => setMine((m) => !m)}><ReferenceText message="My duties" /></Button>}
          {role === "admin" && <Button variant="primary" icon={CalendarPlus} onClick={() => setCreating(true)}><ReferenceText message="Schedule paper" /></Button>}
          <Link href="/marks"><Button><ReferenceText message="Mark list" /></Button></Link>
        </>} />
      <ScheduleExam open={creating} onClose={() => setCreating(false)} existing={data ?? []} defaultTerm={term} onCreated={(e) => setData((d) => [...(d ?? []), e].sort((a, b) => a.date.localeCompare(b.date)))} />
    </div>
  );
}

function ScheduleExam({ open, onClose, existing, defaultTerm, onCreated }: { open: boolean; onClose: () => void; existing: Exam[]; defaultTerm: string; onCreated: (e: Exam) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { meta, classes, subjects, teachers, cls } = useLookups();
  const toast = useToast();
  const [f, setF] = useState({ term: defaultTerm, classId: "", subjectId: "", date: "", start: "09:00", durationMin: "60", room: "", invigilatorId: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const c = cls(f.classId);
  const t = meta.terms.find((x) => x.id === f.term);
  const clash = existing.find((e) => e.classId === f.classId && e.date === f.date);
  const weekend = f.date && [0, 6].includes(new Date(f.date + "T00:00:00").getDay());
  const valid = f.classId && f.subjectId && f.date && f.invigilatorId && !clash && !weekend;

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ data: Exam }>("/exams", { ...f, name: t?.name, durationMin: Number(f.durationMin), maxMarks: t?.max ?? 100, room: f.room || c?.room, status: "Scheduled" });
      onCreated(data); toast(referenceT("{value0} paper scheduled for {value1}", { value0: t?.name ?? "", value1: c?.name ?? "" })); onClose();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={referenceT("Schedule exam paper")} sub={referenceT("Students and parents see it on their date sheet immediately")}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!valid} loading={busy} onClick={save}><ReferenceText message="Schedule" /></Button></>}>
      <div className="grid grid-cols-4 gap-3">
        <Field label={referenceT("Exam")}><Select value={f.term} onChange={set("term")}>{meta.terms.map((x) => <option key={x.id} value={x.id}>{x.name} (/{x.max})</option>)}</Select></Field>
        <Field label={referenceT("Class")} required><Select value={f.classId} onChange={set("classId")}><option value=""><ReferenceText message="Select" /></option>{classes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label={referenceT("Subject")} required><Select value={f.subjectId} onChange={set("subjectId")}><option value=""><ReferenceText message="Select" /></option>{subjects.filter((s) => c && s.grades.includes(c.grade) && s.id !== "sub-lib").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={referenceT("Date")} required><DateInput value={f.date} min={isoDay(new Date())} onChange={set("date")} /></Field>
        <Field label={referenceT("Start")}><TimeInput value={f.start} onChange={set("start")} /></Field>
        <Field label={referenceT("Duration")}><Select value={f.durationMin} onChange={set("durationMin")}>{[45, 60, 90, 120, 180].map((d) => <option key={d} value={d}>{d} <ReferenceText message="min" /></option>)}</Select></Field>
        <Field label={referenceT("Room")} hint={c ? referenceT("Default: {value0}", { value0: c.room }) : undefined}><Input value={f.room} onChange={set("room")} placeholder={c?.room} /></Field>
        <Field label={referenceT("Invigilator")} required><Select value={f.invigilatorId} onChange={set("invigilatorId")}><option value=""><ReferenceText message="Select" /></option>{teachers.filter((x) => x.status === "Active").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
      </div>
      {(clash || weekend) && <p className="mt-3 flex items-center gap-1.5 rounded-md bg-bad/10 px-2.5 py-2 text-xs text-bad"><TriangleAlert className="size-4" />{weekend ? referenceT("Exams can't be scheduled on a weekend.") : referenceT("{value0} already has a paper on this date.", { value0: c?.name ?? "" })}</p>}
    </Modal>
  );
}

function LearnerExams() {
  const referenceT = useReferenceLocalization().t;
  const { profile: SCHOOL } = useLookups();
  const { fmtDate, fmtTime } = useFormat();
  const { sub, tch } = useLookups();
  const { studentId } = useActiveStudent();
  const { data: me } = useApi<Student>(studentId ? `/students/${encodeURIComponent(studentId)}` : null);
  const { data } = useApi<Exam[]>(me && me.id === studentId ? `/exams?classId=${me.classId}&sort=date` : null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const list = useMemo(() => (data ?? []).filter((e) => (tab === "upcoming" ? e.status !== "Completed" : e.status === "Completed")), [data, tab]);
  const next = (data ?? []).find((e) => e.status === "Scheduled");

  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <div className="flex flex-wrap items-center gap-2 lg:col-span-12">
        <ChildSwitcher />
        <Tabs value={tab} onChange={setTab} items={[{ value: "upcoming", label: "Date sheet" }, { value: "past", label: "Completed" }]} />
        <Button icon={Printer} className="ml-auto" onClick={() => window.print()}><ReferenceText message="Print admit card" /></Button>
      </div>
      <Card className="print-full lg:col-span-8">
        <CardHeader title={tab === "upcoming" ? "Upcoming papers" : "Completed papers"} sub={me ? `${me.name} · ${me.admissionNo} · ${SCHOOL.name}` : undefined} />
        {!data ? <Skeleton className="m-3 h-60" /> : (
          <Table className="w-full text-xs">
            <TableHeader className="bg-subtle text-[11px] text-muted"><TableRow><TableHead className="px-3 py-1.5 text-left"><ReferenceText message="Date" /></TableHead><TableHead className="text-left"><ReferenceText message="Subject" /></TableHead><TableHead className="text-left"><ReferenceText message="Time" /></TableHead><TableHead className="text-left"><ReferenceText message="Room" /></TableHead><TableHead className="text-left"><ReferenceText message="Max" /></TableHead><TableHead className="pr-3 text-right">{tab === "upcoming" ? referenceT("In") : referenceT("Status")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((e) => { const d = daysUntil(e.date); return (
                <TableRow key={e.id} className={cn("border-t border-line/60", e.id === next?.id && "bg-brand/[0.05]")}>
                  <TableCell className="px-3 py-1.5 font-medium">{fmtDate(e.date, { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                  <TableCell><span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: sub(e.subjectId)?.color }} />{sub(e.subjectId)?.name}</span></TableCell>
                  <TableCell className="tabular">{fmtTime(e.start)}–{fmtTime(endTime(e.start, e.durationMin))}</TableCell><TableCell>{e.room}</TableCell><TableCell className="tabular">{e.maxMarks}</TableCell>
                  <TableCell className="pr-3 text-right">{tab === "upcoming" ? <Badge tone={d <= 3 ? "bad" : d <= 7 ? "warn" : "info"}>{d === 0 ? referenceT("Today") : referenceT("{value0} days", { value0: d })}</Badge> : <Badge tone="ok"><ReferenceText message="Marked" /></Badge>}</TableCell>
                </TableRow>
              ); })}
            </TableBody>
          </Table>
        )}
      </Card>
      <CardGrid className="grid content-start gap-2.5 lg:col-span-4">
        {next && (
          <Card className="overflow-hidden">
            <div className="p-3" style={{ background: `${sub(next.subjectId)?.color}14` }}>
              <p className="text-[11px] text-muted"><ReferenceText message="Next paper" /></p>
              <p className="text-sm font-semibold">{sub(next.subjectId)?.name} · {next.name}</p>
              <p className="text-[11px] text-muted">{fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(next.start)}</p>
              <p className="mt-2 text-3xl font-semibold tabular" style={{ color: sub(next.subjectId)?.color }}>{daysUntil(next.date)}<span className="text-sm font-medium text-muted"> <ReferenceText message="days to go" /></span></p>
            </div>
            <div className="flex items-center gap-2 border-t border-line p-3 text-[11px]"><DoorOpen className="size-4 text-faint" /><ReferenceText message="Room" /> {next.room} <ReferenceText message="· invigilator" /> {tch(next.invigilatorId)?.name}</div>
          </Card>
        )}
        <Card className="p-3 text-[11px] text-muted">
          <p className="mb-1 font-semibold text-fg"><ReferenceText message="Exam-day checklist" /></p>
          <ul className="list-disc space-y-0.5 pl-4"><li><ReferenceText message="Arrive 15 minutes early with your admit card and ID." /></li><li><ReferenceText message="Only transparent pencil cases and approved calculators." /></li><li><ReferenceText message="Phones are handed to the invigilator before the paper." /></li></ul>
          <Link href="/marks"><Button size="xs" variant="subtle" icon={Award} className="mt-2"><ReferenceText message="View results" /></Button></Link>
        </Card>
      </CardGrid>
    </CardGrid>
  );
}
