
import type { KeyboardEvent, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../cn";

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
  /** Extra content under the description, e.g. a price. */
  meta?: ReactNode;
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
  meta,
}: SelectTileProps) {
  /* A single-choice tile is a radio inside a RadioTileGroup; a multi-choice tile is a toggle button. */
  const semantics =
    kind === "single"
      ? { role: "radio" as const, "aria-checked": selected, "data-radio-tile": "true" }
      : { "aria-pressed": selected };
  return (
    <button
      id={id}
      type="button"
      {...semantics}
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
        {meta && <span className="mt-2 block">{meta}</span>}
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
  disabled,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  tag?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked ? "bg-scrub-50" : !disabled && "hover:bg-ink-50",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
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
/* RadioTileGroup: radiogroup semantics and arrow keys for single tiles */
/* ------------------------------------------------------------------ */

export function RadioTileGroup({
  id,
  label,
  labelledBy,
  invalid,
  className,
  children,
}: {
  id?: string;
  label?: string;
  labelledBy?: string;
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-radio-tile="true"]:not(:disabled)'));
    if (!radios.length) return;
    e.preventDefault();
    const current = radios.findIndex((r) => r === document.activeElement);
    const next = radios[(current + delta + radios.length) % radios.length]!;
    next.focus();
    next.click();
  }
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && id ? `${id}-error` : undefined}
      tabIndex={-1}
      data-invalid={invalid ? "true" : undefined}
      onKeyDown={onKeyDown}
      className={cn("focus:outline-none", className)}
    >
      {children}
    </div>
  );
}
