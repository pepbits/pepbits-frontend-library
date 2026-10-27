"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {RefreshCw} from "@pepbits/icons";
import {Badge, Button, cn} from "@pepbits/ui";
import {TEXT} from "../layout/panel";
import {waitLabel} from "../time";
import type {ClinicalPatientLite} from "../types";

/** A worklist's page title, description and Refresh button. */
export function QueueHeader({title, subtitle, onRefresh}: {title: string; subtitle?: string; onRefresh: () => void}) {
  const {t} = useLocalization();
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div><h1 className="text-[length:calc(22px*var(--fs-scale))] font-bold tracking-tight text-[var(--text)]">{t(title)}</h1>{subtitle ? <p className={TEXT.muted}>{t(subtitle)}</p> : null}</div>
    <Button variant="ghost" leftIcon={<RefreshCw className="size-4"/>} onClick={onRefresh}>Refresh</Button>
  </header>;
}

/** Minutes waited ("12 min", "1 h 5 min"), in danger colour once past `alertAfter` minutes. */
export function WaitTime({minutes, alertAfter, className}: {minutes: number; alertAfter?: number; className?: string}) {
  return <span className={cn("tabular-nums", alertAfter !== undefined && minutes > alertAfter && "font-bold text-[var(--danger-ink)]", className)}>{waitLabel(minutes)}</span>;
}

/** Restricted record and unidentified patient flags beside a name. */
export function PatientFlags({patient}: {patient: ClinicalPatientLite}) {
  return <>
    {patient.restricted ? <Badge tone="warning" className="ms-1.5">Restricted</Badge> : null}
    {patient.identityStatus === "unknown" ? <Badge tone="danger" className="ms-1.5">Unidentified</Badge> : null}
  </>;
}

/** Shown under a list whose last refresh failed. */
export function StaleListNotice({show}: {show: boolean}) {
  const {t} = useLocalization();
  return show ? <p role="status" className={cn(TEXT.muted, "text-[var(--warning-ink)]")}>{t("The last refresh failed; showing the previous list.")}</p> : null;
}
