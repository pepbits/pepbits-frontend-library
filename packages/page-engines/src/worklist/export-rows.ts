import * as XLSX from "xlsx";
import {reviewExport, type ExportReview} from "../types";
import type {DataColumn} from "../types";
import type {ExportFormat} from "@pepbits/preferences";
import type {Formatters} from "@pepbits/i18n";

type Row = Record<string, string | number | boolean>;

/* Values are exported FORMATTED -- the same text the table shows -- rather than
   raw. A CSV that says "USD 184,200" where the screen said "USD 184,200" is what
   people expect; one that says 184200 next to a column header of "Credit limit"
   is a support ticket about missing currency. */
function toGrid(rows: Row[], columns: DataColumn[], format: Formatters): string[][] {
  const header = columns.map((column) => column.label);
  const body = rows.map((row) => columns.map((column) => format.cell(column, row[column.key])));
  return [header, ...body];
}

/**
 * A spreadsheet executes some of what it reads.
 *
 * A cell beginning `=`, `+`, `-` or `@` is a FORMULA to Excel, LibreOffice and
 * Sheets alike — `=cmd|' /C calc'!A0` included, which is a shell command in a
 * file that looks like a record list. The value arrives from any field a
 * person can type into, and nothing between that keyboard and this function
 * inspects it. An apostrophe is what every one of those programs reads as "the
 * rest of this cell is text".
 *
 * Numbers are exempt, and that exemption is the whole reason this is not a
 * blanket prefix: an amount of -1500.25 begins with the same character and is
 * not a formula, and quoting it as text exports a column nobody can total.
 *
 * The xlsx path needs none of this — aoa_to_sheet writes a string as a typed
 * string cell, so a leading `=` there is data rather than an expression.
 */
function formulaSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) && !Number.isFinite(Number(value)) ? `'${value}` : value;
}

function csvOf(grid: string[][]): string {
  const cell = (raw: string) => {
    const value = formulaSafe(raw);
    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  // \r\n so Excel on Windows opens it without a "line ending" prompt.
  return grid.map((line) => line.map(cell).join(",")).join("\r\n");
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoked on a tick: revoking synchronously races the click in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Download the given rows in the user's chosen format.
 *
 * The column policy is applied HERE, not by the caller, for the same reason
 * toQuery applies the URL policy rather than trusting whoever builds the link:
 * a rule enforced at the point of writing cannot be forgotten by the next
 * caller. The caller reviews the same columns to decide what to say first; this
 * decides what actually reaches the file.
 */
export function exportRows(rows: Row[], columns: DataColumn[], format: Formatters, kind: ExportFormat, baseName: string): { filename: string; review: ExportReview } {
  const review = reviewExport(columns);
  const grid = toGrid(rows, review.carried, format);
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = baseName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (kind === "xlsx") {
    const sheet = XLSX.utils.aoa_to_sheet(grid);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, baseName.slice(0, 31)); // Excel caps sheet names at 31
    const out = XLSX.write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const name = `${safe}-${stamp}.xlsx`;
    save(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name);
    return { filename: name, review };
  }
  const name = `${safe}-${stamp}.csv`;
  // BOM so Excel reads UTF-8 (Arabic names, the dirham sign) instead of Latin-1.
  save(new Blob(["﻿" + csvOf(grid)], { type: "text/csv;charset=utf-8" }), name);
  return { filename: name, review };
}
