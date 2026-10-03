"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceTextarea, SourceSelect, SourceButton } from "@pepbits/ops-ui";

import { useRouter } from "@pepbits/reference-surgisuite/internal-navigation";
import { useEffect, useMemo, useState } from "react";
import { useSourceApi, ApiError } from "./../lib/api";
import { TEAM_ROLE_STAFF, useDiagnoses, useEquipment, useLookups, useProcedures, useStaff, useTheatres, type Diagnosis, type Procedure } from "./../lib/masters";
import { age, duration, toLocalInput } from "./../lib/format";
import { Badge, Button, Drawer, ErrorNote, Field, Select, cx, useAction } from "./ui";
import { IconCheck, IconClose, IconPlus, IconSearch } from "./icons";

type Patient = { id: number; name: string; mrn: string; dob: string; sex: string; allergies: string; insurer: string | null; comorbidities: string };
type ProcPick = { proc: Procedure; role: string; laterality: string };

const STEPS = ["Patient", "Diagnosis & procedures", "Team & equipment", "Theatre & time"] as const;

export function BookCaseDrawer({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: { theatreId?: number; start?: string } }) {
 const {t:translateSource}=useLocalization();
 const api=useSourceApi();
  const router = useRouter();
  const lookups = useLookups();
  const procedures = useProcedures();
  const diagnoses = useDiagnoses();
  const staff = useStaff();
  const theatres = useTheatres();
  const equipment = useEquipment();
  const { run, busy, error, setError } = useAction();

  const [step, setStep] = useState(0);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [dx, setDx] = useState<{ d: Diagnosis; primary: boolean }[]>([]);
  const [procs, setProcs] = useState<ProcPick[]>([]);
  const [clinical, setClinical] = useState({ caseClass: "Elective", anesthesiaType: "", asaClass: "II", position: "Supine", woundClass: "", laterality: "N/A", notes: "" });
  const [team, setTeam] = useState<Record<string, string>>({});
  const [equip, setEquip] = useState<number[]>([]);
  const [slot, setSlot] = useState({ theatreId: "", start: "", duration: "" });
  const [conflicts, setConflicts] = useState<{ message: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPatient(null);
    setDx([]);
    setProcs([]);
    setTeam({});
    setEquip([]);
    setConflicts([]);
    setError(null);
    setClinical({ caseClass: "Elective", anesthesiaType: "", asaClass: "II", position: "Supine", woundClass: "", laterality: "N/A", notes: "" });
    const d = new Date(Date.now() + 86400000);
    d.setHours(8, 0, 0, 0);
    setSlot({ theatreId: prefill?.theatreId ? String(prefill.theatreId) : "", start: prefill?.start ? toLocalInput(prefill.start) : toLocalInput(d.toISOString()), duration: "" });
  }, [open, prefill, setError]);

  const primary = procs.find((p) => p.role === "Primary")?.proc;
  const estDuration = slot.duration ? Number(slot.duration) : procs.reduce((a, p) => a + p.proc.default_duration_min, 0) + (procs.length ? 35 : 0);

  // Sensible defaults from the primary procedure
  useEffect(() => {
    if (!primary) return;
    setClinical((c) => ({ ...c, woundClass: c.woundClass || primary.wound_class }));
  }, [primary]);

  // Live conflict check on the final step
  useEffect(() => {
    if (step !== 3 || !slot.theatreId || !slot.start) return;
    const t = setTimeout(() => {
      api<{ message: string }[]>("/cases/check-conflicts", {
        body: {
          scheduledStart: new Date(slot.start).toISOString(), estDurationMin: estDuration, theatreId: Number(slot.theatreId),
          staffIds: Object.values(team).filter(Boolean).map(Number), equipmentIds: equip,
        },
      }).then(setConflicts).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [step, slot, team, equip, estDuration]);

  const stepValid = [!!patient, dx.length > 0 && procs.some((p) => p.role === "Primary") && !!clinical.anesthesiaType, !!team["Primary Surgeon"] && !!team["Anesthesiologist"], !!slot.theatreId && !!slot.start];

  const submit = async (force = false) => {
    const body = {
      patientId: patient!.id, theatreId: Number(slot.theatreId), scheduledStart: new Date(slot.start).toISOString(), estDurationMin: estDuration,
      caseClass: clinical.caseClass, anesthesiaType: clinical.anesthesiaType, asaClass: clinical.asaClass + (clinical.caseClass === "Emergency" && !clinical.asaClass.endsWith("E") ? "E" : ""),
      position: clinical.position, woundClass: clinical.woundClass || primary?.wound_class, laterality: clinical.laterality, notes: clinical.notes || null,
      diagnoses: dx.map((x) => ({ diagnosisId: x.d.id, isPrimary: x.primary })),
      procedures: procs.map((p) => ({ procedureId: p.proc.id, role: p.role, laterality: p.laterality })),
      team: Object.entries(team).filter(([, v]) => v).map(([role, id]) => ({ role, staffId: Number(id) })),
      equipmentIds: equip, force,
    };
    const r = await run(() => api<{ id: number; case_no: string }>("/cases", { body }), "Case booked");
    if (r) {
      onClose();
      router.push(`/cases/${r.id}`);
    }
  };

  const conflictErr = error instanceof ApiError && error.status === 409;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      title="Book a case"
      subtitle={patient ? `${patient.name}, ${age(patient.dob)} ${patient.sex}, ${patient.mrn}` : "Pick the patient first"}
      footer={
        <>
          {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}><LocalizedText message={"Back"}/></Button>}
          <div className="flex-1" />
          {step < 3 ? (
            <Button variant="primary" disabled={!stepValid[step]} onClick={() => setStep(step + 1)}>
              <LocalizedText message={"Continue to"}/>{" "}{STEPS[step + 1].toLowerCase()}
            </Button>
          ) : conflictErr ? (
            <Button variant="danger" busy={busy} onClick={() => submit(true)}><LocalizedText message={"Book despite overlap"}/></Button>
          ) : (
            <Button variant="primary" busy={busy} disabled={!stepValid.every(Boolean)} onClick={() => submit(false)}>
              <LocalizedText message={"Book case"}/></Button>
          )}
        </>
      }
    >
      <ol className="flex border-b border-line bg-steel/50 px-3">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <SourceButton
              onClick={() => i <= step || stepValid.slice(0, i).every(Boolean) ? setStep(i) : null}
              className={cx("flex w-full items-center gap-2 border-b-2 px-2 py-2.5 text-left text-[13px]", i === step ? "border-ceil font-medium text-ink" : "border-transparent text-muted")}
            >
              <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", stepValid[i] && i < step ? "bg-go text-white" : i === step ? "bg-ceil text-white" : "bg-steel-2 text-muted")}>
                {stepValid[i] && i < step ? <IconCheck size={12} /> : i + 1}
              </span>
              <span className="hidden truncate sm:inline">{s}</span>
            </SourceButton>
          </li>
        ))}
      </ol>
      <div className="p-5">
        {step === 0 && <PatientStep value={patient} onChange={setPatient} />}
        {step === 1 && (
          <div className="space-y-5">
            <CodePicker
              label="Diagnoses (ICD-10)"
              items={diagnoses}
              itemKey={(d) => d.id}
              render={(d) => (<><span className="font-medium">{d.icd10}</span> <span className="text-muted">{d.description}</span></>)}
              match={(d, q) => `${d.icd10} ${d.description}`.toLowerCase().includes(q)}
              onPick={(d) => !dx.some((x) => x.d.id === d.id) && setDx([...dx, { d, primary: dx.length === 0 }])}
            />
            <ul className="space-y-1.5">
              {dx.map((x) => (
                <li key={x.d.id} className="flex items-center gap-2 rounded-[6px] border border-line px-3 py-1.5">
                  <span className="w-20 font-medium">{x.d.icd10}</span>
                  <span className="min-w-0 flex-1 truncate">{x.d.description}</span>
                  <SourceButton className={cx("rounded px-2 text-[12px]", x.primary ? "bg-ceil-soft text-ceil-2" : "text-muted hover:bg-steel")} onClick={() => setDx(dx.map((y) => ({ ...y, primary: y.d.id === x.d.id })))}>
                    {x.primary ? "Primary" : "Set primary"}
                  </SourceButton>
                  <SourceButton aria-label="Remove" className="text-muted hover:text-stop" onClick={() => setDx(dx.filter((y) => y.d.id !== x.d.id))}><IconClose size={15} /></SourceButton>
                </li>
              ))}
            </ul>
            <CodePicker
              label="Procedures (CPT)"
              items={procedures}
              itemKey={(p) => p.id}
              render={(p) => (<><span className="font-medium">{p.cpt}</span> <span>{p.name}</span> <span className="text-muted">— {p.specialty}{p.is_addon ? ", add-on" : ""}</span></>)}
              match={(p, q) => `${p.cpt} ${p.name} ${p.specialty}`.toLowerCase().includes(q)}
              onPick={(p) => !procs.some((x) => x.proc.id === p.id) && setProcs([...procs, { proc: p, role: procs.some((x) => x.role === "Primary") ? (p.is_addon ? "Add-on" : "Secondary") : "Primary", laterality: clinical.laterality }])}
            />
            <ul className="space-y-1.5">
              {procs.map((x, i) => (
                <li key={x.proc.id} className="grid grid-cols-[64px_1fr_120px_100px_20px] items-center gap-2 rounded-[6px] border border-line px-3 py-1.5">
                  <span className="font-medium">{x.proc.cpt}</span>
                  <span className="min-w-0 truncate">{x.proc.name}<span className="ml-2 text-[12px] text-muted">{duration(x.proc.default_duration_min)}</span></span>
                  <SourceSelect className="input h-7" value={x.role} onChange={(e) => setProcs(procs.map((y, j) => (j === i ? { ...y, role: e.target.value } : e.target.value === "Primary" && y.role === "Primary" ? { ...y, role: "Secondary" } : y)))}>
                    {(lookups.PROC_ROLE ?? ["Primary", "Secondary", "Add-on"]).map((r) => <option key={r}>{r}</option>)}
                  </SourceSelect>
                  <SourceSelect className="input h-7" value={x.laterality} onChange={(e) => setProcs(procs.map((y, j) => (j === i ? { ...y, laterality: e.target.value } : y)))}>
                    {(lookups.LATERALITY ?? ["N/A"]).map((r) => <option key={r}>{r}</option>)}
                  </SourceSelect>
                  <SourceButton aria-label="Remove" className="text-muted hover:text-stop" onClick={() => setProcs(procs.filter((_, j) => j !== i))}><IconClose size={15} /></SourceButton>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Case class"><Select value={clinical.caseClass} onChange={(e) => setClinical({ ...clinical, caseClass: e.target.value })} options={lookups.CASE_CLASS ?? []} /></Field>
              <Field label="Anesthesia"><Select value={clinical.anesthesiaType} placeholder="Choose" onChange={(e) => setClinical({ ...clinical, anesthesiaType: e.target.value })} options={lookups.ANESTHESIA ?? []} /></Field>
              <Field label="ASA class"><Select value={clinical.asaClass} onChange={(e) => setClinical({ ...clinical, asaClass: e.target.value })} options={(lookups.ASA ?? []).filter((a) => !a.endsWith("E"))} /></Field>
              <Field label="Position"><Select value={clinical.position} onChange={(e) => setClinical({ ...clinical, position: e.target.value })} options={lookups.POSITION ?? []} /></Field>
              <Field label="Laterality"><Select value={clinical.laterality} onChange={(e) => setClinical({ ...clinical, laterality: e.target.value })} options={lookups.LATERALITY ?? []} /></Field>
              <Field label="Wound class"><Select value={clinical.woundClass} placeholder="From procedure" onChange={(e) => setClinical({ ...clinical, woundClass: e.target.value })} options={lookups.WOUND_CLASS ?? []} /></Field>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(TEAM_ROLE_STAFF).map((role) => {
                const opts = staff
                  .filter((s) => TEAM_ROLE_STAFF[role].includes(s.role) && s.active)
                  .sort((a, b) => Number(b.specialty === primary?.specialty) - Number(a.specialty === primary?.specialty));
                const required = role === "Primary Surgeon" || role === "Anesthesiologist";
                return (
                  <Field key={role} label={required ? `${role} (required)` : role}>
                    <SourceSelect className="input" value={team[role] ?? ""} onChange={(e) => setTeam({ ...team, [role]: e.target.value })}>
                      <option value="">{required ? "Choose" : "Not needed"}</option>
                      {opts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.specialty && s.specialty === primary?.specialty ? ` — ${s.specialty}` : ""}
                        </option>
                      ))}
                    </SourceSelect>
                  </Field>
                );
              })}
            </div>
            <div>
              <p className="mb-2 text-[12px] font-medium text-muted"><LocalizedText message={"Equipment"}/></p>
              <div className="flex flex-wrap gap-1.5">
                {equipment.map((e) => {
                  const on = equip.includes(e.id);
                  return (
                    <SourceButton
                      key={e.id}
                      onClick={() => setEquip(on ? equip.filter((x) => x !== e.id) : [...equip, e.id])}
                      className={cx("rounded-[6px] border px-2.5 py-1 text-[13px]", on ? "border-ceil bg-ceil-soft text-ceil-2" : "border-line hover:bg-steel", e.status !== "Ready" && "opacity-60")}
                      title={e.status !== "Ready" ? `${e.status}` : undefined}
                    >
                      {e.name}{e.status !== "Ready" ? ` (${e.status.toLowerCase()})` : ""}
                    </SourceButton>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Theatre">
                <Select value={slot.theatreId} placeholder="Choose" onChange={(e) => setSlot({ ...slot, theatreId: e.target.value })} options={theatres.map((t) => ({ value: t.id, label: `${t.code} ${t.name} (${t.kind})` }))} />
              </Field>
              <Field label="Start">
                <SourceInput type="datetime-local" className="input" value={slot.start} step={900} onChange={(e) => setSlot({ ...slot, start: e.target.value })} />
              </Field>
              <Field label="Duration (min)" hint={translateSource("Suggested {value0} incl. 35 min prep",{value0:procs.reduce((a, p) => a + p.proc.default_duration_min, 0) + 35})}>
                <SourceInput type="number" className="input" min={15} step={15} value={slot.duration || estDuration} onChange={(e) => setSlot({ ...slot, duration: e.target.value })} />
              </Field>
            </div>
            {conflicts.length > 0 ? (
              <div className="rounded-[8px] border border-[#ecd6a8] bg-amber-soft px-3 py-2 text-[13px]">
                <p className="font-medium text-amber"><LocalizedText message={"This slot overlaps other bookings"}/></p>
                <ul className="mt-1 list-disc pl-5">{conflicts.map((c) => <li key={c.message}>{c.message}</li>)}</ul>
              </div>
            ) : slot.theatreId ? (
              <p className="flex items-center gap-2 text-[13px] text-go"><IconCheck size={16} /> {" "}<LocalizedText message={"No overlaps for the theatre, team or equipment."}/></p>
            ) : null}
            <div className="rounded-[10px] border border-line">
              <div className="border-b border-line px-4 py-2 font-cond font-semibold"><LocalizedText message={"Review"}/></div>
              <dl className="grid gap-x-6 gap-y-2 px-4 py-3 text-[13px] sm:grid-cols-2">
                <Row k="Patient" v={patient ? `${patient.name} (${patient.mrn})` : "—"} />
                <Row k="Allergies" v={patient?.allergies ?? "—"} />
                <Row k="Primary diagnosis" v={dx.find((x) => x.primary)?.d.icd10 ?? "—"} />
                <Row k="Procedures" v={procs.map((p) => p.proc.cpt).join(", ") || "—"} />
                <Row k="Surgeon" v={staff.find((s) => String(s.id) === team["Primary Surgeon"])?.name ?? "—"} />
                <Row k="Anesthesia" v={`${clinical.anesthesiaType || "—"}, ASA ${clinical.asaClass}`} />
                <Row k="Class" v={clinical.caseClass} />
                <Row k="Approvals" v={patient?.insurer && clinical.caseClass !== "Emergency" ? "Pre-auth and anesthesia fitness will be requested" : "Anesthesia fitness will be requested"} />
              </dl>
            </div>
            <Field label="Booking notes">
              <SourceTextarea className="input" rows={2} value={clinical.notes} onChange={(e) => setClinical({ ...clinical, notes: e.target.value })} placeholder="Special requests for the theatre team" />
            </Field>
          </div>
        )}
        <ErrorNote error={error} className="mt-4" />
      </div>
    </Drawer>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-muted">{k}</dt>
      <dd className="min-w-0 font-medium">{v}</dd>
    </div>
  );
}

export function CodePicker<T>({ label, items, itemKey, render, match, onPick }: { label: string; items: T[]; itemKey: (t: T) => number; render: (t: T) => React.ReactNode; match: (t: T, q: string) => boolean; onPick: (t: T) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (q.trim() ? items.filter((i) => match(i, q.trim().toLowerCase())).slice(0, 8) : []), [q, items, match]);
  return (
    <div className="relative">
      <Field label={label}>
        <div className="relative">
          <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <SourceInput className="input pl-8" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Type a code or name" />
        </div>
      </Field>
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-auto rounded-[8px] border border-line bg-white py-1 shadow-lg">
          {results.map((r) => (
            <li key={itemKey(r)}>
              <SourceButton className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-steel" onMouseDown={() => { onPick(r); setQ(""); }}>
                <IconPlus size={14} className="shrink-0 text-ceil" />
                <span className="truncate">{render(r)}</span>
              </SourceButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PatientStep({ value, onChange }: { value: Patient | null; onChange: (p: Patient) => void }) {
 const api=useSourceApi();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Patient[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", dob: "", sex: "F", allergies: "", insurer: "", policy_no: "", comorbidities: "" });
  const { run, busy, error } = useAction();
  useEffect(() => {
    const t = setTimeout(() => api<Patient[]>(`/patients?q=${encodeURIComponent(q)}`).then(setList).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);

  if (creating)
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Full name" className="sm:col-span-2"><SourceInput className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Sex"><Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} options={[{ value: "F", label: "Female" }, { value: "M", label: "Male" }, { value: "X", label: "Other" }]} /></Field>
          <Field label="Date of birth"><SourceInput type="date" className="input" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Allergies" hint="Leave blank for none known"><SourceInput className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></Field>
          <Field label="Comorbidities"><SourceInput className="input" value={form.comorbidities} onChange={(e) => setForm({ ...form, comorbidities: e.target.value })} /></Field>
          <Field label="Insurer"><SourceInput className="input" value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} placeholder="Self-pay if blank" /></Field>
          <Field label="Policy number"><SourceInput className="input" value={form.policy_no} onChange={(e) => setForm({ ...form, policy_no: e.target.value })} /></Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setCreating(false)}><LocalizedText message={"Back to search"}/></Button>
          <Button
            variant="primary"
            busy={busy}
            disabled={!form.name || !form.dob}
            onClick={async () => {
              const r = await run(() => api<{ id: number }>("/patients", { body: form }), "Patient registered");
              if (r) onChange(await api<Patient>(`/patients/${r.id}`));
            }}
          >
            <LocalizedText message={"Register patient"}/></Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <SourceInput className="input pl-8" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or MRN" />
        </div>
        <Button onClick={() => setCreating(true)}><IconPlus size={16} /> {" "}<LocalizedText message={"New patient"}/></Button>
      </div>
      <ul className="divide-y divide-line rounded-[8px] border border-line">
        {list.slice(0, 9).map((p) => (
          <li key={p.id}>
            <SourceButton onClick={() => onChange(p)} className={cx("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-steel", value?.id === p.id && "bg-ceil-soft")}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.name}</span>
                <span className="block text-[12px] text-muted">{p.mrn}, {age(p.dob)} {p.sex}{p.comorbidities ? `, ${p.comorbidities}` : ""}</span>
              </span>
              {p.allergies !== "NKDA" && <Badge tone="stop"><LocalizedText message={"Allergy:"}/>{" "}{p.allergies}</Badge>}
              <span className="w-28 text-right text-[12px] text-muted">{p.insurer ?? "Self-pay"}</span>
              {value?.id === p.id && <IconCheck size={16} className="text-ceil" />}
            </SourceButton>
          </li>
        ))}
      </ul>
    </div>
  );
}
