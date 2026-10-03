"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useEffect } from "react";
import { ChevronRight, HeartPulse, Pill, ShieldAlert, Smartphone, Stethoscope } from "lucide-react";
import type { PatientHistory } from "../../../shared/types";
import { useApi } from "../../lib/hooks";
import { usePatient } from "../../lib/session";
import { useTeleconsultFormat } from "../../lib/format";
import { Card, Header, Screen, cx } from "../../components/ui";

export default function Records() {
  const { t } = useLocalization();
  const { fmtDate } = useTeleconsultFormat();
  const { patient, refresh } = usePatient();
  const history = useApi<PatientHistory>(patient ? `/api/patients/${patient.id}/history` : null);
  // Pick up allergy or medicine changes the care team made
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <Screen>
      <Header title="My health" />
      {patient && (
        <main className="space-y-3 px-4 pb-6 pt-1">
          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-forest"><ShieldAlert className="h-5 w-5" />  <LocalizedText message={"Allergies"} /></h2>
            {patient.allergies.filter((a) => a.status === "active").length ? (
              <ul className="space-y-2">
                {patient.allergies.filter((a) => a.status === "active").map((a) => (
                  <li key={a.id} className={cx("rounded-2xl p-3", a.severity === "severe" ? "bg-rose-50" : "bg-mint")}>
                    <p className={cx("font-semibold", a.severity === "severe" ? "text-rose-600" : "text-ink")}>{a.substance}</p>
                    <p className="text-sm text-ink-600">{a.reaction} · {t(a.severity[0].toUpperCase() + a.severity.slice(1))}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[15px] text-ink-600">{t(patient.noKnownAllergies ? "No known allergies" : "Not recorded yet. Tell your doctor at your next visit.")}</p>}
          </Card>

          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-forest"><Pill className="h-5 w-5" />  <LocalizedText message={"Medicines"} /></h2>
            {patient.medications.filter((m) => m.status === "active").length ? (
              <ul className="divide-y divide-mint">
                {patient.medications.filter((m) => m.status === "active").map((m) => (
                  <li key={m.id} className="py-2"><p className="font-medium text-ink">{m.name}</p><p className="text-sm text-ink-600">{m.frequency}</p></li>
                ))}
              </ul>
            ) : <p className="text-[15px] text-ink-600"><LocalizedText message={"None listed"} /></p>}
          </Card>

          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-forest"><Stethoscope className="h-5 w-5" />  <LocalizedText message={"Conditions"} /></h2>
            {patient.problems.length ? (
              <ul className="space-y-1">{patient.problems.map((p) => <li key={p.code + p.display} className="text-[15px] text-ink">{p.display}</li>)}</ul>
            ) : <p className="text-[15px] text-ink-600"><LocalizedText message={"None listed"} /></p>}
          </Card>

          <Card>
            <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-forest"><Smartphone className="h-5 w-5" />  <LocalizedText message={"Connected devices"} /></h2>
            <ul className="flex flex-wrap gap-2">
              {patient.devices.map((d) => (
                <li key={d.name} className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1.5 text-sm text-ink">
                  <span className={cx("h-2 w-2 rounded-full", d.connected ? "bg-forest-500" : "bg-ink-200")} /> {d.name}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-forest"><HeartPulse className="h-5 w-5" />  <LocalizedText message={"Visit summaries"} /></h2>
            {history.data?.encounters.length ? (
              <ul className="divide-y divide-mint">
                {history.data.encounters.map(({ appointment, encounter, clinician }) => (
                  <li key={encounter.id}>
                    <Link href={`/visit/${appointment.id}/summary`} className="flex items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{appointment.reason}</span>
                        <span className="block text-xs text-ink-400">{fmtDate(appointment.start)} · {clinician.name}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-ink-200" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="py-2 text-[15px] text-ink-600"><LocalizedText message={"Summaries appear here after each visit."} /></p>}
          </Card>
          <p className="px-2 text-xs text-ink-400">{patient.mrn} · {patient.insurance.payer}</p>
        </main>
      )}
    </Screen>
  );
}
