"use client";

import { BedDouble, FolderHeart, Phone, RefreshCw, ShieldCheck, Siren, Stethoscope, UserPlus } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useState } from "react";
import { useCounter, useStore } from "../../lib/store";
import type { Patient } from "../../lib/types";

import { PatientPicker } from "../patient/patient-picker";
import { QuickRegister } from "../patient/quick-register";
import { CoverageLine, Wristband } from "../patient/wristband";
import { Button, LinkButton, Panel } from "../ui/primitives";
import { TypeTag } from "./type-tag";
import { useMedbandFormat } from "../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { medbandPaths } from "../../routes";

export function PatientContext({ patient, onPick, onClear }: { patient?: Patient; onPick: (p: Patient) => void; onClear: () => void }) {
  const { relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const [quick, setQuick] = useState(false);
  // The emergency registration counter is the one that opens emergency visits (from the backend master data, not a fixed id).
  const er = !!useCounter()?.encounterTypes.includes("EMERGENCY");

  if (!patient) {
    return (
      <Panel className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="text-[15px] font-semibold"><LocalizedText message="Who is the encounter for?" /></h2>
          <p className="text-[13px] text-ink-faint"><LocalizedText message="Search, then pick the patient." /></p>
        </div>
        <PatientPicker autoFocus onPick={onPick} />
        {er && (
          <Button variant="danger" onClick={() => setQuick(true)}>
            <Siren className="size-4" /> {" "}<LocalizedText message="Quick registration" /></Button>
        )}
        {/* The source also hinted at named demonstration patients ("Try James..."): those names belong to its seed data and are not carried. */}
        {er && (
          <div className="rounded-xl bg-canvas p-3 text-[12.5px] text-ink-soft"><LocalizedText message="Unidentified or unstable patients can be registered with just sex and approximate age." /></div>
        )}
        <LinkButton href={medbandPaths.patientNew()} variant="secondary">
          <UserPlus className="size-4" /> {" "}<LocalizedText message="Register new patient" /></LinkButton>
        <QuickRegister
          open={quick}
          onClose={() => setQuick(false)}
          onDone={(p) => {
            setQuick(false);
            onPick(p);
          }}
        />
      </Panel>
    );
  }

  const cases = store.cases.filter((c) => c.patientId === patient.id && c.status === "Open");
  const requests = store.admissionRequests.filter((r) => r.patientId === patient.id && (r.status === "Pending" || r.status === "Ready"));
  const recent = store.encounters.filter((e) => e.patientId === patient.id).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 4);

  return (
    <Panel className="flex min-h-0 flex-col">
      <div className="p-4 pb-3">
        <Wristband patient={patient} size="sm" />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            <Phone className="size-3.5" /> {patient.phone || tr("No phone")}
          </span>
          <Button size="sm" variant="ghost" onClick={onClear} className="h-7 px-2">
            <RefreshCw className="size-3.5" /> {" "}<LocalizedText message="Change" /></Button>
        </div>
        {patient.allergies && <p className="mt-1.5 rounded-md bg-rose-50 px-2 py-1 text-[12.5px] font-semibold text-rose-700"><LocalizedText message={"Allergy: {value0}"} values={{ value0: (patient.allergies) ?? "" }} /></p>}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto px-4 pb-4">
        <h3 className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft"><ShieldCheck className="size-3.5" /> {" "}<LocalizedText message="Insurance" /></h3>
        <div className="divide-y divide-line-soft">
          {patient.coverages.length ? patient.coverages.map((c) => <CoverageLine key={c.id} c={c} compact />) : <p className="py-2 text-[13px] text-ink-faint"><LocalizedText message="Self pay" /></p>}
        </div>

        {patient.unidentified && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[12.5px] text-amber-900"><LocalizedText message="Identity not confirmed. Update the record when known." /></p>
        )}

        {requests.length > 0 && (
          <>
            <h3 className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft"><BedDouble className="size-3.5" /> {" "}<LocalizedText message="Admission requests" /></h3>
            {requests.map((r) => (
              <p key={r.id} className="truncate py-1 text-[13px]">
                <span className="font-semibold">{r.code}</span>{" "}
                <span className={r.status === "Ready" ? "text-emerald-700" : "text-amber-700"}>{r.status === "Ready" ? tr("ready to admit") : tr("pending")}</span>
              </p>
            ))}
          </>
        )}

        <h3 className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft"><FolderHeart className="size-3.5" /> {" "}<LocalizedText message="Open cases" /></h3>
        {cases.length ? (
          cases.map((c) => (
            <p key={c.id} className="py-1 text-[13px] leading-snug">
              <span className="font-semibold">{c.title}</span> <span className="text-ink-faint">{c.code}</span>
              <span className="block truncate text-[12px] text-ink-faint"><LocalizedText message={"in {value0}"} values={{ value0: (store.episodeById(c.episodeId)?.title) ?? "" }} /></span>
            </p>
          ))
        ) : (
          <p className="py-1 text-[13px] text-ink-faint"><LocalizedText message="None open" /></p>
        )}

        <h3 className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft"><Stethoscope className="size-3.5" /> {" "}<LocalizedText message="Recent visits" /></h3>
        {recent.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-1 text-[12.5px]">
            <TypeTag type={e.type} withLabel={false} />
            <span className="min-w-0 flex-1 truncate">{e.chiefComplaint ?? e.services?.join(", ") ?? e.code}</span>
            <span className="shrink-0 text-ink-faint">{relativeDay(e.start)}</span>
          </div>
        ))}
        {recent.length === 0 && <p className="py-1 text-[13px] text-ink-faint"><LocalizedText message="First visit" /></p>}
        <Link href={medbandPaths.patient(patient.id)} className="mt-2 inline-block text-[12.5px] font-semibold text-scrub-700 hover:underline">
          <LocalizedText message="Open full record" /></Link>
      </div>
    </Panel>
  );
}
