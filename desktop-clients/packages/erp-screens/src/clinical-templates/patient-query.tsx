"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Drawer,
  CenterRecordCard,
  Modal,
  Checkbox,
  ConfirmDialog,
  RecoveryNotice,
  failureFromError,
  Pagination,
  useLocalization,
} from "@pepbits/ops-ui";
import {
  Search,
  Columns3,
  Download,
} from "lucide-react";
import type {
  PatientFilters,
  PatientSummary,
  PatientSavedSearch,
} from "@pepbits/erp-config";
import { exportRows } from "../worklist/export-rows";
import {
  ClinicalLoading,
  useClinicalLoad,
  type ClinicalPageProps,
} from "./shared";
import { PatientCareAction } from "./care-action";
import { PatientQueryFilters } from "./query-filters";
import {
  PatientQueryActions,
  PatientQueryResults,
  queryColumns,
  columnLabel,
} from "./query-results";
import { PatientQueryDetail } from "./query-detail";
import {
  normalizeQuery,
  querySignature,
  queryFields,
  type QueryField,
} from "./query-model";
import {usePreferenceChoice} from "../preference-choice";
import styles from "./query-layout.module.css";
export function PatientQueryTemplate(props: ClinicalPageProps) {
  const { adapter, metadata, format, preferences, onOpen } = props,
    { t } = useLocalization();
  const [filters, setFilters] = useState<PatientFilters>({}),
    [applied, setApplied] = useState<PatientFilters | null>(null),
    [columns, setColumns] = useState<string[]>(
      queryColumns.filter((k) => k !== "country"),
    ),
    [columnsOpen, setColumnsOpen] = useState(false),
    [selected, setSelected] = useState<PatientSummary | null>(null),
    [care, setCare] = useState<{
      kind: "appointment" | "encounter";
      id: string;
    } | null>(null),
    [presets, setPresets] = useState<PatientSavedSearch[]>([]),
    [recents, setRecents] = useState<PatientFilters[]>([]),
    [error, setError] = useState<unknown>(null),
    [exportOpen, setExportOpen] = useState(false),
    [exportBusy, setExportBusy] = useState(false),
    [presetBusy, setPresetBusy] = useState(false),
    [help, setHelp] = useState(false);
  const [view] = usePreferenceChoice(props, "resultView");
  const [detail] = usePreferenceChoice(props, "previewMode");
  const [pageSize, setPageSize, pageSizeLocked] = usePreferenceChoice(props, "pageSize");
  useEffect(() => { setApplied(a => a && a.pageSize !== pageSize ? {...a, pageSize, page: 1} : a); }, [pageSize]);
  const search = useClinicalLoad(
    () => (applied ? adapter.search(applied) : Promise.resolve(null)),
    [adapter, applied],
  );
  const root = useRef<HTMLDivElement>(null),
    nameRef = useRef<HTMLDivElement>(null),
    active = useRef(true),
    operation = useRef(false);
  useEffect(() => {
    active.current = true;
    if(metadata.queryCapabilities?.presets===false)return ()=>{active.current=false;};
    void adapter
      .savedSearches()
      .then((v) => {
        if (active.current) setPresets(v);
      })
      .catch((e) => {
        if (active.current) setError(e);
      });
    return () => {
      active.current = false;
    };
  }, [adapter]);
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;
    const key = (e: KeyboardEvent) => {
      if (
        !root.current?.getClientRects().length ||
        document.querySelector('[role="dialog"]') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const target = e.target as HTMLElement;
      if (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        nameRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [preferences.keyboardShortcuts]);
  const apply = (value = filters) => {
    const normalized = normalizeQuery(value);
    if (!queryFields.some((k) => normalized[k])) return;
    setFilters(normalized);
    setApplied({ ...normalized, page: 1, pageSize });
    setSelected(null);
    setError(null);
    setRecents((previous) =>
      [
        normalized,
        ...previous.filter(
          (f) => querySignature(f) !== querySignature(normalized),
        ),
      ].slice(0, 6),
    );
  };
  const onCare = (kind: "appointment" | "encounter", id: string) => {
    setSelected(null);
    setCare({ kind, id });
  };
  const savePreset = async (name: string) => {
    if (metadata.queryCapabilities?.presets===false || operation.current) return false;
    operation.current = true;
    setPresetBusy(true);
    setError(null);
    try {
      const next = await adapter.saveSearch(name, normalizeQuery(filters));
      if (active.current) setPresets(next);
      return true;
    } catch (e) {
      if (active.current) setError(e);
      return false;
    } finally {
      operation.current = false;
      if (active.current) setPresetBusy(false);
    }
  };
  const deletePreset = async (id: string) => {
    if (operation.current) return;
    operation.current = true;
    setPresetBusy(true);
    try {
      const next = await adapter.deleteSearch(id);
      if (active.current) setPresets(next);
    } catch (e) {
      if (active.current) setError(e);
    } finally {
      operation.current = false;
      if (active.current) setPresetBusy(false);
    }
  };
  const download = async () => {
    if (metadata.queryCapabilities?.export===false || exportBusy || !applied) return;
    setExportBusy(true);
    setError(null);
    try {
      const response = await adapter.exportRows(applied);
      exportRows(
        response.rows.map((r) => ({
          mrn: r.mrn,
          patientName: r.name,
          dob: r.birthDate,
          gender: t(`template.clinical.${r.gender}`),
          phone: r.mobile,
          email: r.email,
          status: t(`template.clinical.${r.status}`),
        })),
        [
          { key: "mrn", label: t("template.clinical.mrn") },
          { key: "patientName", label: t("template.clinical.name") },
          { key: "dob", label: t("template.clinical.birthDate"), type: "date" },
          { key: "gender", label: t("template.clinical.gender") },
          { key: "phone", label: t("template.clinical.mobile") },
          { key: "email", label: t("template.clinical.email") },
          { key: "status", label: t("template.clinical.status") },
        ],
        format,
        preferences.exportFormat,
        "clinical-demo-patients",
      );
      setExportOpen(false);
    } catch (e) {
      setError(e);
    } finally {
      setExportBusy(false);
    }
  };
  const navigate: ClinicalPageProps["onOpen"] = (destination) => {
    setSelected(null);
    onOpen(destination);
  };
  const actions = (p: PatientSummary) => (
    <PatientQueryActions
      patient={p}
      canWrite={metadata.canWrite}
      capabilities={metadata.queryCapabilities}
      onOpen={navigate}
      onCare={onCare}
    />
  );
  const quick = selected ? (
    <PatientQueryDetail
      key={selected.id}
      {...props}
      onOpen={navigate}
      patient={selected}
      rows={search.value?.rows ?? []}
      mode={detail}
      onSelect={setSelected}
      onClose={() => setSelected(null)}
      onCare={onCare}
    />
  ) : null;
  return (
    <div
      ref={root}
      className={styles.surface}
      data-clinical-query
      data-density={preferences.density}
    >
      {error ? (
        <RecoveryNotice
          failure={failureFromError(error)}
          onReturn={() => setError(null)}
        />
      ) : null}
      <PatientQueryFilters
        filters={filters}
        metadata={metadata}
        presets={presets}
        recents={recents}
        busy={!!applied && !search.value && !search.error}
        presetBusy={presetBusy}
        error={error}
        inputRef={nameRef}
        onChange={(key: QueryField | "mobileCode", value: string) =>
          setFilters((f) => ({ ...f, [key]: value }))
        }
        onSearch={() => apply()}
        onClear={() => {
          setFilters({});
          setApplied(null);
          setSelected(null);
          setError(null);
        }}
        onApply={apply}
        onSave={savePreset}
        onDelete={(id) => void deletePreset(id)}
        onHelp={() => setHelp(true)}
        onNew={() => navigate({ view: "record", mode: "new" })}
      />
      {!applied ? (
        <div className={styles.empty}>
          <Search size={30} />
          <h2>{t("template.clinical.searchRegistry")}</h2>
          <p>{t("template.clinical.searchRegistryHint")}</p>
        </div>
      ) : (
        <>
          <div className={styles.bar}>
            <p role="status">
              {search.value
                ? t(
                    search.value.hasMore !== undefined ? "template.clinical.pageResults" : search.value.total === 1
                      ? "template.clinical.onePatientFound"
                      : "template.clinical.resultCount",
                    {
                      count: search.value.hasMore !== undefined ? search.value.rows.length : search.value.total,
                    },
                  )
                : t("template.clinical.searching")}
            </p>
            <div className={styles.tools}>
              {view === "table" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColumnsOpen(true)}
                >
                  <Columns3 size={14} />
                  {t("template.clinical.columns")}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                disabled={metadata.queryCapabilities?.export===false || !search.value?.total || exportBusy}
                onClick={() => setExportOpen(true)}
              >
                <Download size={14} />
                {t("template.clinical.export")}
              </Button>

            </div>
          </div>
          {!search.value ? (
            <ClinicalLoading error={search.error} retry={search.retry} />
          ) : !search.value.rows.length ? (
            <div className={styles.empty}>
              <Search size={30} />
              <h2>{t("template.clinical.noPatients")}</h2>
              <p>
                {t(
                  applied.q && !metadata.searchHint
                    ? "template.clinical.noWholeWords"
                    : "template.clinical.relaxFilters",
                )}
              </p>
            </div>
          ) : (
            <>
              <PatientQueryResults
                rows={search.value.rows}
                columns={columns}
                view={view}
                filters={applied}
                selectedId={selected?.id}
                detail={detail === "inline" ? quick : null}
                onSelect={setSelected}
                actions={actions}
                format={format}
                onSort={metadata.queryCapabilities?.sort===false ? undefined : (key) => {
                  setSelected(null);
                  setApplied((a) => ({
                    ...a,
                    sort: key,
                    direction:
                      a?.sort === key && a.direction !== "desc"
                        ? "desc"
                        : "asc",
                    page: 1,
                  }));
                }}
                preferences={preferences}
              />
              <Pagination
                pageSizeDisabled={pageSizeLocked}
                page={search.value.page}
                pageSize={search.value.pageSize}
                total={search.value.total}
                hasMore={search.value.hasMore}
                onPageChange={(page) => {
                  setSelected(null);
                  setApplied((a) => ({ ...a, page }));
                }}
                onPageSizeChange={(pageSize) => {
                  setSelected(null);
                  setPageSize(pageSize);
                }}
              />
            </>
          )}
        </>
      )}
      <Drawer
        open={!!selected && (detail === "right-drawer" || detail === "left-drawer")}
        onClose={() => setSelected(null)}
        title="template.clinical.quickView"
        side={detail === "left-drawer" ? "left" : "right"}
        width="lg"
      >
        {(detail === "right-drawer" || detail === "left-drawer") ? quick : null}
      </Drawer>
      <Modal
        open={!!selected && detail === "center-modal"}
        onClose={() => setSelected(null)}
        title="template.clinical.quickView"
        size="xl"
      >
        {detail === "center-modal" ? quick : null}
      </Modal>
      <CenterRecordCard open={!!selected && detail === "center-card"} onClose={() => setSelected(null)} title="template.clinical.quickView">
        {detail === "center-card" ? quick : null}
      </CenterRecordCard>
      <Modal
        open={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        title="template.clinical.columns"
      >
        <div className="space-y-3">
          {queryColumns.map((key) => (
            <Checkbox
              key={key}
              label={columnLabel(key)}
              disabled={key === "name"}
              checked={columns.includes(key)}
              onChange={(e) =>
                setColumns((c) =>
                  e.target.checked ? [...c, key] : c.filter((k) => k !== key),
                )
              }
            />
          ))}
        </div>
      </Modal>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="template.clinical.keyboardShortcuts"
      >
        <div className="space-y-3">
          {[
            ["/", "searchAnywhere"],
            ["?", "keyboardShortcuts"],
            ["← →", "patientNavigation"],
            ["Esc", "closeDetails"],
          ].map(([key, label]) => (
            <p key={key}>
              <kbd className="me-3 rounded border border-[var(--border)] px-2 py-1">
                {key}
              </kbd>
              {t(`template.clinical.${label}`)}
            </p>
          ))}
        </div>
      </Modal>
      <ConfirmDialog
        open={exportOpen}
        title="template.clinical.export"
        message="template.clinical.exportNotice"
        confirmLabel="template.clinical.export"
        onConfirm={() => void download()}
        onCancel={() => {
          if (!exportBusy) setExportOpen(false);
        }}
      />
      {care ? (
        <PatientCareAction
          {...care}
          patientId={care.id}
          adapter={adapter}
          metadata={metadata}
          onClose={() => setCare(null)}
          onDone={() => {
            setCare(null);
            search.retry();
          }}
        />
      ) : null}
    </div>
  );
}
