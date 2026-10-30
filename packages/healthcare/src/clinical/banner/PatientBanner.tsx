"use client";
import React, {type ReactNode} from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {BadgeCheck, ShieldAlert} from "@pepbits/icons";
import {Avatar, Badge, cn} from "@pepbits/ui";
import {useFormatters} from "@pepbits/patterns/screen-host";
import type {ProgrammeSnapshot} from "../models/consult-workflow";
import {AllergyStrip} from "../allergy/AllergySection";
import {TEXT} from "../layout/panel";
import {useRelativeTime, waitLabel} from "../time";
import {LOINC, type AllergyBlock, type ClinicalPatient, type Encounter, type Observation, type ReproductiveStatus} from "../types";

const SEX: Record<string, string> = {male: "M", female: "F", other: "X"};

/** Workspace supplies the currently evaluated programme snapshot and its instance-scoped section anchor. */
export interface CareGapBannerProps {sectionId: string; items: ProgrammeSnapshot[]}

/** Who the form is about: identity, safety flags, allergies, weight, coverage and the current visit. */
export function PatientBanner({patient, allergies, latest, encounter, right, reproductive, careGaps}: {
  patient: ClinicalPatient; allergies: AllergyBlock; latest?: Record<string, Observation>; encounter?: Encounter; right?: ReactNode; reproductive?: ReproductiveStatus; careGaps?: CareGapBannerProps;
}) {
  const {t} = useLocalization();
  const format = useFormatters();
  const relative = useRelativeTime();
  const weight = latest?.[LOINC.weight];
  const programmes = careGaps?.items.filter(p => p.mode !== "hidden") ?? [];
  const gaps = programmes.filter(p => ["overdue", "due", "check"].includes(p.status)), overdue = gaps.filter(p => p.status === "overdue").length;
  return <div className="mb-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={patient.name}/>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="truncate text-[length:calc(18px*var(--fs-scale))] font-bold tracking-tight text-[var(--text)]" data-phi>{patient.name}</h1>
            {patient.nameAr ? <span lang="ar" dir="rtl" className={TEXT.body} data-phi>{patient.nameAr}</span> : null}
            {patient.restricted ? <Badge tone="warning"><ShieldAlert className="size-3"/>{t("Restricted")}</Badge> : null}
            {patient.deceasedAt ? <Badge tone="neutral">{t("Deceased")} {format.date(new Date(patient.deceasedAt))}</Badge> : null}
            {patient.identityStatus === "unknown" ? <Badge tone="danger"><ShieldAlert className="size-3"/>{t("Unidentified · temporary identity")}</Badge> : null}
            {patient.identityStatus === "unverified" ? <Badge tone="warning">Identity not verified</Badge> : null}
            {reproductive?.pregnancy === "pregnant" ? <Badge tone="danger">{t(reproductive.verification === "unconfirmed" ? "Pregnant (unconfirmed)" : "Pregnant")}</Badge> : null}
            {reproductive?.pregnancy === "possibly" ? <Badge tone="warning">May be pregnant</Badge> : null}
            {reproductive?.breastfeeding === "yes" ? <Badge tone="warning">Breastfeeding</Badge> : null}
          </div>
          <p className={cn("tabular-nums", TEXT.muted)}>
            <span className="font-bold text-[var(--text)]">{format.number(patient.age)} {t("y")} {t(SEX[patient.sex] ?? "U")}</span>
            {" · "}{t("DOB")} <span data-phi>{format.date(patient.birthDate)}</span>
            {" · "}MRN <span data-phi className="font-bold text-[var(--text)]">{patient.mrn}</span>
            {patient.primaryId ? <> · {patient.primaryIdLabel} <span data-phi>{patient.primaryId}</span></> : null}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1.5">
        {careGaps && programmes.length ? <Fact label="Care gaps"><a href={`#${careGaps.sectionId}`} title={gaps.map(g => `${g.name}: ${t(g.status)}`).join(", ") || t("Every programme is up to date or decided")}><Badge tone={overdue ? "danger" : gaps.length ? "warning" : "success"}>{gaps.length ? <>{t("{count} due", {count: format.number(gaps.length)})}{overdue ? ` · ${t("{count} overdue", {count: format.number(overdue)})}` : ""}</> : t("Up to date")}</Badge></a></Fact> : null}
        <Fact label="Allergies"><AllergyStrip allergies={allergies} compact/></Fact>
        <Fact label="Weight">{weight ? <span className="font-bold tabular-nums">{weight.value == null ? "—" : format.number(weight.value)} kg <span className="font-normal text-[var(--text-muted)]">· {relative(weight.effectiveAt)}</span></span> : <span className="text-[var(--text-muted)]">{t("Not recorded")}</span>}</Fact>
        {patient.coverage ? <Fact label="Coverage"><span className="flex items-center gap-1"><span className="font-bold">{patient.coverage.payer}</span>
          {patient.coverage.eligibility === "verified" ? <BadgeCheck className="size-4 text-[var(--success)]" aria-label={t("Eligibility verified")}/> : <Badge tone="warning">{patient.coverage.eligibility}</Badge>}</span></Fact> : null}
        {encounter ? <Fact label={encounter.class === "ER" ? "Emergency" : encounter.department}>
          <span className="tabular-nums">{waitLabel(encounter.waitingMinutes)} <span className="text-[var(--text-muted)]">{t("since arrival")}</span></span>
        </Fact> : null}
      </div>
      {right ? <div className="ms-auto flex items-center gap-2">{right}</div> : null}
    </div>
  </div>;
}

function Fact({label, children}: {label: string; children: ReactNode}) {
  const {t} = useLocalization();
  return <div className={cn("min-w-0 shrink-0", TEXT.body)}><p className={TEXT.muted}>{t(label)}</p><div className="flex min-h-5 items-center">{children}</div></div>;
}
