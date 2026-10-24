"use client";
import {LocalizedText,useLocalization} from "@pepbits/i18n/react";


import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "@pepbits/icons";
import { cn } from "./cn";
import { Highlight, filterOptions, nextEnabledIndex, type FilterableOption } from "./option-filter";

export interface SearchSelectOption extends FilterableOption { icon?: React.ReactNode }

/**
 * A single-choice field for lists too long to scan: type to filter, arrows to
 * move, Enter to commit.
 *
 * Deliberately NOT built on FieldShell, which every other field here uses.
 * FieldShell's root is a <label>, and a click anywhere inside a label is
 * forwarded by the browser to that label's control -- so picking an option
 * would fire the option's own click and then a second synthetic click on the
 * trigger, reopening the menu the user just closed. The label is a <span>
 * wired up with aria-labelledby instead, which announces identically and
 * forwards nothing.
 */
export function SearchSelect({ label, hint, error, required, className, options, value, onChange, placeholder = "Select…", searchPlaceholder, emptyMessage, disabled, name, quickPick = false }: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  name?: string;
  /** Fast keyboard entry: typing on the closed field opens the list with that
      text, and Tab after typing commits the highlighted match before moving on.
      Off by default, so Tab keeps its plain "leave without choosing" meaning. */
  quickPick?: boolean;
}) {
  const {t} = useLocalization();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const base = useId();
  const labelId = `${base}-label`;
  const listId = `${base}-list`;
  const optionId = (index: number) => `${base}-option-${index}`;

  const selected = options.find((option) => option.value === value);
  const matches = useMemo(() => filterOptions(options.map(option=>({...option,label:t(option.label),description:option.description?t(option.description):undefined})), query), [options, query, t]);

  /* Opening lands the highlight on the current selection rather than on row
     one, so the first ArrowDown steps off what is already chosen -- the
     behaviour a native <select> has. Typing then re-homes it to the best
     remaining match, which is what makes Enter mean something at every
     keystroke instead of only when the list is down to one row. */
  useEffect(() => {
    if (!open) { setQuery(""); setActiveIndex(-1); return; }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const from = query.trim() ? -1 : matches.findIndex((option) => option.value === value);
    setActiveIndex(from >= 0 && !matches[from]?.disabled ? from : nextEnabledIndex(matches, -1, 1));
  }, [open, query, matches, value]);

  /* scrollIntoView is absent in jsdom, where these components are tested, and
     an unguarded call there fails the test for a reason that has nothing to do
     with the behaviour under test. */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const commit = (index: number) => {
    const option = matches[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => nextEnabledIndex(matches, current, event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? nextEnabledIndex(matches, -1, 1) : nextEnabledIndex(matches, -1, -1));
      return;
    }
    if (event.key === "Enter") { event.preventDefault(); commit(activeIndex); return; }
    /* stopPropagation, or an open menu inside a Modal closes the modal too --
       one Escape, two things dismissed, and the user's half-filled form gone. */
    if (event.key === "Escape") { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); return; }
    if (event.key === "Tab") {
      const option = matches[activeIndex];
      if (quickPick && query.trim() && option && !option.disabled) onChange(option.value);
      // The search input unmounts when the menu closes. Anchor native Tab
      // traversal at the persistent trigger so focus reaches the next field.
      if (quickPick) triggerRef.current?.focus();
      setOpen(false);
    }
  };

  return (
    <div className={cn("block min-w-0", className)} ref={rootRef}>
      {label ? <span id={labelId} className="mb-1.5 flex items-center gap-1 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{t(label)}{required ? <span className="text-[var(--danger-ink)]">*</span> : null}</span> : null}
      <div className="relative">
        {/* A hidden input, so a SearchSelect inside a plain <form> submits like
            the <select> it replaces instead of silently contributing nothing. */}
        {name ? <input type="hidden" name={name} value={value} /> : null}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-labelledby={label ? `${labelId} ${base}-value` : undefined}
          aria-label={label ? undefined : t(selected?.label ?? placeholder)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          onClick={() => setOpen((previous) => !previous)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); return; }
            if (quickPick && !open && event.key.length === 1 && event.key.trim() && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); setQuery(event.key); setOpen(true); }
          }}
          className={cn("focus-ring flex h-9 w-full items-center gap-2 rounded-[10px] border bg-[var(--surface)] px-3 text-left shadow-[inset_0_1px_1px_rgba(15,23,42,.02)] transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--text-subtle)]", error ? "border-[var(--danger)]" : "border-[var(--border)]", open && "border-[var(--primary)]")}
        >
          {selected?.icon ? <span className="shrink-0 text-[var(--text-muted)]">{selected.icon}</span> : null}
          <span id={`${base}-value`} className={cn("min-w-0 flex-1 truncate text-[length:calc(12px*var(--fs-scale))] font-medium", selected ? "text-[var(--text)]" : "text-[var(--text-subtle)]")}>{t(selected?.label ?? placeholder)}</span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-[var(--text-muted)] transition", open && "rotate-180")} />
        </button>
        {open ? (
          <div className="nex-scrollbar animate-slide-up absolute left-0 z-[80] mt-1.5 max-h-[min(60vh,320px)] w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-md)]" ref={listRef}>
            <div className="relative mb-1 border-b border-[var(--border)] pb-1.5">
              <Search className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-[var(--text-subtle)]" />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                aria-label={label ? t("Search {label}", {label:t(label)}) : t("Search options")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder ? t(searchPlaceholder) : label ? t("Search {label}…", {label:t(label)}) : t("Search…")}
                className="focus-ring h-7 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] ps-7 pe-2 text-[length:calc(11px*var(--fs-scale))] font-semibold text-[var(--text)] placeholder:font-normal placeholder:text-[var(--text-subtle)]"
              />
            </div>
            {/* The count is announced, not just drawn: filtering is otherwise a
                purely visual event, and a screen-reader user typing into this
                box would get no signal that the list moved under them. */}
            <span role="status" className="sr-only">{matches.length === 0 ? <LocalizedText message="ui.no.matching.options.39a118fc" /> : <LocalizedText message={matches.length===1?"{count} option":"{count} options"} values={{count:matches.length}} />}</span>
            <div role="listbox" id={listId} aria-labelledby={label ? labelId : undefined}>
              {matches.length === 0 ? (
                <div className="px-2.5 py-3 text-center text-[length:calc(10px*var(--fs-scale))] text-[var(--text-muted)]">{emptyMessage ? t(emptyMessage) : t("No match for “{query}”",{query:query.trim()})}</div>
              ) : null}
              {matches.map((option, index) => (
                <div
                  key={option.value}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  /* onMouseDown, not onClick: the pointer press blurs the
                     search input first, and a blur handler that closed the menu
                     would take the row out from under the release. */
                  onMouseDown={(event) => { event.preventDefault(); commit(index); }}
                  onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
                  className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition", option.disabled && "cursor-not-allowed opacity-40", index === activeIndex && !option.disabled && "bg-[var(--surface-2)]", option.value === value && "bg-[var(--primary-soft)]")}
                >
                  {option.icon ? <span className="shrink-0 text-[var(--text-muted)]">{option.icon}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text)]"><Highlight text={option.label} query={query} /></span>
                    {option.description ? <span className="mt-0.5 block truncate text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]"><Highlight text={option.description} query={query} /></span> : null}
                  </span>
                  <Check className={cn("size-3.5 shrink-0 text-[var(--primary)]", option.value !== value && "opacity-0")} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <span className="mt-1 block text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</span> : hint ? <span className="mt-1 block text-[length:calc(10px*var(--fs-scale))] text-[var(--text-subtle)]">{t(hint)}</span> : null}
    </div>
  );
}
