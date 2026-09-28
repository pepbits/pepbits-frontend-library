"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Card, CardGrid, CardHeader, DateInput, ErrorNote, Field, Input, Modal, Select, Skeleton, useToast } from "../ui";
import { useApi, useSchoolApi } from "../lib/api";
import { useSession } from "../lib/session";
import type { CalendarEvent } from "../lib/types";
import { cn, isoDay, toDate } from "../lib/utils";
import { useFormat, useSchoolExport } from "../lib/format";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TYPES: CalendarEvent["type"][] = ["Academic", "Exam", "Holiday", "Sports", "Cultural", "Meeting"];
const COLOR: Record<CalendarEvent["type"], string> = { Academic: "#2563eb", Exam: "#dc2626", Holiday: "#16a34a", Sports: "#ea580c", Cultural: "#9333ea", Meeting: "#0891b2" };
const covers = (e: CalendarEvent, d: string) => d >= e.date && d <= (e.endDate ?? e.date);

/* The month agenda is specialized markup: ops-ui Calendar is a fixed-width date picker, while this grid shows event
   chips per day, type filters and double-click creation. Dates are local calendar days; labels use the host language. */
export function CalendarPage() {
 const referenceT = useReferenceLocalization().t;

  const { fmtDate, fmtMonthYear, locale } = useFormat();
  const exporter = useSchoolExport();
  const { role } = useSession();
  const toast = useToast();
  const { data, error, reload, setData } = useApi<CalendarEvent[]>("/events?sort=date");
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [types, setTypes] = useState<Set<string>>(new Set(TYPES));
  const [day, setDay] = useState(isoDay(new Date()));
  const [adding, setAdding] = useState<string | null>(null);

  const cells = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const events = (data ?? []).filter((e) => types.has(e.type));
  const today = isoDay(new Date());
  const upcoming = events.filter((e) => (e.endDate ?? e.date) >= today).slice(0, 10);
  const dayEvents = events.filter((e) => covers(e, day));
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <CardGrid className="grid h-full min-h-[560px] gap-2.5 xl:grid-cols-12">
      <Card className="flex min-h-0 flex-col xl:col-span-9">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
          <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={() => shift(-1)} aria-label={referenceT("Previous month")} />
          <p className="w-36 text-center text-sm font-semibold">{fmtMonthYear(month)}</p>
          <Button size="sm" variant="ghost" icon={ChevronRight} onClick={() => shift(1)} aria-label={referenceT("Next month")} />
          <Button size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(today); }}><ReferenceText message="Today" /></Button>
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button type="button" key={t} aria-pressed={types.has(t)} onClick={() => setTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })}
                className={cn("flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition", types.has(t) ? "border-transparent text-white" : "border-line text-muted")} style={types.has(t) ? { background: COLOR[t] } : undefined}>{t}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" icon={Download} disabled={exporter.disabled} title={exporter.reason} onClick={() => exporter.exportCsv("school-calendar.csv", [["Title", "Type", "Start", "End", "Location"], ...events.map((e) => [e.title, e.type, e.date, e.endDate ?? e.date, e.location])])}><ReferenceText message="Export" /></Button>
            {role === "admin" && <Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => setAdding(day)}><ReferenceText message="Add event" /></Button>}
          </div>
        </div>
        {error && <div className="p-2"><ErrorNote message={error} onRetry={reload} /></div>}
        <div className="grid grid-cols-7 border-b border-line bg-subtle text-center text-[11px] font-semibold text-muted">{Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))).map((d) => <span key={d} className="py-1">{d}</span>)}</div>
        {!data ? <Skeleton className="m-2 flex-1" /> : (
          <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
            {cells.map((d) => {
              const iso = isoDay(d);
              const ev = events.filter((e) => covers(e, iso));
              const inMonth = d.getMonth() === month.getMonth();
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <button type="button" key={iso} aria-pressed={day === iso} aria-label={referenceT("{value0}, {value1} event{value2}", {value0: fmtDate(iso, { weekday: "long", day: "numeric", month: "long" }), value1: ev.length, value2: ev.length === 1 ? "" : "s"})} onClick={() => setDay(iso)} onDoubleClick={() => role === "admin" && setAdding(iso)}
                  className={cn("flex min-h-[74px] flex-col gap-0.5 overflow-hidden border-r border-b border-line/70 p-1 text-left transition hover:bg-brand/[0.04]", !inMonth && "bg-subtle/60 text-faint", weekend && inMonth && "bg-subtle/30", day === iso && "ring-2 ring-brand ring-inset")}>
                  <span className={cn("grid size-5 place-items-center rounded-full text-[11px] tabular", iso === today && "bg-brand font-semibold text-brand-fg")}>{d.getDate()}</span>
                  {ev.slice(0, 3).map((e) => (
                    <span key={e.id} className="truncate rounded px-1 text-[10.5px] leading-4 font-medium text-white" style={{ background: COLOR[e.type], opacity: inMonth ? 1 : 0.5 }} title={e.title}>{e.title}</span>
                  ))}
                  {ev.length > 3 && <span className="px-1 text-[10px] text-muted">+{ev.length - 3} <ReferenceText message="more" /></span>}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      <CardGrid className="grid min-h-0 content-start gap-2.5 xl:col-span-3">
        <Card>
          <CardHeader title={fmtDate(day, { weekday: "long", day: "numeric", month: "long" })} sub={referenceT("{value0} event{value1}", {value0: dayEvents.length, value1: dayEvents.length === 1 ? "" : "s"})} />
          <ul className="divide-y divide-line/70">
            {dayEvents.length === 0 && <li className="px-3 py-3 text-xs text-muted"><ReferenceText message="Nothing scheduled." /></li>}
            {dayEvents.map((e) => <EventRow key={e.id} e={e} />)}
          </ul>
        </Card>
        <Card>
          <CardHeader title={referenceT("Coming up")} />
          <ul className="divide-y divide-line/70">{upcoming.map((e) => <EventRow key={e.id} e={e} onClick={() => { const d = toDate(e.date); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setDay(e.date); }} />)}</ul>
        </Card>
      </CardGrid>
      {adding && <AddEvent date={adding} onClose={() => setAdding(null)} onCreated={(e) => { setData((d) => [...(d ?? []), e].sort((a, b) => a.date.localeCompare(b.date))); toast(referenceT("“{value0}” added to the calendar", { value0: e.title })); }} />}
    </CardGrid>
  );
}

function EventRow({ e, onClick }: { e: CalendarEvent; onClick?: () => void }) {
  const { fmtDate } = useFormat();
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-subtle">
        <span className="mt-1 h-7 w-1 shrink-0 rounded-full" style={{ background: COLOR[e.type] }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{e.title}</span>
          <span className="block text-[10.5px] text-muted">{fmtDate(e.date, { day: "2-digit", month: "short" })}{e.endDate && ` – ${fmtDate(e.endDate, { day: "2-digit", month: "short" })}`} · {e.type}</span>
          <span className="flex items-center gap-1 text-[10.5px] text-faint"><MapPin className="size-3" />{e.location}</span>
        </span>
      </button>
    </li>
  );
}

function AddEvent({ date, onClose, onCreated }: { date: string; onClose: () => void; onCreated: (e: CalendarEvent) => void }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const toast = useToast();
  const [f, setF] = useState({ title: "", type: "Academic", date, endDate: "", location: "" });
  const [busy, setBusy] = useState(false);
  const bad = f.endDate && f.endDate < f.date;
  const save = async () => {
    setBusy(true);
    try { const { data } = await api.post<{ data: CalendarEvent }>("/events", { ...f, endDate: f.endDate || undefined, location: f.location || "Main campus" }); onCreated(data); onClose(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={referenceT("Add calendar event")} footer={<><Button variant="ghost" onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant="primary" disabled={!f.title.trim() || !!bad} loading={busy} onClick={save}><ReferenceText message="Add event" /></Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("Title")} required className="col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label={referenceT("Type")}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label={referenceT("Location")}><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder={referenceT("Main campus")} /></Field>
        <Field label={referenceT("Starts")}><DateInput value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label={referenceT("Ends")} error={bad ? "Ends before it starts" : undefined} hint={referenceT("Optional, for multi-day events")}><DateInput value={f.endDate} min={f.date} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
