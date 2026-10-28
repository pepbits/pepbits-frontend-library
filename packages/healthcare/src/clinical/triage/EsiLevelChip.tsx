"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {cn} from "@pepbits/ui";
import type {EsiLevel} from "./model";

const LEVEL: Record<EsiLevel, string> = {
  1: "border-[var(--danger-fill)] bg-[var(--danger-fill)] text-white",
  2: "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_14%,var(--surface))] text-[var(--danger-ink)]",
  3: "border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-[var(--warning-ink)]",
  4: "border-[var(--success)] bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success-ink)]",
  5: "border-[var(--info)] bg-[color-mix(in_srgb,var(--info)_12%,var(--surface))] text-[var(--info-ink)]",
};

/** An ESI level as a coloured chip ("Not triaged" without one). `lg` spells out "ESI 2". */
export function EsiLevelChip({level, size = "md"}: {level?: number | null; size?: "md" | "lg"}) {
  const {t} = useLocalization();
  if (!level || !(level in LEVEL)) return <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{t("Not triaged")}</span>;
  return <span role="img" aria-label={`${t("ESI level")} ${level}`} className={cn("inline-flex items-center justify-center rounded-[8px] border-2 font-bold tabular-nums", LEVEL[level as EsiLevel],
    size === "lg" ? "h-10 min-w-10 px-2 text-[length:calc(17px*var(--fs-scale))]" : "h-6 min-w-6 px-1.5 text-[length:calc(12px*var(--fs-scale))]")}>
    {size === "lg" ? `ESI ${level}` : level}
  </span>;
}
