"use client";

import { BookOpen, FlaskConical, Layers, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Avatar, Badge, Button, DataTable, Field, Input, Kpi, Modal, Select, useToast, type Column } from "../ui";
import { useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import type { Subject } from "../lib/types";
import { cn } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TYPE_TONE = { Core: "brand", Elective: "info", Lab: "warn", Activity: "ok" } as const;

export function SubjectsPage() {
 const referenceT = useReferenceLocalization().t;

  const { subjects, teachers, ready } = useLookups();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("");
  const list = subjects.filter((s) => s.id !== "sub-lib" && (!type || s.type === type));
  const teachersOf = (id: string) => teachers.filter((t) => t.subjectIds.includes(id));

  const columns: Column<Subject>[] = [
    { key: "code", header: "Code", cell: (s) => <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: `${s.color}1a`, color: s.color }}>{s.code}</span> },
    { key: "name", header: "Subject", cell: (s) => <span className="font-medium">{s.name}</span> },
    { key: "department", header: "Department" },
    { key: "type", header: "Type", cell: (s) => <Badge tone={TYPE_TONE[s.type]}>{s.type}</Badge> },
    { key: "credits", header: "Credits", className: "tabular" },
    { key: "periodsPerWeek", header: "Periods / wk", className: "tabular" },
    { key: "grades", header: "Grades", value: (s) => s.grades.join(","), cell: (s) => (
      <span className="flex gap-0.5">{[6, 7, 8, 9, 10, 11, 12].map((g) => <span key={g} className={cn("grid size-5 place-items-center rounded text-[10px]", s.grades.includes(g) ? "bg-brand/10 font-semibold text-brand" : "text-faint")}>{g}</span>)}</span>
    ) },
    { key: "teachers", header: "Teachers", value: (s) => teachersOf(s.id).length, cell: (s) => (
      <span className="flex items-center -space-x-1.5">{teachersOf(s.id).slice(0, 4).map((t) => <span key={t.id} title={t.name}><Avatar name={t.name} size={22} className="ring-2 ring-surface" /></span>)}<span className="pl-2.5 text-[11px] text-muted">{teachersOf(s.id).length}</span></span>
    ) },
  ];

  return (
    <div className="flex h-full min-h-[520px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={BookOpen} label={referenceT("Subjects offered")} value={list.length || "…"} sub={referenceT("grades 6–12")} />
        <Kpi icon={Layers} label={referenceT("Core subjects")} tone="info" value={subjects.filter((s) => s.type === "Core").length} sub={referenceT("examined every term")} />
        <Kpi icon={FlaskConical} label={referenceT("Lab subjects")} tone="warn" value={subjects.filter((s) => s.type === "Lab").length} sub={referenceT("practical assessment")} />
        <Kpi icon={Sparkles} label={referenceT("Electives & activities")} tone="ok" value={subjects.filter((s) => s.type === "Elective" || s.type === "Activity").length} />
      </div>
      <DataTable className="min-h-0 flex-1" rows={ready ? list : null} loading={!ready} columns={columns} pageSize={20} exportName="subjects" searchPlaceholder="Search subjects"
        toolbar={<>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-32" aria-label={referenceT("Type")}><option value=""><ReferenceText message="All types" /></option>{["Core", "Elective", "Lab", "Activity"].map((t) => <option key={t}>{t}</option>)}</Select>
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}><ReferenceText message="Add subject" /></Button>
        </>} />
      <AddSubject open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddSubject({ open, onClose }: { open: boolean; onClose: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { subjects, reload } = useLookups();
  const toast = useToast();
  const [f, setF] = useState({ name: "", code: "", department: "", type: "Core", credits: "3", periodsPerWeek: "3", color: "#2b59c3" });
  const [grades, setGrades] = useState<number[]>([9, 10]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr(""); };
  const save = async () => {
    const code = f.code.trim().toUpperCase();
    if (!f.name.trim() || code.length < 2 || !f.department.trim()) return setErr("Name, a 2–4 letter code and department are required.");
    if (subjects.some((s) => s.code === code)) return setErr(`Code ${code} is already used.`);
    if (!grades.length) return setErr("Select at least one grade.");
    setBusy(true);
    try {
      await api.post("/subjects", { ...f, code, credits: Number(f.credits), periodsPerWeek: Number(f.periodsPerWeek), grades: [...grades].sort((a, b) => a - b) });
      reload(); toast(referenceT("{value0} added to the curriculum", { value0: f.name })); onClose();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Add subject")} footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Add subject" /></Button></>}>
      <div className="grid grid-cols-4 gap-3">
        <Field label={referenceT("Subject name")} required className="col-span-3"><Input value={f.name} onChange={set("name")} autoFocus /></Field>
        <Field label={referenceT("Code")} required><Input value={f.code} onChange={set("code")} maxLength={4} placeholder={referenceT("PSY")} /></Field>
        <Field label={referenceT("Department")} required className="col-span-2"><Input value={f.department} onChange={set("department")} list="depts" /><datalist id="depts">{[...new Set(subjects.map((s) => s.department))].map((d) => <option key={d} value={d} />)}</datalist></Field>
        <Field label={referenceT("Type")}><Select value={f.type} onChange={set("type")}>{["Core", "Elective", "Lab", "Activity"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label={referenceT("Colour")}><Input type="color" value={f.color} onChange={set("color")} className="p-1" /></Field>
        <Field label={referenceT("Credits")}><Input type="number" min={0} value={f.credits} onChange={set("credits")} /></Field>
        <Field label={referenceT("Periods / week")}><Input type="number" min={1} max={10} value={f.periodsPerWeek} onChange={set("periodsPerWeek")} /></Field>
        <div className="col-span-2">
          <p className="mb-1 text-[11px] font-medium text-muted"><ReferenceText message="Grades" /></p>
          <div className="flex gap-1">{[6, 7, 8, 9, 10, 11, 12].map((g) => (
            <button type="button" key={g} aria-pressed={grades.includes(g)} aria-label={referenceT("Grade {value0}", {value0: g})} onClick={() => setGrades((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))} className={cn("size-8 rounded-md border text-xs", grades.includes(g) ? "border-brand bg-brand text-brand-fg" : "border-line")}>{g}</button>
          ))}</div>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
    </Modal>
  );
}
