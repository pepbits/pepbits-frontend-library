"use client";
import {SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarCheck, CircleCheck, Clock, Mail, MessageCircle, MessageSquare, RotateCcw, UserRound, MapPin, ClipboardList } from "lucide-react";
import {useSourceApi, ApiError } from "../../lib/api";
import {CATEGORY_LABEL,SOURCES,VISIT_TYPES,age,duration,useMedslotFormat} from "../../lib/format";
import type { Appointment, Channel, Patient, Service, ServiceDetail, Slot } from "../../lib/types";
import { CategoryIcon } from "../icons";
import { Badge, Button, Field, Input, Segmented, Select, Textarea, cx , DateTimeInput} from "../ui";
import { useToast } from "../toast";
import { PatientPicker } from "./PatientPicker";
import { ServiceFinder } from "./ServiceFinder";
import { SlotPicker } from "./SlotPicker";

export interface BookingPrefill { patient?: Patient; serviceId?: number; resourceId?: number; date?: string; startAt?: string }

type Details = {
  reason: string; visit_type: string; priority: "routine" | "urgent" | "emergency"; source: string; notes: string;
  referral_source: string; order_ref: string; preferred_at: string; status: "scheduled" | "confirmed" | "requested"; channels: Channel[];
};

export function BookingFlow({ prefill, compact, onBooked }: { prefill?: BookingPrefill; compact?: boolean; onBooked?: (a: Appointment) => void }) {
  const { fmtDateTime, fmtLongDay, fmtTime } = useMedslotFormat();
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const [patient, setPatient] = useState<Patient | null>(prefill?.patient ?? null);
  const [kind, setKind] = useState<"new" | "existing">(prefill?.patient?.is_provisional ? "new" : "existing");
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [resourceId, setResourceId] = useState<number | undefined>(prefill?.resourceId);
  const [dur, setDur] = useState<number | undefined>();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [d, setD] = useState<Details>({ reason: "", visit_type: "new_visit", priority: "routine", source: "front_desk", notes: "", referral_source: "", order_ref: "", preferred_at: "", status: "scheduled", channels: ["sms", "email"] });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Appointment | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const pickService = async (s: Service, rid?: number) => {
    const full = await api<ServiceDetail>(`/services/${s.id}`);
    setService(full); setSlot(null); setDur(undefined); setEditing(null);
    if (rid !== undefined && full.resources.some((r) => r.id === rid && r.resource_type_id === full.requirements[0]?.resource_type_id)) setResourceId(rid);
    else if (rid === undefined) setResourceId(undefined);
  };

  useEffect(() => { if (prefill?.serviceId) api<Service>(`/services/${prefill.serviceId}`).then((s) => pickService(s, prefill.resourceId)).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Default channels follow what the patient has opted into.
  useEffect(() => {
    if (!patient) return;
    const ch: Channel[] = [];
    if (patient.sms_opt_in) ch.push("sms");
    if (patient.email_opt_in && patient.email) ch.push("email");
    if (patient.whatsapp_opt_in) ch.push("whatsapp");
    setD((x) => ({ ...x, channels: ch, visit_type: kind === "new" ? "new_visit" : x.visit_type === "new_visit" ? "follow_up" : x.visit_type }));
  }, [patient, kind]);

  const step = editing ?? (!patient ? 1 : !service ? 2 : !slot ? 3 : 4);
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((x) => ({ ...x, [k]: v }));
  const fe = err?.fields ?? {};

  const book = async () => {
    if (!patient || !service || !slot) return;
    setBusy(true); setErr(null);
    try {
      const a = await api<Appointment>("/appointments", { method: "POST", json: {
        patient_id: patient.id, patient_kind: kind, service_id: service.id, start_at: slot.start, duration_minutes: dur,
        resources: slot.resources.map((r) => ({ resource_id: r.id, role: r.role })),
        reason: d.reason, visit_type: d.visit_type, priority: d.priority, source: d.source, notes: d.notes || null,
        referral_source: d.referral_source || null, order_ref: d.order_ref || null, preferred_at: d.preferred_at || null,
        notify_channels: d.channels, status: d.status,
      } });
      setDone(a);
      toast.success("Appointment booked", `${a.ref_code} for ${fmtDateTime(a.start_at)}`);
      onBooked?.(a);
    } catch (e) {
      const ae = e as ApiError;
      setErr(ae);
      if (ae.status === 409) { setSlot(null); setRefresh((r) => r + 1); setEditing(null); toast.error(ae, "That time was just taken"); }
    } finally { setBusy(false); }
  };

  const reset = (keepPatient: boolean) => {
    setDone(null); setService(null); setSlot(null); setDur(undefined); setResourceId(undefined); setErr(null); setEditing(null);
    setD((x) => ({ ...x, reason: "", notes: "", referral_source: "", order_ref: "", preferred_at: "" }));
    if (!keepPatient) setPatient(null);
  };

  if (done) return <Booked a={done} onAgain={() => reset(true)} onNew={() => reset(false)} compact={compact} />;

  return (
    <div className={cx("grid gap-5", !compact && "grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_340px]")}>
      <div className="flex min-w-0 flex-col gap-3">
        <Step n={1} title="Patient" active={step === 1} done={!!patient} onEdit={() => setEditing(1)}
          summary={patient && <PatientSummary p={patient} kind={kind} />}>
          <PatientPicker onPick={(p, k) => { setPatient(p); setKind(k); setEditing(null); }} />
        </Step>

        <Step n={2} title="Service" active={step === 2} done={!!service} onEdit={() => setEditing(2)} locked={!patient}
          summary={service && <span className="flex items-center gap-2"><CategoryIcon category={service.category} className="size-4 text-mute" /><strong>{service.name}</strong><span className="text-mute">{service.department_name}</span></span>}>
          <ServiceFinder onPick={pickService} lockResourceId={prefill?.resourceId} />
        </Step>

        <Step n={3} title="Date and time" active={step === 3} done={!!slot} onEdit={() => setEditing(3)} locked={!service}
          summary={slot && <span><strong className="tabular">{fmtLongDay(slot.start.slice(0, 10))}, {fmtTime(slot.start)}–{fmtTime(slot.end)}</strong> <span className="text-mute"><LocalizedText message={"with {value0}"} values={{ value0: (slot.resources.map((r) => r.name).join(", ")) ?? "" }} /></span></span>}>
          {service && (
            <SlotPicker serviceId={service.id} value={slot} onChange={(s) => { setSlot(s); if (s) setEditing(null); }}
              resourceId={resourceId} onResourceChange={(id) => { setResourceId(id); setSlot(null); }}
              durationMinutes={dur} onDurationChange={(m) => { setDur(m); setSlot(null); }}
              initialDate={prefill?.date ?? prefill?.startAt?.slice(0, 10)} refreshKey={refresh} autoSelect={prefill?.startAt} />
          )}
        </Step>

        <Step n={4} title="Visit details" active={step === 4} locked={!slot}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reason for visit" required error={fe.reason} className="sm:col-span-2" hint="What the patient wants help with, in their words">
              <Textarea value={d.reason} onChange={(e) => set("reason", e.target.value)} invalid={!!fe.reason} rows={2} placeholder="e.g. Chest pain when climbing stairs for 2 weeks" data-autofocus />
            </Field>
            <Field label="Visit type" required>
              <Select value={d.visit_type} onChange={(e) => set("visit_type", e.target.value)}>{VISIT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Booked via" required>
              <Select value={d.source} onChange={(e) => set("source", e.target.value)}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="Priority" className="sm:col-span-2">
              <Segmented value={d.priority} onChange={(v) => set("priority", v)} options={[["routine", "Routine"], ["urgent", "Urgent"], ["emergency", "Emergency"]]} />
            </Field>
            {service?.requires_order && (
              <Field label="Doctor's order reference" required error={fe.order_ref} hint="Labs and imaging need a signed order">
                <Input value={d.order_ref} onChange={(e) => set("order_ref", e.target.value)} placeholder="ORD-12345" />
              </Field>
            )}
            {service?.requires_referral && (
              <Field label="Referred by" required error={fe.referral_source}>
                <Input value={d.referral_source} onChange={(e) => set("referral_source", e.target.value)} placeholder="Referring doctor or clinic" />
              </Field>
            )}
            <Field label="Time the patient asked for" hint="Helps measure how well we meet requests">
              <DateTimeInput value={d.preferred_at} onChange={(e) => set("preferred_at", e.target.value)} />
            </Field>
            <Field label="Booking status">
              <Select value={d.status} onChange={(e) => set("status", e.target.value as Details["status"])}>
                <option value="scheduled"><LocalizedText message="Scheduled" /></option><option value="confirmed"><LocalizedText message="Confirmed with patient" /></option><option value="requested"><LocalizedText message="Requested (needs approval)" /></option>
              </Select>
            </Field>
            <Field label="Notes for staff" className="sm:col-span-2">
              <Textarea value={d.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Wheelchair, interpreter, allergies to flag at the desk…" />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-[13px] font-medium text-ink-2"><LocalizedText message="Send booking updates by" /></p>
              <div className="flex flex-wrap gap-2">
                {([["sms", "SMS", MessageSquare, patient?.sms_opt_in], ["email", "Email", Mail, patient?.email_opt_in && !!patient?.email], ["whatsapp", "WhatsApp", MessageCircle, patient?.whatsapp_opt_in]] as const).map(([c, l, I, ok]) => {
                  const on = d.channels.includes(c);
                  return (
                    <SourceButton key={c} type="button" disabled={!ok} aria-pressed={on} onClick={() => set("channels", on ? d.channels.filter((x) => x !== c) : [...d.channels, c])}
                      title={ok ? undefined : tr("Patient hasn't opted in or has no contact for this channel")}
                      className={cx("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-40",
                        on ? "border-scrub bg-scrub-soft text-scrub-dark" : "border-line bg-panel text-ink-2")}>
                      <I className="size-4" />{l}
                    </SourceButton>
                  );
                })}
              </div>
            </div>
          </div>
          {err && err.status !== 409 && !Object.keys(fe).length && <p className="mt-4 rounded-lg bg-triage-soft px-3 py-2 text-sm text-triage">{err.message}</p>}
          {compact && <div className="mt-5 flex justify-end"><Button variant="primary" loading={busy} onClick={book} icon={<CalendarCheck className="size-4" />}><LocalizedText message="Book appointment" /></Button></div>}
        </Step>
      </div>

      {!compact && (
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Summary patient={patient} kind={kind} service={service} slot={slot} dur={dur} canBook={!!(patient && service && slot && d.reason.trim().length >= 3)} busy={busy} onBook={book} />
        </aside>
      )}
    </div>
  );
}

function Step({ n, title, active, done, locked, summary, onEdit, children }: { n: number; title: string; active: boolean; done?: boolean; locked?: boolean; summary?: ReactNode; onEdit?: () => void; children: ReactNode }) {
  return (
    <section className={cx("rounded-xl border bg-panel transition-colors", active ? "border-ink/20 shadow-sm" : "border-line", locked && !active && "opacity-60")} aria-current={active ? "step" : undefined}>
      <header className={cx("flex items-center gap-3 px-4", active ? "pt-4 pb-3" : "py-3")}>
        <span className={cx("tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done && !active ? "bg-scrub text-white" : active ? "bg-ink text-white" : "bg-line-2 text-mute")}>
          {done && !active ? <CircleCheck className="size-4" /> : n}
        </span>
        <h2 className="shrink-0 text-[15px] font-semibold">{title}</h2>
        {!active && summary && <div className="min-w-0 flex-1 truncate text-sm">{summary}</div>}
        {!active && done && onEdit && <SourceButton onClick={onEdit} className="ml-auto shrink-0 text-sm font-medium text-scrub hover:underline"><LocalizedText message="Change" /></SourceButton>}
      </header>
      {active && <div className="border-t border-line-2 px-4 py-4">{children}</div>}
    </section>
  );
}

const PatientSummary = ({ p, kind }: { p: Patient; kind: "new" | "existing" }) => {
  const { t: tr } = useLocalization(); return (
  <span className="flex items-center gap-2">
    <strong>{p.first_name} {p.last_name}</strong>
    <span className="tabular text-mute">{p.mrn}</span>
    <Badge tone={kind === "new" ? "amber" : "green"}>{kind === "new" ? tr("New patient") : tr("Existing")}</Badge>
  </span>
); };

function Summary({ patient, kind, service, slot, dur, canBook, busy, onBook }: { patient: Patient | null; kind: string; service: ServiceDetail | null; slot: Slot | null; dur?: number; canBook: boolean; busy: boolean; onBook: () => void }) {
  const { fmtLongDay, fmtTime } = useMedslotFormat();
  const { t: tr } = useLocalization();
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="bg-ink px-4 py-4 text-white">
        <p className="text-xs text-white/60"><LocalizedText message="Appointment" /></p>
        <p className="mt-1 text-lg font-semibold leading-snug">{slot ? fmtLongDay(slot.start.slice(0, 10)) : tr("Pick a time")}</p>
        {slot && <p className="tabular text-2xl font-semibold text-[#7fe0c9]">{fmtTime(slot.start)}<span className="text-base text-white/50"> <LocalizedText message={"to {value0}"} values={{ value0: (fmtTime(slot.end)) ?? "" }} /></span></p>}
      </div>
      <dl className="flex flex-col divide-y divide-line-2 text-sm">
        <Row icon={<UserRound className="size-4" />} label="Patient">
          {patient ? <>{patient.first_name} {patient.last_name}<span className="block text-xs text-mute">{patient.mrn}{patient.dob ? `, ${age(patient.dob)} y` : ""}, {kind === "new" ? tr("new patient") : tr("existing patient")}</span></> : <span className="text-mute"><LocalizedText message="Not chosen" /></span>}
        </Row>
        <Row icon={<ClipboardList className="size-4" />} label="Service">
          {service ? <>{service.name}<span className="block text-xs text-mute">{CATEGORY_LABEL[service.category]}, {service.department_name}</span></> : <span className="text-mute"><LocalizedText message="Not chosen" /></span>}
        </Row>
        <Row icon={<Clock className="size-4" />} label="Length">{service ? duration(dur ?? service.duration_minutes) : "–"}{service?.buffer_minutes ? <span className="block text-xs text-mute"><LocalizedText message={"+{value0} min turnover after"} values={{ value0: (service.buffer_minutes) ?? "" }} /></span> : null}</Row>
        <Row icon={<MapPin className="size-4" />} label="With">
          {slot ? slot.resources.map((r) => <span key={r.id} className="block">{r.name} <span className="text-xs text-mute">{r.role}</span></span>) : <span className="text-mute">–</span>}
        </Row>
      </dl>
      {service?.prep_instructions && <div className="mx-4 mb-3 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber"><strong className="block"><LocalizedText message="Preparation" /></strong>{service.prep_instructions}</div>}
      <div className="border-t border-line-2 p-4">
        <Button variant="primary" className="h-11 w-full" disabled={!canBook} loading={busy} onClick={onBook} icon={<CalendarCheck className="size-4" />}><LocalizedText message="Book appointment" /></Button>
        {!canBook && slot && <p className="mt-2 text-center text-xs text-mute"><LocalizedText message="Add the reason for visit to book." /></p>}
      </div>
    </div>
  );
}

const Row = ({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) => (
  <div className="flex gap-3 px-4 py-3"><span className="mt-0.5 text-mute">{icon}</span><div className="min-w-0 flex-1"><dt className="sr-only">{label}</dt><dd>{children}</dd></div></div>
);

function Booked({ a, onAgain, onNew, compact }: { a: Appointment; onAgain: () => void; onNew: () => void; compact?: boolean }) {
  const { fmtLongDay, fmtTime } = useMedslotFormat();
  const { t: tr } = useLocalization();
  return (
    <div className={cx("mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-line bg-panel px-6 py-10 text-center animate-pop-in", compact && "border-0 py-6")}>
      <span className="flex size-14 items-center justify-center rounded-full bg-scrub-soft text-scrub"><CalendarCheck className="size-7" /></span>
      <div>
        <p className="text-sm text-mute"><LocalizedText message={"Booked for {value0} {value1}"} values={{ value0: (a.first_name) ?? "", value1: (a.last_name) ?? "" }} /></p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{fmtLongDay(a.start_at.slice(0, 10))}</p>
        <p className="tabular text-lg text-scrub"><LocalizedText message={"{value0} to {value1}"} values={{ value0: (fmtTime(a.start_at)) ?? "", value1: (fmtTime(a.end_at)) ?? "" }} /></p>
      </div>
      <div className="w-full rounded-xl bg-paper px-4 py-3 text-sm">
        <p><strong>{a.service_name}</strong> {" "}<LocalizedText message={"with {value0}"} values={{ value0: (a.resources.map((r) => r.name).join(", ")) ?? "" }} /></p>
        <p className="mt-1 text-mute"><LocalizedText message="Reference" />{" "}<span className="tabular font-semibold text-ink">{a.ref_code}</span><LocalizedText message=". The patient will get updates by" />{" "}{a.notify_channels.split(",").filter(Boolean).join(", ") || tr("no channel")}.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={onAgain} icon={<RotateCcw className="size-4" />}><LocalizedText message={"Book another for {value0}"} values={{ value0: (a.first_name) ?? "" }} /></Button>
        <Button onClick={onNew}><LocalizedText message="New booking" /></Button>
        {!compact && <Link href={`/calendar?date=${a.start_at.slice(0, 10)}&resource_ids=${a.resources.map((r) => r.id).join(",")}`}><Button variant="ghost"><LocalizedText message="See in calendar" /></Button></Link>}
      </div>
    </div>
  );
}
