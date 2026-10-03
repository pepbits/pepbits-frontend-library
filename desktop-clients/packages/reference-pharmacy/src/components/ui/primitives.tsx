"use client";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { statusOf, type Tone } from "../../lib/format";
import { Card, SourceButton, SourceDateInput, SourceInput, SourceSelect, SourceTextarea, TableCell, TableHead } from "./controls";

/** Copy handed to a source component as a plain string is localized here; nodes (values, links) pass through. */
export function Copy({ children }: { children?: ReactNode }) {
  return typeof children === "string" ? <LocalizedText message={children} /> : <>{children}</>;
}

/* ── Buttons ─────────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
const VARIANT: Record<Variant, string> = {
  primary: "bg-cobalt text-on-cobalt hover:bg-cobalt-strong shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)] disabled:bg-cobalt/50",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2 hover:border-ink-3/50",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-danger-wash",
  quiet: "text-cobalt hover:bg-cobalt-wash",
};
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode; kbd?: string;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, kbd, className, children, disabled, title, ...rest }, ref,
) {
  const { t } = useLocalization();
  return (
    <SourceButton ref={ref} disabled={disabled || loading} title={title ? t(title) : undefined}
      className={cx("inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" && "h-7 px-2.5 text-xs", size === "md" && "h-8 px-3 text-[13px]", size === "lg" && "h-10 px-4 text-sm", VARIANT[variant], className)}
      {...rest}>
      {loading ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : icon}
      <Copy>{children}</Copy>
      {kbd && <Kbd className={cx("ml-1", variant === "primary" && "border-current/30 bg-transparent text-on-cobalt opacity-80")}>{kbd}</Kbd>}
    </SourceButton>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const { t } = useLocalization();
  return (
    <SourceButton aria-label={label} title={t(label)} className={cx("inline-flex size-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink", className)} {...rest}>
      {children}
    </SourceButton>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-ink-3", className)}>{children}</kbd>;
}

/* ── Status ──────────────────────────────────────────── */
export const TONE: Record<Tone, { text: string; bg: string; dot: string }> = {
  neutral: { text: "text-ink-2", bg: "bg-surface-3", dot: "bg-ink-3" },
  info: { text: "text-cobalt", bg: "bg-cobalt-wash", dot: "bg-cobalt" },
  ok: { text: "text-ok", bg: "bg-ok-wash", dot: "bg-ok" },
  warn: { text: "text-amber", bg: "bg-amber-wash", dot: "bg-amber-mark" },
  danger: { text: "text-danger", bg: "bg-danger-wash", dot: "bg-danger" },
  violet: { text: "text-violet", bg: "bg-violet-wash", dot: "bg-violet" },
  muted: { text: "text-ink-3", bg: "bg-surface-3", dot: "bg-line-strong" },
};

export function StatusPill({ status, className, label }: { status?: string | null; className?: string; label?: string }) {
  const s = statusOf(status);
  const t = TONE[s.tone];
  return (
    <span className={cx("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-1.5 text-[11.5px] font-medium", t.bg, t.text, className)}>
      <span className={cx("size-1.5 rounded-full", t.dot)} aria-hidden />
      <LocalizedText message={label ?? s.label} />
    </span>
  );
}

export function Tag({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  const t = TONE[tone];
  const { t: tr } = useLocalization();
  return <span title={title ? tr(title) : undefined} className={cx("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[5px] px-1.5 text-[11.5px] font-medium", t.bg, t.text, className)}><Copy>{children}</Copy></span>;
}

/* ── Segmented tabs with counts ──────────────────────── */
export interface SegItem<T extends string> { value: T; label: ReactNode; count?: number | string; tone?: Tone }
export function Segmented<T extends string>({ items, value, onChange, className, size = "md", disabled }: {
  items: SegItem<T>[]; value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md"; disabled?: boolean;
}) {
  return (
    <div role="tablist" className={cx("inline-flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <SourceButton key={it.value} role="tab" aria-selected={active} disabled={disabled} onClick={() => onChange(it.value)}
            className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]",
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(18,26,51,0.12)]" : "text-ink-2 hover:text-ink")}>
            <Copy>{it.label}</Copy>
            {it.count !== undefined && (
              <span className={cx("num rounded px-1 text-[11px]", active ? (it.tone ? `${TONE[it.tone].bg} ${TONE[it.tone].text}` : "bg-surface-3 text-ink-2") : "text-ink-3")}>{it.count}</span>
            )}
          </SourceButton>
        );
      })}
    </div>
  );
}

/* ── Form fields ─────────────────────────────────────── */
const widthOf = (c?: string) => (c && /(^|\s)flex-1/.test(c) ? "" : "w-full");
const fieldBase = "rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-3 transition-colors focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/20 disabled:opacity-60";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <SourceInput ref={ref} className={cx(fieldBase, widthOf(className), "h-8", className)} {...p} />;
});
/** Calendar-day field (ISO machine value) on the shared date control; use it instead of Input type="date". */
export const DateInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function DateInput({ className, ...p }, ref) {
  return <SourceDateInput ref={ref} className={cx(fieldBase, widthOf(className), "h-8", className)} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <SourceSelect ref={ref} className={cx(fieldBase, widthOf(className), "h-8 shrink-0 pr-7", className)} {...p}>{children}</SourceSelect>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <SourceTextarea ref={ref} className={cx(fieldBase, widthOf(className), "min-h-16 py-1.5", className)} {...p} />;
});
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-ink-2"><LocalizedText message={label} /></span>
      {children}
      {error ? <span className="text-xs text-danger"><LocalizedText message={error} /></span> : hint ? <span className="text-xs text-ink-3"><LocalizedText message={hint} /></span> : null}
    </label>
  );
}

/* ── Layout surfaces ─────────────────────────────────── */
export function Panel({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "aside" }) {
  return <Card as={As === "aside" ? "div" : As} radius="xl" shadow="none" className={cx("flex min-h-0 flex-col rounded-xl border border-line bg-surface", className)}>{children}</Card>;
}
export function PanelHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cx("flex min-h-11 shrink-0 items-center gap-3 border-b border-line px-4 py-2", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[13.5px] font-semibold text-ink"><Copy>{title}</Copy></h2>
        {sub && <p className="truncate text-xs text-ink-3"><Copy>{sub}</Copy></p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-surface-3 text-ink-3">{icon}</div>}
      <p className="text-sm font-semibold text-ink"><LocalizedText message={title} /></p>
      {body && <p className="max-w-xs text-[13px] text-ink-3"><LocalizedText message={body} /></p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-3", className)} />;
}
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  const { t } = useLocalization();
  return (
    <div className="flex flex-col gap-2 p-3" aria-busy aria-label={t("Loading")}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-12" />)}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="m-3 rounded-lg border border-danger/30 bg-danger-wash p-3 text-[13px] text-danger" role="alert">
      <p className="font-medium"><LocalizedText message={error.message} /></p>
      {onRetry && <SourceButton onClick={onRetry} className="mt-1 underline underline-offset-2"><LocalizedText message="Try again" /></SourceButton>}
    </div>
  );
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-cobalt-wash text-[11px] font-semibold text-cobalt", className)}>{initials}</span>;
}

export function Stat({ label, value, sub, tone, className }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <p className="truncate text-xs text-ink-3"><LocalizedText message={label} /></p>
      <p className={cx("num mt-0.5 truncate text-lg font-semibold leading-tight", tone ? TONE[tone].text : "text-ink")}>{value}</p>
      {sub && <p className="num truncate text-xs text-ink-3"><Copy>{sub}</Copy></p>}
    </div>
  );
}

/** Definition-list row used in detail panels. */
export function Meta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-[11.5px] text-ink-3"><LocalizedText message={label} /></dt>
      <dd className="truncate text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return <TableHead className={cx("sticky top-0 z-10 h-8 whitespace-nowrap border-b border-line bg-surface-2 px-3 text-[11.5px] font-medium text-ink-3", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left", className)}><Copy>{children}</Copy></TableHead>;
}
export function Td({ children, className, align = "left", colSpan }: { children?: ReactNode; className?: string; align?: "left" | "right" | "center"; colSpan?: number }) {
  return <TableCell colSpan={colSpan} className={cx("h-10 border-b border-line px-3 text-[13px]", align === "right" ? "num text-right" : align === "center" ? "text-center" : "", className)}>{children}</TableCell>;
}
