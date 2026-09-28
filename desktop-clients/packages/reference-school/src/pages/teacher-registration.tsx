"use client";

import { ArrowLeft, ArrowRight, Check, FileCheck2, Upload } from "lucide-react";
import { Link } from "../lib/router";
import { useRouter } from "../lib/router";
import { useState } from "react";
import { Avatar, Button, Card, CardGrid, CardHeader, DateInput, Field, Input, Select, Textarea, useToast } from "../ui";
import { Stepper } from "../components/shared/stepper";
import { useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import type { Teacher } from "../lib/types";
import { useFormat } from "../lib/format";
import { cn, isoDay } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STEPS = ["Personal", "Professional", "Employment", "Documents"];
const DOCS = ["Degree certificates", "Teaching licence", "Background check", "ID proof", "Previous employment letter", "Bank details form"];

export function RegisterTeacherPage() {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { currency } = useFormat();
  const router = useRouter();
  const toast = useToast();
  const { subjects, classes, reload } = useLookups();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Record<string, string>>({
    firstName: "", lastName: "", gender: "", dob: "", email: "", phone: "", address: "",
    qualification: "", specialisation: "", experience: "", previousEmployer: "", bio: "",
    department: "", designation: "Teacher", employmentType: "Full-time", joinedOn: isoDay(new Date()), salary: "", homeClass: "",
  });
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [grades, setGrades] = useState<number[]>([]);
  const [docs, setDocs] = useState<Record<string, boolean>>({ "ID proof": true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: "" })); };
  const depts = [...new Set(subjects.filter((s) => s.id !== "sub-lib").map((s) => s.department))];

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    const req = (k: string, l: string) => { if (!f[k]?.trim()) e[k] = `${l} is required`; };
    if (s === 0) {
      req("firstName", "First name"); req("lastName", "Last name"); req("gender", "Gender"); req("email", "Email"); req("phone", "Phone");
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Enter a valid email";
    }
    if (s === 1) {
      req("qualification", "Qualification"); req("experience", "Experience");
      if (f.experience && (Number(f.experience) < 0 || Number(f.experience) > 45)) e.experience = "Enter 0–45 years";
      if (!subjectIds.length) e.subjects = "Pick at least one subject";
    }
    if (s === 2) { req("department", "Department"); req("joinedOn", "Joining date"); }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i++) if (!validate(i)) { setStep(i); return; }
    setSaving(true);
    try {
      const body: Partial<Teacher> = {
        name: `${f.firstName} ${f.lastName}`.trim(), gender: f.gender as Teacher["gender"], email: f.email, phone: f.phone, department: f.department, subjectIds,
        qualification: f.qualification, experience: Number(f.experience), designation: f.designation, employmentType: f.employmentType as Teacher["employmentType"], joinedOn: f.joinedOn,
      };
      const { data } = await api.post<{ data: Teacher }>("/teachers", body);
      // The source collected "Class teacher of" without saving it; assign it once the teacher exists.
      if (f.homeClass) await api.patch(`/classes/${encodeURIComponent(f.homeClass)}`, { classTeacherId: data.id });
      reload();
      toast(referenceT("{value0} registered · {value1}", { value0: data.name, value1: data.empId }));
      router.push("/teachers");
    } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(false); }
  };
  const name = `${f.firstName} ${f.lastName}`.trim();

  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <Card className="lg:col-span-9">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <Link href="/teachers"><Button size="xs" variant="ghost" icon={ArrowLeft} aria-label={referenceT("Back")} /></Link>
          <Stepper steps={STEPS} current={step} onStep={setStep} />
        </div>
        <div className="p-3">
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={referenceT("First name")} required error={errors.firstName}><Input value={f.firstName} onChange={set("firstName")} invalid={!!errors.firstName} autoFocus /></Field>
              <Field label={referenceT("Last name")} required error={errors.lastName}><Input value={f.lastName} onChange={set("lastName")} invalid={!!errors.lastName} /></Field>
              <Field label={referenceT("Gender")} required error={errors.gender}><Select value={f.gender} onChange={set("gender")} invalid={!!errors.gender}><option value=""><ReferenceText message="Select" /></option><option><ReferenceText message="Female" /></option><option><ReferenceText message="Male" /></option></Select></Field>
              <Field label={referenceT("Date of birth")}><DateInput value={f.dob} onChange={set("dob")} /></Field>
              <Field label={referenceT("Work email")} required error={errors.email}><Input type="email" value={f.email} onChange={set("email")} invalid={!!errors.email} placeholder={referenceT("name@school.edu")} /></Field>
              <Field label={referenceT("Phone")} required error={errors.phone}><Input value={f.phone} onChange={set("phone")} invalid={!!errors.phone} /></Field>
              <Field label={referenceT("Address")} className="sm:col-span-2"><Input value={f.address} onChange={set("address")} /></Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={referenceT("Highest qualification")} required error={errors.qualification}>
                <Select value={f.qualification} onChange={set("qualification")} invalid={!!errors.qualification}><option value=""><ReferenceText message="Select" /></option>{["B.Ed", "M.Ed", "M.Sc, B.Ed", "M.A, B.Ed", "PhD", "PGCE"].map((q) => <option key={q}>{q}</option>)}</Select>
              </Field>
              <Field label={referenceT("Specialisation")}><Input value={f.specialisation} onChange={set("specialisation")} placeholder={referenceT("e.g. Applied mathematics")} /></Field>
              <Field label={referenceT("Years of experience")} required error={errors.experience}><Input type="number" min={0} max={45} value={f.experience} onChange={set("experience")} invalid={!!errors.experience} /></Field>
              <Field label={referenceT("Previous employer")}><Input value={f.previousEmployer} onChange={set("previousEmployer")} /></Field>
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="mb-1.5 text-[11px] font-medium text-muted"><ReferenceText message="Subjects qualified to teach" /> <span className="text-bad">*</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.filter((s) => s.id !== "sub-lib").map((s) => {
                    const on = subjectIds.includes(s.id);
                    return (
                      <button type="button" key={s.id} aria-pressed={on} onClick={() => { setSubjectIds((x) => (on ? x.filter((y) => y !== s.id) : [...x, s.id])); setErrors((x) => ({ ...x, subjects: "" })); if (!f.department) setF((x) => ({ ...x, department: s.department })); }}
                        className={cn("flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition", on ? "border-transparent text-white" : "border-line hover:bg-subtle")} style={on ? { background: s.color } : undefined}>
                        {on && <Check className="size-3" />}{s.name}
                      </button>
                    );
                  })}
                </div>
                {errors.subjects && <p className="mt-1 text-[11px] text-bad">{errors.subjects}</p>}
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="mb-1.5 text-[11px] font-medium text-muted"><ReferenceText message="Grades" /></p>
                <div className="flex gap-1.5">
                  {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <button type="button" key={g} aria-pressed={grades.includes(g)} aria-label={referenceT("Grade {value0}", {value0: g})} onClick={() => setGrades((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}
                      className={cn("size-8 rounded-md border text-xs font-medium", grades.includes(g) ? "border-brand bg-brand text-brand-fg" : "border-line hover:bg-subtle")}>{g}</button>
                  ))}
                </div>
              </div>
              <Field label={referenceT("Short bio")} className="sm:col-span-2 lg:col-span-4"><Textarea value={f.bio} onChange={set("bio")} className="min-h-14" placeholder={referenceT("Shown on the teacher profile visible to parents")} /></Field>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={referenceT("Department")} required error={errors.department}><Select value={f.department} onChange={set("department")} invalid={!!errors.department}><option value=""><ReferenceText message="Select" /></option>{depts.map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label={referenceT("Designation")}><Select value={f.designation} onChange={set("designation")}>{["Teacher", "Senior Teacher", "Head of Department", "Lab Instructor", "Coordinator"].map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label={referenceT("Employment type")}><Select value={f.employmentType} onChange={set("employmentType")}>{["Full-time", "Part-time", "Visiting"].map((d) => <option key={d}>{d}</option>)}</Select></Field>
              <Field label={referenceT("Joining date")} required error={errors.joinedOn}><DateInput value={f.joinedOn} onChange={set("joinedOn")} /></Field>
              <Field label={referenceT("Monthly salary ({value0})", {value0: currency})} hint={referenceT("Visible to finance only")}><Input type="number" value={f.salary} onChange={set("salary")} /></Field>
              <Field label={referenceT("Class teacher of")}><Select value={f.homeClass} onChange={set("homeClass")}><option value=""><ReferenceText message="Not a class teacher" /></option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            </div>
          )}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
              {DOCS.map((d) => (
                <button type="button" key={d} aria-pressed={!!docs[d]} onClick={() => setDocs((x) => ({ ...x, [d]: !x[d] }))}
                  className={cn("flex items-center gap-2 rounded-md border px-2.5 py-2.5 text-left text-xs", docs[d] ? "border-ok/40 bg-ok/5" : "border-dashed border-line hover:bg-subtle")}>
                  {docs[d] ? <FileCheck2 className="size-4 text-ok" /> : <Upload className="size-4 text-faint" />}<span className="flex-1">{d}</span><span className="text-[10px] text-muted">{docs[d] ? referenceT("Verified") : referenceT("Upload")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line bg-subtle/50 px-3 py-2">
          <Button icon={ArrowLeft} disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ReferenceText message="Back" /></Button>
          <div className="ml-auto flex gap-2">
            <Link href="/teachers"><Button variant="ghost"><ReferenceText message="Cancel" /></Button></Link>
            {step < STEPS.length - 1 ? <Button variant="primary" onClick={() => validate(step) && setStep((s) => s + 1)}><ReferenceText message="Continue" /> <ArrowRight className="size-3.5" /></Button>
              : <Button variant="primary" icon={Check} loading={saving} onClick={submit}><ReferenceText message="Register teacher" /></Button>}
          </div>
        </div>
      </Card>
      <Card className="h-fit lg:col-span-3">
        <CardHeader title={referenceT("Staff record preview")} />
        <div className="flex items-center gap-2.5 border-b border-line p-3">
          <Avatar name={name || "New Teacher"} size={40} />
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{name || referenceT("New teacher")}</p><p className="text-[11px] text-muted">{f.designation} · {f.department || referenceT("Department")}</p></div>
        </div>
        <dl className="grid gap-1.5 p-3 text-xs">
          {[["Subjects", subjectIds.map((s) => subjects.find((x) => x.id === s)?.code).join(", ")], ["Grades", [...grades].sort((a, b) => a - b).join(", ")], ["Qualification", f.qualification], ["Experience", f.experience && `${f.experience} years`], ["Type", f.employmentType], ["Documents", `${Object.values(docs).filter(Boolean).length}/${DOCS.length}`]].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="truncate text-right font-medium">{v || "—"}</dd></div>
          ))}
        </dl>
      </Card>
    </CardGrid>
  );
}
