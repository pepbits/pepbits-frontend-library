"use client";

/* Source-compatible bridge over @pepbits/ops-ui. Page code keeps the Scholaris call-site API (icon=, sub=, tone="ok",
   <Select><option/></Select>, <Field label>…) while every control RENDERS the shared ops-ui component, so tenant
   theme, radius, font scale, localization and focus behaviour apply. Only Progress and the Toolbar layout row keep
   source markup: ops-ui has no linear progress primitive, and Toolbar is a flex row, not a control. */

import {
  Avatar as OpsAvatar, Badge as OpsBadge, Button as OpsButton, Card as OpsCard, CardHeader as OpsCardHeader, CardTitle,
  DateInput as OpsDateInput, TimeInput as OpsTimeInput, EmptyState, LocalizedText, ErrorState, Input as OpsInput, LoadingState, Select as OpsSelect, Skeleton as OpsSkeleton, StatCard,
  Tabs as OpsTabs, Textarea as OpsTextarea, type BadgeTone, type ButtonProps as OpsButtonProps,
} from "@pepbits/ops-ui";
import type { LucideIcon } from "lucide-react";
import {
  Children, cloneElement, createContext, Fragment, isValidElement, useContext, useId,
  type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { useFormat } from "../lib/format";
import { cn } from "../lib/utils";

/* ---------- Button ---------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
const VARIANT: Record<BtnVariant, OpsButtonProps["variant"]> = { primary: "primary", secondary: "secondary", ghost: "ghost", danger: "danger", subtle: "secondary" };
/* The source's brand-tint "subtle" button has no ops-ui variant; it is a secondary button carrying the tint. */
const SUBTLE = "border-transparent bg-brand/10 text-brand hover:bg-brand/15";
export interface ButtonProps extends Omit<OpsButtonProps, "variant" | "size" | "leftIcon"> {
  variant?: BtnVariant;
  size?: "xs" | "sm" | "md";
  icon?: LucideIcon;
}
export function Button({ variant = "secondary", size = "sm", icon: Icon, className, children, ...rest }: ButtonProps) {
  const iconOnly = children === undefined || children === null || children === false;
  return (
    <OpsButton
      variant={VARIANT[variant]}
      size={size}
      leftIcon={Icon ? <Icon className={size === "md" ? "size-4" : "size-3.5"} aria-hidden /> : undefined}
      className={cn(variant === "subtle" && SUBTLE, iconOnly && (size === "xs" ? "w-7 px-0" : size === "sm" ? "w-8 px-0" : "w-9 px-0"), className)}
      {...rest}
    >
      {children}
    </OpsButton>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <OpsCard shadow="none" className={className} {...rest}>{children}</OpsCard>;
}
export function CardHeader({ title, sub, action, icon: Icon, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; icon?: LucideIcon; className?: string }) {
  const textual = typeof title === "string" && (sub === undefined || typeof sub === "string");
  return (
    <OpsCardHeader className={cn("min-h-10 px-3 py-1.5", className)}>
      {Icon && <Icon className="size-4 shrink-0 text-brand" aria-hidden />}
      {textual ? <CardTitle title={title as string} subtitle={sub as string | undefined} action={action} /> : (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold">{title}</h2>
            {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
          </div>
          {action}
        </div>
      )}
    </OpsCardHeader>
  );
}

/* ---------- Badge ---------- */
export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "brand";
const BADGE_TONE: Record<Tone, BadgeTone> = { neutral: "neutral", ok: "success", warn: "warning", bad: "danger", info: "info", brand: "brand" };
export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <OpsBadge tone={BADGE_TONE[tone]} className={className}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </OpsBadge>
  );
}
/** Scholaris status vocabulary → tone (the ops-ui statusTone covers ERP statuses, not these). */
export const statusTone = (s: string): Tone =>
  ({
    Active: "ok", Paid: "ok", Graded: "ok", Completed: "ok", Returned: "ok", Published: "ok", Enrolled: "ok", Submitted: "info", Present: "ok",
    Partial: "warn", Due: "warn", Late: "warn", Scheduled: "info", Issued: "info", Draft: "neutral", Open: "brand", "On leave": "warn",
    Overdue: "bad", Missing: "bad", Inactive: "neutral", Closed: "neutral", Declined: "bad", Live: "bad", Ended: "neutral", Urgent: "bad", Important: "warn",
    Offered: "brand", Interview: "info", Screening: "warn", Applied: "neutral",
  } as Record<string, Tone>)[s] ?? "neutral";

/* ---------- Avatar ---------- */
/** Source sizes were pixels; ops-ui has four steps. The name is still the colour seed and the person's identity. */
/** Source sizes are exact pixels (20–88). The shared Avatar keeps its name-seeded colour and initials; a sized
    wrapper plus the scoped `.school-avatar` rule makes it fill exactly the requested size. */
export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  return (
    <span className={cn("school-avatar inline-flex shrink-0 rounded-full", className)} style={{ width: size, height: size, "--school-avatar-size": `${size}px` } as React.CSSProperties}>
      <OpsAvatar name={name} size="md" decorative />
    </span>
  );
}

/* ---------- Form fields ---------- */
interface FieldProps { label?: string; hint?: string; error?: string; required?: boolean }
/** Set by a <Field> whose child is not a single bridged control, so nested controls can name themselves by it. */
const FieldLabel = createContext<string | undefined>(undefined);
function useLabelledBy(props: { "aria-label"?: string; "aria-labelledby"?: string; label?: string }) {
  const id = useContext(FieldLabel);
  return !props.label && !props["aria-label"] && !props["aria-labelledby"] && id ? { "aria-labelledby": id } : {};
}

/** Form controls read the form font scale; the module root reads the shell scale and tables the result scale. */
const FORM_SCALE = "[--fs-scale:var(--fs-form)]";

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldProps & { invalid?: boolean; ref?: React.Ref<HTMLInputElement> };
export function Input({ className, invalid, ...p }: InputProps) {
  const named = useLabelledBy(p);
  return <OpsInput className={cn(FORM_SCALE, className)} aria-invalid={invalid || undefined} {...named} {...(p as Omit<typeof p, "prefix">)} />;
}

/** Native date/time machine values (YYYY-MM-DD, HH:MM) through the shared date/time controls. */
export function DateInput({ className, invalid, ...p }: Omit<InputProps, "type">) {
  const named = useLabelledBy(p);
  return <OpsDateInput className={cn(FORM_SCALE, className)} aria-invalid={invalid || undefined} {...named} {...(p as Omit<typeof p, "prefix">)} />;
}
export function TimeInput({ className, invalid, ...p }: Omit<InputProps, "type">) {
  const named = useLabelledBy(p);
  return <OpsTimeInput className={cn(FORM_SCALE, className)} aria-invalid={invalid || undefined} {...named} {...(p as Omit<typeof p, "prefix">)} />;
}

type OptionEl = ReactElement<{ value?: string | number; children?: ReactNode }>;
/** The option's label as source English. A localized-text element (ops-ui LocalizedText, which the localization
    pass inserts as <ReferenceText message="…">) contributes its message, not its rendered translation: ops-ui Select
    translates labels itself, so passing English keeps translation in one place and never touches option values. */
const optionText = (children: ReactNode): string =>
  Children.toArray(children).map((c) => {
    if (typeof c === "string" || typeof c === "number") return String(c);
    if (!isValidElement<{ children?: ReactNode; message?: unknown }>(c)) return "";
    if (c.type === LocalizedText || typeof c.props.message === "string") return String(c.props.message ?? "");
    return optionText(c.props.children);
  }).join("");
function collectOptions(children: ReactNode, out: { label: string; value: string }[] = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) { collectOptions((child as ReactElement<{ children?: ReactNode }>).props.children, out); return; }
    if (child.type === "option") {
      const el = child as OptionEl;
      const label = optionText(el.props.children);
      out.push({ label, value: el.props.value !== undefined ? String(el.props.value) : label });
    }
  });
  return out;
}
/** Accepts the source's <option> children and renders the ops-ui Select with an options array. An empty-value
    option becomes the ops-ui placeholder so it is not listed twice. */
export function Select({ className, invalid, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { invalid?: boolean }) {
  const named = useLabelledBy(p);
  const all = collectOptions(children);
  const blank = all.find((o) => o.value === "");
  return <OpsSelect className={cn(FORM_SCALE, className)} aria-invalid={invalid || undefined} {...named} {...p} placeholder={blank?.label ?? ""} options={all.filter((o) => o !== blank)} />;
}

export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const named = useLabelledBy(p);
  return <OpsTextarea className={cn(FORM_SCALE, className)} {...named} {...p} />;
}

const BRIDGED: unknown[] = [Input, DateInput, TimeInput, Select, Textarea];
/** Source <Field label error hint required>. A single bridged control receives the label/hint/error itself (ops-ui
    FieldShell: label wraps the control, hint/error are aria-describedby). Composite children get a named group. */
export function Field({ label, error, hint, required, children, className }: { label: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  const id = useId();
  const only = Children.toArray(children);
  if (only.length === 1 && isValidElement(only[0]) && BRIDGED.includes(only[0].type)) {
    const el = only[0] as ReactElement<FieldProps & { className?: string }>;
    return cloneElement(el, { label, error, hint, required, className: cn(className, el.props.className) });
  }
  return (
    <div role="group" aria-labelledby={id} className={cn("flex min-w-0 flex-col", FORM_SCALE, className)}>
      <span id={id} className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-muted">
        {label}
        {required && <span className="text-bad">*</span>}
      </span>
      <FieldLabel.Provider value={id}>{children}</FieldLabel.Provider>
      {error ? <span className="mt-1 text-[10px] font-semibold text-bad">{error}</span> : hint ? <span className="mt-1 text-[10px] text-faint">{hint}</span> : null}
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ value, onChange, items, className, size = "sm" }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; className?: string; size?: "sm" | "xs" }) {
  return (
    <OpsTabs
      variant="segmented"
      value={value}
      onChange={(v) => onChange(v as T)}
      items={items.map((it) => ({ id: it.value, label: it.label, badge: it.count }))}
      className={cn("inline-flex shrink-0", size === "xs" && "[&_button]:h-7", className)}
    />
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, max = 100, tone, className }: { value: number; max?: number; tone?: "ok" | "warn" | "bad" | "brand"; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const t = tone ?? (pct >= 85 ? "ok" : pct >= 70 ? "brand" : pct >= 50 ? "warn" : "bad");
  const bg = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", brand: "bg-brand" }[t];
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line/70", className)}>
      <div className={cn("h-full rounded-full transition-all", bg)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Skeleton / Empty / Spinner ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <OpsSkeleton className={className} />;
}
export function Spinner({ label = "Loading" }: { label?: string }) {
  return <LoadingState title={label} description="" />;
}
export function Empty({ title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return <EmptyState title={title} description={text ?? ""} action={action} />;
}
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <ErrorState detail={message} onRetry={onRetry} />;
}

/* ---------- Toolbar ---------- */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/* ---------- KPI ---------- */
const KPI_TONE = { brand: "text-brand", ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-info" } as const;
/** Source KPI tile → ops-ui StatCard. The source's unlabelled trend percentage is compared against the tile's own sub-line. */
/** Source KPI tile on the shared StatCard. The scoped `.school-kpi` rules restore the source's compact horizontal
    layout (tinted icon on the left, small label, value, sub-line, inline trend) without copying the card. */
export function Kpi({ label, value, sub, icon: Icon, tone = "brand", trend }: { label: string; value: ReactNode; sub?: string; icon?: LucideIcon; tone?: keyof typeof KPI_TONE; trend?: number }) {
  const { fmtNum } = useFormat();
  return (
    <StatCard
      className={cn("school-kpi", `school-kpi-${tone}`)}
      label={label}
      value={<span className="tabular">{typeof value === "number" ? fmtNum(value) : value}</span>}
      hint={trend === undefined ? sub : undefined}
      trend={trend === undefined ? undefined : { direction: trend > 0 ? "up" : trend < 0 ? "down" : "flat", delta: `${trend > 0 ? "+" : trend < 0 ? "−" : ""}${Math.abs(trend)}%`, comparedTo: sub ?? "" }}
      tone={tone === "bad" ? "inverse" : "auto"}
      icon={Icon ? <Icon className={cn("size-4", KPI_TONE[tone])} /> : undefined}
    />
  );
}
