"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceButton } from "@pepbits/ops-ui";

import { useMemo, useState } from "react";
import { useSourceApi, ApiError } from "./../../lib/api";
import { useLookups } from "./../../lib/masters";
import { useSourceFormat} from "./../../lib/format";
import { Badge, Button, ErrorNote, Field, PanelHeader, Segmented, Select, cx, useAction } from "../ui";
import { IconDrop, IconFlask, IconXray } from "../icons";
import type { CaseBundle, TabProps } from "./types";

const LIVE = ["IN_OR", "IN_SURGERY", "RECOVERY"];

export function AnesthesiaTab({ c, reload }: TabProps) {
 const {t:translateSource}=useLocalization();
 const {time}=useSourceFormat();
 const api=useSourceApi();
  const lookups = useLookups();
  const live = LIVE.includes(c.status);
  const [v, setV] = useState({ hr: "", sbp: "", dbp: "", spo2: "", etco2: "", temp: "" });
  const [drug, setDrug] = useState({ name: "", dose: "", unit: "mg", route: "IV" });
  const [override, setOverride] = useState({ on: false, reason: "" });
  const [ebl, setEbl] = useState(c.ebl_ml === null ? "" : String(c.ebl_ml));
  const vitals = useAction();
  const meds = useAction();
  const eblAct = useAction();
  const drugs = (lookups.DRUG ?? []).map((d) => {
    const [name, unit, route] = d.split("|");
    return { name, unit, route };
  });
  const latest = c.vitals[c.vitals.length - 1];
  const allergyBlock = meds.error instanceof ApiError && meds.error.data.allergy;

  return (
    <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
      <section className="panel flex flex-col">
        <PanelHeader title="Vital signs">
          <span className="flex items-center gap-3 text-[12px] text-muted">
            <Legend color="#c8413b" label="HR" /> <Legend color="#4a64b0" label="BP" /> <Legend color="#2e8b62" label="SpO₂" />
          </span>
        </PanelHeader>
        <div className="p-3">
          <VitalsChart c={c} />
        </div>
        <div className="grid grid-cols-3 gap-px border-y border-line bg-line sm:grid-cols-6">
          {[
            ["HR", latest?.hr, "bpm"],
            ["BP", latest ? `${latest.sbp ?? "—"}/${latest.dbp ?? "—"}` : null, "mmHg"],
            ["SpO₂", latest?.spo2, "%"],
            ["EtCO₂", latest?.etco2, "mmHg"],
            ["Temp", latest?.temp, "°C"],
            ["Readings", c.vitals.length, ""],
          ].map(([k, val, u]) => (
            <div key={k as string} className="bg-white px-3 py-2">
              <div className="text-[11px] text-muted">{k}</div>
              <div className="font-cond text-[19px] font-semibold leading-tight">{val ?? "—"} <span className="text-[11px] font-normal text-muted">{u}</span></div>
            </div>
          ))}
        </div>
        {live ? (
          <form
            className="flex flex-wrap items-end gap-2 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await vitals.run(() => api(`/cases/${c.id}/vitals`, { body: v }), "Vitals recorded");
              if (ok) { setV({ hr: "", sbp: "", dbp: "", spo2: "", etco2: "", temp: "" }); reload(); }
            }}
          >
            {(["hr", "sbp", "dbp", "spo2", "etco2", "temp"] as const).map((k) => (
              <Field key={k} label={{ hr: "HR", sbp: "Systolic", dbp: "Diastolic", spo2: "SpO₂", etco2: "EtCO₂", temp: "Temp °C" }[k]} className="w-[84px]">
                <SourceInput className="input" inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
              </Field>
            ))}
            <Button type="submit" variant="primary" busy={vitals.busy} disabled={!Object.values(v).some(Boolean)}><LocalizedText message={"Record vitals"}/></Button>
            <ErrorNote error={vitals.error} className="w-full" />
          </form>
        ) : (
          <p className="p-4 text-[13px] text-muted"><LocalizedText message={"Vitals can be recorded once the patient is in the room. Monitors connected through an HL7 gateway would post here automatically."}/></p>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <section className="panel">
          <PanelHeader title="Drugs given" />
          {live && (
            <div className="space-y-2 border-b border-line p-4">
              <div className="flex flex-wrap gap-1">
                {drugs.slice(0, 10).map((d) => (
                  <SourceButton key={d.name} onClick={() => setDrug({ name: d.name, unit: d.unit, route: d.route, dose: "" })} className={cx("rounded-[5px] border px-2 py-0.5 text-[12px]", drug.name === d.name ? "border-ceil bg-ceil-soft text-ceil-2" : "border-line hover:bg-steel")}>
                    {d.name}
                  </SourceButton>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_80px_70px_auto] items-end gap-2">
                <Field label="Drug"><Select value={drug.name} placeholder="Choose" onChange={(e) => { const d = drugs.find((x) => x.name === e.target.value); if (d) setDrug({ ...drug, name: d.name, unit: d.unit, route: d.route }); }} options={drugs.map((d) => d.name)} /></Field>
                <Field label={translateSource("Dose ({value0})",{value0:drug.unit})}><SourceInput className="input" inputMode="decimal" value={drug.dose} onChange={(e) => setDrug({ ...drug, dose: e.target.value })} /></Field>
                <Field label="Route"><SourceInput className="input" value={drug.route} onChange={(e) => setDrug({ ...drug, route: e.target.value })} /></Field>
                <Button
                  variant={allergyBlock && override.on ? "danger" : "primary"}
                  busy={meds.busy}
                  disabled={!drug.name || !drug.dose || (allergyBlock && override.on && !override.reason)}
                  onClick={async () => {
                    const ok = await meds.run(() => api(`/cases/${c.id}/meds`, { body: { drug: drug.name, dose: Number(drug.dose), unit: drug.unit, route: drug.route, overrideAllergy: allergyBlock && override.on, overrideReason: override.reason } }), `${drug.name} recorded`);
                    if (ok) { setDrug({ ...drug, dose: "" }); setOverride({ on: false, reason: "" }); reload(); }
                  }}
                >
                  {allergyBlock && override.on ? "Give anyway" : "Record"}
                </Button>
              </div>
              <ErrorNote error={meds.error} />
              {allergyBlock && (
                <div className="space-y-2 rounded-[6px] border border-[#ecc6c2] p-2">
                  <label className="flex items-center gap-2 text-[13px]"><SourceInput type="checkbox" checked={override.on} onChange={(e) => setOverride({ ...override, on: e.target.checked })} /> {" "}<LocalizedText message={"Override the allergy alert"}/></label>
                  {override.on && <SourceInput className="input" placeholder="Clinical reason for overriding" value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} />}
                </div>
              )}
            </div>
          )}
          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {c.meds.length === 0 && <li className="px-4 py-4 text-[13px] text-muted"><LocalizedText message={"No drugs recorded."}/></li>}
            {[...c.meds].reverse().map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-1.5 text-[13px]">
                <span className="w-11 font-cond font-semibold text-muted">{time(m.ts)}</span>
                <span className="flex-1 font-medium">{m.drug}</span>
                <span>{m.dose} {m.unit}</span>
                <span className="w-20 text-right text-[12px] text-muted">{m.route}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <PanelHeader title="Estimated blood loss" />
          <div className="flex items-end gap-2 p-4">
            <Field label="Total so far (ml)" className="flex-1">
              <SourceInput className="input" inputMode="numeric" value={ebl} onChange={(e) => setEbl(e.target.value)} disabled={c.report.status === "Signed"} />
            </Field>
            <Button busy={eblAct.busy} disabled={ebl === String(c.ebl_ml ?? "")} onClick={() => eblAct.run(() => api(`/cases/${c.id}`, { method: "PATCH", body: { ebl_ml: ebl === "" ? null : Number(ebl) } }), "Blood loss saved").then((r) => r && reload())}><LocalizedText message={"Save"}/></Button>
          </div>
          <ErrorNote error={eblAct.error} className="mx-4 mb-4" />
          <p className="px-4 pb-3 text-[12px] text-muted"><LocalizedText message={"Used for the Surgical Apgar score together with the lowest heart rate and mean arterial pressure."}/></p>
        </section>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ background: color }} />{label}</span>;
}

function VitalsChart({ c }: { c: CaseBundle }) {
 const {time}=useSourceFormat();
  const W = 760, H = 230, L = 34, R = 10, T = 10, B = 24;
  const pts = c.vitals;
  const marks = c.milestones.filter((m) => ["INDUCTION_DONE", "INCISION", "CLOSURE_END", "ANES_END"].includes(m.code));
  const domain = useMemo(() => {
    const times = [...pts.map((p) => Date.parse(p.ts)), ...marks.map((m) => Date.parse(m.ts))];
    if (!times.length) return null;
    const lo = Math.min(...times), hi = Math.max(...times, lo + 30 * 60000);
    return { lo, hi };
  }, [pts, marks]);
  if (!domain) return <div className="flex h-[230px] items-center justify-center rounded-[8px] bg-steel/60 text-[13px] text-muted"><LocalizedText message={"The chart appears when the first set of vitals is recorded."}/></div>;
  const x = (iso: string) => L + ((Date.parse(iso) - domain.lo) / (domain.hi - domain.lo)) * (W - L - R);
  const y = (v: number) => T + (1 - v / 200) * (H - T - B);
  const line = (k: "hr" | "spo2") => pts.filter((p) => p[k] !== null).map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p[k]!).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let t = Math.ceil(domain.lo / 900000) * 900000; t <= domain.hi; t += 900000) ticks.push(t);
  const label: Record<string, string> = { INDUCTION_DONE: "Induction", INCISION: "Incision", CLOSURE_END: "Closure", ANES_END: "Anes end" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Intra-operative vital signs chart">
      {[0, 50, 100, 150, 200].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e2e7ea" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#8a979e">{v}</text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={x(new Date(t).toISOString())} y={H - 6} textAnchor="middle" fontSize="10" fill="#8a979e">{time(new Date(t).toISOString())}</text>
      ))}
      {marks.map((m) => (
        <g key={m.code}>
          <line x1={x(m.ts)} x2={x(m.ts)} y1={T} y2={H - B} stroke="#0f3d3a" strokeDasharray="3 3" opacity={0.5} />
          <text x={x(m.ts) + 3} y={T + 9} fontSize="10" fill="#0f3d3a">{label[m.code]}</text>
        </g>
      ))}
      {pts.filter((p) => p.sbp !== null && p.dbp !== null).map((p) => (
        <g key={p.id} stroke="#4a64b0" strokeWidth={1.4}>
          <line x1={x(p.ts)} x2={x(p.ts)} y1={y(p.sbp!)} y2={y(p.dbp!)} opacity={0.35} />
          <path d={`M${x(p.ts) - 4},${y(p.sbp!) - 4} L${x(p.ts)},${y(p.sbp!)} L${x(p.ts) + 4},${y(p.sbp!) - 4}`} fill="none" />
          <path d={`M${x(p.ts) - 4},${y(p.dbp!) + 4} L${x(p.ts)},${y(p.dbp!)} L${x(p.ts) + 4},${y(p.dbp!) + 4}`} fill="none" />
        </g>
      ))}
      <path d={line("hr")} fill="none" stroke="#c8413b" strokeWidth={1.8} />
      {pts.filter((p) => p.hr !== null).map((p) => <circle key={p.id} cx={x(p.ts)} cy={y(p.hr!)} r={2.2} fill="#c8413b" />)}
      <path d={line("spo2")} fill="none" stroke="#2e8b62" strokeWidth={1.8} />
    </svg>
  );
}

const KIND_ICON = { IMAGING: IconXray, LAB: IconFlask, BLOOD: IconDrop };

export function OrdersTab({ c, reload }: TabProps) {
 const {t:translateSource}=useLocalization();
 const api=useSourceApi();
  const lookups = useLookups();
  const [kind, setKind] = useState<"IMAGING" | "LAB" | "BLOOD">("IMAGING");
  const [test, setTest] = useState("");
  const [qty, setQty] = useState("2");
  const [priority, setPriority] = useState("STAT");
  const { run, busy, error } = useAction();
  const options = kind === "IMAGING" ? lookups.IMAGING : kind === "LAB" ? lookups.LAB : lookups.BLOOD;
  const radiation = c.orders.reduce((a, o) => a + (o.radiation_mgy ?? 0), 0);
  const fluoro = c.orders.reduce((a, o) => a + (o.fluoro_sec ?? 0), 0);
  const canOrder = c.status !== "CANCELLED" && c.status !== "COMPLETED";

  return (
    <div className="grid gap-3 xl:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-3">
        <section className="panel">
          <PanelHeader title="New order" />
          <div className="space-y-3 p-4">
            <Segmented value={kind} onChange={(k) => { setKind(k); setTest(""); }} options={[{ value: "IMAGING", label: "Imaging" }, { value: "LAB", label: "Lab" }, { value: "BLOOD", label: "Blood" }]} />
            <Field label={kind === "BLOOD" ? "Product" : "Test"}><Select value={test} placeholder="Choose" onChange={(e) => setTest(e.target.value)} options={options ?? []} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Priority"><Select value={priority} onChange={(e) => setPriority(e.target.value)} options={["STAT", "Urgent", "Routine"]} /></Field>
              {kind === "BLOOD" && <Field label="Units"><SourceInput className="input" type="number" min={1} max={10} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
            </div>
            <Button variant="primary" className="w-full" disabled={!test || !canOrder} busy={busy} onClick={() => run(() => api(`/cases/${c.id}/orders`, { body: { kind, test, priority, quantity: kind === "BLOOD" ? Number(qty) : undefined } }), "Order placed").then((r) => { if (r) { setTest(""); reload(); } })}>
              <LocalizedText message={"Place order"}/></Button>
            <ErrorNote error={error} />
            {kind === "BLOOD" && <p className="text-[12px] text-muted"><LocalizedText message={"Two staff check the patient band against each unit at the bedside. Record the check in the result."}/></p>}
          </div>
        </section>
        <section className="panel grid grid-cols-2 divide-x divide-line">
          <div className="px-4 py-3"><div className="text-[11px] text-muted"><LocalizedText message={"Radiation dose"}/></div><div className="font-cond text-[20px] font-semibold">{radiation.toFixed(1)} <span className="text-[12px] font-normal"><LocalizedText message={"mGy"}/></span></div></div>
          <div className="px-4 py-3"><div className="text-[11px] text-muted"><LocalizedText message={"Fluoroscopy time"}/></div><div className="font-cond text-[20px] font-semibold">{fluoro} <span className="text-[12px] font-normal"><LocalizedText message={"s"}/></span></div></div>
        </section>
      </div>

      <section className="panel">
        <PanelHeader title={translateSource("Orders ({value0})",{value0:c.orders.length})} />
        <ul className="divide-y divide-line">
          {c.orders.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-muted"><LocalizedText message={"No intra-operative orders. Imaging such as C-arm, frozen sections and blood products are ordered here."}/></li>}
          {c.orders.map((o) => <OrderRow key={o.id} o={o} caseId={c.id} reload={reload} />)}
        </ul>
      </section>
    </div>
  );
}

function OrderRow({ o, caseId, reload }: { o: CaseBundle["orders"][number]; caseId: number; reload: () => void }) {
 const {time,dateTime}=useSourceFormat();
 const api=useSourceApi();
  const Icon = KIND_ICON[o.kind as keyof typeof KIND_ICON] ?? IconFlask;
  const [r, setR] = useState({ result: "", critical: false, radiationMgy: "", fluoroSec: "" });
  const { run, busy, error } = useAction();
  return (
    <li className={cx("px-4 py-3", o.critical && "bg-stop-soft/50")}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{o.test}{o.quantity ? ` × ${o.quantity}` : ""}</span>
            <Badge tone={o.status === "Resulted" ? "go" : o.status === "In progress" ? "violet" : "amber"}>{o.status}</Badge>
            {o.priority !== "Routine" && <Badge tone="neutral">{o.priority}</Badge>}
            {!!o.critical && <Badge tone="stop"><LocalizedText message={"Critical"}/></Badge>}
          </div>
          <div className="text-[12px] text-muted"><LocalizedText message={"Ordered by"}/>{" "}{o.ordered_by_name}, {dateTime(o.ordered_at)}{o.resulted_at ? `. Resulted ${time(o.resulted_at)}` : ""}</div>
          {o.result && <p className="mt-1 text-[13px]">{o.result}</p>}
          {(o.radiation_mgy || o.fluoro_sec) && <p className="text-[12px] text-muted">{o.radiation_mgy ?? 0} {" "}<LocalizedText message={"mGy,"}/>{" "}{o.fluoro_sec ?? 0} {" "}<LocalizedText message={"s fluoroscopy"}/></p>}
        </div>
      </div>
      {o.status !== "Resulted" && (
        <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-[1fr_auto]">
          <SourceInput className="input" placeholder={o.kind === "BLOOD" ? "Units given, bedside check by…" : "Enter result"} value={r.result} onChange={(e) => setR({ ...r, result: e.target.value })} />
          <div className="flex items-center gap-2">
            {o.kind === "IMAGING" && (
              <>
                <SourceInput className="input w-20" placeholder="mGy" value={r.radiationMgy} onChange={(e) => setR({ ...r, radiationMgy: e.target.value })} />
                <SourceInput className="input w-20" placeholder="sec" value={r.fluoroSec} onChange={(e) => setR({ ...r, fluoroSec: e.target.value })} />
              </>
            )}
            <label className="flex items-center gap-1 text-[12px]"><SourceInput type="checkbox" checked={r.critical} onChange={(e) => setR({ ...r, critical: e.target.checked })} /> {" "}<LocalizedText message={"Critical"}/></label>
            <Button size="sm" variant="primary" busy={busy} disabled={!r.result} onClick={() => run(() => api(`/cases/${caseId}/orders/${o.id}`, { method: "PATCH", body: { status: "Resulted", ...r } }), "Result saved").then((x) => x && reload())}><LocalizedText message={"Save result"}/></Button>
          </div>
          <ErrorNote error={error} className="sm:col-span-2" />
        </div>
      )}
    </li>
  );
}
