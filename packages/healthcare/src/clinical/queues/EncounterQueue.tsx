"use client";
import React, {useMemo, useState, type ReactNode} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Badge, Skeleton, cn, type BadgeTone} from "@pepbits/ui";
import {EmptyState, ErrorState, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow} from "@pepbits/components";
import {problemsOf} from "../context/port";
import {TEXT} from "../layout/panel";
import {useClock} from "../time";
import {PatientFlags, QueueHeader, StaleListNotice, WaitTime} from "./QueueParts";
import {useEncounterRows} from "./useEncounterRows";
import type {EncounterClass, QueueRow} from "../types";

export interface QueueStage { key: string; label: string; tone: BadgeTone }

/** The outpatient journey from arrival to a signed note. */
export const OUTPATIENT_STAGES: QueueStage[] = [
  {key: "registered", label: "Arrived", tone: "neutral"},
  {key: "intake", label: "Nurse intake", tone: "warning"},
  {key: "ready", label: "Ready for doctor", tone: "brand"},
  {key: "in-consult", label: "In consultation", tone: "violet"},
  {key: "signed", label: "Note signed", tone: "success"},
];

const BAR: Record<BadgeTone, string> = {neutral: "bg-[var(--border-strong)]", brand: "bg-[var(--primary)]", success: "bg-[var(--success)]", warning: "bg-[var(--warning)]", danger: "bg-[var(--danger)]", info: "bg-[var(--info)]", violet: "bg-[var(--accent,var(--primary))]"};

/**
 * Today's encounters of one class with stage counts, a stage filter and safety badges, refreshed
 * every 30 seconds. `statuses` limits the rows (for example the intake worklist); `actions` renders
 * each row's buttons, so the same queue serves intake, consultation, emergency and ward lists.
 */
export function EncounterQueue({encounterClass, stages, statuses, title, subtitle, actions, refreshMs = 30_000, reloadKey}: {
  encounterClass: EncounterClass; stages: QueueStage[]; statuses?: string[]; title: string; subtitle?: string;
  actions?: (row: QueueRow, reload: () => void) => ReactNode; refreshMs?: number; reloadKey?: unknown;
}) {
  const {t} = useLocalization();
  const clock = useClock();
  const {rows, error, reload} = useEncounterRows(encounterClass, refreshMs, reloadKey);
  const [filter, setFilter] = useState<string | null>(null);

  const visible = useMemo(() => (rows ?? []).filter(row => (!statuses || statuses.includes(row.status)) && (!filter || row.status === filter)), [rows, statuses, filter]);
  const counts = useMemo(() => Object.fromEntries(stages.map(stage => [stage.key, (rows ?? []).filter(row => row.status === stage.key).length])), [rows, stages]);

  return <div className="grid gap-3">
    <QueueHeader title={title} subtitle={subtitle} onRefresh={reload}/>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" role="group" aria-label={t("Filter by stage")}>
      {stages.map((stage, i) => <button key={stage.key} type="button" onClick={() => setFilter(filter === stage.key ? null : stage.key)} aria-pressed={filter === stage.key}
        className={cn("focus-ring relative overflow-hidden rounded-[var(--radius)] border bg-[var(--surface)] px-4 py-3 text-start transition-colors hover:border-[var(--border-strong)]",
          filter === stage.key ? "border-[var(--primary)] ring-2 ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]" : "border-[var(--border)]")}>
        <span className={TEXT.muted}>{i + 1}. {t(stage.label)}</span>
        <span className="mt-0.5 block text-[length:calc(26px*var(--fs-scale))] font-bold leading-none tabular-nums text-[var(--text)]">{rows ? counts[stage.key] : "–"}</span>
        <span className={cn("absolute bottom-0 start-0 h-[3px] w-full", BAR[stage.tone])} aria-hidden="true"/>
      </button>)}
    </div>
    {error && !rows ? <ErrorState title="Couldn’t load the queue" description={problemsOf(error).join(" ")} onRetry={reload}/>
      : !rows ? <div className="grid gap-2" aria-busy="true">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12"/>)}</div>
      : !visible.length ? <EmptyState title="No one here right now" description={filter ? "Clear the stage filter to see everyone." : "New arrivals appear automatically every 30 seconds."}/>
      : <TableContainer overflow="horizontal" className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
        <Table className="w-full min-w-[860px] text-start">
          <TableHeader className={cn("bg-[var(--surface-2)] text-start", TEXT.muted)}>
            <TableRow>{["Patient", "Reason", "Stage", "Waiting", "Safety", "Clinician"].map(h => <TableHead key={h} className="px-3 py-2 text-start font-bold">{t(h)}</TableHead>)}<TableHead className="px-3 py-2"><span className="sr-only">{t("Actions")}</span></TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(row => {
              const stage = stages.find(s => s.key === row.status);
              return <TableRow key={row.id} className="border-t border-[var(--border)]">
                <TableCell className="px-3 py-2.5">
                  <p className={cn("font-bold", TEXT.body)} data-phi>{row.patient.name}<PatientFlags patient={row.patient}/></p>
                  <p className={cn("tabular-nums", TEXT.muted)}><span data-phi>{row.patient.mrn}</span>{row.patient.age !== undefined ? <> · {row.patient.age} y {row.patient.sex?.[0]?.toUpperCase()}</> : null} · {t("arrived")} {clock(row.arrivedAt)}</p>
                </TableCell>
                <TableCell className={cn("max-w-[220px] px-3 py-2.5", TEXT.body)}>
                  <span className="block truncate">{row.reason ?? "—"}</span>
                  <span className={cn("flex flex-wrap items-center gap-1", TEXT.muted)}>{row.department}
                    {row.mode === "video" ? <Badge tone="info">Video</Badge> : row.mode === "phone" ? <Badge tone="info">Phone</Badge> : null}
                    {row.visitType === "referral" ? <span title={row.referral ? `${t("Referred by")} ${row.referral.referrerName}${row.referral.organisation ? `, ${row.referral.organisation}` : ""}` : undefined}><Badge tone="info">Referral</Badge></span> : null}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2.5"><Badge tone={stage?.tone ?? "neutral"}>{t(stage?.label ?? row.status)}</Badge></TableCell>
                <TableCell className={cn("px-3 py-2.5", TEXT.body)}><WaitTime minutes={row.waitingMinutes} alertAfter={row.status === "signed" ? undefined : 60}/></TableCell>
                <TableCell className="px-3 py-2.5"><SafetyBadges row={row}/></TableCell>
                <TableCell className={cn("px-3 py-2.5", TEXT.body)}>{row.clinicianName ?? <span className="text-[var(--text-muted)]">{t("Unassigned")}</span>}</TableCell>
                <TableCell className="px-3 py-2.5 text-end"><div className="flex flex-wrap justify-end gap-1.5">{actions?.(row, reload)}</div></TableCell>
              </TableRow>;
            })}
          </TableBody>
        </Table>
      </TableContainer>}
    <StaleListNotice show={!!error && !!rows}/>
  </div>;
}

/** Allergy state, NEWS2 and open reviews, hidden from staff without clinical access. */
export function SafetyBadges({row}: {row: QueueRow}) {
  const {t} = useLocalization();
  if (!row.clinicalVisible) return <span className={TEXT.muted}>{t("Restricted to clinical staff")}</span>;
  return <div className="flex flex-wrap gap-1">
    {row.allergyCount > 0 ? <Badge tone="danger">{`${row.allergyCount} ${t(row.allergyCount > 1 ? "allergies" : "allergy")}`}</Badge> : row.allergyState === "nka" ? <Badge tone="success">NKA</Badge> : <Badge tone="warning">Allergies ?</Badge>}
    {row.news2 !== null ? <Badge tone={row.news2 >= 5 ? "danger" : row.news2 >= 3 ? "warning" : "neutral"}>{`NEWS2 ${row.news2}`}</Badge> : null}
    {row.openReviews > 0 ? <Badge tone="info">{`${row.openReviews} ${t("to review")}`}</Badge> : null}
  </div>;
}
