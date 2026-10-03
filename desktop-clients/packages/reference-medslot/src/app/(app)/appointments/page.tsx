"use client";
import {SourceButton,TableHeader,TableRow,TableBody,TableCell,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "../../../navigation";
import { Search, ListChecks } from "lucide-react";
import { qs } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import {CATEGORY_LABEL,STATUS,SOURCES,addDays,startOfWeek,useMedslotFormat} from "../../../lib/format";
import type { Appointment, Category, Department, Status } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, Segmented, Select, Skeleton, StatusBadge, Table, Td, Th, cx , DateInput} from "../../../components/ui";
import { AppointmentDrawer } from "../../../components/AppointmentDrawer";
import { CategoryIcon } from "../../../components/icons";

const PAGE = 50;
type Range = "today" | "tomorrow" | "week" | "next7" | "past7" | "custom";

function Inner() {
  const { fmtDay, fmtTime } = useMedslotFormat();
  const { settings } = useAuth();
  const sp = useSearchParams();
  const today = settings.facility_now.slice(0, 10);
  const [range, setRange] = useState<Range>("today");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [dept, setDept] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const dq = useDebounced(q.trim(), 250);
  const [openId, setOpenId] = useState<number | null>(sp.get("open") ? Number(sp.get("open")) : null);
  const depts = useApi<Department[]>("/departments");

  useEffect(() => {
    const r: Record<Exclude<Range, "custom">, [string, string]> = {
      today: [today, today], tomorrow: [addDays(today, 1), addDays(today, 1)], week: [startOfWeek(today), addDays(startOfWeek(today), 6)],
      next7: [today, addDays(today, 6)], past7: [addDays(today, -7), addDays(today, -1)],
    };
    if (range !== "custom") { setFrom(r[range][0]); setTo(r[range][1]); }
  }, [range, today]);
  useEffect(() => setPage(0), [from, to, statuses, dept, cat, dq]);

  // A search by name or ref looks across all dates.
  const path = `/appointments${qs({ from: dq ? undefined : from, to: dq ? undefined : to, status: statuses.join(","), department_id: dept, category: cat, q: dq, limit: PAGE, offset: page * PAGE, order: dq ? "desc" : "asc" })}`;
  const { data, error, loading, reload } = useApi<{ total: number; items: Appointment[] }>(path);
  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of data?.items ?? []) m.set(a.start_at.slice(0, 10), [...(m.get(a.start_at.slice(0, 10)) ?? []), a]);
    return Array.from(m.entries());
  }, [data]);
  const toggle = (s: Status) => setStatuses((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));

  return (
    <>
      <PageHeader title="Appointments" description="Every booking across departments. Click a row to check in, reschedule, extend or cancel." />
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Patient name, MRN or booking ref (searches all dates)" className="pl-9" />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-48"><option value=""><LocalizedText message="All departments" /></option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-44"><option value=""><LocalizedText message="All service types" /></option>{(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select>
        </div>
        <div className={cx("flex flex-wrap items-center gap-2", dq && "opacity-50")}>
          <Segmented size="sm" value={range} onChange={setRange} options={[["past7", "Last 7 days"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "This week"], ["next7", "Next 7 days"], ["custom", "Dates"]]} />
          {range === "custom" && <><DateInput  value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-38" /><span className="text-sm text-mute"><LocalizedText message="to" /></span><DateInput  value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 w-38" /></>}
          <div className="ml-auto flex flex-wrap gap-1">
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <SourceButton key={s} onClick={() => toggle(s)} aria-pressed={statuses.includes(s)}
                className={cx("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs", statuses.includes(s) ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-ink/30")}>
                <span className={cx("size-1.5 rounded-full", STATUS[s].dot)} /><LocalizedText message={STATUS[s].label ?? ""} />
              </SourceButton>
            ))}
          </div>
        </div>
      </div>

      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <div className="space-y-2 p-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          : data && data.items.length === 0 ? <Empty icon={<ListChecks className="size-8" />} title="No appointments match"><LocalizedText message="Try a different date range or clear the status filters." /></Empty>
          : (
            <Table>
              <TableHeader><TableRow><Th className="w-28"><LocalizedText message="Time" /></Th><Th><LocalizedText message="Patient" /></Th><Th><LocalizedText message="Service" /></Th><Th><LocalizedText message="With" /></Th><Th><LocalizedText message="Status" /></Th><Th><LocalizedText message="Booked via" /></Th><Th className="text-right"><LocalizedText message="Ref" /></Th></TableRow></TableHeader>
              <TableBody className={cx(loading && "opacity-60")}>
                {byDay.map(([day, rows]) => (
                  <Fragment key={day}>{(from !== to || dq) && <TableRow><TableCell colSpan={7} className="border-b border-line bg-paper/70 px-3 py-1.5 text-xs font-semibold text-ink-2">{fmtDay(day)}</TableCell></TableRow>}
                    {rows.map((a) => (
                      <TableRow key={a.id} onClick={() => setOpenId(a.id)} className="cursor-pointer hover:bg-scrub-soft/30">
                        <Td className="tabular whitespace-nowrap font-medium">{fmtTime(a.start_at)}<span className="block text-xs font-normal text-mute"><LocalizedText message={"to {value0}"} values={{ value0: (fmtTime(a.end_at)) ?? "" }} /></span></Td>
                        <Td><span className="font-medium">{a.first_name} {a.last_name}</span>{a.patient_kind === "new" && <Badge tone="amber" className="ml-1.5"><LocalizedText message="New" /></Badge>}{a.priority !== "routine" && <Badge tone="red" className="ml-1.5"><LocalizedText message={a.priority ?? ""} /></Badge>}<span className="tabular block text-xs text-mute">{a.mrn}</span></Td>
                        <Td><span className="flex items-center gap-2"><CategoryIcon category={a.service_category} className="size-4 shrink-0 text-mute" /><span>{a.service_name}<span className="block text-xs text-mute">{a.department_name}</span></span></span></Td>
                        <Td className="text-ink-2">{a.resources.map((r) => r.name).join(", ")}</Td>
                        <Td><StatusBadge status={a.status} /></Td>
                        <Td className="text-ink-2">{SOURCES.find(([v]) => v === a.source)?.[1]}</Td>
                        <Td className="tabular text-right text-xs text-mute">{a.ref_code}</Td>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        {data && data.total > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm">
            <span className="tabular text-mute">{page * PAGE + 1}<LocalizedText message={"–{value0} of {value1}"} values={{ value0: (Math.min((page + 1) * PAGE, data.total)) ?? "", value1: (data.total) ?? "" }} /></span>
            <div className="flex gap-2"><Button size="sm" disabled={!page} onClick={() => setPage(page - 1)}><LocalizedText message="Previous" /></Button><Button size="sm" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}><LocalizedText message="Next" /></Button></div>
          </div>
        )}
      </div>
      <AppointmentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={(nid) => { reload(); if (nid) setOpenId(nid); }} />
    </>
  );
}

export default function AppointmentsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Inner /></Suspense>;
}
