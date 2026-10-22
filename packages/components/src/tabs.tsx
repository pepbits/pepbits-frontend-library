"use client";
import { LocalizedText } from "@pepbits/i18n/react";

import React from "react";
import { cn } from "@pepbits/ui";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

/* `orientation` defaults to horizontal, so every existing call site renders
   byte-identically. Vertical turns the row into a column and moves the "line"
   variant's active bar from the bottom edge to the leading edge. */
export function Tabs({ items, value, onChange, variant = "line", orientation = "horizontal", className }: { items: TabItem[]; value: string; onChange: (value: string) => void; variant?: "line" | "pills" | "segmented"; orientation?: "horizontal" | "vertical"; className?: string }) {
  const vertical = orientation === "vertical";
  return (
    <div className={cn("flex min-w-0",
      vertical ? "flex-col items-stretch" : "items-center",
      variant === "line" && (vertical ? "gap-0 border-e border-[var(--border)]" : "gap-0 border-b border-[var(--border)]"),
      variant === "pills" && "gap-1",
      variant === "segmented" && (vertical ? "gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1" : "gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1"),
      className)} role="tablist" aria-orientation={orientation}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button key={item.id} type="button" role="tab" aria-selected={active} disabled={item.disabled} onClick={() => onChange(item.id)} className={cn(
            "focus-ring relative inline-flex h-9 shrink-0 items-center gap-2 px-3 text-[length:calc(11px*var(--fs-scale))] font-bold transition disabled:opacity-40",
            vertical && "w-full justify-start text-left",
            variant === "line" && (active ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"),
            variant === "pills" && "rounded-lg border border-transparent",
            variant === "pills" && (active ? "border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"),
            variant === "segmented" && "h-8 rounded-lg",
            variant === "segmented" && (active ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"),
          )}>
            {item.icon}<LocalizedText message={item.label} />{item.badge !== undefined ? <span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">{item.badge}</span> : null}
            {variant === "line" && active ? (
              vertical
                ? <span className="absolute inset-y-1 -end-px w-0.5 rounded-full bg-[var(--primary)]" />
                : <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--primary)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
