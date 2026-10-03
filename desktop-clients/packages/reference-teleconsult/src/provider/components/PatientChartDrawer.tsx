"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { useState } from "react";
import { CalendarPlus, ShieldAlert } from "lucide-react";
import type { AppointmentView, Patient, PatientHistory } from "../../shared/types";
import { useApi } from "../lib/hooks";
import { STATUS, age, fullName, sexShort, useTeleconsultFormat } from "../lib/format";
import { Badge, Button, Drawer, Empty, Segmented, StatusPill, cx } from "./ui";
import { BookingDialog } from "./BookingDialog";

export function PatientChartDrawer({ patient, onClose }: { patient?: Patient; onClose: () => void }) {
  const { t } = useLocalization();
  const { fmtDate, fmtTime } = useTeleconsultFormat();
  const [tab, setTab] = useState<"overview" | "visits">("overview");
  const [booking, setBooking] = useState(false);
  const history = useApi<PatientHistory>(patient ? `/api/patients/${patient.id}/history` : null);
  const appts = useApi<AppointmentView[]>(patient ? `/api/patients/${patient.id}/appointments` : null);
  if (!patient) return null;
  const upcoming = appts.data?.filter((a) => !["completed", "cancelled", "no-show"].includes(a.status)) ?? [];

  return (
    <>
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={fullName(patient)}
      subtitle={t("{value0} · {value1} · born {value2}", { value0: `${age(patient.dob)}${sexShort(patient.sex)}`, value1: patient.mrn, value2: fmtDate(patient.dob) })}
      footer={<Button variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}><LocalizedText message={"Book visit"} /></Button>}
    >
      <div className="px-5 pt-4">
        <Segmented value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "visits", label: t("Visits ({value0})", { value0: history.data?.encounters.length ?? 0 }) }]} />
      </div>
      {tab === "overview" ? (
        <div className="grid gap-5 px-5 py-4 sm:grid-cols-2">
          <section className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Allergies"} /></h3>
            {patient.noKnownAllergies && !patient.allergies.length ? (
              <Badge className="bg-vital-50 text-vital-600"><LocalizedText message={"No known allergies"} /></Badge>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {patient.allergies.map((a) => (
                  <li key={a.id} className={cx("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs", a.status === "inactive" ? "bg-canvas text-ink-400 line-through" : a.severity === "severe" ? "bg-alarm-500 text-white" : "bg-alarm-50 text-alarm-600")}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <b className="font-semibold">{a.substance}</b> {a.reaction} · {t(a.severity[0].toUpperCase() + a.severity.slice(1))}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Problems"} /></h3>
            {patient.problems.length ? (
              <ul className="space-y-1.5 text-sm">
                {patient.problems.map((p) => (
                  <li key={p.code} className="flex gap-2"><span className="w-16 shrink-0 text-xs text-ink-400 tabular">{p.code}</span><span className="text-ink">{p.display}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-400"><LocalizedText message={"None recorded"} /></p>}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Medications"} /></h3>
            {patient.medications.length ? (
              <ul className="space-y-1.5 text-sm">
                {patient.medications.map((m) => (
                  <li key={m.id}><span className="text-ink">{m.name}</span> <span className="text-xs text-ink-400">{m.frequency}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-400"><LocalizedText message={"None recorded"} /></p>}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Contact"} /></h3>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2"><dt className="w-20 text-ink-400"><LocalizedText message={"Phone"} /></dt><dd className="text-ink">{patient.phone}</dd></div>
              <div className="flex gap-2"><dt className="w-20 text-ink-400"><LocalizedText message={"Email"} /></dt><dd className="truncate text-ink">{patient.email || "–"}</dd></div>
              <div className="flex gap-2"><dt className="w-20 text-ink-400"><LocalizedText message={"Language"} /></dt><dd className="text-ink">{patient.language}</dd></div>
              <div className="flex gap-2"><dt className="w-20 text-ink-400"><LocalizedText message={"Emergency"} /></dt><dd className="text-ink">{patient.emergencyContact.name || "–"} {patient.emergencyContact.relation && `(${patient.emergencyContact.relation})`}</dd></div>
              {patient.guardian && <div className="flex gap-2"><dt className="w-20 text-ink-400"><LocalizedText message={"Guardian"} /></dt><dd className="text-ink">{patient.guardian}</dd></div>}
            </dl>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Coverage and devices"} /></h3>
            <p className="text-sm text-ink">{patient.insurance.payer} <span className="text-ink-400">{patient.insurance.memberId}</span></p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {patient.devices.map((d) => <li key={d.name}><Badge className="bg-pulse-50 text-pulse-700">{d.name}</Badge></li>)}
            </ul>
          </section>
          <section className="sm:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Upcoming"} /></h3>
            {upcoming.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-32 text-ink tabular">{fmtDate(a.start)} {fmtTime(a.start)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-700">{a.reason}</span>
                    <StatusPill {...STATUS[a.status]} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-400"><LocalizedText message={"No upcoming visits"} /></p>}
          </section>
        </div>
      ) : (
        <div className="px-5 py-4">
          {!history.data?.encounters.length ? (
            <Empty title="No signed visits yet" />
          ) : (
            <ol className="space-y-3">
              {history.data.encounters.map(({ appointment, encounter, clinician }) => (
                <li key={encounter.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{appointment.reason}</p>
                    <span className="text-xs text-ink-400 tabular">{fmtDate(appointment.start)}</span>
                  </div>
                  <p className="text-xs text-ink-400">{clinician.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {encounter.diagnoses.map((d) => <Badge key={d.code} className="bg-ink/5 text-ink">{d.code} {d.display}</Badge>)}
                  </div>
                  {encounter.soap.assessment && <p className="mt-2 text-sm text-ink-700">{encounter.soap.assessment}</p>}
                  {encounter.soap.plan && <p className="mt-1 text-sm text-ink-600">{encounter.soap.plan}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Drawer>
    <BookingDialog open={booking} onClose={() => setBooking(false)} patient={patient} onBooked={() => appts.reload()} />
    </>
  );
}
