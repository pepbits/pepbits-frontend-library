"use client";

import { ChevronLeft, ChevronRight, GripVertical, Mail, Phone, Plus, UserPlus } from "lucide-react";
import { Link } from "../lib/router";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, ErrorNote, Field, Input, Modal, SearchInput, Select, Skeleton, statusTone, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import type { Admission } from "../lib/types";
import { cn } from "../lib/utils";
import { useFormat } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STAGES: Admission["stage"][] = ["Applied", "Screening", "Interview", "Offered", "Enrolled", "Declined"];
const STAGE_HINT: Record<string, string> = {
  Applied: "New forms awaiting review", Screening: "Documents & entrance test", Interview: "Family interview booked",
  Offered: "Offer letter sent", Enrolled: "Fee paid, seat confirmed", Declined: "Withdrawn or not offered",
};

export function AdmissionsPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtShort } = useFormat();
  const api = useSchoolApi();
  const { data, error, loading, reload, setData } = useApi<Admission[]>("/admissions");
  const toast = useToast();
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Admission | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => (data ?? []).filter((a) => (!grade || String(a.grade) === grade) && (!q || `${a.name} ${a.applicationNo} ${a.parentName}`.toLowerCase().includes(q.toLowerCase()))), [data, q, grade]);

  const patch = async (a: Admission, body: Partial<Admission>, msg?: string) => {
    const prev = data;
    setData((d) => d?.map((x) => (x.id === a.id ? { ...x, ...body } : x)) ?? d);
    try {
      const { data: saved } = await api.patch<{ data: Admission }>(`/admissions/${a.id}`, body);
      if (open?.id === a.id) setOpen(saved);
      if (msg) toast(msg);
    } catch (e) { setData(prev); toast((e as Error).message, "error"); }
  };
  const move = (a: Admission, stage: Admission["stage"]) => { if (a.stage !== stage) patch(a, { stage }, referenceT("{value0} moved to {value1}", { value0: a.name, value1: referenceT(stage) })); };
  const step = (a: Admission, dir: 1 | -1) => { const i = STAGES.indexOf(a.stage) + dir; if (i >= 0 && i < STAGES.length) move(a, STAGES[i]!); };

  const total = data?.length ?? 0;
  const enrolled = data?.filter((a) => a.stage === "Enrolled").length ?? 0;

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <SearchInput value={q} onChange={setQ} placeholder={referenceT("Search applicant, parent, app no.")} aria-label={referenceT("Search applicant, parent, app no.")} className="w-60" />
        <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-32" aria-label={referenceT("Grade")}><option value=""><ReferenceText message="All grades" /></option>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}><ReferenceText message="Grade" /> {g}</option>)}</Select>
        <div className="hidden items-center gap-3 text-[11px] text-muted md:flex">
          <span><b className="text-fg tabular">{total}</b> <ReferenceText message="applications" /></span>
          <span><b className="text-fg tabular">{total ? Math.round((enrolled / total) * 100) : 0}%</b> <ReferenceText message="conversion" /></span>
          <span><ReferenceText message="Drag cards between stages, or use the arrows" /></span>
        </div>
        <Button variant="primary" icon={Plus} className="ml-auto" onClick={() => setCreating(true)}><ReferenceText message="New application" /></Button>
      </Card>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <div className="grid min-h-0 flex-1 auto-cols-[minmax(210px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1">
        {STAGES.map((stage) => {
          const items = rows.filter((a) => a.stage === stage);
          return (
            <section key={stage}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }} onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={() => { const a = data?.find((x) => x.id === drag); if (a) move(a, stage); setDrag(null); setOver(null); }}
              className={cn("flex min-h-0 flex-col rounded-lg border bg-subtle/60 transition", over === stage ? "border-brand bg-brand/5" : "border-line")}>
              <header className="flex items-center gap-2 border-b border-line px-2.5 py-2">
                <Badge tone={statusTone(stage)} dot>{stage}</Badge>
                <span className="text-[11px] font-semibold text-muted tabular">{items.length}</span>
                <span className="ml-auto truncate text-[10px] text-faint">{STAGE_HINT[stage]}</span>
              </header>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5">
                {loading && !data && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                {items.map((a) => (
                  <article key={a.id} draggable onDragStart={() => setDrag(a.id)} onDragEnd={() => setDrag(null)} onClick={() => setOpen(a)}
                    className={cn("group cursor-pointer rounded-md border border-line bg-surface p-2 shadow-xs transition hover:border-brand/40", drag === a.id && "opacity-40")}>
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-0.5 size-3.5 shrink-0 cursor-grab text-faint" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{a.name}</p>
                        <p className="truncate text-[10.5px] text-muted"><ReferenceText message="Grade" /> {a.grade} · {a.previousSchool}</p>
                      </div>
                      {a.score !== null && <span className={cn("rounded px-1 text-[10px] font-semibold tabular", a.score >= 70 ? "bg-ok/10 text-ok" : a.score >= 50 ? "bg-warn/10 text-warn" : "bg-bad/10 text-bad")}>{a.score}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-faint">
                      <span className="tabular">{a.applicationNo}</span><span>· {fmtShort(a.appliedOn)}</span>
                      <span className="ml-auto flex opacity-0 transition group-hover:opacity-100">
                        <button aria-label={referenceT("Move back")} disabled={stage === "Applied"} onClick={(e) => { e.stopPropagation(); step(a, -1); }} className="rounded p-0.5 hover:bg-subtle disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
                        <button aria-label={referenceT("Move forward")} disabled={stage === "Declined"} onClick={(e) => { e.stopPropagation(); step(a, 1); }} className="rounded p-0.5 hover:bg-subtle disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
                      </span>
                    </div>
                  </article>
                ))}
                {!loading && items.length === 0 && <p className="py-6 text-center text-[11px] text-faint"><ReferenceText message="Drop an application here" /></p>}
              </div>
            </section>
          );
        })}
      </div>

      {open && (
        <Modal open onClose={() => setOpen(null)} size="md" title={open.name} sub={referenceT("{value0} · applying for Grade {value1}", {value0: open.applicationNo, value1: open.grade})}
          footer={<>
            <Button variant="danger" onClick={() => move(open, "Declined")} disabled={open.stage === "Declined"}><ReferenceText message="Decline" /></Button>
            {open.stage === "Offered" || open.stage === "Enrolled"
              ? <Link href="/students/new"><Button variant="primary" icon={UserPlus} onClick={() => open.stage !== "Enrolled" && move(open, "Enrolled")}><ReferenceText message="Enrol & register" /></Button></Link>
              : <Button variant="primary" onClick={() => step(open, 1)}><ReferenceText message="Advance to" /> {STAGES[STAGES.indexOf(open.stage) + 1]}</Button>}
          </>}>
          <div className="flex items-center gap-3">
            <Avatar name={open.name} size={40} />
            <div className="flex-1 text-xs"><p className="font-medium"><ReferenceText message="Parent:" /> {open.parentName}</p><p className="text-muted"><ReferenceText message="Applied" /> {fmtDate(open.appliedOn)} <ReferenceText message="· from" /> {open.previousSchool}</p></div>
            <Badge tone={statusTone(open.stage)} dot>{open.stage}</Badge>
          </div>
          <div className="mt-3 flex gap-1">
            {STAGES.slice(0, 5).map((s, i) => <div key={s} title={s} className={cn("h-1.5 flex-1 rounded-full", STAGES.indexOf(open.stage) >= i && open.stage !== "Declined" ? "bg-brand" : "bg-line")} />)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label={referenceT("Entrance test score")} hint={referenceT("Out of 100")}>
              <Input type="number" min={0} max={100} defaultValue={open.score ?? ""} onBlur={(e) => { const v = e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))); if (v !== open.score) patch(open, { score: v }, "Score saved"); }} />
            </Field>
            <Field label={referenceT("Stage")}><Select value={open.stage} onChange={(e) => move(open, e.target.value as Admission["stage"])}>{STAGES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <a href={`mailto:${open.email}`}><Button size="xs" icon={Mail}>{open.email}</Button></a>
            <a href={`tel:${open.phone}`}><Button size="xs" icon={Phone}>{open.phone}</Button></a>
          </div>
        </Modal>
      )}
      <NewApplication open={creating} onClose={() => setCreating(false)} onCreated={(a) => { setData((d) => [a, ...(d ?? [])]); toast(referenceT("Application {value0} created", { value0: a.applicationNo })); }} />
    </div>
  );
}

function NewApplication({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (a: Admission) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const [f, setF] = useState({ name: "", grade: "", parentName: "", phone: "", email: "", previousSchool: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Required";
    if (!f.grade) e.grade = "Required";
    if (!f.parentName.trim()) e.parentName = "Required";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "Valid email required";
    if (f.phone.replace(/\D/g, "").length < 8) e.phone = "Valid phone required";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ data: Admission }>("/admissions", { ...f, grade: Number(f.grade), previousSchool: f.previousSchool || "—" });
      onCreated(data); onClose(); setF({ name: "", grade: "", parentName: "", phone: "", email: "", previousSchool: "" });
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("New admission application")} sub={referenceT("Creates an application in the Applied stage")}
      footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Create application" /></Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("Applicant name")} required error={err.name}><Input value={f.name} onChange={set("name")} invalid={!!err.name} autoFocus /></Field>
        <Field label={referenceT("Applying for")} required error={err.grade}><Select value={f.grade} onChange={set("grade")} invalid={!!err.grade}><option value=""><ReferenceText message="Grade" /></option>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}><ReferenceText message="Grade" /> {g}</option>)}</Select></Field>
        <Field label={referenceT("Parent / guardian")} required error={err.parentName}><Input value={f.parentName} onChange={set("parentName")} invalid={!!err.parentName} /></Field>
        <Field label={referenceT("Previous school")}><Input value={f.previousSchool} onChange={set("previousSchool")} /></Field>
        <Field label={referenceT("Email")} required error={err.email}><Input type="email" value={f.email} onChange={set("email")} invalid={!!err.email} /></Field>
        <Field label={referenceT("Phone")} required error={err.phone}><Input value={f.phone} onChange={set("phone")} invalid={!!err.phone} /></Field>
      </div>
    </Modal>
  );
}
