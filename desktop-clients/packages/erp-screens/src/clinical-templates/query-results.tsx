"use client";
import React, { Fragment, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardGrid,
  Table,
  TableContainer,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  useLocalization,
} from "@pepbits/ops-ui";
import {
  ExternalLink,
  Calendar,
  Stethoscope,
  Phone,
  Globe,
  IdCard,
} from "lucide-react";
import type { PatientSummary, PatientFilters } from "@pepbits/erp-config";
import type { ClinicalPageProps } from "./shared";
import { ageParts } from "./record-age";
import styles from "./query-layout.module.css";
export const queryColumns = [
  "name",
  "mrn",
  "gender",
  "birthDate",
  "nationality",
  "country",
  "mobile",
  "identifier",
  "registeredAt",
  "status",
] as const;
export const columnLabel = (key: string) =>
  `template.clinical.${({ name: "patient", birthDate: "dobAge", country: "residingCountry" } as Record<string, string>)[key] ?? key}`;
export function QueryHighlight({
  value,
  query,
}: {
  value: string;
  query?: string;
}) {
  const term = (query ?? "").trim(),
    index = term
      ? value.toLocaleLowerCase().indexOf(term.toLocaleLowerCase())
      : -1;
  return index < 0 ? (
    <>{value || "—"}</>
  ) : (
    <>
      {value.slice(0, index)}
      <mark className={styles.mark}>
        {value.slice(index, index + term.length)}
      </mark>
      {value.slice(index + term.length)}
    </>
  );
}
export function PatientQueryActions({
  patient,
  canWrite,
  onOpen,
  onCare,
  capabilities,
}: {
  patient: Pick<PatientSummary, "id" | "editable">;
  capabilities?: {care?:boolean;overview?:boolean};
  canWrite: boolean;
  onOpen: ClinicalPageProps["onOpen"];
  onCare: (kind: "appointment" | "encounter", id: string) => void;
}) {
  const { t } = useLocalization();
  return (
    <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
      {(["view", "edit"] as const).map((mode) => (
        <Button
          key={mode}
          size="xs"
          variant="ghost"
          disabled={mode === "edit" && (!canWrite || patient.editable===false)}
          onClick={() =>
            onOpen({ view: "record", patientId: patient.id, mode })
          }
        >
          <ExternalLink size={12} />
          {t(`template.clinical.${mode}`)}
        </Button>
      ))}
      <Button
        size="xs"
        variant="ghost"
        disabled={!canWrite || capabilities?.care===false}
        onClick={() => onCare("encounter", patient.id)}
      >
        <Stethoscope size={13} />
        {t("template.clinical.encounter")}
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={!canWrite || capabilities?.care===false}
        onClick={() => onCare("appointment", patient.id)}
      >
        <Calendar size={13} />
        {t("template.clinical.book")}
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={capabilities?.overview===false}
        aria-label="template.clinical.overview"
        onClick={() => onOpen({ view: "overview", patientId: patient.id })}
      >
        360°
      </Button>
    </div>
  );
}
export function PatientQueryResults({
  rows,
  columns,
  view,
  filters,
  selectedId,
  detail,
  onSelect,
  actions,
  format,
  preferences,
  onSort,
}: {
  rows: PatientSummary[];
  columns: string[];
  view: string;
  filters: PatientFilters;
  selectedId?: string;
  detail: ReactNode;
  onSelect: (p: PatientSummary) => void;
  actions: (p: PatientSummary) => ReactNode;
  format: ClinicalPageProps["format"];
  preferences: ClinicalPageProps["preferences"];
  onSort?: (key: string) => void;
}) {
  const { t } = useLocalization();
  const value = (
    p: PatientSummary,
    key: (typeof queryColumns)[number],
  ): ReactNode => {
    if (key === "name")
      return (
        <div className={styles.patient}>
          <Avatar
            name={p.name}
            size="sm"
            decorative
            className={styles.avatar}
          />
          <div>
            <Button variant="ghost" onClick={() => onSelect(p)}>
              <QueryHighlight
                value={p.name}
                query={filters.firstName || filters.lastName || filters.q}
              />
            </Button>
            <div className={styles.sub}>{p.internalCode}</div>
            {p.possibleDuplicate ? (
              <Badge tone="warning">
                {t("template.clinical.possibleDuplicate")}
              </Badge>
            ) : null}
            {p.matchedIn?.map((k) => (
              <Badge key={k}>{t(`template.clinical.${k}`)}</Badge>
            ))}
          </div>
        </div>
      );
    if (key === "birthDate") {
      const age = ageParts(p.birthDate);
      return (
        <>
          {format.date(p.birthDate)}
          {age ? (
            <span className={styles.hint}>
              {" "}
              · {t("template.clinical.ageYears", { count: age.years })}
            </span>
          ) : null}
        </>
      );
    }
    if (key === "registeredAt")
      return p.registeredAt ? format.date(p.registeredAt) : "—";
    if (key === "gender" || key === "status")
      return (
        <Badge
          tone={
            key === "status" && p.status === "active" ? "success" : "neutral"
          }
        >
          {p[key] ? (t(`template.clinical.${p[key]}`) === `template.clinical.${p[key]}` ? p[key] : t(`template.clinical.${p[key]}`)) : "—"}
        </Badge>
      );
    if (key === "country" || key === "nationality")
      return p[key]
        ? t(`template.clinical.${p[key]}`) === `template.clinical.${p[key]}`
          ? p[key]
          : t(`template.clinical.${p[key]}`)
        : "—";
    return (
      <QueryHighlight
        value={String(p[key] ?? "")}
        query={
          key === "mrn"
            ? filters.mrn || filters.q
            : key === "mobile"
              ? filters.mobile
              : key === "identifier"
                ? filters.identity
                : undefined
        }
      />
    );
  };
  if (view === "cards")
    return (
      <CardGrid className={styles.grid} style={{"--fs-scale": "var(--fs-result)"} as React.CSSProperties}>
        {rows.map((p) => (
          <Fragment key={p.id}>
            <Card className={styles.card}>
              <div className={styles.cardHead}>
                {value(p, "name")}
                {value(p, "status")}
              </div>
              <div className={styles.cardRows}>
                <span className={styles.sub}>{value(p, "mrn")}</span>
                <div>
                  {value(p, "gender")} · {value(p, "birthDate")}
                </div>
                <div className={styles.tools}>
                  <Globe size={13} />
                  {value(p, "nationality")} · {value(p, "country")}
                </div>
                <div className={styles.tools}>
                  <Phone size={13} />
                  {value(p, "mobile")}
                </div>
                <div className={styles.tools}>
                  <IdCard size={13} />
                  {value(p, "identifier")}
                </div>
              </div>
              <div className={styles.cardFoot}>
                <span className={styles.hint}>
                  {t("template.clinical.registeredAt")}{" "}
                  {value(p, "registeredAt")}
                </span>
                {actions(p)}
              </div>
            </Card>
            {p.id === selectedId && detail ? (
              <div className="col-span-full">{detail}</div>
            ) : null}
          </Fragment>
        ))}
      </CardGrid>
    );
  return (
    <Card>
      <TableContainer>
        <Table
          className={styles.table}
          striped
          density={
            preferences.density === "compact" ? "compact" : "comfortable"
          }
        >
          <TableHeader>
            <TableRow>
              {queryColumns
                .filter((k) => columns.includes(k))
                .map((k) => (
                  <TableHead key={k}>
                    {["name", "mrn", "birthDate", "registeredAt"].includes(
                      k,
                    ) ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={!onSort} onClick={() => onSort?.(k)}
                      >
                        {t(columnLabel(k))}
                        {filters.sort === k
                          ? filters.direction === "desc"
                            ? " ↓"
                            : " ↑"
                          : ""}
                      </Button>
                    ) : (
                      t(columnLabel(k))
                    )}
                  </TableHead>
                ))}
              <TableHead>
                <span className="sr-only">{t("template.field.actions")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <Fragment key={p.id}>
                <TableRow
                  data-selected={selectedId === p.id}
                  tabIndex={0}
                  onClick={() => onSelect(p)}
                  onKeyDown={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      onSelect(p);
                    }
                  }}
                >
                  {queryColumns
                    .filter((k) => columns.includes(k))
                    .map((k) => (
                      <TableCell key={k}>{value(p, k)}</TableCell>
                    ))}
                  <TableCell>{actions(p)}</TableCell>
                </TableRow>
                {selectedId === p.id && detail ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1}>{detail}</TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
