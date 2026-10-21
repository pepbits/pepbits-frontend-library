"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* SelectTile: large toggle with icon, title, description               */
/* ------------------------------------------------------------------ */

interface SelectTileProps {
  selected: boolean;
  onToggle: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  /** "single" shows a radio dot, "multi" a checkbox */
  kind?: "single" | "multi";
  size?: "md" | "sm";
  invalid?: boolean;
  className?: string;
  id?: string;
}

export function SelectTile({
  selected,
  onToggle,
  title,
  description,
  icon,
  kind = "multi",
  size = "md",
  invalid,
  className,
  id,
}: SelectTileProps) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-2xl border bg-white text-left",
        "transition-[border-color,background-color,box-shadow] duration-150",
        size === "md" ? "p-4" : "p-3",
        selected
          ? "border-scrub-600 bg-scrub-50/60 shadow-[0_0_0_1px_#0D6B63]"
          : invalid
            ? "border-signal/50 hover:border-signal/70"
            : "border-ink-200 hover:border-ink-300 hover:bg-ink-50/40",
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150",
            size === "md" ? "h-10 w-10" : "h-9 w-9",
            selected ? "bg-scrub-700 text-white" : "bg-ink-50 text-ink-600 group-hover:bg-ink-100",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 pr-6">
        <span className={cn("block font-semibold leading-snug text-ink-900", size === "sm" && "text-[0.92rem]")}>
          {title}
        </span>
        {description && (
          <span className={cn("mt-0.5 block leading-snug text-ink-500", size === "md" ? "text-sm" : "text-[0.8rem]")}>
            {description}
          </span>
        )}
      </span>
      <Indicator selected={selected} kind={kind} />
    </button>
  );
}

function Indicator({ selected, kind }: { selected: boolean; kind: "single" | "multi" }) {
  if (kind === "single")
    return (
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-3.5 top-3.5 grid h-5 w-5 place-items-center rounded-full border-2 transition-colors",
          selected ? "border-scrub-700" : "border-ink-300",
        )}
      >
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full bg-scrub-700 transition-transform duration-150",
            selected ? "scale-100" : "scale-0",
          )}
        />
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute right-3.5 top-3.5 grid h-5 w-5 place-items-center rounded-md border transition-colors",
        selected ? "border-scrub-700 bg-scrub-700 text-white" : "border-ink-300 bg-white",
      )}
    >
      <Check
        className={cn("h-3.5 w-3.5 transition-transform duration-150", selected ? "scale-100" : "scale-0")}
        strokeWidth={3}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ToggleChip: compact pill; the check slides in when selected          */
/* ------------------------------------------------------------------ */

export function ToggleChip({
  selected,
  onToggle,
  children,
  tag,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  tag?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-150",
        selected
          ? "border-scrub-700 bg-scrub-700 text-white"
          : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:text-ink-900",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center overflow-hidden transition-[width,margin,opacity] duration-150",
          selected ? "mr-1.5 w-3.5 opacity-100" : "mr-0 w-0 opacity-0",
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      {children}
      {tag && (
        <span
          className={cn(
            "ml-2 rounded-full px-1.5 py-px text-[0.68rem] font-semibold",
            selected ? "bg-white/15 text-white" : "bg-scrub-50 text-scrub-700",
          )}
        >
          {tag}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* CheckRow: native checkbox with custom visual                         */
/* ------------------------------------------------------------------ */

export function CheckRow({
  id,
  checked,
  onChange,
  label,
  description,
  tag,
  invalid,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  tag?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150",
        checked ? "bg-scrub-50" : "hover:bg-ink-50",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-scrub-500 peer-focus-visible:ring-offset-2",
          checked
            ? "border-scrub-700 bg-scrub-700 text-white"
            : invalid
              ? "border-signal bg-white"
              : "border-ink-300 bg-white",
        )}
      >
        <Check
          className={cn("h-3.5 w-3.5 transition-transform duration-150", checked ? "scale-100" : "scale-0")}
          strokeWidth={3}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-[0.92rem] font-medium leading-snug text-ink-900">
          <span>{label}</span>
          {tag && (
            <span className="rounded-full bg-scrub-100 px-1.5 py-px text-[0.68rem] font-semibold text-scrub-800">
              {tag}
            </span>
          )}
        </span>
        {description && <span className="mt-0.5 block text-[0.8rem] leading-snug text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control with sliding indicator and arrow-key support      */
/* ------------------------------------------------------------------ */

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
  id,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
  size?: "sm" | "md";
  id?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative grid rounded-xl bg-ink-100/80 p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(15,36,48,0.08),0_2px_8px_-2px_rgba(15,36,48,0.12)] transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-[1] flex items-center justify-center gap-1.5 rounded-[10px] px-3 font-medium transition-colors duration-150",
              size === "md" ? "h-9 text-sm" : "h-8 text-[0.8rem]",
              active ? "text-ink-900" : "text-ink-500 hover:text-ink-800",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
