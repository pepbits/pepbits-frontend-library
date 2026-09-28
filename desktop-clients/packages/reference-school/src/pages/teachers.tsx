"use client";

import { Briefcase, CalendarOff, Mail, Phone, Star, UserPlus, Users } from "lucide-react";
import { Link } from "../lib/router";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, DataTable, Drawer, ErrorNote, Kpi, Progress, Select, Skeleton, statusTone, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, type Column, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import type { Teacher, TimetableSlot } from "../lib/types";
import { cn } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function TeachersPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtFixed, fmtNum } = useFormat();
  const { sub, classes } = useLookups();
  const { data, error, loading, reload, setData } = useApi<Teacher[]>("/teachers");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState<Teacher | null>(null);
  const all = data ?? [];
  const depts = [...new Set(all.map((t) => t.department))].sort();
  const rows = useMemo(() => all.filter((t) => (!dept || t.department === dept) && (!status || t.status === status) && (!type || t.employmentType === type)), [all, dept, status, type]);

  const columns: Column<Teacher>[] = [
    { key: "name", header: "Teacher", cell: (t) => <span className="flex items-center gap-2"><Avatar name={t.name} size={24} /><span><span className="block font-medium">{t.name}</span><span className="block text-[10.5px] text-muted">{t.empId}</span></span></span> },
    { key: "department", header: "Department" },
    { key: "subjectIds", header: "Subjects", value: (t) => t.subjectIds.map((s) => sub(s)?.name).join(", "), cell: (t) => (
      <span className="flex gap-1">{t.subjectIds.map((s) => <span key={s} className="rounded px-1.5 py-0.5 text-[10.5px] font-medium" style={{ background: `${sub(s)?.color}1a`, color: sub(s)?.color }}>{sub(s)?.code}</span>)}</span>
    ) },
    { key: "designation", header: "Designation" },
    { key: "homeClass", header: "Class teacher", value: (t) => classes.find((c) => c.classTeacherId === t.id)?.name ?? "", cell: (t) => classes.find((c) => c.classTeacherId === t.id)?.name.replace("Grade ", "") ?? <span className="text-faint">—</span> },
    { key: "employmentType", header: "Type" },
    { key: "experience", header: "Exp.", cell: (t) => `${t.experience} yrs`, className: "tabular" },
    { key: "weeklyPeriods", header: "Load / week", cell: (t) => <span className="flex w-24 items-center gap-1.5"><Progress value={t.weeklyPeriods} max={32} tone={t.weeklyPeriods > 28 ? "warn" : "brand"} /><span className="w-5 text-[11px] tabular">{t.weeklyPeriods}</span></span> },
    { key: "rating", header: "Rating", cell: (t) => <span className="inline-flex items-center gap-1 tabular"><Star className="size-3 fill-warn text-warn" />{t.rating || referenceT("New")}</span> },
    { key: "status", header: "Status", cell: (t) => <Badge tone={statusTone(t.status)} dot>{t.status}</Badge> },
  ];

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Users} label={referenceT("Teaching staff")} value={loading && !data ? "…" : all.length} sub={referenceT("{value0} departments", {value0: depts.length})} />
        <Kpi icon={Briefcase} label={referenceT("Average teaching load")} tone="info" value={all.length ? referenceT("{value0} periods", { value0: fmtNum(Math.round(all.reduce((a, t) => a + t.weeklyPeriods, 0) / all.length)) }) : "…"} sub={referenceT("per week")} />
        <Kpi icon={CalendarOff} label={referenceT("On leave")} tone="warn" value={all.filter((t) => t.status === "On leave").length} sub={referenceT("cover arranged")} />
        <Kpi icon={Star} label={referenceT("Average rating")} tone="ok" value={all.length ? fmtFixed(all.reduce((a, t) => a + t.rating, 0) / all.length, 1) : "…"} sub={referenceT("student & peer feedback")} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <DataTable className="min-h-0 flex-1" rows={loading && !data ? null : rows} loading={loading} columns={columns} pageSize={15} onRowClick={setOpen} selectedId={open?.id}
        exportName="teachers" searchPlaceholder="Search name, employee id, subject"
        toolbar={<>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-36" aria-label={referenceT("Department")}><option value=""><ReferenceText message="All departments" /></option>{depts.map((d) => <option key={d}>{d}</option>)}</Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-28" aria-label={referenceT("Employment type")}><option value=""><ReferenceText message="Any type" /></option>{["Full-time", "Part-time", "Visiting"].map((d) => <option key={d}>{d}</option>)}</Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-28" aria-label={referenceT("Status")}><option value=""><ReferenceText message="Any status" /></option>{["Active", "On leave", "Inactive"].map((d) => <option key={d}>{d}</option>)}</Select>
          <Link href="/teachers/new"><Button variant="primary" icon={UserPlus}><ReferenceText message="Register teacher" /></Button></Link>
        </>} />
      {open && <TeacherDrawer t={open} onClose={() => setOpen(null)} onChange={(t) => { setOpen(t); setData((d) => d?.map((x) => (x.id === t.id ? t : x)) ?? d); }} />}
    </div>
  );
}

function TeacherDrawer({ t, onClose, onChange }: { t: Teacher; onClose: () => void; onChange: (t: Teacher) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const api = useSchoolApi();
  const { sub, cls, meta, classes } = useLookups();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data: slots } = useApi<TimetableSlot[]>(`/timetable?teacherId=${encodeURIComponent(t.id)}`);
  const home = classes.find((c) => c.classTeacherId === t.id);
  const teaching = [...new Set((slots ?? []).map((s) => s.classId))].map((id) => cls(id)?.name.replace("Grade ", "")).join(", ");
  const periods = meta.periods.filter((p) => !p.isBreak);

  const setStatus = async (status: Teacher["status"]) => {
    setBusy(true);
    try { const { data } = await api.patch<{ data: Teacher }>(`/teachers/${t.id}`, { status }); onChange(data); toast(referenceT(status === "On leave" ? "{value0} is now on leave" : status === "Inactive" ? "{value0} is now inactive" : "{value0} is now active", { value0: t.name })); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };

  return (
    <Drawer open onClose={onClose} width="max-w-2xl" title={t.name} titleAddon={<Badge tone={statusTone(t.status)} dot>{t.status}</Badge>} sub={referenceT("{value0} · {value1} · {value2}", {value0: t.designation, value1: t.department, value2: t.empId})}
      footer={<>
        <a href={`mailto:${t.email}`}><Button icon={Mail}><ReferenceText message="Email" /></Button></a>
        {t.status === "On leave" ? <Button variant="primary" loading={busy} onClick={() => setStatus("Active")}><ReferenceText message="Mark returned" /></Button> : <Button loading={busy} icon={CalendarOff} onClick={() => setStatus("On leave")}><ReferenceText message="Mark on leave" /></Button>}
      </>}>
      <div className="grid gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={t.name} size={44} />
          <dl className="grid flex-1 grid-cols-4 gap-2 text-center text-xs">
            <div><dd className="text-base font-semibold tabular">{t.experience}</dd><dt className="text-[10px] text-muted"><ReferenceText message="Years exp." /></dt></div>
            <div><dd className="text-base font-semibold tabular">{t.weeklyPeriods}</dd><dt className="text-[10px] text-muted"><ReferenceText message="Periods/wk" /></dt></div>
            <div><dd className="text-base font-semibold tabular">{t.rating || "—"}</dd><dt className="text-[10px] text-muted"><ReferenceText message="Rating" /></dt></div>
            <div><dd className="text-base font-semibold">{home?.name.replace("Grade ", "") ?? "—"}</dd><dt className="text-[10px] text-muted"><ReferenceText message="Home class" /></dt></div>
          </dl>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {[["Email", t.email], ["Phone", t.phone], ["Qualification", t.qualification], ["Employment", t.employmentType], ["Joined", fmtDate(t.joinedOn)], ["Gender", t.gender],
            ["Subjects", t.subjectIds.map((s) => sub(s)?.name).join(", ")], ["Teaches", teaching || "—"]].map(([k, v]) => (
            <div key={k} className="min-w-0 border-b border-line/60 pb-1.5"><dt className="text-[10.5px] text-muted">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
          ))}
        </dl>
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-muted"><ReferenceText message="Weekly timetable" /></p>
          {!slots ? <Skeleton className="h-40" /> : (
            <TableContainer className="overflow-x-auto rounded-md border border-line">
              <Table className="w-full text-[10.5px]">
                <TableHeader className="bg-subtle text-muted"><TableRow><TableHead className="px-1.5 py-1 text-left"><ReferenceText message="Day" /></TableHead>{periods.map((p) => <TableHead key={p.no} className="px-1 py-1"><ReferenceText message={p.label} /></TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {meta.days.map((d, di) => (
                    <TableRow key={d} className="border-t border-line/60">
                      <TableCell className="px-1.5 py-1 font-medium">{d.slice(0, 3)}</TableCell>
                      {periods.map((p) => {
                        const s = slots.find((x) => x.day === di && x.period === p.no);
                        const sb = sub(s?.subjectId);
                        return <TableCell key={p.no} className="p-0.5"><div className={cn("rounded px-1 py-1 text-center", !s && "text-faint")} style={s ? { background: `${sb?.color}1f`, color: sb?.color } : undefined}>{s ? cls(s.classId)?.name.replace("Grade ", "") : "·"}</div></TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
        <a href={`tel:${t.phone}`} className="text-xs text-brand"><Phone className="mr-1 inline size-3" />{t.phone}</a>
      </div>
    </Drawer>
  );
}
