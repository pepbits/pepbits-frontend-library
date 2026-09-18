"use client";
import React, { useId, useState, type RefObject } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  DateInput,
  Modal,
  RecoveryNotice,
  failureFromError,
  useLocalization,
} from "@pepbits/ops-ui";
import {
  Search,
  SlidersHorizontal,
  Keyboard,
  Bookmark,
  RotateCcw,
  Clock,
} from "lucide-react";
import type {
  PatientFilters,
  PatientMetadata,
  PatientSavedSearch,
} from "@pepbits/erp-config";
import {
  queryFields,
  extraQueryFields,
  queryLabel,
  queryOptions,
  type QueryField,
} from "./query-model";
import styles from "./query-layout.module.css";
export function PatientQueryFilters({
  filters,
  metadata,
  presets,
  recents,
  busy,
  presetBusy,
  error,
  inputRef,
  onChange,
  onSearch,
  onClear,
  onApply,
  onSave,
  onDelete,
  onHelp,
  onNew,
}: {
  filters: PatientFilters;
  metadata: PatientMetadata;
  presets: PatientSavedSearch[];
  recents: PatientFilters[];
  busy: boolean;
  presetBusy: boolean;
  error?: unknown;
  inputRef: RefObject<HTMLDivElement | null>;
  onChange: (key: QueryField | "mobileCode", value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onApply: (filters: PatientFilters) => void;
  onSave: (name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  onHelp: () => void;
  onNew: () => void;
}) {
  const { t } = useLocalization(),
    id = useId(),
    [advanced, setAdvanced] = useState(false),
    [saving, setSaving] = useState(false),
    [name, setName] = useState(""),
    [preset, setPreset] = useState("");
  const enabled = (key: string) => !metadata.searchFields || metadata.searchFields.includes(key);
  const count = queryFields.filter((k) => enabled(k) &&
    String(filters[k] ?? "").trim(),
  ).length;
  const advancedCount = [
    ...extraQueryFields,
    "identityType",
    "country",
    "nationality",
    "gender",
    "birthDate",
    "status",
  ].filter((k) => filters[k as QueryField]).length;
  const select = (key: QueryField | "mobileCode") => enabled(key) ? (
    <Select
      label={queryLabel(key)}
      aria-label={queryLabel(key)}
      value={String(filters[key] ?? "")}
      options={[
        { value: "", label: "template.all" },
        ...queryOptions(metadata, key),
      ]}
      onChange={(e) => onChange(key, e.target.value)}
    />
  ) : null;
  const text = (key: QueryField) => enabled(key) ? (
    <Input
      label={queryLabel(key)}
      aria-label={queryLabel(key)}
      value={String(filters[key] ?? "")}
      onChange={(e) => onChange(key, e.target.value)}
    />
  ) : null;
  return (
    <Card className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.title}>
          <h1>{t("template.clinical.findPatient")}</h1>
          <Badge tone={count ? "success" : "warning"}>
            {count
              ? t("template.clinical.criteriaCount", { count })
              : t("template.clinical.criteriaRequired")}
          </Badge>
        </div>
        <div className={styles.tools}>
          {presets.length > 0 ? (
            <>
              <Select
                aria-label="template.clinical.savedSearches"
                value={preset}
                options={[
                  { value: "", label: "template.clinical.savedSearches" },
                  ...presets.map((p) => ({ value: p.id, label: p.name })),
                ]}
                onChange={(e) => {
                  setPreset(e.target.value);
                  const p = presets.find((p) => p.id === e.target.value);
                  if (p) onApply(p.filters);
                }}
              />
              {preset ? (
                <Button
                  size="xs"
                  disabled={presetBusy}
                  onClick={() => {
                    onDelete(preset);
                    setPreset("");
                  }}
                >
                  {t("template.remove")}
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={metadata.queryCapabilities?.presets===false || !count || presetBusy}
            onClick={() => setSaving(true)}
          >
            <Bookmark size={14} />
            {t("template.clinical.savePreset")}
          </Button>
          {count ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPreset("");
                onClear();
              }}
            >
              <RotateCcw size={14} />
              {t("template.clinical.clearAll")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={!metadata.canWrite}
            onClick={onNew}
          >
            {t("template.clinical.newPatient")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="template.clinical.keyboardShortcuts"
            onClick={onHelp}
          >
            <Keyboard size={17} />
          </Button>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (count && !busy) onSearch();
        }}
      >
        <div className={styles.free} ref={inputRef} hidden={!enabled("q")}>
          <Input
            label="template.clinical.searchAnywhere"
            value={filters.q ?? ""}
            onChange={(e) => onChange("q", e.target.value)}
            aria-describedby={`${id}-hint`}
          />
          <p id={`${id}-hint`} className={styles.hint}>
            {t(metadata.searchHint ?? "template.clinical.wholeWordHint")}
          </p>
        </div>
        <div className={styles.fields}>
          {text("mrn")}
          {text("firstName")}
          {text("lastName")}
          <div className={styles.phone}>
            {select("mobileCode")}
            {text("mobile")}
          </div>
          {text("identity")}
          <Button
            aria-expanded={advanced}
            aria-controls={`${id}-advanced`}
            onClick={() => setAdvanced((v) => !v)}
          >
            <SlidersHorizontal size={14} />
            {t("template.clinical.moreFilters")}
            {advancedCount ? <Badge>{advancedCount}</Badge> : null}
          </Button>
          <Button type="submit" variant="primary" disabled={!count || busy}>
            <Search size={16} />
            {t(
              busy ? "template.clinical.searching" : "template.clinical.search",
            )}
          </Button>
        </div>
        <div
          id={`${id}-advanced`}
          hidden={!advanced}
          className={styles.advanced}
        >
          <div className={styles.fields}>
            {select("identityType")}
            {select("nationality")}
            {select("country")}
            {select("gender")}
            {enabled("birthDate") ? <DateInput
              label="template.clinical.birthDate"
              value={filters.birthDate ?? ""}
              onChange={(e) => onChange("birthDate", e.target.value)}
            /> : null}
            {select("status")}
            {extraQueryFields.filter(key => metadata.searchFields?.includes(key)).map(key => <React.Fragment key={key}>
              {key === "birthDateFrom" || key === "birthDateTo" ? <DateInput label={queryLabel(key)} value={filters[key] ?? ""} onChange={e => onChange(key, e.target.value)} />
                : metadata.searchOptions?.[key] ? select(key) : text(key)}
            </React.Fragment>)}
          </div>
        </div>
      </form>
      {recents.length ? (
        <div className={styles.recent}>
          <Clock size={13} />
          <span>{t("template.clinical.recentSearches")}</span>
          {recents.map((recent, i) => {
            const parts = queryFields
              .filter((k) => recent[k])
              .map(
                (k) =>
                  `${t(queryLabel(k))}: ${t(queryOptions(metadata, k).find((o) => o.value === recent[k])?.label ?? String(recent[k]))}`,
              );
            return (
              <Button
                key={i}
                size="xs"
                variant="ghost"
                title={parts.join(" · ")}
                onClick={() => onApply(recent)}
              >
                {parts.slice(0, 2).join(" · ")}
                {parts.length > 2 ? ` +${parts.length - 2}` : ""}
              </Button>
            );
          })}
        </div>
      ) : null}
      <Modal
        open={saving}
        title="template.clinical.savePreset"
        onClose={() => {
          if (!presetBusy) setSaving(false);
        }}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !presetBusy)
              void onSave(name.trim()).then((ok) => {
                if (ok) {
                  setSaving(false);
                  setName("");
                }
              });
          }}
        >
          {error ? <RecoveryNotice failure={failureFromError(error)} /> : null}
          <Input
            label="template.clinical.searchName"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            variant="primary"
            type="submit"
            disabled={!name.trim() || presetBusy}
          >
            {t("template.clinical.saveSearch")}
          </Button>
        </form>
      </Modal>
    </Card>
  );
}
