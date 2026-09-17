"use client";
import { LocalizedText, useLocalization } from "./localization";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "./cn";
import { Highlight, filterOptions, nextEnabledIndex, type FilterableOption } from "./option-filter";

export interface DropdownOption extends FilterableOption {
  icon?: React.ReactNode;
}

export function DropdownSelect({ value, options, onChange, label, hideLabel, compact, align = "left", className, triggerClassName, menuClassName, leading }: { value: string; options: DropdownOption[]; onChange: (value: string) => void; label?: string; hideLabel?: boolean; compact?: boolean; align?: "left" | "right"; className?: string; triggerClassName?: string; menuClassName?: string; leading?: React.ReactNode }) {
  const {t} = useLocalization();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0] ?? {value:"",label:"—"};

  const base = useId();
  const listId = `${base}-list`;
  const optionId = (index: number) => `${base}-option-${index}`;

  /* Description is searched too: a module's own name is its short code ("FIN"),
     and the thing a user actually types is in the description ("Finance"). */
  const matches = useMemo(() => filterOptions(options.map(option => ({...option, label: t(option.label), description: option.description ? t(option.description) : undefined})), query), [options, query, t]);

  /* Cleared on close, not on open: leaving it set means reopening shows a
     filtered list with no memory of why, which reads as options going missing. */
  useEffect(() => {
    if (!open) { setQuery(""); setActiveIndex(-1); return; }
    searchRef.current?.focus();
  }, [open]);

  /* Opening starts on the current selection so the first ArrowDown steps off
     what is already chosen, the way a native <select> behaves; typing re-homes
     to the first match so Enter is meaningful at every keystroke rather than
     only once the list is down to a single row. */
  useEffect(() => {
    if (!open) return;
    const from = query.trim() ? -1 : matches.findIndex((option) => option.value === value);
    setActiveIndex(from >= 0 && !matches[from]?.disabled ? from : nextEnabledIndex(matches, -1, 1));
  }, [open, query, matches, value]);

  /* Guarded because jsdom, where this is tested, has no scrollIntoView, and an
     unguarded call fails the test for a reason unrelated to the behaviour. */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
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

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button ref={triggerRef} type="button" aria-label={label ? t(label) : undefined} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((previous) => !previous)} onKeyDown={(event) => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); setOpen(true); } }} className={cn("focus-ring group flex h-[30px] items-center gap-2 rounded-[10px] border border-transparent px-2 text-left transition hover:border-[var(--border)] hover:bg-[var(--surface-2)]", compact ? "max-w-40" : "min-w-40", triggerClassName)}>
        {leading ?? selected.icon}
        {/* Label and value sit side by side, as Vantage's "Branch  Dubai HQ"
            does. Stacked, an 8px label over a 10px value needs ~27px of line
            boxes, which in a 30px button leaves the text touching the border.
            Inline, both fit on one line with room to spare. */}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          {/* hideLabel drops the TEXT, not the label -- it stays on the button
              as aria-label, so the control is still announced as "Branch"
              rather than as whichever place name happens to be selected. */}
          {label && !hideLabel ? <span className="shrink-0 text-[length:calc(9px*var(--fs-scale))] font-semibold text-[var(--text-subtle)]"><LocalizedText message={label} /></span> : null}
          <span className={cn("min-w-0 truncate font-bold text-[var(--text)]", label && !hideLabel ? "text-[length:calc(10.5px*var(--fs-scale))]" : "text-[length:calc(11px*var(--fs-scale))]")}><LocalizedText message={selected.label} /></span>
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-[var(--text-subtle)] transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className={cn("nex-scrollbar animate-slide-up absolute z-[80] mt-1.5 max-h-[min(70vh,420px)] min-w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-md)]", align === "right" ? "right-0" : "left-0", menuClassName)} ref={listRef}>
          {/* Sits INSIDE the menu, so the 30px trigger is untouched. */}
          <div className="relative mb-1 border-b border-[var(--border)] pb-1.5">
            <Search className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              ref={searchRef}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              /* Enter takes the ACTIVE row. This used to fire only when exactly
                 one match remained, which meant that between "two matches" and
                 "one match" the keyboard did nothing and the user had to reach
                 for the mouse -- for a two-branch tenant, always. */
              onKeyDown={(event) => {
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
                if (event.key === "Escape") { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); return; }
                if (event.key === "Tab") setOpen(false);
              }}
              placeholder={label ? `Search ${label.toLowerCase()}…` : "Search…"}
              aria-label={label ? `Search ${label.toLowerCase()}` : "Search options"}
              className="focus-ring h-7 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] ps-7 pe-2 text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text)] placeholder:font-normal placeholder:text-[var(--text-subtle)]"
            />
          </div>
          {/* Announced, not merely drawn: filtering is otherwise a purely
              visual event, and a screen-reader user typing here would get no
              signal that the list moved under them. */}
          <span role="status" className="sr-only">{matches.length === 0 ? <LocalizedText message="ui.no.matching.options.39a118fc" /> : <LocalizedText message={matches.length===1?"{count} option":"{count} options"} values={{count:matches.length}} />}</span>
          <div role="listbox" id={listId} aria-label={label ? t(label) : undefined}>
            {matches.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.no.match.for.2835c1cf" />{query.trim()}”</div>
            ) : null}
            {matches.map((option, index) => (
              <button key={option.value} id={optionId(index)} data-index={index} role="option" aria-selected={option.value === value} tabIndex={-1} type="button" disabled={option.disabled} onClick={() => commit(index)} onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition disabled:opacity-40", index === activeIndex && !option.disabled && "bg-[var(--surface-2)]", option.value === value && "bg-[var(--primary-soft)]")}>
                {option.icon ? <span className="text-[var(--text-muted)]">{option.icon}</span> : null}
                <span className="min-w-0 flex-1"><span className="block whitespace-nowrap text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text)]"><Highlight text={option.label} query={query} /></span>{option.description ? <span className="mt-0.5 block whitespace-nowrap text-[length:calc(8.5px*var(--fs-scale))] text-[var(--text-muted)]"><Highlight text={option.description} query={query} /></span> : null}</span>
                <Check className={cn("size-3.5 text-[var(--primary)]", option.value !== value && "opacity-0")} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ActionMenu({ trigger, children, align = "right", className }: { trigger: React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className={cn("relative", className)} ref={ref}>
      <div onClick={() => setOpen((previous) => !previous)}>{trigger}</div>
      {open ? <div className={cn("animate-slide-up absolute z-[90] mt-1.5 min-w-52 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-md)]", align === "right" ? "right-0" : "left-0")}>{children(() => setOpen(false))}</div> : null}
    </div>
  );
}

export function MenuButton({ icon, label, hint, tone = "default", onClick }: { icon?: React.ReactNode; label: string; hint?: string; tone?: "default" | "danger"; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)]", tone === "danger" && "text-[var(--danger-ink)]")}><span className="flex size-7 items-center justify-center rounded-lg bg-[var(--surface-2)]">{icon}</span><span className="min-w-0 flex-1"><span className="block text-[length:calc(11px*var(--fs-scale))] font-bold"><LocalizedText message={label} /></span>{hint ? <span className="block text-[length:calc(9px*var(--fs-scale))] text-[var(--text-subtle)]"><LocalizedText message={hint} /></span> : null}</span></button>;
}
