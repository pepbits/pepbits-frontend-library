"use client";

import { ArrowDownWideNarrow, Download, Lock, Printer, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Checkbox, ConfirmDialog, ErrorNote, Input, Skeleton, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableHeader, TableRow, Tabs, useToast } from "../ui";
import { ChildSwitcher, useActiveStudent } from "../components/shared/child-switcher";
import { ReportCard } from "../components/shared/report-card";
import { ClassSelect, useMyClasses } from "../components/shared/scope";
import { useSchoolApi } from "../lib/api";
import { useLookups } from "../lib/lookups";
import { useSession } from "../lib/session";
import type { MarkSheet } from "../lib/contract";
import { useSchoolExport } from "../lib/format";
import { cn, gradeFor } from "../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* The mark grid is specialized spreadsheet markup (inline numeric cells with arrow/Enter navigation, sticky roll
   and name columns, live totals/ranks); it sits inside the shared managed Table. */
type Values = Record<string, Record<string, string>>;

export function MarksPage() {
  const { role } = useSession();
  if (role === "student" || role === "parent") return <Results />;
  return <MarkList />;
}

function Results() {
  const { studentId } = useActiveStudent();
  return <div className="grid gap-2.5"><ChildSwitcher /><ReportCard studentId={studentId} /></div>;
}

const gradeTone = (g: string) => (g.startsWith("A") ? "ok" : g.startsWith("B") ? "brand" : g === "C" ? "warn" : "bad") as "ok" | "brand" | "warn" | "bad";

function MarkList() {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const { role, user } = useSession();
  const toast = useToast();
  const { meta, tch } = useLookups();
  const { classes, homeClassId } = useMyClasses();
  const [classId, setClassId] = useState("");
  const [term, setTerm] = useState("QTR");
  const [sheet, setSheet] = useState<MarkSheet | null>(null);
  const [values, setValues] = useState<Values>({});
  const [initial, setInitial] = useState<Values>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [byRank, setByRank] = useState(false);
  const [showGrades, setShowGrades] = useState(true);
  const [pendingTerm, setPendingTerm] = useState<string | null>(null);
  const exporter = useSchoolExport();
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => { if (!classId && homeClassId) setClassId(homeClassId); }, [homeClassId, classId]);
  const load = useCallback(() => {
    if (!classId) return;
    setSheet(null); setError(null);
    api.get<{ data: MarkSheet }>(`/marks?classId=${encodeURIComponent(classId)}&term=${encodeURIComponent(term)}`).then(({ data }) => {
      const v: Values = Object.fromEntries(data.students.map((s) => [s.id, Object.fromEntries(data.subjects.map((sb) => [sb.id, s.marks[sb.id]?.toString() ?? ""]))]));
      setSheet(data); setValues(v); setInitial(v);
    }).catch((e: Error) => setError(e.message));
  }, [api, classId, term]);
  useEffect(load, [load]);

  const me = tch(user.id);
  const canEdit = (sid: string) => role === "admin" || (role === "teacher" && !!me?.subjectIds.includes(sid));
  const max = sheet?.term.max ?? 100;

  const computed = useMemo(() => {
    if (!sheet) return null;
    const rows = sheet.students.map((s) => {
      const nums = sheet.subjects.map((sb) => values[s.id]?.[sb.id] ?? "").map((x) => (x === "" ? null : Number(x)));
      const entered = nums.filter((n): n is number => n !== null && !Number.isNaN(n));
      const total = entered.reduce((a, b) => a + b, 0);
      const pct = entered.length ? Math.round((total / (entered.length * max)) * 1000) / 10 : null;
      const fails = entered.filter((n) => n / max < 0.4).length;
      return { ...s, total, pct, grade: pct === null ? null : gradeFor(pct).grade, fails, complete: entered.length === sheet.subjects.length };
    });
    const ranked = [...rows].filter((r) => r.pct !== null).sort((a, b) => b.total - a.total);
    const rank = new Map<string, number>();
    ranked.forEach((r, i) => rank.set(r.id, i > 0 && ranked[i - 1]!.total === r.total ? rank.get(ranked[i - 1]!.id)! : i + 1));
    const stats = sheet.subjects.map((sb) => {
      const v = sheet.students.map((s) => values[s.id]?.[sb.id]).filter((x) => x !== undefined && x !== "").map(Number);
      return { id: sb.id, avg: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null, hi: v.length ? Math.max(...v) : null, lo: v.length ? Math.min(...v) : null, pass: v.filter((x) => x / max >= 0.4).length, n: v.length };
    });
    const out = rows.map((r) => ({ ...r, rank: rank.get(r.id) ?? null }));
    if (byRank) out.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const classPct = ranked.length ? Math.round((ranked.reduce((a, r) => a + (r.pct ?? 0), 0) / ranked.length) * 10) / 10 : null;
    return { rows: out, stats, classPct, passAll: rows.filter((r) => r.complete && r.fails === 0).length };
  }, [sheet, values, max, byRank]);

  const invalid = useMemo(() => Object.values(values).some((r) => Object.values(r).some((v) => v !== "" && (Number.isNaN(Number(v)) || Number(v) < 0 || Number(v) > max))), [values, max]);
  const changes = useMemo(() => {
    const out: { studentId: string; subjectId: string; value: number | null }[] = [];
    for (const [sid, row] of Object.entries(values)) for (const [sub, v] of Object.entries(row)) if (initial[sid]?.[sub] !== v) out.push({ studentId: sid, subjectId: sub, value: v === "" ? null : Number(v) });
    return out;
  }, [values, initial]);

  const save = async () => {
    if (invalid) return toast(referenceT("Marks must be between 0 and {value0}", { value0: max }), "error");
    setSaving(true);
    try {
      await api.post("/marks", { term, entries: changes });
      setInitial(values);
      toast(referenceT(changes.length === 1 ? "{value0} mark saved for {value1} · {value2}" : "{value0} marks saved for {value1} · {value2}", { value0: changes.length, value1: sheet?.class.name ?? "", value2: sheet?.term.name ?? "" }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setSaving(false); }
  };

  const exportCsv = () => {
    if (!sheet || !computed) return;
    exporter.exportCsv(`marklist-${sheet.class.name.replace(/\s/g, "")}-${term}.csv`, [
      ["Roll", "Admission no", "Student", ...sheet.subjects.map((s) => s.code), "Total", "%", "Grade", "Rank"],
      ...computed.rows.map((r) => [r.rollNo, r.admissionNo, r.name, ...sheet.subjects.map((s) => values[r.id]?.[s.id] ?? ""), r.total, r.pct ?? "", r.grade ?? "", r.rank ?? ""]),
    ]);
  };

  /** Enter / arrow keys move down and up the same subject column, like a spreadsheet. */
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const move = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const side = e.key === "ArrowRight" && (e.currentTarget.selectionStart ?? 0) >= e.currentTarget.value.length ? 1 : e.key === "ArrowLeft" && (e.currentTarget.selectionStart ?? 0) === 0 ? -1 : 0;
    if (!move && !side) return;
    e.preventDefault();
    const next = tableRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${row + move}-${col + side}"]`);
    next?.focus(); next?.select();
  };

  const dirty = changes.length > 0;
  return (
    <Card className="print-full flex h-full min-h-[560px] flex-col">
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-line p-2">
        <ClassSelect value={classId} onChange={setClassId} classes={classes} />
        <Tabs value={term} onChange={(v) => { if (dirty) setPendingTerm(v); else setTerm(v); }} items={meta.terms.map((t) => ({ value: t.id, label: `${t.name} /${t.max}` }))} />
        <Checkbox checked={showGrades} onChange={(e) => setShowGrades(e.target.checked)} label={referenceT("Grades")} className="items-center text-[11px] text-muted" />
        <Button size="sm" variant={byRank ? "subtle" : "ghost"} icon={ArrowDownWideNarrow} onClick={() => setByRank((x) => !x)}>{byRank ? referenceT("By rank") : referenceT("By roll")}</Button>
        <div className="ml-auto flex items-center gap-1.5">
          {dirty && <span className="text-[11px] font-medium text-warn tabular">{changes.length} <ReferenceText message="unsaved" /></span>}
          <Button icon={Download} disabled={exporter.disabled} title={exporter.reason} onClick={exportCsv}><ReferenceText message="CSV" /></Button>
          <Button icon={Printer} onClick={() => window.print()}><ReferenceText message="Print" /></Button>
          <Button variant="ghost" icon={RotateCcw} disabled={!dirty} onClick={() => setValues(initial)}><ReferenceText message="Reset" /></Button>
          <Button variant="primary" icon={Save} loading={saving} disabled={!dirty || invalid} onClick={save}><ReferenceText message="Save marks" /></Button>
        </div>
      </div>
      {sheet && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-subtle/50 px-3 py-1.5 text-[11px] text-muted">
          <span className="font-semibold text-fg">{sheet.class.name} · {sheet.term.name} <ReferenceText message="(max" /> {max} <ReferenceText message="per subject)" /></span>
          <span><ReferenceText message="Class teacher" /> {tch(sheet.class.classTeacherId)?.name}</span>
          <span><ReferenceText message="Class average" /> <b className="text-fg tabular">{computed?.classPct ?? "—"}%</b></span>
          <span><ReferenceText message="Passed all subjects" /> <b className="text-fg tabular">{computed?.passAll}/{sheet.students.length}</b></span>
          {sheet.term.status !== "Completed" && <Badge tone="info"><ReferenceText message="Entry open · exam scheduled" /></Badge>}
          {role === "teacher" && <span className="flex items-center gap-1"><Lock className="size-3" /><ReferenceText message="You can edit" /> {me?.subjectIds.length === 1 ? referenceT("your subject") : referenceT("your subjects")} <ReferenceText message="only" /></span>}
          {invalid && <span className="flex items-center gap-1 text-bad"><TriangleAlert className="size-3" /><ReferenceText message="Some marks are out of range" /></span>}
        </div>
      )}
      {error && <div className="p-2"><ErrorNote message={error} onRetry={load} /></div>}
      {!sheet || !computed ? <Skeleton className="m-2 flex-1" /> : (
        <TableContainer className="min-h-0 flex-1 overflow-auto">
          <Table ref={tableRef} className="w-full border-separate border-spacing-0 text-[12px]">
            <TableHeader className="sticky top-0 z-10 bg-subtle text-[11px] text-muted">
              <TableRow>
                <TableHead className="sticky left-0 z-20 w-10 border-b border-line bg-subtle px-2 py-1.5 text-left"><ReferenceText message="Roll" /></TableHead>
                <TableHead className="sticky left-10 z-20 min-w-44 border-b border-r border-line bg-subtle px-2 py-1.5 text-left"><ReferenceText message="Student" /></TableHead>
                {sheet.subjects.map((s) => (
                  <TableHead key={s.id} className={cn("min-w-[62px] border-b border-line px-1 py-1.5 text-center", canEdit(s.id) && "text-brand")} title={s.name}>
                    <span className="flex items-center justify-center gap-1"><span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.code}{!canEdit(s.id) && <Lock className="size-2.5 text-faint" />}</span>
                  </TableHead>
                ))}
                <TableHead className="border-b border-l border-line px-2 py-1.5 text-right"><ReferenceText message="Total" /></TableHead>
                <TableHead className="border-b border-line px-2 py-1.5 text-right">%</TableHead>
                {showGrades && <TableHead className="border-b border-line px-2 py-1.5 text-center"><ReferenceText message="Grade" /></TableHead>}
                <TableHead className="border-b border-line px-2 py-1.5 text-center"><ReferenceText message="Rank" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computed.rows.map((r, ri) => (
                <TableRow key={r.id} className="group hover:bg-brand/[0.03]">
                  <TableCell className="sticky left-0 border-b border-line/60 bg-surface px-2 text-muted tabular group-hover:bg-subtle">{r.rollNo}</TableCell>
                  <TableCell className="sticky left-10 border-r border-b border-line/60 bg-surface px-2 py-0.5 group-hover:bg-subtle">
                    <span className="block truncate font-medium">{r.name}</span>
                  </TableCell>
                  {sheet.subjects.map((s, ci) => {
                    const v = values[r.id]?.[s.id] ?? "";
                    const n = Number(v);
                    const bad = v !== "" && (Number.isNaN(n) || n < 0 || n > max);
                    const fail = v !== "" && !bad && n / max < 0.4;
                    const changed = initial[r.id]?.[s.id] !== v;
                    return (
                      <TableCell key={s.id} className="border-b border-line/60 p-0.5 text-center">
                        {canEdit(s.id) ? (
                          /* Shared Input; data-cell stays on the native input for spreadsheet navigation, and the
                             compact cell states are inline so they override the standard field chrome. */
                          <Input data-cell={`${ri}-${ci}`} inputMode="numeric" value={v} aria-label={referenceT("{value0} {value1}", {value0: r.name, value1: s.name})} aria-invalid={bad || undefined}
                            onChange={(e) => setValues((x) => ({ ...x, [r.id]: { ...x[r.id], [s.id]: e.target.value.replace(/[^\d.]/g, "") } }))}
                            onKeyDown={(e) => onKey(e, ri, ci)} onFocus={(e) => e.target.select()} className="w-full"
                            style={{ height: 24, paddingInline: 2, textAlign: "center", fontVariantNumeric: "tabular-nums", boxShadow: "none", borderRadius: "calc(var(--radius) * 0.3)",
                              borderColor: bad ? "var(--bad)" : changed ? "color-mix(in oklab, var(--warn) 60%, transparent)" : "transparent",
                              background: bad ? "color-mix(in oklab, var(--bad) 10%, transparent)" : changed ? "color-mix(in oklab, var(--warn) 10%, transparent)" : "transparent",
                              color: bad || fail ? "var(--bad-ink)" : undefined, fontWeight: fail ? 600 : undefined }} />
                        ) : <span className={cn("tabular", fail && "font-semibold text-bad", v === "" && "text-faint")}>{v === "" ? "—" : v}</span>}
                      </TableCell>
                    );
                  })}
                  <TableCell className="border-b border-l border-line/60 px-2 text-right font-semibold tabular">{r.total || "—"}</TableCell>
                  <TableCell className="border-b border-line/60 px-2 text-right tabular">{r.pct ?? "—"}</TableCell>
                  {showGrades && <TableCell className="border-b border-line/60 px-2 text-center">{r.grade ? <Badge tone={gradeTone(r.grade)}>{r.grade}</Badge> : "—"}</TableCell>}
                  <TableCell className="border-b border-line/60 px-2 text-center tabular">{r.rank ? <span className={cn(r.rank <= 3 && "font-semibold text-brand")}>{r.rank}</span> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-subtle text-[11px]">
              {([["Average", "avg"], ["Highest", "hi"], ["Lowest", "lo"], ["Pass (≥40%)", "pass"]] as const).map(([label, k]) => (
                <TableRow key={k}>
                  <TableCell className="sticky left-0 border-t border-line bg-subtle" />
                  <TableCell className="sticky left-10 border-t border-r border-line bg-subtle px-2 py-1 font-semibold text-muted">{label}</TableCell>
                  {computed.stats.map((st) => <TableCell key={st.id} className="border-t border-line px-1 text-center tabular">{k === "pass" ? `${st.pass}/${st.n}` : st[k] ?? "—"}</TableCell>)}
                  <TableCell colSpan={showGrades ? 4 : 3} className="border-t border-l border-line" />
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </TableContainer>
      )}
      <div className="no-print flex items-center gap-3 border-t border-line px-3 py-1 text-[10.5px] text-muted">
        <span><ReferenceText message="Enter ↓ · ↑ · ← → to move between cells" /></span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm border border-warn/60 bg-warn/10" /><ReferenceText message="Unsaved" /></span>
        <span className="flex items-center gap-1"><span className="font-semibold text-bad">35</span><ReferenceText message="Below 40%" /></span>
        <span className="ml-auto"><ReferenceText message="Grades: A+ ≥90 · A ≥80 · B+ ≥70 · B ≥60 · C ≥50 · D ≥40 · F" /></span>
      </div>
      <ConfirmDialog open={pendingTerm !== null} title={referenceT("Discard unsaved marks?")} message={referenceT("{value0} unsaved mark{value1} will be lost if you switch term.", {value0: changes.length, value1: changes.length === 1 ? "" : "s"})}
        confirmLabel={referenceT("Discard and switch")} tone="danger" onCancel={() => setPendingTerm(null)} onConfirm={() => { if (pendingTerm) setTerm(pendingTerm); setPendingTerm(null); }} />
    </Card>
  );
}
