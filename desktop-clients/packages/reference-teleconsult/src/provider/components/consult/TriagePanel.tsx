"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../shared/controls";
import { useState } from "react";
import { ArrowRightCircle, Radio, Smartphone } from "lucide-react";
import type { Vitals } from "../../../shared/types";
import { useConsult, outOfRange } from "./context";
import { useTeleconsultFormat } from "../../lib/format";
import { Badge, Button, Field, Input, Select, Textarea, cx } from "../ui";

const SCREEN: { key: string; label: string; flag: string; femaleOnly?: boolean }[] = [
  { key: "fever", label: "Fever in last 24 h", flag: "Fever" },
  { key: "chestPain", label: "Chest pain", flag: "Chest pain" },
  { key: "breathless", label: "Breathless at rest", flag: "Breathless at rest" },
  { key: "fall", label: "Fall or near-fall", flag: "Fall" },
  { key: "newMeds", label: "New or changed medicine", flag: "Medication change" },
  { key: "travel", label: "Travel in last 14 days", flag: "Recent travel" },
  { key: "selfHarm", label: "Thoughts of self-harm", flag: "Self-harm risk" },
  { key: "pregnant", label: "Could be pregnant", flag: "Possible pregnancy", femaleOnly: true },
];

type VForm = Record<"hr" | "spo2" | "sys" | "dia" | "rr" | "temp" | "glucose" | "weight", string> & { consciousness: NonNullable<Vitals["consciousness"]>; onOxygen: boolean };
const emptyV: VForm = { hr: "", spo2: "", sys: "", dia: "", rr: "", temp: "", glucose: "", weight: "", consciousness: "alert", onOxygen: false };

export function TriagePanel({ onHandoff, handingOff }: { onHandoff: () => void; handingOff: boolean }) {
  const { t: tr } = useLocalization();
  const { enc, update, appt, patient, live, actions, role, locked } = useConsult();
  const { fmtTime } = useTeleconsultFormat();
  const [v, setV] = useState<VForm>(emptyV);
  const t = enc.triage;
  const pv = appt.preVisit;
  const setT = (patch: Partial<typeof t>) => update((e) => ({ ...e, triage: { ...e.triage, ...patch } }));

  const latest = enc.vitals[enc.vitals.length - 1];
  const autoFlags = [
    ...SCREEN.filter((s) => t.screening[s.key]).map((s) => s.flag),
    ...(t.painScore >= 7 ? [`Severe pain ${t.painScore}/10`] : []),
    ...(latest && outOfRange("spo2", latest.spo2) ? [`SpO2 ${latest.spo2}%`] : []),
    ...(latest && outOfRange("hr", latest.hr) ? [`HR ${latest.hr}`] : []),
    ...(latest && outOfRange("temp", latest.temp) ? [`Temp ${latest.temp}`] : []),
    ...(patient.medications.some((m) => /warfarin|apixaban/i.test(m.name)) ? ["On anticoagulant"] : []),
  ];
  const flags = Array.from(new Set([...autoFlags, ...t.redFlags]));

  const fromLive = () => {
    if (!live) return;
    setV((s) => ({ ...s, hr: String(live.hr), spo2: String(live.spo2), sys: String(live.sys), dia: String(live.dia), rr: String(live.rr), temp: String(live.temp) }));
  };

  const saveVitals = () => {
    const n = (x: string) => (x.trim() === "" ? undefined : Number(x));
    actions.addVitals({
      source: role === "nurse" ? "nurse" : "doctor",
      hr: n(v.hr), spo2: n(v.spo2), sys: n(v.sys), dia: n(v.dia), rr: n(v.rr), temp: n(v.temp), glucose: n(v.glucose), weight: n(v.weight),
      pain: t.painScore, consciousness: v.consciousness, onOxygen: v.onOxygen,
    });
    setV(emptyV);
  };
  const anyV = ["hr", "spo2", "sys", "rr", "temp", "glucose", "weight"].some((k) => v[k as keyof VForm] !== "");

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        {pv?.completed && (
          <div className="rounded-lg border border-pulse-100 bg-pulse-50/60 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-pulse-700"><Smartphone className="h-3.5 w-3.5" />  <LocalizedText message={"Patient’s check-in answers"} /></p>
            <div className="flex flex-wrap gap-1.5">{pv.symptoms.map((s) => <Badge key={s} className="bg-white text-ink">{s}</Badge>)}</div>
            <p className="mt-1.5 text-[13px] text-ink">{pv.duration} · {tr("severity {value0}/10", { value0: pv.severity })}{pv.notes && <> · “{pv.notes}”</>}</p>
            <p className="mt-1 text-2xs text-ink-400">{tr("Recording consent {value0} · camera {value1} · mic {value2} · network {value3}", { value0: pv.recordingConsent ? tr("given") : tr("not given"), value1: pv.deviceCheck.camera ? tr("ok") : tr("failed"), value2: pv.deviceCheck.mic ? tr("ok") : tr("failed"), value3: pv.deviceCheck.network })}</p>
          </div>
        )}
        <Field label="Chief complaint">
          <Input value={t.chiefComplaint} disabled={locked} onChange={(e) => setT({ chiefComplaint: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Onset / duration"><Input value={t.onset} disabled={locked} onChange={(e) => setT({ onset: e.target.value })} placeholder="e.g. 3 days" /></Field>
          <Field label={tr("Pain score: {value0}/10", { value0: t.painScore })}>
            <SourceInput type="range" min={0} max={10} value={t.painScore} disabled={locked} onChange={(e) => setT({ painScore: Number(e.target.value) })} className="mt-2.5 w-full accent-pulse-500" aria-label="Pain score" />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-700"><LocalizedText message={"Screening"} /></p>
          <div className="grid grid-cols-2 gap-1.5">
            {SCREEN.filter((s) => !s.femaleOnly || patient.sex === "female").map((s) => {
              const on = !!t.screening[s.key];
              return (
                <SourceButton
                  key={s.key}
                  disabled={locked}
                  onClick={() => setT({ screening: { ...t.screening, [s.key]: !on } })}
                  aria-pressed={on}
                  className={cx("rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors", on ? "border-alarm-500 bg-alarm-50 text-alarm-600" : "border-line text-ink-700 hover:border-ink-200")}
                >
                  {on ? `${tr("Yes")} · ` : ""}{tr(s.label)}
                </SourceButton>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-700"><LocalizedText message={"Red flags"} /></p>
          {flags.length ? (
            <div className="flex flex-wrap gap-1.5">{flags.map((f) => <Badge key={f} className="bg-alarm-500 text-white">{f}</Badge>)}</div>
          ) : (
            <p className="text-xs text-ink-400"><LocalizedText message={"None identified yet. Flags appear from screening, pain score and vitals."} /></p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center">
            <p className="text-xs font-semibold text-ink"><LocalizedText message={"Record vitals"} /></p>
            <Button size="sm" variant="ghost" className="ml-auto" disabled={!live || locked} onClick={fromLive} icon={<Radio className="h-3.5 w-3.5" />}>
              
              <LocalizedText message={"Fill from demo feed"} />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([["hr", "HR"], ["spo2", "SpO2 %"], ["sys", "Systolic"], ["dia", "Diastolic"], ["rr", "Resp rate"], ["temp", "Temp °C"], ["glucose", "Glucose"], ["weight", "Weight kg"]] as const).map(([k, l]) => (
              <Field key={k} label={l}>
                <Input inputMode="decimal" value={v[k]} disabled={locked} onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") }))} className="tabular" />
              </Field>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <Field label="Consciousness (ACVPU)">
              <Select value={v.consciousness} disabled={locked} onChange={(e) => setV((s) => ({ ...s, consciousness: e.target.value as VForm["consciousness"] }))}>
                <option value="alert">{tr("Alert")}</option><option value="confused">{tr("New confusion")}</option><option value="voice">{tr("Voice")}</option><option value="pain">{tr("Pain")}</option><option value="unresponsive">{tr("Unresponsive")}</option>
              </Select>
            </Field>
            <label className="mb-2 flex items-center gap-1.5 text-[13px] text-ink"><SourceInput type="checkbox" className="accent-pulse-500" checked={v.onOxygen} disabled={locked} onChange={(e) => setV((s) => ({ ...s, onOxygen: e.target.checked }))} />  <LocalizedText message={"On supplemental oxygen"} /></label>
            <Button variant="primary" size="sm" className="mb-0.5 ml-auto" disabled={!anyV || locked} onClick={saveVitals}><LocalizedText message={"Save vitals"} /></Button>
          </div>
          {enc.vitals.length > 0 && (
            <Table className="mt-3 w-full text-xs tabular">
              <TableHeader className="text-left text-ink-400"><TableRow><TableHead className="py-1 font-medium"><LocalizedText message={"Time"} /></TableHead><TableHead className="font-medium"><LocalizedText message={"Source"} /></TableHead><TableHead className="font-medium"><LocalizedText message={"HR"} /></TableHead><TableHead className="font-medium"><LocalizedText message={"BP"} /></TableHead><TableHead className="font-medium"><LocalizedText message={"SpO2"} /></TableHead><TableHead className="font-medium"><LocalizedText message={"RR"} /></TableHead><TableHead className="font-medium"><LocalizedText message={"T"} /></TableHead></TableRow></TableHeader>
              <TableBody className="divide-y divide-line">
                {[...enc.vitals].reverse().map((x) => (
                  <TableRow key={x.id} className="text-ink">
                    <TableCell className="py-1">{fmtTime(x.recordedAt)}</TableCell><TableCell className="capitalize text-ink-400">{tr(x.source[0].toUpperCase() + x.source.slice(1))}</TableCell>
                    <TableCell className={cx(outOfRange("hr", x.hr) && "font-semibold text-alarm-500")}>{x.hr ?? "–"}</TableCell>
                    <TableCell className={cx(outOfRange("sys", x.sys) && "font-semibold text-alarm-500")}>{x.sys ? `${x.sys}/${x.dia}` : "–"}</TableCell>
                    <TableCell className={cx(outOfRange("spo2", x.spo2) && "font-semibold text-alarm-500")}>{x.spo2 ?? "–"}</TableCell>
                    <TableCell>{x.rr ?? "–"}</TableCell><TableCell className={cx(outOfRange("temp", x.temp) && "font-semibold text-alarm-500")}>{x.temp ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <Field label="Nursing note">
          <Textarea rows={4} value={t.nurseNote} disabled={locked} onChange={(e) => setT({ nurseNote: e.target.value })} placeholder="History taken, observations, education given, concerns for the doctor" />
        </Field>
        {t.completedBy ? (
          <p className="text-xs text-ink-400">{t.completedAt ? tr("Triage completed at {value0}.", { value0: fmtTime(t.completedAt) }) : tr("Triage completed.")}</p>
        ) : role === "nurse" && !locked ? (
          <Button variant="primary" className="w-full" loading={handingOff} disabled={!t.chiefComplaint || !enc.vitals.length} onClick={onHandoff} icon={<ArrowRightCircle className="h-4 w-4" />}>
            
            <LocalizedText message={"Complete triage and hand off to doctor"} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
