'use client';
import {useCallback} from 'react';
import {downloadGrid} from '@pepbits/page-engines/worklist';
import {usePreferences} from '@pepbits/preferences/react';

/** Downloads already-reviewed Settle rows in the effective export format (CSV or XLSX, PREF-07).
 * The shared grid encoder keeps numeric cells numeric and neutralises formula-like text. The Settle
 * API decides which rows the desk user may read; this only saves what the screen requested. */
export function useExportRows() {
  const {preferences} = usePreferences();
  const format = preferences.exportFormat === 'xlsx' ? 'xlsx' : 'csv';
  const save = useCallback((name: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return null;
    const headers = Object.keys(rows[0]!);
    return downloadGrid(headers, rows.map(row => headers.map(h => {const v = row[h]; return typeof v === 'number' ? v : v === null || v === undefined ? '' : String(v);})), format, name);
  }, [format]);
  return {save, label: format === 'xlsx' ? 'Export XLSX' : 'Export CSV'};
}
