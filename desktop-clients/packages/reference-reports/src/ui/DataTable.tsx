"use client";
/*
 * Port of lumen-reports src/components/ui/DataTable.tsx on the shared ops-ui Table. Density, zebra stripes,
 * wrapping and sticky headers come from the host PresentationProvider; values use the preference formatter.
 */
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import React from 'react';
import { Pagination as OpsPagination, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableHeader, TableRow, useLocalization } from '@pepbits/ops-ui';
import type { UserPreferences } from '@pepbits/erp-config';
import type { ResultColumn, Row, SortSpec } from '../types';
import { useReportFormat } from './preferences';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


export function DataTable({ columns, rows, totals, sort, onSort, loading, emptyText = 'No rows match these filters.', maxHeight, caption }: {
  columns: ResultColumn[];
  rows: Row[];
  totals?: Row | null;
  sort?: SortSpec;
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyText?: string;
  maxHeight?: 'short' | 'medium' | 'tall';
  caption?: string;
}) {
  const fmt = useReportFormat();
  const { t } = useLocalization();
  return (
    <TableContainer className={`lr-table-scroll${maxHeight ? ` lr-table-scroll-${maxHeight}` : ''}`}>
      <Table className="lr-table">
        {caption && <caption className="lr-sr-only">{t(caption)}</caption>}
        <TableHeader>
          <TableRow>
            {columns.map((c) => {
              const numeric = fmt.isNumeric(c.type);
              const active = sort?.key === c.key;
              return (
                <TableHead key={c.key} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={numeric ? 'lr-num lr-end' : undefined}>
                  {onSort ? (
                    <button type="button" onClick={() => onSort(c.key)} className={`lr-sort${numeric ? ' lr-sort-numeric' : ''}`}>
                      {c.masked && <Lock className="lr-icon-xs lr-warn-ink" aria-label={t('masked')} />}
                      <ReferenceText message={c.label} />
                      {active ? sort!.dir === 'asc' ? <ArrowUp className="lr-icon-xs" aria-hidden /> : <ArrowDown className="lr-icon-xs" aria-hidden /> : <span className="lr-icon-xs" aria-hidden />}
                    </button>
                  ) : (
                    <span className="lr-inline">{c.masked && <Lock className="lr-icon-xs lr-warn-ink" aria-label={t('masked')} />}<ReferenceText message={c.label} /></span>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody className={loading ? 'lr-loading' : undefined} aria-busy={loading || undefined}>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={Math.max(1, columns.length)} className="lr-table-empty">{t(loading ? 'Loading…' : emptyText)}</TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key} className={`${fmt.isNumeric(c.type) ? 'lr-num lr-end' : ''}${c.masked ? ' lr-masked' : ''}`}>{fmt.value(r[c.key], c.type)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {totals && rows.length > 0 && (
          <TableFooter className="lr-table-totals">
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} className={fmt.isNumeric(c.type) ? 'lr-num lr-end' : undefined}>
                  {totals[c.key] === undefined || totals[c.key] === null ? '' : totals[c.key] === 'Total' ? t('Total') : fmt.value(totals[c.key], c.type)}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </TableContainer>
  );
}

/** Shared pagination with the managed page-size controller (disabled when the tenant locks page size). */
export function Pagination({ page, pageSize, total, onPage, onPageSize, pageSizeLocked }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize?: (n: UserPreferences['pageSize']) => void; pageSizeLocked?: boolean }) {
  return <OpsPagination page={page} pageSize={pageSize} total={total} onPageChange={onPage} onPageSizeChange={(n) => onPageSize?.(n)} pageSizeDisabled={!onPageSize || pageSizeLocked} />;
}
