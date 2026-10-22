"use client";

import React from "react";
import { cn } from "./cn";

/** The shape both DropdownSelect and SearchSelect filter over. */
export interface FilterableOption { value: string; label: string; description?: string; disabled?: boolean }

/* Two `includes` rather than one over `label + " " + description`, which is
   what DropdownSelect used to do. Concatenating lets a query straddle the
   join -- "fin fi" matches "FIN" + "Finance" -- and the row then appears with
   nothing marked inside it, so the list looks like it filtered on nothing.
   Matching each field on its own makes "every row shown has a visible reason
   for being shown" true by construction rather than by luck. */
export function filterOptions<T extends FilterableOption>(options: T[], query: string): T[] {
  const term = query.trim().toLowerCase();
  if (!term) return options;
  return options.filter((option) => option.label.toLowerCase().includes(term) || (option.description ?? "").toLowerCase().includes(term));
}

/* Arrow keys skip disabled options. Landing on one parks the highlight where
   Enter does nothing, which reads as the keyboard having stopped working
   rather than as that one row being unavailable. Wraps in both directions,
   and returns -1 when every option is disabled so the caller can leave
   nothing active instead of pointing at a row that cannot be chosen. */
export function nextEnabledIndex(options: FilterableOption[], from: number, step: 1 | -1): number {
  const count = options.length;
  /* -1 means "nothing is active yet", a position rather than an index, so it
     has to be normalised before the arithmetic. Stepping back from a literal
     -1 lands on count-2 and silently skips the last option -- the row an
     upward arrow from nowhere is precisely meant to reach. */
  const origin = from < 0 ? (step === 1 ? -1 : count) : from;
  for (let hop = 1; hop <= count; hop += 1) {
    /* Two modulos: the first returns a negative for an upward wrap, and a
       negative index reads as `undefined`, ending the search early. */
    const at = (((origin + step * hop) % count) + count) % count;
    if (!options[at]!.disabled) return at;
  }
  return -1;
}

/* Marks the matched run inside a label, so the reason a row survived the
   filter is visible rather than inferred. `<mark>`'s browser default is a
   yellow none of the themes contain, so the background is replaced --
   with accent, not primary, because primary-soft is already the selected
   row's background and a mark in that same colour would vanish on exactly the
   row a user looks at first. A color-mix rather than the flat --accent-soft
   token: that token is near-white in the light themes and reads as nothing
   behind 10px type, while a fixed percentage of --accent lands at the same
   perceptual strength whatever the row sits on. Text colour stays --text --
   accent on its own soft tint measures about 2.3:1, under the floor for small
   type. */
export function Highlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const term = query.trim();
  const at = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className={cn("rounded-[3px] bg-[color-mix(in_srgb,var(--accent)_30%,transparent)] px-[1px] font-bold text-[var(--text)]", className)}>{text.slice(at, at + term.length)}</mark>
      {text.slice(at + term.length)}
    </>
  );
}
