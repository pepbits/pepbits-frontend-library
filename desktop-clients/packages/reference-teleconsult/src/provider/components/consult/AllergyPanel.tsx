"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { useState } from "react";
import { CheckCircle2, Plus, ShieldAlert } from "lucide-react";
import type { Allergy } from "../../../shared/types";
import { useConsult } from "./context";
import { useTeleconsultClient } from "../../lib/api";
import { useTeleconsultFormat } from "../../lib/format";
import { Button, Field, Input, Segmented, Select, cx, useToast } from "../ui";

export function AllergyPanel() {
  const { patient, enc, update, catalog, actions, user, locked } = useConsult();
  const toast = useToast();
  const client = useTeleconsultClient();
  const { fmtDate } = useTeleconsultFormat();
  const { t } = useLocalization();
  const [substance, setSubstance] = useState("");
  const [custom, setCustom] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<Allergy["severity"]>("moderate");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const name = substance === "__other" ? custom.trim() : substance;
    if (!name) return;
    const opt = catalog.allergens.find((a) => a.substance === name);
    setSaving(true);
    try {
      await client.post(`/api/patients/${patient.id}/allergies`, { substance: name, category: opt?.category ?? "drug", allergyClass: opt?.allergyClass, reaction: reaction || "Not specified", severity, recordedBy: user?.id });
      await actions.reloadPatient();
      toast(`${name} allergy added to the record`);
      setSubstance("");
      setCustom("");
      setReaction("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (a: Allergy) => {
    try {
      await client.patch(`/api/patients/${patient.id}/allergies/${a.id}`, { status: a.status === "active" ? "inactive" : "active" });
      await actions.reloadPatient();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const markNka = async () => {
    try {
      await client.patch(`/api/patients/${patient.id}`, { noKnownAllergies: true });
      await actions.reloadPatient();
      update((e) => ({ ...e, allergiesReviewed: true }));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <div className={cx("mb-3 flex items-center gap-3 rounded-lg border p-3", enc.allergiesReviewed ? "border-vital-500 bg-vital-50" : "border-caution-100 bg-caution-50")}>
          <CheckCircle2 className={cx("h-5 w-5", enc.allergiesReviewed ? "text-vital-600" : "text-caution-600")} />
          <p className="flex-1 text-sm text-ink">{t(enc.allergiesReviewed ? "Allergies reviewed with the patient this visit" : "Confirm allergies with the patient before prescribing")}</p>
          <Button size="sm" variant={enc.allergiesReviewed ? "ghost" : "primary"} disabled={locked} onClick={() => update((e) => ({ ...e, allergiesReviewed: !e.allergiesReviewed }))}>
            {enc.allergiesReviewed ? "Undo" : "Mark reviewed"}
          </Button>
        </div>
        {!patient.allergies.length ? (
          <div className="rounded-lg border border-dashed border-line p-4 text-center">
            <p className="text-sm text-ink">{t(patient.noKnownAllergies ? "No known allergies recorded" : "Allergy status not recorded")}</p>
            {!patient.noKnownAllergies && <Button size="sm" className="mt-2" disabled={locked} onClick={markNka}><LocalizedText message={"Confirm no known allergies"} /></Button>}
          </div>
        ) : (
          <ul className="space-y-2">
            {patient.allergies.map((a) => (
              <li key={a.id} className={cx("flex items-center gap-3 rounded-lg border p-2.5", a.status === "inactive" ? "border-line opacity-60" : a.severity === "severe" ? "border-alarm-500 bg-alarm-50" : "border-line")}>
                <ShieldAlert className={cx("h-5 w-5 shrink-0", a.status === "inactive" ? "text-ink-400" : "text-alarm-500")} />
                <div className="min-w-0 flex-1">
                  <p className={cx("text-[13px] font-semibold text-ink", a.status === "inactive" && "line-through")}>{a.substance} <span className="font-normal capitalize text-ink-400">· {a.category}</span></p>
                  <p className="text-xs text-ink-600">{a.reaction} · <span className={cx(a.severity === "severe" && "font-semibold text-alarm-600")}>{a.severity}</span> · {t("recorded {value0}", { value0: fmtDate(a.recordedAt) })}</p>
                </div>
                <Button size="sm" variant="ghost" disabled={locked} onClick={() => toggleStatus(a)}>{a.status === "active" ? "Mark inactive" : "Reactivate"}</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-line p-3">
        <p className="mb-2 text-[13px] font-semibold text-ink"><LocalizedText message={"Add allergy or intolerance"} /></p>
        <div className="space-y-2.5">
          <Field label="Substance">
            <Select value={substance} disabled={locked} onChange={(e) => setSubstance(e.target.value)}>
              <option value="">{t("Choose…")}</option>
              {(["drug", "food", "environment"] as const).map((c) => (
                <optgroup key={c} label={t(c === "drug" ? "Medicines" : c === "food" ? "Foods" : "Environment")}>
                  {catalog.allergens.filter((x) => x.category === c).map((x) => <option key={x.substance}>{x.substance}</option>)}
                </optgroup>
              ))}
              <option value="__other">{t("Other…")}</option>
            </Select>
          </Field>
          {substance === "__other" && <Input placeholder="Substance name" value={custom} onChange={(e) => setCustom(e.target.value)} />}
          <Field label="Reaction"><Input value={reaction} disabled={locked} onChange={(e) => setReaction(e.target.value)} placeholder="e.g. hives, swelling, anaphylaxis" /></Field>
          <Field label="Severity">
            <Segmented value={severity} onChange={setSeverity} options={[{ value: "mild", label: "Mild" }, { value: "moderate", label: "Moderate" }, { value: "severe", label: "Severe" }]} />
          </Field>
          <Button variant="primary" className="w-full" loading={saving} disabled={locked || !substance || (substance === "__other" && !custom.trim())} onClick={add} icon={<Plus className="h-4 w-4" />}>
            
            <LocalizedText message={"Add to record"} />
          </Button>
          <p className="text-2xs text-ink-400"><LocalizedText message={"Saved straight to the patient record. Safety checks re-run on every prescription."} /></p>
        </div>
      </div>
    </div>
  );
}
