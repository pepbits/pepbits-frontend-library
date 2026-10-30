"use client";
import React from "react";
import {ClipboardCheck, HeartPulse} from "@pepbits/icons";
import {Button} from "@pepbits/ui";
import {useScreenHost} from "@pepbits/patterns/screen-host";
import {useClinicalActor, useClinicalPort} from "../context/clinical-context";
import {problemsOf} from "../context/port";
import {OUTPATIENT_INTAKE, type IntakeProfile} from "../context/profiles";
import type {QueueRow} from "../types";
import {EncounterQueue, OUTPATIENT_STAGES, type QueueStage} from "./EncounterQueue";

/**
 * The nurse intake worklist: visits still waiting for intake. Nurses start or continue intake;
 * clinicians who write notes (`note.write`) can also see the patient now, skipping intake, in which
 * case vitals and allergies are taken in the consultation. The host opens pages in the callbacks.
 */
export function IntakeQueue({profile = OUTPATIENT_INTAKE, stages = OUTPATIENT_STAGES, onOpenIntake, onSeeNow}: {
  profile?: IntakeProfile; stages?: QueueStage[]; onOpenIntake: (row: QueueRow) => void; onSeeNow?: (row: QueueRow) => void;
}) {
  const port = useClinicalPort();
  const {can} = useClinicalActor();
  const {notify} = useScreenHost();
  const canConsult = can("note.write");
  const seeNow = async (row: QueueRow) => {
    try { await port.setEncounterStatus(row.id, "in-consult"); onSeeNow?.(row); }
    catch (error) { notify(problemsOf(error).join(" "), {tone: "error"}); }
  };
  return <EncounterQueue encounterClass={profile.encounterClass} stages={stages} statuses={profile.waitingStatuses}
    title="Nurse intake" subtitle="Patients waiting for vitals, allergy review and screening."
    actions={row => canConsult ? <>
      <Button size="sm" variant="ghost" leftIcon={<HeartPulse className="size-4"/>} onClick={() => onOpenIntake(row)}>Intake</Button>
      {onSeeNow ? <Button size="sm" variant="primary" leftIcon={<ClipboardCheck className="size-4"/>} onClick={() => void seeNow(row)}>See now</Button> : null}
    </> : <Button size="sm" variant="primary" leftIcon={<HeartPulse className="size-4"/>} onClick={() => onOpenIntake(row)}>{row.status === profile.inProgressStatus ? "Continue intake" : "Start intake"}</Button>}/>;
}
