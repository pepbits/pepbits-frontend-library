"use client";
import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardGrid,
  Button,
  Badge,
  Select,
  SearchInput,
  DescriptionList,
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  EmptyState,
  useLocalization,
} from "@pepbits/ops-ui";
import type { PatientCareRow } from "@pepbits/erp-config";
import {
  ClinicalLoading,
  ClinicalSection,
  PatientBanner,
  useClinicalLoad,
  type ClinicalPageProps,
} from "./shared";
import { PatientCareAction } from "./care-action";
import { selectOverviewRows } from "./overview-data";
const sections = [
  { id: "actionable", kind: "appointment" },
  { id: "encounters", kind: "encounter" },
  { id: "appointments", kind: "appointment" },
  { id: "episodes", kind: "episode" },
  { id: "orders", kind: "order" },
  { id: "recent", kind: "encounter" },
  { id: "clinicalSnapshot", kind: "clinical" },
  { id: "insurance", kind: "" },
  { id: "billing", kind: "billing" },
  { id: "pharmacy", kind: "pharmacy" },
  { id: "careTeam", kind: "team" },
  { id: "location", kind: "location" },
  { id: "quickActions", kind: "" },
] as const;
export function Patient360Template(props: ClinicalPageProps) {
  const { adapter, metadata, patientId, format, onOpen } = props,
    { t } = useLocalization();
  const [id, setId] = useState(patientId ?? ""),
    [query, setQuery] = useState(""),
    [open, setOpen] = useState<string[]>([
      "actionable",
      "encounters",
      "clinicalSnapshot",
    ]),
    [all, setAll] = useState<{ title: string; rows: PatientCareRow[] } | null>(
      null,
    ),
    [care, setCare] = useState<"appointment" | "encounter" | null>(null);
  const patients = useClinicalLoad(
    () => adapter.search({ q: query, pageSize: 50 }),
    [adapter, query],
  );
  const result = useClinicalLoad(
    () => (id ? adapter.overview(id) : Promise.resolve(null)),
    [adapter, id],
  );
  const data = result.value,
    options = [
      { value: "", label: "template.clinical.selectPatient" },
      ...(patients.value?.rows ?? []).map((p) => ({
        value: p.id,
        label: `${p.mrn} · ${p.name}`,
      })),
    ];
  if (data && !options.some((p) => p.value === data.patient.id))
    options.push({
      value: data.patient.id,
      label: [
        data.patient.mrn,
        data.patient.values.firstName,
        data.patient.values.lastName,
      ].join(" "),
    });
  const renderRows = (rows: PatientCareRow[]) =>
    !rows.length ? (
      <EmptyState />
    ) : (
      <TableContainer>
        <Table
          className="w-full min-w-[580px]"
          striped
          bordered
          density={
            props.preferences.density === "compact" ? "compact" : "comfortable"
          }
        >
          <TableHeader>
            <TableRow>
              {["date", "description", "provider", "status"].map((key) => (
                <TableHead className="p-3 text-start" key={key}>
                  {t(`template.clinical.${key}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="p-3 whitespace-nowrap">
                  {format.date(row.date)}
                  <div className="text-xs text-[var(--text-muted)]">
                    {format.time(new Date(row.date))}
                  </div>
                </TableCell>
                <TableCell className="p-3">
                  <b>{t(row.title)}</b>
                  {row.detail ? (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {t(row.detail)}
                    </p>
                  ) : null}
                  {row.amount !== undefined ? (
                    <p>{format.money(row.amount)}</p>
                  ) : null}
                </TableCell>
                <TableCell className="p-3">{row.provider ?? "—"}</TableCell>
                <TableCell className="p-3">
                  <Badge tone={row.status === "pending" ? "warning" : "brand"}>
                    {t(`template.clinical.${row.status}`)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  return (
    <div className="space-y-4" data-clinical-overview>
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <SearchInput
              aria-label="template.clinical.search"
              placeholder="template.clinical.search"
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
            />
            <Select
              className="min-w-64"
              label="template.clinical.selectPatient"
              value={id}
              options={options}
              onChange={(e) => setId(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button disabled={!id} onClick={result.retry}>
              {t("template.clinical.refresh")}
            </Button>
            <Button
              onClick={() =>
                setOpen(
                  open.length === sections.length
                    ? []
                    : sections.map((s) => s.id),
                )
              }
            >
              {t(
                open.length === sections.length
                  ? "template.clinical.collapseAll"
                  : "template.clinical.expandAll",
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      {patients.error ? (
        <ClinicalLoading error={patients.error} retry={patients.retry} />
      ) : null}
      {!id ? (
        <EmptyState title="template.clinical.selectPatient" />
      ) : !data ? (
        <ClinicalLoading error={result.error} retry={result.retry} />
      ) : (
        <>
          <PatientBanner
            patient={data.patient}
            format={format}
            actions={
              <>
                <Button
                  onClick={() =>
                    onOpen({ view: "record", patientId: id, mode: "view" })
                  }
                >
                  {t("template.clinical.openRecord")}
                </Button>
                <Button
                  variant="primary"
                  disabled={!metadata.canWrite}
                  onClick={() => setCare("appointment")}
                >
                  {t("template.clinical.book")}
                </Button>
              </>
            }
          />
          <p className="text-xs text-[var(--text-muted)]">
            {t("template.clinical.refreshed", {
              time: format.time(new Date(data.loadedAt)),
            })}
          </p>
          {sections.map((s) => {
            const rows = selectOverviewRows(
              data.rows,
              s.id,
              s.kind,
              data.loadedAt,
            );
            const insurance = data.patient.collections.insurances ?? [];
            return (
              <ClinicalSection
                key={s.id}
                title={t(`template.clinical.${s.id}`)}
                count={
                  s.id === "insurance"
                    ? insurance.length
                    : s.id === "quickActions"
                      ? undefined
                      : rows.length
                }
                summary={
                  s.id === "insurance"
                    ? insurance[0]?.payer
                    : rows[0]
                      ? t(rows[0].title)
                      : t("template.clinical.noneRecorded")
                }
                open={open.includes(s.id)}
                onToggle={() =>
                  setOpen((o) =>
                    o.includes(s.id)
                      ? o.filter((id) => id !== s.id)
                      : [...o, s.id],
                  )
                }
              >
                {s.id === "insurance" ? (
                  <CardGrid columns={2}>
                    {insurance.length ? (
                      insurance.map((row) => (
                        <Card key={row.id}>
                          <CardContent>
                            <DescriptionList
                              items={[
                                "payer",
                                "plan",
                                "memberNumber",
                                "expiry",
                              ].map((key) => ({
                                id: key,
                                label: `template.clinical.${key}`,
                                value: row[key] || "—",
                              }))}
                            />
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <EmptyState />
                    )}
                  </CardGrid>
                ) : s.id === "quickActions" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!metadata.canWrite}
                      onClick={() => setCare("appointment")}
                    >
                      {t("template.clinical.book")}
                    </Button>
                    <Button
                      disabled={!metadata.canWrite}
                      onClick={() => setCare("encounter")}
                    >
                      {t("template.clinical.encounter")}
                    </Button>
                    <Button
                      onClick={() =>
                        onOpen({ view: "record", patientId: id, mode: "view" })
                      }
                    >
                      {t("template.clinical.openRecord")}
                    </Button>
                    <Badge>
                      {t("template.clinical.documentCount", {
                        count: data.patient.collections.documents?.length ?? 0,
                      })}
                    </Badge>
                    <Badge>
                      {t("template.clinical.consentCount", {
                        count: data.patient.collections.consents?.length ?? 0,
                      })}
                    </Badge>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {s.id === "clinicalSnapshot" ? (
                      <DescriptionList
                        items={[
                          {
                            id: "bloodGroup",
                            label: "template.clinical.bloodGroup",
                            value: data.patient.values.bloodGroup
                              ? t(
                                  `template.clinical.${data.patient.values.bloodGroup}`,
                                )
                              : "—",
                          },
                          {
                            id: "clinicalNotes",
                            label: "template.clinical.clinicalNotes",
                            value: String(
                              data.patient.values.clinicalNotes || "—",
                            ),
                          },
                        ]}
                      />
                    ) : null}
                    {renderRows(rows.slice(0, 5))}
                    {rows.length > 5 ? (
                      <Button
                        onClick={() =>
                          setAll({ title: `template.clinical.${s.id}`, rows })
                        }
                      >
                        {t("template.clinical.viewAll", { count: rows.length })}
                      </Button>
                    ) : null}
                  </div>
                )}
              </ClinicalSection>
            );
          })}
        </>
      )}
      <Modal
        open={!!all}
        onClose={() => setAll(null)}
        title={all?.title ?? "template.clinical.overview"}
        size="xl"
      >
        {all ? renderRows(all.rows) : null}
      </Modal>
      {care ? (
        <PatientCareAction
          key={id + care}
          kind={care}
          patientId={id}
          adapter={adapter}
          metadata={metadata}
          onClose={() => setCare(null)}
          onDone={() => {
            setCare(null);
            result.retry();
          }}
        />
      ) : null}
    </div>
  );
}
