import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "../cn";

/* ------------------------------------------------------------------ */
/* Field: label + control + hint/error                                 */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  labelClassName?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  className,
  labelClassName,
  aside,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className={cn("text-sm font-medium text-ink-800", labelClassName)}>
          {label}
          {required && (
            <span className="ml-0.5 text-signal" aria-hidden="true">
              *
            </span>
          )}
          {optional && <span className="ml-1.5 font-normal text-ink-400">Optional</span>}
        </label>
        {aside}
      </div>
      {children}
      <FieldMessage id={htmlFor} error={error} hint={hint} />
    </div>
  );
}

export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error)
    return (
      <p id={`${id}-error`} className="flex animate-fade-in items-start gap-1.5 text-[0.8rem] font-medium text-signal">
        <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={`${id}-hint`} className="text-[0.8rem] leading-snug text-ink-500">
        {hint}
      </p>
    );
  return null;
}

/* ------------------------------------------------------------------ */
/* Shared control styles                                               */
/* ------------------------------------------------------------------ */

const control =
  "h-11 w-full rounded-xl border bg-white px-3.5 text-[0.95rem] text-ink-900 placeholder:text-ink-400 " +
  "transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus:ring-4 " +
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400";
const ok = "border-ink-200 hover:border-ink-300 focus:border-scrub-500 focus:ring-scrub-100";
const bad = "border-signal/70 bg-[#FFF8F8] focus:border-signal focus:ring-signal/15";

function describedBy(id: string | undefined, invalid?: boolean) {
  if (!id) return undefined;
  return invalid ? `${id}-error` : `${id}-hint`;
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, leading, trailing, className, id, ...props },
  ref,
) {
  return (
    <div className="group relative flex items-center">
      {leading && (
        <span className="pointer-events-none absolute left-3.5 flex text-ink-400 transition-colors group-focus-within:text-scrub-600">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, invalid)}
        className={cn(control, invalid ? bad : ok, leading ? "pl-10" : "", trailing ? "pr-12" : "", className)}
        {...props}
      />
      {trailing && <span className="absolute right-1.5 flex items-center">{trailing}</span>}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Select (native for accessibility and mobile pickers)                */
/* ------------------------------------------------------------------ */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, placeholder, className, id, children, value, ...props },
  ref,
) {
  const empty = value === "" || value === undefined;
  return (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, invalid)}
        className={cn(control, invalid ? bad : ok, "cursor-pointer appearance-none pr-10", empty && "text-ink-400", className)}
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* AffixInput: input with fixed text before or after (dial code, domain) */
/* ------------------------------------------------------------------ */

interface AffixInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  status?: ReactNode;
}

export const AffixInput = forwardRef<HTMLInputElement, AffixInputProps>(function AffixInput(
  { invalid, prefix, suffix, status, className, id, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-150 focus-within:ring-4",
        invalid
          ? "border-signal/70 bg-[#FFF8F8] focus-within:border-signal focus-within:ring-signal/15"
          : "border-ink-200 hover:border-ink-300 focus-within:border-scrub-500 focus-within:ring-scrub-100",
      )}
    >
      {prefix && (
        <span className="flex h-full shrink-0 items-center border-r border-ink-100 bg-ink-50/70 px-3 text-sm tabular-nums text-ink-500">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(id, invalid)}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-3.5 text-[0.95rem] text-ink-900 placeholder:text-ink-400 focus:outline-none",
          className,
        )}
        {...props}
      />
      {suffix && <span className="shrink-0 pr-3 text-[0.95rem] text-ink-400">{suffix}</span>}
      {status && <span className="flex shrink-0 items-center pr-3">{status}</span>}
    </div>
  );
});
