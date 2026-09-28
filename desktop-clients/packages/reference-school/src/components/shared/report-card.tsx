"use client";

import { useFormat } from "../../lib/format";
import { useLookups } from "../../lib/lookups";
import { Printer } from "lucide-react";
import { Avatar, Badge, BarChart, Button, Card, CardGrid, CardHeader, ErrorNote, Skeleton, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableHeader, TableRow } from "../../ui";
import { useApi } from "../../lib/api";
import type { ClassRoom, Student, Subject } from "../../lib/types";
import { cn, gradeFor } from "../../lib/utils";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface ReportTerm {
  id: string; name: string; max: number; status: "Completed" | "Scheduled";
  marks: Record<string, number | null>; classAvg: Record<string, number | null>;
  total: number; pct: number | null; grade: string | null; rank: number | null; outOf: number;
}
export interface ReportCardData { student: Student; class: ClassRoom; subjects: Subject[]; terms: ReportTerm[] }

const gradeTone = (g: string | null) => (!g ? "neutral" : g.startsWith("A") ? "ok" : g.startsWith("B") ? "brand" : g === "C" ? "warn" : "bad") as "ok" | "brand" | "warn" | "bad" | "neutral";

export function useReportCard(studentId: string | null) {
  return useApi<ReportCardData>(studentId ? `/report-card?studentId=${encodeURIComponent(studentId)}` : null);
}

/** Term-by-term marks table. `compact` is used inside drawers. */
export function ReportCardTable({ data, compact }: { data: ReportCardData; compact?: boolean }) {
  const { fmtPct } = useFormat();
  const done = data.terms.filter((t) => t.status === "Completed");
  return (
    <TableContainer className="overflow-x-auto">
      <Table className="w-full border-collapse text-[12px]">
        <TableHeader className="bg-subtle text-[11px] text-muted">
          <TableRow>
            <TableHead className="border-b border-line px-2.5 py-1.5 text-left font-semibold"><ReferenceText message="Subject" /></TableHead>
            {data.terms.map((t) => (
              <TableHead key={t.id} colSpan={t.status === "Completed" && !compact ? 3 : 1} className="border-b border-l border-line px-2 py-1.5 text-center font-semibold">
                {t.name} <span className="font-normal text-faint">/{t.max}</span>
              </TableHead>
            ))}
          </TableRow>
          {!compact && (
            <TableRow className="text-[10px]">
              <TableHead className="border-b border-line" />
              {data.terms.map((t) => t.status === "Completed"
                ? [<TableHead key={t.id + "m"} className="border-b border-l border-line px-2 py-1 font-medium"><ReferenceText message="Marks" /></TableHead>, <TableHead key={t.id + "g"} className="border-b border-line px-2 py-1 font-medium"><ReferenceText message="Grade" /></TableHead>, <TableHead key={t.id + "a"} className="border-b border-line px-2 py-1 font-medium"><ReferenceText message="Class avg" /></TableHead>]
                : <TableHead key={t.id} className="border-b border-l border-line px-2 py-1 font-medium">—</TableHead>)}
            </TableRow>
          )}
        </TableHeader>
        <TableBody>
          {data.subjects.map((s) => (
            <TableRow key={s.id} className="border-b border-line/60">
              <TableCell className="px-2.5 py-1.5">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
              </TableCell>
              {data.terms.map((t) => {
                const v = t.marks[s.id];
                if (t.status !== "Completed") return <TableCell key={t.id} className="border-l border-line/60 px-2 text-center text-faint"><ReferenceText message="Upcoming" /></TableCell>;
                const g = v === null || v === undefined ? null : gradeFor((v / t.max) * 100).grade;
                if (compact) return <TableCell key={t.id} className="border-l border-line/60 px-2 text-center tabular">{v ?? "—"} <span className="text-faint">{g}</span></TableCell>;
                return [
                  <TableCell key={t.id + "m"} className={cn("border-l border-line/60 px-2 text-center font-medium tabular", v !== null && v / t.max < 0.4 && "text-bad")}>{v ?? "—"}</TableCell>,
                  <TableCell key={t.id + "g"} className="px-2 text-center"><Badge tone={gradeTone(g)}>{g ?? "—"}</Badge></TableCell>,
                  <TableCell key={t.id + "a"} className="px-2 text-center text-muted tabular">{t.classAvg[s.id] ?? "—"}</TableCell>,
                ];
              })}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-subtle/70 text-[11.5px] font-semibold">
          <TableRow>
            <TableCell className="px-2.5 py-1.5"><ReferenceText message="Total · % · Rank" /></TableCell>
            {data.terms.map((t) => t.status === "Completed" ? (
              <TableCell key={t.id} colSpan={compact ? 1 : 3} className="border-l border-line px-2 py-1.5 text-center tabular">
                {t.total}/{t.max * data.subjects.length} · {t.pct === null ? "—" : fmtPct(t.pct)} · <Badge tone={gradeTone(t.grade)}>{t.grade}</Badge> · #{t.rank}/{t.outOf}
              </TableCell>
            ) : <TableCell key={t.id} className="border-l border-line px-2 text-center text-faint">—</TableCell>)}
          </TableRow>
        </TableFooter>
      </Table>
      {done.length === 0 && <p className="p-3 text-xs text-muted"><ReferenceText message="No completed assessments yet." /></p>}
    </TableContainer>
  );
}

/** Full, printable report card used on the Results page for students and parents. */
export function ReportCard({ studentId }: { studentId: string }) {
  const { fmtPct } = useFormat();
 const referenceT = useReferenceLocalization().t;

  const { profile: SCHOOL } = useLookups();
  const { data, error, reload } = useReportCard(studentId);
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data || data.student.id !== studentId) return <div className="grid gap-2.5"><Skeleton className="h-20" /><Skeleton className="h-72" /></div>;
  const latest = [...data.terms].reverse().find((t) => t.status === "Completed");
  const s = data.student;
  return (
    <CardGrid className="grid gap-2.5 lg:grid-cols-12">
      <Card className="print-full lg:col-span-8">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2.5">
          <Avatar name={s.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-[11px] text-muted">{data.class.name} <ReferenceText message="· Roll" /> {s.rollNo} · {s.admissionNo} · {SCHOOL.name} <ReferenceText message="· AY" /> {SCHOOL.year}</p>
          </div>
          {latest && (
            <div className="flex items-center gap-4 text-center">
              <div><p className="text-lg leading-5 font-semibold tabular">{latest.pct === null ? "—" : fmtPct(latest.pct)}</p><p className="text-[10px] text-muted">{latest.name}</p></div>
              <div><p className="text-lg leading-5 font-semibold">{latest.grade}</p><p className="text-[10px] text-muted"><ReferenceText message="Grade" /></p></div>
              <div><p className="text-lg leading-5 font-semibold tabular">#{latest.rank}</p><p className="text-[10px] text-muted"><ReferenceText message="of" /> {latest.outOf}</p></div>
            </div>
          )}
          <Button icon={Printer} className="no-print" onClick={() => window.print()}><ReferenceText message="Print" /></Button>
        </div>
        <ReportCardTable data={data} />
      </Card>
      <CardGrid className="grid content-start gap-2.5 lg:col-span-4">
        {latest && (
          <Card>
            <CardHeader title={referenceT("{value0}: you vs class average", {value0: latest.name})} sub={referenceT("Grey bars show the class average")} />
            <div className="p-3">
              <BarChart height={150} suffix={latest.max === 100 ? "%" : ""} compare="class avg" max={latest.max}
                data={data.subjects.map((x) => ({ label: x.code, value: latest.marks[x.id] ?? 0, compare: latest.classAvg[x.id] ?? 0, color: x.color }))} />
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title={referenceT("Grading scale")} />
          <div className="grid grid-cols-4 gap-1 p-2.5 text-center text-[11px]">
            {[["A+", "90–100"], ["A", "80–89"], ["B+", "70–79"], ["B", "60–69"], ["C", "50–59"], ["D", "40–49"], ["F", "< 40"]].map(([g, r]) => (
              <div key={g} className="rounded border border-line py-1"><p className="font-semibold">{g}</p><p className="text-muted tabular">{r}</p></div>
            ))}
          </div>
          <p className="border-t border-line px-3 py-2 text-[11px] text-muted"><ReferenceText message="Rank is computed on the total across all examined subjects. Marks below 40% are shown in red." /></p>
        </Card>
      </CardGrid>
    </CardGrid>
  );
}
