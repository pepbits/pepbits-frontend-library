"use client";
import React, {type ReactNode} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {cn} from "@pepbits/ui";
import {Card} from "@pepbits/components";

export const TEXT = {
  heading: "text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]",
  body: "text-[length:calc(12.5px*var(--fs-scale))] text-[var(--text)]",
  muted: "text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]",
  label: "text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]",
} as const;

/** A titled section of a clinical form, on the shared Card. */
export function ClinicalPanel({title, subtitle, icon, actions, tone, className, bodyClassName = "p-4", children}: {
  title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode; tone?: "danger" | "warning";
  className?: string; bodyClassName?: string; children: ReactNode;
}) {
  const {t} = useLocalization();
  return <Card as="section" aria-label={t(title)} className={cn("min-w-0 overflow-hidden",
    tone === "danger" && "border-[color-mix(in_srgb,var(--danger)_35%,var(--border))]", tone === "warning" && "border-[color-mix(in_srgb,var(--warning)_40%,var(--border))]", className)}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-[var(--primary)]" aria-hidden="true">{icon}</span> : null}
        <div className="min-w-0"><h2 className={TEXT.heading}>{t(title)}</h2>{subtitle ? <p className={cn("mt-0.5", TEXT.muted)}>{t(subtitle)}</p> : null}</div>
      </div>
      {actions}
    </header>
    <div className={bodyClassName}>{children}</div>
  </Card>;
}

/** A labelled group around a non-input control (segmented choice, score buttons); the control carries the accessible name. */
export function ChoiceField({label, required, hint, error, aside, className, children}: {
  label: string; required?: boolean; hint?: string; error?: string; aside?: ReactNode; className?: string; children: ReactNode;
}) {
  const {t} = useLocalization();
  return <div className={cn("min-w-0", className)}>
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className={cn("flex items-center gap-1", TEXT.label)} aria-hidden="true">{t(label)}{required ? <span className="text-[var(--danger-ink)]">*</span> : null}</span>
      {aside}
    </div>
    {children}
    {error ? <p className="mt-1 text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</p>
      : hint ? <p className="mt-1 text-[length:calc(10px*var(--fs-scale))] text-[var(--text-subtle)]">{t(hint)}</p> : null}
  </div>;
}

/** Problems that block saving, as one danger notice with a list. */
export function ProblemNotice({title = "Check these before saving:", problems}: {title?: string; problems: string[]}) {
  const {t} = useLocalization();
  if (!problems.length) return null;
  return <div role="alert" className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] px-4 py-3 text-[length:calc(12px*var(--fs-scale))] text-[var(--danger-ink)]">
    <p className="font-bold">{t(title)}</p>
    <ul className="mt-1 list-disc space-y-0.5 ps-5">{problems.map(problem => <li key={problem}>{t(problem)}</li>)}</ul>
  </div>;
}
