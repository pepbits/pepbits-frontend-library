"use client";

import { ArrowUp, Plus, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import type { ComplaintEntry, DurationUnit } from "../../lib/types";
import { cx } from "../../lib/utils";
import type { Complaint } from "../../lib/master";
import { SourceButton, SourceInput, SourceSelect } from "../controls";
import { useMaster } from "../../lib/master";
import { useStore } from "../../lib/store";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

/**
 * The backend's "Other" complaint: its code is part of the complaint master contract (free wording sent with it). It is the only
 * complaint code this module knows by name.
 */
const OTHER_CODE = "CC-OTH";

/**
 * The complaints offered as one-tap chips: the ones this scope's own encounters record most often (ties keep the backend's
 * master order). The source listed nine seed codes; which complaints are frequent is data, so it is read from the records.
 */
export function frequentComplaints(complaints: Complaint[], encounters: Array<{ complaints?: ComplaintEntry[] }>, limit = 9): Complaint[] {
  const counts = new Map<string, number>();
  for (const e of encounters) for (const c of e.complaints ?? []) counts.set(c.code, (counts.get(c.code) ?? 0) + 1);
  return complaints
    .map((c, order) => ({ c, order, n: counts.get(c.code) ?? 0 }))
    .filter((x) => x.c.code !== OTHER_CODE)
    .sort((a, b) => b.n - a.n || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.c);
}
const UNITS: DurationUnit[] = ["hours", "days", "weeks", "months"];

/**
 * Picks coded presenting complaints. The first one is the chief complaint.
 * Anything not in the list can be added as "Other" with the typed wording.
 */
export function ComplaintPicker({
  value,
  onChange,
  invalid,
  max = 6,
}: {
  value: ComplaintEntry[];
  onChange: (v: ComplaintEntry[]) => void;
  invalid?: boolean;
  max?: number;
}) {
  const { COMPLAINTS } = useMaster();
  const { encounters } = useStore();
  const frequent = useMemo(() => frequentComplaints(COMPLAINTS, encounters), [COMPLAINTS, encounters]);
  const { t: tr } = useLocalization();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listId = useId();

  const chosen = new Set(value.map((v) => v.code));
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pool = COMPLAINTS.filter((c) => c.code !== OTHER_CODE && !chosen.has(c.code));
    if (!t) return frequent.filter((c) => !chosen.has(c.code));
    return pool
      .filter((c) => c.label.toLowerCase().includes(t) || c.category.toLowerCase().includes(t))
      .sort((a, b) => Number(!a.label.toLowerCase().startsWith(t)) - Number(!b.label.toLowerCase().startsWith(t)))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, value, frequent]);
  const canAddOther = q.trim().length >= 3 && !results.some((r) => r.label.toLowerCase() === q.trim().toLowerCase());
  const options: Array<{ kind: "c"; c: Complaint } | { kind: "other" }> = [
    ...results.map((c) => ({ kind: "c" as const, c })),
    ...(canAddOther ? [{ kind: "other" as const }] : []),
  ];
  const full = value.length >= max;

  const add = (entry: ComplaintEntry) => {
    if (full) return;
    onChange([...value, entry]);
    setQ("");
    setActive(0);
    setOpen(false); // reopens on typing, click or arrow down, so it does not cover the fields below
    inputRef.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (!o) return;
    add(o.kind === "c" ? { code: o.c.code, label: o.c.label } : { code: OTHER_CODE, label: q.trim() });
  };
  const update = (i: number, patch: Partial<ComplaintEntry>) => onChange(value.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((v, i) => (
            <li key={`${v.code}-${v.label}`} className={cx("flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5", i === 0 ? "border-scrub-300 bg-scrub-50" : "border-line")}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {i === 0 && <span className="rounded bg-scrub-700 px-1.5 py-px text-[10.5px] font-bold text-white"><LocalizedText message="Chief" /></span>}
                  <span className="truncate text-[13.5px] font-semibold"><LocalizedText message={v.label ?? ""} /></span>
                  {v.code === OTHER_CODE && <span className="text-[11.5px] text-ink-faint"><LocalizedText message="other" /></span>}
                </span>
              </span>
              <span className="flex items-center gap-1 text-[12.5px] text-ink-soft">
                <LocalizedText message="for" /><SourceInput
                  type="number"
                  min={1}
                  max={999}
                  aria-label={tr("How long, {value0}", { value0: tr(v.label ?? "") })}
                  value={v.duration ?? ""}
                  onChange={(e) => update(i, { duration: e.target.value ? Math.max(1, Number(e.target.value)) : undefined, unit: v.unit ?? "days" })}
                  className="h-8 w-14 rounded-md border border-line bg-paper px-2 text-[13px] outline-none focus:border-scrub-500"
                />
                <SourceSelect
                  aria-label={tr("Unit, {value0}", { value0: tr(v.label ?? "") })}
                  value={v.unit ?? "days"}
                  onChange={(e) => update(i, { unit: e.target.value as DurationUnit })}
                  className="h-8 rounded-md border border-line bg-paper px-1.5 text-[13px] outline-none focus:border-scrub-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      <LocalizedText message={u} />
                    </option>
                  ))}
                </SourceSelect>
              </span>
              {i > 0 && (
                <SourceButton
                  onClick={() => onChange([v, ...value.filter((_, j) => j !== i)])}
                  className="grid size-7 place-items-center rounded-md text-ink-faint hover:bg-paper hover:text-scrub-700"
                  title="Make this the chief complaint"
                  aria-label={tr("Make {value0} the chief complaint", { value0: tr(v.label ?? "") })}
                >
                  <ArrowUp className="size-3.5" />
                </SourceButton>
              )}
              <SourceButton
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="grid size-7 place-items-center rounded-md text-ink-faint hover:bg-rose-50 hover:text-rose-700"
                aria-label={tr("Remove {value0}", { value0: tr(v.label ?? "") })}
              >
                <X className="size-3.5" />
              </SourceButton>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <div className={cx("flex h-10 items-center gap-2 rounded-lg border bg-paper px-3 focus-within:border-scrub-500 focus-within:ring-2 focus-within:ring-scrub-100", invalid ? "border-rose-400" : "border-line")}>
            <Search className="size-4 shrink-0 text-ink-faint" />
            <SourceInput
              ref={inputRef}
              role="combobox"
              aria-expanded={open && options.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              value={q}
              onChange={(e) => (setQ(e.target.value), setOpen(true), setActive(0))}
              onFocus={() => (clearTimeout(blurTimer.current), setOpen(true))}
              onClick={() => setOpen(true)}
              onBlur={() => (blurTimer.current = setTimeout(() => setOpen(false), 120))}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), setOpen(true), setActive((a) => Math.min(a + 1, options.length - 1)));
                if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
                if (e.key === "Enter" && options.length && (open || q.trim())) (e.preventDefault(), pick(active));
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder={value.length ? tr("Add another complaint") : tr("Search complaints, e.g. chest pain, fever, fall")}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>
          {open && options.length > 0 && (
            <ul id={listId} role="listbox" className="animate-rise absolute top-full right-0 left-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl bg-paper p-1 shadow-pop ring-1 ring-line">
              {!q.trim() && <li className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-semibold text-ink-faint"><LocalizedText message="Frequent at this desk" /></li>}
              {options.map((o, i) => (
                <li key={o.kind === "c" ? o.c.code : "other"} role="option" aria-selected={i === active}>
                  <SourceButton
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(i)}
                    className={cx("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left", i === active && "bg-scrub-50")}
                  >
                    {o.kind === "c" ? (
                      <>
                        <span className="flex-1 text-[13.5px] font-medium"><LocalizedText message={o.c.label ?? ""} /></span>
                        <span className="text-[11.5px] text-ink-faint">{o.c.category}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="size-4 text-scrub-600" />
                        <span className="flex-1 text-[13.5px]">
                          <LocalizedText message="Add" />{" "}<b>{q.trim()}</b> {" "}<LocalizedText message="as another complaint" /></span>
                      </>
                    )}
                  </SourceButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {value.length === 0 && (
        <div className="flex flex-wrap gap-1">
          {frequent
            .slice(0, 7)
            .map((c) => (
              <SourceButton key={c.code} onClick={() => add({ code: c.code, label: c.label })} className="rounded-full bg-canvas px-2.5 py-1 text-[12px] text-ink-soft hover:bg-scrub-50 hover:text-scrub-800">
                <LocalizedText message={c.label ?? ""} />
              </SourceButton>
            ))}
        </div>
      )}
    </div>
  );
}
