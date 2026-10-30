"use client";
import React, { useId } from "react";
import { Button, Input, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useConsultHost } from "../context/consult-host";
import { ConsultSection } from "../layout/ConsultSection";
import type { ConsultSectionProps } from "../models/consult-workflow";
import { DispositionSection } from "./DispositionSection";
import { CertificatesSection } from "./CertificatesSection";
const QUICK = [
  [3, "day"],
  [1, "week"],
  [2, "week"],
  [1, "month"],
  [3, "month"],
  [6, "month"],
] as const;
export function PlanSection(props: ConsultSectionProps & {renderSignedDischarge?: () => React.ReactNode}) {
  const { draft, readOnly, onChange } = props,
    host = useConsultHost(),
    { t } = useLocalization(),
    format = useFormatters(),
    uid = useId();
  const enabled = !readOnly && draft.disposition === "follow-up";
  const update: typeof onChange = (fn) => {
    if (enabled) onChange(fn);
  };
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Follow-up, disposition and certificate"
    >
      <DispositionSection {...props} id={undefined} />
      <div className="grid gap-2">
        <h3>{t("Follow-up")}</h3>
        <div>
          {QUICK.map(([value, unit]) => (
            <Button
              key={`${value}:${unit}`}
              disabled={!enabled}
              aria-pressed={
                draft.followUp?.value === value && draft.followUp.unit === unit
              }
              onClick={() =>
                update((n) => {
                  n.followUp =
                    n.followUp?.value === value && n.followUp.unit === unit
                      ? null
                      : { value, unit };
                  n.followUpNone = false;
                })
              }
            >
              {format.number(value)} {t(value === 1 ? unit : `${unit}s`)}
            </Button>
          ))}
          <Button
            disabled={!enabled}
            aria-pressed={draft.followUpNone}
            onClick={() =>
              update((n) => {
                n.followUpNone = !n.followUpNone;
                n.followUp = null;
              })
            }
          >
            {t("As needed")}
          </Button>
        </div>
        <Input
          label="Follow-up in"
          type="number"
          min={1}
          max={365}
          disabled={!enabled}
          value={draft.followUp?.value ?? ""}
          onChange={(e) =>
            update((n) => {
              const value = Math.trunc(Number(e.target.value));
              n.followUp =
                value > 0
                  ? {
                      value: Math.min(value, 365),
                      unit: n.followUp?.unit ?? "day",
                    }
                  : null;
              n.followUpNone = false;
            })
          }
        />
        <Select
          label="Follow-up unit"
          disabled={!enabled || !draft.followUp}
          value={draft.followUp?.unit ?? "day"}
          options={[
            { value: "day", label: "days" },
            { value: "week", label: "weeks" },
            { value: "month", label: "months" },
          ]}
          onChange={(e) =>
            update((n) => {
              if (n.followUp)
                n.followUp.unit = e.target.value as "day" | "week" | "month";
            })
          }
        />
        <p>
          {t(
            draft.disposition === "follow-up"
              ? "Reception receives a booking task at checkout."
              : "Choose Home with follow-up to set a follow-up."
          )}
        </p>
      </div>
      <CertificatesSection {...props} id={undefined} />
    </ConsultSection>
  );
}
