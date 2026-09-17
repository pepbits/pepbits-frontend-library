"use client";
import React, { useEffect, useRef } from "react";
import {
  Avatar,
  Card,
  Badge,
  Button,
  DescriptionList,
  useLocalization,
} from "@pepbits/ops-ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { PatientSummary } from "@pepbits/erp-config";
import {
  ClinicalLoading,
  useClinicalLoad,
  type ClinicalPageProps,
} from "./shared";
import { PatientQueryActions } from "./query-results";
import { ageParts } from "./record-age";
import styles from "./query-layout.module.css";
export function PatientQueryDetail({
  patient,
  mode,
  rows,
  onSelect,
  onClose,
  onCare,
  ...props
}: Omit<ClinicalPageProps, "mode"> & {
  patient: PatientSummary;
  mode: string;
  rows: PatientSummary[];
  onSelect: (p: PatientSummary) => void;
  onClose: () => void;
  onCare: (kind: "appointment" | "encounter", id: string) => void;
}) {
  const { t, direction } = useLocalization(),
    load = useClinicalLoad(
      () => props.adapter.load(patient.id),
      [props.adapter, patient.id],
    );
  const root = useRef<HTMLDivElement>(null);
  const index = rows.findIndex((p) => p.id === patient.id);
  useEffect(() => {
    if (!props.preferences.keyboardShortcuts) return;
    const key = (e: KeyboardEvent) => {
      if (!root.current?.getClientRects().length) return;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const next =
        e.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight")
          ? index + 1
          : e.key === (direction === "rtl" ? "ArrowRight" : "ArrowLeft")
            ? index - 1
            : -1;
      if (next >= 0 && next < rows.length) {
        e.preventDefault();
        onSelect(rows[next]);
      }
      if (e.key === "Escape" && mode === "inline") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [rows, index, onSelect, onClose, mode, direction, props.preferences.keyboardShortcuts]);
  if (!load.value)
    return <ClinicalLoading error={load.error} retry={load.retry} />;
  const p = load.value,
    age = ageParts(String(p.values.birthDate)),
    fields = props.metadata.sections.flatMap((s) => s.fields);
  const enumLabel=(value:unknown)=>{if(!value)return "—";const key=`template.clinical.${value}`;return t(key)===key?String(value):t(key);};
  const display = (key: string) => {
    if (key === "registeredAt")
      return patient.registeredAt
        ? props.format.date(patient.registeredAt)
        : "—";
    const value = p.values[key];
    if (!value) return "—";
    const f = fields.find((f) => f.id === key);
    return key === "birthDate" || f?.type === "date"
      ? props.format.date(String(value))
      : t(f?.options?.find((o) => o.value === value)?.label ?? String(value));
  };
  const item = (key: string) => ({
    id: key,
    label:
      fields.find((f) => f.id === key)?.label ?? `template.clinical.${key}`,
    value: display(key),
  });
  const groups = [
    {
      id: "identity",
      items: [
        ...["birthDate", "nationality", "birthPlace"].map(item),
        ...p.collections.identifiers.map((r) => ({
          id: r.id,
          label: enumLabel(r.identityType),
          value: r.value,
        })),
      ],
    },
    {
      id: "contact",
      items: [
        ...p.collections.contacts.map((r) => ({
          id: r.id,
          label: enumLabel(r.contactType),
          value: [r.countryCode, r.value].filter(Boolean).join(" "),
        })),
        ...p.collections.addresses.map((r) => ({
          id: r.id,
          label: "template.clinical.address",
          value: [
            r.line1,
            r.line2,
            r.city,
            r.postalCode,
            r.country
              ? t(`template.clinical.${r.country}`) ===
                `template.clinical.${r.country}`
                ? r.country
                : t(`template.clinical.${r.country}`)
              : "",
          ]
            .filter(Boolean)
            .join(", "),
        })),
        ...["emergencyName", "emergencyPhone"].map(item),
      ],
    },
    {
      id: "clinicalAdministrative",
      items: [
        "bloodGroup",
        "maritalStatus",
        "language",
        "occupation",
        "preferredName",
        "registeredAt",
      ].map(item),
    },
  ];
  return (
    <Card
      className={`${styles.detail} ${mode.endsWith("drawer") ? styles.drawer : ""}`}
      ref={root}
      style={{"--fs-scale":"var(--fs-form)"} as React.CSSProperties}
      data-query-detail
    >
      <aside className={styles.rail}>
        <div className={styles.tools}>
          <Badge>{p.mrn}</Badge>
          <Badge tone={p.values.status === "active" ? "success" : "neutral"}>
            {enumLabel(p.values.status)}
          </Badge>
        </div>
        <div className="mt-4">
          <Avatar
            name={patient.name}
            size="lg"
            decorative
            className={styles.profileAvatar}
          />
        </div>
        <h2>{patient.name}</h2>
        <div className={styles.tools}>
          <Badge>{display("gender")}</Badge>
          {age ? (
            <Badge>
              {t("template.clinical.ageYears", { count: age.years })}
            </Badge>
          ) : null}
          {p.values.bloodGroup ? <Badge>{display("bloodGroup")}</Badge> : null}
        </div>
        <DescriptionList
          className="mt-5 gap-4"
          layout="stacked"
          items={[
            "language",
            "maritalStatus",
            "occupation",
            "registeredAt",
          ].map(item)}
          termClassName="text-xs text-[var(--text-muted)]"
        />
      </aside>
      <div className={styles.detailMain}>
        <div className={styles.detailHead}>
          <strong>{t("template.clinical.record")}</strong>
          <Button size="xs" variant="ghost" onClick={onClose}>
            {t("Close")}
          </Button>
        </div>
        <div className={styles.detailBody}>
          {patient.possibleDuplicate ? (
            <Badge tone="warning">
              {t("template.clinical.possibleDuplicate")}
            </Badge>
          ) : null}
          {groups.map((group) => (
            <section key={group.id} className={styles.group}>
              <h3>{t(`template.clinical.${group.id}`)}</h3>
              <DescriptionList
                layout="stacked"
                className="grid-cols-2 gap-4"
                termClassName="text-xs text-[var(--text-muted)] mb-1"
                items={group.items}
              />
            </section>
          ))}
        </div>
        <footer className={styles.detailFooter}>
          <div className={styles.tools}>
            <Button
              size="xs"
              aria-label="template.clinical.previousPatient"
              disabled={index <= 0}
              onClick={() => onSelect(rows[index - 1])}
            >
              <ArrowLeft size={14} />
            </Button>
            <span className={styles.hint}>
              {t("template.clinical.resultPosition", {
                index: index + 1,
                total: rows.length,
              })}
            </span>
            <Button
              size="xs"
              aria-label="template.clinical.nextPatient"
              disabled={index < 0 || index >= rows.length - 1}
              onClick={() => onSelect(rows[index + 1])}
            >
              <ArrowRight size={14} />
            </Button>
          </div>
          <PatientQueryActions
            patient={patient}
            canWrite={props.metadata.canWrite}
            capabilities={props.metadata.queryCapabilities}
            onOpen={props.onOpen}
            onCare={onCare}
          />
        </footer>
      </div>
    </Card>
  );
}
