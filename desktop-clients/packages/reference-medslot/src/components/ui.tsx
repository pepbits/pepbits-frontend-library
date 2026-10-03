"use client";
import {SourceDialog,Card,TableContainer} from "@pepbits/ops-ui";
import {SourceButton,SourceInput,SourceDateInput,SourceTimeInput,SourceDateTimeInput,SourceSelect,SourceTextarea,Table as ManagedTable,TableHead,TableCell,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { clsx as clsxBase, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class joiner that lets later Tailwind classes (e.g. w-52) override earlier ones (w-full). */
const clsx = (...c: ClassValue[]) => twMerge(clsxBase(c));
import { LoaderCircle, X, CircleAlert } from "lucide-react";
import { createContext, forwardRef, useContext, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { STATUS } from "../lib/format";
import type { Status } from "../lib/types";

export { clsx as cx };

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-scrub text-white hover:bg-scrub-dark shadow-[inset_0_-1px_0_rgb(0_0_0/0.15)]",
  secondary: "bg-panel text-ink border border-line hover:border-ink/30",
  ghost: "text-ink-2 hover:bg-line-2",
  danger: "bg-triage text-white hover:bg-triage/90",
  quiet: "text-scrub hover:bg-scrub-soft",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }>(
  function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...p }, ref) {
    return (
      <SourceButton ref={ref} disabled={disabled || loading}
        className={clsx("inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctl)] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm", BTN[variant], className)} {...p}>
        {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
        {children}
      </SourceButton>
    );
  });

export function IconButton({ label, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <SourceButton aria-label={label} title={label} className={clsx("inline-flex size-9 items-center justify-center rounded-[var(--radius-ctl)] text-ink-2 hover:bg-line-2 transition-colors disabled:opacity-40", className)} {...p}>
      {children}
    </SourceButton>
  );
}

const fieldBase = "w-full rounded-[var(--radius-ctl)] border bg-panel px-3 text-sm text-ink placeholder:text-mute/70 transition-colors focus:outline-none focus:border-scrub focus:ring-2 focus:ring-scrub/15 disabled:bg-line-2";

/** Lets Input/Select/Textarea pick up their Field's id so the label is announced by screen readers. */
const FieldCtx = createContext<{ id?: string; describedBy?: string }>({});

export function Field({ label, hint, error, required, children, className, htmlFor }: { label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <FieldCtx.Provider value={{ id, describedBy }}>
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
          {typeof label==="string"?<LocalizedText message={label}/>: label}{required && <span className="text-triage" aria-hidden> *</span>}
        </label>
      )}
      {children}
      {error ? <p id={describedBy} className="flex items-center gap-1 text-xs text-triage" role="alert"><CircleAlert className="size-3.5 shrink-0" aria-hidden />{typeof error==="string"?<LocalizedText message={error}/>: error}</p>
        : hint ? <p id={describedBy} className="text-xs text-mute">{typeof hint==="string"?<LocalizedText message={hint}/>: hint}</p> : null}
    </div>
    </FieldCtx.Provider>
  );
}
const useFieldIds = (id?: string) => { const c = useContext(FieldCtx); return { id: id ?? c.id, "aria-describedby": c.describedBy }; };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return <SourceInput ref={ref} {...useFieldIds(p.id)} aria-invalid={invalid || undefined} className={clsx(fieldBase, "h-10", invalid ? "border-triage" : "border-line", className)} {...p} />;
});

/** Temporal fields retain original MedSlot geometry while using dedicated shared wrappers. */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function DateInput(p,ref){return <SourceDateInput {...useFieldIds(p.id)} {...p} ref={ref} className={clsx(fieldBase,"h-10 border-line",p.className)}/>;});
export const TimeInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function TimeInput(p,ref){return <SourceTimeInput {...useFieldIds(p.id)} {...p} ref={ref} className={clsx(fieldBase,"h-10 border-line",p.className)}/>;});

export const DateTimeInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function DateTimeInput(p,ref){return <SourceDateTimeInput {...useFieldIds(p.id)} {...p} ref={ref} className={clsx(fieldBase,"h-10 border-line",p.className)}/>;});

export function Select({ className, invalid, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  const ids = useFieldIds(p.id);
  return (
    <SourceSelect {...ids} aria-invalid={invalid || undefined} className={clsx(fieldBase, "h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", invalid ? "border-triage" : "border-line", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2366757f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
      {children}
    </SourceSelect>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...p }, ref) {
  return <SourceTextarea ref={ref} {...useFieldIds(p.id)} aria-invalid={invalid || undefined} className={clsx(fieldBase, "py-2 min-h-20", invalid ? "border-triage" : "border-line", className)} {...p} />;
});

export function Check({ label, checked, onChange, description, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx("flex cursor-pointer items-start gap-2.5 text-sm", disabled && "opacity-50 cursor-not-allowed")}>
      <SourceInput id={id} type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-scrub)]" />
      <span><span className="text-ink">{typeof label==="string"?<LocalizedText message={label}/>: label}</span>{description && <span className="block text-xs text-mute">{typeof description==="string"?<LocalizedText message={description}/>: description}</span>}</span>
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <SourceButton type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={clsx("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-scrub" : "bg-line")}>
      <span className={clsx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </SourceButton>
  );
}

/** Segmented control for 2–6 mutually exclusive options. */
export function Segmented<T extends string>({ value, onChange, options, size = "md", className }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, ReactNode])[]; size?: "sm" | "md"; className?: string }) {
  return (
    <div role="radiogroup" className={clsx("inline-flex max-w-full overflow-x-auto scroll-thin rounded-[var(--radius-ctl)] bg-line-2 p-0.5", className)}>
      {options.map(([v, label]) => (
        <SourceButton key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-[6px] font-medium transition-all", size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
            value === v ? "bg-panel text-ink shadow-sm" : "text-mute hover:text-ink")}>
          {typeof label==="string"?<LocalizedText message={label}/>: label}
        </SourceButton>
      ))}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.chip, className)}>
      <span className={clsx("size-1.5 rounded-full", s.dot)} aria-hidden /><LocalizedText message={s.label ?? ""} />
    </span>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" | "violet"; className?: string }) {
  const t = { neutral: "bg-line-2 text-ink-2", green: "bg-scrub-soft text-scrub-dark", amber: "bg-amber-soft text-amber", red: "bg-triage-soft text-triage", blue: "bg-slot-soft text-slot", violet: "bg-violet-soft text-violet" }[tone];
  return <span className={clsx("inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold", t, className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={clsx("size-5 animate-spin text-mute", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-line-2", className)} />;
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-mute">{icon}</div>}
      <p className="font-semibold text-ink">{typeof title==="string"?<LocalizedText message={title}/>: title}</p>
      {children && <div className="max-w-sm text-sm text-mute">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center gap-3 rounded-[var(--radius-ctl)] border border-triage/30 bg-triage-soft px-4 py-3 text-sm text-triage">
      <CircleAlert className="size-4 shrink-0" aria-hidden /><span className="flex-1">{error.message}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}><LocalizedText message="Try again" /></Button>}
    </div>
  );
}

export function PageHeader({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em]">{typeof title==="string"?<LocalizedText message={title}/>: title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-mute">{typeof description==="string"?<LocalizedText message={description}/>: description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ children, className, title, actions, flush }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode; flush?: boolean }) {
  return (
    <Card as="section" tone="transparent" shadow="none" radius="xl" className={clsx("border-line bg-panel",className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-4 py-3">
          <h2 className="text-[15px] font-semibold">{typeof title==="string"?<LocalizedText message={title}/>: title}</h2>{actions}
        </header>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </Card>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <SourceDialog open={open} onClose={onClose} title={typeof title==="string"?title:"MedSlot"} className="fixed inset-0 z-50 flex justify-end">{ref=>(
    <>
      <div className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={clsx("relative flex h-full w-full flex-col bg-panel shadow-[var(--shadow-pop)] animate-drawer-in", width)}>
        <header className="flex items-start justify-between gap-3 border-b border-line-2 px-5 py-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{typeof title==="string"?<LocalizedText message={title}/>: title}</h2>{subtitle && <div className="mt-0.5 text-sm text-mute">{typeof subtitle==="string"?<LocalizedText message={subtitle}/>: subtitle}</div>}</div>
          <IconButton label="Close" onClick={onClose}><X className="size-5" /></IconButton>
        </header>
        <div className="flex-1 overflow-y-auto scroll-thin px-5 py-4">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line-2 bg-paper/60 px-5 py-3">{footer}</footer>}
      </div>
    </> )}</SourceDialog>);
}

export function Modal({ open, onClose, title, children, footer, width = "max-w-md" }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <SourceDialog open={open} onClose={onClose} title={typeof title==="string"?title:"MedSlot"} className="fixed inset-0 z-[60] flex items-center justify-center p-4">{ref=>(
    <>
      <div className="absolute inset-0 bg-ink/35 animate-fade-in" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={clsx("relative w-full rounded-xl bg-panel shadow-[var(--shadow-pop)] animate-pop-in", width)}>
        <header className="flex items-center justify-between border-b border-line-2 px-5 py-3.5">
          <h2 className="text-base font-semibold">{typeof title==="string"?<LocalizedText message={title}/>: title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="size-5" /></IconButton>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line-2 px-5 py-3">{footer}</footer>}
      </div>
    </> )}</SourceDialog>);
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <TableContainer overflow="horizontal" className={clsx("scroll-thin",className)}><ManagedTable className="w-full border-collapse text-sm">{children}</ManagedTable></TableContainer>;
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) =>
  <TableHead className={clsx("sticky top-0 z-[1] border-b border-line bg-paper px-3 py-2.5 text-left text-xs font-semibold text-mute whitespace-nowrap", className)}>{children}</TableHead>;
export const Td = ({ children, className, ...p }: { children?: ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) =>
  <TableCell className={clsx("border-b border-line-2 px-3 py-2.5 align-middle", className)} {...p}>{children}</TableCell>;
