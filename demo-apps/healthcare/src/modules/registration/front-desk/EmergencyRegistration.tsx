"use client";
// Copied from the AllyVora clinical workspace (components/frontdesk/EmergencyRegistration.tsx) at commit 1ede87f; see provenance.json.

import { CheckCircle2, ChevronRight, ClipboardList, ShieldAlert, Siren, UserPlus, UserX } from "@pepbits/icons";
// Not exported by @pepbits/icons; lucide-react is the library @pepbits/icons wraps.
import { Ambulance, FolderOpen, HelpCircle, UserCheck } from "lucide-react";
import { Link } from "./link";
import { useEffect, useState } from "react";
import { ApiError, api, departmentsFor, useServices, type IdentityLibrary, type PatientLite } from "./lib";
import { Badge, Button, ErrorNote, Field, SelectField, TextField, cn, useDebounced, useToast } from "./ui";
import { Avatar, Notice, Pills } from "./kit";

type Mode = "known" | "unknown";
type Dup = { patient: PatientLite; reasons: string[]; score: number };
type Done = { patient: PatientLite; encounter: { id: string; class: string } | null; existing: boolean };

/** Arrival modes the unknown-patient record accepts, and the subset an emergency visit accepts (the rest record as "other"). */
const ARRIVAL: [string, string][] = [["ambulance", "Ambulance"], ["police", "Police"], ["bystander", "Brought by a bystander"], ["walk-in", "Walked in"], ["inter-facility-transfer", "Transfer from another facility"], ["other", "Other"]];
const VISIT_ARRIVAL = new Set(["ambulance", "police", "walk-in", "inter-facility-transfer", "other"]);
const DEFERRED = "Emergency registration: signature to be captured at the bedside when the patient is able.";

/**
 * Emergency registration for patients who cannot show identity: either they can say who they are
 * (no documents, verified later) or they cannot be identified (alias and temporary MRN). Both use the
 * same patient record and registration API as standard registration, and start the emergency visit.
 */
export function EmergencyRegistration() {
  const toast = useToast();
  const services = useServices();
  const erDept = departmentsFor(services, "emergency")[0]?.name ?? "Emergency";
  const [mode, setMode] = useState<Mode>("unknown");
  const [countries, setCountries] = useState<IdentityLibrary["countries"]>([]);
  useEffect(() => { api<IdentityLibrary>("/identity-policy/library").then((l) => setCountries(l.countries)).catch(() => {}); }, []);

  // Shared
  const [arrivalMode, setArrivalMode] = useState("ambulance");
  const [reason, setReason] = useState("");
  // Known but undocumented
  const [k, setK] = useState({ givenName: "", familyName: "", birthDate: "", birthDateEstimated: false, sex: "" as "" | "male" | "female" | "other" | "unknown", mobile: "", nationality: "" });
  const setKnown = <F extends keyof typeof k>(f: F, v: (typeof k)[F]) => setK((x) => ({ ...x, [f]: v }));
  const [unable, setUnable] = useState(false);
  const [treatment, setTreatment] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [deferred, setDeferred] = useState(DEFERRED);
  // Unknown
  const [u, setU] = useState({ sex: "unknown" as "male" | "female" | "unknown", estimatedAge: "", broughtBy: "", foundAt: "", referenceNumber: "", description: "", belongings: "" });
  const setUnknown = <F extends keyof typeof u>(f: F, v: (typeof u)[F]) => setU((x) => ({ ...x, [f]: v }));

  const [dups, setDups] = useState<Dup[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  // A patient who can say who they are may already have a record: offer it before creating another.
  const dq = useDebounced({ givenName: k.givenName, familyName: k.familyName, birthDate: k.birthDate, mobile: k.mobile, identifiers: [] }, 400);
  useEffect(() => {
    if (mode !== "known" || (dq.familyName.trim().length < 2 && dq.mobile.length < 9)) { setDups([]); return; }
    api<Dup[]>("/patients/duplicates", { json: dq }).then(setDups).catch(() => {});
  }, [dq, mode]);

  const visit = () => ({ type: "emergency", department: erDept, reason: reason.trim() || undefined, arrivalMode: VISIT_ARRIVAL.has(arrivalMode) ? arrivalMode : "other" });
  const age = Number(u.estimatedAge);
  const ageOk = u.estimatedAge !== "" && Number.isInteger(age) && age >= 0 && age <= 120;
  const validate = () => {
    const e: string[] = [];
    if (mode === "unknown") { if (!ageOk) e.push("Enter the estimated age in whole years (0–120)."); return e; }
    if (!k.givenName.trim() || !k.familyName.trim()) e.push("Enter the name the patient gives.");
    if (!k.birthDate) e.push("Enter the date of birth, or an estimate marked as estimated.");
    if (!k.sex) e.push("Choose administrative sex.");
    if (!unable && (!treatment || !privacy)) e.push("Record consent to treatment and the privacy notice, or that the patient is unable to consent.");
    if (!unable && deferred.trim().length < 10) e.push("Say why the signature is deferred (at least 10 characters).");
    return e;
  };

  const register = async () => {
    const e = validate(); setErrors(e);
    if (e.length) return;
    setBusy(true);
    try {
      const body = mode === "unknown" ? {
        identityMode: "unknown",
        unidentified: { estimatedAge: age, arrivalMode, broughtBy: u.broughtBy, foundAt: u.foundAt, referenceNumber: u.referenceNumber, description: u.description, belongings: u.belongings },
        sex: u.sex, sensitivity: "normal", consents: { emergencyException: true }, visit: visit(),
      } : {
        identityMode: "unverified",
        givenName: k.givenName.trim(), familyName: k.familyName.trim(), birthDate: k.birthDate, birthDateEstimated: k.birthDateEstimated, sex: k.sex,
        nationality: k.nationality || "ZZ", preferredLanguage: "und", mobile: k.mobile.trim() || undefined, identifiers: [], sensitivity: "normal",
        consents: { treatment: unable ? false : treatment, privacy: unable ? false : privacy, hie: "not-asked", sms: false, treatmentVersion: "4", privacyVersion: "2", signatureCaptured: false, signature: null,
          signatureDeferredReason: unable ? "Patient unable to consent on arrival (emergency exception)." : deferred.trim(), emergencyException: unable },
        visit: visit(),
      };
      const r = await api<{ patient: PatientLite; encounter: { id: string; class: string } | null }>("/patients", { json: body });
      setDone({ ...r, existing: false });
      toast(`${r.patient.name} registered · ${r.patient.mrn}`, "ok");
    } catch (err) {
      const ae = err as ApiError;
      setErrors([ae.message + (typeof ae.body?.mrn === "string" ? ` MRN: ${ae.body.mrn}.` : "")]);
    } finally { setBusy(false); }
  };
  const useExisting = async (p: PatientLite) => {
    setBusy(true); setErrors([]);
    try {
      const r = await api<{ encounter: { id: string; class: string } }>(`/patients/${p.id}/visits`, { json: { visit: visit() } });
      setDone({ patient: p, encounter: r.encounter, existing: true });
      toast(`Emergency visit started for ${p.name} · ${p.mrn}`, "ok");
    } catch (err) { setErrors([(err as Error).message]); } finally { setBusy(false); }
  };
  const reset = () => {
    setDone(null); setErrors([]); setDups([]); setReason(""); setArrivalMode("ambulance");
    setK({ givenName: "", familyName: "", birthDate: "", birthDateEstimated: false, sex: "", mobile: "", nationality: "" });
    setUnable(false); setTreatment(false); setPrivacy(false); setDeferred(DEFERRED);
    setU({ sex: "unknown", estimatedAge: "", broughtBy: "", foundAt: "", referenceNumber: "", description: "", belongings: "" });
  };

  const unknown = mode === "unknown";
  return (
    <div className="grid gap-3">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-crit">Front desk · Emergency</p>
          <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">Emergency registration</h1>
        </div>
        {!done && (
          <div className="inline-flex rounded-[10px] bg-sunken p-1" role="radiogroup" aria-label="Who is the patient?">
            {([["known", "Can say who they are", UserCheck], ["unknown", "Cannot be identified", UserX]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setErrors([]); }}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transition", mode === m ? (m === "unknown" ? "bg-crit text-white shadow-sm" : "bg-surface text-lapis-ink shadow-sm") : "text-ink-3 hover:text-ink")}>
                <Icon className="size-4" />{label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Link href="/front-desk/visits/new" className="inline-flex h-8 items-center gap-1.5 rounded-ctl px-2.5 text-[12.5px] text-ink-2 hover:bg-raised"><ClipboardList className="size-4" />Start a visit</Link>
          <Link href="/registration" className="inline-flex h-8 items-center gap-1.5 rounded-ctl border border-line px-2.5 text-[12.5px] text-ink-2 hover:bg-raised"><UserPlus className="size-4" />Standard registration</Link>
        </div>
      </header>

      {done ? (
        <section className="relative overflow-hidden rounded-panel border border-ok/30 bg-surface px-6 py-10 text-center">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--c-ok-soft),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-lg justify-items-center gap-3">
            <span className="grid size-12 place-items-center rounded-full bg-ok-soft text-ok"><CheckCircle2 className="size-6" /></span>
            <p className="text-[17px] font-semibold">{done.existing ? "Emergency visit started on the existing record" : "Registered and sent to triage"}</p>
            <div className="grid w-full gap-1 rounded-[14px] border border-line bg-raised px-5 py-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">Name and MRN for the wristband</p>
              <p data-phi className="text-[24px] font-semibold tracking-[-0.01em]">{done.patient.name}</p>
              <p data-phi className="num text-[20px] font-semibold text-lapis-ink">{done.patient.mrn}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {done.patient.identityStatus === "unknown" && <Badge tone="crit"><ShieldAlert className="size-3" />Unidentified · identify within 4 hours</Badge>}
                {done.patient.identityStatus === "unverified" && <Badge tone="warn">Identity not verified · verify within 24 hours</Badge>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {done.encounter && <Link href={`/emergency/triage/${done.encounter.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-ctl bg-crit px-4 text-[13px] font-medium text-white"><Siren className="size-4" />Triage now</Link>}
              <Link href={`/patients/${done.patient.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-ctl border border-line px-4 text-[13px] hover:bg-raised"><FolderOpen className="size-4" />Open chart</Link>
              <Link href="/emergency" className="inline-flex h-9 items-center rounded-ctl border border-line px-4 text-[13px] hover:bg-raised">Emergency board</Link>
              <Button variant="ghost" onClick={reset}>Register another</Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:max-h-[calc(100dvh-176px)]">
            <div className={cn("flex items-start gap-3 border-b border-line px-4 py-3", unknown ? "bg-crit-soft/40" : "bg-lapis-soft/30")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-[10px] text-white", unknown ? "bg-crit" : "bg-lapis dark:text-canvas")}>{unknown ? <UserX className="size-5" /> : <UserCheck className="size-5" />}</span>
              <div>
                <h2 className="text-[14.5px] font-semibold">{unknown ? "Unknown patient" : "Patient can say who they are"}</h2>
                <p className="text-[12.5px] text-ink-2">{unknown ? "Unconscious, confused, or no one can identify them. A distinct alias and a temporary MRN are assigned." : "Record the identity the patient gives. It is verified later against a document or next of kin."}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-4 py-4 lg:overflow-y-auto">
              {unknown ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Administrative sex" required><div><Pills value={u.sex} onChange={(v) => setUnknown("sex", v as typeof u.sex)} options={[["male", "Male"], ["female", "Female"], ["unknown", "Unknown"]]} /></div></Field>
                  <TextField label="Estimated age (years)" required type="number" min={0} max={120} inputMode="numeric" value={u.estimatedAge} onChange={(e) => setUnknown("estimatedAge", e.target.value)} hint="A birth date of 1 January of that year is recorded as estimated." />
                  <SelectField label="Arrival" value={arrivalMode} onChange={(e) => setArrivalMode(e.target.value)}>{ARRIVAL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
                  <TextField label="Brought by (optional)" value={u.broughtBy} maxLength={200} onChange={(e) => setUnknown("broughtBy", e.target.value)} placeholder="Ambulance crew, police officer, passer-by" />
                  <TextField label="Where found (optional)" value={u.foundAt} maxLength={200} onChange={(e) => setUnknown("foundAt", e.target.value)} />
                  <TextField label="Police or ambulance reference (optional)" value={u.referenceNumber} maxLength={80} onChange={(e) => setUnknown("referenceNumber", e.target.value)} />
                  <TextField label="Description (optional)" className="md:col-span-2" value={u.description} maxLength={1000} onChange={(e) => setUnknown("description", e.target.value)} placeholder="Build, hair, distinguishing marks, clothing" hint="Helps relatives and police identify the patient later." />
                  <TextField label="Belongings (optional)" value={u.belongings} maxLength={1000} onChange={(e) => setUnknown("belongings", e.target.value)} placeholder="Items kept with the patient" />
                  <TextField label="Reason for visit (for the queue)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="Given name" required autoComplete="off" value={k.givenName} maxLength={60} onChange={(e) => setKnown("givenName", e.target.value)} />
                  <TextField label="Family name" required autoComplete="off" value={k.familyName} maxLength={80} onChange={(e) => setKnown("familyName", e.target.value)} />
                  <Field label="Date of birth" required aside={<label className="flex items-center gap-1.5 text-[12px] text-ink-3"><input type="checkbox" className="size-3.5 accent-[var(--c-lapis)]" checked={k.birthDateEstimated} onChange={(e) => setKnown("birthDateEstimated", e.target.checked)} />Estimated</label>}>
                    <input type="date" value={k.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setKnown("birthDate", e.target.value)} className="h-9 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] outline-none focus:border-lapis focus:ring-2 focus:ring-lapis/15" />
                  </Field>
                  <Field label="Administrative sex" required><div><Pills value={k.sex} onChange={(v) => setKnown("sex", v as typeof k.sex)} options={[["male", "Male"], ["female", "Female"], ["other", "Other"], ["unknown", "Unknown"]]} /></div></Field>
                  <TextField label="Mobile (if known)" type="tel" autoComplete="off" value={k.mobile} maxLength={30} onChange={(e) => setKnown("mobile", e.target.value)} placeholder="Include the country calling code" />
                  <SelectField label="Nationality (if known)" value={k.nationality} onChange={(e) => setKnown("nationality", e.target.value)}><option value="">Not known</option>{countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</SelectField>
                  <SelectField label="Arrival" value={arrivalMode} onChange={(e) => setArrivalMode(e.target.value)}>{ARRIVAL.filter(([v]) => VISIT_ARRIVAL.has(v)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
                  <TextField label="Reason for visit (for the queue)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                  <fieldset className="grid gap-2 rounded-[12px] border border-line p-3 md:col-span-2">
                    <legend className="px-1 text-[12.5px] font-semibold">Consent</legend>
                    <label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5 size-4 accent-[var(--c-crit)]" checked={unable} onChange={(e) => setUnable(e.target.checked)} /><span><b>The patient is unable to consent now.</b> <span className="text-ink-3">Treat under the emergency exception and obtain consent when able.</span></span></label>
                    {!unable && (
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="size-4 accent-[var(--c-lapis)]" checked={treatment} onChange={(e) => setTreatment(e.target.checked)} />Consents to examination and treatment</label>
                        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="size-4 accent-[var(--c-lapis)]" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />Privacy notice acknowledged</label>
                        <TextField label="Why the signature is deferred" className="md:col-span-2" value={deferred} maxLength={500} onChange={(e) => setDeferred(e.target.value)} />
                      </div>
                    )}
                  </fieldset>
                </div>
              )}
            </div>

            <div className="border-t border-line bg-raised px-4 py-3">
              {errors.length > 0 && <div className="mb-3"><ErrorNote><ul className="list-disc pl-5">{errors.map((x) => <li key={x}>{x}</li>)}</ul></ErrorNote></div>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] text-ink-3">Goes to <b className="text-ink-2">{erDept}</b> triage. Registration is recorded in the audit log.</p>
                <Button variant="danger" loading={busy} onClick={() => void register()} icon={<Siren className="size-4" />} className="h-10 px-5">
                  {unknown ? "Register unknown patient" : "Register and send to triage"}
                </Button>
              </div>
            </div>
          </section>

          <aside className="grid gap-3 lg:sticky lg:top-[68px]">
            {!unknown && dups.length > 0 && (
              <section className="overflow-hidden rounded-panel border border-warn/40 bg-surface">
                <h3 className="border-b border-line bg-warn-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-warn">Possible existing record</h3>
                <ul className="max-h-[260px] divide-y divide-line overflow-y-auto">
                  {dups.slice(0, 5).map((d) => (
                    <li key={d.patient.id} className="flex items-center gap-3 px-3.5 py-2.5">
                      <Avatar name={d.patient.name} />
                      <span className="min-w-0 flex-1"><span data-phi className="block truncate text-[13px] font-medium">{d.patient.name}</span><span className="num block truncate text-[11.5px] text-ink-3"><span data-phi>{d.patient.mrn}</span> · {d.reasons.join(", ")}</span></span>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void useExisting(d.patient)} title="Start the emergency visit on this record instead of registering again">Use<ChevronRight className="size-3.5" /></Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="rounded-panel border border-line bg-surface p-3.5 text-[12.5px]">
              <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><HelpCircle className="size-4 text-lapis" />{unknown ? "What happens" : "When to use this"}</h3>
              {unknown ? (
                <ul className="grid gap-1.5 text-ink-2">
                  <li>• A distinct alias (for example <b>Unknown Kilo-0042</b>) and a temporary MRN (<b>TMP-######</b>) are assigned, so two unknown patients are never confused.</li>
                  <li>• Treatment proceeds under the emergency consent exception.</li>
                  <li>• An urgent task asks reception to identify the patient within 4 hours.</li>
                  <li>• When identified, <b>Identify patient</b> renames this record or merges it into the patient's existing one. Nothing recorded is lost.</li>
                </ul>
              ) : (
                <ul className="grid gap-1.5 text-ink-2">
                  <li>• The patient is conscious and tells you who they are, but has no identity document or phone.</li>
                  <li>• A normal MRN is assigned; the identity is marked <b>not verified</b>.</li>
                  <li>• A task asks reception to verify it within 24 hours, against a document or with next of kin.</li>
                  <li>• If they already have a record, use it from <b>Possible existing record</b> instead of registering again.</li>
                </ul>
              )}
            </section>
            <Notice tone="lapis" icon={<Ambulance className="size-4" />} title="Has an identity document?">
              Use <Link href="/registration" className="font-medium underline">standard registration</Link>, or <Link href="/front-desk/visits/new" className="font-medium underline">Start a visit</Link> for a registered patient.
            </Notice>
          </aside>
        </div>
      )}
    </div>
  );
}
