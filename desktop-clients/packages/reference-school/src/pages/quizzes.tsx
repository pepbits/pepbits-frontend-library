"use client";

import { CheckCircle2, Clock, Eye, ListChecks, Lock, Play, Plus, Send, Target, Users } from "lucide-react";
import { Link } from "../lib/router";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardGrid, Empty, ErrorNote, Kpi, Progress, Ring, Select, Skeleton, statusTone, Tabs, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { qs, useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import type { QuizAttempt } from "../lib/contract";
import { useSession } from "../lib/session";
import type { Quiz, Student } from "../lib/types";
import { cn, isoDay } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function QuizzesPage() {
  const { role } = useSession();
  return role === "student" || role === "parent" ? <LearnerQuizzes /> : <StaffQuizzes />;
}

function StaffQuizzes() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtPct } = useFormat();
  const api = useSchoolApi();
  const { role, user } = useSession();
  const { cls, sub, tch } = useLookups();
  const { classes } = useMyClasses();
  const toast = useToast();
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const { data, error, loading, reload, setData } = useApi<Quiz[]>(`/quizzes${qs({ teacherId: role === "teacher" ? user.id : undefined, classId, status })}`);
  const all = data ?? [];
  const setQuizStatus = async (q: Quiz, s: Quiz["status"]) => {
    try {
      const { data: saved } = await api.patch<{ data: Quiz }>(`/quizzes/${q.id}`, { status: s });
      setData((d) => d?.map((x) => (x.id === q.id ? saved : x)) ?? d);
      toast(s === "Published" ? referenceT("“{value0}” is live for {value1}", { value0: q.title, value1: cls(q.classId)?.name ?? "" }) : referenceT("“{value0}” closed", { value0: q.title }));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const published = all.filter((q) => q.status !== "Draft");

  return (
    <CardGrid className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={ListChecks} label={referenceT("Quizzes")} value={loading && !data ? "…" : all.length} sub={referenceT("{value0} live now", {value0: all.filter((q) => q.status === "Published").length})} />
        <Kpi icon={Users} label={referenceT("Attempts")} tone="info" value={published.reduce((a, q) => a + q.attempts, 0)} sub={referenceT("all quizzes")} />
        <Kpi icon={Target} label={referenceT("Average score")} tone="ok" value={published.length ? fmtPct(Math.round(published.reduce((a, q) => a + q.avgScore, 0) / published.length)) : "—"} />
        <Kpi icon={Clock} label={referenceT("Drafts")} tone="warn" value={all.filter((q) => q.status === "Draft").length} sub={referenceT("not yet published")} />
      </div>
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <ClassSelect value={classId} onChange={setClassId} classes={classes} allLabel="All classes" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-32" aria-label={referenceT("Status")}><option value=""><ReferenceText message="Any status" /></option>{["Published", "Draft", "Closed"].map((s) => <option key={s}>{s}</option>)}</Select>
        <span className="text-[11px] text-muted"><ReferenceText message="Quizzes can also be launched as live polls inside a live class." /></span>
        <Link href="/quizzes/new" className="ml-auto"><Button variant="primary" icon={Plus}><ReferenceText message="Build quiz" /></Button></Link>
      </Card>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <CardGrid className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {loading && !data && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        {all.map((q) => {
          const sb = sub(q.subjectId);
          return (
            <Card key={q.id} className="flex flex-col p-2.5">
              <div className="flex items-start gap-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-md text-[11px] font-bold" style={{ background: `${sb?.color}1a`, color: sb?.color }}>{sb?.code}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{q.title}</p><p className="text-[10.5px] text-muted">{cls(q.classId)?.name} · {q.questionCount ?? q.questions?.length ?? 0} <ReferenceText message="Qs ·" /> {q.durationMin} <ReferenceText message="min" />{role === "admin" && ` · ${tch(q.teacherId)?.name}`}</p></div>
                <Badge tone={statusTone(q.status)}>{q.status}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                {q.status === "Draft" ? <span><ReferenceText message="Not published" /></span> : <>
                  <Progress value={q.attempts} max={cls(q.classId)?.strength ?? 24} className="flex-1" /><span className="tabular">{q.attempts} <ReferenceText message="attempts" /></span><span className="font-semibold text-fg tabular"><ReferenceText message="avg" /> {fmtPct(q.avgScore)}</span>
                </>}
              </div>
              <div className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-2">
                <span className="text-[10.5px] text-muted"><ReferenceText message="Due" /> {fmtShort(q.dueDate)}</span>
                <Link href={`/quizzes/${q.id}`} className="ml-auto"><Button size="xs" icon={Eye}><ReferenceText message="Preview" /></Button></Link>
                {q.status === "Draft" && <Button size="xs" variant="primary" icon={Send} onClick={() => setQuizStatus(q, "Published")}><ReferenceText message="Publish" /></Button>}
                {q.status === "Published" && <Button size="xs" icon={Lock} onClick={() => setQuizStatus(q, "Closed")}><ReferenceText message="Close" /></Button>}
              </div>
            </Card>
          );
        })}
      </CardGrid>
      {data && all.length === 0 && <Card><Empty icon={ListChecks} title={referenceT("No quizzes match")} action={<Link href="/quizzes/new"><Button variant="primary"><ReferenceText message="Build your first quiz" /></Button></Link>} /></Card>}
    </CardGrid>
  );
}

function LearnerQuizzes() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtPct, fmtNum } = useFormat();
  const { role } = useSession();
  const { sub, tch } = useLookups();
  const { studentId } = useActiveStudent();
  const { data: me } = useApi<Student>(studentId ? `/students/${encodeURIComponent(studentId)}` : null);
  const { data } = useApi<Quiz[]>(me && me.id === studentId ? `/quizzes?classId=${encodeURIComponent(me.classId)}&status=Published,Closed&sort=dueDate` : null);
  const { data: recorded } = useApi<QuizAttempt[]>(studentId ? `/quiz-attempts?studentId=${encodeURIComponent(studentId)}` : null);
  const [tab, setTab] = useState<"open" | "done">("open");
  const attempts = useMemo<Record<string, QuizAttempt | undefined>>(
    () => Object.fromEntries((recorded ?? []).filter((a) => a.studentId === studentId).map((a) => [a.quizId, a])), [recorded, studentId]);

  const open = (data ?? []).filter((q) => q.status === "Published" && !attempts[q.id]);
  const done = (data ?? []).filter((q) => q.status === "Closed" || attempts[q.id]);
  const list = tab === "open" ? open : done;
  const scored = done.filter((q) => attempts[q.id]);
  const avg = scored.length ? Math.round(scored.reduce((a, q) => a + attempts[q.id]!.score / attempts[q.id]!.total, 0) / scored.length * 100) : null;

  return (
    <CardGrid className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ChildSwitcher />
        <Tabs value={tab} onChange={setTab} items={[{ value: "open", label: "Available", count: open.length }, { value: "done", label: "Completed", count: done.length }]} />
        {avg !== null && <span className="ml-auto text-[11px] text-muted"><ReferenceText message="Your average" /> <b className="text-fg tabular">{fmtPct(avg)}</b> <ReferenceText message="over" /> {scored.length} <ReferenceText message="quizzes" /></span>}
      </div>
      {!data ? <div className="grid gap-2 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        : list.length === 0 ? <Card><Empty icon={CheckCircle2} title={tab === "open" ? "No quizzes waiting" : "No completed quizzes yet"} /></Card> : (
          <CardGrid className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {list.map((q) => {
              const sb = sub(q.subjectId); const at = attempts[q.id];
              const overdue = q.dueDate < isoDay(new Date());
              return (
                <Card key={q.id} className="flex items-center gap-3 p-3">
                  {at ? <Ring value={Math.round((at.score / at.total) * 100)} size={52} stroke={5} label={referenceT("{value0}%", {value0: Math.round((at.score / at.total) * 100)})} color={sb?.color} />
                    : <span className="grid size-[52px] shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: `${sb?.color}1a`, color: sb?.color }}>{sb?.code}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{q.title}</p>
                    <p className="text-[10.5px] text-muted">{q.questionCount ?? q.questions?.length ?? 0} <ReferenceText message="questions ·" /> {q.durationMin} <ReferenceText message="min ·" /> {tch(q.teacherId)?.name}</p>
                    <p className={cn("text-[10.5px]", overdue && !at ? "text-bad" : "text-muted")}>{at ? referenceT("Scored {value0}/{value1} · class avg {value2}", { value0: fmtNum(at.score), value1: fmtNum(at.total), value2: fmtPct(q.avgScore) }) : q.status === "Closed" ? referenceT("Closed — not attempted") : referenceT("Due {value0}", { value0: fmtShort(q.dueDate) })}</p>
                  </div>
                  {!at && q.status === "Published" && role === "student" && <Link href={`/quizzes/${q.id}`}><Button variant="primary" size="sm" icon={Play}><ReferenceText message="Start" /></Button></Link>}
                  {at && <Link href={`/quizzes/${q.id}`}><Button size="sm" icon={Eye}><ReferenceText message="Review" /></Button></Link>}
                </Card>
              );
            })}
          </CardGrid>
        )}
    </CardGrid>
  );
}
