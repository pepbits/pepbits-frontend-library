"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../shared/controls";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Allergy, Catalog, Patient } from "../../shared/types";
import { useTeleconsultClient } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useSession } from "../lib/session";
import { isoDate } from "../lib/format";
import { Button, DateInput, Drawer, Field, Input, Segmented, Select, Toggle, useToast } from "./ui";

type NewAllergy = Pick<Allergy, "substance" | "category" | "allergyClass" | "reaction" | "severity">;

const blank = {
  firstName: "",
  lastName: "",
  dob: "",
  sex: "female" as Patient["sex"],
  language: "English",
  phone: "",
  email: "",
  address: "",
  payer: "",
  memberId: "",
  ecName: "",
  ecPhone: "",
  ecRelation: "",
  bloodGroup: "Unknown",
  heightCm: "",
  weightKg: "",
  smoking: "never" as Patient["smoking"],
  pregnant: false,
};

export function RegisterPatientDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Patient) => void }) {
  const toast = useToast();
  const client = useTeleconsultClient();
  const { canRegister } = useSession();
  const { t } = useLocalization();
  const { data: catalog } = useApi<Catalog>(open ? "/api/catalog" : null);
  const [f, setF] = useState(blank);
  const [allergies, setAllergies] = useState<NewAllergy[]>([]);
  const [nka, setNka] = useState(false);
  const [consent, setConsent] = useState({ telehealth: false, recording: false });
  const [draft, setDraft] = useState<NewAllergy>({ substance: "", category: "drug", reaction: "", severity: "moderate" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((s) => ({ ...s, [k]: v }));
  const valid = canRegister && f.firstName && f.lastName && f.dob && f.phone && consent.telehealth && (nka || allergies.length > 0);

  const addAllergy = () => {
    if (!draft.substance) return;
    const opt = catalog?.allergens.find((a) => a.substance === draft.substance);
    setAllergies((a) => [...a, { ...draft, category: opt?.category ?? draft.category, allergyClass: opt?.allergyClass }]);
    setDraft({ substance: "", category: "drug", reaction: "", severity: "moderate" });
    setNka(false);
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      // Same body after an unknown outcome reuses one Idempotency-Key, so a retry cannot register twice.
      const p = await client.post<Patient>("/api/patients", {
        firstName: f.firstName,
        lastName: f.lastName,
        dob: f.dob,
        sex: f.sex,
        language: f.language,
        phone: f.phone,
        email: f.email,
        address: f.address,
        bloodGroup: f.bloodGroup,
        heightCm: f.heightCm ? Number(f.heightCm) : undefined,
        weightKg: f.weightKg ? Number(f.weightKg) : undefined,
        smoking: f.smoking,
        pregnant: f.sex === "female" ? f.pregnant : undefined,
        insurance: { payer: f.payer || "Self-pay", memberId: f.memberId },
        emergencyContact: { name: f.ecName, phone: f.ecPhone, relation: f.ecRelation },
        allergies,
        noKnownAllergies: nka,
      });
      toast(t("{value0} registered as {value1}", { value0: `${p.firstName} ${p.lastName}`, value1: p.mrn }));
      setF(blank);
      setAllergies([]);
      setNka(false);
      setConsent({ telehealth: false, recording: false });
      onCreated(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Register patient"
      width="max-w-2xl"
      footer={
        <>
          {!canRegister && <p className="mr-auto self-center text-sm text-ink-400"><LocalizedText message={"Your account cannot register patients."} /></p>}
          {error && <p role="alert" className="mr-auto self-center text-sm text-alarm-600">{error}</p>}
          <Button variant="ghost" onClick={onClose}>
            
            <LocalizedText message={"Cancel"} />
          </Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!valid}>
            
            <LocalizedText message={"Register patient"} />
          </Button>
        </>
      }
    >
      <div className="space-y-6 px-5 py-4">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Identity"} /></legend>
          <Field label="First name"><Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Last name"><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Date of birth"><DateInput value={f.dob} max={isoDate(new Date())} onChange={(e) => set("dob", e.target.value)} /></Field>
          <Field label="Sex">
            <Segmented value={f.sex} onChange={(v) => set("sex", v)} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }]} />
          </Field>
          <Field label="Preferred language" hint="Non-English languages flag an interpreter in the consult">
            <Select value={f.language} onChange={(e) => set("language", e.target.value)}>
              {["English", "Spanish", "Hindi", "Arabic", "Mandarin", "German", "Japanese", "French", "Portuguese"].map((l) => <option key={l} value={l}>{t(l)}</option>)}
            </Select>
          </Field>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Contact and coverage"} /></legend>
          <Field label="Mobile phone" hint="Used for visit links and SMS reminders"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 000 0000" /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Insurer"><Input value={f.payer} onChange={(e) => set("payer", e.target.value)} placeholder="Self-pay if blank" /></Field>
          <Field label="Member ID"><Input value={f.memberId} onChange={(e) => set("memberId", e.target.value)} /></Field>
          <Field label="Emergency contact"><Input value={f.ecName} onChange={(e) => set("ecName", e.target.value)} placeholder="Name" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Their phone"><Input value={f.ecPhone} onChange={(e) => set("ecPhone", e.target.value)} /></Field>
            <Field label="Relation"><Input value={f.ecRelation} onChange={(e) => set("ecRelation", e.target.value)} /></Field>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Clinical basics"} /></legend>
          <Field label="Blood group">
            <Select value={f.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
              {["Unknown", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="Height (cm)"><Input inputMode="numeric" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></Field>
          <Field label="Weight (kg)"><Input inputMode="decimal" value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} /></Field>
          <Field label="Smoking">
            <Select value={f.smoking} onChange={(e) => set("smoking", e.target.value as Patient["smoking"])}>
              <option value="never">{t("Never")}</option>
              <option value="former">{t("Former")}</option>
              <option value="current">{t("Current")}</option>
            </Select>
          </Field>
          {f.sex === "female" && (
            <div className="sm:col-span-4">
              <Toggle checked={f.pregnant} onChange={(v) => set("pregnant", v)} label="Currently pregnant" />
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink"><LocalizedText message={"Allergies"} /></legend>
          <p className="mb-3 text-xs text-ink-400"><LocalizedText message={"Record at least one allergy, or confirm no known allergies."} /></p>
          <div className="grid gap-2 sm:grid-cols-[1.3fr_1.3fr_1fr_auto]">
            <Select value={draft.substance} onChange={(e) => setDraft((d) => ({ ...d, substance: e.target.value }))} aria-label="Allergen">
              <option value="">{t("Choose allergen…")}</option>
              {(["drug", "food", "environment"] as const).map((cat) => (
                <optgroup key={cat} label={t(cat === "drug" ? "Medicines" : cat === "food" ? "Foods" : "Environment")}>
                  {catalog?.allergens.filter((a) => a.category === cat).map((a) => <option key={a.substance}>{a.substance}</option>)}
                </optgroup>
              ))}
            </Select>
            <Input placeholder="Reaction, e.g. hives" value={draft.reaction} onChange={(e) => setDraft((d) => ({ ...d, reaction: e.target.value }))} aria-label="Reaction" />
            <Select value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as Allergy["severity"] }))} aria-label="Severity">
              <option value="mild">{t("Mild")}</option>
              <option value="moderate">{t("Moderate")}</option>
              <option value="severe">{t("Severe")}</option>
            </Select>
            <Button onClick={addAllergy} disabled={!draft.substance} icon={<Plus className="h-4 w-4" />}>
              
              <LocalizedText message={"Add"} />
            </Button>
          </div>
          {allergies.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {allergies.map((a, i) => (
                <li key={i} className="inline-flex items-center gap-1.5 rounded-full bg-alarm-50 py-1 pl-2.5 pr-1 text-xs font-medium text-alarm-600">
                  {a.substance} · {t(a.severity[0].toUpperCase() + a.severity.slice(1))}
                  <SourceButton onClick={() => setAllergies((x) => x.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-alarm-100" aria-label={t("Remove {value0}", { value0: a.substance })}>
                    <X className="h-3 w-3" />
                  </SourceButton>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Toggle checked={nka} onChange={(v) => { setNka(v); if (v) setAllergies([]); }} label="No known allergies" />
          </div>
        </fieldset>

        <fieldset className="space-y-2 rounded-lg bg-canvas p-3">
          <legend className="sr-only"><LocalizedText message={"Consent"} /></legend>
          <label className="flex items-start gap-2 text-sm text-ink">
            <SourceInput type="checkbox" className="mt-1 accent-pulse-500" checked={consent.telehealth} onChange={(e) => setConsent((c) => ({ ...c, telehealth: e.target.checked }))} />
            
            <LocalizedText message={"Patient consents to care by video, audio and secure chat, and understands when in-person care is needed."} />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <SourceInput type="checkbox" className="mt-1 accent-pulse-500" checked={consent.recording} onChange={(e) => setConsent((c) => ({ ...c, recording: e.target.checked }))} />
            
            <LocalizedText message={"Patient agrees that visits may be recorded and transcribed for the medical record."} />
          </label>
        </fieldset>
      </div>
    </Drawer>
  );
}
