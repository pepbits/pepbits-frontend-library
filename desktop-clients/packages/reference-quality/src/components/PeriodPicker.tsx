"use client";
import { LocalizedText } from "@pepbits/ops-ui";

import { useMeta } from "../lib/auth";
import { useQualityFormat } from "../lib/format";
import { Select } from "./ui";

export function quarterOptions(periods: string[]) {
  const qs = new Map<string, { from: string; to: string }>();
  for (const p of periods) {
    const [y, m] = p.split("-").map(Number);
    const q = Math.floor((m - 1) / 3) + 1;
    const key = `Q${q} ${y}`;
    const start = `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}`;
    const end = `${y}-${String(q * 3).padStart(2, "0")}`;
    if (periods.includes(start) && periods.includes(end)) qs.set(key, { from: start, to: end });
  }
  return [...qs.entries()].reverse();
}

export function PeriodPicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const { fmtPeriod } = useQualityFormat();
  const meta = useMeta();
  const periods = [...meta.periods].reverse();
  const quarters = quarterOptions(meta.periods);
  const currentQuarter = quarters.find(([, r]) => r.from === from && r.to === to)?.[0] ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Quarter" className="w-32" value={currentQuarter} onChange={(e) => {
        const q = quarters.find(([k]) => k === e.target.value);
        if (q) onChange(q[1].from, q[1].to);
      }}>
        <option value=""><LocalizedText message="Quarter" /></option>
        {quarters.map(([k]) => (
          <option key={k}>{k}</option>
        ))}
      </Select>
      <Select aria-label="From month" className="w-32" value={from} onChange={(e) => onChange(e.target.value, e.target.value > to ? e.target.value : to)}>
        {periods.map((p) => (
          <option key={p} value={p}>
            {fmtPeriod(p)}
          </option>
        ))}
      </Select>
      <span className="text-sm text-ink-3"><LocalizedText message="to" /></span>
      <Select aria-label="To month" className="w-32" value={to} onChange={(e) => onChange(e.target.value < from ? e.target.value : from, e.target.value)}>
        {periods.map((p) => (
          <option key={p} value={p}>
            {fmtPeriod(p)}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function FacilityPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const meta = useMeta();
  return (
    <Select
      aria-label="Facilities"
      className="w-56"
      value={value.length === 1 ? String(value[0]) : value.length ? "custom" : ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange([]);
        else if (v === "AD") onChange(meta.facilities.filter((f) => f.jurisdiction === "Abu Dhabi").map((f) => f.id));
        else if (v === "DXB") onChange(meta.facilities.filter((f) => f.jurisdiction === "Dubai").map((f) => f.id));
        else if (v !== "custom") onChange([Number(v)]);
      }}
    >
      <option value=""><LocalizedText message="All facilities" /></option>
      <option value="AD"><LocalizedText message="Abu Dhabi facilities" /></option>
      <option value="DXB"><LocalizedText message="Dubai facilities" /></option>
      {value.length > 1 && <option value="custom"><LocalizedText message="{value0} facilities" values={{ value0: value.length }} /></option>}
      {meta.facilities.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </Select>
  );
}
