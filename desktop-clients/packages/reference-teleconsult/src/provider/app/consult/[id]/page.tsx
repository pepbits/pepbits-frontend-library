"use client";
import { SourceButton } from "../../../../shared/controls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import type {
  AiSuggestion,
  AppointmentView,
  Catalog,
  CdsAlert,
  Encounter,
  LiveVitals,
  Patient,
  Prescription,
  Vitals,
} from "../../../../shared/types";
import { ApiError } from "../../../../shared/client";
import { isLiveVitals, isTranscriptDone, isTranscriptLine, type TranscriptFrame } from "../../../../shared/contract";
import { useTeleconsultClient } from "../../../lib/api";
import { useApi, useDebounced, useHotkey, useLiveFrames, useNow } from "../../../lib/hooks";
import { useEncounterSync } from "../../../lib/encounter-sync";
import { useSession } from "../../../lib/session";
import { localId, useTeleconsultFormat } from "../../../lib/format";
import { providerPaths } from "../../../routes";
import { Button, ErrorNote, Modal, Spinner, cx, useToast } from "../../../components/ui";
import { ConsultContext, type ConsultActions, type ConsultCtx, type TabKey } from "../../../components/consult/context";
import { PatientBanner } from "../../../components/consult/PatientBanner";
import { VideoStage } from "../../../components/consult/VideoStage";
import { VitalsMonitor } from "../../../components/consult/VitalsMonitor";
import { CommsPanel } from "../../../components/consult/CommsPanel";
import { AssistRail } from "../../../components/consult/AssistRail";
import { TriagePanel } from "../../../components/consult/TriagePanel";
import { NotesPanel } from "../../../components/consult/NotesPanel";
import { DiagnosisPanel } from "../../../components/consult/DiagnosisPanel";
import { OrdersPanel } from "../../../components/consult/OrdersPanel";
import { RxPanel } from "../../../components/consult/RxPanel";
import { ScoresPanel } from "../../../components/consult/ScoresPanel";
import { AllergyPanel } from "../../../components/consult/AllergyPanel";
import { ReviewPanel } from "../../../components/consult/ReviewPanel";
import { CommandPalette } from "../../../components/consult/CommandPalette";
import { ConflictBanner } from "../../../components/consult/ConflictBanner";

const TABS: { key: TabKey; label: string }[] = [
  { key: "triage", label: "Triage" },
  { key: "notes", label: "Notes" },
  { key: "diagnoses", label: "Diagnoses" },
  { key: "orders", label: "Orders" },
  { key: "rx", label: "Prescriptions" },
  { key: "scores", label: "Scores" },
  { key: "allergies", label: "Allergies" },
  { key: "review", label: "Sign off" },
];

export default function ConsultPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const toast = useToast();
  const client = useTeleconsultClient();
  const { fmtTime } = useTeleconsultFormat();
  const { t } = useLocalization();
  const { role, user } = useSession();

  const apptQ = useApi<AppointmentView>(`/api/appointments/${encodeURIComponent(id)}`, { poll: 3000 });
  const catalogQ = useApi<Catalog>("/api/catalog");
  const sync = useEncounterSync(id);
  const { enc, update, locked, saveState, conflict, preserved, mergeTranscript } = sync;
  const [patient, setPatient] = useState<Patient>();

  const [tab, setTab] = useState<TabKey>("notes");
  const [scoreKey, setScoreKey] = useState("news2");
  const [palette, setPalette] = useState(false);
  const [live, setLive] = useState<LiveVitals>();
  const [alerts, setAlerts] = useState<CdsAlert[]>([]);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scribing, setScribing] = useState(false);
  const [consentAsk, setConsentAsk] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signProblems, setSignProblems] = useState<string[]>([]);
  const [handingOff, setHandingOff] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const now = useNow(1000);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const appt = apptQ.data;
  const catalog = catalogQ.data;
  const encLoaded = !!enc;
  useEffect(() => {
    if (enc && !recSeconds) setRecSeconds(enc.recording.seconds);
    // The recorded duration is seeded once when the encounter first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encLoaded]);
  useEffect(() => {
    if (appt && !patient) setPatient(appt.patient);
  }, [appt, patient]);
  // Land on the right tab for the role
  useEffect(() => setTab(role === "nurse" ? "triage" : "notes"), [role]);
  // Signing is the doctor's act: the nurse has no sign-off tab (the server refuses a nurse signature in any case).
  const tabs = useMemo(() => (role === "doctor" ? TABS : TABS.filter((item) => item.key !== "review")), [role]);

  const reloadPatient = useCallback(async () => {
    if (!appt) return;
    setPatient(await client.get<Patient>(`/api/patients/${encodeURIComponent(appt.patientId)}`));
  }, [appt, client]);

  // Call state
  const inCall = !!appt && !callEnded && !locked && (appt.status === "in-call" || (role === "nurse" && appt.status === "triage"));
  const callSeconds = appt?.startedAt ? Math.max(0, (now - new Date(appt.startedAt).getTime()) / 1000) : 0;

  // Live device vitals: authenticated polling of the current frame (the host fetch carries credentials;
  // an EventSource cannot, and tokens never go in a URL). The frames are simulated demo readings.
  const streamVitals = !!appt && !locked && appt.preVisit?.shareDeviceData !== false && !["completed", "cancelled"].includes(appt.status);
  useLiveFrames<unknown>(streamVitals ? `/api/appointments/${encodeURIComponent(id)}/vitals/current` : null, (frames) => {
    const latest = frames.filter(isLiveVitals).pop();
    if (latest) setLive(latest);
  }, { intervalMs: 1000 });

  // Simulated transcript lines while the demo recording is on; polling stops when the script reports done.
  useLiveFrames<TranscriptFrame>(enc?.recording.active && inCall ? `/api/appointments/${encodeURIComponent(id)}/transcript/current` : null, (frames) => {
    mergeTranscript(frames.filter(isTranscriptLine));
  }, { intervalMs: 1500, isDone: isTranscriptDone });

  // Recording timer
  useEffect(() => {
    if (!enc?.recording.active) return;
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [enc?.recording.active]);

  // Safety checks re-run when anything clinically relevant changes
  const cdsKey = useDebounced(
    enc && patient ? JSON.stringify([enc.prescriptions.map((p) => p.drugId), enc.orders.map((o) => o.code), enc.vitals.length, enc.diagnoses.map((d) => d.code), patient.allergies.map((a) => a.id + a.status)]) : "",
    400,
  );
  useEffect(() => {
    if (!enc || !cdsKey) return;
    const controller = new AbortController();
    client.post<CdsAlert[]>(`/api/encounters/${encodeURIComponent(enc.id)}/cds`, enc, { signal: controller.signal }).then(setAlerts).catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdsKey, client]);

  // Suggestions refresh as the narrative grows
  const sugKey = useDebounced(
    enc ? JSON.stringify([enc.triage.chiefComplaint, enc.triage.nurseNote, enc.soap, enc.transcript.length, enc.diagnoses.length, enc.orders.length, enc.prescriptions.length, enc.scores.length]) : "",
    1000,
  );
  useEffect(() => {
    if (!enc || !sugKey || locked) return;
    const controller = new AbortController();
    client.post<AiSuggestion[]>(`/api/encounters/${encodeURIComponent(enc.id)}/suggest`, enc, { signal: controller.signal }).then(setSuggestions).catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugKey, client]);

  const visibleSuggestions = useMemo(() => suggestions.filter((s) => !dismissed.has(`${s.type}:${s.ref}`)), [suggestions, dismissed]);
  const dismissSuggestion = useCallback(
    (sid: string) => {
      const s = suggestions.find((x) => x.id === sid);
      if (s) setDismissed((d) => new Set(d).add(`${s.type}:${s.ref}`));
    },
    [suggestions],
  );

  // ---------- Actions available everywhere ----------
  const actions = useMemo<ConsultActions>(() => {
    const drugToRx = (drugId: string): Prescription | undefined => {
      const d = catalog?.drugs.find((x) => x.id === drugId);
      if (!d) return;
      return {
        id: localId(),
        drugId: d.id,
        name: d.name,
        strength: d.strength,
        form: d.form,
        dose: d.defaultDose,
        route: d.route,
        frequency: d.defaultFrequency,
        durationDays: d.defaultDays,
        quantity: d.unitsPerDose ? d.unitsPerDose * d.dosesPerDay * d.defaultDays : 1,
        refills: d.defaultDays >= 28 ? 2 : 0,
        instructions: "",
        prn: /as needed/i.test(d.defaultFrequency),
      };
    };
    const orderFor = (code: string, priority: "routine" | "urgent" | "stat" = "routine") => {
      const o = catalog?.orderables.find((x) => x.code === code);
      if (!o) return;
      return { id: localId(), kind: o.kind, code: o.code, name: o.name, priority: o.code === "REF-ED" ? ("stat" as const) : priority, notes: "", orderedBy: user?.id ?? "", orderedByRole: role, status: "pending" as const };
    };
    const nurseCanOrder = (code: string) => {
      const o = catalog?.orderables.find((x) => x.code === code);
      return !!o && ["nursing", "lab", "procedure"].includes(o.kind);
    };

    return {
      addDiagnosis: (code) => {
        if (role !== "doctor") return toast("Diagnoses are added by the doctor", "info");
        const c = catalog?.icd.find((x) => x.code === code);
        if (!c) return;
        update((e) =>
          e.diagnoses.some((d) => d.code === code)
            ? e
            : { ...e, diagnoses: [...e.diagnoses, { code, display: c.display, type: e.diagnoses.some((d) => d.type === "primary") ? "secondary" : "primary", certainty: "confirmed", addToProblemList: false }] },
        );
        toast(t("Diagnosis added: {value0}", { value0: `${c.code} ${c.display}` }));
      },
      addOrder: (code, priority) => {
        if (role === "nurse" && !nurseCanOrder(code)) return toast("That order needs a doctor", "info");
        const o = orderFor(code, priority);
        if (!o) return;
        update((e) => (e.orders.some((x) => x.code === code) ? e : { ...e, orders: [...e.orders, o] }));
        toast(t("Ordered: {value0}", { value0: o.name }));
      },
      addDrug: (drugId) => {
        if (role !== "doctor") return toast("Prescribing needs a doctor", "info");
        const rx = drugToRx(drugId);
        if (!rx) return;
        update((e) => (e.prescriptions.some((p) => p.drugId === drugId) ? e : { ...e, prescriptions: [...e.prescriptions, rx] }));
        toast(t("Prescribed: {value0}. Safety checks running.", { value0: `${rx.name} ${rx.strength}` }));
      },
      applyOrderSet: (setId) => {
        const s = catalog?.orderSets.find((x) => x.id === setId);
        if (!s) return;
        update((e) => {
          const orders = s.orders.filter((c) => !e.orders.some((o) => o.code === c) && (role === "doctor" || nurseCanOrder(c))).map((c) => orderFor(c)).filter(Boolean) as Encounter["orders"];
          const rx = role === "doctor" ? (s.drugs.filter((d) => !e.prescriptions.some((p) => p.drugId === d)).map(drugToRx).filter(Boolean) as Prescription[]) : [];
          const dx =
            role === "doctor"
              ? s.diagnoses
                  .filter((c) => !e.diagnoses.some((d) => d.code === c))
                  .map((c, i) => ({ code: c, display: catalog?.icd.find((x) => x.code === c)?.display ?? c, type: (e.diagnoses.some((d) => d.type === "primary") || i > 0 ? "secondary" : "primary") as "primary" | "secondary", certainty: "provisional" as const, addToProblemList: false }))
              : [];
          return { ...e, orders: [...e.orders, ...orders], prescriptions: [...e.prescriptions, ...rx], diagnoses: [...e.diagnoses, ...dx] };
        });
        if (s.scores[0]) setScoreKey(s.scores[0]);
        toast(`${t("Applied “{value0}”: {value1} orders", { value0: s.name, value1: s.orders.length })}${role === "doctor" && s.drugs.length ? `, ${t("{value0} prescription", { value0: s.drugs.length })}` : ""}${s.scores.length ? `. ${t("Open Scores to complete {value0}", { value0: s.scores.join(", ").toUpperCase() })}` : ""}`);
      },
      openScore: (key) => {
        setScoreKey(key);
        setTab("scores");
      },
      addVitals: (v) => {
        update((e) => ({ ...e, vitals: [...e.vitals, { ...v, id: localId(), recordedAt: new Date().toISOString() } as Vitals] }));
        toast("Vitals saved to chart");
      },
      captureLive: () => {
        if (!live) return toast("No live device reading yet", "info");
        update((e) => ({
          ...e,
          vitals: [...e.vitals, { id: localId(), recordedAt: live.at, source: "device", hr: live.hr, spo2: live.spo2, sys: live.sys, dia: live.dia, rr: live.rr, temp: live.temp, consciousness: "alert" }],
        }));
        toast(t("Captured HR {value0}, BP {value1}/{value2}, SpO2 {value3}%", { value0: live.hr, value1: live.sys, value2: live.dia, value3: live.spo2 }));
      },
      reloadPatient,
    };
  }, [catalog, role, user, update, toast, live, reloadPatient, t]);

  // ---------- Keyboard ----------
  useHotkey((e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k", (e) => {
    e.preventDefault();
    setPalette(true);
  });
  useHotkey((e) => e.altKey && /^[1-8]$/.test(e.key) && Number(e.key) <= tabs.length, (e) => {
    e.preventDefault();
    setTab(tabs[Number(e.key) - 1].key);
  });

  // ---------- Call controls ----------
  const admit = async () => {
    try {
      if (role === "nurse") await client.patch(`/api/appointments/${encodeURIComponent(id)}`, { status: "triage", triagedBy: user?.id });
      else await client.patch(`/api/appointments/${encodeURIComponent(id)}`, { status: "in-call" });
      setCallEnded(false);
      apptQ.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const endCall = async () => {
    if (enc?.recording.active) toggleRecord();
    setCallEnded(true);
    await client.post(`/api/appointments/${encodeURIComponent(id)}/messages`, { from: "staff", author: "System", text: "The clinician ended the video call and is finishing your notes." }).catch(() => {});
    setTab(role === "nurse" ? "triage" : "review");
    toast(role === "nurse" ? "Call ended. Finish triage and hand off to the doctor when ready." : "Call ended. Finish and sign the note when ready.", "info");
  };

  const toggleRecord = () => {
    if (!enc) return;
    if (enc.recording.active) {
      update((e) => ({ ...e, recording: { ...e.recording, active: false, seconds: recSeconds } }));
      toast("Recording stopped. Transcript kept with the note.", "info");
    } else if (!enc.recording.consent) {
      setConsentAsk(true);
    } else {
      update((e) => ({ ...e, recording: { ...e.recording, active: true } }));
    }
  };

  const scribe = async () => {
    if (!enc) return;
    setScribing(true);
    try {
      const soap = await client.post<Encounter["soap"]>(`/api/encounters/${encodeURIComponent(enc.id)}/scribe`);
      update((e) => ({
        ...e,
        soap: {
          subjective: soap.subjective,
          objective: e.soap.objective.includes("photo marker") ? `${soap.objective}\n${e.soap.objective}` : soap.objective,
          assessment: soap.assessment || e.soap.assessment,
          plan: soap.plan,
        },
      }));
      setTab("notes");
      toast("Demo draft note written from scripted content. Review and edit it before signing.", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setScribing(false);
    }
  };

  const handoff = async () => {
    if (!enc || locked) return;
    setHandingOff(true);
    try {
      const next = { ...enc, triage: { ...enc.triage, completedBy: user?.id, completedAt: new Date().toISOString() } };
      update(() => next);
      await sync.save(next);
      await client.patch(`/api/appointments/${encodeURIComponent(id)}`, { status: "ready", triagedBy: user?.id });
      toast("Handed off. The doctor sees this patient as ready.");
      router.push(providerPaths.today());
    } catch (e) {
      // A conflict leaves the edited note on screen with the banner; nothing is thrown away.
      toast((e as Error).message, "error");
      setHandingOff(false);
    }
  };

  const sign = async (overrideReason?: string) => {
    if (!enc || !user || locked || role !== "doctor") return;
    setSigning(true);
    setSignProblems([]);
    try {
      await sync.sign({ signerId: user.id, overrideReason, recordingSeconds: recSeconds });
      toast("Signed. The note is locked and the summary is published to the demo patient app.");
      apptQ.reload();
      clearTimeout(leaveTimer.current);
      leaveTimer.current = setTimeout(() => router.push(providerPaths.today()), 1200);
    } catch (e) {
      if (e instanceof ApiError && e.problems.length) setSignProblems(e.problems);
      else if (!(e instanceof ApiError && e.isConflict)) toast((e as Error).message, "error");
    } finally {
      setSigning(false);
    }
  };

  // ---------- Render ----------
  if (apptQ.error && !appt) return <ErrorNote message={apptQ.error} />;
  if (sync.error) return <ErrorNote message={sync.error} />;
  if (!appt || !catalog || !enc || !patient) return <Spinner label="Opening consultation" />;

  const ctx: ConsultCtx = {
    enc,
    update,
    appt,
    patient,
    catalog,
    role,
    user,
    live,
    alerts,
    suggestions: visibleSuggestions,
    dismissSuggestion,
    actions,
    tab,
    setTab,
    scoreKey,
    setScoreKey,
    locked,
  };

  const counts: Partial<Record<TabKey, number>> = {
    diagnoses: enc.diagnoses.length,
    orders: enc.orders.length,
    rx: enc.prescriptions.length,
    scores: enc.scores.length,
    allergies: patient.allergies.filter((a) => a.status === "active").length,
  };
  const critical = alerts.filter((a) => a.level === "critical").length;

  return (
    <ConsultContext.Provider value={ctx}>
      <div className="flex min-h-full flex-col lg:h-full">
        <PatientBanner saveState={saveState} onPalette={() => setPalette(true)} />
        <ConflictBanner conflict={conflict} preserved={preserved} onResolve={sync.resolveConflict} onDismiss={sync.dismissConflict} />

        <div className="grid flex-1 grid-cols-1 gap-3 p-3 [&>*]:min-w-0 lg:min-h-0 lg:grid-cols-[minmax(290px,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,350px)_minmax(0,1fr)_minmax(260px,310px)]">
          {/* Left: the patient, live */}
          <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto scroll-thin">
            <VideoStage inCall={inCall} callSeconds={callSeconds} recSeconds={recSeconds} onToggleRecord={toggleRecord} onAdmit={admit} onEnd={endCall} />
            <VitalsMonitor />
            <div className="flex lg:min-h-[240px] lg:flex-1 [&>section]:flex-1">
              <CommsPanel onScribe={scribe} scribing={scribing} />
            </div>
            <div className="xl:hidden">
              <AssistRail />
            </div>
          </div>

          {/* Centre: documentation and orders */}
          <section className="flex min-h-[560px] flex-col rounded-lg border border-line bg-white shadow-panel lg:min-h-0">
            <nav className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-2 scroll-thin" role="tablist" aria-label={t("Consultation sections")}>
              {tabs.map((item, i) => (
                <SourceButton
                  key={item.key}
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                  title={t("Alt {value0}", { value0: i + 1 })}
                  className={cx(
                    "relative flex shrink-0 items-center gap-1.5 px-2.5 py-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pulse-500",
                    tab === item.key ? "text-pulse-700" : "text-ink-600 hover:text-ink",
                  )}
                >
                  <LocalizedText message={item.label} />
                  {!!counts[item.key] && <span className={cx("rounded-full px-1.5 text-2xs tabular", item.key === "allergies" ? "bg-alarm-50 text-alarm-600" : "bg-ink/5 text-ink-600")}>{counts[item.key]}</span>}
                  {item.key === "rx" && critical > 0 && <span className="h-1.5 w-1.5 rounded-full bg-alarm-500" aria-label={t("Critical alert")} />}
                  {item.key === "triage" && enc.triage.completedBy && <span className="h-1.5 w-1.5 rounded-full bg-vital-500" aria-label={t("Triage complete")} />}
                  {tab === item.key && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-pulse-500" />}
                </SourceButton>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scroll-thin" role="tabpanel">
              {tab === "triage" && <TriagePanel onHandoff={handoff} handingOff={handingOff} />}
              {tab === "notes" && <NotesPanel onScribe={scribe} scribing={scribing} />}
              {tab === "diagnoses" && <DiagnosisPanel />}
              {tab === "orders" && <OrdersPanel />}
              {tab === "rx" && <RxPanel />}
              {tab === "scores" && <ScoresPanel />}
              {tab === "allergies" && <AllergyPanel />}
              {tab === "review" && role === "doctor" && <ReviewPanel onSign={sign} signing={signing} problems={signProblems} />}
            </div>
          </section>

          {/* Right: decision support */}
          <aside className="hidden min-h-0 overflow-y-auto scroll-thin xl:block">
            <AssistRail />
          </aside>
        </div>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />

      <Modal
        open={consentAsk}
        onClose={() => setConsentAsk(false)}
        title="Record this consultation?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConsentAsk(false)}><LocalizedText message={"Don’t record"} /></Button>
            <Button
              variant="primary"
              onClick={() => {
                update((e) => ({ ...e, recording: { ...e.recording, consent: true, active: true } }));
                setConsentAsk(false);
                client.post(`/api/appointments/${encodeURIComponent(id)}/messages`, { from: "staff", author: "System", text: "You agreed to recording. This demo visit now shows a recording indicator and a simulated transcript." }).catch(() => {});
              }}
            >
              
              <LocalizedText message={"Patient agreed, start recording"} />
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          <LocalizedText message="{value0} didn’t give recording consent at check-in. Ask now and confirm their answer. The recording and transcript are stored with the note, and the patient sees a recording indicator in their app." values={{ value0: patient.firstName }} />
        </p>
      </Modal>
    </ConsultContext.Provider>
  );
}
