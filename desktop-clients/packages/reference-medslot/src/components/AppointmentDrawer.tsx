"use client";
import {SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Ban, Check, Clock, LogIn, Mail, MessageCircle, MessageSquare, Play, Timer, UserRound, CircleCheck, CalendarX } from "lucide-react";
import {useSourceApi, ApiError } from "../lib/api";
import { useApi } from "../lib/hooks";
import {CATEGORY_LABEL,STATUS,STATUS_ACTION,SOURCES,VISIT_TYPES,age,diffMinutes,duration,titleCase,useMedslotFormat} from "../lib/format";
import type { AppointmentDetail, Slot, Status } from "../lib/types";
import { Badge, Button, Drawer, ErrorNote, Field, Modal, Skeleton, StatusBadge, Textarea, cx } from "./ui";
import { useToast } from "./toast";
import { useAuth } from "./shell/auth";
import { SlotPicker } from "./booking/SlotPicker";

const ACTION_ICON: Partial<Record<Status, typeof Check>> = { scheduled: Check, confirmed: Check, checked_in: LogIn, in_progress: Play, completed: CircleCheck, no_show: CalendarX, cancelled: Ban };

export function AppointmentDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged?: (newId?: number) => void }) {
  const { fmtDateTime, fmtLongDay, fmtTime } = useMedslotFormat();
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const { data: a, error, loading, reload, setData } = useApi<AppointmentDetail>(id ? `/appointments/${id}` : null);
  const { can, settings } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [lenOpen, setLenOpen] = useState(false);

  useEffect(() => { setCancelOpen(false); setMoveOpen(false); setLenOpen(false); }, [id]);

  const move = async (to: Status, note?: string) => {
    if (!a) return;
    setBusy(to);
    try {
      await api(`/appointments/${a.id}/status`, { method: "POST", json: { status: to, note } });
      toast.success(`${STATUS[to].label}`, `${a.ref_code}, ${a.first_name} ${a.last_name}`);
      await reload(); onChanged?.();
      setCancelOpen(false);
    } catch (e) { toast.error(e); } finally { setBusy(null); }
  };

  const staff = can("admin", "scheduler");
  // Mirror server rules so we never offer a button that would be refused.
  const now = settings.facility_now;
  const actions = (a?.allowed ?? []).filter((s) => s !== "cancelled" && (staff || !["confirmed", "scheduled"].includes(s))
    && !(s === "checked_in" && a!.start_at.slice(0, 10) !== now.slice(0, 10))
    && !(s === "no_show" && now < a!.start_at));
  const changeable = a && ["requested", "scheduled", "confirmed"].includes(a.status);
  const live = a && ["checked_in", "in_progress"].includes(a.status);

  return (
    <Drawer open={id !== null} onClose={onClose} width="max-w-lg"
      title={a ? <span className="flex items-center gap-2">{a.first_name} {a.last_name}<StatusBadge status={a.status} /></span> : tr("Appointment")}
      subtitle={a && <span className="tabular"><LocalizedText message={"{value0}, booked {value1}"} values={{ value0: (a.ref_code) ?? "", value1: (fmtDateTime(a.requested_at)) ?? "" }} />{a.booked_by_name ? tr(" by {value0}", { value0: (a.booked_by_name) ?? "" }) : ""}</span>}
      footer={a && (actions.length || a.allowed.includes("cancelled")) ? (
        <div className="flex w-full flex-wrap items-center gap-2">
          {a.allowed.includes("cancelled") && staff && <Button variant="ghost" className="text-triage" onClick={() => setCancelOpen(true)} icon={<Ban className="size-4" />}><LocalizedText message="Cancel" /></Button>}
          <div className="ml-auto flex flex-wrap gap-2">
            {actions.map((s, i) => {
              const I = ACTION_ICON[s] ?? Check;
              return <Button key={s} variant={i === 0 ? "primary" : "secondary"} loading={busy === s} onClick={() => move(s)} icon={<I className="size-4" />}>{STATUS_ACTION[s] ?? STATUS[s].label}</Button>;
            })}
          </div>
        </div>
      ) : undefined}>
      {loading && !a ? <div className="flex flex-col gap-3"><Skeleton className="h-24" /><Skeleton className="h-40" /><Skeleton className="h-32" /></div> : error ? <ErrorNote error={error} onRetry={reload} /> : a && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl bg-paper p-4">
            <p className="text-sm text-mute">{fmtLongDay(a.start_at.slice(0, 10))}</p>
            <p className="tabular text-2xl font-semibold tracking-tight">{fmtTime(a.start_at)} <span className="text-mute"><LocalizedText message="to" /></span> {fmtTime(a.end_at)}</p>
            <p className="mt-1 text-sm"><strong>{a.service_name}</strong> <span className="text-mute">{CATEGORY_LABEL[a.service_category]}, {a.department_name}</span></p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.resources.map((r) => <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-2.5 py-1 text-xs"><span className="text-mute">{r.role}</span>{r.name}</span>)}
            </div>
            {(changeable || live) && staff && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                {changeable && <Button size="sm" onClick={() => setMoveOpen(true)} icon={<ArrowRightLeft className="size-3.5" />}><LocalizedText message="Reschedule" /></Button>}
                <Button size="sm" onClick={() => setLenOpen(true)} icon={<Timer className="size-3.5" />}><LocalizedText message={"Change length ({value0})"} values={{ value0: (duration(diffMinutes(a.start_at, a.end_at))) ?? "" }} /></Button>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item label="Patient"><Link href={`/patients/${a.patient_id}`} className="inline-flex items-center gap-1 font-medium text-scrub hover:underline"><UserRound className="size-3.5" />{a.first_name} {a.last_name}</Link>
              <span className="block tabular text-xs text-mute">{a.mrn}{a.dob ? `, ${age(a.dob)} y` : ""}{a.sex && a.sex !== "unknown" ? `, ${a.sex}` : ""}</span></Item>
            <Item label="Patient type"><Badge tone={a.patient_kind === "new" ? "amber" : "green"}>{a.patient_kind === "new" ? tr("New patient") : tr("Existing patient")}</Badge>{a.is_provisional && <span className="mt-1 block text-xs text-amber"><LocalizedText message="Registration incomplete" /></span>}</Item>
            <Item label="Reason for visit" wide>{a.reason}</Item>
            <Item label="Visit type">{VISIT_TYPES.find(([v]) => v === a.visit_type)?.[1] ?? titleCase(a.visit_type)}</Item>
            <Item label="Priority"><span className={cx(a.priority !== "routine" && "font-semibold text-triage")}>{titleCase(a.priority)}</span></Item>
            <Item label="Booked via">{SOURCES.find(([v]) => v === a.source)?.[1] ?? a.source}</Item>
            <Item label="Patient asked for">{a.preferred_at ? fmtDateTime(a.preferred_at) : tr("Not recorded")}</Item>
            {a.order_ref && <Item label="Order reference"><span className="tabular">{a.order_ref}</span></Item>}
            {a.referral_source && <Item label="Referred by">{a.referral_source}</Item>}
            {a.notes && <Item label="Staff notes" wide>{a.notes}</Item>}
            {a.cancel_reason && <Item label="Cancellation reason" wide><span className="text-triage">{a.cancel_reason}</span></Item>}
            {a.rescheduled_to_id && <Item label="Moved to" wide><SourceButton className="font-medium text-scrub hover:underline" onClick={() => onChanged?.(a.rescheduled_to_id!)}><LocalizedText message="View new appointment" /></SourceButton></Item>}
            {a.rescheduled_from_id && <Item label="Moved from" wide><SourceButton className="font-medium text-scrub hover:underline" onClick={() => onChanged?.(a.rescheduled_from_id!)}><LocalizedText message="View original appointment" /></SourceButton></Item>}
          </dl>

          <section>
            <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="History" /></h3>
            <ol className="relative ml-1.5 border-l border-line pl-4">
              {a.events.map((e) => (
                <li key={e.id} className="relative pb-3 last:pb-0">
                  <span className={cx("absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-panel", STATUS[e.to_status]?.dot ?? "bg-mute")} />
                  <p className="text-sm"><strong>{e.from_status === e.to_status ? tr("Updated") : STATUS[e.to_status]?.label}</strong>{e.note && <span className="text-ink-2">: {e.note}</span>}</p>
                  <p className="text-xs text-mute"><LocalizedText message={"{value0} UTC"} values={{ value0: (e.created_at.replace(" ", ", ")) ?? "" }} />{e.user_name ? `, ${e.user_name}` : ""}</p>
                </li>
              ))}
            </ol>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-mute sm:grid-cols-3">
              {([["Confirmed", a.confirmed_at], ["Checked in", a.checked_in_at], ["Started", a.started_at], ["Completed", a.completed_at], ["No-show", a.no_show_at], ["Cancelled", a.cancelled_at]] as const)
                .filter(([, v]) => v).map(([l, v]) => <span key={l}><span className="block">{l}</span><span className="tabular text-ink">{fmtDateTime(v!)}</span></span>)}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Messages to patient" /></h3>
            {a.notifications.length === 0 ? <p className="text-sm text-mute"><LocalizedText message="No messages sent yet." /></p> : (
              <ul className="flex flex-col gap-1.5">
                {a.notifications.map((n) => {
                  const I = n.channel === "email" ? Mail : n.channel === "sms" ? MessageSquare : MessageCircle;
                  return (
                    <li key={n.id} className="flex items-center gap-2 text-sm">
                      <I className="size-4 text-mute" /><span className="capitalize">{titleCase(n.event)}</span>
                      <span className="text-xs text-mute">{n.channel}</span>
                      <Badge className="ml-auto" tone={n.status === "sent" ? "green" : n.status === "failed" ? "red" : n.status === "queued" ? "blue" : "neutral"}>{titleCase(n.status)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {a && <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} busy={busy === "cancelled"} onConfirm={(r) => move("cancelled", r)} />}
      {a && <RescheduleModal open={moveOpen} a={a} onClose={() => setMoveOpen(false)} onDone={(nid) => { setMoveOpen(false); onChanged?.(nid); }} />}
      {a && <LengthModal open={lenOpen} a={a} onClose={() => setLenOpen(false)} onDone={(x) => { setLenOpen(false); setData((d) => d ? { ...d, ...x } : d); reload(); onChanged?.(); }} />}
    </Drawer>
  );
}

const Item = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={wide ? "col-span-2" : ""}><dt className="text-xs text-mute">{label}</dt><dd className="mt-0.5">{children}</dd></div>
);

function CancelModal({ open, onClose, onConfirm, busy }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; busy: boolean }) {
  const [r, setR] = useState("");
  const presets = ["Patient request", "Patient unwell", "Doctor unavailable", "Equipment unavailable", "Duplicate booking"];
  return (
    <Modal open={open} onClose={onClose} title="Cancel appointment"
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Keep appointment" /></Button><Button variant="danger" loading={busy} disabled={r.trim().length < 3} onClick={() => onConfirm(r.trim())}><LocalizedText message="Cancel appointment" /></Button></>}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">{presets.map((p) => <SourceButton key={p} onClick={() => setR(p)} className={cx("rounded-full border px-3 py-1 text-xs", r === p ? "border-triage bg-triage-soft text-triage" : "border-line")}>{p}</SourceButton>)}</div>
        <Field label="Reason" required hint="The patient sees this in the cancellation message"><Textarea value={r} onChange={(e) => setR(e.target.value)} rows={2} /></Field>
      </div>
    </Modal>
  );
}

function RescheduleModal({ open, a, onClose, onDone }: { open: boolean; a: AppointmentDetail; onClose: () => void; onDone: (newId: number) => void }) {
  const { fmtDateTime } = useMedslotFormat();
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [rid, setRid] = useState<number | undefined>(a.resources[0]?.id);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [k, setK] = useState(0);
  const dur = diffMinutes(a.start_at, a.end_at);
  const save = async () => {
    if (!slot) return;
    setBusy(true); setErr(null);
    try {
      const n = await api<{ id: number; ref_code: string; start_at: string }>(`/appointments/${a.id}/reschedule`, { method: "POST", json: {
        start_at: slot.start, duration_minutes: dur, reason, resources: slot.resources.map((r) => ({ resource_id: r.id, role: r.role })) } });
      toast.success("Appointment rescheduled", `${n.ref_code} for ${fmtDateTime(n.start_at)}`);
      onDone(n.id);
    } catch (e) { setErr(e as ApiError); if ((e as ApiError).status === 409) { setSlot(null); setK((x) => x + 1); } } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} width="max-w-3xl" title={tr("Reschedule {value0}", { value0: (a.ref_code) ?? "" })}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} disabled={!slot || reason.trim().length < 3} onClick={save} icon={<ArrowRightLeft className="size-4" />}><LocalizedText message="Move to" />{" "}{slot ? fmtDateTime(slot.start) : tr("new time")}</Button></>}>
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto scroll-thin pr-1">
        <p className="text-sm text-mute"><LocalizedText message={"Currently {value0} with {value1}. The old booking is kept as “Rescheduled” for the record."} values={{ value0: (fmtDateTime(a.start_at)) ?? "", value1: (a.resources.map((r) => r.name).join(", ")) ?? "" }} /></p>
        <SlotPicker serviceId={a.service_id} value={slot} onChange={setSlot} resourceId={rid} onResourceChange={(x) => { setRid(x); setSlot(null); }}
          durationMinutes={dur} excludeAppointmentId={a.id} refreshKey={k} />
        <Field label="Reason for change" required error={err?.fields.reason}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient travelling that week" /></Field>
        {err && !Object.keys(err.fields).length && <ErrorNote error={err} />}
      </div>
    </Modal>
  );
}

function LengthModal({ open, a, onClose, onDone }: { open: boolean; a: AppointmentDetail; onClose: () => void; onDone: (x: Partial<AppointmentDetail>) => void }) {
  const { fmtTime } = useMedslotFormat();
  const api = useSourceApi();
  const toast = useToast();
  const cur = diffMinutes(a.start_at, a.end_at);
  const [m, setM] = useState(cur);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  useEffect(() => { setM(cur); setErr(null); }, [open, cur]);
  const opts = Array.from(new Set([5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, cur, cur + 15, cur + 30])).filter((x) => x >= 5).sort((x, y) => x - y);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<AppointmentDetail>(`/appointments/${a.id}/duration`, { method: "POST", json: { duration_minutes: m } });
      toast.success("Length changed", `${a.ref_code} now ends at ${fmtTime(r.end_at)}`);
      onDone({ end_at: r.end_at });
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change appointment length"
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} disabled={m === cur} onClick={save} icon={<Clock className="size-4" />}><LocalizedText message="Save length" /></Button></>}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-mute"><LocalizedText message={"Starts {value0}. We check every resource so the new length can't overlap another booking."} values={{ value0: (fmtTime(a.start_at)) ?? "" }} /></p>
        <div className="grid grid-cols-4 gap-1.5">
          {opts.map((o) => <SourceButton key={o} onClick={() => setM(o)} className={cx("tabular h-10 rounded-lg border text-sm", m === o ? "border-scrub bg-scrub text-white" : "border-line hover:border-scrub")}>{duration(o)}</SourceButton>)}
        </div>
        <p className="tabular text-sm"><LocalizedText message="New end time:" />{" "}<strong>{fmtTime(new Date(Date.parse(a.start_at + ":00Z") + m * 60000).toISOString().slice(0, 16))}</strong></p>
        {err && <ErrorNote error={{ message: err.details?.problems?.map((p) => p.message).join(". ") || err.message }} />}
      </div>
    </Modal>
  );
}
