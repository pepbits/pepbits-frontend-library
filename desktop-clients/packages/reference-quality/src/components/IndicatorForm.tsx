"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { useQualityApi } from "../lib/api";
import { useMeta } from "../lib/auth";
import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from "./ui";
import { useToast } from "./toast";
import type { Indicator } from "../lib/types";

const EMPTY = {
  code: "",
  name: "",
  domain: "",
  program: "Internal",
  category: "process",
  unit: "percent",
  direction: "higher",
  target: "",
  warning: "",
  numerator_def: "",
  denominator_def: "",
  exclusions: "",
  frequency: "monthly",
  facility_types: ["hospital"] as string[],
  min_sample: "30",
  owner_id: "",
  status: "active",
};

export function IndicatorForm({ open, onClose, indicator, onSaved }: { open: boolean; onClose: () => void; indicator?: Indicator | null; onSaved: (id: number) => void }) {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const meta = useMeta();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      indicator
        ? {
            ...EMPTY,
            ...Object.fromEntries(Object.entries(indicator).map(([k, v]) => [k, v === null ? "" : typeof v === "number" ? String(v) : v])),
            facility_types: indicator.facility_types,
          }
        : EMPTY,
    );
  }, [open, indicator]);

  const set = (k: keyof typeof EMPTY, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const isEvents = indicator?.source === "events";

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...form, target: Number(form.target), warning: Number(form.warning), min_sample: Number(form.min_sample), owner_id: form.owner_id ? Number(form.owner_id) : null };
    try {
      if (indicator) {
        const res = await api<{ id: number; changed: boolean; newVersion?: boolean }>(`/indicators/${indicator.id}`, { method: "PUT", body });
        if (!res.changed) toast("No changes to save.");
        else if (res.newVersion) toast("Saved {value0} as definition version {value1}.", "success", { value0: form.code, value1: indicator.version + 1 });
        else toast("Saved {value0}.", "success", { value0: form.code });
        onSaved(indicator.id);
      } else {
        const res = await api<{ id: number }>("/indicators", { body });
        toast("Created {value0}.", "success", { value0: form.code });
        onSaved(res.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={indicator ? t("Edit {value0}", { value0: indicator.code }) : t("New indicator")}
      description={indicator ? "Changing the numerator, denominator, exclusions, unit or facility scope creates a new definition version." : "Define what is measured, how it is calculated and what good looks like."}
      footer={
        <>
          {error && <p className="mr-auto self-center text-sm text-bad">{error}</p>}
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {indicator ? <LocalizedText message="Save changes" /> : <LocalizedText message="Create indicator" />}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Code" className="sm:col-span-2">
          <Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="e.g. PS-06" />
        </Field>
        <Field label="Name" className="sm:col-span-4">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Domain" className="sm:col-span-2">
          <Input list="domains" value={form.domain} onChange={(e) => set("domain", e.target.value)} />
          <datalist id="domains">
            {meta.domains.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="Programme" className="sm:col-span-2">
          <Input list="programs" value={form.program} onChange={(e) => set("program", e.target.value)} />
          <datalist id="programs">
            {meta.programs.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </Field>
        <Field label="Category" className="sm:col-span-2">
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {["structure", "process", "outcome", "experience", "operational"].map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" className="sm:col-span-2">
          <Select value={form.unit} disabled={isEvents} onChange={(e) => set("unit", e.target.value)}>
            <option value="percent"><LocalizedText message="Percentage" /></option>
            <option value="per_1000"><LocalizedText message="Rate per 1,000" /></option>
            <option value="minutes"><LocalizedText message="Minutes (mean)" /></option>
            <option value="count"><LocalizedText message="Count" /></option>
          </Select>
        </Field>
        <Field label="Better when" className="sm:col-span-2">
          <Select value={form.direction} onChange={(e) => set("direction", e.target.value)}>
            <option value="higher"><LocalizedText message="Higher" /></option>
            <option value="lower"><LocalizedText message="Lower" /></option>
          </Select>
        </Field>
        <Field label="Minimum sample" className="sm:col-span-2" hint="Smaller denominators are flagged">
          <Input type="number" min={1} value={form.min_sample} onChange={(e) => set("min_sample", e.target.value)} />
        </Field>
        <Field label="Target" className="sm:col-span-3" hint={form.direction === "higher" ? "On target at or above this value" : "On target at or below this value"}>
          <Input type="number" step="any" value={form.target} onChange={(e) => set("target", e.target.value)} />
        </Field>
        <Field label="Watch threshold" className="sm:col-span-3" hint="Between target and this value is the watch zone; beyond it is off target">
          <Input type="number" step="any" value={form.warning} onChange={(e) => set("warning", e.target.value)} />
        </Field>
        <Field label="Numerator" className="sm:col-span-6">
          <Textarea rows={2} value={form.numerator_def} disabled={isEvents} onChange={(e) => set("numerator_def", e.target.value)} />
        </Field>
        <Field label="Denominator" className="sm:col-span-6">
          <Textarea rows={2} value={form.denominator_def} disabled={isEvents} onChange={(e) => set("denominator_def", e.target.value)} />
        </Field>
        <Field label="Exclusions" className="sm:col-span-6">
          <Input value={form.exclusions} onChange={(e) => set("exclusions", e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2"><LocalizedText message="Applies to" /></span>
          <div className="flex flex-wrap gap-4 pt-1.5">
            {["hospital", "clinic", "dialysis"].map((t) => (
              <Checkbox
                key={t}
                label={t.charAt(0).toUpperCase() + t.slice(1)}
                checked={form.facility_types.includes(t)}
                onChange={(v) => set("facility_types", v ? [...form.facility_types, t] : form.facility_types.filter((x) => x !== t))}
              />
            ))}
          </div>
        </div>
        <Field label="Owner" className="sm:col-span-2">
          <Select value={form.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
            <option value=""><LocalizedText message="Unassigned" /></option>
            {meta.users.filter((u) => u.status === "active").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        {indicator && (
          <Field label="Status" className="sm:col-span-1">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active"><LocalizedText message="Active" /></option>
              <option value="retired"><LocalizedText message="Retired" /></option>
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
