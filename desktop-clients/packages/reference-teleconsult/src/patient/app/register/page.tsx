"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../../shared/controls";
import { useState } from "react";
import { useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { Check, X } from "lucide-react";
import type { Allergy, Catalog, Patient } from "../../../shared/types";
import { useTeleconsultClient } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { usePatient } from "../../lib/session";
import { Button, Chip, Header, Notice, TextField, Toggle, cx } from "../../components/ui";

const STEPS = ["About you", "Contact", "Your health"];

export default function Register() {
  const router = useRouter();
  const { t } = useLocalization();
  const client = useTeleconsultClient();
  const { signIn, canRegister, ready } = usePatient();
  const { data: catalog } = useApi<Catalog>("/api/catalog");
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ firstName: "", lastName: "", dob: "", sex: "female" as Patient["sex"], language: "English", phone: "", email: "", address: "", payer: "", memberId: "", ecName: "", ecPhone: "", heightCm: "", weightKg: "", smoking: "never" as Patient["smoking"] });
  const [allergies, setAllergies] = useState<{ substance: string; severity: Allergy["severity"] }[]>([]);
  const [nka, setNka] = useState(false);
  const [conditions, setConditions] = useState("");
  const [meds, setMeds] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const canNext = [
    f.firstName && f.lastName && f.dob,
    f.phone.replace(/\D/g, "").length >= 7,
    (nka || allergies.length > 0) && consent,
  ][step];

  const toggleAllergen = (substance: string) =>
    setAllergies((a) => (a.some((x) => x.substance === substance) ? a.filter((x) => x.substance !== substance) : [...a, { substance, severity: "moderate" }]));

  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      // An identical retry after an unknown outcome reuses one Idempotency-Key, so it cannot register twice.
      const p = await client.post<Patient>("/api/patients", {
        firstName: f.firstName, lastName: f.lastName, dob: f.dob, sex: f.sex, language: f.language,
        phone: f.phone, email: f.email, address: f.address,
        insurance: { payer: f.payer || "Self-pay", memberId: f.memberId },
        emergencyContact: { name: f.ecName, phone: f.ecPhone, relation: "" },
        heightCm: f.heightCm ? Number(f.heightCm) : undefined, weightKg: f.weightKg ? Number(f.weightKg) : undefined,
        smoking: f.smoking,
        allergies: allergies.map((a) => {
          const opt = catalog?.allergens.find((x) => x.substance === a.substance);
          return { substance: a.substance, category: opt?.category ?? "drug", allergyClass: opt?.allergyClass, reaction: "Reported by patient", severity: a.severity };
        }),
        noKnownAllergies: nka,
        problems: conditions.split(",").map((c) => c.trim()).filter(Boolean).map((display) => ({ code: "", display, since: new Date().toISOString(), status: "active" })),
        medications: meds.split(",").map((m) => m.trim()).filter(Boolean).map((name) => ({ name, dose: "", frequency: "As reported", status: "active", since: new Date().toISOString() })),
      });
      await signIn(p.id);
      router.replace("/home");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  if (ready && !canRegister) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <Header back="/" title="Create your account" />
        <main className="px-4 py-6"><Notice><LocalizedText message={"Registration is not available for this account. Ask your clinic to link a patient record."} /></Notice></main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Header back={step === 0 ? "/" : undefined} title="Create your account" right={<span className="text-sm text-ink-400 tabular">{t("{value0} of 3", { value0: step + 1 })}</span>} />
      {step > 0 && (
        <SourceButton onClick={() => setStep(step - 1)} className="-mt-1 px-4 text-left text-sm font-medium text-forest">{t("Back to {value0}", { value0: t(STEPS[step - 1]).toLowerCase() })}</SourceButton>
      )}
      <div className="mx-4 mt-2 flex gap-1.5">
        {STEPS.map((s, i) => <span key={s} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-forest" : "bg-forest-100")} />)}
      </div>

      <main className="flex-1 space-y-4 px-4 py-6">
        <h2 className="text-2xl font-bold text-forest">{t(STEPS[step])}</h2>
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="First name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
              <TextField label="Last name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />
            </div>
            <TextField label="Date of birth" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-600"><LocalizedText message={"Sex"} /></p>
              <div className="flex gap-2">
                {(["female", "male", "other"] as const).map((s) => <Chip key={s} selected={f.sex === s} onClick={() => setF((x) => ({ ...x, sex: s }))}>{t(s[0].toUpperCase() + s.slice(1))}</Chip>)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-600"><LocalizedText message={"Language for your visits"} /></p>
              <div className="flex flex-wrap gap-2">
                {["English", "Spanish", "Hindi", "Arabic", "Mandarin", "German"].map((l) => <Chip key={l} selected={f.language === l} onClick={() => set("language", l)}>{l}</Chip>)}
              </div>
              {f.language !== "English" && <p className="mt-2 text-xs text-ink-400"><LocalizedText message={"We’ll arrange an interpreter for your visits."} /></p>}
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <TextField label="Mobile number" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} hint="Visit links and reminders are sent here" autoComplete="tel" />
            <TextField label="Email (optional)" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
            <TextField label="Home address" value={f.address} onChange={(e) => set("address", e.target.value)} hint="Used to send prescriptions and tests near you" autoComplete="street-address" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Insurer" value={f.payer} onChange={(e) => set("payer", e.target.value)} placeholder="Self-pay" />
              <TextField label="Member ID" value={f.memberId} onChange={(e) => set("memberId", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Emergency contact" value={f.ecName} onChange={(e) => set("ecName", e.target.value)} />
              <TextField label="Their number" type="tel" value={f.ecPhone} onChange={(e) => set("ecPhone", e.target.value)} />
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div>
              <p className="mb-1 text-sm font-medium text-ink-600"><LocalizedText message={"Are you allergic to anything?"} /></p>
              <p className="mb-2 text-xs text-ink-400"><LocalizedText message={"Tap all that apply. Your doctor checks every prescription against this list."} /></p>
              <div className="flex flex-wrap gap-2">
                {catalog?.allergens.slice(0, 18).map((a) => (
                  <Chip key={a.substance} selected={allergies.some((x) => x.substance === a.substance)} onClick={() => { toggleAllergen(a.substance); setNka(false); }}>{a.substance}</Chip>
                ))}
              </div>
              {allergies.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {allergies.map((a) => (
                    <li key={a.substance} className="flex items-center gap-2 rounded-2xl bg-white p-2.5 pl-3.5">
                      <span className="flex-1 text-sm font-medium text-ink">{a.substance}</span>
                      {(["mild", "moderate", "severe"] as const).map((s) => (
                        <SourceButton key={s} onClick={() => setAllergies((x) => x.map((y) => (y.substance === a.substance ? { ...y, severity: s } : y)))} className={cx("rounded-full px-2.5 py-1 text-xs font-medium capitalize", a.severity === s ? (s === "severe" ? "bg-rose-500 text-white" : "bg-forest text-white") : "bg-mint text-ink-600")}>{t(s[0].toUpperCase() + s.slice(1))}</SourceButton>
                      ))}
                      <SourceButton onClick={() => toggleAllergen(a.substance)} className="p-1 text-ink-400" aria-label={t("Remove {value0}", { value0: a.substance })}><X className="h-4 w-4" /></SourceButton>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3"><Toggle checked={nka} onChange={(v) => { setNka(v); if (v) setAllergies([]); }} label="I have no known allergies" /></div>
            </div>
            <TextField label="Long-term conditions (optional)" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. asthma, high blood pressure" />
            <TextField label="Medicines you take (optional)" value={meds} onChange={(e) => setMeds(e.target.value)} placeholder="Separate with commas" />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Height (cm)" inputMode="numeric" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value.replace(/\D/g, ""))} />
              <TextField label="Weight (kg)" inputMode="decimal" value={f.weightKg} onChange={(e) => set("weightKg", e.target.value.replace(/[^\d.]/g, ""))} />
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-white p-3.5 text-sm text-ink">
              <SourceInput type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-forest" />
              
              <LocalizedText message={"I agree to receive care by video, phone and chat, and understand that some problems need an in-person visit."} />
            </label>
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </main>

      <div className="sticky bottom-0 bg-mint/95 px-4 pb-6 pt-3 backdrop-blur">
        {step < 2 ? (
          <Button block disabled={!canNext} onClick={() => setStep(step + 1)}><LocalizedText message={"Continue"} /></Button>
        ) : (
          <Button block variant="sun" disabled={!canNext} loading={saving} onClick={submit}><Check className="h-5 w-5" />  <LocalizedText message={"Create account"} /></Button>
        )}
      </div>
    </div>
  );
}
