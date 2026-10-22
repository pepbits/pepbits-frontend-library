"use client";
import { LocalizedText } from "@pepbits/i18n/react";


import React, { useEffect, useId, useRef, useState } from "react";
import { cn } from "@pepbits/ui";

/**
 * Edit one value in place.
 *
 * For small safe changes — a credit limit, a status, a due date — not for
 * anything a form exists to do. The three things that make an inline editor
 * either useful or dangerous are all answered here rather than left to callers:
 *
 * WHERE THE ERROR GOES. A table cell has no room for a message under it, which
 * is the reason inline editing usually ships without validation. This stays in
 * edit mode and puts the message beside the field, so a rejected value is never
 * silently discarded.
 *
 * WHEN IT WRITES. Enter and blur commit, Escape cancels — what every grid
 * anyone has used already does. An unchanged value writes NOTHING: a save that
 * bumps a version and lands in the audit log because someone tabbed through a
 * cell is noise in both, and a conflict for whoever else holds that version.
 *
 * WHAT HAPPENS WHEN TWO PEOPLE EDIT ONE CELL. `onCommit` may reject, which is
 * how the framework's §20 answer arrives: the server refuses a write against a
 * stale version and the reason comes back here. The typed value stays on screen
 * so it can be retried or copied out — an edit that vanishes because someone
 * else was faster is the failure this has to avoid.
 */
/* The text input the editor has always used, as the default control. */
const defaultControl: NonNullable<Parameters<typeof InlineEdit>[0]["control"]> = ({ ref, label, value, invalid, disabled, describedBy, onChange, onKeyDown, onBlur, className }) => (
  <input
    ref={ref as React.RefObject<HTMLInputElement>}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.target.value)}
    onKeyDown={onKeyDown}
    onBlur={onBlur}
    className={className}
  />
);

export function InlineEdit({ label, value, display, onCommit, validate, disabled, className, inputMode, control, commitOnChange }: {
  /** Names the cell for a screen reader — "Credit limit", not "50,000". */
  label: string;
  /** The raw value, as it should appear in the input. */
  value: string;
  /** How it reads when not being edited. Defaults to the raw value. */
  display?: React.ReactNode;
  /** May be async, and may reject with the reason a write was refused. */
  onCommit: (next: string) => void | Promise<void>;
  /** Returns a message to show, or null to accept. Runs before any write. */
  validate?: (next: string) => string | null;
  disabled?: boolean;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /**
   * The control to edit with. Defaults to a text input.
   *
   * A render prop rather than a `type` discriminator with a dozen companion
   * props: a number needs min/max/step, a select needs options, a date needs a
   * window, and folding all of that into one signature is the prop-heavy
   * component the roadmap says to avoid. The state machine — open, commit,
   * cancel, validate, save, reject — stays here and is written once.
   */
  control?: (props: {
    ref: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
    /* Passed through, because a control with no accessible name is a field a
       screen reader announces as "edit text" — and in a table of two hundred
       cells that is the same as unlabelled. */
    label: string;
    value: string;
    invalid: boolean;
    disabled: boolean;
    describedBy?: string;
    onChange: (next: string) => void;
    onKeyDown: (event: React.KeyboardEvent) => void;
    onBlur: () => void;
    className: string;
  }) => React.ReactNode;
  /** Choosing IS the commit — for a select there is nothing more to type. */
  commitOnChange?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const base = useId();
  const problemId = `${base}-problem`;

  /* focus THEN select. select() alone leaves the caret wherever it was, so
     clicking a cell opened an editor the keyboard could not reach — Enter went
     to the document and nothing happened. Found by breaking the unchanged-value
     rule and watching its test stay green: it had never got as far as a
     commit. */
  useEffect(() => {
    if (!editing) return;
    const control = inputRef.current;
    control?.focus();
    /* Only a text control has text to select. A <select> has no such method,
       and calling it blindly threw before the field could be used at all. */
    if (control instanceof HTMLInputElement) control.select();
  }, [editing]);

  const open = () => { setDraft(value); setProblem(null); setEditing(true); };
  const cancel = () => { setEditing(false); setProblem(null); setDraft(value); };

  const commitValue = async (next: string) => {
    /* Nothing changed, so nothing is written. Closing quietly is the whole
       behaviour — there is no edit to save and no conflict to risk. */
    if (next === value) { cancel(); return; }
    const rejected = validate?.(next) ?? null;
    if (rejected) { setProblem(rejected); inputRef.current?.focus(); return; }
    setSaving(true);
    setProblem(null);
    try {
      await onCommit(next);
      setEditing(false);
    } catch (error) {
      /* Still editing, still holding what was typed. */
      setProblem(error instanceof Error ? error.message : "That change could not be saved.");
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const commit = () => commitValue(draft);

  if (disabled) return <span className={cn("block truncate", className)}>{display ?? value}</span>;

  if (!editing) {
    return (
      <button
        type="button"
        /* The value is the content; the label is what it IS. Without both, a
           screen reader in a wide table reads two hundred numbers and no
           column names. */
        aria-label={`${label}: ${typeof display === "string" ? display : value}`}
        onClick={open}
        onKeyDown={(event) => { if (event.key === "F2") { event.preventDefault(); open(); } }}
        className={cn("focus-ring -mx-1 flex w-full min-w-0 items-center gap-1 rounded-md px-1 text-left transition hover:bg-[var(--surface-3)]", className)}
      >
        <span className="min-w-0 flex-1 truncate">{display ?? value}</span>
      </button>
    );
  }

  return (
    <span className={cn("relative -mx-1 flex min-w-0 items-center gap-1", className)}>
      {(control ?? defaultControl)({
        ref: inputRef,
        label,
        value: draft,
        invalid: problem !== null,
        disabled: saving,
        describedBy: problem ? problemId : undefined,
        onChange: (next) => {
          setDraft(next);
          /* Choosing is the commit. Waiting for Enter after picking from a list
             is a step that exists only because the text editor needed one. */
          if (commitOnChange) void commitValue(next);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter") { event.preventDefault(); void commit(); }
          /* stopPropagation, or Escape closes the drawer or modal the table is
             sitting in and takes the rest of the row's edits with it. */
          else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
        },
        onBlur: () => { if (!saving && !commitOnChange) void commit(); },
        className: cn(
          "focus-ring h-6 w-full min-w-0 rounded-md border bg-[var(--surface)] px-1 text-[length:inherit] font-[inherit] text-[var(--text)] outline-none",
          problem ? "border-[var(--danger)]" : "border-[var(--primary)]",
        ),
      })}
      {saving ? <span role="status" className="sr-only"><LocalizedText message="ui.saving.8d3085ef" />{label}</span> : null}
      {problem ? (
        /* Above the cell rather than inside it. A table row cannot grow to fit
           a message without shifting every row below it, and a message that
           moves the thing you are pointing at is worse than none. */
        <span
          id={problemId}
          role="alert"
          className="absolute left-0 top-full z-[70] mt-1 w-max max-w-64 rounded-md border border-[var(--danger)] bg-[var(--surface)] px-2 py-1 text-[length:calc(9.5px*var(--fs-scale))] font-semibold text-[var(--danger-ink)] shadow-[var(--shadow-md)]"
        >
          {problem}
        </span>
      ) : null}
    </span>
  );
}

/* ---- typed editors ------------------------------------------------------ *
 *
 * Each is a thin wrapper: the control it needs, the validation that belongs to
 * its type, and nothing else. The state machine above is written once.
 *
 * They exist because a text box holding digits is not a number field — no
 * numeric keyboard on a phone, no spinner, no step keys — and a text box for a
 * fixed set invites values the system will refuse at the server.
 * ------------------------------------------------------------------------- */

export function InlineEditNumber({ label, value, display, onCommit, validate, min, max, step, disabled, className }: {
  label: string;
  value: number;
  display?: React.ReactNode;
  onCommit: (next: number) => void | Promise<void>;
  /** Runs after the bounds, on the parsed number. */
  validate?: (next: number) => string | null;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <InlineEdit
      label={label}
      value={String(value)}
      display={display ?? String(value)}
      disabled={disabled}
      className={className}
      /* Bounds first, then the caller's rule. A credit limit of -5 or 10^12 is
         a data-entry slip, and catching it here is cheaper than a round trip
         that comes back 422. */
      validate={(next) => {
        const parsed = Number(next.replace(/[\s,]/g, ""));
        if (next.trim() === "" || !Number.isFinite(parsed)) return `${label} must be a number.`;
        if (min !== undefined && parsed < min) return `${label} cannot be below ${min}.`;
        if (max !== undefined && parsed > max) return `${label} cannot be above ${max}.`;
        return validate?.(parsed) ?? null;
      }}
      onCommit={(next) => onCommit(Number(next.replace(/[\s,]/g, "")))}
      control={({ ref, value: draft, invalid, disabled: busy, describedBy, onChange, onKeyDown, onBlur, className: controlClass }) => (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="number"
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          min={min}
          max={max}
          step={step}
          value={draft}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={cn(controlClass, "tabular-nums")}
        />
      )}
    />
  );
}

export function InlineEditSelect({ label, value, options, onCommit, disabled, className }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (next: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <InlineEdit
      label={label}
      value={value}
      /* The LABEL when idle, the VALUE when committing. Showing the value —
         "normal" rather than "Normal" — is the small leak of internals §6 is
         about, in a place nobody thinks to look. */
      display={options.find((option) => option.value === value)?.label ?? value}
      disabled={disabled}
      className={className}
      commitOnChange
      onCommit={onCommit}
      control={({ ref, value: draft, invalid, disabled: busy, describedBy, onChange, onKeyDown, onBlur, className: controlClass }) => (
        <select
          ref={ref as React.RefObject<HTMLSelectElement>}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={draft}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={controlClass}
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
    />
  );
}

export function InlineEditDate({ label, value, display, onCommit, validate, min, max, disabled, className }: {
  label: string;
  /** ISO, `YYYY-MM-DD`. What `<input type="date">` speaks. */
  value: string;
  display?: React.ReactNode;
  onCommit: (next: string) => void | Promise<void>;
  validate?: (next: string) => string | null;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <InlineEdit
      label={label}
      value={value}
      display={display ?? value}
      disabled={disabled}
      className={className}
      validate={(next) => {
        if (!next.trim()) return `${label} cannot be empty.`;
        if (Number.isNaN(Date.parse(next))) return `${label} is not a date.`;
        /* Compared as ISO strings, which sort correctly and avoid the timezone
           question a Date comparison would raise for a date with no time. */
        if (min && next < min) return `${label} cannot be before ${min}.`;
        if (max && next > max) return `${label} cannot be after ${max}.`;
        return validate?.(next) ?? null;
      }}
      onCommit={onCommit}
      control={({ ref, value: draft, invalid, disabled: busy, describedBy, onChange, onKeyDown, onBlur, className: controlClass }) => (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          type="date"
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          min={min}
          max={max}
          value={draft}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={controlClass}
        />
      )}
    />
  );
}

/**
 * A status, edited in place.
 *
 * The one field on this list that usually has a workflow behind it, so it takes
 * an optional transition map. Offering every value and letting the server
 * refuse is a worse experience than not offering what cannot happen — and a
 * status with nowhere to go is not editable at all rather than editable into
 * one option, itself.
 */
export function InlineEditStatus({ label, value, options, onCommit, allowedTransitions, disabled, className }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (next: string) => void | Promise<void>;
  /** From each status, what it may become. Omitted means anything. */
  allowedTransitions?: Record<string, string[]>;
  disabled?: boolean;
  className?: string;
}) {
  const reachable = allowedTransitions
    ? options.filter((option) => option.value === value || (allowedTransitions[value] ?? []).includes(option.value))
    : options;
  const stuck = reachable.length <= 1;

  return (
    <InlineEditSelect
      label={label}
      value={value}
      options={reachable}
      onCommit={onCommit}
      disabled={disabled || stuck}
      className={className}
    />
  );
}
