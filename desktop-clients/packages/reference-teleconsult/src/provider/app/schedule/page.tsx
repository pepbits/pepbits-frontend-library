"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { useMemo, useState } from "react";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { CalendarPlus, ChevronLeft, ChevronRight, Mic, MessageSquare, Video } from "lucide-react";
import type { AppointmentView, Staff } from "../../../shared/types";
import { useApi } from "../../lib/hooks";
import { useTeleconsultClient } from "../../lib/api";
import { STATUS, age, fullName, isoDate, sexShort, useTeleconsultFormat } from "../../lib/format";
import { Avatar, Button, DateInput, Modal, StatusPill, cx, useToast } from "../../components/ui";
import { providerPaths } from "../../routes";
import { BookingDialog } from "../../components/BookingDialog";

const START_H = 8;
const END_H = 18;
const PX_PER_MIN = 1.5;

const ModeIcon = ({ mode }: { mode: string }) =>
  mode === "video" ? <Video className="h-3 w-3" /> : mode === "audio" ? <Mic className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />;

export default function SchedulePage() {
  const router = useRouter();
  const { t } = useLocalization();
  const toast = useToast();
  const client = useTeleconsultClient();
  const { fmtDay, fmtTime, fmtHour } = useTeleconsultFormat();
  const [date, setDate] = useState(isoDate(new Date()));
  const [booking, setBooking] = useState(false);
  const [selected, setSelected] = useState<AppointmentView>();
  const { data: doctors = [] } = useApi<Staff[]>("/api/staff?role=doctor");
  const list = useApi<AppointmentView[]>(`/api/appointments?date=${date}T12:00:00`, { poll: 8000 });

  const shift = (days: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    setDate(isoDate(d));
  };

  const byDoctor = useMemo(() => {
    const m: Record<string, AppointmentView[]> = {};
    list.data?.forEach((a) => (m[a.clinicianId] ??= []).push(a));
    return m;
  }, [list.data]);

  const nowTop = (() => {
    const n = new Date();
    if (isoDate(n) !== date) return null;
    const mins = (n.getHours() - START_H) * 60 + n.getMinutes();
    return mins < 0 || mins > (END_H - START_H) * 60 ? null : mins * PX_PER_MIN;
  })();

  const setStatus = async (a: AppointmentView, status: string) => {
    try {
      await client.patch(`/api/appointments/${a.id}`, { status });
      toast(status === "cancelled" ? "Visit cancelled. The patient has been notified in the app." : "Visit updated");
      setSelected(undefined);
      list.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="flex h-full flex-col p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border border-line bg-white">
          <SourceButton onClick={() => shift(-1)} className="p-2 text-ink-600 hover:text-ink" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></SourceButton>
          <SourceButton onClick={() => setDate(isoDate(new Date()))} className="border-x border-line px-3 py-1.5 text-sm font-medium text-ink"><LocalizedText message={"Today"} /></SourceButton>
          <SourceButton onClick={() => shift(1)} className="p-2 text-ink-600 hover:text-ink" aria-label="Next day"><ChevronRight className="h-4 w-4" /></SourceButton>
        </div>
        <h2 className="text-[15px] font-semibold text-ink">{fmtDay(`${date}T12:00:00`)}</h2>
        <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-40" aria-label="Pick a date" />
        <span className="text-sm text-ink-400 tabular">{t("{value0} visits", { value0: list.data?.filter((a) => a.status !== "cancelled").length ?? 0 })}</span>
        <Button variant="primary" className="ml-auto" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}>
          
          <LocalizedText message={"Book visit"} />
        </Button>
      </div>

      {/* Desktop: resource grid */}
      <div className="hidden min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-white shadow-panel scroll-thin md:block">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: `64px repeat(${doctors.length || 1}, minmax(160px, 1fr))` }}>
          <div className="sticky top-0 z-20 border-b border-line bg-white" />
          {doctors.map((d) => (
            <div key={d.id} className="sticky top-0 z-20 flex items-center gap-2 border-b border-l border-line bg-white px-3 py-2">
              <Avatar name={d.name} color={d.color} size={26} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink">{d.name}</p>
                <p className="truncate text-2xs text-ink-400">{d.specialty}</p>
              </div>
            </div>
          ))}
          <div className="relative" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
            {Array.from({ length: END_H - START_H }, (_, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-2xs text-ink-400 tabular" style={{ top: i * 60 * PX_PER_MIN }}>
                {i === 0 ? "" : fmtHour(START_H + i)}
              </span>
            ))}
          </div>
          {doctors.map((d) => (
            <div key={d.id} className="relative border-l border-line" style={{ height: (END_H - START_H) * 60 * PX_PER_MIN }}>
              {Array.from({ length: END_H - START_H }, (_, i) => (
                <div key={i} className={cx("absolute inset-x-0 border-t", i === 0 ? "border-transparent" : "border-line/70")} style={{ top: i * 60 * PX_PER_MIN }} />
              ))}
              {nowTop !== null && <div className="absolute inset-x-0 z-10 border-t-2 border-alarm-500" style={{ top: nowTop }} />}
              {byDoctor[d.id]?.map((a) => {
                const s = new Date(a.start);
                const top = ((s.getHours() - START_H) * 60 + s.getMinutes()) * PX_PER_MIN;
                const h = Math.max(a.durationMin * PX_PER_MIN - 2, 20);
                return (
                  <SourceButton
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={cx(
                      "absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-2 py-0.5 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500",
                      a.status === "cancelled" ? "border-alarm-500 bg-alarm-50/60 opacity-60" : a.status === "completed" ? "border-ink-200 bg-canvas" : a.priority === "urgent" ? "border-alarm-500 bg-alarm-50" : "border-pulse-500 bg-pulse-50",
                    )}
                    style={{ top, height: h }}
                  >
                    <p className={cx("flex items-center gap-1 truncate text-xs font-semibold", a.status === "cancelled" ? "line-through text-ink-400" : "text-ink")}>
                      <ModeIcon mode={a.mode} /> {fmtTime(a.start)} {fullName(a.patient)}
                    </p>
                    {h > 26 && <p className="truncate text-2xs text-ink-600">{a.reason}</p>}
                  </SourceButton>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: agenda */}
      <ul className="space-y-2 md:hidden">
        {list.data?.map((a) => (
          <li key={a.id}>
            <SourceButton onClick={() => setSelected(a)} className="flex w-full items-center gap-3 rounded-lg border border-line bg-white p-3 text-left">
              <span className="w-14 text-xs font-semibold text-ink tabular">{fmtTime(a.start)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{fullName(a.patient)}</span>
                <span className="block truncate text-xs text-ink-400">{a.reason} · {a.clinician.name}</span>
              </span>
              <span className={cx("h-2 w-2 rounded-full", STATUS[a.status].dot)} />
            </SourceButton>
          </li>
        ))}
      </ul>

      <Modal
        open={!!selected}
        onClose={() => setSelected(undefined)}
        title="Visit details"
        footer={
          selected && !["completed", "cancelled"].includes(selected.status) ? (
            <>
              <Button variant="ghost" className="mr-auto text-alarm-600" onClick={() => setStatus(selected, "cancelled")}><LocalizedText message={"Cancel visit"} /></Button>
              {selected.status === "booked" && <Button onClick={() => setStatus(selected, "no-show")}><LocalizedText message={"Mark no-show"} /></Button>}
              <Button variant="primary" onClick={() => router.push(providerPaths.consult(selected.id))}><LocalizedText message={"Open consultation"} /></Button>
            </>
          ) : selected?.status === "completed" ? (
            <Button variant="primary" onClick={() => router.push(providerPaths.notes(selected.id))}><LocalizedText message={"View signed note"} /></Button>
          ) : selected?.status === "cancelled" ? (
            <Button onClick={() => setStatus(selected, "booked")}><LocalizedText message={"Restore booking"} /></Button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={fullName(selected.patient)} size={44} />
              <div>
                <p className="text-base font-semibold text-ink">{fullName(selected.patient)}</p>
                <p className="text-xs text-ink-400 tabular">{age(selected.patient.dob)}{sexShort(selected.patient.sex)} · {selected.patient.mrn} · {selected.patient.phone}</p>
              </div>
              <span className="ml-auto"><StatusPill {...STATUS[selected.status]} /></span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"When"} /></dt><dd className="text-ink">{fmtDay(selected.start)}, {fmtTime(selected.start)} · {t("{value0} min", { value0: selected.durationMin })}</dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Clinician"} /></dt><dd className="text-ink">{selected.clinician.name}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-ink-400"><LocalizedText message={"Reason"} /></dt><dd className="text-ink">{selected.reason}</dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Type"} /></dt><dd className="capitalize text-ink">{t(selected.mode[0].toUpperCase() + selected.mode.slice(1))} · {t(selected.priority[0].toUpperCase() + selected.priority.slice(1))}</dd></div>
              <div><dt className="text-xs text-ink-400"><LocalizedText message={"Booked by"} /></dt><dd className="capitalize text-ink">{t(selected.createdBy === "patient" ? "Patient app" : "Clinic staff")}</dd></div>
            </dl>
          </div>
        )}
      </Modal>

      <BookingDialog open={booking} onClose={() => setBooking(false)} date={date} onBooked={() => list.reload()} />
    </div>
  );
}
