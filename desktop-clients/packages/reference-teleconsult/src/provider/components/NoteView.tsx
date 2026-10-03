"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import type { Encounter, Staff } from "../../shared/types";
import { useTeleconsultFormat } from "../lib/format";
import { Badge, cx } from "./ui";

const BAND = { low: "bg-vital-50 text-vital-600", moderate: "bg-caution-50 text-caution-600", high: "bg-alarm-50 text-alarm-600" };

export function NoteView({ enc, signer }: { enc: Encounter; signer?: Staff }) {
  const { t } = useLocalization();
  const { fmtDate, fmtTime } = useTeleconsultFormat();
  const v = enc.vitals[enc.vitals.length - 1];
  const sections: [string, string][] = [
    ["Subjective", enc.soap.subjective],
    ["Objective", enc.soap.objective],
    ["Assessment", enc.soap.assessment],
    ["Plan", enc.soap.plan],
  ];
  return (
    <article className="space-y-5 text-sm leading-relaxed text-ink">
      {enc.triage.chiefComplaint && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400"><LocalizedText message={"Chief complaint"} /></h4>
          <p>{enc.triage.chiefComplaint}</p>
          {enc.triage.nurseNote && <p className="mt-1 text-ink-600">{t("Nursing: {value0}", { value0: enc.triage.nurseNote })}</p>}
        </section>
      )}
      {v && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400">{t("Vitals ({value0}, {value1})", { value0: v.source, value1: fmtTime(v.recordedAt) })}</h4>
          <p className="tabular">
            {[v.hr && `HR ${v.hr}`, v.sys && `BP ${v.sys}/${v.dia}`, v.spo2 && `SpO2 ${v.spo2}%`, v.rr && `RR ${v.rr}`, v.temp && `T ${v.temp} °C`, v.glucose && `Glucose ${v.glucose}`, v.pain !== undefined && `Pain ${v.pain}/10`].filter(Boolean).join(" · ")}
          </p>
        </section>
      )}
      {sections.map(([t, body]) => body?.trim() ? (
        <section key={t}>
          <h4 className="text-xs font-semibold text-ink-400">{t}</h4>
          <p className="whitespace-pre-wrap">{body.trim()}</p>
        </section>
      ) : null)}
      {enc.diagnoses.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400"><LocalizedText message={"Diagnoses"} /></h4>
          <ul className="space-y-0.5">
            {enc.diagnoses.map((d) => (
              <li key={d.code}><span className="tabular text-ink-600">{d.code}</span> {d.display} <span className="text-xs text-ink-400">({d.type}, {d.certainty})</span></li>
            ))}
          </ul>
        </section>
      )}
      {enc.prescriptions.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400"><LocalizedText message={"Prescriptions"} /></h4>
          <ul className="space-y-0.5">
            {enc.prescriptions.map((p) => (
              <li key={p.id}><b className="font-medium">{p.name} {p.strength}</b> {t("{value0}, {value1} days · qty {value2}", { value0: [p.dose, p.frequency.toLowerCase() + (p.prn ? ` ${t("as needed")}` : "")].join(", "), value1: p.durationDays, value2: p.quantity })}{p.refills ? ` · ${t("{value0} refills", { value0: p.refills })}` : ""}</li>
            ))}
          </ul>
        </section>
      )}
      {enc.orders.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400"><LocalizedText message={"Orders"} /></h4>
          <ul className="flex flex-wrap gap-1.5">
            {enc.orders.map((o) => (
              <li key={o.id}><Badge className={cx(o.priority === "routine" ? "bg-ink/5 text-ink" : "bg-alarm-50 text-alarm-600")}>{o.name}{o.priority !== "routine" ? ` · ${o.priority}` : ""}</Badge></li>
            ))}
          </ul>
        </section>
      )}
      {enc.scores.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400"><LocalizedText message={"Scores"} /></h4>
          <ul className="flex flex-wrap gap-1.5">
            {enc.scores.map((s) => <li key={s.id}><Badge className={BAND[s.band]}>{s.name} {s.value}: {s.interpretation}</Badge></li>)}
          </ul>
        </section>
      )}
      {enc.patientInstructions && (
        <section>
          <h4 className="text-xs font-semibold text-ink-400"><LocalizedText message={"Instructions given to patient"} /></h4>
          <p className="whitespace-pre-wrap">{enc.patientInstructions}</p>
        </section>
      )}
      {(enc.followUp || enc.sickNoteDays > 0) && (
        <section className="text-ink-600">
          {enc.followUp && <p>{t("Follow-up by {value0} in {value1} days", { value0: enc.followUp.mode, value1: enc.followUp.inDays })}{enc.followUp.note ? `: ${enc.followUp.note}` : ""}.</p>}
          {enc.sickNoteDays > 0 && <p>{t("Fit note issued for {value0} days.", { value0: enc.sickNoteDays })}</p>}
        </section>
      )}
      {enc.status === "signed" && (
        <footer className="border-t border-line pt-3 text-xs text-ink-400">
          {t("Electronically signed by {value0} on {value1}", { value0: signer?.name ?? enc.signedBy ?? "", value1: enc.signedAt ? t("{value0} at {value1}", { value0: fmtDate(enc.signedAt), value1: fmtTime(enc.signedAt) }) : "" })}
          {enc.recording.seconds > 0 && ` · Recorded ${Math.round(enc.recording.seconds / 60)} min with consent`}
        </footer>
      )}
    </article>
  );
}
