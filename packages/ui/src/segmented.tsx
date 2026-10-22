"use client";

import {useLocalization} from "@pepbits/i18n/react";
import React, { useRef } from "react";
import { cn } from "./cn";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /** Draw the icon alone. The label still names it for a screen reader. */
  iconOnly?: boolean;
  disabled?: boolean;
}

/**
 * One row, one choice.
 *
 * A RADIOGROUP, not a tablist, and the distinction is why this exists beside
 * `Tabs`: a tab switches which panel you are looking at, and this picks a
 * value. Announcing a value picker as a tablist tells a screen-reader user to
 * expect panels that are not there. Worth stating because the codebase this was
 * modelled on has five of these and they disagree about which one they are.
 *
 * For two to four options. Past that the labels stop fitting and a dropdown is
 * the honest control — every option here is on screen at once, which is the
 * whole advantage and the whole limit.
 */
export function Segmented({ label, options, value, onChange, size = "md", className }: {
  /** Names the group. Required — "Table / Cards" says nothing about what is being chosen. */
  label: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const {t} = useLocalization();
  const groupRef = useRef<HTMLDivElement>(null);

  /* Arrow keys move the choice and wrap, which is the radio-group pattern —
     the selection follows focus here because every option is visible and
     choosing is free. */
  const step = (direction: 1 | -1) => {
    const usable = options.filter((option) => !option.disabled);
    if (usable.length === 0) return;
    const at = usable.findIndex((option) => option.value === value);
    const next = usable[(((at < 0 ? 0 : at) + direction) % usable.length + usable.length) % usable.length]!;
    onChange(next.value);
    /* Focus follows, or the next arrow press starts from wherever the DOM had
       focus rather than from what is selected. */
    requestAnimationFrame(() => {
      groupRef.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
    });
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={t(label)}
      className={cn("inline-flex shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-0.5", className)}
    >
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={chosen}
            aria-label={option.iconOnly ? t(option.label) : undefined}
            disabled={option.disabled}
            /* One tab stop for the group: only the chosen option is reachable
               by Tab, and arrows move within. Three options costing three tab
               presses to step over makes a toolbar of these unusable. */
            tabIndex={chosen || (!options.some(o => o.value === value && !o.disabled) && options.find(o => !o.disabled)?.value === option.value) ? 0 : -1}
            onClick={() => { if (!chosen && !option.disabled) onChange(option.value); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); step(1); }
              else if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); step(-1); }
            }}
            className={cn(
              "focus-ring flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius)] font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "h-6 px-2 text-[length:calc(9.5px*var(--fs-scale))]" : "h-7 px-2.5 text-[length:calc(10.5px*var(--fs-scale))]",
              chosen ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-sm)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {option.icon}
            {option.iconOnly ? null : <span className="truncate">{t(option.label)}</span>}
          </button>
        );
      })}
    </div>
  );
}
