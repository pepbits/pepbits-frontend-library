"use client";

import { BookX, CalendarX, Download, FileSpreadsheet, GraduationCap, Printer, UserCog, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { BarChart, Button, Card, CardGrid, CardHeader, Donut, HBars, LineChart, Skeleton, Tabs, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { AccStats, AdminStats } from "../lib/contract";
import type { BookIssue, FeeInvoice, Student } from "../lib/types";
import { gradeFor } from "../lib/utils";
import { useFormat, useSchoolExport } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Tab = "academic" | "attendance" | "enrolment" | "finance";
const PALETTE = ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#0891b2", "#dc2626"];

export function ReportsPage() {
 const referenceT = useReferenceLocalization().t;

  const { profile: SCHOOL } = useLookups();
  const { fmtShort, fmtMoney, fmtMonth, fmtCompact, fmtPct } = useFormat();
  const { role } = useSession();
  const finOnly = role === "accountant";
  const [tab, setTab] = useState<Tab>(finOnly ? "finance" : "academic");
  const { data: a } = useApi<AdminStats>(finOnly ? null : "/stats?role=admin");
  const { data: f } = useApi<AccStats>("/stats?role=accountant");
  const { data: students } = useApi<Student[]>("/students?status=Active");
  const { cls, classes } = useLookups();

  const gradeDist = useMemo(() => {
    const m = new Map<string, number>();
    (students ?? []).forEach((s) => { const g = gradeFor((s.gpa / 4) * 100).grade; m.set(g, (m.get(g) ?? 0) + 1); });
    return ["A+", "A", "B+", "B", "C", "D", "F"].map((g) => ({ label: g, value: m.get(g) ?? 0 }));
  }, [students]);
  const perGrade = useMemo(() => [6, 7, 8, 9, 10, 11, 12].map((g) => ({ label: `G${g}`, value: (students ?? []).filter((s) => cls(s.classId)?.grade === g).length })), [students, cls]);
  const lowAtt = useMemo(() => [...(students ?? [])].sort((x, y) => x.attendancePct - y.attendancePct).slice(0, 10), [students]);

  return (
    <CardGrid className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onChange={setTab} items={finOnly ? [{ value: "finance", label: "Finance" }] : [{ value: "academic", label: "Academic" }, { value: "attendance", label: "Attendance" }, { value: "enrolment", label: "Enrolment" }, { value: "finance", label: "Finance" }]} />
        <span className="text-[11px] text-muted">{SCHOOL.name} <ReferenceText message="· AY" /> {SCHOOL.year} <ReferenceText message="· live data" /></span>
        <Button icon={Printer} className="ml-auto" onClick={() => window.print()}><ReferenceText message="Print" /></Button>
      </div>

      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        {tab === "academic" && (!a || !students ? <Skeleton className="h-72 lg:col-span-12" /> : <>
          <Card className="lg:col-span-7"><CardHeader title={referenceT("Average Quarterly score by class")} sub={referenceT("Percent, all examined subjects")} />
            <div className="p-3"><BarChart height={200} suffix="%" max={100} data={a.classPerformance} /></div></Card>
          <Card className="lg:col-span-5"><CardHeader title={referenceT("GPA grade distribution")} sub={referenceT("{value0} active students", {value0: students.length})} />
            <div className="p-3"><BarChart height={200} data={gradeDist.map((g, i) => ({ ...g, color: ["#16a34a", "#22c55e", "#2563eb", "#3b82f6", "#ca8a04", "#ea580c", "#dc2626"][i] }))} /></div></Card>
          <Card className="lg:col-span-12"><CardHeader title={referenceT("Top performing classes")} />
            <div className="p-3"><HBars suffix="%" max={100} data={[...a.classPerformance].sort((x, y) => y.value - x.value).slice(0, 6).map((c, i) => ({ ...c, label: `Grade ${c.label}`, color: PALETTE[i % PALETTE.length] }))} /></div></Card>
        </>)}

        {tab === "attendance" && (!a || !students ? <Skeleton className="h-72 lg:col-span-12" /> : <>
          <Card className="lg:col-span-8"><CardHeader title={referenceT("School-wide attendance")} sub={referenceT("Last 20 school days")} />
            <div className="p-3"><LineChart height={220} min={80} max={100} suffix="%" labels={a.attendanceTrend.map((t) => fmtShort(t.date))} series={[{ name: "Present", values: a.attendanceTrend.map((t) => t.pct), fill: true }]} /></div></Card>
          <Card className="lg:col-span-4"><CardHeader title={referenceT("Lowest attendance")} sub={referenceT("Follow-up list for counsellors")} />
            <ul className="divide-y divide-line/70 text-xs">{lowAtt.map((s) => <li key={s.id} className="flex items-center gap-2 px-3 py-1"><span className="flex-1 truncate">{s.name}</span><span className="text-muted">{cls(s.classId)?.name.replace("Grade ", "")}</span><span className="w-12 text-right font-semibold text-bad tabular">{fmtPct(s.attendancePct)}</span></li>)}</ul></Card>
        </>)}

        {tab === "enrolment" && (!a || !students ? <Skeleton className="h-72 lg:col-span-12" /> : <>
          <Card className="lg:col-span-4"><CardHeader title={referenceT("Gender balance")} />
            <div className="flex justify-center p-4"><Donut size={150} center={String(a.gender.male + a.gender.female)} sub={referenceT("students")} data={[{ label: "Female", value: a.gender.female, color: "#9333ea" }, { label: "Male", value: a.gender.male, color: "#2563eb" }]} /></div></Card>
          <Card className="lg:col-span-4"><CardHeader title={referenceT("Students per grade")} sub={referenceT("{value0} sections", {value0: classes.length})} />
            <div className="p-3"><BarChart height={170} data={perGrade} /></div></Card>
          <Card className="lg:col-span-4"><CardHeader title={referenceT("Admissions funnel")} sub={referenceT("AY 2027–28 intake")} />
            <div className="p-3"><HBars data={a.admissions.map((x, i) => ({ label: x.stage, value: x.count, color: PALETTE[i % PALETTE.length] }))} /></div></Card>
        </>)}

        {tab === "finance" && (!f ? <Skeleton className="h-72 lg:col-span-12" /> : <>
          <Card className="lg:col-span-8"><CardHeader title={referenceT("Collections by month")} sub={referenceT("{value0} collected of {value1} billed", {value0: fmtMoney(f.collected), value1: fmtMoney(f.billed)})} />
            <div className="p-3"><BarChart height={200} data={f.byMonth.map((m) => ({ label: fmtMonth(m.month + "-01"), value: Math.round(m.amount / 1000) }))} suffix="k" /></div></Card>
          <Card className="lg:col-span-4"><CardHeader title={referenceT("Payment methods")} />
            <div className="flex justify-center p-4"><Donut size={150} center={fmtCompact(f.collected)} sub={referenceT("collected")} data={f.methods.map((m, i) => ({ ...m, color: PALETTE[i % PALETTE.length]! }))} /></div></Card>
          <Card className="lg:col-span-12"><CardHeader title={referenceT("Collection rate by class")} sub={referenceT("Percent of billed amount received")} />
            <div className="p-3"><BarChart height={160} suffix="%" max={100} data={f.byClass} /></div></Card>
        </>)}
      </CardGrid>
      <StandardReports finOnly={finOnly} />
    </CardGrid>
  );
}

function StandardReports({ finOnly }: { finOnly: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const exporter = useSchoolExport();
  const { cls, teachers, sub } = useLookups();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<(string | number | null)[][]>, name: string) => {
    setBusy(key);
    try { const rows = await fn(); if (exporter.exportCsv(`${name}.csv`, rows)) toast(referenceT("{value0}.csv downloaded · {value1} rows", { value0: name, value1: rows.length - 1 })); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const reports = [
    { key: "register", icon: GraduationCap, title: "Student register", text: "Every active student with class, guardian and contact details.", fin: false,
      fn: async () => { const { data } = await api.get<{ data: Student[] }>("/students?status=Active"); return [["Admission no", "Name", "Class", "Roll", "Guardian", "Phone", "Email"], ...data.map((s) => [s.admissionNo, s.name, cls(s.classId)?.name ?? "", s.rollNo, s.guardianName, s.guardianPhone, s.email])]; } },
    { key: "att", icon: CalendarX, title: "Attendance defaulters", text: "Students below 85% attendance in the last 40 school days.", fin: false,
      fn: async () => { const { data } = await api.get<{ data: Student[] }>("/students?status=Active"); return [["Name", "Class", "Attendance %", "Guardian phone"], ...data.filter((s) => s.attendancePct < 85).map((s) => [s.name, cls(s.classId)?.name ?? "", s.attendancePct, s.guardianPhone])]; } },
    { key: "fees", icon: Wallet, title: "Fee defaulters", text: "Overdue and part-paid invoices with balances.", fin: true,
      fn: async () => { const { data } = await api.get<{ data: FeeInvoice[] }>("/invoices?status=Overdue,Partial"); return [["Invoice", "Student", "Class", "Term", "Amount", "Paid", "Balance", "Status"], ...data.map((i) => [i.invoiceNo, i.studentName, cls(i.classId)?.name ?? "", i.term, i.amount, i.paid, i.amount - i.paid, i.status])]; } },
    { key: "load", icon: UserCog, title: "Teacher workload", text: "Periods per week, subjects and home class for each teacher.", fin: false,
      fn: async () => [["Employee", "Name", "Department", "Subjects", "Periods/week", "Status"], ...teachers.map((t) => [t.empId, t.name, t.department, t.subjectIds.map((s) => sub(s)?.code).join(" "), t.weeklyPeriods, t.status])] },
    { key: "lib", icon: BookX, title: "Library overdue", text: "Books past their due date and the member holding them.", fin: false,
      fn: async () => { const { data } = await api.get<{ data: BookIssue[] }>("/issues?status=Overdue"); return [["Book", "Member", "Type", "Issued", "Due"], ...data.map((i) => [i.bookTitle, i.memberName, i.memberType, i.issuedOn, i.dueOn])]; } },
    { key: "collect", icon: FileSpreadsheet, title: "Collections ledger", text: "All payments received this year with method and date.", fin: true,
      fn: async () => { const { data } = await api.get<{ data: FeeInvoice[] }>("/invoices"); return [["Invoice", "Student", "Term", "Paid", "Method", "Last payment"], ...data.filter((i) => i.paid > 0).map((i) => [i.invoiceNo, i.studentName, i.term, i.paid, i.method, i.lastPaymentOn])]; } },
  ].filter((r) => !finOnly || r.fin);
  return (
    <Card className="no-print">
      <CardHeader title={referenceT("Standard reports")} sub={referenceT("Generated from live data and downloaded as CSV (opens in Excel or Google Sheets)")} />
      <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <div key={r.key} className="flex items-center gap-3 bg-surface p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand/10 text-brand"><r.icon className="size-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{r.title}</p><p className="text-[11px] text-muted">{r.text}</p></div>
            <Button size="sm" icon={Download} loading={busy === r.key} disabled={exporter.disabled} title={exporter.reason} onClick={() => run(r.key, r.fn, r.key === "register" ? "student-register" : r.title.toLowerCase().replace(/\s+/g, "-"))}><ReferenceText message="CSV" /></Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
