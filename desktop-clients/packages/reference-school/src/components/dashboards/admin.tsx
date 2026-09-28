"use client";

import { AlertCircle, BookMarked, CalendarCheck, GraduationCap, Radio, UserCog, Wallet } from "lucide-react";
import { Link } from "../../lib/router";
import { Badge, BarChart, Button, Card, CardGrid, CardHeader, Donut, ErrorNote, HBars, Kpi, LineChart, Skeleton } from "../../ui";
import { useApi, useList } from "../../lib/api";
import type { AdminStats } from "../../lib/contract";
import { useLookups } from "../../lib/lookups";
import type { CalendarEvent, Notice } from "../../lib/types";
import { isoDay, toDate } from "../../lib/utils";
import { useFormat } from "../../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



const STAGE_COLORS = ["#8993a3", "#b45309", "#1d5bd8", "#2b4c9b", "#15803d", "#c0262d"];

export function AdminDashboard() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtTime, fmtMoney, fmtMonth, fmtPct } = useFormat();
  const { data: s, error, reload } = useApi<AdminStats>("/stats?role=admin");
  const { data: events } = useList<CalendarEvent>("/events?sort=date");
  const { data: notices } = useList<Notice>("/notices?limit=4");
  const { cls, sub, tch } = useLookups();
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!s) return <DashSkeleton />;
  const collectedPct = Math.round((s.collected / s.billed) * 100);
  const upcoming = (events ?? []).filter((e) => e.date >= isoDay(new Date())).slice(0, 5);

  return (
    <CardGrid className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={GraduationCap} label={referenceT("Active students")} value={s.students} sub={referenceT("{value0} classes", {value0: s.classes})} trend={s.trends?.students} />
        <Kpi icon={UserCog} label={referenceT("Teaching staff")} value={s.teachers} sub={referenceT("{value0} on leave", {value0: s.teachersOnLeave})} tone="info" />
        <Kpi icon={CalendarCheck} label={referenceT("Attendance today")} value={fmtPct(s.attendanceToday)} sub={referenceT("school-wide")} tone="ok" trend={s.trends?.attendanceToday} />
        <Kpi icon={Wallet} label={referenceT("Fees collected")} value={fmtMoney(s.collected)} sub={referenceT("{value0}% of {value1}", {value0: collectedPct, value1: fmtMoney(s.billed)})} tone="ok" />
        <Kpi icon={AlertCircle} label={referenceT("Overdue accounts")} value={s.overdueAccounts} sub={referenceT("need follow-up")} tone="bad" />
        <Kpi icon={BookMarked} label={referenceT("Library loans")} value={s.booksOut} sub={referenceT("{value0} overdue", {value0: s.overdueBooks})} tone="warn" />
      </div>

      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title={referenceT("Attendance, last 20 school days")} sub={referenceT("Share of students present")} action={<Link href="/attendance"><Button size="xs" variant="ghost"><ReferenceText message="Details" /></Button></Link>} />
          <div className="p-3"><LineChart height={150} min={85} max={100} suffix="%" labels={s.attendanceTrend.map((d) => fmtShort(d.date))} series={[{ name: "Present", values: s.attendanceTrend.map((d) => d.pct) }]} /></div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Fee collection by month")} sub={referenceT("{value0} outstanding", {value0: fmtMoney(s.billed - s.collected)})} action={<Link href="/fees"><Button size="xs" variant="ghost"><ReferenceText message="Open fees" /></Button></Link>} />
          <div className="p-3"><BarChart height={150} data={s.feeByMonth.map((m) => ({ label: fmtMonth(m.month + "-01"), value: Math.round(m.amount / 1000) }))} suffix="k" /></div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={referenceT("Live right now")} icon={Radio} action={<Badge tone="bad" dot>{s.liveNow.length} <ReferenceText message="live" /></Badge>} />
          <ul className="max-h-[182px] divide-y divide-line/70 overflow-y-auto">
            {s.liveNow.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-bad opacity-60" /><span className="relative size-2 rounded-full bg-bad" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{l.title}</p>
                  <p className="truncate text-[11px] text-muted">{cls(l.classId)?.name} · {tch(l.teacherId)?.name} · {l.attendees} <ReferenceText message="joined" /></p>
                </div>
                <Link href={`/live/${l.id}`}><Button size="xs"><ReferenceText message="Observe" /></Button></Link>
              </li>
            ))}
            {s.upcomingLive.slice(0, 3).map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-9 text-[11px] text-muted tabular">{fmtTime(l.start)}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs">{l.title}</p><p className="truncate text-[11px] text-muted">{sub(l.subjectId)?.name}</p></div>
              </li>
            ))}
          </ul>
        </Card>
      </CardGrid>

      <CardGrid className="grid gap-2.5 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title={referenceT("Quarterly average by class")} sub={referenceT("Mean score across exam subjects")} action={<Link href="/marks"><Button size="xs" variant="ghost"><ReferenceText message="Mark lists" /></Button></Link>} />
          <div className="p-3"><BarChart height={130} max={100} suffix="%" data={s.classPerformance.map((c) => ({ ...c, color: c.value >= 75 ? "var(--ok)" : c.value >= 65 ? "var(--brand)" : "var(--warn)" }))} /></div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={referenceT("Admissions pipeline")} action={<Link href="/admissions"><Button size="xs" variant="ghost"><ReferenceText message="Board" /></Button></Link>} />
          <div className="space-y-3 p-3">
            <HBars data={s.admissions.map((a, i) => ({ label: a.stage, value: a.count, color: STAGE_COLORS[i] }))} />
            <Donut size={84} thickness={11} center={String(s.students)} sub={referenceT("students")} data={[{ label: "Female", value: s.gender.female, color: "#8a3563" }, { label: "Male", value: s.gender.male, color: "#2b4c9b" }]} />
          </div>
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader title={referenceT("Coming up")} action={<Link href="/calendar"><Button size="xs" variant="ghost"><ReferenceText message="Calendar" /></Button></Link>} />
          <ul className="divide-y divide-line/70">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 px-3 py-1.5">
                <span className="w-11 shrink-0 rounded border border-line text-center leading-tight">
                  <span className="block text-[9px] text-muted">{fmtMonth(e.date)}</span>
                  <span className="block text-sm font-semibold tabular">{toDate(e.date).getDate()}</span>
                </span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{e.title}</p><p className="truncate text-[11px] text-muted">{e.location}</p></div>
                <Badge>{e.type}</Badge>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-3 py-1.5">
            {(notices ?? []).slice(0, 2).map((n) => (
              <p key={n.id} className="truncate py-0.5 text-[11px]"><span className="text-muted"><ReferenceText message="Notice:" /> </span>{n.title}</p>
            ))}
          </div>
        </Card>
      </CardGrid>
    </CardGrid>
  );
}

export function DashSkeleton() {
  return (
    <div className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      <div className="grid gap-2.5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      <div className="grid gap-2.5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
    </div>
  );
}
