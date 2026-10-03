"use client";

import { AlertTriangle, Check, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useHotkeys } from "../../../lib/hooks";
import { useRouter } from "../../../lib/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "../../../lib/store";
import type { Gender, NewPatient } from "../../../lib/types";
import { cx, fullName, normalize, toDateInput } from "../../../lib/utils";
import { CoverageEditor } from "../../../components/patient/coverage-editor";
import { CoverageLine, Wristband } from "../../../components/patient/wristband";
import { Checkbox, DateInput, Field, Input, Segmented, Select, Textarea } from "../../../components/ui/form";
import { useErrorToast, useToast } from "../../../components/ui/overlay";
import { Button, Kbd, Panel } from "../../../components/ui/primitives";
import { SourceButton } from "../../../components/controls";
import { useMaster } from "../../../lib/master";
import { useMedbandFormat } from "../../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Copy } from "../../../components/copy";
import { medbandPaths } from "../../../routes";

type Step = "identity" | "contact" | "insurance" | "review";
/** Preferred-language choices. The value sent to the backend is the English name; the label is localized. */
const LANGUAGES = ["English", "Arabic", "Hindi", "Spanish", "French", "Mandarin"];

const STEPS: Array<{ id: Step; label: string; hint: string }> = [
  { id: "identity", label: "Identity", hint: "Name, birth date, ID" },
  { id: "contact", label: "Contact", hint: "Phone, address, next of kin" },
  { id: "insurance", label: "Insurance", hint: "Payers, network, plan, TPA" },
  { id: "review", label: "Review", hint: "Check and save" },
];

const EMPTY: NewPatient = {
  firstName: "", middleName: "", lastName: "", dob: "", gender: "Female", phone: "",
  email: "", nationalId: "", nationality: "", bloodGroup: "", preferredLanguage: "English",
  address: "", city: "", emergencyName: "", emergencyPhone: "", allergies: "", vip: false, coverages: [],
};

export default function RegisterPatientPage() {
  const { network, payer, plan } = useMaster();
  const { ageOf, fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>("identity");
  const [p, setP] = useState<NewPatient>(EMPTY);
  const [insured, setInsured] = useState<"self" | "insured">("insured");
  const [startEncounter, setStartEncounter] = useState(true);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const fail = useErrorToast();

  const set = <K extends keyof NewPatient>(k: K, v: NewPatient[K]) => setP((x) => ({ ...x, [k]: v }));

  const errors = useMemo(() => {
    const e: Partial<Record<keyof NewPatient, string>> = {};
    if (!p.firstName.trim()) e.firstName = "Enter the first name";
    if (!p.lastName.trim()) e.lastName = "Enter the last name";
    if (!p.dob) e.dob = "Enter date of birth or age";
    else if (p.dob > toDateInput(new Date())) e.dob = "Birth date is in the future";
    if (normalize(p.phone).length < 7) e.phone = "Enter a reachable phone number";
    if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) e.email = "This email looks incomplete";
    if (insured === "insured" && p.coverages.length === 0) e.coverages = "Add at least one payer, or switch to self pay";
    return e;
  }, [p, insured]);

  const stepErrors: Record<Step, number> = {
    identity: ["firstName", "lastName", "dob"].filter((k) => errors[k as keyof NewPatient]).length,
    contact: ["phone", "email"].filter((k) => errors[k as keyof NewPatient]).length,
    insurance: errors.coverages ? 1 : 0,
    review: 0,
  };
  const valid = Object.keys(errors).length === 0;
  const show = (k: keyof NewPatient) => (tried ? errors[k] : undefined);

  const duplicates = useMemo(() => {
    const phone = normalize(p.phone);
    return store.patients.filter(
      (x) =>
        (phone.length >= 7 && normalize(x.phone) === phone) ||
        (p.nationalId && x.nationalId && normalize(x.nationalId) === normalize(p.nationalId)) ||
        (p.lastName && p.dob && x.dob === p.dob && normalize(x.lastName) === normalize(p.lastName)),
    );
  }, [store.patients, p.phone, p.nationalId, p.lastName, p.dob]);

  const idx = STEPS.findIndex((s) => s.id === step);
  const go = (d: 1 | -1) => setStep(STEPS[Math.min(Math.max(idx + d, 0), STEPS.length - 1)].id);

  const save = useCallback(async () => {
    setTried(true);
    if (!valid) {
      const firstBad = STEPS.find((s) => stepErrors[s.id] > 0);
      if (firstBad) setStep(firstBad.id);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const patient = await store.registerPatient({ ...p, coverages: insured === "insured" ? p.coverages : [] });
      toast({ title: "Patient registered", body: `${fullName(patient)}, ${patient.mrn}` });
      router.push(startEncounter ? medbandPaths.encounterNew({ patientId: patient.id }) : medbandPaths.patient(patient.id));
    } catch (e) {
      fail(e, "Could not register the patient");
      setSaving(false);
    }
  }, [valid, stepErrors, store, p, insured, toast, router, startEncounter, saving, fail]);

  // Ctrl/Cmd+Enter saves, only while the host's keyboard-shortcut preference is on.
  useHotkeys({ "mod+enter": () => void save() });

  const setAge = (years: string) => {
    const n = parseInt(years, 10);
    if (Number.isNaN(n) || n < 0 || n > 120) return;
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    d.setMonth(0, 1);
    set("dob", toDateInput(d));
  };

  return (
    <div className="mx-auto grid h-full max-w-[1500px] grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
      {/* Stepper */}
      <nav aria-label={tr("Registration steps")} className="flex flex-col gap-1 lg:pt-1">
        <h1 className="mb-3 px-2 text-lg font-bold tracking-tight"><LocalizedText message="Register patient" /></h1>
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {STEPS.map((s, i) => {
            const on = s.id === step;
            const done = i < idx && stepErrors[s.id] === 0;
            const bad = tried && stepErrors[s.id] > 0;
            return (
              <li key={s.id} className="shrink-0">
                <SourceButton
                  onClick={() => setStep(s.id)}
                  aria-current={on ? "step" : undefined}
                  className={cx("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors", on ? "bg-paper shadow-lift" : "hover:bg-paper/60")}
                >
                  <span
                    className={cx(
                      "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                      bad ? "bg-rose-500 text-white" : done ? "bg-scrub-600 text-white" : on ? "bg-band text-ink" : "bg-paper text-ink-soft ring-1 ring-line",
                    )}
                  >
                    {bad ? "!" : done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold"><LocalizedText message={s.label ?? ""} /></span>
                    <span className="hidden truncate text-[12px] text-ink-faint lg:block"><Copy>{s.hint}</Copy></span>
                  </span>
                </SourceButton>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto hidden px-2 pt-6 text-[12px] text-ink-faint lg:block">
          <LocalizedText message="Save from any step with" />{" "}<Kbd><LocalizedText message="Ctrl" /></Kbd> <Kbd><LocalizedText message="Enter" /></Kbd>
        </div>
      </nav>

      {/* Form */}
      <Panel className="flex min-h-[520px] flex-col">
        <div key={step} className="animate-fade scroll-thin min-h-0 flex-1 overflow-auto p-5 md:p-6">
          {step === "identity" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <Field label="First name" required error={show("firstName")} className="sm:col-span-2">
                <Input autoFocus value={p.firstName} invalid={!!show("firstName")} onChange={(e) => set("firstName", e.target.value)} />
              </Field>
              <Field label="Middle name" className="sm:col-span-2">
                <Input value={p.middleName} onChange={(e) => set("middleName", e.target.value)} />
              </Field>
              <Field label="Last name" required error={show("lastName")} className="sm:col-span-2">
                <Input value={p.lastName} invalid={!!show("lastName")} onChange={(e) => set("lastName", e.target.value)} />
              </Field>
              <Field label="Date of birth" required error={show("dob")} hint={p.dob ? tr("Age {value0}", { value0: (ageOf(p.dob)) ?? "" }) : undefined} className="sm:col-span-2">
                <DateInput max={toDateInput(new Date())} value={p.dob} invalid={!!show("dob")} onChange={(e) => set("dob", e.target.value)} />
              </Field>
              <Field label="Or age in years" hint="Sets an approximate birth date" className="sm:col-span-1">
                <Input inputMode="numeric" placeholder="e.g. 42" onChange={(e) => setAge(e.target.value)} />
              </Field>
              <Field label="Gender" required className="sm:col-span-3">
                <Segmented<Gender> value={p.gender} onChange={(v) => set("gender", v)} options={(["Female", "Male", "Other", "Unknown"] as Gender[]).map((g) => ({ value: g, label: g }))} />
              </Field>
              <Field label="National ID / passport" className="sm:col-span-2">
                <Input value={p.nationalId} onChange={(e) => set("nationalId", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Nationality" className="sm:col-span-2">
                <Input value={p.nationality} onChange={(e) => set("nationality", e.target.value)} />
              </Field>
              <Field label="Blood group" className="sm:col-span-1">
                <Select value={p.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} placeholder="Unknown" options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => ({ value: b, label: b }))} />
              </Field>
              <Field label="Language" className="sm:col-span-1">
                <Select value={p.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
              </Field>
              <Field label="Known allergies" hint="Turns the wristband clasp red" className="sm:col-span-4">
                <Input value={p.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. Penicillin, latex" />
              </Field>
              <div className="flex items-end pb-2 sm:col-span-2">
                <Checkbox checked={!!p.vip} onChange={(v) => set("vip", v)} label="VIP patient" sub="Flags priority handling" />
              </div>
            </div>
          )}

          {step === "contact" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
              <Field label="Mobile phone" required error={show("phone")} className="sm:col-span-2">
                <Input autoFocus type="tel" value={p.phone} invalid={!!show("phone")} onChange={(e) => set("phone", e.target.value)} placeholder="+1 415 555 0100" />
              </Field>
              <Field label="Alternate phone" className="sm:col-span-2">
                <Input type="tel" value={p.altPhone ?? ""} onChange={(e) => set("altPhone", e.target.value)} />
              </Field>
              <Field label="Email" error={show("email")} className="sm:col-span-2">
                <Input type="email" value={p.email} invalid={!!show("email")} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Address" hint="Used for home visits" className="sm:col-span-4">
                <Textarea className="min-h-10" rows={2} value={p.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field label="City" className="sm:col-span-2">
                <Input value={p.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Emergency contact" className="sm:col-span-3">
                <Input value={p.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} placeholder="Name and relationship" />
              </Field>
              <Field label="Emergency phone" className="sm:col-span-3">
                <Input type="tel" value={p.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} />
              </Field>
            </div>
          )}

          {step === "insurance" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                  ariaLabel="Payment type"
                  value={insured}
                  onChange={setInsured}
                  options={[
                    { value: "insured", label: "Insured" },
                    { value: "self", label: "Self pay" },
                  ]}
                />
                {tried && errors.coverages && <p className="text-[13px] text-rose-700">{errors.coverages}</p>}
              </div>
              {insured === "insured" ? (
                <CoverageEditor value={p.coverages} onChange={(v) => set("coverages", v)} />
              ) : (
                <p className="rounded-xl bg-canvas p-4 text-[13.5px] text-ink-soft"><LocalizedText message="The patient pays directly. You can add insurance later from their record." /></p>
              )}
            </div>
          )}

          {step === "review" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ReviewBlock title="Identity" onEdit={() => setStep("identity")}>
                <Row k="Name" v={fullName(p)} />
                <Row k="Born" v={p.dob ? `${fmtDate(p.dob)} (${ageOf(p.dob)})` : ""} />
                <Row k="Gender" v={p.gender} />
                <Row k="National ID" v={p.nationalId} />
                <Row k="Allergies" v={p.allergies || tr("None recorded")} />
              </ReviewBlock>
              <ReviewBlock title="Contact" onEdit={() => setStep("contact")}>
                <Row k="Phone" v={p.phone} />
                <Row k="Email" v={p.email} />
                <Row k="Address" v={[p.address, p.city].filter(Boolean).join(", ")} />
                <Row k="Emergency" v={[p.emergencyName, p.emergencyPhone].filter(Boolean).join(", ")} />
              </ReviewBlock>
              <ReviewBlock title="Insurance" onEdit={() => setStep("insurance")} className="md:col-span-2">
                {insured === "self" || p.coverages.length === 0 ? (
                  <p className="text-[13.5px] text-ink-soft"><LocalizedText message="Self pay" /></p>
                ) : (
                  <div className="divide-y divide-line-soft">{p.coverages.map((c) => <CoverageLine key={c.id} c={c} />)}</div>
                )}
              </ReviewBlock>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
          <Button variant="ghost" onClick={() => go(-1)} disabled={idx === 0}>
            <ChevronLeft className="size-4" /> {" "}<LocalizedText message="Back" /></Button>
          <div className="ml-auto flex items-center gap-3">
            <Checkbox checked={startEncounter} onChange={setStartEncounter} label={<span className="text-[13px]"><LocalizedText message="Start encounter next" /></span>} />
            {step !== "review" && (
              <Button variant="secondary" onClick={() => go(1)}>
                <LocalizedText message="Next" />{" "}<ChevronRight className="size-4" />
              </Button>
            )}
            <Button onClick={() => void save()} disabled={saving}>{saving ? tr("Saving") : tr("Save patient")}</Button>
          </div>
        </div>
      </Panel>

      {/* Live preview */}
      <aside className="hidden flex-col gap-4 xl:flex">
        <Panel className="p-4">
          <p className="mb-3 text-[13px] font-semibold text-ink-soft"><LocalizedText message="Wristband preview" /></p>
          <Wristband patient={{ ...p, mrn: "" }} size="md" />
          <div className="mt-4 space-y-2 text-[13px]">
            {STEPS.slice(0, 3).map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-ink-soft"><LocalizedText message={s.label ?? ""} /></span>
                {stepErrors[s.id] === 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><Check className="size-3.5" /> {" "}<LocalizedText message="Ready" /></span>
                ) : (
                  <span className="font-medium text-ink-faint"><LocalizedText message={"{value0} to fill"} values={{ value0: (stepErrors[s.id]) ?? "" }} /></span>
                )}
              </div>
            ))}
          </div>
        </Panel>

        {insured === "insured" && p.coverages.length > 0 && (
          <Panel className="p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><ShieldCheck className="size-4" /> {" "}<LocalizedText message="Billing order" /></p>
            {p.coverages.map((c, i) => (
              <p key={c.id} className="py-1 text-[13px]">
                <span className="font-semibold">{i + 1}. {payer(c.payerId)?.short}</span>{" "}
                <span className="text-ink-faint">{network(c.networkId)?.name}, {plan(c.planId)?.name}</span>
              </p>
            ))}
          </Panel>
        )}

        {duplicates.length > 0 && (
          <Panel className="animate-rise border border-amber-300 p-4">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-900">
              <AlertTriangle className="size-4" /> {" "}<LocalizedText message="Possible existing record" /></p>
            <p className="mt-1 mb-2 text-[12.5px] text-ink-soft"><LocalizedText message="Same phone, ID, or name and birth date. Open it instead of creating a duplicate." /></p>
            {duplicates.slice(0, 3).map((d) => (
              <Link key={d.id} href={medbandPaths.encounterNew({ patientId: d.id })} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] hover:bg-amber-50">
                <span>
                  <span className="font-semibold">{fullName(d)}</span> <span className="text-ink-faint">{d.mrn}</span>
                </span>
                <span className="text-[12px] font-semibold text-scrub-700"><LocalizedText message="Use this" /></span>
              </Link>
            ))}
          </Panel>
        )}
      </aside>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children, className }: { title: string; onEdit: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between border-b border-line-soft pb-1.5">
        <h3 className="text-[14px] font-semibold"><Copy>{title}</Copy></h3>
        <SourceButton onClick={onEdit} className="text-[12.5px] font-semibold text-scrub-700 hover:underline"><LocalizedText message="Edit" /></SourceButton>
      </div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex gap-3 py-1 text-[13.5px]">
      <span className="w-24 shrink-0 text-ink-faint"><Copy>{k}</Copy></span>
      <span className={cx("min-w-0", !v && "text-ink-faint")}><Copy>{v || tr("Not given")}</Copy></span>
    </div>
  );
}
