"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Card, Drawer as SharedDrawer, LocalizedText, Modal as SharedModal, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceDateField, SourceInput, SourceSelect, SourceTextarea } from "../../shared/controls";
import { initials } from "../lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const variants: Record<Variant, string> = {
  primary: "bg-pulse-500 text-white hover:bg-pulse-600 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:border-ink-200 hover:bg-canvas",
  ghost: "text-ink-700 hover:bg-ink/5",
  danger: "bg-alarm-500 text-white hover:bg-alarm-600",
  quiet: "bg-ink/5 text-ink hover:bg-ink/10",
};

/** Source button appearance on the shared SourceButton (localized name/label, ref and type contract). */
export function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ref, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode; ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <SourceButton
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </SourceButton>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium", className)}>{children}</span>;
}

export function Avatar({ name, color, size = 36, className }: { name: string; color?: string; size?: number; className?: string }) {
  // Deterministic tone per name when no color given
  const tones = ["#0F8B8D", "#3B5BA9", "#7A4FA3", "#C47A16", "#B5446E", "#2E9D63", "#4F7C8A"];
  const tone = color ?? tones[name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % tones.length];
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: tone, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-ink-700"><LocalizedText message={label} /></span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-ink-400"><LocalizedText message={hint} /></span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-line bg-white px-2.5 text-sm text-ink placeholder:text-ink-400 focus:border-pulse-500 focus:outline-none focus:ring-2 focus:ring-pulse-500/20 disabled:bg-canvas";

export function Input({ className, ref, ...p }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <SourceInput ref={ref} className={cx(inputCls, "h-9", className)} {...p} />;
}
/** Native date field (machine value YYYY-MM-DD); display of read-only dates goes through useTeleconsultFormat. */
export function DateInput({ className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <SourceDateField className={cx(inputCls, "h-9", className)} {...p} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <SourceSelect className={cx(inputCls, "h-9 pr-7", className)} {...p}>
      {children}
    </SourceSelect>
  );
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <SourceTextarea className={cx(inputCls, "py-2 leading-relaxed resize-none", className)} {...p} />;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  size?: "sm" | "md";
}) {
  const { t } = useLocalization();
  return (
    <div role="radiogroup" className="inline-flex rounded-md bg-ink/5 p-0.5">
      {options.map((o) => (
        <SourceButton
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-[5px] font-medium transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500",
            size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
            value === o.value ? "bg-white text-ink shadow-sm" : "text-ink-600 hover:text-ink",
          )}
        >
          {typeof o.label === "string" ? t(o.label) : o.label}
        </SourceButton>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useLocalization();
  return (
    <SourceButton
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 rounded"
    >
      <span className={cx("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-pulse-500" : "bg-ink-200")}>
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
      {t(label)}
    </SourceButton>
  );
}

/** Source panel on the shared Card (theme surface, border, radius and shadow tokens). */
export function Panel({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <Card as="section" className={className}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
          <h2 className="text-[13px] font-semibold text-ink">{typeof title === "string" ? <LocalizedText message={title} /> : title}</h2>
          {action}
        </header>
      )}
      <div className={cx("p-3.5", bodyClass)}>{children}</div>
    </Card>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink"><LocalizedText message={title} /></p>
      {children && <p className="max-w-xs text-xs text-ink-400">{typeof children === "string" ? <LocalizedText message={children} /> : children}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm text-ink-400">
      <Loader2 className="h-4 w-4 animate-spin" /> <LocalizedText message={label} />
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div role="alert" className="m-4 flex items-start gap-2 rounded-md border border-alarm-100 bg-alarm-50 p-3 text-sm text-alarm-600">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {message}
    </div>
  );
}

const MODAL_SIZE = { "max-w-sm": "sm", "max-w-md": "sm", "max-w-lg": "md", "max-w-xl": "md", "max-w-2xl": "md", "max-w-3xl": "lg", "max-w-4xl": "lg", "max-w-5xl": "xl" } as const;
const DRAWER_WIDTH = { "max-w-sm": "sm", "max-w-md": "sm", "max-w-lg": "md", "max-w-xl": "md", "max-w-2xl": "lg", "max-w-3xl": "lg" } as const;

/** Dialog with the shared overlay's focus trap, Escape handling and focus restore. `width` keeps the source size vocabulary. */
export function Modal({ open, onClose, title, children, footer, width = "max-w-lg" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <SharedModal open={open} onClose={onClose} title={title} size={MODAL_SIZE[width as keyof typeof MODAL_SIZE] ?? "md"} footer={footer}>
      <div className="px-5 py-4">{children}</div>
    </SharedModal>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  return (
    <SharedDrawer open={open} onClose={onClose} title={title} subtitle={subtitle} width={DRAWER_WIDTH[width as keyof typeof DRAWER_WIDTH] ?? "md"} footer={footer}>
      {children}
    </SharedDrawer>
  );
}

// ---------------- Toasts ----------------

type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const counter = useRef(0);
  const { t: tr } = useLocalization();
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, tone, text }]);
    const timer = setTimeout(() => { timers.current.delete(timer); setToasts((t) => t.filter((x) => x.id !== id)); }, 3800);
    timers.current.add(timer);
  }, []);
  useEffect(() => { const pending = timers.current; return () => { pending.forEach(clearTimeout); pending.clear(); }; }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg bg-ink-900 px-3.5 py-2.5 text-sm text-white shadow-pop animate-rise">
            {t.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-pulse-300" /> : t.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-alarm-100" /> : <Info className="mt-0.5 h-4 w-4 text-ink-200" />}
            {tr(t.text)}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function StatusPill({ label, cls, dot }: { label: string; cls: string; dot: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", cls)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      <LocalizedText message={label} />
    </span>
  );
}

/** Visible disclosure for simulated (demo) content. Never implies real clinical data or remote media. */
export function DemoNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("inline-flex items-center gap-1 rounded bg-caution-50 px-1.5 py-0.5 text-2xs font-medium text-caution-600", className)} data-demo-notice="true">
      <Info className="h-3 w-3 shrink-0" /> {children}
    </p>
  );
}
