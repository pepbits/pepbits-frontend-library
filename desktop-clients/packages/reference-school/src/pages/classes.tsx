"use client";

import { useFormat } from "../lib/format";
import { CalendarCheck, DoorOpen, Plus, Table2, Users } from "lucide-react";
import { Link } from "../lib/router";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, Drawer, Field, Input, Modal, Progress, Ring, Select, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, useToast } from "../ui";
import { useMyClasses } from "../components/shared/scope";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { ClassRoom, Student, TimetableSlot } from "../lib/types";
import { cn } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function ClassesPage() {
 const referenceT = useReferenceLocalization().t;

  const { role } = useSession();
  const { tch, ready } = useLookups();
  const { classes, homeClassId } = useMyClasses();
  const [open, setOpen] = useState<ClassRoom | null>(null);
  const [adding, setAdding] = useState(false);
  const [grade, setGrade] = useState("all");
  const grades = [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b);
  const shown = classes.filter((c) => grade === "all" || String(c.grade) === grade);
  const totals = { students: classes.reduce((a, c) => a + c.strength, 0), seats: classes.reduce((a, c) => a + c.capacity, 0) };

  return (
    <CardGrid className="grid gap-2.5">
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <Tabs value={grade} onChange={setGrade} items={[{ value: "all", label: "All grades", count: classes.length }, ...grades.map((g) => ({ value: String(g), label: `Grade ${g}` }))]} />
        <span className="text-[11px] text-muted"><b className="text-fg tabular">{totals.students}</b> <ReferenceText message="students in" /> <b className="text-fg tabular">{totals.seats}</b> <ReferenceText message="seats ·" /> {Math.round((totals.students / (totals.seats || 1)) * 100)}<ReferenceText message="% occupancy" /></span>
        {role === "admin" && <Button variant="primary" icon={Plus} className="ml-auto" onClick={() => setAdding(true)}><ReferenceText message="Add class" /></Button>}
      </Card>
      <CardGrid className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        {!ready && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        {shown.map((c) => {
          const ct = tch(c.classTeacherId);
          return (
            <Card key={c.id} className={cn("cursor-pointer p-2.5 transition hover:border-brand/40 hover:shadow-sm", c.id === homeClassId && role === "teacher" && "ring-1 ring-brand/40")} role="button" tabIndex={0} aria-label={referenceT("Open {value0}", {value0: c.name})} onClick={() => setOpen(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(c); } }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">{c.name}{c.id === homeClassId && role === "teacher" && <Badge tone="brand"><ReferenceText message="Home class" /></Badge>}</p>
                  <p className="text-[11px] text-muted">{c.stream} <ReferenceText message="· Room" /> {c.room}</p>
                </div>
                <Ring value={c.avgScore} size={40} stroke={4} label={referenceT("{value0}", {value0: c.avgScore})} />
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                <Users className="size-3.5 text-faint" />
                <Progress value={c.strength} max={c.capacity} tone={c.strength >= c.capacity ? "warn" : "brand"} className="flex-1" />
                <span className="tabular">{c.strength}/{c.capacity}</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-2 text-[11px]">
                {ct && <Avatar name={ct.name} size={20} />}<span className="truncate">{ct?.name ?? referenceT("No class teacher")}</span><span className="ml-auto text-faint"><ReferenceText message="Class teacher" /></span>
              </div>
            </Card>
          );
        })}
      </CardGrid>
      {open && <ClassDrawer c={open} onClose={() => setOpen(null)} />}
      <AddClass open={adding} onClose={() => setAdding(false)} />
    </CardGrid>
  );
}

function ClassDrawer({ c, onClose }: { c: ClassRoom; onClose: () => void }) {
  const { fmtPct } = useFormat();
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { role } = useSession();
  const { sub, tch, teachers, reload } = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<"roster" | "subjects">("roster");
  const { data: roster } = useApi<Student[]>(`/students?classId=${encodeURIComponent(c.id)}&sort=rollNo`);
  const { data: slots } = useApi<TimetableSlot[]>(`/timetable?classId=${encodeURIComponent(c.id)}`);
  const mapping = useMemo(() => {
    const m = new Map<string, { teacherId: string | null; periods: number }>();
    (slots ?? []).forEach((s) => { const x = m.get(s.subjectId) ?? { teacherId: s.teacherId, periods: 0 }; x.periods++; m.set(s.subjectId, x); });
    return [...m.entries()].sort((a, b) => b[1].periods - a[1].periods);
  }, [slots]);
  const sorted = [...(roster ?? [])].sort((a, b) => a.rollNo - b.rollNo);

  const setClassTeacher = async (id: string) => {
    try { await api.patch(`/classes/${c.id}`, { classTeacherId: id }); reload(); toast(referenceT("{value0} is now class teacher of {value1}", { value0: tch(id)?.name ?? "", value1: c.name })); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <Drawer open onClose={onClose} width="max-w-2xl" title={c.name} sub={referenceT("{value0} · Room {value1} · {value2}/{value3} students · class average {value4}%", {value0: c.stream, value1: c.room, value2: c.strength, value3: c.capacity, value4: c.avgScore})}
      footer={<>
        <Link href="/attendance"><Button icon={CalendarCheck}><ReferenceText message="Attendance" /></Button></Link>
        <Link href="/marks"><Button icon={Table2}><ReferenceText message="Mark list" /></Button></Link>
        <Link href="/timetable"><Button variant="primary" icon={DoorOpen}><ReferenceText message="Timetable" /></Button></Link>
      </>}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <Tabs value={tab} onChange={setTab} items={[{ value: "roster", label: "Roster", count: roster?.length }, { value: "subjects", label: "Subjects & teachers", count: mapping.length }]} />
        {role === "admin" && (
          <Select className="ml-auto w-48" value={c.classTeacherId} onChange={(e) => setClassTeacher(e.target.value)} aria-label={referenceT("Class teacher")}>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        )}
      </div>
      {tab === "roster" ? (
        !roster ? <div className="p-4"><Skeleton className="h-60" /></div> : (
          <Table className="w-full text-xs">
            <TableHeader className="sticky top-0 bg-subtle text-[11px] text-muted"><TableRow><TableHead className="px-3 py-1.5 text-left"><ReferenceText message="Roll" /></TableHead><TableHead className="text-left"><ReferenceText message="Student" /></TableHead><TableHead className="text-left"><ReferenceText message="Gender" /></TableHead><TableHead className="text-left"><ReferenceText message="Attendance" /></TableHead><TableHead className="text-left"><ReferenceText message="GPA" /></TableHead><TableHead className="pr-3 text-left"><ReferenceText message="House" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id} className="border-t border-line/60">
                  <TableCell className="px-3 py-1 tabular">{s.rollNo}</TableCell>
                  <TableCell><span className="flex items-center gap-1.5"><Avatar name={s.name} size={20} />{s.name}</span></TableCell>
                  <TableCell>{s.gender}</TableCell>
                  <TableCell className={cn("tabular", s.attendancePct < 85 && "text-bad")}>{fmtPct(s.attendancePct)}</TableCell>
                  <TableCell className="tabular">{s.gpa}</TableCell><TableCell className="pr-3">{s.house}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : (
        <ul className="divide-y divide-line/70">
          {mapping.map(([sid, m]) => { const s = sub(sid); const t = tch(m.teacherId); return (
            <li key={sid} className="flex items-center gap-2.5 px-4 py-1.5 text-xs">
              <span className="h-6 w-1 rounded-full" style={{ background: s?.color }} />
              <span className="w-40 font-medium">{s?.name}</span>
              <span className="text-muted tabular">{m.periods} <ReferenceText message="periods/wk" /></span>
              <span className="ml-auto flex items-center gap-1.5">{t ? <><Avatar name={t.name} size={20} />{t.name}</> : <span className="text-faint"><ReferenceText message="Self study" /></span>}</span>
            </li>
          ); })}
        </ul>
      )}
    </Drawer>
  );
}

function AddClass({ open, onClose }: { open: boolean; onClose: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { teachers, classes, reload } = useLookups();
  const toast = useToast();
  const [f, setF] = useState({ grade: "", section: "", room: "", capacity: "30", stream: "General", classTeacherId: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr(""); };
  const save = async () => {
    if (!f.grade || !f.section.trim() || !f.room.trim() || !f.classTeacherId) return setErr("Grade, section, room and class teacher are required.");
    const section = f.section.trim().toUpperCase();
    if (classes.some((c) => c.grade === Number(f.grade) && c.section === section)) return setErr(`Grade ${f.grade}-${section} already exists.`);
    setBusy(true);
    try {
      await api.post("/classes", { grade: Number(f.grade), section, name: `Grade ${f.grade}-${section}`, room: f.room, capacity: Number(f.capacity), stream: f.stream, classTeacherId: f.classTeacherId }); // strength and average are server-initialized
      reload(); toast(referenceT("Grade {value0}-{value1} created", { value0: f.grade, value1: section })); onClose();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Add class section")} footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Create class" /></Button></>}>
      <div className="grid grid-cols-3 gap-3">
        <Field label={referenceT("Grade")} required><Select value={f.grade} onChange={set("grade")}><option value="">—</option>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label={referenceT("Section")} required><Input value={f.section} onChange={set("section")} maxLength={2} placeholder={referenceT("C")} /></Field>
        <Field label={referenceT("Room")} required><Input value={f.room} onChange={set("room")} placeholder={referenceT("B-204")} /></Field>
        <Field label={referenceT("Capacity")}><Input type="number" value={f.capacity} onChange={set("capacity")} /></Field>
        <Field label={referenceT("Stream")}><Select value={f.stream} onChange={set("stream")}>{["General", "Science", "Commerce", "Humanities"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label={referenceT("Class teacher")} required><Select value={f.classTeacherId} onChange={set("classTeacherId")}><option value=""><ReferenceText message="Select" /></option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
      </div>
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
    </Modal>
  );
}
