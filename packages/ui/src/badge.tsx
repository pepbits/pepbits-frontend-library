import { useLocalization } from "@pepbits/i18n/react";
import React from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet";

/* The text colour is the -ink variant, not the accent. An accent over a wash of
   itself is the same hue at two lightnesses and lands around 3.7:1 — legible to
   an eye, short of AA, and the failure axe found on every status column in the
   product. The border and the fill still use the accent, because neither is
   text. See tokens.css for how the ink is derived. */
const classes: Record<BadgeTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]",
  brand: "border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[var(--primary-soft)] text-[var(--primary-strong)]",
  success: "border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success-ink)]",
  warning: "border-[color-mix(in_srgb,var(--warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning-ink)]",
  danger: "border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger-ink)]",
  info: "border-[color-mix(in_srgb,var(--info)_25%,transparent)] bg-[color-mix(in_srgb,var(--info)_10%,transparent)] text-[var(--info-ink)]",
  violet: "border-violet-300/40 bg-violet-500/10 text-violet-600 dark:text-violet-300",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  const {t} = useLocalization();
  return <span className={cn("inline-flex min-h-5 items-center gap-1 whitespace-nowrap rounded-[var(--radius)] border px-2 py-0.5 text-[length:calc(10px*var(--fs-scale))] font-bold leading-none", classes[tone], className)}>{typeof children === "string" ? t(children) : children}</span>;
}

export function statusTone(value: unknown): BadgeTone {
  const normalized = String(value).toLowerCase();
  if (["active", "paid", "approved", "fulfilled", "confirmed", "true", "low"].includes(normalized)) return "success";
  if (["pending", "open", "processing", "partially paid", "normal", "medium"].includes(normalized)) return "warning";
  if (["inactive", "overdue", "rejected", "critical", "high", "false"].includes(normalized)) return "danger";
  if (["on hold", "draft"].includes(normalized)) return "info";
  return "neutral";
}

export function StatusBadge({ value }: { value: unknown }) {
  const { t } = useLocalization();
  return <Badge tone={statusTone(value)}><span className="size-1.5 rounded-full bg-current" />{t(typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : String(value))}</Badge>;
}
