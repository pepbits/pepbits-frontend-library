"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../shared/controls";
import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import type { AppointmentView, Patient, Staff, VisitMode } from "../../shared/types";
import { bookableDurations } from "../../shared/contract";
import { useTeleconsultClient } from "../lib/api";
import { useApi, useDebounced } from "../lib/hooks";
import { useSession } from "../lib/session";
import { age, fullName, isoDate, sexShort, useTeleconsultFormat } from "../lib/format";
import { Avatar, Button, DateInput, Field, Input, Modal, Segmented, Select, cx, useToast } from "./ui";
import { RegisterPatientDrawer } from "./RegisterPatientDrawer";

const MODE_OPTIONS: { value: VisitMode; label: string }[] = [{ value: "video", label: "Video" }, { value: "audio", label: "Audio" }, { value: "chat", label: "Chat" }];

export function BookingDialog({
  open,
  onClose,
  onBooked,
  patient: presetPatient,
  date: presetDate,
}: {
  open: boolean;
  onClose: () => void;
  onBooked?: (a: AppointmentView) => void;
  patient?: Patient;
  date?: string;
}) {
  const toast = useToast();
  const { t } = useLocalization();
  const client = useTeleconsultClient();
  const { fmtTime } = useTeleconsultFormat();
  const { user, canRegister, settings } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const [patient, setPatient] = useState<Patient | undefined>(presetPatient);
  const [clinicianId, setClinicianId] = useState("");
  const [date, setDate] = useState(presetDate ?? isoDate(new Date()));
  const [slot, setSlot] = useState<string>();
  const [chosenMode, setMode] = useState<VisitMode>();
  const [chosenDuration, setDuration] = useState<number>();
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [registering, setRegistering] = useState(false);
  // Visit modes and lengths are the branch's effective settings, never a fixed list.
  const modes = settings.modes;
  const mode = chosenMode && modes.includes(chosenMode) ? chosenMode : modes[0];
  const durations = useMemo(() => bookableDurations(settings.scheduling), [settings.scheduling]);
  const durationMin = chosenDuration && durations.includes(chosenDuration) ? chosenDuration : settings.scheduling.defaultDurationMin;

  useEffect(() => {
    if (open) {
      setPatient(presetPatient);
      setSlot(undefined);
      setReason("");
      if (presetDate) setDate(presetDate);
    }
  }, [open, presetPatient, presetDate]);

  const patients = useApi<Patient[]>(open && !patient ? `/api/patients?q=${encodeURIComponent(dq)}` : null);
  const { data: doctors = [] } = useApi<Staff[]>(open ? "/api/staff?role=doctor" : null);
  // The clinician comes from the server's staff list (the signed-in doctor when there is one), never a fixed fixture id.
  useEffect(() => {
    if (clinicianId || !doctors.length) return;
    setClinicianId(doctors.find((d) => d.id === user?.id)?.id ?? doctors[0].id);
  }, [clinicianId, doctors, user?.id]);
  const slots = useApi<{ start: string; available: boolean }[]>(open && clinicianId ? `/api/slots?clinicianId=${encodeURIComponent(clinicianId)}&date=${date}T12:00:00&durationMin=${durationMin}` : null);

  const book = async () => {
    if (!patient || !slot || !reason.trim() || !clinicianId) return;
    setSaving(true);
    try {
      const a = await client.post<AppointmentView>("/api/appointments", { patientId: patient.id, clinicianId, start: slot, durationMin, mode, priority, reason, createdBy: "staff" });
      toast(t("Booked {value0} at {value1}. The patient app shows it now.", { value0: fullName(patient), value1: fmtTime(slot) }));
      onBooked?.(a);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
      slots.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Book a teleconsultation"
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              
              <LocalizedText message={"Cancel"} />
            </Button>
            <Button variant="primary" onClick={book} loading={saving} disabled={!patient || !slot || !reason.trim() || !clinicianId || !mode}>
              
              <LocalizedText message={"Book visit"} />
            </Button>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Patient">
              {patient ? (
                <div className="flex items-center gap-3 rounded-md border border-line p-2.5">
                  <Avatar name={fullName(patient)} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{fullName(patient)}</p>
                    <p className="text-xs text-ink-400 tabular">
                      {age(patient.dob)}
                      {sexShort(patient.sex)} · {patient.mrn} · {patient.phone}
                    </p>
                  </div>
                  {!presetPatient && (
                    <Button size="sm" variant="ghost" onClick={() => setPatient(undefined)}>
                      
                      <LocalizedText message={"Change"} />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-line">
                  <div className="relative border-b border-line">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
                    <SourceInput
                      autoFocus
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Name, MRN or phone"
                      className="h-9 w-full rounded-t-md pl-8 pr-2 text-sm focus:outline-none"
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto scroll-thin">
                    {patients.data?.slice(0, 8).map((p) => (
                      <li key={p.id}>
                        <SourceButton onClick={() => setPatient(p)} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-canvas">
                          <Avatar name={fullName(p)} size={26} />
                          <span className="text-sm text-ink">{fullName(p)}</span>
                          <span className="ml-auto text-2xs text-ink-400 tabular">{p.mrn}</span>
                        </SourceButton>
                      </li>
                    ))}
                  </ul>
                  {canRegister && (
                    <SourceButton onClick={() => setRegistering(true)} className="flex w-full items-center gap-2 border-t border-line px-2.5 py-2 text-sm font-medium text-pulse-600 hover:bg-pulse-50">
                      <UserPlus className="h-4 w-4" />  <LocalizedText message={"Register a new patient"} />
                    </SourceButton>
                  )}
                </div>
              )}
            </Field>
            <Field label="Reason for visit">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cough and fever for 3 days" />
            </Field>
            <div className="flex flex-wrap gap-4">
              <Field label="Visit type">
                <Segmented value={mode} onChange={setMode} options={MODE_OPTIONS.filter((o) => modes.includes(o.value))} />
              </Field>
              <Field label="Duration">
                <Select value={durationMin} onChange={(e) => { setDuration(Number(e.target.value)); setSlot(undefined); }}>
                  {durations.map((d) => <option key={d} value={d}>{t("{value0} min", { value0: d })}</option>)}
                </Select>
              </Field>
              <Field label="Priority">
                <Segmented value={priority} onChange={setPriority} options={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }]} />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Clinician">
                <Select value={clinicianId} onChange={(e) => { setClinicianId(e.target.value); setSlot(undefined); }}>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.specialty}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date">
                <DateInput value={date} min={isoDate(new Date())} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setSlot(undefined); } }} />
              </Field>
            </div>
            <Field label="Available times">
              <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto pr-1 scroll-thin sm:grid-cols-5">
                {slots.data?.map((s) => (
                  <SourceButton
                    key={s.start}
                    disabled={!s.available}
                    onClick={() => setSlot(s.start)}
                    className={cx(
                      "rounded-md border py-1.5 text-xs font-medium tabular transition-colors",
                      slot === s.start ? "border-pulse-500 bg-pulse-500 text-white" : s.available ? "border-line text-ink hover:border-pulse-500" : "border-transparent bg-canvas text-ink-200 line-through",
                    )}
                  >
                    {fmtTime(s.start)}
                  </SourceButton>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Modal>
      <RegisterPatientDrawer
        open={registering}
        onClose={() => setRegistering(false)}
        onCreated={(p) => {
          setPatient(p);
          setRegistering(false);
        }}
      />
    </>
  );
}
