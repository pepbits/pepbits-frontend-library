"use client";

// Copied from the AllyVora clinical workspace `components/ui/index.tsx` (only the parts the front
// desk pages use). Markup and classes are unchanged; `useToast` posts to the host's notifications
// instead of the source's own toast provider.
import clsx from "clsx";
import { Loader2 } from "@pepbits/icons";
import {
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
  forwardRef, useCallback, useEffect, useId, useState,
} from "react";
import { useScreenHost } from "@pepbits/patterns/screen-host";

export const cn = clsx;

type Tone = "neutral" | "lapis" | "ok" | "warn" | "crit" | "ai";

// ---------- Button ----------
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "ai" | "quiet";
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }>(
  function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
    return (
      <button ref={ref} disabled={disabled || loading} {...rest}
        className={cn("inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background,border,color,transform] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55",
          size === "sm" && "h-8 rounded-[8px] px-2.5 text-[13px]", size === "md" && "h-9 rounded-ctl px-3.5 text-[13.5px]", size === "lg" && "h-11 rounded-ctl px-5 text-[15px]",
          variant === "primary" && "bg-lapis text-white hover:bg-lapis-hover dark:text-canvas",
          variant === "secondary" && "border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-raised",
          variant === "ghost" && "text-ink-2 hover:bg-sunken hover:text-ink",
          variant === "quiet" && "text-lapis hover:bg-lapis-soft",
          variant === "danger" && "bg-crit text-white hover:opacity-90 dark:text-canvas",
          variant === "ai" && "bg-ai-soft text-ai hover:brightness-95 dark:hover:brightness-125", className)}>
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
        {children}
      </button>
    );
  });

// ---------- Fields ----------
export function Field({ label, hint, error, required, children, className, htmlFor, aside }: { label: ReactNode; hint?: ReactNode; error?: string | null; required?: boolean; children: ReactNode; className?: string; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-2">
          {label}{required && <span className="ml-0.5 text-crit" aria-label="required">*</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? <p role="alert" className="text-[12px] text-crit">{error}</p> : hint ? <p className="text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

const ctl = "h-9 w-full min-w-0 rounded-ctl border border-line-strong bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus:border-lapis focus:outline-none focus:ring-2 focus:ring-lapis/20 disabled:bg-raised disabled:text-ink-3 aria-[invalid=true]:border-crit";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode }>(function Input({ className, suffix, ...rest }, ref) {
  if (!suffix) return <input ref={ref} {...rest} className={cn(ctl, className)} />;
  return (
    <div className="relative">
      <input ref={ref} {...rest} className={cn(ctl, className)} style={{ paddingRight: typeof suffix === "string" ? 18 + suffix.length * 7.5 : 48, ...rest.style }} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-ink-3">{suffix}</span>
    </div>
  );
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return <select ref={ref} {...rest} className={cn(ctl, "appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8", className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2374809a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>{children}</select>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} {...rest} className={cn(ctl, "h-auto min-h-[76px] resize-y py-2 leading-relaxed", className)} />;
});

/** Labelled input with generated id. */
export function TextField({ label, hint, error, required, className, inputClassName, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string | null; inputClassName?: string; suffix?: ReactNode }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}><Input id={id} required={required} aria-invalid={!!error} className={inputClassName} {...rest} /></Field>;
}
export function SelectField({ label, hint, error, required, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}><Select id={id} required={required} aria-invalid={!!error} {...rest}>{children}</Select></Field>;
}

// ---------- Display ----------
export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[1px] text-[11.5px] font-medium leading-5",
      tone === "neutral" && "bg-sunken text-ink-2", tone === "lapis" && "bg-lapis-soft text-lapis-ink", tone === "ok" && "bg-ok-soft text-ok",
      tone === "warn" && "bg-warn-soft text-warn", tone === "crit" && "bg-crit-soft text-crit", tone === "ai" && "bg-ai-soft text-ai", className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}{children}
    </span>
  );
}
export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="rounded-[5px] border border-line-strong bg-raised px-1.5 py-px font-sans text-[11px] text-ink-3">{children}</kbd>;

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-ctl border border-crit/30 bg-crit-soft px-3 py-2 text-[13px] text-crit">{children}</div>;
}

// ---------- Toasts (host notifications) ----------
const TONE = { neutral: "info", lapis: "info", ai: "info", ok: "success", warn: "warning", crit: "error" } as const;
export function useToast() {
  const { notify } = useScreenHost();
  return useCallback((text: string, tone: Tone = "neutral") => notify(text, { tone: TONE[tone] }), [notify]);
}

// ---------- Hooks ----------
export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
