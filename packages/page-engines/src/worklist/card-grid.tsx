"use client";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";

import React from "react";
import { Check, Eye, MoreHorizontal, Pencil, SquareArrowOutUpRight } from "@pepbits/icons";
import {Card} from "@pepbits/components";
import {Badge, StatusBadge} from "@pepbits/ui";
import {IconButton} from "@pepbits/ui";
import {ActionMenu, MenuButton} from "@pepbits/components";
import {cn} from "@pepbits/ui";
import type {DataColumn} from "../types";
import type {Density} from "@pepbits/preferences";
import type {Formatters} from "@pepbits/i18n";



export function CardGrid({ rows, columns, primaryKey, displayKey, selected, onToggle, onPreview, onView, onEdit, canEdit = true, density, format }: {
  rows: Array<Record<string, string | number | boolean>>;
  columns: DataColumn[];
  primaryKey: string;
  displayKey: string;
  selected: string[];
  onToggle: (id: string) => void;
  onPreview: (row: Record<string, string | number | boolean>) => void;
  onView: (row: Record<string, string | number | boolean>) => void;
  canEdit?: boolean;
  onEdit: (row: Record<string, string | number | boolean>) => void;
  density: Density;
  format: Formatters;
}) {
  const {t}=useLocalization();
  const detailCount = density === "compact" ? 3 : density === "spacious" ? 7 : 5;
  const detailColumns = columns.filter((column) => column.key !== primaryKey && column.key !== displayKey && column.key !== "status").slice(0, detailCount);
  return (
    <div className={cn("grid gap-3 p-3", density === "compact" ? "md:grid-cols-3 xl:grid-cols-5" : density === "spacious" ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4")} style={{ "--fs-scale": "var(--fs-result)" } as React.CSSProperties}>
      {rows.map((row) => {
        const id = String(row[primaryKey]);
        const checked = selected.includes(id);
        return (
          <Card key={id} className={cn("group relative overflow-hidden transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] hover:shadow-[var(--shadow-md)]", checked && "border-[var(--primary)] ring-2 ring-[var(--primary-soft)]")}>
            <button type="button" aria-label={t("Select {item}",{item:id})} onClick={() => onToggle(id)} className={cn("absolute left-3 top-3 z-10 flex size-5 items-center justify-center rounded-md border bg-[var(--surface)] transition", checked ? "border-[var(--primary)] bg-[var(--primary-fill)] text-white" : "border-[var(--border-strong)] text-transparent hover:text-[var(--text-subtle)]")}><Check className="size-3" /></button>
            <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 pb-3 pt-10" onClick={() => onPreview(row)}>
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[length:calc(9px*var(--fs-scale))] font-black uppercase tracking-[.08em] text-[var(--primary)]">{id}</div><h3 className="mt-1 truncate text-[length:calc(12px*var(--fs-scale))] font-black tracking-[-.02em]">{String(row[displayKey] ?? id)}</h3></div>{row.status !== undefined ? <StatusBadge value={row.status} /> : null}</div>
            </div>
            <button type="button" onClick={() => onPreview(row)} className="block w-full p-3 text-left">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                {detailColumns.map((column) => <div key={column.key} className="min-w-0"><div className="truncate text-[length:calc(8px*var(--fs-scale))] font-bold uppercase tracking-[.07em] text-[var(--text-subtle)]"><LocalizedText message={column.label} /></div><div className="mt-0.5 truncate text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{column.type === "status" ? <Badge>{format.cell(column, row[column.key])}</Badge> : format.cell(column, row[column.key])}</div></div>)}
              </div>
            </button>
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5"><span className="px-1 text-[length:calc(8px*var(--fs-scale))] font-semibold text-[var(--text-subtle)]"><LocalizedText message="ui.updated.recently.12065961" /></span><div className="flex"><IconButton label="ui.preview.324b134f" className="size-7" onClick={() => onPreview(row)}><Eye className="size-3.5" /></IconButton><IconButton disabled={!canEdit} label="ui.edit.464c4ffd" className="size-7" onClick={() => onEdit(row)}><Pencil className="size-3.5" /></IconButton><ActionMenu trigger={<IconButton label="ui.more.d47d7cb0" className="size-7"><MoreHorizontal className="size-3.5" /></IconButton>}>{(close) => <><MenuButton icon={<SquareArrowOutUpRight className="size-3.5" />} label="Open full record" onClick={() => { onView(row); close(); }} /><MenuButton label="View audit history" onClick={close} /></>}</ActionMenu></div></div>
          </Card>
        );
      })}
    </div>
  );
}
