"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton } from "../../../shared/controls";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { ArrowLeft, Check, CloudOff, Command, Languages, Loader2, Lock, ShieldAlert } from "lucide-react";
import { useConsult } from "./context";
import type { SaveState } from "../../lib/encounter-sync";
import { STATUS, age, fullName, sexShort } from "../../lib/format";
import { Avatar, Badge, Button, StatusPill, cx } from "../ui";

export function PatientBanner({ saveState, onPalette }: { saveState: SaveState; onPalette: () => void }) {
  const { t } = useLocalization();
  const { patient, appt, setTab, locked, role } = useConsult();
  const active = patient.allergies.filter((a) => a.status === "active");

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-3 py-2.5 sm:px-4">
      <Link href="/" className="rounded p-1 text-ink-400 hover:bg-ink/5 hover:text-ink" aria-label="Back to today">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={fullName(patient)} size={38} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="truncate text-[15px] font-semibold text-ink">{fullName(patient)}</h2>
            <span className="text-xs text-ink-600 tabular">
              {age(patient.dob)} {sexShort(patient.sex)} · {patient.mrn}
              {patient.weightKg ? ` · ${patient.weightKg} kg` : ""}
            </span>
          </div>
          <p className="truncate text-xs text-ink-400">{appt.reason}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {active.length ? (
          active.map((a) => (
            <SourceButton key={a.id} onClick={() => setTab("allergies")} title={`${a.reaction} · ${a.severity}`}>
              <Badge className={cx("py-1 text-xs", a.severity === "severe" ? "bg-alarm-500 text-white" : "bg-alarm-50 text-alarm-600")}>
                <ShieldAlert className="h-3.5 w-3.5" /> {a.substance}
              </Badge>
            </SourceButton>
          ))
        ) : (
          <Badge className={cx("py-1 text-xs", patient.noKnownAllergies ? "bg-vital-50 text-vital-600" : "bg-caution-50 text-caution-600")}>
            {t(patient.noKnownAllergies ? "No known allergies" : "Allergies not recorded")}
          </Badge>
        )}
        {patient.language !== "English" && (
          <Badge className="bg-[#EEF0FB] py-1 text-xs text-[#3B4BA9]">
            <Languages className="h-3.5 w-3.5" /> {t("{value0} interpreter", { value0: patient.language })}
          </Badge>
        )}
        {patient.guardian && <Badge className="bg-ink/5 py-1 text-xs text-ink-700">{t("Guardian: {value0}", { value0: patient.guardian })}</Badge>}
        {patient.pregnant && <Badge className="bg-caution-50 py-1 text-xs text-caution-600"><LocalizedText message={"Pregnant"} /></Badge>}
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <StatusPill {...STATUS[appt.status]} />
        <span className="hidden items-center gap-1 text-2xs text-ink-400 sm:inline-flex" aria-live="polite">
          {locked ? (
            <><Lock className="h-3 w-3" />  <LocalizedText message={"Signed and locked"} /></>
          ) : saveState === "saving" ? (
            <><Loader2 className="h-3 w-3 animate-spin" />  <LocalizedText message={"Saving"} /></>
          ) : saveState === "conflict" ? (
            <span className="inline-flex items-center gap-1 text-alarm-500"><CloudOff className="h-3 w-3" />  <LocalizedText message={"Not saved: conflict"} /></span>
          ) : saveState === "error" ? (
            <span className="inline-flex items-center gap-1 text-alarm-500"><CloudOff className="h-3 w-3" />  <LocalizedText message={"Not saved, retrying"} /></span>
          ) : (
            <><Check className="h-3 w-3" />  <LocalizedText message={"Saved"} /></>
          )}
        </span>
        {!locked && (
          <>
            <Button size="sm" variant="quiet" onClick={onPalette} icon={<Command className="h-3.5 w-3.5" />} title={t("Ctrl K or ⌘K")}>
              <span className="hidden md:inline"><LocalizedText message={"Quick add"} /></span>
            </Button>
            {role === "doctor" ? (
              <Button size="sm" variant="primary" onClick={() => setTab("review")}><LocalizedText message={"Review and sign"} /></Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setTab("triage")}><LocalizedText message={"Review triage"} /></Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
