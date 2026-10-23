"use client";
import {TableContainer} from '@pepbits/components';
import {Table,TableHeader,TableBody,TableFooter,TableRow,TableHead,TableCell} from '@pepbits/components';
import {LocalizedText} from '@pepbits/i18n/react';


import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, WandSparkles } from "@pepbits/icons";
import {Badge,Button,FilePicker,Input,cn} from '@pepbits/ui';
import {Card} from '@pepbits/components';
import {useScreenHost,useFormatters,useScreenDraftState} from '../screen-host';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {PresentationProvider} from '@pepbits/components';

import {SHEET_COLUMNS, SHEET_FIELDS, importSheet, reviewSheetExport, type SheetCell} from "./model";
import {exportAudit,type ExportAudit} from "./export-policy";

export interface SpreadsheetPageProps {
  initialRows?: SheetCell[][];
  /** Persist a value-free audit before the browser downloads a workbook. */
  audit: (entry: ExportAudit) => Promise<void>;
  pageId?: string;
  filename?: string;
}
export function SpreadsheetPage({initialRows = Array.from({length:20},()=>Array<SheetCell>(8).fill('')),audit,pageId='spreadsheet',filename='pepbits-costing-workbook.xlsx'}:SpreadsheetPageProps) {
  const {t}=useLocalization(),format=useFormatters(),host=useScreenHost(),{preferences}=usePreferences();
  const toast=({title,message,type}:{title:string;message:string;type:'success'|'error'|'info'})=>host.notify(t(title)+': '+t(message),{tone:type});
  const canExport=host.can('export',{pageId});
  const [rows,setRows]=useScreenDraftState<SheetCell[][]>('spreadsheet:'+pageId,initialRows);
  const [selected, setSelected] = useState({ row: 0, column: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = `${String.fromCharCode(65 + selected.column)}${selected.row + 1}`;
  const selectedValue = rows[selected.row]?.[selected.column] ?? "";

  const updateCell = (row: number, column: number, value: SheetCell) => {
    setRows((previous) => previous.map((current, rowIndex) => rowIndex === row ? current.map((cell, columnIndex) => columnIndex === column ? value : cell) : current));
  };

  const importFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]!];
      const parsed = worksheet ? XLSX.utils.sheet_to_json<unknown[]>(worksheet, {header:1, defval:""}) : [];
      const normalized = importSheet(parsed);
      setRows(normalized);
      toast({title:"Workbook imported",message:t("{count} rows loaded into Spreadsheet Studio.",{count:normalized.length}),type:"success"});
    } catch(error) {
      toast({title:"Import failed",message:error instanceof Error ? error.message : "Could not read workbook.",type:"error"});
    }
  };

  const exportWorkbook = async () => {
    if (!canExport) return;
    try {
      importSheet([SHEET_COLUMNS, ...rows]);
      const review = reviewSheetExport();
      await audit(exportAudit(pageId,review,rows.length));
      const worksheet = XLSX.utils.aoa_to_sheet([SHEET_COLUMNS, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Costing");
      XLSX.writeFile(workbook, filename.replace(/\.(xlsx|csv)$/i, '.'+preferences.exportFormat), {bookType:preferences.exportFormat});
      toast({title:"Workbook exported",message:"The edited worksheet was downloaded as an Excel file.",type:"success"});
    } catch(error) {
      toast({title:"Export failed",message:error instanceof Error ? error.message : "The export could not be recorded. Please retry.",type:"error"});
    }
  };

  const recalculate = () => {
    setRows((previous) => previous.map((row) => {
      const quantity = Number(row[2]) || 0;
      const unit = Number(row[3]) || 0;
      const discount = Number(row[4]) || 0;
      const tax = Number(row[5]) || 0;
      const subtotal = quantity * unit * (1 - discount / 100);
      return row.map((cell, index) => index === 6 ? Number((subtotal * (1 + tax / 100)).toFixed(2)) : cell);
    }));
    toast({ title: "Cost model recalculated", message: "Net cost was refreshed from quantity, unit cost, discount and tax.", type: "info" });
  };

  const total = rows.reduce((sum, row) => sum + (Number(row[6]) || 0), 0);

  return (
    <PresentationProvider value={preferences}><div className="flex w-full flex-col gap-3">
      <Card data-tour="sheet-tools" className="flex flex-wrap items-center gap-2 p-2.5">
        <FilePicker variant="primary" accept=".xlsx,.xls,.csv" icon={<Upload className="size-3.5" />} label="Import Excel / CSV" onFile={(file) => void importFile(file)} />
        <Button leftIcon={<Download className="size-3.5" />} disabled={!canExport} onClick={() => void exportWorkbook()}><LocalizedText message="ui.export.workbook.f9fce806" /></Button>
        <Button variant="secondary" leftIcon={<WandSparkles className="size-3.5" />} onClick={recalculate}><LocalizedText message="ui.recalculate.costs.2075b9f0" /></Button>
        <div className="ml-auto flex items-center gap-2"><Badge tone="brand">{rows.length}<LocalizedText message="ui.rows.dc601c4a" /></Badge><Badge tone="success">{format.money(total)}</Badge></div>
      </Card>

      <Card className="overflow-hidden">
        <div data-tour="sheet-bar" className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          <span className="flex h-8 min-w-14 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-[length:calc(10px*var(--fs-scale))] font-black">{cellRef}</span>
          <Input aria-label="ui.formula.bar.8b12e6c7" value={selectedValue} onChange={(event) => updateCell(selected.row, selected.column, event.target.value)} className="flex-1" />
          <span className="hidden text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)] lg:inline"><LocalizedText message="ui.edit.cells.directly.paste.ranges.import.workbooks.and.ex.fe3a397d" /></span>
        </div>
        <TableContainer data-tour="sheet" className="max-h-[650px]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void importFile(file); }}>
          <Table className="min-w-[1100px] w-full border-collapse text-[length:calc(10px*var(--fs-scale))]">
            <TableHeader className="bg-[var(--surface-2)]">
              <TableRow><TableHead className="w-12 border-b border-r border-[var(--border)] px-2 py-2 text-center text-[length:calc(9px*var(--fs-scale))] text-[var(--text-subtle)]">#</TableHead>{SHEET_COLUMNS.map((column, index) => <TableHead data-classification={SHEET_FIELDS[index]!.classification} key={column} className="min-w-32 border-b border-r border-[var(--border)] px-3 py-2 text-left font-extrabold"><span className="mr-2 text-[length:calc(8px*var(--fs-scale))] text-[var(--text-subtle)]">{String.fromCharCode(65 + index)}</span><LocalizedText message={column} /></TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>{rows.map((row, rowIndex) => <TableRow key={rowIndex} className="hover:bg-[var(--surface-2)]"><TableCell className="border-b border-r border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-center text-[length:calc(9px*var(--fs-scale))] font-bold text-[var(--text-subtle)]">{rowIndex + 1}</TableCell>{SHEET_COLUMNS.map((_, columnIndex) => <TableCell data-classification={SHEET_FIELDS[columnIndex]!.classification} key={columnIndex} className={cn("border-b border-r border-[var(--border)] p-0", selected.row === rowIndex && selected.column === columnIndex && "outline outline-2 -outline-offset-2 outline-[var(--primary)]")}><input aria-label={t("Row {row}, column {column}", {row:rowIndex + 1,column:t(SHEET_COLUMNS[columnIndex]!)})} value={row[columnIndex] ?? ""} onFocus={() => setSelected({ row: rowIndex, column: columnIndex })} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} className="h-8 w-full min-w-28 bg-transparent px-3 text-[length:calc(10px*var(--fs-scale))] outline-none" /></TableCell>)}</TableRow>)}</TableBody>
            <TableFooter className="sticky bottom-0 bg-[var(--surface)]"><TableRow><TableCell colSpan={7} className="border-t border-[var(--border-strong)] px-3 py-2 text-right text-[length:calc(10px*var(--fs-scale))] font-black"><LocalizedText message="ui.grand.total.d88867c4" /></TableCell><TableCell className="border-t border-[var(--border-strong)] px-3 py-2 text-[length:calc(11px*var(--fs-scale))] font-black text-[var(--primary)]">{format.money(total)}</TableCell><TableCell className="border-t border-[var(--border-strong)]" /></TableRow></TableFooter>
          </Table>
        </TableContainer>
      </Card>
    </div></PresentationProvider>
  );
}

export * from "./model";
export {exportAudit} from "./export-policy";
export type {ExportAudit} from "./export-policy";
