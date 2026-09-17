"use client";
import React from "react";
import {
  Card,
  Button,
  DescriptionList,
  useLocalization,
} from "@pepbits/ops-ui";
import {
  IdCard,
  UserRound,
  Phone,
  MapPin,
  ShieldCheck,
  HeartPulse,
  History,
  LockKeyhole,
  FileText,
} from "lucide-react";
import type {
  PatientSection,
  PatientRecord,
  PatientMetadata,
  Formatters,
} from "@pepbits/erp-config";
import { PatientFieldControl, PatientCollectionEditor } from "./shared";
import { PatientAge } from "./record-age";
import { RecordSectionCard } from "./record-layout";
import styles from "./record-layout.module.css";
const icons = [
  IdCard,
  UserRound,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  HeartPulse,
  History,
  LockKeyhole,
];
export function patientSectionDone(id: string, p: PatientRecord): boolean {
  switch (id) {
    case "mrn":
      return true;
    case "personal":
      return ["firstName", "lastName", "gender", "birthDate"].every(
        (k) => !!p.values[k],
      );
    case "contact":
      return (
        !!p.values.preferredContact &&
        !!(
          p.values.email ||
          p.values.mobile ||
          p.collections.contacts?.some((r) => r.value)
        )
      );
    case "address":
      return p.collections.addresses?.some((r) => !!r.line1) ?? false;
    case "identity":
      return p.collections.identifiers?.some((r) => !!r.value) ?? false;
    case "insurance":
      return !p.values.hasInsurance || !!p.collections.insurances?.length;
    case "clinical":
      return !!p.values.bloodGroup;
    case "registration":
      return p.id !== "new";
    case "consent":
      return !!p.collections.consents?.length;
    default:
      return false;
  }
}
export function PatientRecordSection({
  section: s,
  index,
  patient,
  metadata,
  disabled,
  reading,
  canToggleRead = true,
  onRead,
  update,
  errors,
  format,
  children,
}: {
  section: PatientSection;
  index: number;
  patient: PatientRecord;
  metadata: PatientMetadata;
  disabled: boolean;
  reading: boolean;
  canToggleRead?: boolean;
  onRead: () => void;
  update: (p: PatientRecord) => void;
  errors: Record<string, string>;
  format: Formatters;
  children?: React.ReactNode;
}) {
  const { t } = useLocalization(),
    Icon = icons[index] ?? FileText;
  const groups = s.groups ?? [{ title: "", fields: s.fields.map((f) => f.id) }];
  const fields = (ids: string[]) =>
    ids
      .map((id) => s.fields.find((f) => f.id === id))
      .filter(
        (f) =>
          !!f &&
          (!f.visibleWhen ||
            patient.values[f.visibleWhen.field] === f.visibleWhen.value),
      );
  return (
    <RecordSectionCard id={s.id} title={s.cardTitle ?? s.title} subtitle={s.subtitle}
      index={index} icon={<Icon size={18} />} reading={reading}
      onRead={canToggleRead ? onRead : undefined}>
        {s.id === "mrn" ? (
          patient.id === "new" ? (
            <div className={styles.banner}>
              {t("template.clinical.mrnAutomatic")}
            </div>
          ) : (
            <DescriptionList
              items={["mrn", "uhid", "internalCode"].map((id) => ({
                id,
                label: `template.clinical.${id}`,
                value:
                  id === "mrn"
                    ? patient.mrn
                    : id === "uhid"
                      ? String(patient.values.uhid || "—")
                      : patient.internalCode,
              }))}
            />
          )
        ) : s.id === "registration" ? (
          <>
            <div className={styles.banner}>
              {t("template.clinical.registrationAutomatic")}
            </div>
            {patient.id !== "new" ? (
              <DescriptionList
                items={[
                  {
                    id: "date",
                    label: "template.clinical.date",
                    value: format.date(patient.activity[0]?.at ?? ""),
                  },
                  {
                    id: "status",
                    label: "template.clinical.status",
                    value: t(`template.clinical.${patient.values.status}`),
                  },
                  {
                    id: "mrn",
                    label: "template.clinical.mrn",
                    value: patient.mrn,
                  },
                ]}
              />
            ) : null}
          </>
        ) : (
          groups.map((group, i) => (
            <div className={styles.group} key={i}>
              {group.title ? <h4>{t(group.title)}</h4> : null}
              {reading ? (
                <DescriptionList
                  items={fields(group.fields).map((f) => ({
                    id: f!.id,
                    label: f!.label,
                    value:
                      f!.type === "checkbox"
                        ? t(
                            patient.values[f!.id]
                              ? "template.clinical.yes"
                              : "template.clinical.no",
                          )
                        : f!.options
                          ? t(
                              f!.options.find(
                                (o) => o.value === patient.values[f!.id],
                              )?.label ?? String(patient.values[f!.id] || "—"),
                            )
                          : String(patient.values[f!.id] || "—"),
                  }))}
                />
              ) : (
                <div className={styles.fieldGrid}>
                  {fields(group.fields).map((f) => (
                    <React.Fragment key={f!.id}>
                      <div
                        key={f!.id}
                        className={styles.field}
                        style={
                          {
                            "--field-span":
                              f!.span ?? (f!.type === "textarea" ? 12 : 4),
                          } as React.CSSProperties
                        }
                      >
                        <PatientFieldControl
                          field={f!}
                          value={patient.values[f!.id]}
                          disabled={disabled}
                          error={errors[f!.id]}
                          onChange={(value) =>
                            update({
                              ...patient,
                              values: { ...patient.values, [f!.id]: value },
                            })
                          }
                        />
                      </div>
                      {f!.id === "birthTime" ? (
                        <div className={styles.field}>
                          <PatientAge
                            birthDate={String(patient.values.birthDate ?? "")}
                          />
                        </div>
                      ) : null}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {s.collections
          .filter(
            (id) =>
              (id !== "insurances" || patient.values.hasInsurance) &&
              (id !== "disabilities" || patient.values.hasDisability),
          )
          .map((id) =>
            id === "contacts" ? (
              <React.Fragment key={id}>
                {[
                  {
                    values: ["email"],
                    title: "template.clinical.emailAddresses",
                  },
                  {
                    values: ["mobile", "phone"],
                    title: "template.clinical.telephoneNumbers",
                  },
                ].map((subset) => (
                  <PatientCollectionEditor
                    key={subset.title}
                    subset={subset}
                    embedded
                    id={id}
                    patient={patient}
                    metadata={metadata}
                    update={update}
                    reading={reading}
                    disabled={disabled || reading}
                    errors={errors}
                  />
                ))}
              </React.Fragment>
            ) : (
              <PatientCollectionEditor
                key={id}
                embedded
                id={id}
                patient={patient}
                metadata={metadata}
                update={update}
                reading={reading}
                disabled={disabled || reading}
                errors={errors}
              />
            ),
          )}
        {children}
    </RecordSectionCard>
  );
}
