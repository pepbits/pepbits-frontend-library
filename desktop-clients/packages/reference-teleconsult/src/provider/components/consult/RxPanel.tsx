"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../../shared/controls";
import { useState } from "react";
import { AlertOctagon, AlertTriangle, Pill, Plus, RefreshCw, Search, X } from "lucide-react";
import type { Drug, Prescription } from "../../../shared/types";
import { useConsult } from "./context";
import { useApi, useDebounced } from "../../lib/hooks";
import { Empty, Input, cx } from "../ui";

export function RxPanel() {
  const { t } = useLocalization();
  const { enc, update, actions, alerts, patient, catalog, role, locked } = useConsult();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 150);
  const drugs = useApi<Drug[]>(`/api/catalog/drugs?q=${encodeURIComponent(dq)}`);

  if (role === "nurse") {
    return <Empty title="Prescribing needs a doctor"><LocalizedText message={"You can see current medicines in the patient summary on the right. Add a note for the doctor in triage."} /></Empty>;
  }

  const patch = (id: string, p: Partial<Prescription>) => update((e) => ({ ...e, prescriptions: e.prescriptions.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
  const allergyClasses = patient.allergies.filter((a) => a.status === "active").map((a) => a.allergyClass);
  const rxAlerts = alerts.filter((a) => ["allergy", "interaction", "duplicate", "dose"].includes(a.source));

  const recalcQty = (r: Prescription, days: number) => {
    const d = catalog.drugs.find((x) => x.id === r.drugId);
    return d && d.unitsPerDose ? d.unitsPerDose * d.dosesPerDay * days : r.quantity;
  };

  const refillable = patient.medications
    .filter((m) => m.status === "active")
    .map((m) => ({ med: m, drug: catalog.drugs.find((d) => m.name.toLowerCase().startsWith(d.name.toLowerCase().split(" ")[0])) }));

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.4fr]">
      <div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
          <SourceInput value={q} onChange={(e) => setQ(e.target.value)} disabled={locked} placeholder="Search medicines or class" className="h-9 w-full rounded-md border border-line pl-8 pr-2 text-sm focus:border-pulse-500 focus:outline-none focus:ring-2 focus:ring-pulse-500/20" />
        </div>
        <ul className="mt-2 max-h-[300px] divide-y divide-line overflow-y-auto rounded-md border border-line scroll-thin">
          {drugs.data?.map((d) => {
            const allergic = d.allergyClass && allergyClasses.includes(d.allergyClass);
            return (
              <li key={d.id}>
                <SourceButton disabled={locked} onClick={() => actions.addDrug(d.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-canvas disabled:opacity-50">
                  <Pill className={cx("h-4 w-4 shrink-0", allergic ? "text-alarm-500" : "text-ink-400")} />
                  <span className="min-w-0 flex-1">
                    <span className={cx("block text-[13px]", allergic ? "font-medium text-alarm-600" : "text-ink")}>{d.name} {d.strength}</span>
                    <span className="block text-2xs text-ink-400">{allergic ? `${t("Allergy conflict")} · ` : ""}{d.drugClass} · {d.form}</span>
                  </span>
                  <Plus className="h-4 w-4 text-ink-400" />
                </SourceButton>
              </li>
            );
          })}
        </ul>
        {refillable.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-ink-700"><LocalizedText message={"Current medicines"} /></p>
            <ul className="space-y-1">
              {refillable.map(({ med, drug }) => (
                <li key={med.id} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{med.name} <span className="text-ink-400">· {med.frequency}</span></span>
                  {drug && (
                    <SourceButton disabled={locked} onClick={() => actions.addDrug(drug.id)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-pulse-700 hover:bg-pulse-50">
                      <RefreshCw className="h-3 w-3" />  <LocalizedText message={"Repeat"} />
                    </SourceButton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        {rxAlerts.length > 0 && (
          <ul className="mb-3 space-y-1.5">
            {rxAlerts.map((a) => (
              <li key={a.id} className={cx("flex gap-2 rounded-md p-2 text-xs", a.level === "critical" ? "bg-alarm-500 text-white" : a.level === "warning" ? "bg-caution-50 text-caution-600" : "bg-canvas text-ink-600")}>
                {a.level === "critical" ? <AlertOctagon className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span><b className="font-semibold">{a.title}.</b> {a.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {!enc.prescriptions.length ? (
          <Empty title="No prescriptions"><LocalizedText message={"Pick a medicine. Dose, frequency and quantity fill in from defaults and stay editable."} /></Empty>
        ) : (
          <ul className="space-y-2">
            {enc.prescriptions.map((r) => {
              const flagged = rxAlerts.some((a) => a.level === "critical" && a.detail.includes(r.name) || a.title.includes(r.name));
              return (
                <li key={r.id} className={cx("rounded-lg border p-2.5", flagged ? "border-alarm-500" : "border-line")}>
                  <div className="mb-2 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-pulse-600" />
                    <p className="flex-1 text-[13px] font-semibold text-ink">{r.name} {r.strength} <span className="font-normal text-ink-400">{r.form}, {r.route}</span></p>
                    <SourceButton disabled={locked} onClick={() => update((e) => ({ ...e, prescriptions: e.prescriptions.filter((x) => x.id !== r.id) }))} className="rounded p-1 text-ink-400 hover:text-alarm-500" aria-label={t("Remove {value0}", { value0: r.name })}>
                      <X className="h-4 w-4" />
                    </SourceButton>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.5fr]">
                    <label className="block"><span className="mb-0.5 block text-2xs text-ink-400"><LocalizedText message={"Dose"} /></span><Input disabled={locked} value={r.dose} onChange={(e) => patch(r.id, { dose: e.target.value })} className="h-8 text-xs" /></label>
                    <label className="block"><span className="mb-0.5 block text-2xs text-ink-400"><LocalizedText message={"How often"} /></span><Input disabled={locked} value={r.frequency} onChange={(e) => patch(r.id, { frequency: e.target.value })} className="h-8 text-xs" /></label>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <label className="block"><span className="mb-0.5 block text-2xs text-ink-400"><LocalizedText message={"Days"} /></span><Input disabled={locked} inputMode="numeric" value={r.durationDays} onChange={(e) => { const days = Number(e.target.value.replace(/\D/g, "")) || 0; patch(r.id, { durationDays: days, quantity: recalcQty(r, days) }); }} className="h-8 text-xs tabular" /></label>
                    <label className="block"><span className="mb-0.5 block text-2xs text-ink-400"><LocalizedText message={"Quantity (auto)"} /></span><Input disabled={locked} inputMode="numeric" value={r.quantity} onChange={(e) => patch(r.id, { quantity: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="h-8 text-xs tabular" /></label>
                    <label className="block"><span className="mb-0.5 block text-2xs text-ink-400"><LocalizedText message={"Refills"} /></span><Input disabled={locked} inputMode="numeric" value={r.refills} onChange={(e) => patch(r.id, { refills: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="h-8 text-xs tabular" /></label>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <SourceInput disabled={locked} value={r.instructions} onChange={(e) => patch(r.id, { instructions: e.target.value })} placeholder="Instructions for the patient label" className="h-8 flex-1 rounded border border-transparent bg-canvas px-2 text-xs focus:border-pulse-500 focus:outline-none" />
                    <label className="flex items-center gap-1 text-xs text-ink-600"><SourceInput type="checkbox" disabled={locked} className="accent-pulse-500" checked={r.prn} onChange={(e) => patch(r.id, { prn: e.target.checked })} />  <LocalizedText message={"As needed"} /></label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
