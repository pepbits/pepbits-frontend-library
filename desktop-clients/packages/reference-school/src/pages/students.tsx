"use client";

import { GraduationCap, Mail, MessageSquare, Phone, UserPlus, UserX, Users } from "lucide-react";
import { Link } from "../lib/router";
import { useEffect, useMemo, useState } from "react";
import {
  Avatar, Badge, Button, DataTable, Drawer, ErrorNote, Kpi, Progress, Select, Skeleton, statusTone, Tabs, useToast, type Column,
} from "../ui";
import { AttendanceCalendar } from "../components/shared/attendance-calendar";
import { ReportCardTable, useReportCard } from "../components/shared/report-card";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { FeeInvoice, Student } from "../lib/types";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function StudentsPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtFixed, fmtPct } = useFormat();
  const { role } = useSession();
  const { cls } = useLookups();
  const { classes } = useMyClasses();
  const { data, error, loading, reload, setData } = useApi<Student[]>("/students");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("Active");
  const [fee, setFee] = useState("");
  const [gender, setGender] = useState("");
  const [open, setOpen] = useState<Student | null>(null);
  const finance = role === "admin" || role === "accountant";

  const scopeIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);
  const rows = useMemo(() => (data ?? []).filter((s) =>
    (role !== "teacher" || scopeIds.has(s.classId)) && (!classId || s.classId === classId) && (!status || s.status === status) && (!fee || s.feeStatus === fee) && (!gender || s.gender === gender),
  ), [data, role, scopeIds, classId, status, fee, gender]);

  const columns: Column<Student>[] = [
    { key: "name", header: "Student", cell: (s) => (
      <span className="flex items-center gap-2"><Avatar name={s.name} size={24} /><span><span className="block font-medium">{s.name}</span><span className="block text-[10.5px] text-muted">{s.admissionNo}</span></span></span>
    ) },
    { key: "classId", header: "Class", value: (s) => cls(s.classId)?.name ?? s.classId, cell: (s) => cls(s.classId)?.name.replace("Grade ", "") },
    { key: "rollNo", header: "Roll", className: "tabular" },
    { key: "gender", header: "Gender" },
    { key: "guardianName", header: "Guardian", cell: (s) => <span><span className="block">{s.guardianName}</span><span className="block text-[10.5px] text-muted">{s.guardianRelation} · {s.guardianPhone}</span></span> },
    { key: "house", header: "House" },
    { key: "attendancePct", header: "Attendance", cell: (s) => <span className="flex w-24 items-center gap-1.5"><Progress value={s.attendancePct} /><span className="w-9 text-right text-[11px] tabular">{fmtPct(s.attendancePct)}</span></span> },
    { key: "gpa", header: "GPA", className: "tabular font-medium" },
    ...(finance || role === "teacher" ? [{ key: "feeStatus", header: "Fees", cell: (s: Student) => <Badge tone={statusTone(s.feeStatus)}>{s.feeStatus}</Badge> }] : []),
    { key: "status", header: "Status", cell: (s) => <Badge tone={statusTone(s.status)} dot>{s.status}</Badge> },
  ];

  const all = data ?? [];
  const scoped = role === "teacher" ? all.filter((s) => scopeIds.has(s.classId)) : all;

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Users} label={role === "teacher" ? "Students I teach" : "Enrolled students"} value={loading && !data ? "…" : scoped.filter((s) => s.status === "Active").length} sub={referenceT("{value0} classes", {value0: classes.length})} />
        <Kpi icon={GraduationCap} label={referenceT("Average GPA")} tone="info" value={scoped.length ? fmtFixed(scoped.reduce((a, s) => a + s.gpa, 0) / scoped.length, 2) : "…"} sub={referenceT("Quarterly exam")} />
        <Kpi icon={UserX} label={referenceT("Below 85% attendance")} tone="warn" value={scoped.filter((s) => s.attendancePct < 85).length} sub={referenceT("flagged for follow-up")} />
        <Kpi icon={Users} label={referenceT("Fees overdue")} tone="bad" value={scoped.filter((s) => s.feeStatus === "Overdue").length} sub={referenceT("accounts")} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <DataTable
        className="min-h-0 flex-1" rows={loading && !data ? null : rows} loading={loading} columns={columns} pageSize={15}
        onRowClick={setOpen} selectedId={open?.id} exportName="students" searchPlaceholder="Search name, admission no, guardian"
        toolbar={
          <>
            <ClassSelect value={classId} onChange={setClassId} classes={classes} allLabel={role === "teacher" ? "All my classes" : "All classes"} />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-28" aria-label={referenceT("Status")}>
              <option value=""><ReferenceText message="Any status" /></option>{["Active", "Inactive", "Alumni"].map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Select value={gender} onChange={(e) => setGender(e.target.value)} className="w-28" aria-label={referenceT("Gender")}>
              <option value=""><ReferenceText message="Any gender" /></option><option><ReferenceText message="Female" /></option><option><ReferenceText message="Male" /></option>
            </Select>
            {finance && (
              <Select value={fee} onChange={(e) => setFee(e.target.value)} className="w-28" aria-label={referenceT("Fee status")}>
                <option value=""><ReferenceText message="Any fees" /></option>{["Paid", "Partial", "Due", "Overdue"].map((s) => <option key={s}>{s}</option>)}
              </Select>
            )}
            {role === "admin" && <Link href="/students/new"><Button variant="primary" icon={UserPlus}><ReferenceText message="Register student" /></Button></Link>}
          </>
        }
      />
      <StudentDrawer student={open} onClose={() => setOpen(null)} onChange={(s) => { setOpen(s); setData((d) => d?.map((x) => (x.id === s.id ? s : x)) ?? d); }} />
    </div>
  );
}

function StudentDrawer({ student, onClose, onChange }: { student: Student | null; onClose: () => void; onChange: (s: Student) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate } = useFormat();
  const api = useSchoolApi();
  const { role } = useSession();
  const { cls, tch } = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<"overview" | "academics" | "attendance" | "fees">("overview");
  const [busy, setBusy] = useState(false);
  useEffect(() => setTab("overview"), [student?.id]);
  if (!student) return null;
  const c = cls(student.classId);
  const finance = role === "admin" || role === "accountant";

  const setStatus = async (status: Student["status"]) => {
    setBusy(true);
    try {
      const { data } = await api.patch<{ data: Student }>(`/students/${student.id}`, { status });
      onChange(data);
      toast(referenceT(status === "Inactive" ? "{value0} marked inactive" : status === "Alumni" ? "{value0} marked alumni" : "{value0} marked active", { value0: student.name }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };

  return (
    <Drawer open onClose={onClose} width="max-w-2xl"
      title={student.name} titleAddon={<Badge tone={statusTone(student.status)} dot>{student.status}</Badge>}
      sub={referenceT("{value0} · Roll {value1} · {value2}", {value0: c?.name ?? "", value1: student.rollNo, value2: student.admissionNo})}
      footer={
        <>
          <Link href="/messages"><Button icon={MessageSquare}><ReferenceText message="Message guardian" /></Button></Link>
          {role === "admin" && (student.status === "Active"
            ? <Button variant="danger" loading={busy} onClick={() => setStatus("Inactive")}><ReferenceText message="Deactivate" /></Button>
            : <Button variant="primary" loading={busy} onClick={() => setStatus("Active")}><ReferenceText message="Reactivate" /></Button>)}
        </>
      }>
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <Avatar name={student.name} size={44} />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          <div><p className="text-base font-semibold tabular">{student.gpa}</p><p className="text-[10px] text-muted"><ReferenceText message="GPA" /></p></div>
          <div><p className="text-base font-semibold tabular">{student.attendancePct}%</p><p className="text-[10px] text-muted"><ReferenceText message="Attendance" /></p></div>
          <div><Badge tone={statusTone(student.feeStatus)}>{student.feeStatus}</Badge><p className="text-[10px] text-muted"><ReferenceText message="Fees" /></p></div>
        </div>
      </div>
      <div className="px-4 pt-2.5">
        <Tabs value={tab} onChange={setTab} items={[
          { value: "overview", label: "Overview" }, { value: "academics", label: "Academics" }, { value: "attendance", label: "Attendance" },
          ...(finance || role === "teacher" ? [{ value: "fees" as const, label: "Fees" }] : []),
        ]} />
      </div>
      <div className="p-4 pt-2.5">
        {tab === "overview" && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {([
              ["Date of birth", fmtDate(student.dob)], ["Gender", student.gender], ["Blood group", student.bloodGroup], ["House", student.house],
              ["Class teacher", tch(c?.classTeacherId)?.name ?? "—"], ["Room", c?.room ?? "—"], ["Transport", student.transport], ["Joined", fmtDate(student.joinedOn)],
              ["Student email", student.email], ["Student phone", student.phone], ["Guardian", `${student.guardianName} (${student.guardianRelation})`], ["Guardian phone", student.guardianPhone],
            ] as const).map(([k, v]) => (
              <div key={k} className="min-w-0 border-b border-line/60 pb-1.5"><dt className="text-[10.5px] text-muted">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
            ))}
            <div className="col-span-2"><dt className="text-[10.5px] text-muted"><ReferenceText message="Address" /></dt><dd className="font-medium">{student.address}</dd></div>
            <div className="col-span-2 flex gap-2 pt-1">
              <a href={`mailto:${student.email}`}><Button size="xs" icon={Mail}><ReferenceText message="Email" /></Button></a>
              <a href={`tel:${student.guardianPhone}`}><Button size="xs" icon={Phone}><ReferenceText message="Call guardian" /></Button></a>
            </div>
          </dl>
        )}
        {tab === "academics" && <Academics id={student.id} />}
        {tab === "attendance" && <AttendanceCalendar studentId={student.id} />}
        {tab === "fees" && <Fees id={student.id} />}
      </div>
    </Drawer>
  );
}

function Academics({ id }: { id: string }) {
  const { data, error } = useReportCard(id);
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Skeleton className="h-64" />;
  return <div className="rounded-md border border-line"><ReportCardTable data={data} compact /></div>;
}

function Fees({ id }: { id: string }) {
  const referenceT = useReferenceLocalization().t;
  const { fmtDate, fmtMoney } = useFormat();
  const { data } = useApi<FeeInvoice[]>(`/invoices?studentId=${encodeURIComponent(id)}`);
  if (!data) return <Skeleton className="h-32" />;
  return (
    <div className="grid gap-2">
      {data.map((i) => (
        <div key={i.id} className="rounded-md border border-line p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{i.term}</span><span className="text-muted">{i.invoiceNo}</span>
            <Badge tone={statusTone(i.status)} className="ml-auto">{i.status}</Badge>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={i.paid} max={i.amount} className="flex-1" />
            <span className="tabular">{fmtMoney(i.paid)} / {fmtMoney(i.amount)}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted"><ReferenceText message="Due" /> {fmtDate(i.dueDate)}{i.lastPaymentOn && referenceT(" · last paid {value0} via {value1}", { value0: fmtDate(i.lastPaymentOn), value1: i.method ?? "" })}</p>
        </div>
      ))}
    </div>
  );
}
