"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput, SourceTextarea } from "../../../shared/controls";
import { useMemo, useState } from "react";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { AlertTriangle, Check, Mic, MessageSquare, Star, Video } from "lucide-react";
import type { AppointmentView, Catalog, Staff, VisitMode } from "../../../shared/types";
import { useTeleconsultClient } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { usePatient } from "../../lib/session";
import { useBookingAdvice } from "../../lib/booking-advice";
import { isoDate, useTeleconsultFormat } from "../../lib/format";
import { Avatar, Button, Card, Chip, Header, Notice, Screen, cx } from "../../components/ui";

const MODE_CHOICES = [["video", "Video", Video], ["audio", "Phone", Mic], ["chat", "Chat", MessageSquare]] as const;

export default function Book() {
  const router = useRouter();
  const { t } = useLocalization();
  const client = useTeleconsultClient();
  const { fmtDay, fmtTime, fmtWeekday, number } = useTeleconsultFormat();
  const { patient, settings } = usePatient();
  const { data: catalog } = useApi<Catalog>("/api/catalog");
  const { data: doctors = [] } = useApi<Staff[]>("/api/staff?role=doctor");
  const [step, setStep] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState(4);
  const [doctor, setDoctor] = useState<Staff>();
  const [filter, setFilter] = useState<string>();
  const [date, setDate] = useState(isoDate(new Date()));
  const [slot, setSlot] = useState<string>();
  const [chosenMode, setMode] = useState<VisitMode>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const slots = useApi<{ start: string; available: boolean }[]>(doctor ? `/api/slots?clinicianId=${encodeURIComponent(doctor.id)}&date=${date}T12:00:00` : null);

  // Specialty suggestion and urgency come from the server for exactly these answers; until it has answered, there is none.
  const { advice, error: adviceError, loading: adviceLoading, retry: retryAdvice } = useBookingAdvice(patient?.id, symptoms, severity);
  const suggested = advice?.specialty;
  const spec = filter ?? suggested;
  // Visit modes are the branch's effective settings; a choice the settings no longer allow falls back to the first allowed one.
  const modes = settings?.modes ?? [];
  const mode = chosenMode && modes.includes(chosenMode) ? chosenMode : modes[0];
  // Different answers produce different advice: the old suggestion, chosen doctor and time no longer apply.
  const answersChanged = () => { setFilter(undefined); setDoctor(undefined); setSlot(undefined); };
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const available = slots.data?.filter((s) => s.available) ?? [];
  const reason = [symptoms.join(", "), details].filter(Boolean).join(". ");

  const book = async () => {
    if (!patient || !doctor || !slot || !advice || !mode) return;
    setSaving(true);
    setError(undefined);
    try {
      await client.post<AppointmentView>("/api/appointments", {
        patientId: patient.id,
        clinicianId: doctor.id,
        start: slot,
        mode,
        reason: reason || "General consultation",
        priority: advice.urgent ? "urgent" : "routine",
        createdBy: "patient",
        preVisit: { completed: false, symptoms, duration: "", severity, notes: details, shareDeviceData: true, recordingConsent: false, deviceCheck: { camera: false, mic: false, network: "good" } },
      });
      setStep(4);
    } catch (e) {
      setError((e as Error).message);
      slots.reload();
    } finally {
      setSaving(false);
    }
  };

  if (step === 4) {
    return (
      <Screen nav={false}>
        <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest text-sun animate-rise"><Check className="h-8 w-8" /></span>
          <h1 className="mt-5 text-2xl font-extrabold text-forest"><LocalizedText message={"You’re booked"} /></h1>
          <p className="mt-2 text-[15px] text-ink-600">{doctor?.name}, {slot && t("{value0} at {value1}", { value0: fmtDay(slot), value1: fmtTime(slot) })}.</p>
          <p className="mt-1 text-sm text-ink-400"><LocalizedText message={"Check in up to 15 minutes before. Reminders are not sent in this demo."} /></p>
          <Button block className="mt-8" onClick={() => router.push("/home")}><LocalizedText message={"Done"} /></Button>
        </main>
      </Screen>
    );
  }

  if (!settings?.allowPatientBooking) {
    return (
      <Screen>
        <Header back="/home" title="Book a visit" />
        <main className="px-4 py-6"><Notice><LocalizedText message={"Online booking is not available for this clinic. Please contact the clinic to book a visit."} /></Notice></main>
      </Screen>
    );
  }

  const titles = ["What’s bothering you?", "Choose a clinician", "Pick a time", "Check and confirm"];
  const canNext = [(symptoms.length > 0 || details.trim().length > 3) && !!advice, !!doctor, !!slot, true][step];

  return (
    <Screen nav={step === 0}>
      <Header back={step === 0 ? "/home" : undefined} title="Book a visit" right={<span className="text-sm text-ink-400 tabular">{t("{value0} of 4", { value0: step + 1 })}</span>} />
      {step > 0 && <SourceButton onClick={() => setStep(step - 1)} className="-mt-1 px-4 text-sm font-medium text-forest"><LocalizedText message={"Back"} /></SourceButton>}
      <main className="space-y-5 px-4 pb-32 pt-3">
        <h2 className="text-2xl font-bold text-forest">{t(titles[step])}</h2>

        {step === 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {catalog?.symptoms.map((s) => (
                <Chip key={s} selected={symptoms.includes(s)} onClick={() => { answersChanged(); setSymptoms((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s])); }}>{s}</Chip>
              ))}
            </div>
            {advice?.urgent && (
              <div className="flex gap-3 rounded-2xl bg-rose-50 p-3.5 text-sm text-rose-600">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p><b><LocalizedText message={"If the pain is severe or you can’t catch your breath, call your local emergency number now."} /></b>  <LocalizedText message={"Otherwise we’ll mark your visit as urgent."} /></p>
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-600"><LocalizedText message={"Anything else the doctor should know?"} /></span>
              <SourceTextarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="When it started, what makes it better or worse" className="w-full rounded-2xl border border-forest-100 bg-white p-3.5 text-[15px] focus:border-forest-500 focus:outline-none" />
            </label>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-600"><LocalizedText message={"How bad is it right now?"} /> <b className="text-forest tabular">{severity}/10</b></p>
              <SourceInput type="range" min={0} max={10} value={severity} onChange={(e) => { answersChanged(); setSeverity(Number(e.target.value)); }} className="w-full accent-forest" aria-label="Severity" />
              <div className="flex justify-between text-xs text-ink-400"><span><LocalizedText message={"Mild"} /></span><span><LocalizedText message={"Worst ever"} /></span></div>
            </div>
            {adviceError ? (
              <Notice tone="error">
                {adviceError} <SourceButton onClick={retryAdvice} className="font-semibold underline"><LocalizedText message={"Try again"} /></SourceButton>
              </Notice>
            ) : adviceLoading ? (
              <p role="status" className="text-sm text-ink-400"><LocalizedText message={"Checking your answers…"} /></p>
            ) : null}
          </>
        )}

        {step === 1 && (
          <>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {catalog?.specialties.map((s) => <Chip key={s} selected={spec === s} onClick={() => setFilter(s)}>{s === suggested ? t("{value0} · suggested", { value0: s }) : s}</Chip>)}
            </div>
            <p className="text-xs text-ink-400"><LocalizedText message={"The suggested specialty is demo advice from the demo API, not medical advice. You can choose any specialty."} /></p>
            <ul className="space-y-3">
              {doctors.filter((d) => d.specialty === spec).map((d) => (
                <li key={d.id}>
                  <SourceButton onClick={() => { setDoctor(d); setSlot(undefined); }} className={cx("w-full rounded-3xl border-2 bg-white p-4 text-left transition", doctor?.id === d.id ? "border-forest" : "border-transparent")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={d.name} color={d.color} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">{d.name}</p>
                        <p className="text-sm text-ink-600">{d.specialty} · {t("{value0} years", { value0: d.yearsExperience })}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-400"><Star className="h-3.5 w-3.5 fill-sun text-sun" /> {d.rating} · {t("speaks {value0}", { value0: d.languages.join(", ") })}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-ink-600">{d.bio}</p>
                  </SourceButton>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === 2 && doctor && (
          <>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {days.map((d) => {
                const iso = isoDate(d);
                return (
                  <SourceButton key={iso} onClick={() => { setDate(iso); setSlot(undefined); }} className={cx("flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5", date === iso ? "bg-forest text-white" : "bg-white text-ink")}>
                    <span className="text-xs opacity-80">{fmtWeekday(d, "short")}</span>
                    <span className="text-xl font-bold tabular">{number(d.getDate())}</span>
                  </SourceButton>
                );
              })}
            </div>
            <p className="text-sm font-medium text-ink-600">{fmtDay(date, "long")}</p>
            {slots.loading ? (
              <p className="py-6 text-center text-sm text-ink-400"><LocalizedText message={"Finding times…"} /></p>
            ) : available.length ? (
              <div className="grid grid-cols-3 gap-2">
                {available.map((s) => (
                  <SourceButton key={s.start} onClick={() => setSlot(s.start)} className={cx("rounded-2xl py-3 text-[15px] font-semibold tabular", slot === s.start ? "bg-forest text-white" : "bg-white text-ink")}>{fmtTime(s.start)}</SourceButton>
                ))}
              </div>
            ) : (
              <Notice>{t("No times left this day with {value0}. Try another day.", { value0: doctor.name })}</Notice>
            )}
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-600"><LocalizedText message={"How would you like to talk?"} /></p>
              <div className="grid grid-cols-3 gap-2">
                {MODE_CHOICES.filter(([m]) => modes.includes(m)).map(([m, l, Icon]) => (
                  <SourceButton key={m} onClick={() => setMode(m)} className={cx("flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-medium", mode === m ? "bg-forest text-white" : "bg-white text-ink")}>
                    <Icon className="h-5 w-5" /> {t(l)}
                  </SourceButton>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && doctor && slot && (
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={doctor.name} color={doctor.color} size={48} />
              <div>
                <p className="font-bold text-ink">{doctor.name}</p>
                <p className="text-sm text-ink-600">{doctor.specialty}</p>
              </div>
            </div>
            <dl className="space-y-3 text-[15px]">
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"When"} /></dt><dd className="font-medium text-ink">{fmtDay(slot)}, {fmtTime(slot)}</dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Type"} /></dt><dd className="font-medium capitalize text-ink">{t("{value0} visit", { value0: t(mode === "audio" ? "Phone" : mode === "video" ? "Video" : "Chat") })}</dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Priority"} /></dt><dd className="font-medium text-ink">{advice?.urgent ? t("Urgent") : t("Routine")} <span className="text-xs font-normal text-ink-400">· <LocalizedText message={"Demo advice, not medical advice"} /></span></dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Reason"} /></dt><dd className="font-medium text-ink">{reason || t("General consultation")}</dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Cover"} /></dt><dd className="font-medium text-ink">{patient?.insurance.payer}</dd></div>
            </dl>
            {error && <Notice tone="error">{error}</Notice>}
          </Card>
        )}
      </main>

      <div className={cx("fixed inset-x-0 mx-auto max-w-md bg-mint/95 px-4 pb-5 pt-3 backdrop-blur", step === 0 ? "bottom-[64px]" : "bottom-0")}>
        {step < 3 ? (
          <Button block disabled={!canNext} onClick={() => setStep(step + 1)}><LocalizedText message={"Continue"} /></Button>
        ) : (
          <Button block variant="sun" loading={saving} disabled={!advice || !mode} onClick={book}><LocalizedText message={"Confirm booking"} /></Button>
        )}
      </div>
    </Screen>
  );
}
