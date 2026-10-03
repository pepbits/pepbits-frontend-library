"use client";
import {LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "../../../navigation";
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays } from "lucide-react";
import { qs } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import {STATUS,addDays,startOfMonth,startOfWeek,useMedslotFormat} from "../../../lib/format";
import type { Appointment, Department, Resource, ResourceType, Status } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Button, Check, Drawer, Empty, ErrorNote, IconButton, Input, Segmented, Select, Skeleton, cx , DateInput} from "../../../components/ui";
import { DayView, MonthView, WeekView, type CalData, type CalResource } from "../../../components/calendar/views";
import { ResourcePicker } from "../../../components/calendar/ResourcePicker";
import { AppointmentDrawer } from "../../../components/AppointmentDrawer";
import { BookingFlow } from "../../../components/booking/BookingFlow";

type View = "day" | "week" | "month";
const CATS = [["person", "People"], ["room", "Rooms"], ["chair", "Chairs"], ["bed", "Beds"], ["equipment", "Equipment"]] as const;

function CalendarInner() {
  const { fmtDay, fmtLongDay, fmtMonth } = useMedslotFormat();
  const { t: tr } = useLocalization();
  const { settings, user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const today = settings.facility_now.slice(0, 10);

  const view = (sp.get("view") as View) || "day";
  const date = sp.get("date") || today;
  const dept = sp.get("department_id") ?? "";
  const cat = sp.get("category") ?? "";
  const typeId = sp.get("resource_type_id") ?? "";
  const ids = useMemo(() => (sp.get("resource_ids") ?? "").split(",").map(Number).filter(Boolean), [sp]);

  const setParams = useCallback((patch: Record<string, string | number | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) v === null || v === "" ? p.delete(k) : p.set(k, String(v));
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [sp, router, pathname]);

  const depts = useApi<Department[]>("/departments");
  const types = useApi<ResourceType[]>("/resource-types");
  const allRes = useApi<Resource[]>("/resources");
  const pool = useMemo(() => (allRes.data ?? []).filter((r) => (!dept || r.department_id === Number(dept)) && (!cat || r.category === cat) && (!typeId || r.resource_type_id === Number(typeId))), [allRes.data, dept, cat, typeId]);

  // Week view shows one resource across 7 days; default to the provider's own column or the first in view.
  const weekRes = view === "week" ? (ids[0] ?? user.resource_id ?? pool[0]?.id) : undefined;
  const range = view === "day" ? [date, date] : view === "week" ? [startOfWeek(date), addDays(startOfWeek(date), 6)] : [startOfWeek(startOfMonth(date)), addDays(startOfWeek(startOfMonth(date)), 41)];
  // Default day view to a manageable set: the provider's own column, or the department/category filter.
  const needsFilter = view !== "week" && !ids.length && !dept && !cat && !typeId && user.role !== "provider";
  const path = needsFilter && view === "day" ? null : `/appointments/calendar${qs({
    from: range[0], to: range[1],
    resource_ids: view === "week" ? weekRes : ids.join(",") || undefined,
    department_id: view === "week" || ids.length ? undefined : dept, category: view === "week" || ids.length ? undefined : cat,
    resource_type_id: view === "week" || ids.length ? undefined : typeId,
  })}`;
  const { data, error, loading, reload } = useApi<CalData>(path);

  const [openId, setOpenId] = useState<number | null>(null);
  const [book, setBook] = useState<{ r: CalResource; startAt: string } | null>(null);
  const [hideCancelled, setHideCancelled] = useState(true);
  const now = settings.facility_now;

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const step = (n: number) => setParams({ date: view === "day" ? addDays(date, n) : view === "week" ? addDays(date, 7 * n) : (() => { const d = new Date(date + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n, 1); return d.toISOString().slice(0, 10); })() });
  const title = view === "day" ? fmtLongDay(date) : view === "week" ? `${fmtDay(range[0])} to ${fmtDay(range[1])}` : fmtMonth(date);
  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const a of data?.appointments ?? []) if (view !== "day" || a.start_at.slice(0, 10) === date) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [data, view, date]);
  const weekResource = data?.resources.find((r) => r.id === weekRes);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous" onClick={() => step(-1)}><ChevronLeft className="size-5" /></IconButton>
          <Button size="sm" onClick={() => setParams({ date: today })} disabled={date === today}><LocalizedText message="Today" /></Button>
          <IconButton label="Next" onClick={() => step(1)}><ChevronRight className="size-5" /></IconButton>
        </div>
        <h1 className="mr-auto min-w-0 text-xl font-semibold tracking-tight">{title}</h1>
        <DateInput  value={date} onChange={(e) => e.target.value && setParams({ date: e.target.value })} className="h-9 w-40" aria-label="Go to date" />
        <Segmented value={view} onChange={(v) => setParams({ view: v })} options={[["day", "Day"], ["week", "Week"], ["month", "Month"]]} />
        <IconButton label="Refresh" onClick={reload}><RefreshCw className={cx("size-4", loading && "animate-spin")} /></IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-2">
        <Select value={dept} onChange={(e) => setParams({ department_id: e.target.value, resource_ids: null })} className="h-10 w-48" aria-label="Department">
          <option value=""><LocalizedText message="All departments" /></option>
          {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={cat} onChange={(e) => setParams({ category: e.target.value, resource_type_id: null, resource_ids: null })} className="h-10 w-36" aria-label="Kind of resource">
          <option value=""><LocalizedText message="Everything" /></option>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select value={typeId} onChange={(e) => setParams({ resource_type_id: e.target.value, resource_ids: null })} className="h-10 w-44" aria-label="Resource type">
          <option value=""><LocalizedText message="All types" /></option>{types.data?.filter((t) => !cat || t.category === cat).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <ResourcePicker resources={pool} value={view === "week" && weekRes ? [weekRes] : ids} single={view === "week"} onChange={(v) => setParams({ resource_ids: v.join(",") })} />
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          <Check label="Hide cancelled and no-shows" checked={hideCancelled} onChange={setHideCancelled} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        {(["requested", "scheduled", "confirmed", "checked_in", "in_progress", "completed", "no_show", "cancelled"] as Status[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className={cx("size-2 rounded-full", STATUS[s].dot)} /><LocalizedText message={STATUS[s].label ?? ""} /><span className="tabular text-mute">{counts[s] ?? 0}</span></span>
        ))}
        {can("admin", "scheduler") && view !== "month" && <span className="ml-auto text-mute"><LocalizedText message="Click any open time to book it." /></span>}
      </div>

      <ErrorNote error={error} onRetry={reload} />

      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {needsFilter && view === "day" ? (
          <Empty icon={<CalendarDays className="size-8" />} title="Choose what to show"
            action={<div className="flex flex-wrap justify-center gap-2">{depts.data?.slice(0, 6).map((d) => <Button key={d.id} size="sm" onClick={() => setParams({ department_id: d.id })}>{d.name}</Button>)}</div>}>
            <LocalizedText message="Pick a department, a kind of resource, or specific people and rooms to see their day side by side." /></Empty>
        ) : loading && !data ? <div className="flex gap-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[480px] flex-1" />)}</div>
          : data && data.resources.length === 0 ? <Empty title="No resources match these filters"><LocalizedText message="Change the department or resource type." /></Empty>
          : data && view === "day" ? <DayView data={data} date={date} now={now} hideCancelled={hideCancelled} onOpen={(a) => setOpenId(a.id)} onBook={can("admin", "scheduler") ? (r, s) => setBook({ r, startAt: s }) : undefined} />
          : data && view === "week" && weekResource ? <WeekView data={data} resource={weekResource} now={now} hideCancelled={hideCancelled} onOpen={(a) => setOpenId(a.id)} onBook={can("admin", "scheduler") ? (r, s) => setBook({ r, startAt: s }) : undefined} />
          : data && view === "month" ? <MonthView data={{ ...data, appointments: hideCancelled ? data.appointments.filter((a: Appointment) => !["cancelled", "no_show"].includes(a.status)) : data.appointments }} month={date} now={now} onDay={(d) => setParams({ view: "day", date: d })} onOpen={(a) => setOpenId(a.id)} />
          : null}
      </div>

      <AppointmentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={(nid) => { reload(); if (nid) setOpenId(nid); }} />
      <Drawer open={!!book} onClose={() => setBook(null)} width="max-w-3xl" title={book ? tr("Book with {value0}", { value0: (book.r.name) ?? "" }) : ""} subtitle={book && `${fmtLongDay(book.startAt.slice(0, 10))}, ${book.r.type_name}`}>
        {book && <BookingFlow compact prefill={{ resourceId: book.r.id, date: book.startAt.slice(0, 10), startAt: book.startAt }} onBooked={() => reload()} />}
      </Drawer>
    </div>
  );
}

export default function CalendarPage() {
  return <Suspense fallback={<Skeleton className="h-[600px]" />}><CalendarInner /></Suspense>;
}
