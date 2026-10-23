"use client";
import {Card} from "@pepbits/components";
import {DataValue, DescriptionList} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";

import React from "react";
import {InlineRecordPreview} from "./preference-preview";
import { ExternalLink, Pencil, ShieldCheck } from "@pepbits/icons";
import {usePreferences} from "@pepbits/preferences/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {Button} from "@pepbits/ui";
import {Badge, StatusBadge} from "@pepbits/ui";
import {CenterRecordCard, Drawer, Modal} from "@pepbits/components";
import type {DataColumn, WorklistConfig} from "../types";

function PreviewContent({ row, config }: { row: Record<string, string | number | boolean>; config: WorklistConfig }) {
  const format = useFormatters();
  const { t } = useLocalization();
  const columnMap = Object.fromEntries(config.columns.map((column) => [column.key, column])) as Record<string, DataColumn>;
  const primary = String(row[config.primaryKey]);
  const display = String(row[config.displayKey] ?? primary);
  const entries = Object.entries(row).slice(0, 12);
  return (
    <div>
      <Card shadow="none" tone="muted" radius="2xl" className="p-4">
        <div className="flex items-start justify-between gap-3"><div><Badge tone="brand">{primary}</Badge><h3 className="mt-2 text-[length:calc(16px*var(--fs-scale))] font-black tracking-[-.025em]">{display}</h3><p className="mt-1 text-[length:calc(10px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.limited.record.preview.full.details.open.in.a.workspace.441dd9b4" /></p></div>{row.status !== undefined ? <StatusBadge value={row.status} /> : null}</div>
      </Card>
      <DescriptionList layout="stacked" className="mt-4 grid-cols-2 gap-x-5 gap-y-4" itemClassName="min-w-0"
        termClassName="truncate text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.09em] text-[var(--text-subtle)]"
        valueClassName="mt-1 truncate text-[length:calc(10.5px*var(--fs-scale))] font-bold text-[var(--text)]"
        items={entries.filter(([key]) => key !== config.displayKey && key !== config.primaryKey && key !== "status").map(([key, value]) => {
          const column = columnMap[key];
          const output = typeof value === "boolean" ? t(value ? "Enabled" : "Disabled") : format.cell(column, value);
          return { id: key, label: column?.labelKey ?? column?.label ?? key.replace(/([A-Z])/g, " $1"), value: <DataValue value={output} /> };
        })} />
      <Card shadow="none" tone="muted" radius="xl" className="mt-4 flex items-center gap-2 px-3 py-2.5 text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]"><ShieldCheck className="size-4 shrink-0 text-[var(--success-ink)]" /><span><LocalizedText message="ui.visibility.is.filtered.by.your.current.role.branch.and.f.8c7ca791" /></span></Card>
    </div>
  );
}

export function RecordPreview({ row, config, onClose, onView, onEdit, canEdit = true }: { row: Record<string, string | number | boolean> | null; config: WorklistConfig; onClose: () => void; onView: () => void; onEdit: () => void; canEdit?: boolean }) {
  const { preferences } = usePreferences();
  const open = Boolean(row);
  if (!row) return null;
  const title = `${config.title} preview`;
  const footer = <><Button variant="ghost" onClick={onClose}><LocalizedText message="ui.close.7d9eb7ac" /></Button><Button variant="secondary" leftIcon={<ExternalLink className="size-3.5" />} onClick={onView}><LocalizedText message="ui.open.full.record.02ac0023" /></Button><Button variant="primary" leftIcon={<Pencil className="size-3.5" />} disabled={!canEdit} onClick={onEdit}><LocalizedText message="ui.edit.464c4ffd" /></Button></>;
  const content = <PreviewContent row={row} config={config} />;
  if (preferences.previewMode === "inline") return <InlineRecordPreview open={open} onClose={onClose} title={title} footer={footer}>{content}</InlineRecordPreview>;
  if (preferences.previewMode === "left-drawer" || preferences.previewMode === "right-drawer") return <Drawer open={open} onClose={onClose} title={title} subtitle="Contextual limited-data preview" side={preferences.previewMode === "left-drawer" ? "left" : "right"} footer={footer}><div className="p-5">{content}</div></Drawer>;
  if (preferences.previewMode === "center-modal") return <Modal open={open} onClose={onClose} title={title} subtitle="ui.contextual.limited.data.preview.ab741383" size="md" footer={footer}><div className="p-5">{content}</div></Modal>;
  return <CenterRecordCard open={open} onClose={onClose} title={title} footer={footer}>{content}</CenterRecordCard>;
}
