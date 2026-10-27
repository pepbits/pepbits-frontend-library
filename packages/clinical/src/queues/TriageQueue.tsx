"use client";
import React, {useMemo} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Gauge} from "@pepbits/icons";
import {Badge, Button, Skeleton, cn} from "@pepbits/ui";
import {EmptyState, ErrorState} from "@pepbits/components";
import {useClinicalActor} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import {EMERGENCY_TRIAGE, type IntakeProfile} from "../context/profiles";
import {ClinicalPanel, TEXT} from "../layout/panel";
import {ESI_LEVELS} from "../triage/model";
import {EsiLevelChip} from "../triage/EsiLevelChip";
import type {QueueRow} from "../types";
import {PatientFlags, QueueHeader, StaleListNotice, WaitTime} from "./QueueParts";
import {useEncounterRows} from "./useEncounterRows";

/** Roles that may save emergency triage. UI gating only: the API rejects anyone else. */
export const TRIAGE_ROLES = ["nurse", "doctor"];

/** One patient waiting for triage: wait (red after 15 minutes), name, age, sex, reason and the action. */
export function TriageWaitingRow({row, action}: {row: QueueRow; action: React.ReactNode}) {
  const {t} = useLocalization();
  return <li className="flex flex-wrap items-center gap-3 px-4 py-3">
    <WaitTime minutes={row.waitingMinutes} alertAfter={15} className="w-20 text-[length:calc(17px*var(--fs-scale))] font-bold"/>
    <div className="min-w-0 flex-1">
      <p className={cn("font-bold", TEXT.body)} data-phi>{row.patient.name}<PatientFlags patient={row.patient}/></p>
      <p className={TEXT.muted}>{row.patient.age !== undefined ? `${row.patient.age} y ${row.patient.sex ?? ""} · ` : ""}{row.reason ?? t("Reason not given")}</p>
    </div>
    {action}
  </li>;
}

/** Patients waiting for triage and how many triaged patients are at each ESI level. */
export function EsiLevelCounts({rows, waitingStatus = "waiting-triage"}: {rows: QueueRow[] | null; waitingStatus?: string}) {
  const {t} = useLocalization();
  const waiting = rows?.filter(r => r.status === waitingStatus).length;
  const byLevel = ESI_LEVELS.map(level => rows?.filter(r => r.status !== waitingStatus && r.acuity === level).length);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
    <div className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_7%,var(--surface))] px-4 py-3">
      <p className={cn(TEXT.muted, "text-[var(--danger-ink)]")}>{t("Waiting for triage")}</p>
      <p className="text-[length:calc(28px*var(--fs-scale))] font-bold leading-none tabular-nums text-[var(--danger-ink)]">{waiting ?? "–"}</p>
    </div>
    {ESI_LEVELS.map((level, i) => <div key={level} className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <EsiLevelChip level={level}/>
      <div><p className={TEXT.muted}>ESI {level}</p><p className="text-[length:calc(22px*var(--fs-scale))] font-bold leading-none tabular-nums text-[var(--text)]">{byLevel[i] ?? "–"}</p></div>
    </div>)}
  </div>;
}

/**
 * The emergency triage worklist: patients in `waiting-triage`, longest wait first, refreshed every
 * 20 seconds. Registered nurses and doctors get "Triage now"; everyone else sees "Awaiting triage".
 */
export function TriageQueue({profile = EMERGENCY_TRIAGE, onTriage, refreshMs = 20_000}: {profile?: IntakeProfile; onTriage: (row: QueueRow) => void; refreshMs?: number}) {
  const {actor} = useClinicalActor();
  const {rows, error, reload} = useEncounterRows(profile.encounterClass, refreshMs);
  const waiting = useMemo(() => (rows ?? []).filter(r => profile.waitingStatuses.includes(r.status)).sort((a, b) => b.waitingMinutes - a.waitingMinutes), [rows, profile]);
  const canTriage = !!actor && TRIAGE_ROLES.includes(actor.role);
  return <div className="grid gap-3">
    <QueueHeader title="Triage" subtitle="Patients waiting to be triaged, longest wait first." onRefresh={reload}/>
    {error && !rows ? <ErrorState title="Couldn’t load the queue" description={problemsOf(error).join(" ")} onRetry={reload}/> :
      <ClinicalPanel title="Waiting for triage" icon={<Gauge className="size-4"/>} bodyClassName="">
        {!rows ? <div className="p-4" aria-busy="true"><Skeleton className="h-12"/></div>
          : !waiting.length ? <EmptyState title="Nobody is waiting for triage" description="New arrivals appear here within 20 seconds."/>
          : <ul className="divide-y divide-[var(--border)]">
            {waiting.map(row => <TriageWaitingRow key={row.id} row={row} action={canTriage
              ? <Button size="sm" variant="danger" leftIcon={<Gauge className="size-4"/>} onClick={() => onTriage(row)}>Triage now</Button>
              : <Badge tone="warning">Awaiting triage</Badge>}/>)}
          </ul>}
      </ClinicalPanel>}
    <StaleListNotice show={!!error && !!rows}/>
  </div>;
}
