"use client";

import { Crown, ShieldAlert } from "lucide-react";
import type { Coverage, Patient } from "../../lib/types";
import { coverageActive, cx, fullName } from "../../lib/utils";
import { Badge } from "../ui/primitives";
import { useMaster } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

/** Deterministic barcode bars from the MRN, purely visual. */
export function Barcode({ value, className }: { value: string; className?: string }) {
  const bars: number[] = [];
  for (const ch of value.replace(/\W/g, "")) {
    const c = ch.charCodeAt(0);
    bars.push((c % 3) + 1, ((c >> 2) % 2) + 1, ((c >> 1) % 3) + 1);
  }
  return (
    <span aria-hidden className={cx("barcode", className)}>
      {bars.map((w, i) => (
        <span key={i} style={{ width: w, opacity: i % 2 ? 0 : 1 }} />
      ))}
    </span>
  );
}

/**
 * The patient wristband. Hospitals use a red band for allergy alerts,
 * so the clasp turns red when allergies are recorded.
 */
export function Wristband({
  patient,
  size = "md",
  className,
  trailing,
}: {
  patient: Pick<Patient, "firstName" | "middleName" | "lastName" | "mrn" | "dob" | "gender"> & Partial<Pick<Patient, "allergies" | "vip" | "bloodGroup">>;
  size?: "sm" | "md" | "lg";
  className?: string;
  trailing?: React.ReactNode;
}) {
  const { ageOf, fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const allergy = !!patient.allergies?.trim();
  const name = fullName(patient) || tr("New patient");
  return (
    <div
      className={cx(
        "relative flex items-center gap-3 overflow-hidden rounded-[var(--radius-band)] border border-line bg-paper",
        size === "lg" ? "h-[72px] pr-6" : size === "md" ? "h-14 pr-4" : "h-11 pr-3",
        className,
      )}
    >
      {/* clasp */}
      <span
        className={cx(
          "flex h-full shrink-0 items-center justify-center rounded-l-[var(--radius-band)]",
          size === "lg" ? "w-16" : size === "md" ? "w-12" : "w-9",
          allergy ? "bg-rose-500 text-white" : "bg-scrub-700 text-scrub-100",
        )}
        title={allergy ? tr("Allergy: {value0}", { value0: (patient.allergies) ?? "" }) : tr("No allergy alert")}
      >
        {allergy ? <ShieldAlert className={size === "sm" ? "size-4" : "size-5"} /> : <span className={cx("rounded-full border-2 border-current", size === "sm" ? "size-3" : "size-4")} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cx("truncate font-bold tracking-tight", size === "lg" ? "text-xl" : size === "md" ? "text-[15px]" : "text-[13.5px]")}>{name}</p>
          {patient.vip && (
            <Crown className="size-4 shrink-0 text-amber-500" aria-label="VIP" />
          )}
        </div>
        <p className={cx("truncate text-ink-soft", size === "sm" ? "text-[11.5px]" : "text-[12.5px]")}>
          <span className="font-semibold text-ink">{patient.mrn || tr("MRN on save")}</span>
          {patient.dob && (
            <>
              <span className="mx-1.5 text-line">|</span>
              {ageOf(patient.dob)} {patient.gender?.[0] ?? ""}
              <span className="mx-1.5 text-line">|</span>
              {fmtDate(patient.dob)}
            </>
          )}
          {patient.bloodGroup && size !== "sm" && (
            <>
              <span className="mx-1.5 text-line">|</span>
              {patient.bloodGroup}
            </>
          )}
        </p>
      </div>

      {trailing}
      {size !== "sm" && patient.mrn && <Barcode value={patient.mrn} className={cx("hidden shrink-0 text-ink sm:flex", size === "lg" ? "h-9" : "h-7")} />}
    </div>
  );
}

export function CoverageLine({ c, compact }: { c: Coverage; compact?: boolean }) {
  const { network, payer, plan, tpa } = useMaster();
  const { fmtDate } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const active = coverageActive(c);
  const p = payer(c.payerId);
  return (
    <div className={cx("flex items-start gap-3", compact ? "py-2" : "py-2.5")}>
      <span
        className={cx(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold",
          c.priority === "Primary" ? "bg-scrub-700 text-white" : c.priority === "Secondary" ? "bg-scrub-200 text-scrub-900" : "bg-canvas text-ink-soft",
        )}
        title={tr("{value0} coverage", { value0: tr(c.priority ?? "") })}
      >
        {c.priority[0]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold">{p?.short ?? tr("Unknown payer")}</p>
          <Badge tone={active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}>{active ? tr("Active") : tr("Expired")}</Badge>
        </div>
        <p className="truncate text-[12.5px] text-ink-soft">
          {network(c.networkId)?.name}, {plan(c.planId)?.name}
        </p>
        {!compact && (
          <p className="truncate text-[12px] text-ink-faint">
            <LocalizedText message={"Member {value0}"} values={{ value0: (c.memberId) ?? "" }} />
            {c.tpaId ? tr(", via {value0}", { value0: (tpa(c.tpaId)?.name) ?? "" }) : tr(", direct billing")}
            {tr(", until {value0}", { value0: (fmtDate(c.validTo)) ?? "" })}
          </p>
        )}
      </div>
    </div>
  );
}
