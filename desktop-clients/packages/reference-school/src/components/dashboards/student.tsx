"use client";

import { Award, BookMarked, CalendarCheck, ClipboardList, FileText, ListChecks, Mail, Phone, Video, Wallet } from "lucide-react";
import { Link } from "../../lib/router";
import { Avatar, Badge, BarChart, Button, Card, CardGrid, CardHeader, Empty, ErrorNote, Kpi, LineChart, Ring } from "../../ui";
import { ChildSwitcher, useActiveStudent } from "../shared/child-switcher";
import { ScheduleList } from "../shared/schedule-list";
import { useApi } from "../../lib/api";
import { useLookups } from "../../lib/lookups";
import { useSession } from "../../lib/session";
import type { StudentStats } from "../../lib/contract";
import { relativeFromNow } from "../../lib/utils";
import { DashSkeleton } from "./admin";
import { useFormat } from "../../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export function StudentDashboard() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtTime, fmtMoney, fmtFixed, fmtPct } = useFormat();
  const { role } = useSession();
  const { studentId } = useActiveStudent();
  const parent = role === "parent";
  const { data: s, error, reload } = useApi<StudentStats>(studentId ? `/stats?role=student&id=${encodeURIComponent(studentId)}` : null);
  const { sub, tch } = useLookups();
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!s || s.student.id !== studentId) return <div className="grid gap-2.5">{parent && <ChildSwitcher />}<DashSkeleton /></div>;

  const avg = Math.round(s.subjectPerf.reduce((a, b) => a + b.value, 0) / s.subjectPerf.length);
  const due = s.invoices.filter((i) => i.status !== "Paid").reduce((a, i) => a + i.amount - i.paid, 0);
  const liveNow = s.live.find((l) => l.status === "Live" && l.kind === "Class");
  const first = s.student.name.split(" ")[0];

  return (
    <CardGrid className="grid gap-2.5">
      <Card className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        {parent ? <ChildSwitcher /> : <Avatar name={s.student.name} size={36} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{parent ? referenceT("{value0}'s week at a glance", { value0: first }) : referenceT("Welcome back, {value0}", { value0: first })}</p>
          <p className="text-xs text-muted">{s.class.name}<ReferenceText message=", roll" /> {s.student.rollNo}, {s.student.house} <ReferenceText message="house. Class teacher" /> {s.classTeacher.name}.</p>
        </div>
        {liveNow && !parent && (
          <Link href={`/live/${liveNow.id}`}>
            <Button variant="danger" icon={Video}><ReferenceText message="Join" /> {sub(liveNow.subjectId)?.name} <ReferenceText message="live" /></Button>
          </Link>
        )}
        {parent && <Link href="/messages"><Button icon={Mail}><ReferenceText message="Message class teacher" /></Button></Link>}
      </Card>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={CalendarCheck} label={referenceT("Attendance")} value={fmtPct(s.attendancePct)} sub={referenceT("last 60 school days")} tone={s.attendancePct >= 90 ? "ok" : "warn"} />
        <Kpi icon={Award} label={referenceT("Quarterly average")} value={fmtPct(avg)} sub={referenceT("GPA {value0}", {value0: fmtFixed(s.student.gpa, 2)})} />
        <Kpi icon={FileText} label={referenceT("Assignments pending")} value={s.pendingCount} sub={referenceT("open and not submitted")} tone="warn" />
        {parent
          ? <Kpi icon={Wallet} label={referenceT("Fees outstanding")} value={fmtMoney(due)} sub={due ? "Term 2 invoice" : "All paid"} tone={due ? "bad" : "ok"} />
          : <Kpi icon={ListChecks} label={referenceT("Quizzes available")} value={s.quizzes.length} sub={referenceT("published by teachers")} tone="info" />}
      </div>

      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-4 lg:row-span-2">
          <CardHeader title={referenceT("Classes, {value0}", {value0: s.schedule.dayLabel.toLowerCase()})} action={<Link href="/timetable"><Button size="xs" variant="ghost"><ReferenceText message="Timetable" /></Button></Link>} />
          <ScheduleList slots={s.schedule.slots} isToday={s.schedule.dayLabel === "Today"} />
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader title={parent ? "Meetings & live classes" : "Live classes"} icon={Video} action={<Link href="/live"><Button size="xs" variant="ghost"><ReferenceText message="All" /></Button></Link>} />
          <ul className="divide-y divide-line/70">
            {s.live.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{l.title}</p>
                  <p className="truncate text-[11px] text-muted">{tch(l.teacherId)?.name} · {l.status === "Live" ? referenceT("live now") : `${fmtTime(l.start)}, ${relativeFromNow(l.start)}`}</p>
                </div>
                {l.status === "Live" ? <Link href={`/live/${l.id}`}><Button size="xs" variant="danger"><ReferenceText message="Join" /></Button></Link> : <Badge tone="info">{l.kind === "Class" ? referenceT("Scheduled") : l.kind}</Badge>}
              </li>
            ))}
            {!s.live.length && <li><Empty title={referenceT("Nothing scheduled")} /></li>}
          </ul>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Assignments due")} icon={FileText} action={<Link href="/assignments"><Button size="xs" variant="ghost"><ReferenceText message="Open" /></Button></Link>} />
          <ul className="divide-y divide-line/70">
            {s.pending.slice(0, 4).map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="h-7 w-1 rounded-full" style={{ background: sub(a.subjectId)?.color }} />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{a.title}</p><p className="text-[11px] text-muted">{sub(a.subjectId)?.name}</p></div>
                <Badge tone="warn"><ReferenceText message="due" /> {fmtShort(a.dueDate)}</Badge>
              </li>
            ))}
            {!s.pending.length && <li><Empty title={referenceT("All caught up")} text="No open assignments waiting for a submission." /></li>}
          </ul>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title={referenceT("Quarterly results by subject")} sub={referenceT("Bar: score, grey: class average")} action={<Link href="/marks"><Button size="xs" variant="ghost"><ReferenceText message="Report card" /></Button></Link>} />
          <div className="p-3"><BarChart height={120} max={100} suffix="%" compare="class avg" data={s.subjectPerf.map((p) => ({ label: p.label, value: p.value, compare: p.classAvg, color: p.color }))} /></div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={referenceT("Upcoming exams")} icon={ClipboardList} action={<Link href="/exams"><Button size="xs" variant="ghost"><ReferenceText message="Schedule" /></Button></Link>} />
          <ul className="divide-y divide-line/70">
            {s.exams.slice(0, 4).map((e) => (
              <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span className="w-12 text-[11px] text-muted tabular">{fmtShort(e.date)}</span>
                <span className="min-w-0 flex-1 truncate">{sub(e.subjectId)?.name}</span>
                <span className="text-[11px] text-faint">{relativeFromNow(e.date + "T09:00:00")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </CardGrid>

      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title={referenceT("Attendance trend")} sub={referenceT("Daily presence over 20 school days")} />
          <div className="flex items-center gap-4 p-3">
            <Ring value={s.attendancePct} size={72} stroke={7} />
            <LineChart className="flex-1" height={80} min={0} max={100} suffix="%" labels={s.attendanceTrend.map((d) => fmtShort(d.date))} series={[{ name: "Present", values: s.attendanceTrend.map((d) => d.pct) }]} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Library books")} icon={BookMarked} action={<Link href={parent ? "/fees" : "/library"}><Button size="xs" variant="ghost">{parent ? referenceT("Fees") : referenceT("Library")}</Button></Link>} />
          <ul className="divide-y divide-line/70">
            {s.books.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{b.bookTitle}</span>
                <Badge tone={b.status === "Overdue" ? "bad" : "info"}>{b.status === "Overdue" ? referenceT("overdue, {value0}", { value0: fmtMoney(b.fine) }) : referenceT("due {value0}", { value0: fmtShort(b.dueOn) })}</Badge>
              </li>
            ))}
            {!s.books.length && <li><Empty title={referenceT("No books on loan")} /></li>}
          </ul>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={referenceT("Class teacher")} />
          <div className="flex items-center gap-2.5 p-3">
            <Avatar name={s.classTeacher.name} size={38} />
            <div className="min-w-0 text-xs">
              <p className="font-medium">{s.classTeacher.name}</p>
              <p className="truncate text-muted">{s.classTeacher.designation}</p>
              <p className="mt-1 flex items-center gap-1 truncate text-muted"><Phone className="size-3" /> {s.classTeacher.phone}</p>
            </div>
          </div>
        </Card>
      </CardGrid>
    </CardGrid>
  );
}
