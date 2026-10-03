"use client";
import {useReferenceHost} from "@pepbits/reference-host";
import {LocalizedText} from "@pepbits/ops-ui";
import {SourceDialog} from "@pepbits/ops-ui";
import { SourceSelect, SourceButton } from "@pepbits/ops-ui";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "./../lib/api";
import { STATUS_META, TONE_CLASS, type Tone } from "./../lib/format";
import { IconAlert, IconCheck, IconClose } from "./icons";

export function cx(...c: (string | number | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "go";
  size?: "sm" | "md";
  busy?: boolean;
};

export function Button({ variant = "secondary", size = "md", busy, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-ceil text-white hover:bg-ceil-2 border-transparent",
    go: "bg-go text-white hover:brightness-95 border-transparent",
    secondary: "bg-white text-ink border-line hover:border-[#b9c3c9] hover:bg-steel/50",
    ghost: "bg-transparent text-ink border-transparent hover:bg-steel-2",
    danger: "bg-white text-stop border-[#e8bdb9] hover:bg-stop-soft",
  }[variant];
  const s = size === "sm" ? "h-7 px-2.5 text-[13px] gap-1.5" : "h-[34px] px-3.5 gap-2";
  return (
    <SourceButton
      className={cx("inline-flex items-center justify-center whitespace-nowrap rounded-[6px] border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", v, s, className)}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {typeof children==="string"?<LocalizedText message={children}/>:children}
    </SourceButton>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] px-1.5 py-[1px] text-[12px] font-medium", TONE_CLASS[tone], className)}>{typeof children==="string"?<LocalizedText message={children}/>:children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <Badge tone={m.tone}>
      {["IN_SURGERY", "IN_OR"].includes(status) && <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />}
      <LocalizedText message={m.label}/>
    </Badge>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      {label && <span className="mb-1 block text-[12px] font-medium text-muted"><LocalizedText message={label}/></span>}
      {typeof children==="string"?<LocalizedText message={children}/>:children}
      {hint && <span className="mt-1 block text-[12px] text-faint"><LocalizedText message={hint}/></span>}
    </label>
  );
}

export function Select({ options, placeholder, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string | number; label: string })[]; placeholder?: string }) {
  return (
    <SourceSelect className="input" {...rest}>
      {placeholder !== undefined && <option value=""><LocalizedText message={placeholder}/></option>}
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}><LocalizedText message={o}/></option>
        ) : (
          <option key={o.value} value={o.value}>{typeof o.label==="string"?<LocalizedText message={o.label}/>:o.label}</option>
        ),
      )}
    </SourceSelect>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center gap-2 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ceil border-t-transparent" />
      <LocalizedText message={label}/>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-28 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      <p className="font-medium">{typeof title==="string"?<LocalizedText message={title}/>:title}</p>
      {children && <p className="max-w-sm text-[13px] text-muted">{typeof children==="string"?<LocalizedText message={children}/>:children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const e = error as ApiError;
  const blockers = e instanceof ApiError ? e.blockers : [];
  return (
    <div className={cx("rounded-[6px] border border-[#ecc6c2] bg-stop-soft px-3 py-2 text-[13px] text-stop", className)} role="alert">
      <div className="flex items-start gap-2 font-medium">
        <IconAlert size={16} className="mt-0.5 shrink-0" />
        <LocalizedText message={e.message ?? String(error)}/>
      </div>
      {blockers.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-8 text-ink">
          {blockers.map((b) => (
            <li key={b}><LocalizedText message={b}/></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <SourceDialog open={open} onClose={onClose} title={title} className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0f262480] p-0 sm:items-center sm:p-6">{ref=><div className="flex h-full w-full items-end justify-center sm:items-center" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={ref} tabIndex={-1} className="flex max-h-[92dvh] w-full flex-col rounded-t-[12px] bg-white shadow-2xl sm:rounded-[12px]" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-cond text-[17px] font-semibold">{typeof title==="string"?<LocalizedText message={title}/>:title}</h2>
          <SourceButton className="rounded p-1 text-muted hover:bg-steel" onClick={onClose} aria-label="Close">
            <IconClose />
          </SourceButton>
        </div>
        <div className="scroll-y flex-1 px-5 py-4">{typeof children==="string"?<LocalizedText message={children}/>:children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>}</SourceDialog>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }: { open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <SourceDialog open={open} onClose={onClose} title={title} className="fixed inset-0 z-[120] flex justify-end bg-[#0f262455]">{ref=><div className="flex h-full w-full justify-end" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
      <div ref={ref} tabIndex={-1} className="flex h-full w-full flex-col bg-white shadow-2xl" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div>
            <h2 className="font-cond text-[18px] font-semibold leading-tight">{typeof title==="string"?<LocalizedText message={title}/>:title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-muted">{subtitle}</div>}
          </div>
          <SourceButton className="rounded p-1 text-muted hover:bg-steel" onClick={onClose} aria-label="Close">
            <IconClose />
          </SourceButton>
        </div>
        <div className="scroll-y flex-1">{typeof children==="string"?<LocalizedText message={children}/>:children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>}</SourceDialog>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cx("inline-flex rounded-[7px] border border-line bg-steel p-0.5", className)} role="tablist">
      {options.map((o) => (
        <SourceButton
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium transition-colors", value === o.value ? "bg-white text-ink shadow-[0_1px_2px_#0001]" : "text-muted hover:text-ink")}
        >
          {typeof o.label==="string"?<LocalizedText message={o.label}/>:o.label}
          {o.count !== undefined && <span className={cx("rounded px-1 text-[11px]", value === o.value ? "bg-ceil-soft text-ceil-2" : "bg-steel-2")}>{o.count}</span>}
        </SourceButton>
      ))}
    </div>
  );
}

export function PanelHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2", className)}>
      <h3 className="font-cond text-[15px] font-semibold">{typeof title==="string"?<LocalizedText message={title}/>:title}</h3>
      {children && <div className="flex items-center gap-2">{typeof children==="string"?<LocalizedText message={children}/>:children}</div>}
    </div>
  );
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-muted"><LocalizedText message={label}/></div>
      <div className="truncate font-medium">{typeof children==="string"?<LocalizedText message={children}/>:children}</div>
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone: "ok" | "err" };
const ToastCtx = createContext<(text: string, tone?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const {preferences}=useReferenceHost();
  const timers=useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(()=>()=>{for(const t of timers.current)clearTimeout(t);},[]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    const timer=setTimeout(() => {setToasts((t) => t.filter((x) => x.id !== id));timers.current.delete(timer);}, preferences.toastDuration);timers.current.add(timer);
  }, [preferences.toastDuration]);
  const place={"top-left":"top-20 left-4","top-center":"top-20 left-1/2 -translate-x-1/2","top-right":"top-20 right-4","bottom-left":"bottom-12 left-4","bottom-center":"bottom-12 left-1/2 -translate-x-1/2","bottom-right":"bottom-12 right-4"}[preferences.toastPosition];
  return (
    <ToastCtx.Provider value={push}>
      {typeof children==="string"?<LocalizedText message={children}/>:children}
      <div className={cx("pointer-events-none fixed z-[140] flex flex-col gap-2",place)} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex max-w-sm items-center gap-2 rounded-[8px] px-3.5 py-2.5 text-[13px] font-medium text-white shadow-lg", t.tone === "ok" ? "bg-scrub" : "bg-stop")}>
            {t.tone === "ok" ? <IconCheck size={16} /> : <IconAlert size={16} />}
            <LocalizedText message={t.text}/>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Runs an async action, shows a toast on success, and returns the error for inline display. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        const r = await fn();
        if (success) toast(success);
        return r;
      } catch (e) {
        setError(e);
        if (!(e instanceof ApiError && e.blockers.length)) toast((e as Error).message, "err");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy, error, setError };
}
