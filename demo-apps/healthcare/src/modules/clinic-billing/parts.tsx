"use client";
import React, { useState } from "react";
import {Card, CardHeader, CardTitle, CardContent, TableContainer, Table, TableHeader, TableHead, TableRow, TableBody, TableCell, Pagination, EmptyState} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {UserPreferences} from '@pepbits/preferences';
export function ClinicPanel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle title={title} action={action} />
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
/** Shared controlled ledger table; host preferences own page size and presentation. */
export function ClinicLedgerTable({
  headers,
  rows,
  preferences,
  paginate = true,
}: {
  paginate?: boolean;
  headers: string[];
  rows: Array<{ id: string; cells: React.ReactNode[] }>;
  preferences: UserPreferences;
}) {
  const { t } = useLocalization(),
    [requested, setPage] = useState(1),
    size = preferences.pageSize,
    page = Math.min(requested, Math.max(1, Math.ceil(rows.length / size)));
  if (!rows.length) return <EmptyState />;
  return (
    <div style={{ "--fs-scale": "var(--fs-result)" } as React.CSSProperties}>
      <TableContainer>
        <Table className="min-w-[680px] w-full">
          <TableHeader>
            <TableRow>
              {headers.map((h) => (
                <TableHead key={h} className="p-3 text-start">
                  {t(h)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(paginate ? rows.slice((page - 1) * size, page * size) : rows).map(
              (row) => (
                <TableRow key={row.id}>
                  {row.cells.map((cell, i) => (
                    <TableCell key={headers[i]} className="p-3 align-top">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {paginate ? (
        <Pagination
          total={rows.length}
          page={page}
          pageSize={size}
          onPageChange={setPage}
          onPageSizeChange={() => {}}
          pageSizeDisabled
        />
      ) : null}
    </div>
  );
}
