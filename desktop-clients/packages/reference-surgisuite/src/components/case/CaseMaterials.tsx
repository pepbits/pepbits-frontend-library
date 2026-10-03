"use client";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, Table } from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { useSourceApi } from "./../../lib/api";
import { useSourceFormat} from "./../../lib/format";
import { Badge, Button, ErrorNote, PanelHeader, Select, cx, useAction } from "../ui";
import { CodePicker } from "../BookCase";
import type { CaseBundle, TabProps } from "./types";

type Inv = { id: number; sku: string; name: string; category: string; available: number; uom: string; expiry: string | null };

export function MaterialsTab({ c, reload }: TabProps) {
 const {money}=useSourceFormat();
 const api=useSourceApi();
  const [inv, setInv] = useState<Inv[]>([]);
  const { run, busy, error } = useAction();
  useEffect(() => {
    api<Inv[]>("/inventory").then(setInv).catch(() => {});
  }, []);
  const locked = c.status === "CANCELLED" || c.report.status === "Signed";
  const started = ["IN_SURGERY", "RECOVERY", "COMPLETED"].includes(c.status);
  const pending = c.items.filter((i) => !i.consumed);
  const groups = ["Instrument tray", "Implant", "Consumable", "Suture"].map((g) => ({ g, rows: c.items.filter((i) => i.category === g) })).filter((x) => x.rows.length);
  const implantCost = c.items.filter((i) => i.is_implant).reduce((a, i) => a + i.qty_used * i.unit_cost, 0);
  const supplyCost = c.items.filter((i) => !i.is_implant).reduce((a, i) => a + i.qty_used * i.unit_cost, 0);

  const patch = (row: CaseBundle["items"][number], body: Record<string, unknown>) =>
    run(() => api(`/cases/${c.id}/items/${row.id}`, { method: "PATCH", body })).then((r) => r && reload());

  return (
    <section className="panel">
      <PanelHeader title="Pick list and usage">
        {!locked && (
          <div className="w-72">
            <CodePicker
              label=""
              items={inv}
              itemKey={(i) => i.id}
              render={(i) => (<><span className="font-medium">{i.name}</span> <span className="text-muted">{i.sku}, {i.available} {i.uom} {" "}<LocalizedText message={"free"}/></span></>)}
              match={(i, q) => `${i.name} ${i.sku}`.toLowerCase().includes(q)}
              onPick={(i) => run(() => api<{ warning: string | null }>(`/cases/${c.id}/items`, { body: { itemId: i.id, qty: 1 } }), `${i.name} added`).then((r) => r && reload())}
            />
          </div>
        )}
        {!locked && started && pending.length > 0 && (
          <>
            <Button size="sm" busy={busy} onClick={async () => {
              for (const r of pending.filter((x) => x.qty_used === 0)) await api(`/cases/${c.id}/items/${r.id}`, { method: "PATCH", body: { qtyUsed: r.qty_planned } });
              reload();
            }}><LocalizedText message={"Use as planned"}/></Button>
            <Button size="sm" variant="primary" busy={busy} onClick={() => run(() => api(`/cases/${c.id}/items/post`, { body: {} }), "Usage posted to inventory").then((r) => r && reload())}><LocalizedText message={"Post usage"}/></Button>
          </>
        )}
      </PanelHeader>
      <ErrorNote error={error} className="m-4" />
      <div className="scroll-x">
        <Table className="w-full min-w-[920px] text-[13px]">
          <thead className="bg-steel/60 text-left text-[12px] text-muted">
            <tr>
              <th className="px-4 py-2 font-medium"><LocalizedText message={"Item"}/></th>
              <th className="px-2 py-2 font-medium"><LocalizedText message={"Planned"}/></th>
              <th className="px-2 py-2 font-medium"><LocalizedText message={"Used"}/></th>
              <th className="px-2 py-2 font-medium"><LocalizedText message={"Wasted"}/></th>
              <th className="px-2 py-2 font-medium"><LocalizedText message={"Lot"}/></th>
              <th className="px-2 py-2 font-medium"><LocalizedText message={"Serial"}/></th>
              <th className="px-2 py-2 font-medium"><LocalizedText message={"Stock"}/></th>
              <th className="px-4 py-2 text-right font-medium"><LocalizedText message={"Cost"}/></th>
            </tr>
          </thead>
          {groups.map(({ g, rows }) => (
            <tbody key={g} className="divide-y divide-line">
              <tr className="bg-steel/30"><td colSpan={8} className="px-4 py-1 text-[12px] font-semibold text-muted">{g === "Instrument tray" ? "Instrument trays" : `${g}s`}</td></tr>
              {rows.map((r) => {
                const editable = !locked && !r.consumed;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-1.5">
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-[11px] text-muted">
                        {r.sku}
                        {r.category === "Instrument tray" && <Badge tone={r.sterile_status === "Sterile" ? "go" : "amber"} className="ml-2">{r.sterile_status}</Badge>}
                        {r.consumed ? <Badge tone="muted" className="ml-2"><LocalizedText message={"Posted"}/></Badge> : null}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">{r.qty_planned}</td>
                    {(["qty_used", "qty_wasted"] as const).map((k) => (
                      <td key={k} className="w-20 px-2 py-1.5">
                        <SourceInput type="number" min={0} disabled={!editable || !started} className="input h-8" defaultValue={r[k]} key={`${r.id}${k}${r[k]}`} onBlur={(e) => Number(e.target.value) !== r[k] && patch(r, { [k === "qty_used" ? "qtyUsed" : "qtyWasted"]: Number(e.target.value) })} />
                      </td>
                    ))}
                    {(["lot_no", "serial_no"] as const).map((k) => (
                      <td key={k} className="w-32 px-2 py-1.5">
                        {r.is_implant ? (
                          <SourceInput disabled={!editable} className={cx("input h-8", r.qty_used > 0 && !r[k] && "border-amber")} defaultValue={r[k] ?? ""} key={`${r.id}${k}${r[k]}`} placeholder="Scan" onBlur={(e) => e.target.value !== (r[k] ?? "") && patch(r, { [k === "lot_no" ? "lotNo" : "serialNo"]: e.target.value })} />
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    ))}
                    <td className={cx("px-2 py-1.5", r.stock_qty < r.qty_planned && !r.consumed && "font-semibold text-stop")}>{r.stock_qty}</td>
                    <td className="px-4 py-1.5 text-right">{r.unit_cost ? money(r.unit_cost * r.qty_used) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px]">
        <span className="text-muted"><LocalizedText message={"The pick list comes from the procedure preference cards. Implants need lot and serial numbers before usage can be posted."}/></span>
        <span className="flex gap-4">
          <span><LocalizedText message={"Supplies"}/>{" "}<b>{money(supplyCost)}</b></span>
          <span><LocalizedText message={"Implants"}/>{" "}<b>{money(implantCost)}</b></span>
        </span>
      </div>
    </section>
  );
}

const RCRI_ITEMS: [string, string][] = [
  ["highRiskSurgery", "High-risk surgery (intraperitoneal, intrathoracic or suprainguinal vascular)"],
  ["ischemicHeartDisease", "Ischemic heart disease"],
  ["heartFailure", "History of congestive heart failure"],
  ["cerebrovascularDisease", "Cerebrovascular disease"],
  ["insulinDiabetes", "Diabetes treated with insulin"],
  ["creatinineOver2", "Creatinine above 2 mg/dL"],
];

const ALDRETE: [string, string[]][] = [
  ["activity", ["Can't move limbs", "Moves 2 limbs", "Moves 4 limbs"]],
  ["respiration", ["Apneic", "Shallow or limited breathing", "Breathes deeply, coughs"]],
  ["circulation", ["BP ±50% of baseline", "BP ±20–50%", "BP within 20%"]],
  ["consciousness", ["Not responding", "Rousable", "Fully awake"]],
  ["oxygenation", ["SpO₂ <90% with O₂", "Needs O₂ for >90%", "SpO₂ >92% on air"]],
];

export function ScoresTab({ c, reload }: TabProps) {
 const {dateTime}=useSourceFormat();
 const api=useSourceApi();
  const [rcri, setRcri] = useState<Record<string, boolean>>(c.rcri ?? {});
  const [ald, setAld] = useState<Record<string, number>>({ activity: 2, respiration: 2, circulation: 2, consciousness: 2, oxygenation: 2 });
  const { run, busy, error } = useAction();
  const last = (k: string) => c.scores.find((s) => s.kind === k);
  const record = (kind: string, inputs?: unknown) => run(() => api(`/cases/${c.id}/scores`, { body: { kind, inputs } }), "Score recorded").then((r) => r && reload());
  const rcriCount = Object.values(rcri).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <ErrorNote error={error} />
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <ScoreCard title="ASA physical status" value={c.asa_class} band={{ I: "Healthy", II: "Mild systemic disease", III: "Severe systemic disease", IV: "Constant threat to life", V: "Not expected to survive without surgery" }[c.asa_class.replace("E", "")] ?? ""} note="Set on the overview tab. E marks an emergency." />
        <ScoreCard title="Surgical Apgar" value={last("SURGICAL_APGAR")?.value} band={last("SURGICAL_APGAR")?.band} details={last("SURGICAL_APGAR")?.details} note="Calculated from blood loss, lowest mean arterial pressure and lowest heart rate.">
          <Button size="sm" busy={busy} onClick={() => record("SURGICAL_APGAR")}><LocalizedText message={"Calculate now"}/></Button>
        </ScoreCard>
        <ScoreCard title="NNIS infection risk" value={last("NNIS")?.value} band={last("NNIS")?.band} details={last("NNIS")?.details} note="ASA 3 or more, contaminated wound, and operating time above the 75th percentile each add a point.">
          <Button size="sm" busy={busy} onClick={() => record("NNIS")}><LocalizedText message={"Calculate now"}/></Button>
        </ScoreCard>
        <ScoreCard title="Revised Cardiac Risk Index" value={last("RCRI")?.value ?? rcriCount} band={last("RCRI")?.band} note="Pre-operative cardiac risk.">
          <ul className="mb-2 space-y-1">
            {RCRI_ITEMS.map(([k, label]) => (
              <li key={k}>
                <label className="flex items-start gap-2 text-[12px]"><SourceInput type="checkbox" className="mt-0.5" checked={!!rcri[k]} onChange={(e) => setRcri({ ...rcri, [k]: e.target.checked })} />{label}</label>
              </li>
            ))}
          </ul>
          <Button size="sm" busy={busy} onClick={() => record("RCRI", rcri)}><LocalizedText message={"Save RCRI"}/></Button>
        </ScoreCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel">
          <PanelHeader title="Aldrete recovery score">
            <span className="font-cond text-[20px] font-semibold">{Object.values(ald).reduce((a, b) => a + b, 0)}/10</span>
          </PanelHeader>
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {ALDRETE.map(([k, opts]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-[12px] font-medium capitalize text-muted">{k}</span>
                <Select value={String(ald[k])} onChange={(e) => setAld({ ...ald, [k]: Number(e.target.value) })} options={opts.map((o, i) => ({ value: String(i), label: `${i}: ${o}` }))} />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <span className="text-[12px] text-muted"><LocalizedText message={"A score of 9 or more is required to record PACU discharge."}/></span>
            <Button variant="primary" busy={busy} disabled={!["RECOVERY", "COMPLETED"].includes(c.status)} onClick={() => record("ALDRETE", ald)}><LocalizedText message={"Record score"}/></Button>
          </div>
        </section>
        <section className="panel">
          <PanelHeader title="Score history" />
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {c.scores.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted"><LocalizedText message={"No scores recorded yet."}/></li>}
            {c.scores.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <span className="w-32 font-medium">{s.kind.replace(/_/g, " ").toLowerCase().replace(/^./, (x) => x.toUpperCase())}</span>
                <span className="font-cond text-[18px] font-semibold">{s.value}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{s.band}</span>
                <span className="text-[12px] text-muted">{s.recorded_by_name}, {dateTime(s.ts)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ScoreCard({ title, value, band, details, note, children }: { title: string; value?: number | string; band?: string; details?: string; note: string; children?: React.ReactNode }) {
  const d = details ? (JSON.parse(details) as Record<string, unknown>) : null;
  return (
    <section className="panel flex flex-col p-4">
      <h3 className="font-cond text-[15px] font-semibold">{title}</h3>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-cond text-[34px] font-semibold leading-none">{value ?? "—"}</span>
        {band && <span className="text-[13px] text-muted">{band}</span>}
      </div>
      {d && (
        <p className="mt-2 text-[12px] text-muted">
          {Object.entries(d).filter(([, v]) => typeof v !== "object").map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()} ${v}`).join(", ")}
        </p>
      )}
      <p className="mt-2 flex-1 text-[12px] text-faint">{note}</p>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

