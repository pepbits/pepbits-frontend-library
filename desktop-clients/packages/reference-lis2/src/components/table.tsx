'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Checkbox, Empty, Loading, Pagination, cx } from './ui';
import { useDebounced } from '../lib/hooks';

export interface Column<T = any> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: 'right' | 'center';
  sortable?: boolean;
}

export function DataTable<T extends { id?: any }>({ columns, rows, loading, empty = 'Nothing to show', onRowClick, rowClass, selected, onSelect, sort, onSort, footer, dense }: {
  columns: Column<T>[]; rows?: T[] | null; loading?: boolean; empty?: React.ReactNode; onRowClick?: (r: T) => void; rowClass?: (r: T) => string | undefined;
  selected?: Set<any>; onSelect?: (s: Set<any>) => void; sort?: { key: string; dir: 'asc' | 'desc' }; onSort?: (key: string) => void; footer?: React.ReactNode; dense?: boolean;
}) {
  const list = rows || [];
  const allOn = !!selected && list.length > 0 && list.every((r) => selected.has(r.id));
  const someOn = !!selected && list.some((r) => selected.has(r.id));
  const toggle = (id: any) => { if (!selected || !onSelect) return; const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); onSelect(s); };
  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <DiagnosticTable className="w-full border-collapse text-sm">
          <TableHeader>
            <TableRow>
              {selected && <TableHead className="th w-8"><Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={(v) => onSelect!(new Set(v ? list.map((r) => r.id) : []))} /></TableHead>}
              {columns.map((c) => (
                <TableHead key={c.key} className={cx('th', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                  {c.sortable && onSort ? (
                    <DiagnosticButton className="inline-flex items-center gap-1 hover:text-ink" onClick={() => onSort(c.key)}>
                      {c.header}{sort?.key === c.key && <span aria-hidden>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </DiagnosticButton>
                  ) : c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={cx(loading && list.length > 0 && 'opacity-60')}>
            {list.map((r, i) => (
              <TableRow key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cx(onRowClick && 'cursor-pointer', 'hover:bg-hema-50/40', selected?.has(r.id) && 'bg-hema-50/60', rowClass?.(r))}>
                {selected && <TableCell className={cx('td', dense && 'py-1.5')}><Checkbox checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></TableCell>}
                {columns.map((c) => (
                  <TableCell key={c.key} className={cx('td', dense && 'py-1.5', c.align === 'right' && 'text-right tnum', c.align === 'center' && 'text-center', c.className)}>
                    {c.render ? c.render(r) : (r as any)[c.key] ?? ''}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </DiagnosticTable>
      </div>
      {loading && !list.length && <Loading />}
      {!loading && !list.length && (typeof empty === 'string' ? <Empty title={empty} /> : empty)}
      {footer}
    </div>
  );
}

/** Table + pagination wired to a Paged response. */
export function PagedTable<T extends { id?: any }>({ result, loading, page, pageSize, onPage, onPageSize, ...rest }: Omit<Parameters<typeof DataTable<T>>[0], 'rows' | 'footer'> & {
  result: { data: T[]; total: number } | null; page: number; pageSize: number; onPage: (p: number) => void; onPageSize?: (n: number) => void;
}) {
  return (
    <DataTable<T> {...rest} loading={loading} rows={result?.data}
      footer={result && result.total > 0 ? <div className="border-t border-line"><Pagination page={page} pageSize={pageSize} total={result.total} onPage={onPage} onPageSize={onPageSize} /></div> : null} />
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  const [v, setV] = useState(value);
  const d = useDebounced(v, 300);
  useEffect(() => { if (d !== value) onChange(d); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setV(value); }, [value]);
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <DiagnosticInput className="input pl-8" value={v} autoFocus={autoFocus} placeholder={placeholder} onChange={(e) => setV(e.target.value)} aria-label={placeholder} />
    </div>
  );
}

/** Horizontal filter strip above tables. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-end gap-2 border-b border-line px-3 py-2.5 [&_.input]:h-8 [&_.input]:py-1', className)}>{children}</div>;
}
export function FilterItem({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={cx('flex flex-col', className)}><span className="mb-0.5 text-2xs text-ink-faint">{label}</span>{children}</label>;
}
