"use client";
import { LocalizedText } from "@pepbits/i18n/react";

import { useLocalization } from "@pepbits/i18n/react";
import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "@pepbits/icons";
import { Button } from "./button";
import { cn } from "./cn";

/** Structurally identical to erp-config's Option. Declared locally so ops-ui
    depends on nothing and stays a generic interaction surface. */
function useControlCopy<T extends {placeholder?:string;'aria-label'?:string}>(props:T):T {
 const {t}=useLocalization();return {...props,...(props.placeholder?{placeholder:t(props.placeholder)}:{}),...(props['aria-label']?{'aria-label':t(props['aria-label'])}:{})};
}
export interface Option { label: string; value: string }

interface BaseFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

/**
 * The label, the hint and the error, once.
 *
 * The hint and the error are OUTSIDE the label and referenced by
 * aria-describedby, not inside it. They were inside, which put them in the
 * field's accessible NAME: a screen reader announced "Credit limit, maximum
 * exposure permitted" as the name of the box, and on a field in error it
 * announced the error as part of the name too — permanently, because a name is
 * not a state. A description is the right relationship and it is what a
 * description is for.
 *
 * `children` is a function so the control can be given the id to point at. A
 * context would do the same and would let a caller forget; this cannot be used
 * without being handed the value.
 */
export function FieldShell({ label, hint, error, required, className, children }: BaseFieldProps & { children: (describedBy?: string) => React.ReactNode }) {
  const {t}=useLocalization();
  const generated = React.useId();
  const noteId = error || hint ? `${generated}-note` : undefined;
  return (
    <div className={cn("block min-w-0", className)}>
      {/* The label still WRAPS the control, so the association survives without
          an id on a control this does not own. */}
      <label className="block min-w-0">
        {label ? <span className="mb-1.5 flex items-center gap-1 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{typeof label === "string" ? t(label) : label}{required ? <span className="text-[var(--danger-ink)]">*</span> : null}</span> : null}
        {children(noteId)}
      </label>
      {error ? <span id={noteId} className="mt-1 block text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</span>
        : hint ? <span id={noteId} className="mt-1 block text-[length:calc(10px*var(--fs-scale))] text-[var(--text-subtle)]">{t(hint)}</span> : null}
    </div>
  );
}

/** Keeps a caller's own aria-describedby rather than replacing it. */
function describedBy(own: string | undefined, note: string | undefined) {
  return [own, note].filter(Boolean).join(" ") || undefined;
}

const inputClass = "focus-ring h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[length:calc(12px*var(--fs-scale))] font-medium text-[var(--text)] shadow-[inset_0_1px_1px_rgba(15,23,42,.02)] outline-none transition placeholder:text-[var(--text-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:bg-[var(--surface-2)] disabled:text-[var(--text-subtle)]";

/* Omit the native `prefix` (and `suffix`) before intersecting: HTML defines prefix as
   an RDFa string attribute, so the intersection collapsed this prop to `string & ReactNode`
   and rejected an icon element. Strings still pass, since ReactNode includes them. */
export function Input({ label, hint, error, required, className, prefix, suffix, ...props }: BaseFieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix" | "suffix"> & { prefix?: React.ReactNode; suffix?: React.ReactNode }) {
  const localizedProps=useControlCopy(props);
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {(note) => (
      <div className="relative">
        {prefix ? <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{prefix}</div> : null}
        <input className={cn(inputClass, prefix ? "ps-11" : undefined, suffix ? "pe-10" : undefined)} {...localizedProps} aria-invalid={error ? true : props["aria-invalid"]} aria-required={required || props["aria-required"]} aria-describedby={describedBy(props["aria-describedby"], note)} />
        {suffix ? <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{suffix}</div> : null}
      </div>
      )}
    </FieldShell>
  );
}

/**
 * The search box, once.
 *
 * `inputRef`, `onKeyDown` and `aria-label` are here because the three screens
 * that needed a search box each wrote their own rather than do without them —
 * the sidebar needs the ref to answer its focus shortcut, and Escape to clear.
 * A shared control that cannot do what its callers need is a shared control
 * with one caller.
 */
export function SearchInput({ value, onChange, placeholder = "Search records, IDs, names…", className, onClear, inputRef, onKeyDown, "aria-label": ariaLabel }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  "aria-label"?: string;
}) {
  const { t } = useLocalization();
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-subtle)]" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel ? t(ariaLabel) : undefined}
        placeholder={t(placeholder)}
        className={cn(inputClass, "ps-9 pe-8")}
      />
      {value ? <button type="button" aria-label={t("Clear search")} onClick={() => { onChange(""); onClear?.(); }} className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]"><X className="size-3.5" /></button> : null}
    </div>
  );
}

export function Textarea({ label, hint, error, required, className, ...props }: BaseFieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const localizedProps=useControlCopy(props);
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {(note) => <textarea className={cn(inputClass, "h-auto min-h-24 resize-y py-2.5 leading-relaxed")} {...localizedProps} aria-invalid={error ? true : props["aria-invalid"]} aria-required={required || props["aria-required"]} aria-describedby={describedBy(props["aria-describedby"], note)} />}
    </FieldShell>
  );
}

export function Select({ label, hint, error, required, className, options, placeholder = "Select…", ...props }: BaseFieldProps & React.SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  const localizedProps=useControlCopy(props);
  const {t}=useLocalization();
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {(note) => (
      <div className="relative">
        <select className={cn(inputClass, "appearance-none pe-9")} {...localizedProps} aria-invalid={error ? true : props["aria-invalid"]} aria-required={required || props["aria-required"]} aria-describedby={describedBy(props["aria-describedby"], note)}>
          {placeholder ? <option value="">{t(placeholder)}</option> : null}
          {options.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
      </div>
      )}
    </FieldShell>
  );
}

export function MultiSelect({ label, hint, error, required, options, value, onChange, placeholder = "Select values…", className, disabled }: BaseFieldProps & { options: Option[]; value: string[]; onChange: (value: string[]) => void; placeholder?: string; disabled?: boolean }) {
  const {t: translateCopy} = useLocalization();
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const selectedLabels = value.map((selected) => options.find((option) => option.value === selected)?.label).filter(Boolean) as string[];
  const filtered = options.filter((option) => t(option.label).toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  const toggle = (optionValue: string) => onChange(value.includes(optionValue) ? value.filter((item) => item !== optionValue) : [...value, optionValue]);

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {(note) => (
      <div className="relative" ref={ref}>
        <button type="button" disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={note} onClick={() => setOpen((previous) => !previous)} className={cn(inputClass, "flex min-h-9 h-auto items-center justify-between gap-2 py-1.5 text-start disabled:opacity-60")}>
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selectedLabels.length ? selectedLabels.slice(0, 3).map((selected) => <span key={selected} className="rounded-md bg-[var(--primary-soft)] px-1.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--primary-strong)]">{t(selected)}</span>) : <span className="text-[var(--text-subtle)]">{t(placeholder)}</span>}
            {selectedLabels.length > 3 ? <span className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)]">+{selectedLabels.length - 3}</span> : null}
          </span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-[var(--text-muted)] transition", open && "rotate-180")} />
        </button>
        {open ? (
          <div className="animate-slide-up absolute z-50 mt-1.5 w-full min-w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
            <div className="border-b border-[var(--border)] p-2">
              <div className="relative"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)]" /><input autoFocus value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={translateCopy("ui.filter.options.62b72239")} className={cn(inputClass, "h-8 pl-8 text-[length:calc(11px*var(--fs-scale))]")} /></div>
            </div>
            <div className="nex-scrollbar max-h-52 overflow-auto p-1.5">
              {filtered.map((option) => {
                const selected = value.includes(option.value);
                return <button key={option.value} type="button" onClick={() => toggle(option.value)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[length:calc(11px*var(--fs-scale))] font-medium hover:bg-[var(--surface-2)]"><span className={cn("flex size-4 items-center justify-center rounded border", selected ? "border-[var(--primary)] bg-[var(--primary-fill)] text-white" : "border-[var(--border-strong)]")}><Check className={cn("size-3", !selected && "opacity-0")} /></span><span className="flex-1">{t(option.label)}</span></button>;
              })}
              {!filtered.length ? <div className="px-3 py-5 text-center text-[length:calc(11px*var(--fs-scale))] text-[var(--text-subtle)]"><LocalizedText message="ui.no.matching.options.39a118fc" /></div> : null}
            </div>
          </div>
        ) : null}
      </div>
      )}
    </FieldShell>
  );
}

/**
 * A checkbox that is a checkbox.
 *
 * A native `<input type="checkbox">`, because every keyboard, screen reader and
 * form-reset behaviour already knows what one is and a div pretending to be one
 * knows none of it. What this adds is the parts that were being written by hand
 * at each of the five places that needed one, differently every time: a real
 * label association, the focus ring the other controls have, a disabled state,
 * and a consistent size.
 *
 * `indeterminate` is not an attribute — it is a DOM property with no HTML
 * equivalent, which is why a "select all" that is partly selected is so often
 * shown as simply unchecked. It is set through a ref here so callers can say
 * what they mean.
 */
export function Checkbox({ label, description, indeterminate, className, ...props }: {
  label?: React.ReactNode;
  description?: React.ReactNode;
  indeterminate?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !props.checked;
  }, [indeterminate, props.checked]);

  const box = (
    <input
      ref={ref}
      type="checkbox"
      className={cn("focus-ring size-3.5 shrink-0 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50", !label && className)}
      {...props}
    />
  );

  /* No label means the caller is labelling it some other way — an aria-label on
     a table's select-all, or its own <label> around a line of prose. Returned
     bare rather than wrapped in an empty <label> that would associate nothing,
     and the className goes on the box itself so a caller can align it in the
     row it already built. */
  if (!label) return box;

  return (
    <label className={cn("flex cursor-pointer items-start gap-2", props.disabled && "cursor-not-allowed opacity-60", className)}>
      {box}
      <span className="min-w-0">
        <span className="block text-[length:calc(11px*var(--fs-scale))] font-semibold leading-tight text-[var(--text)]">{typeof label === "string" ? <LocalizedText message={label} /> : label}</span>
        {description ? <span className="mt-0.5 block text-[length:calc(10px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{typeof description === "string" ? <LocalizedText message={description} /> : description}</span> : null}
      </span>
    </label>
  );
}

/**
 * One of a set.
 *
 * Same shape as Checkbox and native for the same reasons — and `name` matters
 * more here than anywhere: it is what makes arrow keys move between the options
 * of one group rather than every radio on the page.
 */
export function Radio({ label, description, className, ...props }: {
  label?: React.ReactNode;
  description?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const dot = (
    <input
      type="radio"
      className={cn("focus-ring size-3.5 shrink-0 accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50", !label && className)}
      {...props}
    />
  );
  if (!label) return dot;
  return (
    <label className={cn("flex cursor-pointer items-start gap-2", props.disabled && "cursor-not-allowed opacity-60", className)}>
      {dot}
      <span className="min-w-0">
        <span className="block text-[length:calc(11px*var(--fs-scale))] font-semibold leading-tight text-[var(--text)]">{typeof label === "string" ? <LocalizedText message={label} /> : label}</span>
        {description ? <span className="mt-0.5 block text-[length:calc(10px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{typeof description === "string" ? <LocalizedText message={description} /> : description}</span> : null}
      </span>
    </label>
  );
}

/**
 * Choosing a file, as a button.
 *
 * The native file input cannot be styled to match anything, so both screens
 * that needed one hid it and clicked it through a ref from a Button. That is
 * the right pattern and it was written twice; this is it once. The input stays
 * in the document — hidden, not absent — because a detached one cannot be
 * clicked, and it is reset after every choice so picking the same file twice
 * still fires.
 */
export function FilePicker({ accept, label, icon, variant = "secondary", disabled, onFile, className }: {
  accept?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  onFile: (file: File) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          /* Cleared whatever happened: without it, choosing the same file again
             is not a change event and nothing happens. */
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button variant={variant} leftIcon={icon} disabled={disabled} className={className} onClick={() => ref.current?.click()}>{typeof label === "string" ? <LocalizedText message={label} /> : label}</Button>
    </>
  );
}

export function Toggle({ label, description, checked, onChange, disabled, className }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; className?: string }) {
  return (
    <label className={cn("flex min-h-10 items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2", className)}>
      <span className="min-w-0"><span className="block text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text)]">{typeof label === "string" ? <LocalizedText message={label} /> : label}</span>{description ? <span className="mt-0.5 block text-[length:calc(10px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{typeof description === "string" ? <LocalizedText message={description} /> : description}</span> : null}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn("focus-ring relative h-5 w-9 shrink-0 rounded-full border transition", checked ? "border-[var(--primary)] bg-[var(--primary)]" : "border-[var(--border-strong)] bg-[var(--surface-3)]", disabled && "opacity-50")}>
        <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export { inputClass };

/** A labelled slider with its value read out beside it. The readout is what
    makes a slider usable for a setting: "13.5px" means something, a thumb
    position does not. */
export function RangeInput({ label, hint, value, min, max, step = 1, unit = "", onChange, className, disabled }: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}) {
  const {t}=useLocalization();
  return (
    <FieldShell label={label} hint={hint} className={className}>
      {(note) => (
      <div className="flex items-center gap-3">
        <input
          disabled={disabled} type="range" min={min} max={max} step={step} value={value}
          onChange={(event) => {if(!disabled)onChange(Number(event.target.value));}}
          aria-label={t(label)}
          aria-describedby={note}
          className="focus-ring h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--surface-3)] accent-[var(--primary)]"
        />
        <span className="min-w-14 text-right font-mono text-[length:calc(11px*var(--fs-scale))] font-bold tabular-nums text-[var(--text)]">{value}{unit}</span>
      </div>
      )}
    </FieldShell>
  );
}
