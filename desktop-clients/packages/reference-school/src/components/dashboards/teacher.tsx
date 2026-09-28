"use client";

import { CalendarCheck, ClipboardCheck, FileText, ListChecks, PenTool, Video } from "lucide-react";
import { Link } from "../../lib/router";
import { Badge, BarChart, Button, Card, CardGrid, CardHeader, Empty, ErrorNote, Kpi, LineChart, Progress } from "../../ui";
import { ScheduleList } from "../shared/schedule-list";
import { useApi } from "../../lib/api";
import { useLookups } from "../../lib/lookups";
import { useSession } from "../../lib/session";
import type { TeacherStats } from "../../lib/contract";
import { relativeFromNow } from "../../lib/utils";
import { DashSkeleton } from "./admin";
import { useFormat } from "../../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export function TeacherDashboard() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtTime, fmtNum, fmtPct } = useFormat();
  const { user } = useSession();
  const { data: s, error, reload } = useApi<TeacherStats>(`/stats?role=teacher&id=${encodeURIComponent(user.id)}`);
  const { cls, sub } = useLookups();
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!s) return <DashSkeleton />;
  const liveNow = s.live.find((l) => l.status === "Live");

  return (
    <CardGrid className="grid gap-2.5">
      <Card className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold"><ReferenceText message="Good" /> {new Date().getHours() < 12 ? referenceT("morning") : referenceT("afternoon")}, {user.name.split(" ")[0]}</p>
          <p className="text-xs text-muted">
            {s.schedule.slots.length} <ReferenceText message="periods" /> {s.schedule.dayLabel.toLowerCase()}, {s.pendingGrading} <ReferenceText message="submissions to grade" />{liveNow ? referenceT(", and your {value0} class is live now.", { value0: cls(liveNow.classId)?.name.replace("Grade ", "") ?? "" }) : "."}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {liveNow ? (
            <Link href={`/live/${liveNow.id}`}><Button variant="danger" icon={Video}><ReferenceText message="Rejoin live class" /></Button></Link>
          ) : (
            <Link href="/live"><Button variant="primary" icon={Video}><ReferenceText message="Start a live class" /></Button></Link>
          )}
          <Link href="/attendance"><Button icon={CalendarCheck}><ReferenceText message="Take attendance" /></Button></Link>
          <Link href="/quizzes/new"><Button icon={ListChecks}><ReferenceText message="Build quiz" /></Button></Link>
          <Link href="/whiteboard"><Button icon={PenTool}><ReferenceText message="Whiteboard" /></Button></Link>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Video} label={referenceT("Periods {value0}", {value0: s.schedule.dayLabel.toLowerCase()})} value={s.schedule.slots.length} sub={referenceT("{value0} per week", {value0: fmtNum(s.teacher.weeklyPeriods)})} />
        <Kpi icon={ClipboardCheck} label={referenceT("Waiting for grading")} value={s.pendingGrading} sub={referenceT("{value0} assignments open", {value0: s.openAssignments})} tone="warn" />
        <Kpi icon={CalendarCheck} label={referenceT("{value0} attendance", {value0: s.homeClass?.name ?? "Home class"})} value={fmtPct(s.homeAttendance.at(-1)?.pct ?? 0)} sub={referenceT("latest school day")} tone="ok" />
        <Kpi icon={ListChecks} label={referenceT("Quizzes")} value={s.quizzes} sub={referenceT("across {value0} classes", {value0: s.classIds.length})} tone="info" />
      </div>

      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-4 lg:row-span-2">
          <CardHeader title={referenceT("Schedule, {value0}", {value0: s.schedule.dayLabel.toLowerCase()})} action={<Link href="/timetable"><Button size="xs" variant="ghost"><ReferenceText message="Week" /></Button></Link>} />
          {s.schedule.slots.length ? <ScheduleList slots={s.schedule.slots} show="class" isToday={s.schedule.dayLabel === "Today"} /> : <Empty title={referenceT("No periods scheduled")} />}
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Needs grading")} icon={FileText} action={<Link href="/assignments"><Button size="xs" variant="ghost"><ReferenceText message="All work" /></Button></Link>} />
          <ul className="divide-y divide-line/70">
            {s.toGrade.map((a) => (
              <li key={a.id} className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs font-medium">{a.title}</p>
                  <Badge tone={a.status === "Open" ? "brand" : "neutral"}>{cls(a.classId)?.name.replace("Grade ", "")}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                  <Progress value={a.graded} max={a.submitted || 1} className="flex-1" />
                  <span className="tabular">{a.graded}/{a.submitted} <ReferenceText message="graded" /></span>
                  <span><ReferenceText message="due" /> {fmtShort(a.dueDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Live sessions")} icon={Video} action={<Link href="/live"><Button size="xs" variant="ghost"><ReferenceText message="Manage" /></Button></Link>} />
          <ul className="divide-y divide-line/70">
            {s.live.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{l.title}</p>
                  <p className="truncate text-[11px] text-muted">{l.kind} · {cls(l.classId)?.name} · {l.status === "Live" ? "started " + relativeFromNow(l.start) : fmtTime(l.start) + ", " + relativeFromNow(l.start)}</p>
                </div>
                {l.status === "Live" ? <Link href={`/live/${l.id}`}><Button size="xs" variant="danger"><ReferenceText message="Join" /></Button></Link> : <Badge tone="info">{l.status}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("{value0} Quarterly average", {value0: sub(s.teacher.subjectIds[0])?.name ?? ""})} sub={referenceT("Your classes")} />
          <div className="p-3"><BarChart height={110} max={100} suffix="%" data={s.performance} /></div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("{value0} attendance", {value0: s.homeClass?.name ?? ""})} sub={referenceT("Last 15 school days")} />
          <div className="p-3"><LineChart height={110} min={70} max={100} suffix="%" labels={s.homeAttendance.map((d) => fmtShort(d.date))} series={[{ name: "Present", values: s.homeAttendance.map((d) => d.pct) }]} /></div>
        </Card>
      </CardGrid>
    </CardGrid>
  );
}
