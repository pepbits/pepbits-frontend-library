"use client";

import {
  Pagination, SearchInput, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow,
} from "@pepbits/ops-ui";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormat, useSchoolExport } from "../lib/format";
import { usePreferenceControl } from "../lib/preferences";
import { cn } from "../lib/utils";
import { Button, Empty, Skeleton } from "./primitives";
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface Column<T> {
  key: string;
  header: ReactNode;
  cell?: (row: T) => ReactNode;
  /** Value used for sorting, searching and CSV export. Defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

/** Page size: the host preference drives full tables, changed only through the host's lock-aware update path. The
    source's small dashboard widgets (fewer than 10 rows) keep their fixed size because their card layout is the design. */
function usePageSize(requested: number | undefined) {
  const control = usePreferenceControl("pageSize");
  const fixed = requested !== undefined && requested < 10;
  return {
    size: fixed ? requested! : control.value,
    fixed,
    editable: !fixed && control.editable,
    set: (size: 10 | 20 | 50 | 100) => { if (!fixed) control.set(size); },
  };
}

export function DataTable<T extends { id: string }>({
  rows, columns, loading, pageSize, onRowClick, toolbar, searchPlaceholder = "Search", exportName, empty, selectedId, className,
}: {
  rows: T[] | null; columns: Column<T>[]; loading?: boolean; pageSize?: number; onRowClick?: (row: T) => void; toolbar?: ReactNode;
  searchPlaceholder?: string; exportName?: string; empty?: ReactNode; selectedId?: string;
  /** Accepted for source compatibility and ignored: the host density preference decides row spacing. */
  dense?: boolean; className?: string;
}) {
 const referenceT = useReferenceLocalization().t;
  const { fmtNum } = useFormat();
  /* String headers are source English and are localized here; element headers render as given. */
  const headerLabel = (h: ReactNode) => (typeof h === "string" ? <ReferenceText message={h} /> : h);
  /* A plain numeric cell uses the host number format; other plain values render as text. */
  const plain = (v: string | number | null | undefined) => (typeof v === "number" ? fmtNum(v) : String(v ?? "—"));

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const size = usePageSize(pageSize);
  const exporter = useSchoolExport();

  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : ((r as Record<string, unknown>)[c.key] as string | number | undefined));

  const filtered = useMemo(() => {
    let out = rows ?? [];
    const needle = q.trim().toLowerCase();
    if (needle) out = out.filter((r) => columns.some((c) => String(val(c, r) ?? "").toLowerCase().includes(needle)));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) out = [...out].sort((a, b) => {
        const x = val(col, a) ?? "", y = val(col, b) ?? "";
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / size.size));
  const current = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [size.size]);
  const visible = filtered.slice((current - 1) * size.size, current * size.size);

  return (
    <div className={cn("flex min-h-0 flex-col rounded-lg border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={searchPlaceholder} aria-label={referenceT("Search table")} className="w-full sm:w-60" />
        {toolbar}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted tabular">{fmtNum(filtered.length)} <ReferenceText message="records" /></span>
          {exportName && (
            <Button size="sm" icon={Download} disabled={exporter.disabled} title={exporter.reason}
              onClick={() => exporter.exportCsv(exportName, [columns.map((c) => (typeof c.header === "string" ? referenceT(c.header) : c.key)), ...filtered.map((r) => columns.map((c) => val(c, r) ?? ""))])}><ReferenceText message="Export" /></Button>
          )}
        </div>
      </div>
      <TableContainer className="min-h-0 flex-1">
        <Table className="w-full border-collapse text-[12.5px]">
          <TableHeader className="bg-subtle">
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  className={cn("border-b border-line px-3 py-2 text-left text-[11px] font-semibold whitespace-nowrap text-muted", c.headerClassName)}>
                  {c.sortable !== false ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-fg" onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>
                      {headerLabel(c.header)}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                  ) : headerLabel(c.header)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !rows
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>{columns.map((c) => <TableCell key={c.key} className="border-b border-line/60 px-3 py-2.5"><Skeleton className="h-3 w-3/4" /></TableCell>)}</TableRow>
                ))
              : visible.map((r) => (
                  <TableRow
                    key={r.id}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(r); } : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-selected={selectedId !== undefined ? selectedId === r.id : undefined}
                    className={cn("group border-b border-line/60 transition-colors last:border-0", onRowClick && "cursor-pointer hover:bg-brand/[0.04]", selectedId === r.id && "bg-brand/[0.07]")}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={cn("px-3 py-1.5", c.className)}>{c.cell ? c.cell(r) : plain(val(c, r))}</TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        {!loading && filtered.length === 0 && (empty ?? <Empty title={referenceT("No matching records")} text="Change the filters or clear the search to see more." />)}
      </TableContainer>
      {size.fixed ? pages > 1 && (
        <Pagination page={current} pageSize={size.size} total={filtered.length} onPageChange={setPage} onPageSizeChange={() => {}} pageSizeDisabled />
      ) : filtered.length > 0 && (
        <Pagination page={current} pageSize={size.size} total={filtered.length} onPageChange={setPage} onPageSizeChange={size.set} pageSizeDisabled={!size.editable} />
      )}
    </div>
  );
}
