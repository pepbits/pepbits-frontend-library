"use client";

import {
  ArrowLeft, BarChart3, Circle, Hand, LayoutGrid, MessageSquare, Mic, MicOff, MonitorUp, PenTool, PhoneOff, Send, Smile, Users, Video, VideoOff,
} from "lucide-react";
import { Link } from "../lib/router";
import { useParams, useRouter } from "../lib/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Card, CardGrid, ErrorNote, Input, Skeleton, useToast } from "../ui";
import { Whiteboard } from "../components/whiteboard/whiteboard";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { LiveRoomActionBody, LiveRoomState } from "../lib/contract";
import type { LiveSession, QuizQuestion } from "../lib/types";
import { cn, hashStr, relativeFromNow } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



const REACTIONS = ["👍", "👏", "😂", "❤️", "🎉", "🤔"];
const mmss = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* Specialized conferencing layout kept from the source. Camera, microphone and screen share are this browser's real
   media, shown locally only. Participants, chat, polls, scores and recording state come from the server room API
   (GET /live/:id/room, POST /live/:id/actions); no audio/video is sent to anyone and no media relay is implied. */
export function LiveRoomPage() {
  const { id } = useParams<{ id: string }>();
  const api = useSchoolApi();
  const toast = useToast();
  const { data: session, error, reload } = useApi<LiveSession>(id ? `/live/${encodeURIComponent(id)}` : null);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [prefs, setPrefs] = useState({ mic: true, cam: true });
  const join = async () => {
    setJoining(true);
    try {
      await api.post(`/live/${encodeURIComponent(id!)}/actions`, { action: "join", enabled: prefs.mic });
      setJoined(true);
    } catch (e) { toast((e as Error).message, "error"); } finally { setJoining(false); }
  };
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!session) return <Skeleton className="h-full min-h-96" />;
  if (!joined) return <Lobby s={session} prefs={prefs} setPrefs={setPrefs} onJoin={join} joining={joining} />;
  return <Room s={session} initial={prefs} />;
}

/* ------------------------------- camera hook ------------------------------- */
function useMedia(wantCam: boolean, wantMic: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<MediaStream | null>(null);
  useEffect(() => {
    let dead = false;
    if (!wantCam && !wantMic) { ref.current?.getTracks().forEach((t) => t.stop()); ref.current = null; setStream(null); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setErr("This browser doesn't support camera access"); return; }
    navigator.mediaDevices.getUserMedia({ video: wantCam ? { width: 640, height: 360 } : false, audio: wantMic })
      .then((s) => { if (dead) { s.getTracks().forEach((t) => t.stop()); return; } ref.current?.getTracks().forEach((t) => t.stop()); ref.current = s; setStream(s); setErr(null); })
      .catch((e: Error) => setErr(e.name === "NotAllowedError" ? "Camera/microphone permission was blocked" : "No camera or microphone found"));
    return () => { dead = true; };
  }, [wantCam, wantMic]);
  useEffect(() => () => ref.current?.getTracks().forEach((t) => t.stop()), []);
  return { stream, err };
}

function VideoEl({ stream, mirror }: { stream: MediaStream; mirror?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (v.current) v.current.srcObject = stream; }, [stream]);
  return <video ref={v} autoPlay playsInline muted className={cn("absolute inset-0 size-full object-cover", mirror && "-scale-x-100")} />;
}

/* ------------------------------- lobby ------------------------------- */
function Lobby({ s, prefs, setPrefs, onJoin, joining }: { s: LiveSession; prefs: { mic: boolean; cam: boolean }; setPrefs: (p: { mic: boolean; cam: boolean }) => void; onJoin: () => void; joining: boolean }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtTime } = useFormat();
  const { user, role } = useSession();
  const { sub, tch, cls } = useLookups();
  const { stream, err } = useMedia(prefs.cam, prefs.mic);
  const host = s.teacherId === user.id || role === "admin";
  const canJoin = s.status === "Live" || host || new Date(s.start).getTime() - Date.now() < 10 * 60000;
  return (
    <CardGrid className="mx-auto grid h-full max-w-5xl content-center gap-3 lg:grid-cols-5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900 lg:col-span-3">
        {stream && prefs.cam ? <VideoEl stream={stream} mirror /> : <div className="grid size-full place-items-center"><Avatar name={user.name} size={88} /></div>}
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/60 p-3">
          <button onClick={() => setPrefs({ ...prefs, mic: !prefs.mic })} className={cn("grid size-10 place-items-center rounded-full", prefs.mic ? "bg-white/15 text-white" : "bg-red-600 text-white")} aria-label={referenceT("Toggle microphone")}>{prefs.mic ? <Mic className="size-5" /> : <MicOff className="size-5" />}</button>
          <button onClick={() => setPrefs({ ...prefs, cam: !prefs.cam })} className={cn("grid size-10 place-items-center rounded-full", prefs.cam ? "bg-white/15 text-white" : "bg-red-600 text-white")} aria-label={referenceT("Toggle camera")}>{prefs.cam ? <Video className="size-5" /> : <VideoOff className="size-5" />}</button>
        </div>
        {err && <p className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-[11px] text-amber-300">{err} <ReferenceText message="— you can still join with audio off." /></p>}
      </div>
      <Card className="p-4 lg:col-span-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{s.kind}{s.status === "Live" && <span className="ml-2 text-bad"><ReferenceText message="● Live" /></span>}</p>
        <h2 className="mt-1 text-lg leading-snug font-semibold">{s.title}</h2>
        <p className="mt-1 text-xs text-muted">{sub(s.subjectId)?.name} · {cls(s.classId)?.name}</p>
        <p className="text-xs text-muted">{fmtDate(s.start, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(s.start)} · {s.durationMin} <ReferenceText message="min" /></p>
        <div className="mt-3 flex items-center gap-2 text-xs"><Avatar name={tch(s.teacherId)?.name ?? "Host"} size={26} /><ReferenceText message="Hosted by" /> {tch(s.teacherId)?.name}</div>
        <div className="mt-4 grid gap-2">
          {s.status === "Ended" ? <p className="rounded-md bg-subtle p-2 text-xs text-muted"><ReferenceText message="This session has ended." /></p>
            : <Button size="md" variant="primary" disabled={!canJoin} loading={joining} onClick={onJoin}>{host ? (s.status === "Live" ? referenceT("Join as host") : referenceT("Start session")) : canJoin ? referenceT("Join now") : referenceT("Opens {value0}", { value0: relativeFromNow(new Date(new Date(s.start).getTime() - 10 * 60000).toISOString()) })}</Button>}
          <Link href="/live"><Button size="md" variant="ghost" className="w-full" icon={ArrowLeft}><ReferenceText message="Back to live classes" /></Button></Link>
        </div>
        <p className="mt-3 text-[11px] text-faint"><ReferenceText message="Joining as" /> {user.name}<ReferenceText message=". Check your camera and microphone before entering." /></p>
      </Card>
    </CardGrid>
  );
}

/* ------------------------------- room ------------------------------- */
function Room({ s, initial }: { s: LiveSession; initial: { mic: boolean; cam: boolean } }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtTime } = useFormat();
  const { user, role } = useSession();
  const { sub, tch, cls } = useLookups();
  const api = useSchoolApi();
  const router = useRouter();
  const toast = useToast();
  const host = s.teacherId === user.id || role === "admin";
  const hostTeacher = tch(s.teacherId);
  const [mic, setMic] = useState(initial.mic);
  const [cam, setCam] = useState(initial.cam);
  const { stream, err } = useMedia(cam, mic);
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [view, setView] = useState<"gallery" | "board">(host ? "gallery" : "board");
  const [panel, setPanel] = useState<"chat" | "people" | "poll" | null>("chat");
  const [hand, setHand] = useState(false);
  const [floating, setFloating] = useState<{ id: number; e: string; x: number }[]>([]);
  const [reactOpen, setReactOpen] = useState(false);

  /* Room state (participants, chat, poll, scores, recording, elapsed time) is held by the server and polled every
     2 s. Only this user's real camera/microphone/screen and the view layout are local. There is no client fallback
     data: if the room cannot be read, the error is shown. */
  const [room, setRoom] = useState<LiveRoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => api.get<{ data: LiveRoomState }>(`/live/${encodeURIComponent(s.id)}/room`)
      .then((r) => { if (alive) { setRoom(r.data); setRoomError(null); } })
      .catch((e: Error) => { if (alive) setRoomError(e.message); });
    void load();
    const t = setInterval(load, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [api, s.id, tick]);
  const act = useCallback(async (body: LiveRoomActionBody) => {
    setBusy(body.action);
    try {
      const { data } = await api.post<{ data: LiveRoomState }>(`/live/${encodeURIComponent(s.id)}/actions`, body);
      setRoom(data);
      return true;
    } catch (e) { toast((e as Error).message, "error"); return false; } finally { setBusy(null); }
  }, [api, s.id, toast]);

  const people = room?.people ?? [];
  const msgs = room?.messages ?? [];
  const poll = room?.poll ?? null;
  const scores = room?.scores ?? {};
  const rec = room?.recording ?? false;
  const elapsed = room?.elapsed ?? 0;

  /* chat */
  const [draft, setDraft] = useState("");
  const [seen, setSeen] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [msgs.length, panel]);
  useEffect(() => { if (panel === "chat") setSeen(msgs.length); }, [panel, msgs.length]);
  const unread = panel === "chat" ? 0 : Math.max(0, msgs.length - seen);
  // The draft is cleared only once the server has accepted the message.
  const send = async () => { const text = draft.trim(); if (!text) return; if (await act({ action: "message", text })) setDraft(""); };

  /* polls: the question bank is the school's (authors only); launching, voting, revealing and ending are server actions */
  const bankApi = useApi<QuizQuestion[]>(host ? `/question-bank?subjectId=${encodeURIComponent(s.subjectId)}` : null);
  const bank = bankApi.data ?? [];
  const launch = (n: number) => { setPanel("poll"); void act({ action: "poll-launch", index: n, pollNumber: n }); };
  const vote = (i: number) => { if (poll) void act({ action: "poll-vote", index: i, pollNumber: poll.n }); };

  /* controls: local media changes apply at once; the room is told about them */
  const toggleMic = () => { const next = !mic; setMic(next); void act({ action: "mute", enabled: next }); };
  const toggleCam = () => { const next = !cam; setCam(next); void act({ action: "camera", enabled: next }); };
  const raiseHand = async () => { const next = !hand; if (await act({ action: "hand", raised: next })) { setHand(next); if (next) toast("Hand raised — the host has been notified", "info"); } };
  const toggleRecording = async () => { if (await act({ action: "recording", enabled: !rec })) toast(rec ? "Recording stopped" : "Recording started", "info"); };
  const shareScreen = async () => {
    if (screen) { screen.getTracks().forEach((t) => t.stop()); setScreen(null); return; }
    try {
      const st = await navigator.mediaDevices.getDisplayMedia({ video: true });
      st.getVideoTracks()[0]!.onended = () => setScreen(null);
      setScreen(st); toast("You are presenting your screen");
    } catch { toast("Screen sharing was cancelled", "info"); }
  };
  useEffect(() => () => screen?.getTracks().forEach((t) => t.stop()), [screen]);
  const react = (e: string) => {
    void act({ action: "reaction", emoji: e });
    // Pure presentation: where this user's own reaction floats up.
    const idn = Date.now() + Math.random();
    setFloating((f) => [...f, { id: idn, e, x: 10 + Math.random() * 70 }]);
    setTimeout(() => setFloating((f) => f.filter((x) => x.id !== idn)), 2600);
    setReactOpen(false);
  };
  const leave = async () => {
    if (!(await act({ action: host ? "end" : "leave" }))) return;
    screen?.getTracks().forEach((t) => t.stop());
    toast(host ? "Session ended for everyone" : "You left the session", "info");
    router.push("/live");
  };

  const tiles = useMemo(() => people.slice(0, view === "gallery" ? 15 : 6), [people, view]);
  const hands = people.filter((p) => p.hand).length + (hand ? 1 : 0);
  const ctrl = (on: boolean, danger = false) => cn("flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition", danger ? "bg-red-600 text-white hover:bg-red-500" : on ? "bg-white/15 text-white hover:bg-white/25" : "bg-red-600/90 text-white hover:bg-red-500");
  const tool = (on: boolean) => cn("flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition", on ? "bg-sky-500 text-white" : "bg-white/10 text-slate-200 hover:bg-white/20");


  // After every hook: the room state must come from the server; there is no substitute roster or chat.
  if (!room) return roomError ? <ErrorNote message={roomError} onRetry={() => setTick((t) => t + 1)} /> : <Skeleton className="h-full min-h-96" />;
  return (
    <div className="-m-2.5 flex h-[calc(100%+1.25rem)] min-h-[560px] flex-col bg-slate-950 text-slate-100 sm:-m-3 sm:h-[calc(100%+1.5rem)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-1.5">
        <span className="flex items-center gap-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold"><span className="size-1.5 animate-pulse rounded-full bg-white" /><ReferenceText message="LIVE" /></span>
        <div className="min-w-0"><p className="truncate text-xs font-semibold">{s.title}</p><p className="truncate text-[10.5px] text-slate-400">{sub(s.subjectId)?.name} · {cls(s.classId)?.name} <ReferenceText message="· host" /> {hostTeacher?.name}</p></div>
        <span className="text-xs text-slate-300 tabular">{mmss(elapsed)}</span>
        {rec && <span className="flex items-center gap-1 text-[11px] text-red-400"><Circle className="size-2.5 fill-current" /><ReferenceText message="REC" /></span>}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-400">
          {hands > 0 && <span className="flex items-center gap-1 text-amber-300"><Hand className="size-3.5" />{hands}</span>}
          <span className="flex items-center gap-1"><Users className="size-3.5" />{people.length + 1}</span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col gap-2 p-2">
          {(view === "board" || screen) && (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              <Tile me name={user.name} stream={cam ? stream : null} mic={mic} hand={hand} small />
              {tiles.map((p) => <Tile key={p.id} name={p.name} role={p.role} mic={p.mic || p.speaking} cam={p.cam} hand={p.hand} speaking={p.speaking} small />)}
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            {screen ? (
              <div className="relative size-full overflow-hidden rounded-lg bg-black"><VideoEl stream={screen} /><span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px]"><ReferenceText message="You are presenting" /></span></div>
            ) : view === "board" ? (
              <Whiteboard dark compact className="size-full" title={s.title} />
            ) : (
              <div className="grid size-full auto-rows-fr gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length + 1 > 9 ? 4 : tiles.length + 1 > 4 ? 3 : 2}, minmax(0, 1fr))` }}>
                <Tile me name={user.name} stream={cam ? stream : null} mic={mic} hand={hand} />
                {tiles.map((p) => <Tile key={p.id} name={p.name} role={p.role} mic={p.mic || p.speaking} cam={p.cam} hand={p.hand} speaking={p.speaking} />)}
              </div>
            )}
            {floating.map((f) => <span key={f.id} className="pointer-events-none absolute bottom-4 animate-[floatUp_2.6s_ease-out_forwards] text-3xl" style={{ left: `${f.x}%` }}>{f.e}</span>)}
          </div>
          {err && cam && <p className="absolute top-3 left-3 rounded bg-black/70 px-2 py-1 text-[11px] text-amber-300">{err}</p>}
        </div>

        {panel && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-slate-900 max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-10">
            <div className="flex border-b border-white/10 text-xs">
              {([["chat", "Chat"], ["people", `People (${people.length + 1})`], ["poll", "Polls & quiz"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setPanel(k)} className={cn("flex-1 py-2 font-medium", panel === k ? "border-b-2 border-sky-400 text-white" : "text-slate-400 hover:text-slate-200")}>{l}</button>
              ))}
            </div>
            {panel === "chat" && (
              <>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 text-xs">
                  {msgs.map((m) => (
                    <div key={m.id} className={cn("max-w-[90%]", m.me && "ml-auto text-right")}>
                      <p className="text-[10px] text-slate-400">{m.me ? referenceT("You") : m.from} · {fmtTime(new Date(m.at))}</p>
                      <p className={cn("inline-block rounded-lg px-2.5 py-1.5 text-left", m.me ? "bg-sky-600" : m.from === "Class bot" ? "bg-white/5 text-slate-400 italic" : "bg-white/10")}>{m.text}</p>
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                {/* Shared Input restyled inline for the dark conferencing chrome. */}
                <div className="flex gap-1.5 border-t border-white/10 p-2">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder={referenceT("Message everyone")} aria-label={referenceT("Message everyone")} className="min-w-0 flex-1"
                    style={{ height: 32, fontSize: 12, color: "inherit", background: "rgb(255 255 255 / 0.1)", border: "none", boxShadow: "none" }} />
                  <button type="button" disabled={busy === "message"} onClick={() => void send()} className="grid size-8 place-items-center rounded-md bg-sky-600 hover:bg-sky-500" aria-label={referenceT("Send")}><Send className="size-3.5" /></button>
                </div>
              </>
            )}
            {panel === "people" && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {host && <div className="flex gap-1.5 border-b border-white/10 p-2">
                  <button className="flex-1 rounded-md bg-white/10 py-1.5 text-[11px] hover:bg-white/20" disabled={busy === "mute"} onClick={async () => { if (await act({ action: "mute", enabled: false, text: "*" })) toast("Everyone has been muted"); }}><ReferenceText message="Mute all" /></button>
                  <button className="flex-1 rounded-md bg-white/10 py-1.5 text-[11px] hover:bg-white/20" disabled={busy === "hand"} onClick={() => void act({ action: "hand", raised: false, text: "*" })}><ReferenceText message="Lower all hands" /></button>
                </div>}
                <ul className="divide-y divide-white/5 text-xs">
                  <li className="flex items-center gap-2 px-2.5 py-1.5"><Avatar name={user.name} size={24} /><span className="flex-1 truncate">{user.name} <ReferenceText message="(you)" />{host && <span className="ml-1 text-[10px] text-sky-400"><ReferenceText message="Host" /></span>}</span>{hand && <Hand className="size-3.5 text-amber-300" />}{mic ? <Mic className="size-3.5 text-slate-400" /> : <MicOff className="size-3.5 text-red-400" />}</li>
                  {[...people].sort((a, b) => Number(b.hand) - Number(a.hand)).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 px-2.5 py-1.5">
                      <Avatar name={p.name} size={24} />
                      <span className="min-w-0 flex-1"><span className="block truncate">{p.name}</span><span className="block text-[10px] text-slate-500">{p.role}</span></span>
                      {p.hand && <Hand className="size-3.5 text-amber-300" />}
                      {p.mic || p.speaking ? <Mic className={cn("size-3.5", p.speaking ? "text-emerald-400" : "text-slate-400")} /> : <MicOff className="size-3.5 text-slate-600" />}
                      {host && p.role !== "Host" && <button className="rounded px-1 text-[10px] text-slate-400 hover:bg-white/10" disabled={busy === "mute"} onClick={() => void act({ action: "mute", enabled: !p.mic, text: p.id })}>{p.mic ? referenceT("Mute") : referenceT("Ask")}</button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {panel === "poll" && (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5 text-xs">
                {!poll ? (
                  host ? (
                    <div className="space-y-2">
                      <p className="text-slate-400"><ReferenceText message="Launch a question from the" /> {sub(s.subjectId)?.name ?? referenceT("subject")} <ReferenceText message="bank. Students answer on their devices and a leaderboard builds as you go." /></p>
                      {bank.slice(0, 6).map((q, i) => <button key={i} onClick={() => launch(i)} className="block w-full rounded-md bg-white/5 p-2 text-left hover:bg-white/10">{q.text}</button>)}
                    </div>
                  ) : <p className="text-slate-400"><ReferenceText message="No poll yet. Your teacher will launch one during the class." /></p>
                ) : (
                  <>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase"><ReferenceText message="Question" /> {poll.n + 1} · {poll.open ? referenceT("Live") : referenceT("Closed")}</p>
                      <p className="mt-1 text-sm font-medium">{poll.q}</p>
                    </div>
                    <div className="space-y-1.5">
                      {poll.options.map((o, i) => {
                        const total = poll.votes.reduce((a, b) => a + b, 0) || 1;
                        const show = host || poll.mine !== null || !poll.open;
                        const right = !poll.open && i === poll.answer;
                        return (
                          <button key={i} disabled={host || poll.mine !== null || !poll.open} onClick={() => vote(i)}
                            className={cn("relative block w-full overflow-hidden rounded-md border p-2 text-left", right ? "border-emerald-500" : poll.mine === i ? "border-sky-500" : "border-white/10", !host && poll.mine === null && poll.open && "hover:bg-white/10")}>
                            {show && <span className={cn("absolute inset-y-0 left-0", right ? "bg-emerald-500/25" : "bg-sky-500/20")} style={{ width: `${(poll.votes[i]! / total) * 100}%` }} />}
                            <span className="relative flex justify-between gap-2"><span>{String.fromCharCode(65 + i)}. {o}</span>{show && <span className="tabular text-slate-300">{Math.round((poll.votes[i]! / total) * 100)}%</span>}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400">{poll.votes.reduce((a, b) => a + b, 0)} <ReferenceText message="of" /> {people.length + (host ? 0 : 1)} <ReferenceText message="responded" />{!poll.open && poll.mine !== null && (poll.mine === poll.answer ? referenceT(" · ✅ you got it right") : referenceT(" · ❌ not quite"))}</p>
                    {host && (
                      <div className="flex gap-1.5">
                        {poll.open ? <button disabled={busy === "poll-close"} onClick={() => void act({ action: "poll-close", pollNumber: poll.n })} className="flex-1 rounded-md bg-sky-600 py-1.5 font-medium hover:bg-sky-500"><ReferenceText message="Reveal answer" /></button>
                          : <button onClick={() => launch(poll.n + 1)} className="flex-1 rounded-md bg-sky-600 py-1.5 font-medium hover:bg-sky-500"><ReferenceText message="Next question" /></button>}
                        <button disabled={busy === "poll-end"} onClick={() => void act({ action: "poll-end", pollNumber: poll.n })} className="rounded-md bg-white/10 px-3 py-1.5 hover:bg-white/20"><ReferenceText message="End" /></button>
                      </div>
                    )}
                    {!host && poll.open && poll.mine !== null && <p className="text-[11px] text-slate-400"><ReferenceText message="Answer locked in. Waiting for the teacher to reveal…" /></p>}
                    {!host && poll.open && poll.mine === null && poll.votes.reduce((a, b) => a + b, 0) > people.length * 0.8 && (
                      <p className="text-[11px] text-amber-300"><ReferenceText message="Most of the class has answered — pick one!" /></p>
                    )}
                  </>
                )}
                {Object.keys(scores).length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-[10px] text-slate-400 uppercase"><BarChart3 className="size-3" /><ReferenceText message="Leaderboard" /></p>
                    <ol className="space-y-0.5">
                      {Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v], i) => (
                        <li key={n} className={cn("flex items-center gap-2 rounded px-1.5 py-1", n === user.name && "bg-sky-500/15")}><span className="w-4 text-slate-400">{i + 1}</span><span className="flex-1 truncate">{n}</span><span className="tabular">{v}</span></li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <div className="relative flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-3 py-2">
        <button className={ctrl(mic)} onClick={toggleMic} aria-label={referenceT("Microphone")} title={referenceT("Microphone")}>{mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button>
        <button className={ctrl(cam)} onClick={toggleCam} aria-label={referenceT("Camera")} title={referenceT("Camera")}>{cam ? <Video className="size-4" /> : <VideoOff className="size-4" />}</button>
        <button className={tool(!!screen)} onClick={shareScreen} title={referenceT("Share screen")}><MonitorUp className="size-4" /><span className="max-sm:hidden">{screen ? referenceT("Stop sharing") : referenceT("Share")}</span></button>
        <button className={tool(view === "board")} onClick={() => setView((v) => (v === "board" ? "gallery" : "board"))} title={referenceT("Whiteboard")}>{view === "board" ? <LayoutGrid className="size-4" /> : <PenTool className="size-4" />}<span className="max-sm:hidden">{view === "board" ? referenceT("Gallery") : referenceT("Whiteboard")}</span></button>
        <button className={tool(hand)} disabled={busy === "hand"} onClick={() => void raiseHand()} title={referenceT("Raise hand")}><Hand className="size-4" /></button>
        <div className="relative">
          <button className={tool(reactOpen)} onClick={() => setReactOpen((o) => !o)} title={referenceT("Reactions")} aria-label={referenceT("Reactions")}><Smile className="size-4" /></button>
          {reactOpen && <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-slate-800 p-1.5 shadow-xl">{REACTIONS.map((e) => <button key={e} onClick={() => react(e)} className="size-8 rounded-full text-lg hover:bg-white/10">{e}</button>)}</div>}
        </div>
        {host && <button className={tool(rec)} disabled={busy === "recording"} onClick={() => void toggleRecording()} title={referenceT("Record")}><Circle className={cn("size-4", rec && "fill-red-500 text-red-500")} /><span className="max-sm:hidden">{rec ? referenceT("Stop rec") : referenceT("Record")}</span></button>}
        <button className={tool(panel === "chat")} onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))} title={referenceT("Chat")}><MessageSquare className="size-4" />{unread > 0 && panel !== "chat" && <span className="rounded-full bg-red-600 px-1.5 text-[10px]">{unread}</span>}</button>
        <button className={tool(panel === "people")} onClick={() => setPanel((p) => (p === "people" ? null : "people"))} title={referenceT("People")}><Users className="size-4" /></button>
        <button className={tool(panel === "poll")} onClick={() => setPanel((p) => (p === "poll" ? null : "poll"))} title={referenceT("Polls")}><BarChart3 className="size-4" /></button>
        <button className={cn(ctrl(true, true), "ml-2 px-4")} disabled={busy === "end" || busy === "leave"} onClick={() => void leave()}><PhoneOff className="size-4" />{host ? referenceT("End") : referenceT("Leave")}</button>
      </div>
    </div>
  );
}

function Tile({ name, role, stream, mic, cam = true, hand, speaking, me, small }: { name: string; role?: string; stream?: MediaStream | null; mic: boolean; cam?: boolean; hand: boolean; speaking?: boolean; me?: boolean; small?: boolean }) {
  const referenceT = useReferenceLocalization().t;
  const hue = hashStr(name) % 360;
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-slate-800 ring-2 transition", speaking ? "ring-emerald-400" : "ring-transparent", small ? "h-24 w-40 shrink-0" : "min-h-0")}>
      {stream ? <VideoEl stream={stream} mirror={me} /> : (
        <div className="grid size-full place-items-center" style={{ background: cam && !me ? `linear-gradient(160deg, hsl(${hue} 30% 26%), hsl(${hue} 35% 14%))` : undefined }}>
          <Avatar name={name} size={small ? 36 : 56} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 px-1.5 py-1 text-[10.5px]">
        {mic ? <Mic className={cn("size-3", speaking && "text-emerald-400")} /> : <MicOff className="size-3 text-red-400" />}
        <span className="truncate">{me ? referenceT("{value0} (you)", { value0: name }) : name}</span>
        {role === "Host" && <span className="rounded bg-sky-600 px-1 text-[9px]"><ReferenceText message="HOST" /></span>}
      </div>
      {hand && <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-amber-400 text-slate-900"><Hand className="size-3.5" /></span>}
    </div>
  );
}
