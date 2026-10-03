"use client";

import { Check } from "lucide-react";
import { createContext, forwardRef, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/utils";
import { SourceButton, SourceDateInput, SourceDateTimeInput, SourceInput, SourceTextarea, SourceSelect } from "../controls";
import { useLocalization } from "@pepbits/ops-ui";
import { Copy } from "../copy";

const control =
  "rounded-lg border bg-paper px-3 text-sm text-ink placeholder:text-ink-faint transition-colors outline-none focus:border-scrub-500 focus:ring-2 focus:ring-scrub-100 disabled:bg-canvas disabled:text-ink-faint";

/** Lets a control inside <Field> pick up the label's id and the hint or error text. */
const FieldContext = createContext<{ id: string; describedBy?: string; invalid?: boolean } | null>(null);
function useFieldProps(id?: string, invalid?: boolean) {
  const f = useContext(FieldContext);
  return {
    id: id ?? f?.id,
    "aria-describedby": f?.describedBy,
    "aria-invalid": invalid || f?.invalid || undefined,
  };
}

/** Full width unless the caller sets its own width (w-auto, w-40 ...). */
const width = (className?: string) => (className && /(^|\s)(w-|min-w-|max-w-)/.test(className) ? "" : "w-full");

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const noteId = `${id}-note`;
  return (
    <FieldContext.Provider value={{ id, describedBy: error || hint ? noteId : undefined, invalid: !!error }}>
      <div className={cx("flex min-w-0 flex-col gap-1", className)}>
        <label htmlFor={id} className="text-[12.5px] font-medium text-ink-soft">
          <Copy>{label}</Copy>
          {required && <span className="ml-0.5 text-rose-600" aria-hidden>*</span>}
        </label>
        {children}
        {error ? (
          <p id={noteId} className="text-[12px] text-rose-700"><Copy>{error}</Copy></p>
        ) : hint ? (
          <p id={noteId} className="text-[12px] text-ink-faint"><Copy>{hint}</Copy></p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode }>(
  function Input({ className, invalid, icon, id, ...rest }, ref) {
    const a11y = useFieldProps(id, invalid);
    if (icon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">{icon}</span>
          <SourceInput ref={ref} {...a11y} className={cx(control, width(className), "h-10 pl-9", invalid ? "border-rose-400" : "border-line", className)} {...rest} />
        </div>
      );
    }
    return <SourceInput ref={ref} {...a11y} className={cx(control, width(className), "h-10", invalid ? "border-rose-400" : "border-line", className)} {...rest} />;
  },
);

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

/** A date field (machine value yyyy-mm-dd) on the shared date control, with the source's field styling. */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function DateInput({ className, invalid, id, ...rest }, ref) {
  const a11y = useFieldProps(id, invalid);
  return <SourceDateInput ref={ref} {...a11y} className={cx(control, width(className), "h-10", invalid ? "border-rose-400" : "border-line", className)} {...rest} />;
});

/** A date-and-time field (machine value yyyy-mm-ddThh:mm) on the shared date/time input, with the source's field styling. */
export const DateTimeInput = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(function DateTimeInput({ className, invalid, id, ...rest }, ref) {
  const a11y = useFieldProps(id, invalid);
  return <SourceDateTimeInput ref={ref} {...a11y} className={cx(control, width(className), "h-10", invalid ? "border-rose-400" : "border-line", className)} {...rest} />;
});

export function Select({
  className,
  invalid,
  placeholder,
  options,
  id,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
  placeholder?: string;
  options: Array<{ value: string; label: string; group?: string; disabled?: boolean }>;
}) {
  const a11y = useFieldProps(id, invalid);
  const { t } = useLocalization();
  const groups = new Map<string, typeof options>();
  options.forEach((o) => groups.set(o.group ?? "", [...(groups.get(o.group ?? "") ?? []), o]));
  return (
    <SourceSelect
      {...a11y}
      className={cx(control, width(className), "h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8", invalid ? "border-rose-400" : "border-line", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237f8e95' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {placeholder !== undefined && <option value=""><Copy>{placeholder}</Copy></option>}
      {[...groups.entries()].map(([g, opts]) =>
        g ? (
          <optgroup key={g} label={t(g)}>
            {opts.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                <Copy>{o.label}</Copy>
              </option>
            ))}
          </optgroup>
        ) : (
          opts.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              <Copy>{o.label}</Copy>
            </option>
          ))
        ),
      )}
    </SourceSelect>
  );
}

export function Textarea({ className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const a11y = useFieldProps(id);
  return <SourceTextarea {...a11y} className={cx(control, width(className), "min-h-20 resize-none border-line py-2", className)} {...rest} />;
}

/** Compact single-choice control. Faster than a dropdown for 2–5 options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx("inline-flex rounded-lg bg-canvas p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <SourceButton
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex-1 rounded-md px-3 font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 text-[12.5px]" : "h-9 text-[13px]",
              on ? "bg-paper text-scrub-800 shadow-sm" : "text-ink-soft hover:text-ink",
            )}
          >
            <Copy>{o.label}</Copy>
          </SourceButton>
        );
      })}
    </div>
  );
}

/** Toggleable chip, used for multi-choice lists like services or payers. */
export function Chip({ on, onClick, children, className, tone }: { on: boolean; onClick: () => void; children: ReactNode; className?: string; tone?: string }) {
  return (
    <SourceButton
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
        on ? tone ?? "border-scrub-600 bg-scrub-600 text-white" : "border-line bg-paper text-ink-soft hover:border-scrub-400 hover:text-ink",
        className,
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3} />}
      <Copy>{children}</Copy>
    </SourceButton>
  );
}

export function Checkbox({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm">
      <SourceInput id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={cx(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-scrub-400",
          checked ? "border-scrub-600 bg-scrub-600 text-white" : "border-line bg-paper",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink"><Copy>{label}</Copy></span>
        {sub && <span className="block text-[12px] text-ink-faint"><Copy>{sub}</Copy></span>}
      </span>
    </label>
  );
}
