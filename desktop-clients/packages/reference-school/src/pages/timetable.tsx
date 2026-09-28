"use client";

import { Coffee, Printer, TriangleAlert, Video } from "lucide-react";
import { Link } from "../lib/router";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardGrid, ErrorNote, Field, Input, Modal, Select, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, Tabs, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { Student, TimetableSlot } from "../lib/types";
import { useFormat } from "../lib/format";
import { cn } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h! * 60 + m!; };

export function TimetablePage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtTime } = useFormat();
  const { role, user } = useSession();
  const { meta, sub, tch, cls, teachers, ready } = useLookups();
  const { classes, homeClassId } = useMyClasses();
  const { studentId } = useActiveStudent();
  const learner = role === "student" || role === "parent";
  const { data: me } = useApi<Student>(learner && studentId ? `/students/${encodeURIComponent(studentId)}` : null);

  const [view, setView] = useState<"class" | "teacher">(role === "teacher" ? "teacher" : "class");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState(role === "teacher" ? user.id : "");
  const [edit, setEdit] = useState<TimetableSlot | null>(null);
  const [now, setNow] = useState<{ day: number; min: number } | null>(null);

  useEffect(() => { if (!classId && homeClassId) setClassId(homeClassId); }, [homeClassId, classId]);
  useEffect(() => { if (!teacherId && teachers[0]) setTeacherId(teachers[0].id); }, [teachers, teacherId]);
  useEffect(() => {
    const tick = () => { const d = new Date(); setNow({ day: (d.getDay() + 6) % 7, min: d.getHours() * 60 + d.getMinutes() }); };
    tick(); const t = setInterval(tick, 60000); return () => clearInterval(t);
  }, []);

  const effectiveClass = learner ? me?.classId : classId;
  const path = view === "teacher" && !learner ? (teacherId ? `/timetable?teacherId=${encodeURIComponent(teacherId)}` : null) : effectiveClass ? `/timetable?classId=${encodeURIComponent(effectiveClass)}` : null;
  const { data: slots, error, reload, setData } = useApi<TimetableSlot[]>(path);
  const { data: allSlots } = useApi<TimetableSlot[]>(role === "admin" ? "/timetable" : null);

  const byKey = useMemo(() => new Map((slots ?? []).map((s) => [`${s.day}-${s.period}`, s])), [slots]);
  const load = useMemo(() => {
    const m = new Map<string, number>();
    (slots ?? []).forEach((s) => m.set(s.subjectId, (m.get(s.subjectId) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [slots]);

  const title = view === "teacher" && !learner ? tch(teacherId)?.name : cls(effectiveClass)?.name;
  const canEdit = role === "admin";

  return (
    <CardGrid className="grid gap-2.5 xl:grid-cols-12">
      <Card className="print-full xl:col-span-10">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-line p-2">
          {learner ? <ChildSwitcher /> : (
            <>
              <Tabs value={view} onChange={setView} items={[{ value: "class", label: "By class" }, { value: "teacher", label: role === "teacher" ? "My timetable" : "By teacher" }]} />
              {view === "class" ? <ClassSelect value={classId} onChange={setClassId} classes={classes} /> : role === "admin" && (
                <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-48" aria-label={referenceT("Teacher")}>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
              )}
            </>
          )}
          <span className="text-xs font-semibold">{title}</span>
          <span className="text-[11px] text-muted">{slots?.filter((s) => s.teacherId || view === "class").length ?? 0} <ReferenceText message="periods / week" />{canEdit && referenceT(" · click a period to edit")}</span>
          <Button icon={Printer} className="ml-auto" onClick={() => window.print()}><ReferenceText message="Print" /></Button>
        </div>
        {error && <div className="p-2"><ErrorNote message={error} onRetry={reload} /></div>}
        {!slots || !ready ? <Skeleton className="m-2 h-[460px]" /> : (
          <TableContainer className="overflow-x-auto">
            <Table className="w-full min-w-[720px] table-fixed border-collapse text-[11.5px]">
              <TableHeader>
                <TableRow className="bg-subtle text-[11px] text-muted">
                  <TableHead className="w-24 border-b border-line px-2 py-1.5 text-left font-semibold"><ReferenceText message="Period" /></TableHead>
                  {meta.days.map((d, i) => <TableHead key={d} className={cn("border-b border-l border-line px-2 py-1.5 text-left font-semibold", now?.day === i && "bg-brand/10 text-brand")}>{d}{now?.day === i && referenceT(" · Today")}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.periods.map((p) => {
                  const current = now !== null && now.min >= toMin(p.start) && now.min < toMin(p.end);
                  if (p.isBreak) return (
                    <TableRow key={p.no} className="bg-subtle/60 text-[10.5px] text-muted">
                      <TableCell className="border-b border-line px-2 py-0.5"><span className={cn(current && "font-semibold text-brand")}><ReferenceText message={p.label} /></span> <span className="tabular">{fmtTime(p.start)}</span></TableCell>
                      <TableCell colSpan={meta.days.length} className="border-b border-l border-line px-2 py-0.5 text-center"><Coffee className="mr-1 inline size-3" /><ReferenceText message={p.label} /> · {fmtTime(p.start)}–{fmtTime(p.end)}</TableCell>
                    </TableRow>
                  );
                  return (
                    <TableRow key={p.no}>
                      <TableCell className={cn("border-b border-line px-2 py-1", current && "bg-brand/5")}>
                        <p className={cn("font-semibold", current && "text-brand")}><ReferenceText message={p.label} /></p>
                        <p className="text-[10px] text-muted tabular">{fmtTime(p.start)}–{fmtTime(p.end)}</p>
                      </TableCell>
                      {meta.days.map((_, di) => {
                        const s = byKey.get(`${di}-${p.no}`);
                        const sb = sub(s?.subjectId);
                        const live = current && now?.day === di;
                        return (
                          <TableCell key={di} className={cn("h-[52px] border-b border-l border-line p-0.5", now?.day === di && "bg-brand/[0.03]")}>
                            {s ? (
                              <button type="button" disabled={!canEdit} onClick={() => setEdit(s)}
                                className={cn("flex h-full w-full flex-col justify-center rounded-md border-l-[3px] px-1.5 text-left transition", canEdit && "hover:brightness-95", live && "ring-2 ring-brand")}
                                style={{ borderColor: sb?.color, background: `${sb?.color}14` }}>
                                <span className="flex items-center gap-1 truncate font-semibold" style={{ color: sb?.color }}>{sb?.name}{live && <span className="ml-auto rounded bg-brand px-1 text-[9px] text-brand-fg"><ReferenceText message="NOW" /></span>}</span>
                                <span className="truncate text-[10.5px] text-muted">
                                  {view === "teacher" && !learner ? cls(s.classId)?.name.replace("Grade ", "") : tch(s.teacherId)?.name ?? referenceT("Self study")} · {s.room}
                                </span>
                              </button>
                            ) : <div className="grid h-full place-items-center text-[10px] text-faint"><ReferenceText message="Free" /></div>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
      <CardGrid className="no-print grid content-start gap-2.5 xl:col-span-2">
        <Card>
          <p className="border-b border-line px-3 py-2 text-xs font-semibold"><ReferenceText message="Weekly load" /></p>
          <ul className="divide-y divide-line/60">
            {load.map(([id, n]) => (
              <li key={id} className="flex items-center gap-2 px-3 py-1 text-[11.5px]">
                <span className="size-2 rounded-full" style={{ background: sub(id)?.color }} /><span className="flex-1 truncate">{sub(id)?.name}</span><span className="text-muted tabular">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-3 text-[11px] text-muted">
          <p className="mb-2"><ReferenceText message="Online lessons use the same bell schedule. Join from the live classes page when your teacher starts the session." /></p>
          <Link href="/live"><Button size="xs" variant="subtle" icon={Video}><ReferenceText message="Live classes" /></Button></Link>
        </Card>
      </CardGrid>
      {edit && <EditSlot slot={edit} all={allSlots ?? []} onClose={() => setEdit(null)} onSaved={(s) => setData((d) => d?.map((x) => (x.id === s.id ? s : x)) ?? d)} />}
    </CardGrid>
  );
}

function EditSlot({ slot, all, onClose, onSaved }: { slot: TimetableSlot; all: TimetableSlot[]; onClose: () => void; onSaved: (s: TimetableSlot) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { fmtTime } = useFormat();
  const { subjects, teachers, cls, meta } = useLookups();
  const toast = useToast();
  const [f, setF] = useState({ subjectId: slot.subjectId, teacherId: slot.teacherId ?? "", room: slot.room });
  const [busy, setBusy] = useState(false);
  const c = cls(slot.classId);
  const eligible = teachers.filter((t) => t.subjectIds.includes(f.subjectId));
  const clash = f.teacherId ? all.find((s) => s.teacherId === f.teacherId && s.day === slot.day && s.period === slot.period && s.id !== slot.id) : undefined;
  const p = meta.periods.find((x) => x.no === slot.period);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch<{ data: TimetableSlot }>(`/timetable/${slot.id}`, { ...f, teacherId: f.teacherId || null });
      onSaved(data); toast("Timetable updated"); onClose();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={referenceT("Edit {value0} · {value1} {value2}", {value0: c?.name ?? "", value1: meta.days[slot.day] ?? "", value2: p ? referenceT(p.label) : ""})} sub={p ? `${fmtTime(p.start)}–${fmtTime(p.end)}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={!!clash} onClick={save}><ReferenceText message="Save period" /></Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("Subject")}><Select value={f.subjectId} onChange={(e) => setF((x) => ({ ...x, subjectId: e.target.value, teacherId: "" }))}>{subjects.filter((s) => c && s.grades.includes(c.grade)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={referenceT("Teacher")} hint={referenceT("{value0} qualified", {value0: eligible.length})}><Select value={f.teacherId} onChange={(e) => setF((x) => ({ ...x, teacherId: e.target.value }))}><option value=""><ReferenceText message="No teacher (self study)" /></option>{eligible.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label={referenceT("Room")} className="col-span-2"><Input value={f.room} onChange={(e) => setF((x) => ({ ...x, room: e.target.value }))} /></Field>
      </div>
      {clash && <p className="mt-3 flex items-center gap-1.5 rounded-md bg-bad/10 px-2.5 py-2 text-xs text-bad"><TriangleAlert className="size-4" /><ReferenceText message="Clash: this teacher already teaches" /> {cls(clash.classId)?.name} <ReferenceText message="in this period." /></p>}
    </Modal>
  );
}
