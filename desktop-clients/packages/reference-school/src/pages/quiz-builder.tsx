"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Library, Plus, Send, Trash2 } from "lucide-react";
import { Link } from "../lib/router";
import { useRouter } from "../lib/router";
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardGrid, CardHeader, DateInput, ErrorNote, Field, Input, Modal, Select, Skeleton, Textarea, Toggle, useToast } from "../ui";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { useApi, useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { Quiz, QuizQuestion } from "../lib/types";
import { cn, isoDay } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* An empty question the author fills in; the id only keys the draft list. */
const blank = (): QuizQuestion => ({ id: `q-${crypto.randomUUID()}`, text: "", options: ["", "", "", ""], answer: -1, points: 1, explanation: "" });
const LETTERS = "ABCDEF";

export function QuizBuilderPage() {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const router = useRouter();
  const toast = useToast();
  const { role, user } = useSession();
  const { subjects, tch, cls } = useLookups();
  const { classes } = useMyClasses();
  const me = tch(user.id);
  const subjectOpts = role === "teacher" && me ? subjects.filter((s) => me.subjectIds.includes(s.id)) : subjects.filter((s) => s.periodsPerWeek > 0);
  const [meta, setMeta] = useState({ title: "", classId: "", subjectId: "", durationMin: "15", dueDate: isoDay(new Date(Date.now() + 3 * 864e5)) });
  const [shuffle, setShuffle] = useState(true);
  const [reveal, setReveal] = useState(true);
  const [qs, setQs] = useState<QuizQuestion[]>([blank()]);
  const [active, setActive] = useState(0);
  const [bank, setBank] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const subjectId = meta.subjectId || subjectOpts[0]?.id || "";

  const problems = useMemo(() => qs.map((q) => {
    const p: string[] = [];
    if (!q.text.trim()) p.push("question text");
    if (q.options.filter((o) => o.trim()).length < 2) p.push("at least 2 options");
    if (q.answer === undefined || q.answer < 0 || !q.options[q.answer]?.trim()) p.push("a correct answer");
    return p;
  }), [qs]);
  const metaErrors = { title: !meta.title.trim(), classId: !meta.classId };
  const valid = problems.every((p) => !p.length) && !metaErrors.title && !metaErrors.classId;
  const points = qs.reduce((a, q) => a + q.points, 0);

  const upd = (i: number, patch: Partial<QuizQuestion>) => setQs((x) => x.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) => setQs((x) => { const y = [...x]; const [q] = y.splice(i, 1); y.splice(i + d, 0, q!); setActive(i + d); return y; });

  const save = async (status: Quiz["status"]) => {
    setShowErrors(true);
    if (!valid) return toast("Fix the highlighted questions before saving", "error");
    setBusy(true);
    try {
      const questions = qs.map((q) => { const keep = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o); return { ...q, options: keep.map((x) => x.o), answer: keep.findIndex((x) => x.i === q.answer) }; });
      await api.post<{ data: Quiz }>("/quizzes", { ...meta, subjectId, durationMin: Number(meta.durationMin), teacherId: role === "teacher" ? user.id : cls(meta.classId)?.classTeacherId, status, questions, shuffle, revealAnswers: reveal }); // attempts/average are server-initialized
      toast(status === "Published" ? referenceT("Quiz published to {value0}", { value0: cls(meta.classId)?.name ?? "" }) : "Quiz saved as draft");
      router.push("/quizzes");
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };

  /* The reviewed question bank belongs to the school (GET /question-bank); authors receive keys and explanations. */
  const bankApi = useApi<QuizQuestion[]>(bank && subjectId ? `/question-bank?subjectId=${encodeURIComponent(subjectId)}` : null);
  const bankQs = bankApi.data ?? [];
  const importBank = () => {
    const add = picked.map((i) => ({ ...bankQs[i]!, id: blank().id, points: 1, options: [...bankQs[i]!.options] }));
    setQs((x) => [...x.filter((q) => q.text.trim() || q.options.some((o) => o.trim())), ...add]);
    setBank(false); setPicked([]); toast(referenceT("{value0} questions added from the bank", { value0: add.length }));
  };
  const q = qs[active] ?? qs[0]!;

  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <CardGrid className="grid content-start gap-2.5 lg:col-span-3">
        <Card>
          <CardHeader title={referenceT("Quiz settings")} action={<Link href="/quizzes"><Button size="xs" variant="ghost" icon={ArrowLeft}><ReferenceText message="Back" /></Button></Link>} />
          <div className="grid gap-2.5 p-3">
            <Field label={referenceT("Title")} required error={showErrors && metaErrors.title ? "Required" : undefined}><Input value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} placeholder={referenceT("e.g. Chapter 4 checkpoint")} autoFocus /></Field>
            <Field label={referenceT("Class")} required error={showErrors && metaErrors.classId ? "Required" : undefined}><ClassSelect value={meta.classId} onChange={(v) => setMeta((m) => ({ ...m, classId: v }))} classes={classes} allLabel="Select class" className="w-full" /></Field>
            <Field label={referenceT("Subject")}><Select value={subjectId} onChange={(e) => setMeta((m) => ({ ...m, subjectId: e.target.value }))}>{subjectOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={referenceT("Time limit")}><Select value={meta.durationMin} onChange={(e) => setMeta((m) => ({ ...m, durationMin: e.target.value }))}>{[5, 10, 15, 20, 30, 45].map((d) => <option key={d} value={d}>{d} <ReferenceText message="min" /></option>)}</Select></Field>
              <Field label={referenceT("Due")}><DateInput value={meta.dueDate} min={isoDay(new Date())} onChange={(e) => setMeta((m) => ({ ...m, dueDate: e.target.value }))} /></Field>
            </div>
            <Toggle label={referenceT("Shuffle question order")} checked={shuffle} onChange={setShuffle} />
            <Toggle label={referenceT("Show answers after submit")} checked={reveal} onChange={setReveal} />
          </div>
          <div className="flex gap-2 border-t border-line p-2">
            <Button className="flex-1" disabled={busy} onClick={() => save("Draft")}><ReferenceText message="Save draft" /></Button>
            <Button className="flex-1" variant="primary" icon={Send} loading={busy} onClick={() => save("Published")}><ReferenceText message="Publish" /></Button>
          </div>
        </Card>
        <Card>
          <CardHeader title={referenceT("Questions")} sub={referenceT("{value0} questions · {value1} points", {value0: qs.length, value1: points})} action={<Button size="xs" variant="subtle" icon={Library} onClick={() => setBank(true)}><ReferenceText message="Bank" /></Button>} />
          <ol className="max-h-[300px] divide-y divide-line/60 overflow-y-auto">
            {qs.map((x, i) => (
              <li key={x.id}>
                <button type="button" onClick={() => setActive(i)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs", i === active ? "bg-brand/10" : "hover:bg-subtle")}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded text-[10px] font-semibold", showErrors && problems[i]!.length ? "bg-bad text-white" : problems[i]!.length ? "bg-line text-muted" : "bg-ok text-white")}>{i + 1}</span>
                  <span className="truncate">{x.text || <span className="text-faint"><ReferenceText message="Untitled question" /></span>}</span>
                </button>
              </li>
            ))}
          </ol>
          <div className="border-t border-line p-2"><Button className="w-full" icon={Plus} onClick={() => { setQs((x) => [...x, blank()]); setActive(qs.length); }}><ReferenceText message="Add question" /></Button></div>
        </Card>
      </CardGrid>

      <Card className="h-fit lg:col-span-9">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Badge tone="brand"><ReferenceText message="Question" /> {active + 1} <ReferenceText message="of" /> {qs.length}</Badge>
          {showErrors && problems[active]!.length > 0 && <span className="text-[11px] text-bad"><ReferenceText message="Needs" /> {problems[active]!.join(", ")}</span>}
          <div className="ml-auto flex items-center gap-1">
            <Button size="xs" variant="ghost" icon={ArrowUp} disabled={active === 0} onClick={() => move(active, -1)} aria-label={referenceT("Move up")} />
            <Button size="xs" variant="ghost" icon={ArrowDown} disabled={active === qs.length - 1} onClick={() => move(active, 1)} aria-label={referenceT("Move down")} />
            <Button size="xs" variant="ghost" icon={Copy} onClick={() => { setQs((x) => [...x.slice(0, active + 1), { ...q, id: blank().id, options: [...q.options] }, ...x.slice(active + 1)]); setActive(active + 1); }} aria-label={referenceT("Duplicate")} />
            <Button size="xs" variant="ghost" icon={Trash2} disabled={qs.length === 1} onClick={() => { setQs((x) => x.filter((_, k) => k !== active)); setActive(Math.max(0, active - 1)); }} aria-label={referenceT("Delete")} />
          </div>
        </div>
        <div className="grid gap-3 p-3">
          <Field label={referenceT("Question")}><Textarea value={q.text} onChange={(e) => upd(active, { text: e.target.value })} className="min-h-16 text-sm" placeholder={referenceT("Type the question…")} /></Field>
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted"><ReferenceText message="Options · click the letter to mark the correct answer" /></p>
            <div className="grid gap-1.5 md:grid-cols-2">
              {q.options.map((o, oi) => (
                <div key={oi} className={cn("flex items-center gap-2 rounded-md border p-1.5", q.answer === oi ? "border-ok bg-ok/5" : "border-line")}>
                  <button type="button" onClick={() => upd(active, { answer: oi })} aria-label={referenceT("Mark option {value0} correct", {value0: LETTERS[oi]})}
                    className={cn("grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold", q.answer === oi ? "bg-ok text-white" : "bg-subtle text-muted hover:bg-line")}>
                    {q.answer === oi ? <Check className="size-3.5" /> : LETTERS[oi]}
                  </button>
                  <Input value={o} onChange={(e) => upd(active, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} placeholder={referenceT("Option {value0}", {value0: LETTERS[oi]})} className="border-transparent" />
                  {q.options.length > 2 && <Button size="xs" variant="ghost" icon={Trash2} aria-label={referenceT("Remove option")} onClick={() => upd(active, { options: q.options.filter((_, k) => k !== oi), answer: q.answer === oi ? -1 : (q.answer ?? -1) > oi ? (q.answer ?? 0) - 1 : q.answer })} />}
                </div>
              ))}
            </div>
            {q.options.length < 6 && <Button size="xs" variant="ghost" icon={Plus} className="mt-1.5" onClick={() => upd(active, { options: [...q.options, ""] })}><ReferenceText message="Add option" /></Button>}
          </div>
          <div className="grid gap-3 md:grid-cols-[120px_1fr]">
            <Field label={referenceT("Points")}><Input type="number" min={1} max={10} value={q.points} onChange={(e) => upd(active, { points: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} /></Field>
            <Field label={referenceT("Explanation (shown after submitting)")}><Input value={q.explanation ?? ""} onChange={(e) => upd(active, { explanation: e.target.value })} placeholder={referenceT("Why is this the right answer?")} /></Field>
          </div>
        </div>
        <div className="flex justify-between border-t border-line bg-subtle/50 px-3 py-2">
          <Button disabled={active === 0} onClick={() => setActive(active - 1)}><ReferenceText message="Previous" /></Button>
          {active < qs.length - 1 ? <Button onClick={() => setActive(active + 1)}><ReferenceText message="Next question" /></Button> : <Button variant="subtle" icon={Plus} onClick={() => { setQs((x) => [...x, blank()]); setActive(qs.length); }}><ReferenceText message="New question" /></Button>}
        </div>
      </Card>

      <Modal open={bank} onClose={() => setBank(false)} size="lg" title={referenceT("Question bank")} sub={referenceT("{value0} · {value1} reviewed questions", {value0: subjects.find((s) => s.id === subjectId)?.name ?? "", value1: bankQs.length})}
        footer={<><Button variant="ghost" onClick={() => setBank(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!picked.length} onClick={importBank}><ReferenceText message="Add" /> {picked.length || ""} <ReferenceText message="questions" /></Button></>}>
        {bankApi.error ? <ErrorNote message={bankApi.error} onRetry={bankApi.reload} /> : !bankApi.data ? <Skeleton className="h-40" /> : bankQs.length === 0 ? <p className="text-xs text-muted"><ReferenceText message="No bank questions for this subject yet." /></p> : (
          <ul className="grid gap-1.5">
            {bankQs.map((b, i) => (
              <li key={i}>
                <button type="button" aria-pressed={picked.includes(i)} onClick={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))} className={cn("flex w-full items-start gap-2 rounded-md border p-2 text-left text-xs", picked.includes(i) ? "border-brand bg-brand/5" : "border-line hover:bg-subtle")}>
                  <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded border", picked.includes(i) ? "border-brand bg-brand text-brand-fg" : "border-line")}>{picked.includes(i) && <Check className="size-3" />}</span>
                  <span className="flex-1"><span className="font-medium">{b.text}</span><span className="block text-[11px] text-muted"><ReferenceText message="Answer:" /> {b.answer !== undefined ? b.options[b.answer] : "—"}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </CardGrid>
  );
}
