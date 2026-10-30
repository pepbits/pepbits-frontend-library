"use client";
import React, { useId } from "react";
import { Input, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useClinicalActor } from "../context/clinical-context";
import { useConsultHost } from "../context/consult-host";
import { ConsultSection } from "../layout/ConsultSection";
import { ProblemNotice } from "../layout/panel";
import type { ConsultSectionProps } from "../models/consult-workflow";
import { IssuedCertificates } from "../orders/IssuedCertificates";
export function CertificatesSection(props: ConsultSectionProps) {
  const { draft, detail, onChange, readOnly, onRecordsChanged } = props,
    host = useConsultHost(),
    { can } = useClinicalActor(),
    { t } = useLocalization(),
    format = useFormatters(),
    uid = useId();
  const certificate = draft.certificate,
    days =
      certificate.from && certificate.to
        ? Math.round(
            (Date.parse(certificate.to) - Date.parse(certificate.from)) /
              86400000
          ) + 1
        : null;
  const update: typeof onChange = (fn) => {
    if (!readOnly) onChange(fn);
  };
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Medical certificate"
    >
      <Select
        label="Certificate needed"
        disabled={readOnly}
        value={
          certificate.needed === null ? "" : certificate.needed ? "yes" : "no"
        }
        options={[
          { value: "", label: "Choose" },
          { value: "no", label: "Not needed" },
          { value: "yes", label: "Issue certificate" },
        ]}
        onChange={(e) =>
          update((n) => {
            n.certificate.needed =
              e.target.value === "" ? null : e.target.value === "yes";
            if (n.certificate.needed && !n.certificate.from)
              n.certificate.from = new Date().toISOString().slice(0, 10);
          })
        }
      />
      {certificate.needed && (
        <>
          <Input
            label="From"
            type="date"
            disabled={readOnly}
            value={certificate.from}
            onChange={(e) =>
              update((n) => {
                n.certificate.from = e.target.value;
              })
            }
          />
          <Input
            label="To"
            type="date"
            min={certificate.from || undefined}
            disabled={readOnly}
            value={certificate.to}
            onChange={(e) =>
              update((n) => {
                n.certificate.to = e.target.value;
              })
            }
          />
          <Select
            label="Fitness"
            disabled={readOnly}
            value={certificate.fitness}
            options={[
              { value: "", label: "Choose" },
              { value: "unfit", label: "Unfit for work or school" },
              { value: "light-duties", label: "Fit for light duties" },
            ]}
            onChange={(e) =>
              update((n) => {
                n.certificate.fitness = e.target
                  .value as typeof certificate.fitness;
              })
            }
          />
          {days != null &&
            (days > 0 ? (
              <p>
                {format.number(days)} {t("days")}
              </p>
            ) : (
              <ProblemNotice
                problems={[
                  "The certificate end date must not be before its start date.",
                ]}
              />
            ))}
        </>
      )}
      <IssuedCertificates
        encounterId={detail.encounter.id}
        signed={detail.note?.status === "final"}
        canSend={can("note.write")}
        onRecordsChanged={onRecordsChanged}
      />
    </ConsultSection>
  );
}
