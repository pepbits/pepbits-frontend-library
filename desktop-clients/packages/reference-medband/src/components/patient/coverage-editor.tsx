"use client";

import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Coverage, CoveragePriority, Relationship } from "../../lib/types";
import { cx, toDateInput, uid } from "../../lib/utils";
import { DateInput, Field, Input, Segmented, Select } from "../ui/form";
import { Badge, Button } from "../ui/primitives";
import { CoverageLine } from "./wristband";
import { useMaster, type Payer } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import type { Translate } from "../../lib/followup";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

const PRIORITIES: CoveragePriority[] = ["Primary", "Secondary", "Tertiary"];

const blank = (priority: CoveragePriority): Coverage => {
  const now = new Date();
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 1);
  return {
    id: uid("c"),
    priority,
    payerId: "",
    networkId: "",
    planId: "",
    memberId: "",
    policyNumber: "",
    validFrom: toDateInput(now),
    validTo: toDateInput(end),
    relationship: "Self",
  };
};

export function validateCoverage(c: Coverage, p: Payer | undefined, tr: Translate): Partial<Record<keyof Coverage, string>> {
  const e: Partial<Record<keyof Coverage, string>> = {};
  if (!c.payerId) e.payerId = tr("Choose the insurer");
  if (p?.tpaRequired && !c.tpaId) e.tpaId = tr("{value0} claims go through a TPA", { value0: p.short });
  if (!c.networkId) e.networkId = tr("Choose the network");
  if (!c.planId) e.planId = tr("Choose the plan");
  if (!c.memberId.trim()) e.memberId = tr("Enter the member ID from the card");
  if (c.validTo < c.validFrom) e.validTo = tr("End date is before start date");
  return e;
}

/** Manages up to three coverages (primary, secondary, tertiary) without leaving the screen. */
export function CoverageEditor({ value, onChange }: { value: Coverage[]; onChange: (v: Coverage[]) => void }) {
  const { NETWORKS, PAYERS, PLANS, TPAS, network, payer, plan, tpa } = useMaster();
  const { fmtNumber } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const [draft, setDraft] = useState<Coverage | null>(value.length ? null : blank("Primary"));
  const [touched, setTouched] = useState(false);

  const used = new Set(value.filter((c) => c.id !== draft?.id).map((c) => c.priority));
  const nextFree = PRIORITIES.find((p) => !used.has(p) && !value.some((c) => c.priority === p));
  const errors = draft ? validateCoverage(draft, payer(draft.payerId), tr) : {};
  const set = <K extends keyof Coverage>(k: K, v: Coverage[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const p = payer(draft?.payerId);
  const nets = NETWORKS.filter((n) => n.payerId === draft?.payerId);
  const plans = PLANS.filter((x) => x.networkId === draft?.networkId);
  const tpas = TPAS.filter((t) => p?.tpaIds.includes(t.id));
  const chosenPlan = plan(draft?.planId);

  const save = () => {
    setTouched(true);
    if (!draft || Object.keys(errors).length) return;
    const exists = value.some((c) => c.id === draft.id);
    const next = exists ? value.map((c) => (c.id === draft.id ? draft : c)) : [...value, draft];
    onChange(next.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)));
    setDraft(null);
    setTouched(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      {/* Saved coverages */}
      <div className="flex flex-col gap-2">
        {value.length === 0 && !draft && <p className="text-[13px] text-ink-faint"><LocalizedText message="No insurance added. The patient will be registered as self pay." /></p>}
        {value.map((c) => (
          <div
            key={c.id}
            className={cx(
              "group rounded-xl border px-3 transition-colors",
              draft?.id === c.id ? "border-scrub-500 bg-scrub-50" : "border-line hover:border-scrub-200",
            )}
          >
            <CoverageLine c={c} compact />
            <div className="flex gap-1 pb-2 pl-9">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDraft({ ...c })}>
                <Pencil className="size-3.5" /> {" "}<LocalizedText message="Edit" /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 hover:text-rose-700" onClick={() => onChange(value.filter((x) => x.id !== c.id))}>
                <Trash2 className="size-3.5" /> {" "}<LocalizedText message="Remove" /></Button>
            </div>
          </div>
        ))}
        {!draft && nextFree && (
          <Button variant="secondary" className="border-dashed" onClick={() => setDraft(blank(nextFree))}>
            <Plus className="size-4" /> {" "}<LocalizedText message={"Add {value0} payer"} values={{ value0: tr(nextFree ?? "").toLowerCase() }} /></Button>
        )}
        {value.length > 1 && <p className="text-[12px] text-ink-faint"><LocalizedText message="Claims go to the primary payer first, then the next in order." /></p>}
      </div>

      {/* Editor */}
      {draft ? (
        <div className="animate-rise rounded-xl border border-line p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              size="sm"
              ariaLabel="Coverage priority"
              value={draft.priority}
              onChange={(v) => set("priority", v)}
              options={PRIORITIES.filter((x) => !used.has(x) || x === draft.priority).map((x) => ({ value: x, label: x }))}
            />
            <Select
              aria-label="Relationship to policy holder"
              className="h-8 w-auto text-[13px]"
              value={draft.relationship}
              onChange={(e) => set("relationship", e.target.value as Relationship)}
              options={(["Self", "Spouse", "Child", "Parent", "Other"] as Relationship[]).map((r) => ({ value: r, label: r === "Self" ? tr("Patient is policy holder") : tr("Holder's {value0}", { value0: tr(r ?? "").toLowerCase() }) }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Insurer (payer)" required error={touched ? errors.payerId : undefined}>
              <Select
                value={draft.payerId}
                invalid={touched && !!errors.payerId}
                placeholder="Choose insurer"
                onChange={(e) => {
                  const np = payer(e.target.value);
                  setDraft((d) => d && { ...d, payerId: e.target.value, networkId: "", planId: "", tpaId: np?.tpaIds.length === 1 ? np.tpaIds[0] : undefined });
                }}
                options={PAYERS.map((x) => ({ value: x.id, label: x.name }))}
              />
            </Field>
            <Field label="TPA" required={p?.tpaRequired} error={touched ? errors.tpaId : undefined} hint={p && !p.tpaIds.length ? tr("This insurer settles claims directly") : undefined}>
              <Select
                value={draft.tpaId ?? ""}
                disabled={!p || !p.tpaIds.length}
                invalid={touched && !!errors.tpaId}
                placeholder={p?.tpaRequired ? tr("Choose TPA") : tr("Direct billing (no TPA)")}
                onChange={(e) => set("tpaId", e.target.value || undefined)}
                options={tpas.map((t) => ({ value: t.id, label: t.name }))}
              />
            </Field>
            <Field label="Plan network" required error={touched ? errors.networkId : undefined}>
              <Select
                value={draft.networkId}
                disabled={!draft.payerId}
                invalid={touched && !!errors.networkId}
                placeholder={draft.payerId ? tr("Choose network") : tr("Choose insurer first")}
                onChange={(e) => {
                  const ps = PLANS.filter((x) => x.networkId === e.target.value);
                  setDraft((d) => d && { ...d, networkId: e.target.value, planId: ps.length === 1 ? ps[0].id : "" });
                }}
                options={nets.map((n) => ({ value: n.id, label: `${n.name} (${n.tier})` }))}
              />
            </Field>
            <Field label="Plan" required error={touched ? errors.planId : undefined}>
              <Select
                value={draft.planId}
                disabled={!draft.networkId}
                invalid={touched && !!errors.planId}
                placeholder={draft.networkId ? tr("Choose plan") : tr("Choose network first")}
                onChange={(e) => set("planId", e.target.value)}
                options={plans.map((x) => ({ value: x.id, label: x.name }))}
              />
            </Field>
            <Field label="Member ID" required error={touched ? errors.memberId : undefined}>
              <Input value={draft.memberId} invalid={touched && !!errors.memberId} onChange={(e) => set("memberId", e.target.value.toUpperCase())} placeholder="As printed on the card" />
            </Field>
            <Field label="Policy number">
              <Input value={draft.policyNumber} onChange={(e) => set("policyNumber", e.target.value.toUpperCase())} placeholder="Optional" />
            </Field>
            <Field label="Valid from">
              <DateInput value={draft.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
            </Field>
            <Field label="Valid to" error={errors.validTo}>
              <DateInput value={draft.validTo} invalid={!!errors.validTo} onChange={(e) => set("validTo", e.target.value)} />
            </Field>
          </div>

          {chosenPlan && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-scrub-50 px-3 py-2 text-[12.5px] text-scrub-900">
              <ShieldCheck className="size-4 text-scrub-600" />
              <span className="font-semibold">{network(draft.networkId)?.name}</span>
              <Badge tone="bg-paper text-ink-soft"><LocalizedText message={"Co-pay {value0}%"} values={{ value0: (chosenPlan.copayPct) ?? "" }} /></Badge>
              <Badge tone="bg-paper text-ink-soft"><LocalizedText message={"OP limit {value0}"} values={{ value0: fmtNumber(chosenPlan.opLimit) }} /></Badge>
              <Badge tone={chosenPlan.ipCovered ? "bg-paper text-emerald-700" : "bg-paper text-rose-700"}>{chosenPlan.ipCovered ? tr("Covers admission") : tr("No admission cover")}</Badge>
              <Badge tone={chosenPlan.teleCovered ? "bg-paper text-emerald-700" : "bg-paper text-rose-700"}>{chosenPlan.teleCovered ? tr("Covers tele") : tr("No tele cover")}</Badge>
              {draft.tpaId && <span className="text-ink-soft"><LocalizedText message={"Claims via {value0}"} values={{ value0: (tpa(draft.tpaId)?.name) ?? "" }} /></span>}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            {(value.length > 0 || value.some((c) => c.id === draft.id)) && (
              <Button variant="ghost" onClick={() => (setDraft(null), setTouched(false))}>
                <LocalizedText message="Cancel" /></Button>
            )}
            <Button onClick={save}>{value.some((c) => c.id === draft.id) ? tr("Update coverage") : tr("Add coverage")}</Button>
          </div>
        </div>
      ) : (
        <div className="hidden items-center justify-center rounded-xl border border-dashed border-line text-[13px] text-ink-faint lg:flex">
          {value.length >= 3 ? tr("Primary, secondary and tertiary payers are set.") : tr("Select a coverage to edit, or add another payer.")}
        </div>
      )}
    </div>
  );
}
