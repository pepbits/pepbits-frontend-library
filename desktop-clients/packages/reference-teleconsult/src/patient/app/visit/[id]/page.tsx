"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput, SourceTextarea } from "../../../../shared/controls";
import { useEffect, useRef, useState } from "react";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Circle,
  HeartPulse,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  Wifi,
  X,
  XCircle,
} from "lucide-react";
import type { AppointmentView, LiveVitals, PreVisit } from "../../../../shared/types";
import { isLiveVitals } from "../../../../shared/contract";
import { useTeleconsultClient } from "../../../lib/api";
import { useApi, useLiveFrames, useNow } from "../../../lib/hooks";
import { usePatient } from "../../../lib/session";
import { fmtDuration, useTeleconsultFormat } from "../../../lib/format";
import { patientPaths } from "../../../routes";
import { Avatar, Button, Card, Chip, Header, Notice, Screen, Toggle, cx } from "../../../components/ui";
import { ChatThread } from "../../../components/ChatThread";

const DURATIONS = ["Today", "1–2 days", "3–7 days", "Over a week", "Months"];
const WAITING = ["waiting", "triage", "ready"];

// ---------------- Camera / mic helper ----------------

function useLocalMedia(enabled: boolean, withAudio: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>();
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let s: MediaStream | null = null;
    let raf = 0;
    let ctx: AudioContext | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: withAudio })
      .then((ms) => {
        if (cancelled) return ms.getTracks().forEach((t) => t.stop());
        s = ms;
        setStream(ms);
        setError(undefined);
        if (withAudio && ms.getAudioTracks().length) {
          ctx = new AudioContext();
          const an = ctx.createAnalyser();
          an.fftSize = 256;
          ctx.createMediaStreamSource(ms).connect(an);
          const buf = new Uint8Array(an.frequencyBinCount);
          const tick = () => {
            an.getByteFrequencyData(buf);
            setLevel(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 60));
            raf = requestAnimationFrame(tick);
          };
          tick();
        }
      })
      .catch(() => setError("We couldn’t reach your camera or microphone. Check your browser permissions."));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [enabled, withAudio]);

  return { stream, error, level };
}

function SelfVideo({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={cx("-scale-x-100 object-cover", className)} />;
}

// ---------------- Check-in ----------------

function CheckIn({ appt, onJoined }: { appt: AppointmentView; onJoined: () => void }) {
  const { t } = useLocalization();
  const { patient } = usePatient();
  const client = useTeleconsultClient();
  const { fmtDay, fmtTime } = useTeleconsultFormat();
  const pv = appt.preVisit;
  const [symptoms] = useState<string[]>(pv?.symptoms?.length ? pv.symptoms : [appt.reason]);
  const [duration, setDuration] = useState(pv?.duration || "");
  const [severity, setSeverity] = useState(pv?.severity ?? 4);
  const [notes, setNotes] = useState(pv?.notes ?? "");
  const [share, setShare] = useState(pv?.shareDeviceData ?? true);
  const [consent, setConsent] = useState(pv?.recordingConsent ?? false);
  const [testing, setTesting] = useState(false);
  const [network, setNetwork] = useState<PreVisit["deviceCheck"]["network"]>();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string>();
  const media = useLocalMedia(testing, true);

  // Rough network check: round-trip to the API
  useEffect(() => {
    if (!testing) return;
    const controller = new AbortController();
    const t0 = performance.now();
    client.get("/api/health", { signal: controller.signal }).then(() => {
      const ms = performance.now() - t0;
      setNetwork(ms < 400 ? "good" : ms < 1200 ? "fair" : "poor");
    }).catch((e) => { if ((e as Error).name !== "AbortError") setNetwork("poor"); });
    return () => controller.abort();
  }, [testing, client]);

  const camOk = !!media.stream?.getVideoTracks().length;
  const micOk = !!media.stream?.getAudioTracks().length;

  const join = async () => {
    setJoining(true);
    setError(undefined);
    try {
      await client.post(`/api/appointments/${encodeURIComponent(appt.id)}/join`, {
        preVisit: { completed: true, symptoms, duration: duration || "Not stated", severity, notes, shareDeviceData: share, recordingConsent: consent, deviceCheck: { camera: camOk, mic: micOk, network: network ?? "good" } } satisfies PreVisit,
      });
      onJoined();
    } catch (e) {
      setError((e as Error).message);
      setJoining(false);
    }
  };

  return (
    <>
      <Header back="/home" title="Check in" />
      <main className="space-y-5 px-4 pb-32 pt-2">
        <Card className="flex items-center gap-3">
          <Avatar name={appt.clinician.name} color={appt.clinician.color} size={46} />
          <div className="min-w-0">
            <p className="font-bold text-ink">{appt.clinician.name}</p>
            <p className="text-sm text-ink-600">{fmtDay(appt.start)} · {fmtTime(appt.start)}</p>
          </div>
        </Card>

        <section>
          <h2 className="text-lg font-bold text-forest"><LocalizedText message={"Before you see the doctor"} /></h2>
          <p className="text-sm text-ink-600"><LocalizedText message={"Your answers go straight to your care team, so the visit starts where it matters."} /></p>
          <div className="mt-3 flex flex-wrap gap-2">{symptoms.map((s) => <span key={s} className="rounded-full bg-forest-100 px-3 py-1.5 text-sm font-medium text-forest">{s}</span>)}</div>
          <p className="mb-1.5 mt-4 text-sm font-medium text-ink-600"><LocalizedText message={"How long has this been going on?"} /></p>
          <div className="flex flex-wrap gap-2">{DURATIONS.map((d) => <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>{d}</Chip>)}</div>
          <p className="mb-1.5 mt-4 text-sm font-medium text-ink-600"><LocalizedText message={"How bad is it now?"} /> <b className="text-forest tabular">{severity}/10</b></p>
          <SourceInput type="range" min={0} max={10} value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="w-full accent-forest" aria-label="Severity" />
          <SourceTextarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything that changed since you booked?" className="mt-3 w-full rounded-2xl border border-forest-100 bg-white p-3.5 text-[15px] focus:border-forest-500 focus:outline-none" />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold text-forest"><LocalizedText message={"Test your camera and sound"} /></h2>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-forest-900">
            {testing && media.stream ? (
              <SelfVideo stream={media.stream} className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <Camera className="h-8 w-8 text-sun" />
                <p className="text-sm text-forest-100">{t(media.error ?? "We’ll check your camera, microphone and connection.")}</p>
                {!testing && <Button variant="sun" onClick={() => setTesting(true)}><LocalizedText message={"Start test"} /></Button>}
                {testing && !media.error && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
            )}
            {testing && micOk && (
              <div className="absolute bottom-3 left-3 flex h-8 items-end gap-1 rounded-xl bg-black/40 px-2.5 py-1.5" aria-label={t("Microphone level")}>
                {[0.15, 0.3, 0.45, 0.6, 0.75].map((t) => <span key={t} className={cx("w-1.5 rounded-full transition-all", media.level > t ? "bg-sun" : "bg-white/30")} style={{ height: `${30 + t * 70}%` }} />)}
              </div>
            )}
          </div>
          {testing && (
            <ul className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {[["Camera", camOk], ["Microphone", micOk], ["Connection", network ? network !== "poor" : undefined]].map(([label, ok]) => (
                <li key={label as string} className="flex items-center gap-1.5 rounded-2xl bg-white px-3 py-2.5">
                  {ok === undefined ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : ok ? <CheckCircle2 className="h-4 w-4 text-forest-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                  <span className="font-medium text-ink">{t(label as string)}</span>
                </li>
              ))}
            </ul>
          )}
          {network && <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400"><Wifi className="h-3.5 w-3.5" /> {t("Connection {value0}", { value0: t(network) })}</p>}
        </section>

        <section className="space-y-2">
          <Toggle checked={share} onChange={setShare} label="Share readings from my devices" sub={patient?.devices.filter((d) => d.kind !== "phone").map((d) => d.name).join(", ") || "Heart rate and oxygen from your phone camera"} />
          <Toggle checked={consent} onChange={setConsent} label="Allow the visit to be recorded" sub="Used only to write your medical notes. You can say no." />
        </section>
        {error && <Notice tone="error">{error}</Notice>}
      </main>
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-mint/95 px-4 pb-6 pt-3 backdrop-blur">
        <Button block variant="sun" loading={joining} disabled={!duration} onClick={join}><LocalizedText message={"Join the waiting room"} /></Button>
        {!duration && <p className="mt-2 text-center text-xs text-ink-400"><LocalizedText message={"Tell us how long it’s been going on to continue"} /></p>}
      </div>
    </>
  );
}

// ---------------- Waiting room ----------------

function WaitingRoom({ appt }: { appt: AppointmentView }) {
  const { t } = useLocalization();
  const { patient } = usePatient();
  const [vitals, setVitals] = useState<LiveVitals>();
  // Authenticated polling of the current simulated frame; stops when the screen unmounts.
  useLiveFrames<unknown>(appt.preVisit?.shareDeviceData !== false ? `/api/appointments/${encodeURIComponent(appt.id)}/vitals/current` : null, (frames) => {
    const latest = frames.filter(isLiveVitals).pop();
    if (latest) setVitals(latest);
  }, { intervalMs: 1000 });
  const [chat, setChat] = useState(false);

  const message =
    appt.status === "triage" ? { title: "A nurse is with you", body: t("They’re checking your details and readings before the doctor joins.") }
    : appt.status === "ready" ? { title: "You’re next", body: t("{value0} will join in a moment. Stay on this screen.", { value0: appt.clinician.name }) }
    : { title: "You’re in the waiting room", body: t("{value0} has been told you’re here.", { value0: appt.clinician.name }) };

  return (
    <>
      <Header back="/home" title="Waiting room" right={<SourceButton onClick={() => setChat(true)} className="rounded-full p-2 text-forest hover:bg-forest/5" aria-label="Open chat"><MessageCircle className="h-5 w-5" /></SourceButton>} />
      <main className="px-4 pb-10 pt-4">
        <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-forest-200 animate-breathe" />
          <span className="absolute inset-6 rounded-full bg-forest-100" />
          <div className="relative text-center">
            {appt.queuePosition && appt.status === "waiting" ? (
              <>
                <p className="text-6xl font-extrabold text-forest tabular">{appt.queuePosition}</p>
                <p className="text-sm font-medium text-forest-700"><LocalizedText message={"in line"} /></p>
              </>
            ) : (
              <Avatar name={appt.clinician.name} color={appt.clinician.color} size={88} />
            )}
          </div>
        </div>
        <h1 className="mt-6 text-center text-2xl font-extrabold text-forest" aria-live="polite">{t(message.title)}</h1>
        <p className="mx-auto mt-1 max-w-[30ch] text-center text-[15px] text-ink-600">{message.body}</p>
        {appt.waitMinutes !== undefined && <p className="mt-2 text-center text-xs text-ink-400">{t("Waiting {value0} min", { value0: appt.waitMinutes })}</p>}

        {vitals && (
          <Card className="mt-6">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-forest"><HeartPulse className="h-4 w-4" />  <LocalizedText message={"Demo readings, shared with your doctor"} /></p>
            <dl className="grid grid-cols-4 gap-2 text-center">
              {[["Heart", vitals.hr, "bpm"], ["Oxygen", vitals.spo2, "%"], ["Pressure", `${vitals.sys}/${vitals.dia}`, ""], ["Temp", vitals.temp.toFixed(1), "°C"]].map(([l, v, u]) => (
                <div key={l as string} className="rounded-2xl bg-mint px-1 py-2">
                  <dt className="text-[11px] text-ink-400">{t(l as string)}</dt>
                  <dd className="text-lg font-bold text-ink tabular">{v}<span className="text-[10px] font-normal text-ink-400">{u}</span></dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-ink-400" data-demo-notice="true"><LocalizedText message={"Simulated by the demo API. Not from a real device and not a medical measurement."} /></p>
          </Card>
        )}

        <Card className="mt-4">
          <p className="text-sm font-semibold text-ink"><LocalizedText message={"While you wait"} /></p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
            <li><LocalizedText message={"Find a quiet, well-lit spot and keep your phone charged."} /></li>
            <li><LocalizedText message={"Have your medicines or their boxes nearby."} /></li>
            {patient?.devices.some((d) => d.kind === "bp-cuff") && <li><LocalizedText message={"Keep your blood pressure cuff on; the doctor may ask for a reading."} /></li>}
          </ul>
        </Card>
        <p className="mt-6 text-center text-xs text-ink-400"><LocalizedText message={"If you feel much worse while waiting, call your local emergency number."} /></p>
      </main>

      {chat && (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-mint p-4 animate-rise" role="dialog" aria-label={t("Chat")}>
          <div className="flex items-center"><h2 className="text-lg font-bold text-forest"><LocalizedText message={"Messages"} /></h2><SourceButton onClick={() => setChat(false)} className="ml-auto rounded-full p-2" aria-label="Close chat"><X className="h-5 w-5" /></SourceButton></div>
          <div className="min-h-0 flex-1"><ChatThread appointmentId={appt.id} author={`${patient?.firstName} ${patient?.lastName}`} /></div>
        </div>
      )}
    </>
  );
}

// ---------------- Call ----------------

function Call({ appt, onLeave }: { appt: AppointmentView; onLeave: () => void }) {
  const { t } = useLocalization();
  const { patient } = usePatient();
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const [chat, setChat] = useState(false);
  const media = useLocalMedia(cam, false);
  const now = useNow();
  const seconds = appt.startedAt ? (now - new Date(appt.startedAt).getTime()) / 1000 : 0;

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-forest-900 text-white">
      {/* Remote clinician: simulated. No remote video or audio exists in this demo. */}
      <div className="relative flex flex-1 flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_30%,#1C6560_0%,#0C3532_75%)]">
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold tabular">{fmtDuration(seconds)}</span>
          {appt.recordingActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold">
              <Circle className="h-2 w-2 animate-pulse fill-white" />  <LocalizedText message={"Recording"} />
            </span>
          )}
        </div>
        <Avatar name={appt.clinician.name} color={appt.clinician.color} size={120} />
        <p className="mt-4 text-xl font-bold">{appt.clinician.name}</p>
        <p className="text-sm text-forest-200">{appt.clinician.specialty}</p>
        <p className="mt-3 max-w-[28ch] rounded-2xl bg-black/30 px-3 py-1.5 text-center text-xs text-forest-100" data-demo-notice="true"><LocalizedText message={"Demo call: your clinician’s video and audio are simulated. Your camera preview stays on this device and is not transmitted."} /></p>

        <div className="absolute bottom-4 right-4 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-white/20 bg-forest-700 shadow-lg">
          {cam && media.stream ? <SelfVideo stream={media.stream} className="h-full w-full" /> : (
            <div className="flex h-full items-center justify-center"><CameraOff className="h-6 w-6 text-white/60" /></div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-6 pb-8 pt-5" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
        <SourceButton onClick={() => setMic(!mic)} className={cx("flex h-14 w-14 items-center justify-center rounded-full", mic ? "bg-white/15" : "bg-white text-forest-900")} aria-label={mic ? "Mute (demo: no audio is sent)" : "Unmute (demo: no audio is sent)"}>
          {mic ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </SourceButton>
        <SourceButton onClick={() => setCam(!cam)} className={cx("flex h-14 w-14 items-center justify-center rounded-full", cam ? "bg-white/15" : "bg-white text-forest-900")} aria-label={cam ? "Turn camera off" : "Turn camera on"}>
          {cam ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}
        </SourceButton>
        <SourceButton onClick={() => setChat(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15" aria-label="Open chat">
          <MessageCircle className="h-6 w-6" />
        </SourceButton>
        <SourceButton onClick={onLeave} className="flex h-14 w-20 items-center justify-center rounded-full bg-rose-500" aria-label="Leave call">
          <PhoneOff className="h-6 w-6" />
        </SourceButton>
      </div>

      {chat && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-[70%] flex-col rounded-t-[28px] bg-forest-900/95 p-4 backdrop-blur animate-rise" role="dialog" aria-label={t("Chat")}>
          <div className="flex items-center"><h2 className="font-bold"><LocalizedText message={"Messages"} /></h2><SourceButton onClick={() => setChat(false)} className="ml-auto rounded-full p-2" aria-label="Close chat"><X className="h-5 w-5" /></SourceButton></div>
          <div className="min-h-0 flex-1"><ChatThread dark appointmentId={appt.id} author={`${patient?.firstName} ${patient?.lastName}`} /></div>
        </div>
      )}
    </div>
  );
}

// ---------------- Page ----------------

export default function VisitPage({ params }: { params: { id: string } }) {
  const { t } = useLocalization();
  const router = useRouter();
  const q = useApi<AppointmentView>(`/api/appointments/${encodeURIComponent(params.id)}`, { poll: 2000 });
  const [left, setLeft] = useState(false);
  const appt = q.data;

  useEffect(() => {
    if (appt?.status === "completed") router.replace(patientPaths.summary(appt.id));
  }, [appt?.status, appt?.id, router]);

  return (
    <Screen nav={false}>
      {!appt ? (
        q.error ? <div className="p-4"><Notice tone="error">{q.error}</Notice></div> : <div className="flex min-h-full flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-forest" /></div>
      ) : appt.status === "booked" ? (
        <CheckIn appt={appt} onJoined={q.reload} />
      ) : WAITING.includes(appt.status) ? (
        <WaitingRoom appt={appt} />
      ) : appt.status === "in-call" && !left ? (
        <Call appt={appt} onLeave={() => setLeft(true)} />
      ) : appt.status === "in-call" && left ? (
        <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-extrabold text-forest"><LocalizedText message={"You left the call"} /></h1>
          <p className="mt-2 text-ink-600"><LocalizedText message={"Your doctor is still finishing your notes. You can rejoin while the visit is open."} /></p>
          <Button block className="mt-6" onClick={() => setLeft(false)}><LocalizedText message={"Rejoin call"} /></Button>
          <Button block variant="ghost" className="mt-2" onClick={() => router.push(patientPaths.home())}><LocalizedText message={"Go home"} /></Button>
        </main>
      ) : appt.status === "completed" ? (
        <div className="flex min-h-full flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-forest" /></div>
      ) : (
        <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-extrabold text-forest">{t("This visit was {value0}", { value0: appt.status === "no-show" ? t("marked as missed") : t("cancelled") })}</h1>
          <p className="mt-2 text-ink-600"><LocalizedText message={"Book a new time and we’ll see you soon."} /></p>
          <Button block className="mt-6" onClick={() => router.push(patientPaths.book())}><LocalizedText message={"Book again"} /></Button>
        </main>
      )}
    </Screen>
  );
}
