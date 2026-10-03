"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Circle, Maximize2, Mic, MicOff, MonitorUp, PhoneOff, ScanFace, Signal, Square } from "lucide-react";
import { useConsult } from "./context";
import { fmtDuration, fullName, useTeleconsultFormat } from "../../lib/format";
import { Avatar, Button, DemoNotice, cx, useToast } from "../ui";

export function VideoStage({
  inCall,
  callSeconds,
  recSeconds,
  onToggleRecord,
  onAdmit,
  onEnd,
}: {
  inCall: boolean;
  callSeconds: number;
  recSeconds: number;
  onToggleRecord: () => void;
  onAdmit: () => void;
  onEnd: () => void;
}) {
  const { patient, enc, appt, role, update, locked } = useConsult();
  const toast = useToast();
  const { fmtTime } = useTeleconsultFormat();
  const { t } = useLocalization();
  const shareTracks = useRef<MediaStream | null>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [camError, setCamError] = useState<string>();

  // Real local camera for the self-view only. It is never transmitted: remote media is simulated in this demo,
  // and a production deployment would add a WebRTC provider here.
  useEffect(() => {
    if (!inCall || !camOn) return;
    let s: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((ms) => {
        if (cancelled) return ms.getTracks().forEach((t) => t.stop());
        s = ms;
        setStream(ms);
        setCamError(undefined);
      })
      .catch(() => setCamError("Camera unavailable"));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [inCall, camOn]);

  useEffect(() => {
    if (selfRef.current) selfRef.current.srcObject = stream;
  }, [stream]);

  const stopShare = useCallback(() => {
    shareTracks.current?.getTracks().forEach((t) => t.stop());
    shareTracks.current = null;
    setSharing(false);
  }, []);
  useEffect(() => stopShare, [stopShare]);
  useEffect(() => { if (!inCall) stopShare(); }, [inCall, stopShare]);

  // Real getDisplayMedia preview for the clinician. Nothing is sent to the patient in this demo.
  const share = async () => {
    if (sharing) return stopShare();
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      shareTracks.current = s;
      setSharing(true);
      toast("Screen preview started on this device only. It is not sent to the patient in this demo.", "info");
      s.getVideoTracks()[0].addEventListener("ended", stopShare);
    } catch {
      /* user cancelled */
    }
  };

  const snapshot = () => {
    const t = fmtTime(new Date());
    update((e) => ({ ...e, soap: { ...e.soap, objective: `${e.soap.objective}${e.soap.objective && !e.soap.objective.endsWith("\n") ? "\n" : ""}[Demo] Clinical photo marker at ${t}; no remote image was received or stored. ` } }));
    toast("Photo marker added to Objective. This demo does not receive or store remote images.", "info");
  };

  const ctrl = "flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-300";

  return (
    <div ref={stageRef} className="relative overflow-hidden rounded-lg bg-ink-950 shadow-panel">
      <div className="relative aspect-[4/3] w-full">
        {/* Remote participant */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,#1B4459_0%,#071923_70%)]">
          <div className="relative">
                        <Avatar name={fullName(patient)} size={84} />
          </div>
          <p className="mt-3 text-sm font-medium text-white">{fullName(patient)}</p>
          <p className="text-2xs text-ink-200">{patient.guardian ? t("With {value0}", { value0: patient.guardian }) : `${t("Joined from patient app")}${patient.language !== "English" ? ` · ${t("prefers {value0}", { value0: patient.language })}` : ""}`}</p>
          <p className="mt-2 rounded bg-white/10 px-2 py-0.5 text-2xs text-caution-100" data-demo-notice="true"><LocalizedText message={"Simulated remote participant · no live video or audio"} /></p>
        </div>

        {!inCall && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/75 p-4 text-center backdrop-blur-[2px]">
            <p className="text-sm text-white">
              {appt.status === "completed" ? t("Visit completed") : appt.status === "booked" ? t("Patient hasn’t joined yet") : t("{value0} is in the waiting room", { value0: patient.firstName })}
            </p>
            {!locked && appt.status !== "completed" && (
              <Button variant="primary" onClick={onAdmit}>
                {role === "nurse" ? "Admit for triage" : "Admit and start call"}
              </Button>
            )}
          </div>
        )}

        {/* Top overlay */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-2.5">
          {inCall && (
            <span className="rounded bg-black/40 px-1.5 py-0.5 text-2xs font-medium text-white tabular">{fmtDuration(callSeconds)}</span>
          )}
          {enc.recording.active && (
            <span className="inline-flex items-center gap-1 rounded bg-alarm-500 px-1.5 py-0.5 text-2xs font-semibold text-white tabular">
              <Circle className="h-2 w-2 animate-pulse fill-white" /> {t("Demo rec {value0}", { value0: fmtDuration(recSeconds) })}
            </span>
          )}
          {sharing && <span className="rounded bg-pulse-500 px-1.5 py-0.5 text-2xs font-medium text-white"><LocalizedText message={"Local screen preview · not sent"} /></span>}
          <span className="ml-auto inline-flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-2xs text-white" title={t("No media connection is made in this demo")}>
            <Signal className="h-3 w-3 text-caution-100" />  <LocalizedText message={"Demo"} />
          </span>
          <SourceButton onClick={() => stageRef.current?.requestFullscreen?.()} className="rounded bg-black/40 p-1 text-white hover:bg-black/60" aria-label="Full screen">
            <Maximize2 className="h-3 w-3" />
          </SourceButton>
        </div>

        {/* Live captions from the transcription stream */}
        {inCall && enc.recording.active && enc.transcript.length > 0 && (
          <div className="absolute bottom-2.5 left-2.5 right-[34%] rounded-md bg-black/60 px-2.5 py-1.5 text-xs leading-snug text-white" aria-live="polite">
            <span className="mr-1 font-semibold text-pulse-300">{enc.transcript[enc.transcript.length - 1].speaker === "clinician" ? t("You") : patient.firstName}:</span>
            {enc.transcript[enc.transcript.length - 1].text}
          </div>
        )}

        {/* Self view */}
        {inCall && (
          <div className="absolute bottom-2.5 right-2.5 aspect-[4/3] w-[30%] overflow-hidden rounded-md border border-white/20 bg-ink-800 shadow-lg">
            {camOn && stream ? (
              <video ref={selfRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-2xs text-ink-200">
                <CameraOff className="mb-1 h-4 w-4" />
                {camError ? t(camError) : t("Camera off")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 border-t border-white/5 bg-ink-950 px-2 py-2">
        <SourceButton className={cx(ctrl, micOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-alarm-500 text-white")} onClick={() => setMicOn(!micOn)} aria-label={micOn ? "Mute microphone (demo: no audio is transmitted)" : "Unmute microphone (demo: no audio is transmitted)"} disabled={!inCall}>
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </SourceButton>
        <SourceButton className={cx(ctrl, camOn ? "bg-white/10 text-white hover:bg-white/20" : "bg-alarm-500 text-white")} onClick={() => setCamOn(!camOn)} aria-label={camOn ? "Turn camera off" : "Turn camera on"} disabled={!inCall}>
          {camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
        </SourceButton>
        <SourceButton className={cx(ctrl, sharing ? "bg-pulse-500 text-white" : "bg-white/10 text-white hover:bg-white/20")} onClick={share} aria-label="Preview screen on this device (not sent to the patient)" disabled={!inCall}>
          <MonitorUp className="h-4 w-4" />
        </SourceButton>
        <SourceButton className={cx(ctrl, "bg-white/10 text-white hover:bg-white/20")} onClick={snapshot} aria-label="Add a demo clinical photo marker" title="Adds a text marker only; no remote image is received" disabled={!inCall || locked}>
          <ScanFace className="h-4 w-4" />
        </SourceButton>
        <SourceButton
          className={cx(ctrl, enc.recording.active ? "bg-alarm-500 text-white" : "bg-white/10 text-white hover:bg-white/20")}
          onClick={onToggleRecord}
          aria-label={enc.recording.active ? "Stop recording" : "Start recording and transcription"}
          title={enc.recording.active ? "Stop recording" : "Start the demo recording and simulated transcript"}
          disabled={!inCall || locked}
        >
          {enc.recording.active ? <Square className="h-3.5 w-3.5 fill-white" /> : <Circle className="h-4 w-4 fill-alarm-500 text-alarm-500" />}
        </SourceButton>
        <SourceButton className={cx(ctrl, "w-14 bg-alarm-500 text-white hover:bg-alarm-600")} onClick={onEnd} aria-label="End call" disabled={!inCall}>
          <PhoneOff className="h-4 w-4" />
        </SourceButton>
      </div>
      <div className="border-t border-white/5 bg-ink-950 px-2 pb-2">
        <DemoNotice><LocalizedText message={"Demo call: the remote participant, recording and transcript are simulated. Only your camera preview is real, and it is not transmitted. Screen preview and photo markers stay on this device or in the note text."} /></DemoNotice>
      </div>
    </div>
  );
}
