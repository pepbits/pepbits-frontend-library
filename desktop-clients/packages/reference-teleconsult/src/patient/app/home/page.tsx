"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { CalendarClock, ChevronRight, FileText, LogOut, Mic, PlusCircle, ShieldAlert, Video } from "lucide-react";
import type { AppointmentView } from "../../../shared/types";
import { useApi } from "../../lib/hooks";
import { usePatient } from "../../lib/session";
import { useTeleconsultFormat } from "../../lib/format";
import { patientPaths } from "../../routes";
import { Avatar, Button, Card, Screen, cx } from "../../components/ui";

const LIVE = ["waiting", "triage", "ready", "in-call"];

function cta(a: AppointmentView) {
  if (a.status === "in-call") return "Rejoin your call";
  if (LIVE.includes(a.status)) return "Back to waiting room";
  return "Check in and join";
}
type Translate = ReturnType<typeof useLocalization>["t"];
function statusLine(a: AppointmentView, fmt: ReturnType<typeof useTeleconsultFormat>, t: Translate) {
  switch (a.status) {
    case "waiting": return a.queuePosition ? t("You’re in the waiting room · number {value0} in line", { value0: a.queuePosition }) : t("You’re in the waiting room");
    case "triage": return t("A nurse is checking your details");
    case "ready": return t("Your doctor will join shortly");
    case "in-call": return t("Your visit is in progress");
    default: return t("{value0} at {value1}", { value0: fmt.relDay(a.start), value1: fmt.fmtTime(a.start) });
  }
}

export default function Home() {
  const router = useRouter();
  const { t } = useLocalization();
  const fmt = useTeleconsultFormat();
  const { fmtDate, fmtTime, relDay } = fmt;
  const { patient, patients, signOut, settings } = usePatient();
  const canBook = settings?.allowPatientBooking === true;
  const appts = useApi<AppointmentView[]>(patient ? `/api/patients/${patient.id}/appointments` : null, { poll: 4000 });

  const upcoming = (appts.data ?? []).filter((a) => ["booked", ...LIVE].includes(a.status)).sort((a, b) => (LIVE.includes(b.status) ? 1 : 0) - (LIVE.includes(a.status) ? 1 : 0) || a.start.localeCompare(b.start));
  const past = (appts.data ?? []).filter((a) => a.status === "completed").sort((a, b) => b.start.localeCompare(a.start));
  const next = upcoming[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Screen>
      {patient && (
        <main className="px-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-600">{t(greeting)},</p>
              <h1 className="truncate text-[26px] font-extrabold tracking-tight text-forest">{patient.firstName}</h1>
            </div>
            {patients.length > 1 && (
              <SourceButton onClick={() => { signOut(); router.replace("/"); }} className="rounded-full p-2 text-ink-400 hover:bg-forest/5" aria-label={t("Switch person")}>
                <LogOut className="h-5 w-5" />
              </SourceButton>
            )}
          </div>

          {next ? (
            <section className="mt-5 overflow-hidden rounded-[28px] bg-forest p-5 text-white animate-rise">
              <div className="flex items-center gap-2 text-sm text-forest-200">
                {next.mode === "video" ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className={cx(LIVE.includes(next.status) && "font-semibold text-sun")}>{statusLine(next, fmt, t)}</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={next.clinician.name} color={next.clinician.color} size={52} />
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-tight">{next.clinician.name}</p>
                  <p className="text-sm text-forest-200">{next.clinician.specialty}</p>
                </div>
              </div>
              <p className="mt-4 text-[15px] text-forest-100">{next.reason}</p>
              <Button variant="sun" block className="mt-5" onClick={() => router.push(patientPaths.visit(next.id))}>{cta(next)}</Button>
            </section>
          ) : (
            <Card className="mt-5 p-5">
              <p className="text-lg font-bold text-forest"><LocalizedText message={"No visits booked"} /></p>
              <p className="mt-1 text-sm text-ink-600"><LocalizedText message={"Most people see a clinician the same day."} /></p>
              {canBook && <Button className="mt-4" block onClick={() => router.push("/book")}><LocalizedText message={"Book a video visit"} /></Button>}
            </Card>
          )}

          <div className={cx("mt-4 grid gap-3", canBook ? "grid-cols-2" : "grid-cols-1")}>
            {canBook && (
              <Link href="/book" className="flex flex-col gap-3 rounded-3xl bg-white p-4 active:scale-[.99]">
                <PlusCircle className="h-6 w-6 text-forest" />
                <span className="font-semibold text-ink"><LocalizedText message={"Book a visit"} /></span>
              </Link>
            )}
            <Link href="/records" className="flex flex-col gap-3 rounded-3xl bg-white p-4 active:scale-[.99]">
              <ShieldAlert className="h-6 w-6 text-forest" />
              <span className="font-semibold text-ink"><LocalizedText message={"Allergies and medicines"} /></span>
            </Link>
          </div>

          {upcoming.length > 1 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-ink-600"><LocalizedText message={"Coming up"} /></h2>
              <ul className="overflow-hidden rounded-3xl bg-white">
                {upcoming.slice(1).map((a, i) => (
                  <li key={a.id} className={i ? "border-t border-mint" : ""}>
                    <Link href={`/visit/${a.id}`} className="flex items-center gap-3 px-4 py-3">
                      <CalendarClock className="h-5 w-5 text-forest-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-ink">{relDay(a.start)}, {fmtTime(a.start)}</span>
                        <span className="block truncate text-xs text-ink-400">{a.clinician.name} · {a.reason}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-ink-200" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-ink-600"><LocalizedText message={"Past visits"} /></h2>
              <ul className="overflow-hidden rounded-3xl bg-white">
                {past.slice(0, 5).map((a, i) => (
                  <li key={a.id} className={i ? "border-t border-mint" : ""}>
                    <Link href={`/visit/${a.id}/summary`} className="flex items-center gap-3 px-4 py-3">
                      <FileText className="h-5 w-5 text-forest-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-ink">{a.reason}</span>
                        <span className="block text-xs text-ink-400">{fmtDate(a.start)} · {a.clinician.name}</span>
                      </span>
                      <span className="text-xs font-medium text-forest"><LocalizedText message={"Summary"} /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      )}
    </Screen>
  );
}
