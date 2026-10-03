"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { AlertOctagon, AlertTriangle, Info, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import type { AiSuggestion, PatientHistory } from "../../../shared/types";
import { useConsult } from "./context";
import { useApi } from "../../lib/hooks";
import { useTeleconsultFormat } from "../../lib/format";
import { DemoNotice, cx } from "../ui";

const TYPE_LABEL: Record<AiSuggestion["type"], string> = { diagnosis: "Dx", order: "Order", drug: "Rx", score: "Score", orderset: "Set" };

export function AssistRail() {
  const { t } = useLocalization();
  const { alerts, suggestions, dismissSuggestion, actions, patient, role, locked, setTab } = useConsult();
  const { fmtDate } = useTeleconsultFormat();
  const history = useApi<PatientHistory>(`/api/patients/${patient.id}/history`);

  const accept = (s: AiSuggestion) => {
    if (s.type === "diagnosis") actions.addDiagnosis(s.ref);
    if (s.type === "order") actions.addOrder(s.ref);
    if (s.type === "drug") actions.addDrug(s.ref);
    if (s.type === "orderset") actions.applyOrderSet(s.ref);
    if (s.type === "score") actions.openScore(s.ref);
    dismissSuggestion(s.id);
  };
  const usable = suggestions.filter((s) => role === "doctor" || s.type === "score" || s.type === "order");

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-lg border border-line bg-white shadow-panel">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2">
          <ShieldCheck className="h-4 w-4 text-ink-600" />
          <h2 className="text-[13px] font-semibold text-ink"><LocalizedText message={"Safety checks"} /></h2>
          <span className="ml-auto text-2xs text-ink-400">{alerts.length ? t("{value0} active", { value0: alerts.length }) : t("All clear")}</span>
        </header>
        <ul className="max-h-[220px] space-y-1.5 overflow-y-auto p-2 scroll-thin">
          {!alerts.length && <li className="px-1 py-2 text-xs text-ink-400"><LocalizedText message={"Demo rule checks (allergy, interaction, vitals, guideline) re-run as you work."} /></li>}
          {alerts.map((a) => (
            <li
              key={a.id}
              className={cx("flex gap-2 rounded-md p-2 text-xs leading-snug", a.level === "critical" ? "bg-alarm-500 text-white" : a.level === "warning" ? "bg-caution-50 text-caution-600" : "bg-canvas text-ink-700")}
            >
              {a.level === "critical" ? <AlertOctagon className="h-4 w-4 shrink-0" /> : a.level === "warning" ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
              <span>
                <b className="block font-semibold">{a.title}</b>
                {a.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-panel">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Sparkles className="h-4 w-4 text-pulse-600" />
          <h2 className="text-[13px] font-semibold text-ink"><LocalizedText message={"Suggestions"} /></h2>
          <span className="ml-auto text-2xs text-ink-400"><LocalizedText message={"Demo rules, not clinical advice"} /></span>
        </header>
        <ul className="max-h-[300px] overflow-y-auto p-1.5 scroll-thin">
          {!usable.length && <li className="px-2 py-3 text-xs text-ink-400"><LocalizedText message={"Suggestions appear as the complaint, notes and conversation build up."} /></li>}
          {usable.map((s) => (
            <li key={s.id} className="group flex items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-canvas">
              <span className="mt-0.5 w-10 shrink-0 rounded bg-pulse-50 py-0.5 text-center text-2xs font-semibold text-pulse-700">{t(TYPE_LABEL[s.type])}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-tight text-ink">{s.label}</span>
                <span className="block text-2xs text-ink-400">{s.reason} · {Math.round(s.confidence * 100)}%</span>
              </span>
              <SourceButton disabled={locked} onClick={() => accept(s)} className="rounded p-1 text-pulse-600 hover:bg-pulse-100 disabled:opacity-40" aria-label={t("Add {value0}", { value0: s.label })}>
                <Plus className="h-4 w-4" />
              </SourceButton>
              <SourceButton onClick={() => dismissSuggestion(s.id)} className="rounded p-1 text-ink-200 hover:text-ink-600" aria-label={t("Dismiss {value0}", { value0: s.label })}>
                <X className="h-3.5 w-3.5" />
              </SourceButton>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-2 py-1.5"><DemoNotice><LocalizedText message={"Suggestions and safety checks come from a rule-based demo engine. They are not validated clinical decision support."} /></DemoNotice></div>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-panel">
        <header className="border-b border-line px-3 py-2">
          <h2 className="text-[13px] font-semibold text-ink"><LocalizedText message={"Patient summary"} /></h2>
        </header>
        <div className="space-y-3 p-3 text-xs">
          <div>
            <p className="mb-1 font-medium text-ink-400"><LocalizedText message={"Problems"} /></p>
            {patient.problems.length ? patient.problems.map((p) => <p key={p.code} className="text-ink">{p.display}</p>) : <p className="text-ink-400"><LocalizedText message={"None"} /></p>}
          </div>
          <div>
            <p className="mb-1 font-medium text-ink-400"><LocalizedText message={"Medicines"} /></p>
            {patient.medications.filter((m) => m.status === "active").length ? (
              patient.medications.filter((m) => m.status === "active").map((m) => <p key={m.id} className="text-ink">{m.name} <span className="text-ink-400">{m.frequency}</span></p>)
            ) : <p className="text-ink-400"><LocalizedText message={"None"} /></p>}
          </div>
          <div>
            <p className="mb-1 font-medium text-ink-400"><LocalizedText message={"Previous visits"} /></p>
            {history.data?.encounters.length ? (
              history.data.encounters.slice(0, 4).map(({ appointment, encounter, clinician }) => (
                <div key={encounter.id} className="mb-1.5">
                  <p className="text-ink"><span className="text-ink-400 tabular">{fmtDate(appointment.start)}</span> {appointment.reason}</p>
                  <p className="text-ink-400">{clinician.name} · {encounter.diagnoses[0]?.display ?? t("No diagnosis")}</p>
                </div>
              ))
            ) : <p className="text-ink-400"><LocalizedText message={"First visit"} /></p>}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-ink-600">
            <span>{t("Blood {value0}", { value0: patient.bloodGroup })}</span>
            {patient.weightKg && <span>{t("{value0} kg", { value0: patient.weightKg })}</span>}
            {patient.heightCm && <span>{t("{value0} cm", { value0: patient.heightCm })}</span>}
            <span className="capitalize">{t("Smoking: {value0}", { value0: patient.smoking })}</span>
          </div>
          <SourceButton onClick={() => setTab("allergies")} className="text-pulse-600 hover:underline"><LocalizedText message={"Review allergies"} /></SourceButton>
        </div>
      </section>
    </div>
  );
}
