"use client";
import React from "react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {ACVPU_TEXT, BUILT_IN_KEYS, consultBmiPreview, consultMeasurementErrors, consultWithoutUnmeasured, vitalLevel, type ConsultVitals, type VitalParameter, type VitalSettings} from "../models/consult-records";
import {useLocalization} from "@pepbits/i18n/react";
import {HeartPulse} from "@pepbits/icons";
import {Input, Select, Segmented, cn} from "@pepbits/ui";
import {ChoiceField, ClinicalPanel, TEXT} from "../layout/panel";
import {useRelativeTime} from "../time";
import {LOINC, type Observation} from "../types";
import {bmiPreview, measurementErrors, n, withoutUnmeasured, type NotMeasured, type Vitals} from "./model";

/** The single-value vital signs, with the range the API accepts and an "outside usual range" highlight. */
export const VITAL_FIELDS: {key: "hr" | "rr" | "temp" | "spo2"; label: string; unit: string; min: number; max: number; step?: number; code: string; warn: (v: number) => boolean}[] = [
  {key: "hr", label: "Heart rate", unit: "/min", min: 20, max: 250, code: LOINC.hr, warn: v => v < 50 || v > 110},
  {key: "rr", label: "Respiratory rate", unit: "/min", min: 0, max: 80, code: LOINC.rr, warn: v => v < 10 || v > 22},
  {key: "temp", label: "Temperature", unit: "°C", min: 30, max: 44, step: 0.1, code: LOINC.temp, warn: v => v < 35.5 || v >= 38},
  {key: "spo2", label: "SpO₂", unit: "%", min: 50, max: 100, code: LOINC.spo2, warn: v => v < 94},
];
const WARN = "[&_input]:border-[var(--warning)] [&_input]:bg-[color-mix(in_srgb,var(--warning)_10%,var(--surface))]";
const NOT_MEASURED = [{value: "refused", label: "Refused"}, {value: "unable", label: "Unable"}, {value: "device-failure", label: "Device failure"}, {value: "not-indicated", label: "Not indicated"}];

export interface VitalsValue { vitals: Vitals; notMeasured: NotMeasured }

/**
 * Vital-sign entry for any encounter: intake, triage, ward observations, day care or a home visit.
 * Earlier values (`latest`, keyed by LOINC code) are shown for comparison and never copied in.
 */
export function VitalsFields({value, onChange, latest = {}}: {value: VitalsValue; onChange: (value: VitalsValue) => void; latest?: Record<string, Observation>}) {
  const {t} = useLocalization();
  const relative = useRelativeTime();
  const {vitals: v, notMeasured} = value;
  const errors = measurementErrors(v, notMeasured);
  const bmi = bmiPreview(v);
  const set = <K extends keyof Vitals>(key: K, next: Vitals[K]) => onChange({vitals: {...v, [key]: next}, notMeasured});
  const setReasons = (reasons: NotMeasured) => onChange({vitals: withoutUnmeasured(v, reasons), notMeasured: reasons});
  const previous = (code: string, format: (o: Observation) => string) => {
    const o = latest[code];
    return o ? `${t("Last")}: ${format(o)} · ${relative(o.effectiveAt)}` : t("No earlier value");
  };
  const reason = (key: string) => <NotMeasuredSelect field={key} value={notMeasured} onChange={setReasons}/>;
  const sbp = n(v.sbp);

  return <div>
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      <ChoiceField label="Blood pressure" error={[errors.sbp, errors.dbp, errors.bp].filter(Boolean).join(" ") || undefined} aside={reason("bp")} hint={previous(LOINC.bp, o => `${o.value}/${o.value2}`)}>
        <div className={cn("flex items-center gap-1.5", sbp !== undefined && (sbp >= 160 || sbp < 90) && WARN)}>
          <Input aria-label="Systolic" aria-invalid={!!errors.sbp || !!errors.bp} inputMode="numeric" type="number" min={40} max={300} value={v.sbp} onChange={e => set("sbp", e.target.value)} placeholder="Sys" disabled={!!notMeasured.bp} className="flex-1"/>
          <span className={TEXT.muted}>/</span>
          <Input aria-label="Diastolic" aria-invalid={!!errors.dbp || !!errors.bp} inputMode="numeric" type="number" min={20} max={200} value={v.dbp} onChange={e => set("dbp", e.target.value)} placeholder="Dia" disabled={!!notMeasured.bp} className="flex-1"/>
          <span className={cn("shrink-0", TEXT.muted)}>mmHg</span>
        </div>
      </ChoiceField>
      {VITAL_FIELDS.map(f => {
        const val = n(v[f.key]);
        return <ChoiceField key={f.key} label={f.label} error={errors[f.key]} aside={reason(f.key)} hint={previous(f.code, o => `${o.value}`)}>
          <div className={cn(val !== undefined && f.warn(val) && WARN)}>
            <Input aria-label={f.label} type="number" inputMode="decimal" step={f.step ?? 1} min={f.min} max={f.max} value={v[f.key]} onChange={e => set(f.key, e.target.value)} suffix={f.unit} disabled={!!notMeasured[f.key]} aria-invalid={!!errors[f.key]}/>
          </div>
        </ChoiceField>;
      })}
      <ChoiceField label="Breathing" required error={errors.o2Flow}>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented size="sm" label="Air or oxygen" value={v.o2 ?? ""} onChange={x => onChange({vitals: {...v, o2: x as "air" | "oxygen", o2Flow: x === "oxygen" ? v.o2Flow : ""}, notMeasured})}
            options={[{value: "air", label: "Room air"}, {value: "oxygen", label: "Oxygen"}]}/>
          {v.o2 === "oxygen" ? <Input aria-label="Oxygen flow" type="number" min={0} max={60} step={0.5} value={v.o2Flow} onChange={e => set("o2Flow", e.target.value)} suffix="L/min" className="w-32"/> : null}
        </div>
      </ChoiceField>
      <ChoiceField label="Consciousness (ACVPU)" required className="sm:col-span-2">
        <Segmented size="sm" label="ACVPU" value={v.acvpu ?? ""} onChange={x => set("acvpu", x as Vitals["acvpu"])}
          options={[{value: "A", label: "Alert"}, {value: "C", label: "New confusion"}, {value: "V", label: "Voice"}, {value: "P", label: "Pain"}, {value: "U", label: "Unresponsive"}]}/>
      </ChoiceField>
      <Input label="Glucose (point of care)" error={errors.glucose} type="number" step={0.1} min={0.5} max={60} value={v.glucose} onChange={e => set("glucose", e.target.value)} suffix="mmol/L" hint="Optional"/>
    </div>

    <ChoiceField label="Pain now (0–10 numeric rating scale)" className="mt-5" error={errors.pain}>
      <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={t("Pain score")}>
        {Array.from({length: 11}, (_, i) => <button type="button" key={i} role="radio" aria-checked={v.pain === i} onClick={() => set("pain", v.pain === i ? null : i)}
          className={cn("focus-ring h-9 w-9 rounded-[calc(var(--radius)*0.8)] border text-[length:calc(13px*var(--fs-scale))] font-bold tabular-nums transition-colors",
            v.pain === i ? (i >= 7 ? "border-transparent bg-[var(--danger-fill)] text-white" : i >= 4 ? "border-transparent bg-[var(--warning)] text-[var(--text)]" : "border-transparent bg-[var(--success)] text-white")
              : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]")}>{i}</button>)}
        <button type="button" onClick={() => set("pain", null)} className={cn("focus-ring ms-1 px-2", TEXT.muted, "hover:text-[var(--text)]")}>{t("Clear")}</button>
      </div>
    </ChoiceField>

    <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
      <Input label="Weight" error={errors.weight} type="number" step={0.1} min={0.3} max={400} value={v.weight} onChange={e => set("weight", e.target.value)} suffix="kg" hint={previous(LOINC.weight, o => `${o.value} kg`)}/>
      <Input label="Height" error={errors.height} type="number" step={0.1} min={20} max={250} value={v.height} onChange={e => set("height", e.target.value)} suffix="cm" hint={previous(LOINC.height, o => `${o.value} cm`)}/>
      <div className="rounded-[var(--radius)] bg-[var(--surface-2)] px-3 py-2" aria-live="polite">
        <p className={TEXT.muted}>{t("BMI (calculated)")}</p>
        <p className="text-[length:calc(20px*var(--fs-scale))] font-bold tabular-nums text-[var(--text)]">{bmi ?? "—"}<span className={cn("ms-1 font-normal", TEXT.muted)}>{bmi ? "kg/m²" : t("needs weight and height measured today")}</span></p>
        {bmi !== null ? <p className={cn("mt-1", TEXT.muted)}>{t("Verify weight in kg and height in cm before saving.")}</p> : null}
      </div>
    </div>
  </div>;
}

/** VitalsFields in a titled panel. */
export function VitalsSection(props: {value: VitalsValue; onChange: (value: VitalsValue) => void; latest?: Record<string, Observation>}) {
  return <ClinicalPanel title="Vital signs" icon={<HeartPulse className="size-4"/>} subtitle="Measured now. Earlier values are shown for comparison, never copied.">
    <VitalsFields {...props}/>
  </ClinicalPanel>;
}

function NotMeasuredSelect({field, value, onChange}: {field: string; value: NotMeasured; onChange: (value: NotMeasured) => void}) {
  const {t} = useLocalization();
  const current = value[field];
  return <select aria-label={t("Reason not measured")} value={current ?? ""} onChange={e => { const next = {...value}; if (e.target.value) next[field] = e.target.value; else delete next[field]; onChange(next); }}
    className={cn("focus-ring max-w-[130px] rounded bg-transparent text-[length:calc(10.5px*var(--fs-scale))] outline-none", current ? "font-bold text-[var(--warning-ink)]" : "text-[var(--text-muted)] hover:text-[var(--text)]")}>
    <option value="">{t("Measured")}</option>
    {NOT_MEASURED.map(o => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
  </select>;
}

/** Catalogue-driven consultation editor; legacy VitalsFields remains compatible with intake. */
export function ConsultVitalsFields({value, notMeasured, onChange, onNotMeasured, parameters, settings, latest = {}, readOnly = false}: {
  value: ConsultVitals; notMeasured: NotMeasured; onChange: (v: ConsultVitals) => void; onNotMeasured: (reasons: NotMeasured) => void;
  parameters: VitalParameter[]; settings: VitalSettings; latest?: Record<string, Observation>; readOnly?: boolean;
}) {
  const {t} = useLocalization(), format = useFormatters();
  const errors = consultMeasurementErrors(value, notMeasured, parameters) as Record<string, string | undefined>;
  const shown = parameters.filter(p => p.status === "active" && p.screens.includes("consultation")).sort((a, b) => a.order - b.order);
  const set = <K extends keyof ConsultVitals>(key: K, next: ConsultVitals[K]) => onChange({...value, [key]: next});
  const setParameter = (p: VitalParameter, next: string) => {
    if (p.key === "pain") set("pain", next === "" ? null : Number(next));
    else if (BUILT_IN_KEYS.includes(p.key)) onChange({...value, [p.key]: next});
    else set("extra", {...value.extra, [p.key]: next});
  };
  const val = (p: VitalParameter) => p.key === "pain" ? value.pain ?? "" : BUILT_IN_KEYS.includes(p.key) ? String(value[p.key as keyof ConsultVitals] ?? "") : value.extra?.[p.key] ?? "";
  const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const bmi = consultBmiPreview(value, parameters);
  return <fieldset disabled={readOnly} className="grid gap-4">
    <Input label="Measured at" type="datetime-local" value={value.measuredAt ?? ""} min={local(new Date(Date.now() - settings.maxBackdateHours * 3600000))} max={local(new Date())} hint="Leave blank to record now; entry time is recorded separately." onChange={e => set("measuredAt", e.target.value)}/>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map(p => {
      const previous = latest[p.code];
      const severity = vitalLevel(p, Number(p.key === "bp" ? value.sbp || NaN : val(p) === "" ? NaN : val(p)));
      return <ChoiceField key={p.key} label={p.display} error={errors[p.key] || (p.key === "bp" ? errors.sbp || errors.dbp : undefined)} hint={previous ? `${t("Last")}: ${previous.value == null ? previous.valueDisplay ?? "—" : format.number(previous.value)}${previous.value2 == null ? "" : `/${format.number(previous.value2)}`} · ${format.dateTime(previous.effectiveAt)}` : t("No earlier value")}>
        <Select aria-label={t("Reason not measured: {parameter}", {parameter: p.display})} value={notMeasured[p.key] ?? ""} placeholder="Measured" options={NOT_MEASURED} onChange={e => {
          const reasons = {...notMeasured}; if (e.target.value) reasons[p.key] = e.target.value; else delete reasons[p.key];
          onChange(consultWithoutUnmeasured(value, reasons)); onNotMeasured(reasons);
        }}/>
        <div className={cn("mt-2", severity && "text-[var(--warning-ink)]")}>
          {p.key === "bp" ? <div className="flex gap-2"><Input aria-label="Systolic" type="number" value={value.sbp} min={p.min} max={p.max} disabled={!!notMeasured.bp} onChange={e => set("sbp", e.target.value)}/><Input aria-label="Diastolic" type="number" value={value.dbp} min={p.min2} max={p.max2} disabled={!!notMeasured.bp} onChange={e => set("dbp", e.target.value)}/></div>
            : <Input aria-label={p.display} type="number" min={p.min} max={p.max} step={10 ** -p.decimals} value={val(p)} suffix={p.unitDisplay} disabled={!!notMeasured[p.key]} onChange={e => setParameter(p, e.target.value)}/>}
          {severity ? <p>{t(severity === "alert" ? "Alert range" : "Outside usual range")}</p> : null}
        </div>
      </ChoiceField>;
    })}</div>
    <Select label="Breathing" value={value.o2 ?? ""} options={[{value: "air", label: "Room air"}, {value: "oxygen", label: "Oxygen"}]} onChange={e => onChange({...value, o2: e.target.value as ConsultVitals["o2"], o2Flow: e.target.value === "oxygen" ? value.o2Flow : ""})}/>
    {value.o2 === "oxygen" ? <Input label="Oxygen flow" type="number" min={0} max={60} step={0.5} suffix="L/min" value={value.o2Flow} error={errors.o2Flow} onChange={e => set("o2Flow", e.target.value)}/> : null}
    <Select label="Consciousness (ACVPU)" value={value.acvpu ?? ""} options={Object.entries(ACVPU_TEXT).map(([v, label]) => ({value: v, label}))} onChange={e => set("acvpu", e.target.value as ConsultVitals["acvpu"])}/>
    <p>{t("BMI (calculated)")}: {bmi == null ? "—" : format.number(bmi)} {bmi == null ? t("needs weight and height measured today") : "kg/m²"}</p>
  </fieldset>;
}

/** Read-only latest values, including correction/withdrawal state, using the same parameter catalogue as entry. */
export function VitalsSummary({detail, parameters}: {detail: import("../types").ConsultationDetail; parameters: VitalParameter[]}) {
  const {t} = useLocalization(), format = useFormatters();
  const news = detail.scores.find(s => s.methodId === "news2");
  const range = (low?: number | null, high?: number | null) => low != null && high != null ? `${format.number(low)}–${format.number(high)}` : low != null ? `≥ ${format.number(low)}` : high != null ? `≤ ${format.number(high)}` : "";
  return <div role="group" aria-label={t("Vital signs summary")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {parameters.filter(p => p.status === "active" && p.tile).sort((a, b) => a.order - b.order).map(p => {
      const latest = detail.observations.latest[p.code], o = latest?.status === "entered-in-error" ? undefined : latest;
      const withdrawn = latest?.status === "entered-in-error" || detail.observations.enteredInError?.some(o => o.code === p.code && o.encounterId === detail.encounter.id);
      const level = vitalLevel(p, o?.value), normal = `${range(p.normalLow, p.normalHigh)}${p.type === "pair" && range(p.normalLow2, p.normalHigh2) ? `/${range(p.normalLow2, p.normalHigh2)}` : ""}`;
      return <div key={p.key} className={cn("rounded-[var(--radius)] border border-[var(--border)] p-3", level === "alert" ? "text-[var(--danger-ink)]" : level === "warn" ? "text-[var(--warning-ink)]" : "text-[var(--text)]")} title={[t(p.display), normal ? `${t("Normal range")}: ${normal} ${p.unitDisplay}` : ""].filter(Boolean).join(" · ")}>
        <p>{t(p.label)} {o?.status === "corrected" ? <span>{t("Corrected")}</span> : null}</p>
        <p className="font-bold tabular-nums">{o?.value == null ? o?.valueDisplay ?? "—" : format.number(o.value)}{p.type === "pair" && o?.value2 != null ? `/${format.number(o.value2)}` : ""} {o ? p.unitDisplay : ""}</p>
        <p>{o ? format.dateTime(o.effectiveAt) : t(withdrawn ? "Entered in error" : "Not recorded")}</p>
      </div>;
    })}
    <div className={cn("rounded-[var(--radius)] border border-[var(--border)] p-3", (news?.total ?? 0) >= 5 && "text-[var(--danger-ink)]")}><p>{t("NEWS2")}</p><p className="font-bold tabular-nums">{news?.total == null ? "—" : format.number(news.total)}</p><p>{news?.band ?? t("Not calculated")}</p></div>
  </div>;
}
