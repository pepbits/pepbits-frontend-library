"use client";
import { SourceButton, SourceDateInput, SourceInput, SourceTextarea, SourceSelect } from "./controls";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Card, Drawer as SharedDrawer, LocalizedText, Modal as SharedModal, useLocalization } from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { useQualityFormat } from "../lib/format";
import { cls } from "../lib/format";

/** Copy handed to a source component as a plain string is localized here; nodes (values, links) pass through. */
export function Copy({ children }: { children?: ReactNode }) {
  return typeof children === "string" ? <LocalizedText message={children} /> : <>{children}</>;
}

// ---------- Buttons ----------
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-strong border border-primary-strong/40",
  secondary: "bg-panel text-ink border border-line-strong hover:bg-surface",
  ghost: "text-ink-2 hover:bg-ink/5 border border-transparent",
  danger: "bg-panel text-bad border border-bad/40 hover:bg-bad-soft",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }) {
  return (
    <SourceButton
      {...rest}
      disabled={disabled || loading}
      className={cls(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      <Copy>{children}</Copy>
    </SourceButton>
  );
}

// ---------- Layout ----------
export function PageHeader({ title, description, actions, meta }: { title: string; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink"><Copy>{title}</Copy></h1>
        {description && <p className="mt-1.5 max-w-[70ch] text-sm text-ink-2"><Copy>{description}</Copy></p>}
        {meta && <div className="mt-2 text-xs text-ink-3"><Copy>{meta}</Copy></div>}
      </div>
      {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <Card as="section" id={id} shadow="none" className={cls("rounded-lg border border-line bg-panel", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink"><Copy>{title}</Copy></h2>}
            {description && <p className="mt-0.5 text-xs text-ink-3"><Copy>{description}</Copy></p>}
          </div>
          {actions && <div className="no-print flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cls(bodyClassName ?? "p-4")}>{children}</div>
    </Card>
  );
}

// ---------- Form controls ----------
const control = "h-9 rounded-md border border-line-strong bg-panel px-3 text-sm text-ink placeholder:text-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:bg-surface disabled:text-ink-3";

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <label className={cls("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2"><Copy>{label}</Copy></span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-3"><Copy>{hint}</Copy></span>}
      {error && <span className="mt-1 block text-xs text-bad" role="alert">{error}</span>}
    </label>
  );
}

/** Controls fill their container unless the caller gives an explicit width. */
const width = (className?: string) => (/(^|\s)(w|min-w|flex)-/.test(className ?? "") ? "" : "w-full");

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <SourceInput {...rest} className={cls(control, width(className), className)} />;
}

/** Date, time and local date-time fields: native machine values (ISO), the shared SourceDateInput for dates. */
export function DateInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <SourceDateInput {...rest} className={cls(control, width(className), className)} />;
}
export function TimeInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <SourceInput {...rest} type="time" className={cls(control, width(className), className)} />;
}
export function DateTimeInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <SourceInput {...rest} type="datetime-local" className={cls(control, width(className), className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <SourceTextarea {...rest} className={cls(control, "h-auto min-h-[84px] w-full py-2 leading-relaxed", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <SourceSelect {...rest} className={cls(control, width(className), "appearance-none bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7f87' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </SourceSelect>
  );
}

export function Checkbox({ checked, onChange, label, disabled, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className={cls("inline-flex items-center gap-2 text-sm", disabled ? "opacity-50" : "cursor-pointer")}>
      <SourceInput ref={ref} type="checkbox" className="size-4 rounded border-line-strong accent-[var(--color-primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <Copy>{label}</Copy>
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <SourceButton type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink-2 disabled:opacity-50">
      <span className={cls("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-primary" : "bg-line-strong")}>
        <span className={cls("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4.5" : "translate-x-0.5")} />
      </span>
      <Copy>{label}</Copy>
    </SourceButton>
  );
}

// ---------- Badges ----------
export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "primary";
const tones: Record<Tone, string> = {
  neutral: "bg-ink/[0.06] text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  primary: "bg-primary-soft text-primary",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cls("inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const RESULT_TONE: Record<string, Tone> = { draft: "neutral", submitted: "info", verified: "primary", approved: "ok", rejected: "bad" };
export function ResultStatus({ status }: { status: string }) {
  return (
    <Badge tone={RESULT_TONE[status] ?? "neutral"} dot>
      <Copy>{status.charAt(0).toUpperCase() + status.slice(1)}</Copy>
    </Badge>
  );
}

const SUBMISSION_TONE: Record<string, Tone> = { pending_approval: "warn", approved: "primary", transmitted: "info", accepted: "ok", rejected: "bad", cancelled: "neutral" };
export function SubmissionStatus({ status }: { status: string }) {
  const label = { pending_approval: "Awaiting approval", approved: "Approved", transmitted: "Transmitted", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled" }[status] ?? status;
  return (
    <Badge tone={SUBMISSION_TONE[status] ?? "neutral"} dot>
      <Copy>{label}</Copy>
    </Badge>
  );
}

// ---------- Overlays ----------
/**
 * Shared overlays may be rendered outside the module root (a portal), where the scoped .reference-quality utilities would not
 * reach their content. The body and footer are therefore wrapped in the same scope class (transparent, inheriting the host theme
 * through data-theme); the shared Modal/Drawer keep their own focus trap, Escape handling and focus restore.
 */
function OverlayScope({ children, className }: { children: ReactNode; className?: string }) {
  const { preferences } = useReferenceHost();
  return <div className={cls("reference-quality", className)} data-overlay="true" data-theme={preferences.theme}>{children}</div>;
}

/** Shared overlay: focus trap, Escape, focus restore, localized title. `wide` keeps the source's two dialog widths. */
export function Modal({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <SharedModal open={open} onClose={onClose} title={title} size="md" className={wide ? "max-w-3xl" : "max-w-lg"} footer={footer ? <OverlayScope className="flex justify-end gap-2">{footer}</OverlayScope> : undefined}>
      <OverlayScope className="px-5 py-4">
        {description && <p className="mb-3 text-sm text-ink-2"><Copy>{description}</Copy></p>}
        {children}
      </OverlayScope>
    </SharedModal>
  );
}

export function Drawer({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <SharedDrawer open={open} onClose={onClose} title={title} subtitle={subtitle} width="lg">
      <OverlayScope className="px-5 py-4">{children}</OverlayScope>
    </SharedDrawer>
  );
}

/** Asks for a comment/reason before confirming an action. */
export function PromptModal({
  open,
  onClose,
  title,
  description,
  label = "Comment",
  required,
  confirmLabel,
  danger,
  onConfirm,
  placeholder,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  label?: string;
  required?: boolean;
  confirmLabel: string;
  danger?: boolean;
  placeholder?: string;
  onConfirm: (text: string) => Promise<void> | void;
}) {
  const { t } = useLocalization();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            disabled={required && !text.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(text.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={required ? label : t("{value0} (optional)", { value0: t(label) })}>
        <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      </Field>
    </Modal>
  );
}

// ---------- States ----------
export function Loading({ rows = 4, className }: { rows?: number; className?: string }) {
  const { t } = useLocalization();
  return (
    <div className={cls("space-y-2", className)} aria-busy="true" aria-label={t("Loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded bg-ink/[0.05]" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-bad/30 bg-bad-soft/60 p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />
      <div className="flex-1">
        <p className="font-medium text-ink"><LocalizedText message="This view could not load." /></p>
        <p className="mt-0.5 text-ink-2">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}><LocalizedText message="Try again" /></Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-surface p-3 text-ink-3">{icon ?? <Inbox className="size-5" />}</div>
      <p className="text-sm font-medium text-ink"><Copy>{title}</Copy></p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-3"><Copy>{children}</Copy></p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <SourceButton
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cls(
            "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
            value === it.id ? "border-primary font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          <Copy>{it.label}</Copy>
          {it.count !== undefined && <span className="num rounded bg-ink/[0.06] px-1.5 text-xs text-ink-2">{it.count}</span>}
        </SourceButton>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-ink-3"><Copy>{label}</Copy></div>
      <div className={cls("num mt-1 text-xl font-semibold tracking-tight", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "bad" && "text-bad")}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3"><Copy>{sub}</Copy></div>}
    </div>
  );
}

export function Pager({ total, offset, limit, onChange }: { total: number; offset: number; limit: number; onChange: (offset: number) => void }) {
  const { fmtNumber } = useQualityFormat();
  const end = Math.min(total, offset + limit);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink-3">
      <span className="num">
        {total ? <LocalizedText message="{value0}–{value1} of {value2}" values={{ value0: fmtNumber(offset + 1), value1: fmtNumber(end), value2: fmtNumber(total) }} /> : <LocalizedText message="No rows" />}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}><LocalizedText message="Previous" /></Button>
        <Button size="sm" variant="secondary" disabled={end >= total} onClick={() => onChange(offset + limit)}><LocalizedText message="Next" /></Button>
      </div>
    </div>
  );
}
