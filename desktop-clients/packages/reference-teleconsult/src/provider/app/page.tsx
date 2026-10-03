"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../shared/controls";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { useState } from "react";
import { BellRing, CalendarPlus, ChevronRight, MonitorSmartphone, Mic, ShieldAlert, Smartphone, Video } from "lucide-react";
import type { AppointmentView, DashboardStats } from "../../shared/types";
import { useApi } from "../lib/hooks";
import { useTeleconsultClient } from "../lib/api";
import { useSession } from "../lib/session";
import { STATUS, age, fullName, isoDate, sexShort, useTeleconsultFormat } from "../lib/format";
import { Avatar, Badge, Button, Empty, ErrorNote, Spinner, StatusPill, cx, useToast } from "../components/ui";
import { BookingDialog } from "../components/BookingDialog";

const FLOW: { key: keyof DashboardStats; label: string; tone: string }[] = [
  { key: "scheduled", label: "Scheduled", tone: "text-ink" },
  { key: "waiting", label: "Waiting room", tone: "text-caution-600" },
  { key: "inTriage", label: "Nurse triage", tone: "text-[#3B4BA9]" },
  { key: "ready", label: "Ready for doctor", tone: "text-pulse-600" },
  { key: "inCall", label: "In consultation", tone: "text-vital-600" },
  { key: "completed", label: "Completed", tone: "text-ink-600" },
];

export default function TodayPage() {
  const router = useRouter();
  const { t } = useLocalization();
  const toast = useToast();
  const client = useTeleconsultClient();
  const { fmtTime } = useTeleconsultFormat();
  const { role, user } = useSession();
  const today = isoDate(new Date());
  const stats = useApi<DashboardStats>(`/api/dashboard?date=${today}`, { poll: 4000 });
  const queue = useApi<AppointmentView[]>("/api/queue", { poll: 3000 });
  const day = useApi<AppointmentView[]>(`/api/appointments?date=${today}`, { poll: 6000 });
  const [booking, setBooking] = useState(false);
  const [busy, setBusy] = useState<string>();

  const open = async (a: AppointmentView) => {
    setBusy(a.id);
    try {
      if (role === "nurse" && ["waiting", "booked"].includes(a.status)) await client.patch(`/api/appointments/${a.id}`, { status: "triage", triagedBy: user?.id });
      if (role === "doctor" && ["waiting", "ready", "booked", "triage"].includes(a.status)) await client.patch(`/api/appointments/${a.id}`, { status: "in-call" });
      router.push(`/consult/${a.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(undefined);
    }
  };

  const simulate = async () => {
    try {
      const a = await client.post<AppointmentView>("/api/sim/arrive");
      toast(t("Demo: {value0} was moved into the waiting room", { value0: fullName(a.patient) }), "info");
      queue.reload();
      stats.reload();
      day.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const actionLabel = (a: AppointmentView) => {
    if (role === "nurse") return a.status === "triage" ? "Continue triage" : a.status === "ready" ? "Review triage" : "Start triage";
    return a.status === "in-call" ? "Return to call" : "Start consult";
  };

  if (queue.error && !queue.data) return <ErrorNote message={queue.error} />;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-3 sm:p-5 lg:h-full">
      {/* Patient flow */}
      <section aria-label={t("Patient flow today")} className="flex shrink-0 overflow-x-auto rounded-lg border border-line bg-white shadow-panel scroll-thin">
        {FLOW.map((f, i) => (
          <div key={f.key} className={cx("min-w-[132px] flex-1 px-4 py-3", i > 0 && "border-l border-line")}>
            <p className="text-xs text-ink-400">{t(f.label)}</p>
            <p className={cx("mt-0.5 text-2xl font-semibold tabular", f.tone)}>{stats.data ? stats.data[f.key] : "–"}</p>
          </div>
        ))}
        <div className="min-w-[150px] border-l border-line bg-canvas/60 px-4 py-3">
          <p className="text-xs text-ink-400"><LocalizedText message={"Average wait"} /></p>
          <p className="mt-0.5 text-2xl font-semibold tabular text-ink">
            {stats.data?.avgWaitMin ?? "–"}
            <span className="ml-1 text-sm font-normal text-ink-400"><LocalizedText message={"min"} /></span>
          </p>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        {/* Waiting room */}
        <section className="flex min-h-[420px] flex-col rounded-lg border border-line bg-white shadow-panel">
          <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink"><LocalizedText message={"Virtual waiting room"} /></h2>
              <p className="text-xs text-ink-400"><LocalizedText message={"Urgent first, then by arrival. Updates live as patients join from the app."} /></p>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" icon={<BellRing className="h-4 w-4" />} onClick={simulate}>
                
                <LocalizedText message={"Simulate arrival (demo)"} />
              </Button>
              <Button size="sm" variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}>
                
                <LocalizedText message={"Book visit"} />
              </Button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
            {queue.loading && !queue.data ? (
              <Spinner />
            ) : !queue.data?.length ? (
              <Empty title="No one is waiting"><LocalizedText message={"Patients appear here the moment they tap “Join” in the patient app."} /></Empty>
            ) : (
              <ul className="divide-y divide-line">
                {queue.data.map((a) => {
                  const w = a.waitMinutes ?? 0;
                  const severe = a.patient.allergies.filter((x) => x.status === "active" && x.severity === "severe");
                  return (
                    <li key={a.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={fullName(a.patient)} size={40} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="truncate text-sm font-semibold text-ink">{fullName(a.patient)}</p>
                            <span className="text-xs text-ink-400 tabular">
                              {age(a.patient.dob)}
                              {sexShort(a.patient.sex)} · {a.patient.mrn}
                            </span>
                            {a.priority === "urgent" && <Badge className="bg-alarm-500 text-white"><LocalizedText message={"Urgent"} /></Badge>}
                            {severe.length > 0 && (
                              <Badge className="bg-alarm-50 text-alarm-600">
                                <ShieldAlert className="h-3 w-3" />
                                {severe.map((s) => s.substance).join(", ")}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[13px] text-ink-700">{a.reason}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-ink-400">
                            <span className="inline-flex items-center gap-1">
                              {a.mode === "video" ? <Video className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                              {a.clinician.name}
                            </span>
                            {a.preVisit?.shareDeviceData && (
                              <span className="inline-flex items-center gap-1 text-pulse-600">
                                <MonitorSmartphone className="h-3 w-3" />  <LocalizedText message={"Devices sharing"} />
                              </span>
                            )}
                            {a.preVisit?.deviceCheck && (
                              <span className="inline-flex items-center gap-1">
                                <Smartphone className="h-3 w-3" /> {t("Network {value0}", { value0: a.preVisit.deviceCheck.network })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:justify-end">
                        <StatusPill {...STATUS[a.status]} />
                        <span className={cx("w-14 text-right text-sm font-semibold tabular", w >= 20 ? "text-alarm-500" : w >= 10 ? "text-caution-600" : "text-ink-600")} title={t("Minutes waiting")}>
                          {t("{value0} min", { value0: w })}
                        </span>
                        <Button size="sm" variant={a.status === "ready" || role === "nurse" ? "primary" : "secondary"} loading={busy === a.id} onClick={() => open(a)}>
                          {actionLabel(a)}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Day timeline */}
        <section className="flex min-h-[320px] flex-col rounded-lg border border-line bg-white shadow-panel">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink"><LocalizedText message={"Today’s list"} /></h2>
            <SourceButton className="text-xs font-medium text-pulse-600 hover:underline" onClick={() => router.push("/schedule")}>
              
              <LocalizedText message={"Open schedule"} />
            </SourceButton>
          </header>
          <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scroll-thin">
            {day.data?.map((a) => (
              <li key={a.id}>
                <SourceButton
                  onClick={() => (["completed", "cancelled"].includes(a.status) ? router.push(`/notes?appointment=${a.id}`) : open(a))}
                  className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500"
                >
                  <span className="w-16 shrink-0 text-xs font-medium text-ink-600 tabular">{fmtTime(a.start)}</span>
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", STATUS[a.status].dot)} title={t(STATUS[a.status].label)} />
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-[13px] font-medium", a.status === "completed" ? "text-ink-400" : "text-ink")}>{fullName(a.patient)}</span>
                    <span className="block truncate text-2xs text-ink-400">
                      {a.reason} · {a.clinician.name.replace("Dr. ", "Dr ")}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-200 group-hover:text-ink-400" />
                </SourceButton>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <BookingDialog
        open={booking}
        onClose={() => setBooking(false)}
        onBooked={() => {
          day.reload();
          stats.reload();
        }}
      />
    </div>
  );
}
