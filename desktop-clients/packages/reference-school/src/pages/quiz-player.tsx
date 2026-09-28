"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Eye, Flag, Play, RefreshCw, RotateCcw, Send, TriangleAlert, XCircle } from "lucide-react";
import { Link } from "../lib/router";
import { useParams } from "../lib/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardGrid, CardHeader, Empty, ErrorNote, Modal, Ring, Skeleton } from "../ui";
import { useActiveStudent } from "../components/shared/child-switcher";
import { useApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import type { QuizAttempt } from "../lib/contract";
import { useQuizAttempt, useQuizGrader, type GradeState } from "../lib/quiz-attempts";
import { useSession } from "../lib/session";
import type { Quiz, QuizQuestion } from "../lib/types";
import { cn } from "../lib/utils";
import { useFormat, useShortcutsEnabled } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const LETTERS = "ABCDEF";
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function QuizPlayerPage() {
  const referenceT = useReferenceLocalization().t;
  const { fmtDate } = useFormat();
  const { id } = useParams<{ id: string }>();
  const { role } = useSession();
  const { studentId } = useActiveStudent();
  const { sub, cls, tch } = useLookups();
  const { data: meta, error, reload } = useApi<Quiz>(id ? `/quizzes/${encodeURIComponent(id)}` : null);
  /* Questions come from their own endpoint: students receive them without answer keys; staff previews may. */
  const { data: questions, error: qError, reload: qReload } = useApi<QuizQuestion[]>(id ? `/quizzes/${encodeURIComponent(id)}/questions` : null);
  const preview = role !== "student";
  const learner = role === "student" || role === "parent";
  const stored = useQuizAttempt(learner && studentId ? studentId : null, learner ? id ?? null : null);
  const grader = useQuizGrader(id ?? "");
  const [phase, setPhase] = useState<"intro" | "play" | "submit">("intro");

  if (error || qError) return <ErrorNote message={(error ?? qError)!} onRetry={() => { reload(); qReload(); }} />;
  if (stored.loadError) return <ErrorNote message={stored.loadError} onRetry={stored.reload} />;
  if (!meta || !questions || !stored.loaded) return <Skeleton className="h-96" />;
  const quiz: Quiz & { questions: QuizQuestion[] } = { ...meta, questions };
  const sb = sub(quiz.subjectId);
  const total = quiz.questions.reduce((a, q) => a + q.points, 0);

  // A recorded attempt (one per student) opens straight on its server-graded review.
  if (stored.attempt && phase === "intro") return <Result quiz={quiz} attempt={stored.attempt} preview={preview} />;
  if (grader.state.status === "graded") return <Result quiz={quiz} attempt={grader.state.attempt} preview={preview} onRetry={preview ? () => { grader.reset(); setPhase("intro"); } : undefined} />;
  if (phase === "submit") return <Grading state={grader.state} total={quiz.questions.length} onRetry={grader.retry} />;

  if (phase === "intro") return (
    <CardGrid className="mx-auto grid max-w-3xl gap-2.5">
      {preview && <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-xs text-info"><Eye className="mr-1 inline size-3.5" /><ReferenceText message="Preview mode — answers are not recorded." /></p>}
      <Card className="overflow-hidden">
        <div className="p-5" style={{ background: `linear-gradient(135deg, ${sb?.color}22, transparent)` }}>
          <Badge tone="brand">{sb?.name}</Badge>
          <h2 className="mt-2 text-xl font-semibold">{quiz.title}</h2>
          <p className="text-xs text-muted">{cls(quiz.classId)?.name} <ReferenceText message="· set by" /> {tch(quiz.teacherId)?.name} <ReferenceText message="· due" /> {fmtDate(quiz.dueDate)}</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line border-y border-line text-center">
          {[["Questions", quiz.questions.length], ["Time limit", `${quiz.durationMin} min`], ["Points", total]].map(([k, v]) => (
            <div key={k} className="py-3"><p className="text-lg font-semibold tabular">{v}</p><p className="text-[11px] text-muted">{k}</p></div>
          ))}
        </div>
        <ul className="list-disc space-y-1 px-8 py-3 text-xs text-muted">
          <li><ReferenceText message="The timer starts when you press Start and the quiz submits automatically when it reaches zero." /></li>
          <li><ReferenceText message="You can move between questions and flag any you want to revisit." /></li>
          <li><ReferenceText message="You get one attempt. Answers and explanations are shown after you submit." /></li>
        </ul>
        <div className="flex justify-between border-t border-line bg-subtle/50 px-4 py-2.5">
          <Link href="/quizzes"><Button variant="ghost" icon={ArrowLeft}><ReferenceText message="Back to quizzes" /></Button></Link>
          <Button variant="primary" size="md" icon={Play} disabled={quiz.questions.length === 0} onClick={() => setPhase("play")}>{preview ? referenceT("Start preview") : referenceT("Start quiz")}</Button>
        </div>
      </Card>
    </CardGrid>
  );

  return <Player quiz={quiz} preview={preview} onDone={(answers, timeTaken) => {
    setPhase("submit");
    void grader.submit(preview ? { answers, timeTaken, preview: true } : { studentId, answers, timeTaken });
  }} />;
}

/** Waiting for, or retrying, the server grade. The submitted answers live in the grade request until it succeeds. */
function Grading({ state, total, onRetry }: { state: GradeState; total: number; onRetry: () => void }) {
  if (state.status === "failed") {
    const answered = state.request.answers.filter((a) => a !== null).length;
    return (
      <Card className="mx-auto max-w-xl p-4" role="alert">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-bad"><TriangleAlert className="size-4" /><ReferenceText message="Your answers are not graded yet" /></p>
        <p className="mt-1 text-xs text-muted">{state.message}<ReferenceText message=". Your" /> {answered} <ReferenceText message="of" /> {total} <ReferenceText message="answers are kept on this screen and nothing was recorded." /></p>
        <Button className="mt-3" variant="primary" icon={RefreshCw} onClick={onRetry}><ReferenceText message="Retry grade" /></Button>
      </Card>
    );
  }
  return <Card className="mx-auto max-w-xl p-4" role="status"><p className="text-sm font-semibold"><ReferenceText message="Submitting your answers…" /></p><p className="mt-1 text-xs text-muted"><ReferenceText message="Your result appears when the school has graded them." /></p></Card>;
}

function Player({ quiz, preview, onDone }: { quiz: Quiz & { questions: QuizQuestion[] }; preview: boolean; onDone: (answers: (number | null)[], timeTaken: number) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [flags, setFlags] = useState<boolean[]>(() => quiz.questions.map(() => false));
  const [left, setLeft] = useState(quiz.durationMin * 60);
  const [confirm, setConfirm] = useState(false);
  const started = useRef(Date.now());
  const done = useRef(false);
  const shortcuts = useShortcutsEnabled();

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    // Scoring is the server's job: only the answers and elapsed time leave the player.
    onDone(answers, Math.round((Date.now() - started.current) / 1000));
  }, [answers, onDone]);

  useEffect(() => { const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (left === 0) finish(); }, [left, finish]);
  useEffect(() => {
    if (!shortcuts) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).closest('[role="dialog"]')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= quiz.questions[i]!.options.length) setAnswers((a) => a.map((x, k) => (k === i ? n - 1 : x)));
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, quiz.questions.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
      if (e.key.toLowerCase() === "f") setFlags((f) => f.map((x, k) => (k === i ? !x : x)));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [i, quiz.questions, shortcuts]);

  const q = quiz.questions[i]!;
  const answered = answers.filter((a) => a !== null).length;
  const low = left <= 60;

  return (
    <CardGrid className="grid h-full gap-2.5 lg:grid-cols-12">
      <Card className="flex min-h-[480px] flex-col lg:col-span-9">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="truncate text-xs font-semibold">{quiz.title}</span>
          {preview && <Badge tone="info"><ReferenceText message="Preview" /></Badge>}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/60"><div className="h-full bg-brand transition-all" style={{ width: `${(answered / quiz.questions.length) * 100}%` }} /></div>
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold tabular", low ? "animate-pulse bg-bad/10 text-bad" : "bg-subtle")}><Clock className="size-4" />{mmss(left)}</span>
        </div>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center p-4 sm:p-8">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-muted"><ReferenceText message="Question" /> {i + 1} <ReferenceText message="of" /> {quiz.questions.length} · {q.points} <ReferenceText message="point" />{q.points > 1 ? "s" : ""}</div>
          <h2 className="mb-5 text-lg leading-snug font-semibold sm:text-xl">{q.text}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {q.options.map((o, oi) => {
              const sel = answers[i] === oi;
              return (
                <button type="button" key={oi} onClick={() => setAnswers((a) => a.map((x, k) => (k === i ? oi : x)))} aria-pressed={sel}
                  className={cn("flex items-center gap-3 rounded-lg border p-3.5 text-left text-sm transition sm:text-[15px]", sel ? "border-brand bg-brand/10 ring-2 ring-brand/20" : "border-line hover:border-brand/40 hover:bg-subtle")}>
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold", sel ? "bg-brand text-brand-fg" : "bg-subtle text-muted")}>{LETTERS[oi]}</span>{o}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-line bg-subtle/50 px-3 py-2">
          <Button icon={ArrowLeft} disabled={i === 0} onClick={() => setI(i - 1)}><ReferenceText message="Previous" /></Button>
          <Button variant={flags[i] ? "subtle" : "ghost"} icon={Flag} onClick={() => setFlags((f) => f.map((x, k) => (k === i ? !x : x)))}>{flags[i] ? referenceT("Flagged") : referenceT("Flag")}</Button>
          {shortcuts && <span className="hidden text-[10.5px] text-faint md:inline"><ReferenceText message="Keys: 1–" />{q.options.length} <ReferenceText message="answer · ← → move · F flag" /></span>}
          <div className="ml-auto flex gap-2">
            {i < quiz.questions.length - 1 && <Button onClick={() => setI(i + 1)}><ReferenceText message="Next" /> <ArrowRight className="size-3.5" /></Button>}
            <Button variant="primary" icon={Send} onClick={() => setConfirm(true)}><ReferenceText message="Submit" /></Button>
          </div>
        </div>
      </Card>
      <Card className="h-fit lg:col-span-3">
        <CardHeader title={referenceT("Question palette")} sub={referenceT("{value0} answered · {value1} flagged", {value0: answered, value1: flags.filter(Boolean).length})} />
        <div className="grid grid-cols-6 gap-1.5 p-3 lg:grid-cols-5">
          {quiz.questions.map((_, k) => (
            <button type="button" key={k} onClick={() => setI(k)} aria-label={referenceT("Question {value0}{value1}{value2}", {value0: k + 1, value1: answers[k] !== null ? ", answered" : "", value2: flags[k] ? ", flagged" : ""})} aria-current={k === i ? "step" : undefined}
              className={cn("relative grid h-8 place-items-center rounded-md border text-xs font-semibold tabular",
                k === i ? "border-brand ring-2 ring-brand/30" : "border-line", answers[k] !== null ? "bg-brand text-brand-fg" : "bg-surface")}>
              {k + 1}{flags[k] && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warn ring-2 ring-surface" />}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-line px-3 py-2 text-[10.5px] text-muted">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-brand" /><ReferenceText message="Answered" /></span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded border border-line" /><ReferenceText message="Not answered" /></span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warn" /><ReferenceText message="Flagged" /></span>
        </div>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} size="sm" title={referenceT("Submit quiz?")}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}><ReferenceText message="Keep working" /></Button><Button variant="primary" onClick={finish}><ReferenceText message="Submit now" /></Button></>}>
        <p className="text-sm"><ReferenceText message="You have answered" /> <b>{answered}</b> <ReferenceText message="of" /> {quiz.questions.length} <ReferenceText message="questions." /></p>
        {answered < quiz.questions.length && <p className="mt-1 text-xs text-warn">{quiz.questions.length - answered} <ReferenceText message="unanswered questions will score zero." /></p>}
        {flags.some(Boolean) && <p className="mt-1 text-xs text-muted">{flags.filter(Boolean).length} <ReferenceText message="questions are still flagged for review." /></p>}
      </Modal>
    </CardGrid>
  );
}

/** Result and review as returned by the server grader: score, total and the per-question key in `review`. */
function Result({ quiz, attempt, preview, onRetry }: { quiz: Quiz & { questions: QuizQuestion[] }; attempt: QuizAttempt; preview: boolean; onRetry?: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const correct = useMemo(() => attempt.answers.filter((a, k) => a !== null && a === attempt.review[k]?.answer).length, [attempt]);
  if (!quiz.questions.length) return <Empty title={referenceT("This quiz has no questions")} />;
  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <Card className="h-fit p-4 text-center lg:col-span-3">
        <Ring value={pct} size={110} stroke={10} label={referenceT("{value0}%", {value0: pct})} color={pct >= 70 ? "var(--ok)" : pct >= 40 ? "var(--warn)" : "var(--bad)"} />
        <p className="mt-2 text-sm font-semibold">{pct >= 85 ? referenceT("Outstanding!") : pct >= 70 ? referenceT("Great work") : pct >= 40 ? referenceT("Good effort") : referenceT("Keep practising")}</p>
        <p className="text-xs text-muted">{attempt.score} / {attempt.total} <ReferenceText message="points ·" /> {correct} <ReferenceText message="of" /> {quiz.questions.length} <ReferenceText message="correct" /></p>
        <p className="text-xs text-muted"><ReferenceText message="Time taken" /> {mmss(attempt.timeTaken)} <ReferenceText message="· class average" /> {quiz.avgScore || "—"}%</p>
        {preview && <p className="mt-2 text-[11px] text-info"><ReferenceText message="Preview — not recorded" /></p>}
        <div className="mt-3 flex justify-center gap-2">
          <Link href="/quizzes"><Button icon={ArrowLeft}><ReferenceText message="Quizzes" /></Button></Link>
          {onRetry && <Button icon={RotateCcw} onClick={onRetry}><ReferenceText message="Again" /></Button>}
        </div>
      </Card>
      <Card className="lg:col-span-9">
        <CardHeader title={referenceT("Answer review")} sub={referenceT("Correct answers are shown in green")} />
        <ol className="divide-y divide-line/70">
          {quiz.questions.map((q, k) => {
            const a = attempt.answers[k] ?? null;
            const key = attempt.review[k];
            const ok = a !== null && a === key?.answer;
            return (
              <li key={q.id} className="flex gap-3 px-3 py-2.5">
                {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-bad" />}
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-medium">{k + 1}. {q.text}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.options.map((o, oi) => (
                      <span key={oi} className={cn("rounded border px-1.5 py-0.5 text-[11px]", oi === key?.answer ? "border-ok/40 bg-ok/10 text-ok" : oi === a ? "border-bad/40 bg-bad/10 text-bad line-through" : "border-line text-muted")}>{LETTERS[oi]}. {o}</span>
                    ))}
                  </div>
                  {a === null && <p className="mt-1 text-[11px] text-warn"><ReferenceText message="Not answered" /></p>}
                  {key?.explanation && <p className="mt-1 text-[11px] text-muted">💡 {key.explanation}</p>}
                </div>
                <span className="text-[11px] text-muted tabular">{ok ? q.points : 0}/{q.points}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </CardGrid>
  );
}
