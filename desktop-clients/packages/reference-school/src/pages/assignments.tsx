"use client";

import { CheckCircle2, Clock, FilePlus2, FileText, Paperclip, Send, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Badge, Button, Card, CardGrid, DataTable, DateInput, Drawer, Empty, ErrorNote, Field, Input, Kpi, Modal, Progress, Select, Skeleton, statusTone, Tabs, Textarea, type Column, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { qs, useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { Assignment, Student, Submission } from "../lib/types";
import { cn, isoDay, relativeFromNow } from "../lib/utils";
import { useFormat } from "../lib/format";
import { AttachmentList, AttachmentPicker, useAttachmentDraft } from "../lib/attachments";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function AssignmentsPage() {
  const { role } = useSession();
  return role === "student" || role === "parent" ? <LearnerAssignments /> : <StaffAssignments />;
}

/* ------------------------------ Staff ------------------------------ */
function StaffAssignments() {
 const referenceT = useReferenceLocalization().t;

  const { fmtShort, fmtPct } = useFormat();
  const { role, user } = useSession();
  const { cls, sub } = useLookups();
  const { classes } = useMyClasses();
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const { data, error, loading, reload, setData } = useApi<Assignment[]>(`/assignments${qs({ teacherId: role === "teacher" ? user.id : undefined, classId, status, sort: "dueDate", order: "desc" })}`);
  const [open, setOpen] = useState<Assignment | null>(null);
  const [creating, setCreating] = useState(false);
  const all = data ?? [];
  const toGrade = all.reduce((a, x) => a + Math.max(0, x.submitted - x.graded), 0);

  const columns: Column<Assignment>[] = [
    { key: "title", header: "Assignment", cell: (a) => <span className="block max-w-[320px]"><span className="block truncate font-medium">{a.title}</span><span className="block truncate text-[10.5px] text-muted">{a.type} · {a.maxMarks} <ReferenceText message="marks" /></span></span> },
    { key: "subjectId", header: "Subject", value: (a) => sub(a.subjectId)?.name, cell: (a) => <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: sub(a.subjectId)?.color }} />{sub(a.subjectId)?.name}</span> },
    { key: "classId", header: "Class", value: (a) => cls(a.classId)?.name, cell: (a) => cls(a.classId)?.name.replace("Grade ", "") },
    { key: "assignedOn", header: "Set", cell: (a) => fmtShort(a.assignedOn) },
    { key: "dueDate", header: "Due", cell: (a) => <span className={cn(a.status === "Open" && a.dueDate < isoDay(new Date()) && "text-bad")}>{fmtShort(a.dueDate)}</span> },
    { key: "submitted", header: "Submitted", cell: (a) => <span className="flex w-28 items-center gap-1.5"><Progress value={a.submitted} max={a.total || 1} /><span className="text-[11px] tabular">{a.submitted}/{a.total}</span></span> },
    { key: "graded", header: "Graded", cell: (a) => <span className={cn("tabular", a.submitted > a.graded && "font-semibold text-warn")}>{a.graded}/{a.submitted}</span> },
    { key: "status", header: "Status", cell: (a) => <Badge tone={statusTone(a.status)}>{a.status}</Badge> },
  ];

  return (
    <div className="flex h-full min-h-[560px] flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Kpi icon={FileText} label={referenceT("Assignments")} value={loading && !data ? "…" : all.length} sub={referenceT("{value0} open", {value0: all.filter((a) => a.status === "Open").length})} />
        <Kpi icon={Clock} label={referenceT("Waiting to be graded")} tone="warn" value={toGrade} sub={referenceT("submissions")} />
        <Kpi icon={CheckCircle2} label={referenceT("Submission rate")} tone="ok" value={fmtPct(all.length ? Math.round((all.reduce((a, x) => a + x.submitted, 0) / Math.max(1, all.reduce((a, x) => a + x.total, 0))) * 100) : 0)} sub={referenceT("across all work")} />
        <Kpi icon={TriangleAlert} label={referenceT("Past due, still open")} tone="bad" value={all.filter((a) => a.status === "Open" && a.dueDate < isoDay(new Date())).length} sub={referenceT("close or extend")} />
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      <DataTable className="min-h-0 flex-1" rows={loading && !data ? null : all} loading={loading} columns={columns} onRowClick={setOpen} selectedId={open?.id} exportName="assignments" searchPlaceholder="Search assignments"
        toolbar={<>
          <ClassSelect value={classId} onChange={setClassId} classes={classes} allLabel="All classes" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-28" aria-label={referenceT("Status")}><option value=""><ReferenceText message="Any status" /></option>{["Open", "Closed", "Draft"].map((s) => <option key={s}>{s}</option>)}</Select>
          <Button variant="primary" icon={FilePlus2} onClick={() => setCreating(true)}><ReferenceText message="New assignment" /></Button>
        </>} />
      {open && <GradeDrawer a={open} onClose={() => setOpen(null)} onChange={(a) => { setOpen(a); setData((d) => d?.map((x) => (x.id === a.id ? a : x)) ?? d); }} />}
      <CreateAssignment open={creating} onClose={() => setCreating(false)} onCreated={(a) => setData((d) => [a, ...(d ?? [])])} />
    </div>
  );
}

function GradeDrawer({ a, onClose, onChange }: { a: Assignment; onClose: () => void; onChange: (a: Assignment) => void }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtShort, fmtNum, fmtPct } = useFormat();
  const api = useSchoolApi();
  const { cls, sub } = useLookups();
  const toast = useToast();
  const { data: subs, setData } = useApi<Submission[]>(`/submissions?assignmentId=${encodeURIComponent(a.id)}`);
  const [filter, setFilter] = useState<"all" | "todo" | "Graded" | "Missing">("todo");
  const [draft, setDraft] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const list = (subs ?? []).filter((s) => filter === "all" || (filter === "todo" ? s.status === "Submitted" || s.status === "Late" : s.status === filter));

  const grade = async (s: Submission) => {
    const d = draft[s.studentId];
    const marks = Number(d?.marks);
    if (d?.marks === undefined || d.marks === "" || Number.isNaN(marks) || marks < 0 || marks > a.maxMarks) return toast(referenceT("Enter marks between 0 and {value0}", { value0: a.maxMarks }), "error");
    setSaving(s.studentId);
    try {
      const { data } = await api.patch<{ data: Submission }>("/submissions", { assignmentId: a.id, studentId: s.studentId, marks, feedback: d.feedback ?? "" });
      setData((x) => x?.map((y) => (y.studentId === s.studentId ? data : y)) ?? x);
      if (s.status !== "Graded") onChange({ ...a, graded: a.graded + 1 });
      toast(referenceT("Graded {value0}: {value1}/{value2}", { value0: s.studentName, value1: marks, value2: a.maxMarks }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(null); }
  };
  const setStatus = async (status: Assignment["status"]) => {
    try {
      const { data } = await api.patch<{ data: Assignment }>(`/assignments/${a.id}`, { status });
      onChange(data); toast(status === "Closed" ? "Assignment closed" : status === "Open" ? "Assignment open" : "Assignment draft");
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const graded = (subs ?? []).filter((s) => s.marks !== null);
  const avg = graded.length ? Math.round((graded.reduce((x, s) => x + (s.marks ?? 0), 0) / graded.length / a.maxMarks) * 100) : null;

  return (
    <Drawer open onClose={onClose} width="max-w-3xl" title={a.title} sub={referenceT("{value0} · {value1} · due {value2} · {value3} marks", {value0: sub(a.subjectId)?.name ?? "", value1: cls(a.classId)?.name ?? "", value2: fmtDate(a.dueDate), value3: fmtNum(a.maxMarks)})}
      footer={<>
        {a.status !== "Closed" ? <Button onClick={() => setStatus("Closed")}><ReferenceText message="Close submissions" /></Button> : <Button onClick={() => setStatus("Open")}><ReferenceText message="Reopen" /></Button>}
        {a.status === "Draft" && <Button variant="primary" onClick={() => setStatus("Open")}><ReferenceText message="Publish" /></Button>}
      </>}>
      <div className="border-b border-line px-4 py-2.5 text-xs text-muted">{a.description}<AttachmentList attachments={a.attachments} className="mt-1.5" /></div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <Tabs size="xs" value={filter} onChange={setFilter} items={[
          { value: "todo", label: "To grade", count: subs?.filter((s) => s.status === "Submitted" || s.status === "Late").length },
          { value: "Graded", label: "Graded", count: subs?.filter((s) => s.status === "Graded").length },
          { value: "Missing", label: "Missing", count: subs?.filter((s) => s.status === "Missing").length },
          { value: "all", label: "All", count: subs?.length },
        ]} />
        {avg !== null && <span className="ml-auto text-[11px] text-muted"><ReferenceText message="Class average" /> <b className="text-fg tabular">{fmtPct(avg)}</b></span>}
      </div>
      {!subs ? <div className="p-4"><Skeleton className="h-60" /></div> : list.length === 0 ? <Empty icon={CheckCircle2} title={referenceT("Nothing here")} text={filter === "todo" ? "Every submission has been graded." : undefined} /> : (
        <ul className="divide-y divide-line/70">
          {list.map((s) => {
            const d = draft[s.studentId] ?? { marks: s.marks?.toString() ?? "", feedback: s.feedback };
            return (
              <li key={s.id} className="grid gap-2 px-4 py-2 sm:grid-cols-[180px_1fr_auto]">
                <div className="flex items-center gap-2">
                  <Avatar name={s.studentName} size={26} />
                  <div className="min-w-0"><p className="truncate text-xs font-medium">{s.studentName}</p><p className="text-[10.5px] text-muted">{s.submittedOn ? referenceT("Submitted {value0}", { value0: fmtShort(s.submittedOn) }) : referenceT("Not submitted")}</p></div>
                </div>
                <div className="min-w-0 text-[11px]">
                  {s.text ? <p className="line-clamp-2 text-muted"><Paperclip className="mr-1 inline size-3" />{s.text}</p> : <p className="text-faint"><ReferenceText message="No work received" /></p>}
                  <AttachmentList attachments={s.attachments} className="mt-1" />
                  {s.status !== "Missing" && (
                    <Input value={d.feedback} placeholder={referenceT("Feedback for the student")} className="mt-1 h-7 text-xs" onChange={(e) => setDraft((x) => ({ ...x, [s.studentId]: { ...d, feedback: e.target.value } }))} />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  {s.status !== "Missing" && <>
                    <Input type="number" min={0} max={a.maxMarks} value={d.marks} aria-label={referenceT("Marks")} className="h-7 w-16 text-center tabular" onChange={(e) => setDraft((x) => ({ ...x, [s.studentId]: { ...d, marks: e.target.value } }))} onKeyDown={(e) => e.key === "Enter" && grade(s)} />
                    <span className="text-[11px] text-muted">/{a.maxMarks}</span>
                    <Button size="xs" variant="primary" loading={saving === s.studentId} onClick={() => grade(s)}><ReferenceText message="Save" /></Button>
                  </>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}

function CreateAssignment({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (a: Assignment) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { role, user } = useSession();
  const { subjects, cls, tch } = useLookups();
  const { classes } = useMyClasses();
  const toast = useToast();
  const me = tch(user.id);
  const [f, setF] = useState({ title: "", description: "", classId: "", subjectId: "", type: "Homework", dueDate: isoDay(new Date(Date.now() + 7 * 864e5)), maxMarks: "20" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const files = useAttachmentDraft("assignment");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: "" })); };
  const subjectOpts = role === "teacher" && me ? subjects.filter((s) => me.subjectIds.includes(s.id)) : subjects.filter((s) => s.id !== "sub-lib");
  useEffect(() => { if (open && !f.subjectId && subjectOpts[0]) setF((x) => ({ ...x, subjectId: subjectOpts[0]!.id })); }, [open, subjectOpts, f.subjectId]);

  const save = async (status: "Open" | "Draft") => {
    const e: Record<string, string> = {};
    if (f.title.trim().length < 4) e.title = "Give the assignment a descriptive title";
    if (!f.classId) e.classId = "Choose a class";
    if (!f.dueDate || f.dueDate < isoDay(new Date())) e.dueDate = "Due date must be today or later";
    if (!(Number(f.maxMarks) > 0)) e.maxMarks = "Must be more than 0";
    setErr(e);
    if (Object.keys(e).length || !files.ready) return;
    setBusy(true);
    try {
      const { data } = await api.post<{ data: Assignment }>("/assignments", {
        ...f, attachments: files.attachments, status, maxMarks: Number(f.maxMarks), teacherId: role === "teacher" ? user.id : cls(f.classId)?.classTeacherId, assignedOn: isoDay(new Date()), // submitted/graded/total are server-initialized from the class roster
      });
      onCreated(data); toast(status === "Draft" ? "Saved as draft" : referenceT("Assignment published to {value0}", { value0: cls(f.classId)?.name ?? "" })); onClose();
      setF((x) => ({ ...x, title: "", description: "" })); files.clear();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title={referenceT("New assignment")} sub={referenceT("Students are notified when it is published")}
      footer={<>
        <Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button>
        <Button disabled={busy || !files.ready} onClick={() => save("Draft")}><ReferenceText message="Save draft" /></Button>
        <Button variant="primary" icon={Send} loading={busy} disabled={!files.ready} onClick={() => save("Open")}><ReferenceText message="Publish" /></Button>
      </>}>
      <div className="grid grid-cols-4 gap-3">
        <Field label={referenceT("Title")} required error={err.title} className="col-span-4"><Input value={f.title} onChange={set("title")} invalid={!!err.title} autoFocus placeholder={referenceT("e.g. Quadratic equations – practice set 3")} /></Field>
        <Field label={referenceT("Class")} required error={err.classId}><ClassSelect value={f.classId} onChange={(v) => { setF((x) => ({ ...x, classId: v })); setErr((x) => ({ ...x, classId: "" })); }} classes={classes} allLabel="Select class" className="w-full" /></Field>
        <Field label={referenceT("Subject")}><Select value={f.subjectId} onChange={set("subjectId")}>{subjectOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={referenceT("Type")}><Select value={f.type} onChange={set("type")}>{["Homework", "Project", "Lab report", "Essay", "Worksheet"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label={referenceT("Max marks")} error={err.maxMarks}><Input type="number" min={1} value={f.maxMarks} onChange={set("maxMarks")} invalid={!!err.maxMarks} /></Field>
        <Field label={referenceT("Due date")} required error={err.dueDate}><DateInput value={f.dueDate} min={isoDay(new Date())} onChange={set("dueDate")} invalid={!!err.dueDate} /></Field>
        <Field label={referenceT("Instructions")} className="col-span-3"><Textarea value={f.description} onChange={set("description")} className="min-h-16" placeholder={referenceT("What should students do? Mention the textbook pages, format and how it will be marked.")} /></Field>
        <div className="col-span-4 rounded-md border border-dashed border-line p-3"><AttachmentPicker draft={files} label={referenceT("Attach worksheet, rubric or reference files")} /></div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Student / parent ------------------------------ */
function LearnerAssignments() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtShort } = useFormat();
  const api = useSchoolApi();
  const { role } = useSession();
  const { sub, tch } = useLookups();
  const toast = useToast();
  const { studentId } = useActiveStudent();
  const { data: me } = useApi<Student>(studentId ? `/students/${encodeURIComponent(studentId)}` : null);
  const { data: work } = useApi<Assignment[]>(me && me.id === studentId ? `/assignments?classId=${me.classId}&status=Open,Closed&sort=dueDate&order=desc` : null);
  const { data: subs, setData: setSubs } = useApi<Submission[]>(studentId ? `/submissions?studentId=${encodeURIComponent(studentId)}` : null);
  const [tab, setTab] = useState<"pending" | "submitted" | "graded">("pending");
  const [submitting, setSubmitting] = useState<Assignment | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  /* Files for the submission being written; they belong to one assignment, so opening another starts a fresh set. */
  const files = useAttachmentDraft("submission");
  const lastOpened = useRef<string | null>(null);
  const openSubmit = (a: Assignment) => { if (lastOpened.current !== a.id) files.clear(); lastOpened.current = a.id; setSubmitting(a); };

  const rows = useMemo(() => (work ?? []).map((a) => ({ a, s: subs?.find((x) => x.assignmentId === a.id) })), [work, subs]);
  const groups = {
    pending: rows.filter((r) => !r.s || r.s.status === "Missing"),
    submitted: rows.filter((r) => r.s && (r.s.status === "Submitted" || r.s.status === "Late")),
    graded: rows.filter((r) => r.s?.status === "Graded"),
  };
  const list = groups[tab];

  const submit = async () => {
    if (!submitting || text.trim().length < 5 || !files.ready) return;
    setBusy(true);
    try {
      const { data } = await api.patch<{ data: Submission }>("/submissions", { assignmentId: submitting.id, studentId, text, attachments: files.attachments });
      setSubs((x) => { const rest = (x ?? []).filter((y) => y.assignmentId !== submitting.id); return [...rest, data]; });
      toast(data.status === "Late" ? "Submitted late — your teacher has been notified" : "Submitted on time. Well done!");
      setSubmitting(null); setText(""); files.clear();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };

  return (
    <CardGrid className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <ChildSwitcher />
        <Tabs value={tab} onChange={setTab} items={[{ value: "pending", label: "To do", count: groups.pending.length }, { value: "submitted", label: "Submitted", count: groups.submitted.length }, { value: "graded", label: "Graded", count: groups.graded.length }]} />
        {groups.graded.length > 0 && (
          <span className="ml-auto text-[11px] text-muted"><ReferenceText message="Average on graded work" /> <b className="text-fg tabular">{Math.round(groups.graded.reduce((x, r) => x + (r.s!.marks ?? 0) / r.a.maxMarks, 0) / groups.graded.length * 100)}%</b></span>
        )}
      </div>
      {!work || !subs ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        : list.length === 0 ? <Card><Empty icon={CheckCircle2} title={tab === "pending" ? "You're all caught up" : "Nothing here yet"} /></Card> : (
          <CardGrid className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {list.map(({ a, s }) => {
              const overdue = a.dueDate < isoDay(new Date());
              const sb = sub(a.subjectId);
              return (
                <Card key={a.id} className="flex flex-col p-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: sb?.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{a.title}</p>
                      <p className="text-[10.5px] text-muted">{sb?.name} · {a.type} · {tch(a.teacherId)?.name}</p>
                    </div>
                    {s && s.status !== "Missing" ? <Badge tone={statusTone(s.status)}>{s.status}</Badge> : overdue ? <Badge tone="bad"><ReferenceText message="Overdue" /></Badge> : <Badge tone="brand"><ReferenceText message="Due" /> {relativeFromNow(a.dueDate + "T23:59:00")}</Badge>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[11px] text-muted">{a.description}</p>
                  <AttachmentList attachments={a.attachments} className="mt-1" />
                  <div className="mt-auto flex items-center gap-2 pt-2 text-[11px]">
                    <span className="text-muted"><ReferenceText message="Due" /> {fmtDate(a.dueDate)}</span>
                    {s?.status === "Graded" ? (
                      <span className="ml-auto flex items-center gap-2"><span className="text-muted italic">“{s.feedback}”</span><b className="text-sm tabular">{s.marks}/{a.maxMarks}</b></span>
                    ) : s && s.status !== "Missing" ? <span className="ml-auto text-muted"><ReferenceText message="Sent" /> {fmtShort(s.submittedOn!)}</span>
                      : role === "student" && a.status === "Open" ? <Button size="xs" variant="primary" icon={Upload} className="ml-auto" onClick={() => openSubmit(a)}><ReferenceText message="Submit" /></Button>
                      : <span className={cn("ml-auto", a.status === "Closed" && "text-bad")}>{a.status === "Closed" ? referenceT("Closed – not submitted") : referenceT("Not submitted yet")}</span>}
                  </div>
                </Card>
              );
            })}
          </CardGrid>
        )}
      <Modal open={!!submitting} onClose={() => setSubmitting(null)} size="lg" title={referenceT("Submit: {value0}", {value0: submitting?.title ?? ""})} sub={submitting ? referenceT("{value0} · due {value1} · {value2} marks", { value0: sub(submitting.subjectId)?.name ?? "", value1: fmtDate(submitting.dueDate), value2: submitting.maxMarks }) : ""}
        footer={<><Button variant="ghost" onClick={() => setSubmitting(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" icon={Send} loading={busy} disabled={text.trim().length < 5 || !files.ready} onClick={submit}><ReferenceText message="Turn in" /></Button></>}>
        <p className="mb-2 rounded-md bg-subtle p-2 text-xs text-muted">{submitting?.description}</p>
        <Field label={referenceT("Your answer or notes for the teacher")} hint={referenceT("At least 5 characters")}><Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-32" autoFocus /></Field>
        <div className="mt-2 rounded-md border border-dashed border-line p-3"><AttachmentPicker draft={files} label={referenceT("Attach files (PDF, images, docs)")} /></div>
      </Modal>
    </CardGrid>
  );
}
