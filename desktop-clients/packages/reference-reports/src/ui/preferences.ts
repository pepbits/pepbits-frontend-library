"use client";
/*
 * Effective-preference controllers for the module. Values come from the host (already resolved against
 * tenant policy); managed/locked settings win over local choices and a policy change while mounted
 * replaces conflicting local state (PREF-01, PREF-02, PREF-04, PREF-06, PREF-07).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFormatters, type ExportFormat, type PreferenceKey, type UserPreferences } from '@pepbits/erp-config';
import { useReferenceHost } from '@pepbits/reference-host';
import type { ColumnType, OutputFormat } from '../types';
import { validTimeZone, zoneParts } from '../lib/dates';

type PageSize = UserPreferences['pageSize'];

function rule(host: ReturnType<typeof useReferenceHost>, key: PreferenceKey) {
  return host.preferenceHost?.preferencePolicy?.rules?.[key];
}

/** Page size controller: starts from the effective preference, follows preference/policy changes, obeys locks. */
export function useManagedPageSize() {
  const host = useReferenceHost();
  const preferred = host.preferences.pageSize;
  const r = rule(host, 'pageSize');
  const locked = !!r?.locked;
  const allowed = r?.allowedValues as PageSize[] | undefined;
  const [size, setSize] = useState<PageSize>(preferred);
  // A preference or policy change replaces the local choice.
  useEffect(() => { setSize(preferred); }, [preferred, locked, allowed?.join(',')]);
  const setPageSize = useCallback((n: PageSize) => {
    if (locked) return;
    if (allowed && !allowed.includes(n)) return;
    setSize(n);
  }, [locked, allowed]);
  return { pageSize: locked ? preferred : size, setPageSize, locked };
}

export const ALL_FORMATS: OutputFormat[] = ['xlsx', 'csv', 'json'];

/**
 * Export formats offered by the host preference: the preferred format first; when a tenant policy locks the
 * export format (or restricts its allowed values) only those formats are offered. The server still decides
 * which formats the role may use; this only narrows presentation.
 */
export function useExportPreference() {
  const host = useReferenceHost();
  const preferred = host.preferences.exportFormat;
  const r = rule(host, 'exportFormat');
  return useMemo(() => {
    const permitted = r?.locked ? [r.value as ExportFormat] : (r?.allowedValues as ExportFormat[] | undefined);
    const filter = (formats: OutputFormat[]) => formats
      .filter((f) => !permitted || (permitted as string[]).includes(f))
      .sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : ALL_FORMATS.indexOf(a) - ALL_FORMATS.indexOf(b)));
    return { preferred, filter, managed: !!permitted };
  }, [preferred, r?.locked, r?.value, r?.allowedValues]);
}

/** Binds a module keyboard shortcut only while the keyboardShortcuts preference is on; detaches otherwise. */
export function useModuleShortcut(match: (e: KeyboardEvent) => boolean, handler: () => void) {
  const { preferences } = useReferenceHost();
  const ref = useRef({ match, handler });
  ref.current = { match, handler };
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !ref.current.match(e)) return;
      e.preventDefault();
      ref.current.handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preferences.keyboardShortcuts]);
}

export interface ReportFormat {
  value: (v: unknown, type: ColumnType, compact?: boolean) => string;
  dateTime: (iso: string | undefined | null, timeZone?: string) => string;
  bytes: (n?: number) => string;
  count: (n: number) => string;
  isNumeric: (t: ColumnType) => boolean;
}

/** Display formatting from the host's effective preferences (erp-config createFormatters). */
export function useReportFormat(): ReportFormat {
  const { preferences } = useReferenceHost();
  return useMemo(() => {
    const f = createFormatters(preferences);
    const integer = new Intl.NumberFormat(preferences.numberLocale, { maximumFractionDigits: 0 });
    const isNumeric = (t: ColumnType) => t === 'integer' || t === 'number' || t === 'currency' || t === 'percent';
    const value = (v: unknown, type: ColumnType, compact = false): string => {
      if (v === null || v === undefined || v === '') return '–';
      if (typeof v === 'string' && (type === 'string' || type === 'date' || Number.isNaN(Number(v)))) return type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? f.date(v) : v;
      const n = Number(v);
      switch (type) {
        case 'currency': return compact ? f.compact(n) : f.money(n);
        case 'percent': return f.percent(Math.round(n * 10) / 10);
        case 'integer': return compact ? f.compact(n) : integer.format(n);
        case 'number': return compact ? f.compact(n) : f.number(n);
        default: return String(v);
      }
    };
    /** An instant shown as wall-clock time in the reporting zone (the source's "Times shown in <zone>"), formatted by preference. */
    const dateTime = (iso: string | undefined | null, timeZone?: string) => {
      if (!iso) return '–';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const zone = timeZone && validTimeZone(timeZone) ? timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
      const p = zoneParts(d, zone);
      return f.dateTime(`${p.date}T${p.time.slice(0, 5)}`);
    };
    const bytes = (n?: number) => {
      if (!n && n !== 0) return '–';
      const one = new Intl.NumberFormat(preferences.numberLocale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
      if (n < 1024) return `${integer.format(n)} B`;
      if (n < 1024 * 1024) return `${one.format(n / 1024)} KB`;
      return `${one.format(n / 1024 / 1024)} MB`;
    };
    return { value, dateTime, bytes, count: (n: number) => integer.format(n), isNumeric };
  }, [preferences]);
}
