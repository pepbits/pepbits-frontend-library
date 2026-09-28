"use client";

import { ArrowLeft, ArrowRight, Check, FileCheck2, Upload } from "lucide-react";
import { Link } from "../lib/router";
import { useRouter } from "../lib/router";
import { useState } from "react";
import { Avatar, Button, Card, CardGrid, CardHeader, DateInput, Field, Input, Select, Textarea, Toggle, useToast } from "../ui";
import { Stepper } from "../components/shared/stepper";
import { useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import type { Student } from "../lib/types";
import { cn, isoDay, toDate } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STEPS = ["Personal", "Academic", "Guardian", "Documents & medical"];
const DOCS = ["Birth certificate", "Transfer certificate", "Previous report card", "Passport photo", "Immunisation record", "Address proof"];

type Form = Record<string, string>;
const initialForm = (): Form => ({
  firstName: "", lastName: "", dob: "", gender: "", bloodGroup: "", nationality: "", email: "", phone: "", address: "", city: "",
  grade: "", classId: "", house: "", transport: "Own transport", previousSchool: "", admissionDate: isoDay(new Date()), secondLanguage: "French",
  guardianName: "", guardianRelation: "Mother", guardianPhone: "", guardianEmail: "", guardianOccupation: "", emergencyName: "", emergencyPhone: "",
  allergies: "", medical: "", doctor: "",
});

const REQUIRED: Record<number, [string, string][]> = {
  0: [["firstName", "First name"], ["lastName", "Last name"], ["dob", "Date of birth"], ["gender", "Gender"], ["address", "Address"]],
  1: [["grade", "Grade"], ["classId", "Section"], ["admissionDate", "Admission date"]],
  2: [["guardianName", "Guardian name"], ["guardianPhone", "Guardian phone"], ["guardianEmail", "Guardian email"]],
  3: [],
};

export function RegisterStudentPage() {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const router = useRouter();
  const toast = useToast();
  const { classes, reload } = useLookups();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(initialForm);
  const [docs, setDocs] = useState<Record<string, boolean>>({ "Birth certificate": true, "Passport photo": true });
  const [consent, setConsent] = useState({ photo: true, trips: true, terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: "" })); };
  const sections = classes.filter((c) => String(c.grade) === f.grade);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    for (const [k, label] of REQUIRED[s]!) if (!f[k]?.trim()) e[k] = `${label} is required`;
    if (s === 0) {
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email";
      if (f.dob) { const age = (Date.now() - toDate(f.dob).getTime()) / 3.156e10; if (age < 9 || age > 19) e.dob = "Age must be between 9 and 19 for grades 6–12"; }
    }
    if (s === 2) {
      if (f.guardianEmail && !/^\S+@\S+\.\S+$/.test(f.guardianEmail)) e.guardianEmail = "Enter a valid email";
      if (f.guardianPhone && f.guardianPhone.replace(/\D/g, "").length < 8) e.guardianPhone = "Enter a full phone number";
    }
    if (s === 3 && !consent.terms) e.terms = "The guardian must accept the enrolment terms";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const submit = async () => {
    for (let i = 0; i < STEPS.length; i++) if (!validate(i)) { setStep(i); return; }
    setSaving(true);
    try {
      const body: Partial<Student> = {
        name: `${f.firstName.trim()} ${f.lastName.trim()}`, gender: f.gender as Student["gender"], dob: f.dob, classId: f.classId, email: f.email.trim() || undefined, // the school issues an address when none is given
        phone: f.phone, guardianName: f.guardianName, guardianRelation: f.guardianRelation, guardianPhone: f.guardianPhone, address: [f.address, f.city].filter(Boolean).join(", "),
        bloodGroup: f.bloodGroup || "—", house: f.house || "Everest", transport: f.transport,
      };
      const { data } = await api.post<{ data: Student }>("/students", body);
      reload();
      toast(referenceT("{value0} registered · admission no. {value1}", { value0: data.name, value1: data.admissionNo }));
      router.push("/students");
    } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(false); }
  };

  const name = `${f.firstName} ${f.lastName}`.trim();
  const inv = (k: string) => ({ invalid: !!errors[k] });

  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <Card className="lg:col-span-9">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Link href="/students"><Button size="xs" variant="ghost" icon={ArrowLeft} aria-label={referenceT("Back to students")} /></Link>
          <Stepper steps={STEPS} current={step} onStep={setStep} />
          <span className="ml-auto text-[11px] text-muted"><ReferenceText message="Fields marked * are required" /></span>
        </div>

        <div className="p-3">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={referenceT("First name")} required error={errors.firstName}><Input value={f.firstName} onChange={set("firstName")} {...inv("firstName")} autoFocus /></Field>
              <Field label={referenceT("Last name")} required error={errors.lastName}><Input value={f.lastName} onChange={set("lastName")} {...inv("lastName")} /></Field>
              <Field label={referenceT("Date of birth")} required error={errors.dob}><DateInput value={f.dob} onChange={set("dob")} {...inv("dob")} /></Field>
              <Field label={referenceT("Gender")} required error={errors.gender}>
                <Select value={f.gender} onChange={set("gender")} {...inv("gender")}><option value=""><ReferenceText message="Select" /></option><option><ReferenceText message="Female" /></option><option><ReferenceText message="Male" /></option></Select>
              </Field>
              <Field label={referenceT("Blood group")}><Select value={f.bloodGroup} onChange={set("bloodGroup")}><option value=""><ReferenceText message="Unknown" /></option>{["A+", "A−", "B+", "B−", "O+", "O−", "AB+", "AB−"].map((b) => <option key={b}>{b}</option>)}</Select></Field>
              <Field label={referenceT("Nationality")}><Input value={f.nationality} onChange={set("nationality")} placeholder={referenceT("e.g. Spanish")} /></Field>
              <Field label={referenceT("Student email")} error={errors.email} hint={referenceT("Leave blank to auto-create a school address")}><Input type="email" value={f.email} onChange={set("email")} {...inv("email")} /></Field>
              <Field label={referenceT("Student phone")}><Input value={f.phone} onChange={set("phone")} placeholder={referenceT("Optional")} /></Field>
              <Field label={referenceT("Street address")} required error={errors.address} className="sm:col-span-2 lg:col-span-3"><Input value={f.address} onChange={set("address")} {...inv("address")} /></Field>
              <Field label={referenceT("City")}><Input value={f.city} onChange={set("city")} /></Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={referenceT("Grade")} required error={errors.grade}>
                <Select value={f.grade} onChange={(e) => { setF((x) => ({ ...x, grade: e.target.value, classId: "" })); setErrors((x) => ({ ...x, grade: "" })); }} {...inv("grade")}>
                  <option value=""><ReferenceText message="Select grade" /></option>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}><ReferenceText message="Grade" /> {g}</option>)}
                </Select>
              </Field>
              <Field label={referenceT("Section")} required error={errors.classId}>
                <Select value={f.classId} onChange={set("classId")} disabled={!f.grade} {...inv("classId")}>
                  <option value="">{f.grade ? referenceT("Select section") : referenceT("Choose a grade first")}</option>
                  {sections.map((c) => <option key={c.id} value={c.id}>{c.section} · {c.strength}/{c.capacity} <ReferenceText message="seats" />{c.strength >= c.capacity ? referenceT(" (full)") : ""}</option>)}
                </Select>
              </Field>
              <Field label={referenceT("Admission date")} required error={errors.admissionDate}><DateInput value={f.admissionDate} onChange={set("admissionDate")} /></Field>
              <Field label={referenceT("House")}><Select value={f.house} onChange={set("house")}><option value=""><ReferenceText message="Auto-assign" /></option>{["Everest", "Kilimanjaro", "Andes", "Alps"].map((h) => <option key={h}>{h}</option>)}</Select></Field>
              <Field label={referenceT("Transport")}><Select value={f.transport} onChange={set("transport")}>{["Own transport", "Route 1 – North", "Route 2 – East", "Route 3 – Harbour", "Route 4 – Hills"].map((h) => <option key={h}>{h}</option>)}</Select></Field>
              <Field label={referenceT("Second language")}><Select value={f.secondLanguage} onChange={set("secondLanguage")}>{["French", "Spanish", "German", "Mandarin"].map((h) => <option key={h}>{h}</option>)}</Select></Field>
              <Field label={referenceT("Previous school")} className="sm:col-span-2"><Input value={f.previousSchool} onChange={set("previousSchool")} placeholder={referenceT("Name and city")} /></Field>
              {f.classId && (() => { const c = classes.find((x) => x.id === f.classId)!; return (
                <div className="rounded-md border border-brand/30 bg-brand/5 p-2.5 text-xs sm:col-span-2 lg:col-span-4"><ReferenceText message="Joining" /><b>{c.name}</b> <ReferenceText message="in room" /> {c.room} · {c.stream} <ReferenceText message="stream · the new student will be roll number" /> <b>{c.strength + 1}</b>.
                </div>); })()}
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={referenceT("Guardian name")} required error={errors.guardianName}><Input value={f.guardianName} onChange={set("guardianName")} {...inv("guardianName")} /></Field>
              <Field label={referenceT("Relationship")}><Select value={f.guardianRelation} onChange={set("guardianRelation")}>{["Mother", "Father", "Guardian", "Grandparent"].map((h) => <option key={h}>{h}</option>)}</Select></Field>
              <Field label={referenceT("Phone")} required error={errors.guardianPhone}><Input value={f.guardianPhone} onChange={set("guardianPhone")} {...inv("guardianPhone")} placeholder="+1 555 010 2030" /></Field>
              <Field label={referenceT("Email")} required error={errors.guardianEmail} hint={referenceT("Parent portal invite goes here")}><Input type="email" value={f.guardianEmail} onChange={set("guardianEmail")} {...inv("guardianEmail")} /></Field>
              <Field label={referenceT("Occupation")}><Input value={f.guardianOccupation} onChange={set("guardianOccupation")} /></Field>
              <Field label={referenceT("Emergency contact")}><Input value={f.emergencyName} onChange={set("emergencyName")} placeholder={referenceT("If guardian unreachable")} /></Field>
              <Field label={referenceT("Emergency phone")}><Input value={f.emergencyPhone} onChange={set("emergencyPhone")} /></Field>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-muted"><ReferenceText message="Documents received" /></p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DOCS.map((d) => (
                    <button type="button" key={d} onClick={() => setDocs((x) => ({ ...x, [d]: !x[d] }))}
                      aria-pressed={!!docs[d]} className={cn("flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition", docs[d] ? "border-ok/40 bg-ok/5" : "border-dashed border-line hover:bg-subtle")}>
                      {docs[d] ? <FileCheck2 className="size-4 text-ok" /> : <Upload className="size-4 text-faint" />}
                      <span className="flex-1">{d}</span><span className="text-[10px] text-muted">{docs[d] ? referenceT("Received") : referenceT("Pending")}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                <Field label={referenceT("Allergies")}><Input value={f.allergies} onChange={set("allergies")} placeholder={referenceT("e.g. Peanuts, penicillin")} /></Field>
                <Field label={referenceT("Medical conditions & notes")}><Textarea value={f.medical} onChange={set("medical")} className="min-h-14" /></Field>
                <Field label={referenceT("Family doctor")}><Input value={f.doctor} onChange={set("doctor")} /></Field>
              </div>
              <div className="grid gap-2 rounded-md border border-line p-2.5 text-xs lg:col-span-2">
                {([["photo", "Photos of the student may appear in school publications"], ["trips", "Permission for local educational trips"], ["terms", "Guardian accepts the enrolment terms and fee policy *"]] as const).map(([k, label]) => (
                  <Toggle key={k} label={label} checked={consent[k]} onChange={(v) => { setConsent((c) => ({ ...c, [k]: v })); setErrors((x) => ({ ...x, terms: "" })); }} />
                ))}
                {errors.terms && <p className="text-[11px] text-bad">{errors.terms}</p>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line bg-subtle/50 px-3 py-2">
          <Button icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ReferenceText message="Back" /></Button>
          <span className="text-[11px] text-muted"><ReferenceText message="Step" /> {step + 1} <ReferenceText message="of" /> {STEPS.length}</span>
          <div className="ml-auto flex gap-2">
            <Link href="/students"><Button variant="ghost"><ReferenceText message="Cancel" /></Button></Link>
            {step < STEPS.length - 1
              ? <Button variant="primary" onClick={next}><ReferenceText message="Continue" /> <ArrowRight className="size-3.5" /></Button>
              : <Button variant="primary" icon={Check} loading={saving} onClick={submit}><ReferenceText message="Register student" /></Button>}
          </div>
        </div>
      </Card>

      <Card className="h-fit lg:col-span-3">
        <CardHeader title={referenceT("Registration summary")} sub={referenceT("Updates as you type")} />
        <div className="flex items-center gap-2.5 border-b border-line p-3">
          <Avatar name={name || "New Student"} size={40} />
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{name || referenceT("New student")}</p><p className="text-[11px] text-muted">{f.classId ? classes.find((c) => c.id === f.classId)?.name : referenceT("Class not chosen")}</p></div>
        </div>
        <dl className="grid gap-1.5 p-3 text-xs">
          {[["Date of birth", f.dob], ["Gender", f.gender], ["Guardian", f.guardianName && `${f.guardianName} (${f.guardianRelation})`], ["Guardian phone", f.guardianPhone], ["Transport", f.transport], ["House", f.house || "Auto-assign"], ["Documents", `${Object.values(docs).filter(Boolean).length} of ${DOCS.length} received`]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="truncate text-right font-medium">{v || "—"}</dd></div>
          ))}
        </dl>
        <p className="border-t border-line px-3 py-2 text-[11px] text-muted"><ReferenceText message="On registration an admission number is issued, the guardian receives a parent-portal invite and a Term 2 fee invoice is generated." /></p>
      </Card>
    </CardGrid>
  );
}
