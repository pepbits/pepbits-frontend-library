"use client";
import {usePresentationPreferences, TableContainer} from "@pepbits/components";
import {DataValue, Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";

import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, MoreHorizontal, Pencil, SquareArrowOutUpRight } from "@pepbits/icons";
import {Checkbox, cn} from "@pepbits/ui";
import {InlineEdit} from "@pepbits/components";
import {StatusBadge} from "@pepbits/ui";
import {IconButton} from "@pepbits/ui";
import {ActionMenu, MenuButton} from "@pepbits/components";
/* Stamped on every header and cell so the print stylesheet can refuse a class
   without JavaScript: see tokens.css. */
import {localizeFieldError} from "@pepbits/i18n";
import type {DataColumn} from "../types";
import type {Density} from "@pepbits/preferences";
import type {Formatters} from "@pepbits/i18n";

/**
 * What a correction typed into a cell has to satisfy before it is written.
 *
 * Per type rather than per column, because the wrongness is in the type: a
 * money column takes a number and no currency symbol, and a percent cannot pass
 * a hundred. Anything a specific column needs beyond this belongs on the column.
 */
function validateCell(column: DataColumn, next: string): string | null {
  if (next.trim() === "") return `${column.label} cannot be empty.`;
  if (column.type === "money" || column.type === "number" || column.type === "percent") {
    const parsed = Number(next.replace(/[\s,]/g, ""));
    if (!Number.isFinite(parsed)) return `${column.label} must be a number.`;
    if (parsed < 0) return `${column.label} cannot be negative.`;
    if (column.type === "percent" && parsed > 100) return "A percentage cannot be above 100.";
  }
  return null;
}

/* The status/boolean branches come FIRST and never reach the formatter: they
   render a badge, not text, and are the reason this stays a component rather
   than becoming a call to format.cell() at the call site. */
function formatValue(column: DataColumn, value: unknown, format: Formatters, wrap: boolean) {
  if (column.type === "status") return <StatusBadge value={value} />;
  if (typeof value === "boolean") return <StatusBadge value={value} />;
  if (column.type === "money") return <span className="font-extrabold tabular-nums">{format.cell(column, value)}</span>;
  if (column.type === "percent") return <span className="font-extrabold tabular-nums">{format.cell(column, value)}</span>;
  if (column.type === "number") return <span className="font-bold tabular-nums">{format.cell(column, value)}</span>;
  const text = format.cell(column, value);
  if (wrap) return <DataValue value={text} wrap className="block max-w-[360px]" />;
  return <DataValue value={text} className="block max-w-[260px]" />;
}

export function DataTable({ rows, columns, primaryKey, displayKey, selected, onToggle, onToggleAll, sort, onSort, onPreview, onView, onEdit, onRowOpen, canEdit = true, onCellCommit, density, format, stickyHeader = true, zebra = false, wrap = false }: {
  rows: Array<Record<string, string | number | boolean>>;
  columns: DataColumn[];
  primaryKey: string;
  displayKey: string;
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  sort: { key: string; direction: "asc" | "desc" } | null;
  onSort: (column: DataColumn) => void;
  onRowOpen?: (row: Record<string, string | number | boolean>) => void;
  onPreview: (row: Record<string, string | number | boolean>) => void;
  onView: (row: Record<string, string | number | boolean>) => void;
  canEdit?: boolean;
  onEdit: (row: Record<string, string | number | boolean>) => void;
  /** Present only where a shell can persist a correction. Absent means read-only. */
  onCellCommit?: (row: Record<string, string | number | boolean>, column: DataColumn, next: string) => void | Promise<void>;
  density: Density;
  format: Formatters;
  stickyHeader?: boolean;
  zebra?: boolean;
  wrap?: boolean;
}) {
  /* Padding comes from --row-py, which the host sets from the density
     preference. The old py-1.5/2.5/3.5 ternary was duplicated here and in
     CardGrid, and the two had already drifted by a step. `density` stays in the
     signature because CardGrid still uses it for column count. */
  const {t} = useLocalization();
  const managed=usePresentationPreferences();
  if(managed){density=managed.density;stickyHeader=managed.stickyTableHeader;zebra=managed.zebraStripes;wrap=managed.wrapCellText;}
  void density;
  const padding = "py-[var(--row-py)]";
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(String(row[primaryKey])));
  return (
    <TableContainer className="min-h-0" style={{ "--fs-scale": "var(--fs-result)" } as React.CSSProperties}>
      <Table className="w-full min-w-[920px] border-collapse text-left">
        <TableHeader className={cn("z-10 bg-[var(--surface-2)] shadow-[0_1px_0_var(--border)]", stickyHeader && "sticky top-0")}>
          <TableRow>
            <TableHead className="w-10 px-3 py-2"><Checkbox aria-label="ui.select.all.visible.records.e15adf6c" checked={allSelected} indeterminate={selected.length > 0 && !allSelected} onChange={onToggleAll} /></TableHead>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              return <TableHead key={column.key} data-classification={column.classification ?? "unclassified"} style={{ minWidth: column.width }} className="px-3 py-2 text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.08em] text-[var(--text-subtle)]"><button type="button" disabled={!column.sortable} onClick={() => onSort(column)} className="focus-ring inline-flex items-center gap-1 rounded-md transition hover:text-[var(--text)] disabled:cursor-default">{<LocalizedText message={column.labelKey ?? column.label} />}{column.sortable ? active ? sort?.direction === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-45" /> : null}</button></TableHead>;
            })}
            <TableHead className="sticky right-0 w-28 bg-[var(--surface-2)] px-3 py-2 text-right text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.08em] text-[var(--text-subtle)]"><LocalizedText message="ui.actions.ff8059dc" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => {
            const id = String(row[primaryKey]);
            const checked = selected.includes(id);
            /* Zebra on odd rows, but selection wins: a selected row must read as
               selected whichever stripe it landed on. */
            const stripe = zebra && rowIndex % 2 === 1 && !checked ? "bg-[color-mix(in_srgb,var(--surface-2)_60%,transparent)]" : undefined;
            return (
              <TableRow key={id} data-selected={checked ? "true" : undefined} tabIndex={onRowOpen?0:undefined} onKeyDown={event=>{if(event.key==='Enter'&&event.target===event.currentTarget)onRowOpen?.(row);}} onDoubleClick={() => onView(row)} className={cn("group border-b border-[var(--border)] transition hover:bg-[var(--surface-2)]", stripe, checked && "bg-[var(--primary-soft)]")}>
                <TableCell className={cn("px-3", padding)} onClick={(event) => event.stopPropagation()}><Checkbox aria-label={t("Select {item}",{item:id})} checked={checked} onChange={() => onToggle(id)} /></TableCell>
                {columns.map((column, index) => <TableCell key={column.key} data-classification={column.classification ?? "unclassified"} onClick={() => (onRowOpen??onPreview)(row)} className={cn("cursor-pointer px-3 text-[length:calc(10.5px*var(--fs-scale))] font-medium text-[var(--text-muted)]", padding, index === 0 && "font-extrabold text-[var(--primary)]", column.key === displayKey && "font-extrabold text-[var(--text)]")}>{onCellCommit && column.editable
                    /* stopPropagation: the cell opens the record preview, and
                       clicking into an editor must not also open a drawer over
                       the thing being edited. */
                    ? <span onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                        <InlineEdit
                          label={column.label}
                          value={String(row[column.key] ?? "")}
                          display={formatValue(column, row[column.key], format, wrap)}
                          inputMode={column.type === "money" || column.type === "number" || column.type === "percent" ? "decimal" : undefined}
                          validate={(next) => localizeFieldError(validateCell(column, next) ?? undefined, column.label, t) ?? null}
                          onCommit={(next) => onCellCommit(row, column, next)}
                        />
                      </span>
                      : formatValue(column, row[column.key], format, wrap)}</TableCell>)}
                <TableCell className={cn("sticky right-0 bg-[var(--surface)] px-2 text-right transition group-hover:bg-[var(--surface-2)]", checked && "bg-[var(--primary-soft)]", padding)}>
                  <div className="flex justify-end gap-0.5">
                    <IconButton label={t("Preview {item}",{item:id})} className="size-7" onClick={() => onPreview(row)}><Eye className="size-3.5" /></IconButton>
                    <IconButton label={t("Edit {item}",{item:id})} disabled={!canEdit} className="size-7" onClick={() => onEdit(row)}><Pencil className="size-3.5" /></IconButton>
                    <ActionMenu trigger={<IconButton label={t("More actions for {item}",{item:id})} className="size-7"><MoreHorizontal className="size-3.5" /></IconButton>}>
                      {(close) => <><MenuButton icon={<SquareArrowOutUpRight className="size-3.5" />} label="Open full record" onClick={() => { onView(row); close(); }} />{canEdit ? <MenuButton icon={<Pencil className="size-3.5" />} label="Edit record" onClick={() => { onEdit(row); close(); }} /> : null}<MenuButton label="Duplicate record" onClick={close} /><MenuButton label="View audit history" onClick={close} /></>}
                    </ActionMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
