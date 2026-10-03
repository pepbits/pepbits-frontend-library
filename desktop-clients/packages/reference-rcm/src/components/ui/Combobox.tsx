"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { SourceButton, SourceInput } from "./controls";

export interface ComboItem { value: string; label: string; hint?: string; group?: string; muted?: boolean }

interface Props {
  items: ComboItem[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  loading?: boolean;
  id?: string;
  max?: number;
  /** When set, filtering happens on the server: called (debounced) with the typed text. */
  onSearch?: (q: string) => void;
  /** Labels for selected values that may not be in the current item list. */
  selectedLabels?: Record<string, string>;
  /** Accessible name: the field label sits on a div, which a <label for> cannot name. */
  label?: string;
}

/** Searchable single or multi select with keyboard support (the source's Combobox, same markup and classes). */
export function Combobox({ items, value, onChange, multiple, disabled, invalid, placeholder = "Choose…", loading, id, max, onSearch, selectedLabels, label }: Props) {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const byValue = useMemo(() => new Map(items.map((i) => [i.value, i])), [items]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (onSearch) return items;
    return s ? items.filter((i) => `${i.label} ${i.hint ?? ""} ${i.group ?? ""}`.toLowerCase().includes(s)) : items;
  }, [items, q, onSearch]);

  useEffect(() => {
    if (!onSearch || !open) return;
    const timer = setTimeout(() => onSearch(q.trim()), 220);
    return () => clearTimeout(timer);
  }, [q, open, onSearch]);

  const toggle = (v: string) => {
    if (!multiple) { onChange([v]); setOpen(false); setQ(""); return; }
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!max || value.length < max) onChange([...value, v]);
  };

  const selected = value.map((v) => byValue.get(v) ?? { value: v, label: selectedLabels?.[v] ?? `#${v}` });
  let lastGroup: string | undefined;

  return (
    <div ref={root} className="relative">
      <div
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={id ? `${id}-list` : undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => input.current?.focus(), 0); } }}
        onKeyDown={(e) => { if (!open && (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ")) { e.preventDefault(); setOpen(true); setTimeout(() => input.current?.focus(), 0); } }}
        className={cx(
          "input flex min-h-9 cursor-pointer flex-wrap items-center gap-1 py-1 pr-8",
          multiple && selected.length ? "h-auto" : "",
          invalid && "input-invalid",
          disabled && "cursor-not-allowed bg-mist text-muted",
        )}
      >
        {!multiple && (selected[0] ? <span className="truncate" title={selected[0].label}>{selected[0].label}</span> : <span className="text-slate-soft"><LocalizedText message={placeholder} /></span>)}
        {multiple && selected.length === 0 && <span className="text-slate-soft"><LocalizedText message={placeholder} /></span>}
        {multiple && selected.map((s) => (
          <span key={s.value} className="inline-flex max-w-full items-center gap-1 rounded-md bg-harbor-50 px-1.5 py-0.5 text-[12px] font-medium text-harbor-800">
            <span className="truncate">{s.label}</span>
            {!disabled && (
              <SourceButton className="rounded text-harbor-500 hover:text-madder-600" onClick={(e) => { e.stopPropagation(); toggle(s.value); }} aria-label={t("Remove {value0}", { value0: s.label })}>
                <X className="h-3 w-3" />
              </SourceButton>
            )}
          </span>
        ))}
        <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted" />
        {!multiple && selected[0] && !disabled && (
          <SourceButton className="absolute right-7 top-2.5 rounded text-muted hover:text-madder-600" onClick={(e) => { e.stopPropagation(); onChange([]); }} aria-label="Clear">
            <X className="h-4 w-4" />
          </SourceButton>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 animate-fade-in overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          <div className="border-b border-line p-2">
            <SourceInput
              ref={input}
              value={q}
              onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter") { e.preventDefault(); if (filtered[idx]) toggle(filtered[idx].value); }
                if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
              }}
              placeholder="Type to filter"
              className="input h-8"
              aria-label="Filter options"
            />
          </div>
          <ul id={id ? `${id}-list` : undefined} className="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable={multiple}>
            {loading && <li className="px-3 py-3 text-muted"><LocalizedText message="Loading…" /></li>}
            {!loading && filtered.length === 0 && <li className="px-3 py-3 text-muted"><LocalizedText message="Nothing matches." /></li>}
            {filtered.map((it, i) => {
              const head = it.group && it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              const on = value.includes(it.value);
              return (
                <li key={it.value}>
                  {head && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold text-muted">{head}</p>}
                  <SourceButton
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => setIdx(i)}
                    onClick={() => toggle(it.value)}
                    className={cx("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px]", i === idx && "bg-harbor-50", it.muted && "text-muted")}
                  >
                    <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded", multiple ? "border border-line" : "", on && "border-jade-600 bg-jade-600 text-white")}>
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.hint && <span className="shrink-0 text-[11px] text-muted">{it.hint}</span>}
                  </SourceButton>
                </li>
              );
            })}
          </ul>
          {multiple && (
            <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-[11.5px] text-muted">
              <span>{max ? t("{value0} selected of up to {value1}", { value0: value.length, value1: max }) : t("{value0} selected", { value0: value.length })}</span>
              {value.length > 0 && <SourceButton className="font-semibold text-harbor-700 hover:underline" onClick={() => onChange([])}><LocalizedText message="Clear all" /></SourceButton>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
