"use client";
import React from "react";
import {Stethoscope} from "@pepbits/icons";
import {ClinicalPanel} from "../layout/panel";
import type {ArrivalValue, ComplaintValue} from "../forms/intake-model";
import {ArrivalFields} from "./ArrivalFields";
import {ComplaintField, PatientWordsField} from "./ComplaintField";

/**
 * Arrival questions and the coded presenting complaint. `showArrivalMode` adds how the patient
 * arrived (walk-in, ambulance, police, referral) for emergency encounters.
 */
export function ArrivalComplaintSection({arrival, onArrival, complaint, onComplaint, receptionReason, requireComplaint = false, showArrivalMode = false}: {
  arrival: ArrivalValue; onArrival: (value: ArrivalValue) => void; complaint: ComplaintValue; onComplaint: (value: ComplaintValue) => void;
  receptionReason?: string; requireComplaint?: boolean; showArrivalMode?: boolean;
}) {
  return <ClinicalPanel title="Arrival and complaint" icon={<Stethoscope className="size-4"/>}>
    <ArrivalFields value={arrival} onChange={onArrival} showArrivalMode={showArrivalMode}/>
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <ComplaintField value={complaint.item} onChange={item => onComplaint({...complaint, item})} required={requireComplaint} receptionReason={receptionReason}/>
      <PatientWordsField value={complaint.words} onChange={words => onComplaint({...complaint, words})}/>
    </div>
  </ClinicalPanel>;
}
