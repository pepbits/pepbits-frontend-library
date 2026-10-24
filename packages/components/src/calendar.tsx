import React, { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@pepbits/icons";
import { cn } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

function iso(date: Date) { return date.toISOString().slice(0, 10); }
function parse(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && iso(date) === value ? date : null;
}
function add(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function monthStart(date: Date) { const next = new Date(date); next.setUTCDate(1); return next; }
function moveMonth(date: Date, offset: number) { const next = monthStart(date); next.setUTCMonth(next.getUTCMonth() + offset); return next; }

export interface CalendarProps {
  /** Date-only ISO values; never converted through the user's timezone. */
  value?: string;
  onChange: (value: string) => void;
  defaultMonth?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Override only when application regional settings differ from its language. */
  locale?: string;
  label: string;
  className?: string;
  renderDay?: (date: string) => React.ReactNode;
}

/** Inline Gregorian date picker. Event markers can be composed with renderDay;
 * appointments and persistence remain application concerns. */
export function Calendar({ value, onChange, defaultMonth, min, max, disabled, weekStartsOn = 1, locale, label, className, renderDay }: CalendarProps) {
  const { language, direction, t } = useLocalization();
  const calendarId=useId();
  const [month, setMonth] = useState(() => monthStart(parse(value) ?? parse(defaultMonth) ?? new Date()));
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const date = parse(value); if (date) setMonth(monthStart(date)); setFocusDate(null); }, [value]);
  useEffect(() => { if (focusDate) root.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus(); }, [focusDate, month]);
  const selectedLocale = locale ?? language;
  const title = new Intl.DateTimeFormat(selectedLocale, { month: "long", year: "numeric", timeZone: "UTC", calendar: "gregory" }).format(month);
  const fullDate = new Intl.DateTimeFormat(selectedLocale, { dateStyle: "full", timeZone: "UTC", calendar: "gregory" });
  const weekday = new Intl.DateTimeFormat(selectedLocale, { weekday: "narrow", timeZone: "UTC" });
  const weekdayName = new Intl.DateTimeFormat(selectedLocale, { weekday: "long", timeZone: "UTC" });
  const number = new Intl.NumberFormat(selectedLocale);
  const lower = parse(min) ? min : undefined;
  const upper = parse(max) ? max : undefined;
  const unavailable = (date: string) => Boolean(disabled || (lower && date < lower) || (upper && date > upper));
  const first = add(month, -((month.getUTCDay() - weekStartsOn + 7) % 7));
  const days = Array.from({ length: 42 }, (_, index) => add(first, index));
  const active = days.find(date => iso(date) === value && !unavailable(iso(date))) ?? days.find(date => date.getUTCMonth() === month.getUTCMonth() && !unavailable(iso(date)));
  function navigate(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    const offsets: Record<string, number> = { ArrowLeft: direction === "rtl" ? 1 : -1, ArrowRight: direction === "rtl" ? -1 : 1, ArrowUp: -7, ArrowDown: 7, Home: -((date.getUTCDay() - weekStartsOn + 7) % 7), End: 6 - ((date.getUTCDay() - weekStartsOn + 7) % 7) };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next = add(date, offsets[event.key]!);
    if (unavailable(iso(next))) return;
    setMonth(monthStart(next)); setFocusDate(iso(next));
  }
  return <div ref={root} dir={direction} role="group" aria-label={t(label)} className={cn("w-80 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3", className)}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <button type="button" className="focus-ring rounded p-2 disabled:opacity-40" aria-label={t("ui.previous.a57b08a4")} disabled={disabled || Boolean(lower && iso(add(month, -1)) < lower)} onClick={() => { setFocusDate(null); setMonth(moveMonth(month, -1)); }}><ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" /></button>
      <span aria-live="polite" className="font-bold">{title}</span>
      <button type="button" className="focus-ring rounded p-2 disabled:opacity-40" aria-label={t("ui.next.1ff57a29")} disabled={disabled || Boolean(upper && iso(moveMonth(month, 1)) > upper)} onClick={() => { setFocusDate(null); setMonth(moveMonth(month, 1)); }}><ChevronRight aria-hidden="true" className="size-4 rtl:rotate-180" /></button>
    </div>
    <Table className="w-full table-fixed text-center" aria-label={title}>
      <TableHeader><TableRow>{days.slice(0, 7).map(date => <TableHead key={iso(date)} scope="col" aria-label={weekdayName.format(date)} title={weekdayName.format(date)} className="py-2 text-xs text-[var(--text-muted)]">{weekday.format(date)}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{Array.from({ length: 6 }, (_, week) => <TableRow key={week}>{days.slice(week * 7, week * 7 + 7).map(date => {
        const key = iso(date);
        return <TableCell key={key}><button type="button" data-date={key} aria-label={renderDay?undefined:fullDate.format(date)} aria-labelledby={renderDay?`${calendarId}-${key}-content ${calendarId}-${key}-date`:undefined} aria-pressed={value === key} tabIndex={key === (focusDate ?? (active && iso(active))) ? 0 : -1} disabled={unavailable(key)} onKeyDown={event => navigate(event, date)} onClick={() => onChange(key)} className={cn("focus-ring min-h-9 w-full rounded text-sm disabled:opacity-30", date.getUTCMonth() !== month.getUTCMonth() && "text-[var(--text-subtle)]", value === key ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--surface-2)]")}><span id={`${calendarId}-${key}-content`}><span>{number.format(date.getUTCDate())}</span>{renderDay?.(key)}</span>{renderDay&&<span id={`${calendarId}-${key}-date`} className="sr-only">{fullDate.format(date)}</span>}</button></TableCell>;
      })}</TableRow>)}</TableBody>
    </Table>
  </div>;
}
