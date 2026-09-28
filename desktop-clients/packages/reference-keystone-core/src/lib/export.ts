'use client';
/*
 * Worklist/ledger export following the host `exportFormat` preference. Mirrors the
 * erp-screens export helper (which this package cannot import without a cycle):
 * xlsx writes typed cells (numbers stay numeric, strings are string cells, so a leading
 * "=" is data), CSV is formula-safe with a UTF-8 BOM. Source filenames are kept; only
 * the extension follows the chosen format.
 */
import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { ExportFormat } from '@pepbits/erp-config';
import { useReferenceHost } from '@pepbits/reference-host';

export type ExportCell = string | number;

/** A cell a spreadsheet would execute is prefixed with an apostrophe; numbers are exempt. */
export function formulaSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && !Number.isFinite(Number(value)) ? `'${value}` : value;
}

export function csvOf(headers: string[], rows: ExportCell[][]): string {
  const cell = (raw: ExportCell) => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : '';
    const value = formulaSafe(String(raw ?? ''));
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return [headers, ...rows].map((line) => line.map(cell).join(',')).join('\r\n');
}

export function xlsxOf(headers: string[], rows: ExportCell[][], sheetName: string): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, (sheetName || 'Export').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  return XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export function exportFileName(sourceName: string, format: ExportFormat): string {
  return `${sourceName.replace(/\.(csv|xlsx)$/i, '')}.${format}`;
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Writes the file in the given format and returns the filename used. */
export function downloadRows(sourceName: string, headers: string[], rows: ExportCell[][], format: ExportFormat): string {
  const filename = exportFileName(sourceName, format);
  if (format === 'xlsx') {
    save(new Blob([xlsxOf(headers, rows, sourceName.replace(/\.(csv|xlsx)$/i, ''))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
  } else {
    save(new Blob(['﻿' + csvOf(headers, rows)], { type: 'text/csv;charset=utf-8' }), filename);
  }
  return filename;
}

/** Export bound to the host's effective export format. */
export function useExport() {
  const { preferences } = useReferenceHost();
  const format: ExportFormat = preferences.exportFormat === 'xlsx' ? 'xlsx' : 'csv';
  const label = format === 'xlsx' ? 'Export to Excel' : 'Export to CSV';
  const download = useCallback((sourceName: string, headers: string[], rows: ExportCell[][]) => downloadRows(sourceName, headers, rows, format), [format]);
  return { format, label, download };
}
