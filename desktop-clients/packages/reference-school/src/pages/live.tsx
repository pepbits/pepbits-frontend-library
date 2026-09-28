"use client";

import { CalendarPlus, Clock, Film, PlayCircle, Radio, Users, Video, Zap } from "lucide-react";
import { Link } from "../lib/router";
import { useRouter } from "../lib/router";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, DateInput, Empty, ErrorNote, Field, Input, Kpi, Modal, Select, Skeleton, Tabs, TimeInput, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent, useChildren } from "../components/shared/child-switcher";
import { useMyClasses } from "../components/shared/scope";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { LiveSession, Student } from "../lib/types";
import { cn, isoDay, relativeFromNow } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Tab = "live" | "upcoming" | "recordings";

export function LivePage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtTime, fmtPct } = useFormat();
  const api = useSchoolApi();
  const { role, user } = useSession();
  const { cls, sub, tch, subjects } = useLookups();
  const { classes } = useMyClasses();
  const { studentId } = useActiveStudent();
  const router = useRouter();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi<LiveSession[]>("/live");
  const learner = role === "student" || role === "parent";
  const { data: me } = useApi<Student>(learner && studentId ? `/students/${encodeURIComponent(studentId)}` : null);
  const { data: kids } = useChildren();
  const [tab, setTab] = useState<Tab>("live");
  const [scheduling, setScheduling] = useState(false);
  const [recording, setRecording] = useState<LiveSession | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const mine = useMemo(() => {
    const all = data ?? [];
    if (role === "admin") return all;
    if (role === "teacher") { const ids = new Set(classes.map((c) => c.id)); return all.filter((s) => s.teacherId === user.id || s.kind === "Staff meeting" || s.kind === "Webinar" || (s.kind === "Class" && ids.has(s.classId) && s.teacherId === user.id)); }
    if (role === "student") return all.filter((s) => (s.kind === "Class" && s.classId === me?.classId) || s.kind === "Webinar");
    const kidClasses = new Set((kids ?? []).map((k) => k.classId));
    return all.filter((s) => (s.kind === "Parent meeting" && kidClasses.has(s.classId)) || s.kind === "Webinar");
  }, [data, role, user.id, classes, me, kids]);

  const groups: Record<Tab, LiveSession[]> = {
    live: mine.filter((s) => s.status === "Live"),
    upcoming: mine.filter((s) => s.status === "Scheduled"),
    recordings: mine.filter((s) => s.status === "Ended").reverse(),
  };
  useEffect(() => { if (data && groups.live.length === 0 && tab === "live") setTab("upcoming"); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const host = role === "teacher" || role === "admin";

  const startNow = async (s: LiveSession) => {
    try {
      await api.patch(`/live/${s.id}`, { start: new Date().toISOString() });
      router.push(`/live/${s.id}`);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const instant = async () => {
    const c = classes[0];
    const subjectId = tch(user.id)?.subjectIds[0] ?? subjects.find((x) => x.periodsPerWeek > 0)?.id;
    if (!c || !subjectId) return toast("No class is available for an instant session.", "error");
    try {
      const { data: s } = await api.post<{ data: LiveSession }>("/live", {
        title: "Instant class", subjectId, classId: c.id, teacherId: role === "teacher" ? user.id : c.classTeacherId,
        start: new Date().toISOString(), durationMin: 45, kind: "Class",
      });
      router.push(`/live/${s.id}`);
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <CardGrid className="grid gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={Radio} label={referenceT("Live now")} tone="bad" value={loading && !data ? "…" : groups.live.length} sub={groups.live[0]?.title ?? "No session in progress"} />
        <Kpi icon={Clock} label={referenceT("Upcoming")} tone="info" value={groups.upcoming.length} sub={groups.upcoming[0] ? referenceT("next {value0}", { value0: relativeFromNow(groups.upcoming[0].start) }) : "Nothing scheduled"} />
        <Kpi icon={Film} label={referenceT("Recordings")} value={groups.recordings.filter((s) => s.recording).length} sub={referenceT("available to replay")} />
        <Kpi icon={Users} label={referenceT("Average attendance")} tone="ok" value={fmtPct(groups.recordings.length ? Math.round(groups.recordings.reduce((a, s) => a + s.attendees / s.capacity, 0) / groups.recordings.length * 100) : 0)} sub={referenceT("past sessions")} />
      </div>
      <Card className="flex flex-wrap items-center gap-2 p-2">
        {role === "parent" && <ChildSwitcher />}
        <Tabs value={tab} onChange={setTab} items={[{ value: "live", label: "Live now", count: groups.live.length }, { value: "upcoming", label: "Upcoming", count: groups.upcoming.length }, { value: "recordings", label: "Past & recordings", count: groups.recordings.length }]} />
        <span className="text-[11px] text-muted"><ReferenceText message="Camera, microphone, screen sharing, whiteboard and live polls — right in the browser." /></span>
        {host && (
          <div className="ml-auto flex gap-1.5">
            <Button icon={CalendarPlus} onClick={() => setScheduling(true)}><ReferenceText message="Schedule" /></Button>
            <Button variant="danger" icon={Zap} onClick={instant}><ReferenceText message="Start instant class" /></Button>
          </div>
        )}
      </Card>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        : groups[tab].length === 0 ? <Card><Empty icon={Video} title={tab === "live" ? "Nothing is live right now" : tab === "upcoming" ? "No upcoming sessions" : "No past sessions"} /></Card> : (
          <CardGrid className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {groups[tab].map((s) => {
              const sb = sub(s.subjectId); const t = tch(s.teacherId);
              const soon = s.status === "Scheduled" && new Date(s.start).getTime() - Date.now() < 10 * 60000;
              return (
                <Card key={s.id} className={cn("flex flex-col p-2.5", s.status === "Live" && "border-bad/40 ring-1 ring-bad/20")}>
                  <div className="flex items-start gap-2">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md" style={{ background: `${sb?.color}1a`, color: sb?.color }}><Video className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{s.title}</p>
                      <p className="truncate text-[10.5px] text-muted">{s.kind === "Class" ? `${sb?.name} · ${cls(s.classId)?.name}` : s.kind} · {t?.name}</p>
                    </div>
                    {s.status === "Live" ? <Badge tone="bad" dot className="animate-pulse"><ReferenceText message="LIVE" /></Badge> : <Badge tone={s.kind === "Class" ? "brand" : "info"}>{s.kind}</Badge>}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                    <span>{isoDay(new Date(s.start)) === isoDay(new Date()) ? referenceT("Today") : fmtDate(s.start, { weekday: "short", day: "2-digit", month: "short" })} {fmtTime(s.start)} · {s.durationMin} <ReferenceText message="min" /></span>
                    <span className="ml-auto flex items-center gap-1"><Users className="size-3" />{s.status === "Scheduled" ? referenceT("{value0} seats", { value0: s.capacity }) : `${s.attendees}/${s.capacity}`}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-2">
                    {t && <Avatar name={t.name} size={20} />}
                    <span className="text-[10.5px] text-muted">{s.status === "Live" ? referenceT("started {value0}", { value0: relativeFromNow(s.start) }) : s.status === "Scheduled" ? referenceT("starts {value0}", { value0: relativeFromNow(s.start) }) : referenceT("ended")}</span>
                    <div className="ml-auto flex gap-1.5">
                      {s.status === "Live" && <Link href={`/live/${s.id}`}><Button size="xs" variant="danger" icon={Video}>{host && s.teacherId === user.id ? referenceT("Rejoin as host") : referenceT("Join now")}</Button></Link>}
                      {s.status === "Scheduled" && host && <Button size="xs" variant="primary" icon={Video} onClick={() => startNow(s)}><ReferenceText message="Start now" /></Button>}
                      {s.status === "Scheduled" && !host && <Link href={`/live/${s.id}`}><Button size="xs" variant={soon ? "primary" : "secondary"}>{soon ? referenceT("Join lobby") : referenceT("Details")}</Button></Link>}
                      {s.status === "Ended" && (s.recording ? <Button size="xs" icon={PlayCircle} onClick={() => setRecording(s)}><ReferenceText message="Recording" /></Button> : <span className="text-[10.5px] text-faint"><ReferenceText message="No recording" /></span>)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </CardGrid>
        )}
      <ScheduleModal open={scheduling} onClose={() => setScheduling(false)} onCreated={(s) => { setData((d) => [...(d ?? []), s].sort((a, b) => a.start.localeCompare(b.start))); toast(referenceT("“{value0}” scheduled · invitations sent", { value0: s.title })); setTab("upcoming"); }} />
      <Modal open={!!recording} onClose={() => setRecording(null)} size="xl" title={recording?.title ?? ""} sub={recording ? referenceT("{value0} · {value1} min · {value2} attended", { value0: fmtDate(recording.start), value1: recording.durationMin, value2: recording.attendees }) : ""}>
        <div className="grid aspect-video place-items-center rounded-lg bg-slate-900 text-slate-300">
          <div className="text-center"><PlayCircle className="mx-auto size-12 opacity-80" /><p className="mt-2 text-sm"><ReferenceText message="Recording" /> {recording?.recording}</p><p className="text-xs text-slate-500"><ReferenceText message="Recordings stream from your media storage in production." /></p></div>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5 text-[11px]">
          {["00:00 Introduction", "06:40 Worked example", "21:15 Live poll", "34:50 Q&A"].map((c) => <button type="button" key={c} className="rounded border border-line px-2 py-1.5 text-left hover:bg-subtle">{c}</button>)}
        </div>
      </Modal>
    </CardGrid>
  );
}

function ScheduleModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: LiveSession) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const { role, user } = useSession();
  const { subjects, tch, cls } = useLookups();
  const { classes } = useMyClasses();
  const me = tch(user.id);
  const [f, setF] = useState({ title: "", kind: "Class", classId: "", subjectId: "", date: isoDay(new Date()), time: "", durationMin: "45" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const start = f.date && f.time ? new Date(`${f.date}T${f.time}`) : null;
  const past = start ? start.getTime() < Date.now() - 60000 : false;
  const subjectId = f.subjectId || me?.subjectIds[0] || subjects[0]?.id || "";
  const valid = f.title.trim() && f.classId && start && !past;
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<{ data: LiveSession }>("/live", { title: f.title, kind: f.kind, classId: f.classId, subjectId, start: start!.toISOString(), durationMin: Number(f.durationMin), teacherId: role === "teacher" ? user.id : cls(f.classId)?.classTeacherId });
      onCreated({ ...data, status: "Scheduled" }); onClose(); setF((x) => ({ ...x, title: "", time: "" }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={referenceT("Schedule a live session")} sub={referenceT("Participants get a calendar invite and a reminder 10 minutes before")}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!valid} loading={busy} onClick={save}><ReferenceText message="Schedule" /></Button></>}>
      <div className="grid grid-cols-4 gap-3">
        <Field label={referenceT("Title")} required className="col-span-4"><Input value={f.title} onChange={set("title")} autoFocus placeholder={referenceT("e.g. Probability – revision before UT2")} /></Field>
        <Field label={referenceT("Type")}><Select value={f.kind} onChange={set("kind")}>{["Class", "Parent meeting", "Staff meeting", "Webinar"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
        <Field label={referenceT("Class")} required><Select value={f.classId} onChange={set("classId")}><option value=""><ReferenceText message="Select" /></option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label={referenceT("Subject")}><Select value={subjectId} onChange={set("subjectId")}>{subjects.filter((s) => s.id !== "sub-lib").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={referenceT("Duration")}><Select value={f.durationMin} onChange={set("durationMin")}>{[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} <ReferenceText message="min" /></option>)}</Select></Field>
        <Field label={referenceT("Date")} required><DateInput value={f.date} min={isoDay(new Date())} onChange={set("date")} /></Field>
        <Field label={referenceT("Start time")} required error={past ? "Time is in the past" : undefined}><TimeInput value={f.time} onChange={set("time")} /></Field>
      </div>
    </Modal>
  );
}
