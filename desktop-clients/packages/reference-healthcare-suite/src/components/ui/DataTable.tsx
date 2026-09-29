'use client';
import {TableContainer} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';
import { Spinner } from './display';
import { Card,CardGrid, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Pagination as OpsPagination } from '@pepbits/ops-ui';
import { useReferenceHost } from '@pepbits/reference-host';

export interface Column<T> {
  key: string; header: ReactNode; width?: string; align?: 'left' | 'right' | 'center'; sortable?: boolean;
  render?: (row: T) => ReactNode; className?: string;
}

interface Props<T> {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; loading?: boolean;
  onRowClick?: (row: T) => void; selectedKey?: string | null;
  sort?: { key: string; dir: 'asc' | 'desc' }; onSort?: (key: string) => void;
  empty?: ReactNode; rowActions?: (row: T) => ReactNode; rowClassName?: (row: T) => string | undefined;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, loading, onRowClick, selectedKey, sort, onSort, empty, rowActions, rowClassName, className }: Props<T>) {
  const {preferences}=useReferenceHost();
  if(preferences.resultView==='cards')return <div className={clsx('min-h-0 flex-1 overflow-auto p-3',className)}>{loading&&<Spinner label="Loading"/>}<CardGrid columns="auto">{rows.map(row=><Card key={rowKey(row)} className={clsx('p-3',rowClassName?.(row))} tabIndex={onRowClick?0:undefined} onClick={()=>onRowClick?.(row)} onKeyDown={event=>{if(event.key==='Enter'&&event.target===event.currentTarget)onRowClick?.(row);}}><dl className="space-y-1.5">{columns.map(c=><div key={c.key}><dt className="text-hc-xs text-hc-ink-mute">{typeof c.header==='string'?<LocalizedText message={c.header}/>:c.header}</dt><dd>{c.render?c.render(row):String((row as any)[c.key]??'')}</dd></div>)}</dl>{rowActions&&<div onClick={event=>event.stopPropagation()} className="mt-2 flex gap-1">{rowActions(row)}</div>}</Card>)}</CardGrid>{!loading&&!rows.length&&empty}</div>;

  return (
    <TableContainer className={clsx('relative min-h-0 flex-1 overflow-auto', className)}>
      <Table className="w-full border-separate border-spacing-0 text-hc-sm">
        <TableHeader className="sticky top-0 z-10">
          <TableRow>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <TableHead
                  key={c.key}
                  scope="col"
                  style={{ width: c.width }}
                  className={clsx('h-8 whitespace-nowrap border-b border-hc-line bg-[#F6F8F7] px-3 text-left text-hc-xs font-medium text-hc-ink-mute', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(c.key)} className={clsx('inline-flex items-center gap-1 hover:text-hc-ink', active && 'text-hc-ink')}>
                      {typeof c.header==='string'?<LocalizedText message={c.header}/>:c.header}
                      {active && (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : c.header}
                </TableHead>
              );
            })}
            {rowActions && <TableHead className="w-px border-b border-hc-line bg-[#F6F8F7] px-2"><span className="sr-only"><LocalizedText message="Actions" /></span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const k = rowKey(r);
            return (
              <TableRow
                key={k}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? e => {if(e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r);} : undefined}
                aria-selected={selectedKey !== undefined ? selectedKey === k : undefined}
                className={clsx(
                  'group',
                  onRowClick && 'cursor-pointer',
                  selectedKey === k ? 'bg-hc-petrol-50' : 'hover:bg-[#F6F8F7]',
                  rowClassName?.(r),
                )}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={clsx('h-9 whitespace-nowrap border-b border-hc-line/70 px-3 align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}
                  >
                    {c.render ? c.render(r) : String((r as any)[c.key] ?? '')}
                  </TableCell>
                ))}
                {rowActions && (
                  <TableCell className="h-9 whitespace-nowrap border-b border-hc-line/70 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">{rowActions(r)}</div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!loading && rows.length === 0 && empty}
      {loading && (
        <div className={clsx('flex justify-center', rows.length ? 'absolute inset-x-0 top-8 bg-hc-surface/40 py-2' : 'py-10')}>
          <Spinner label="Loading" />
        </div>
      )}
    </TableContainer>
  );
}

export function Pagination({page,pageSize,total,onPage,onPageSize = () => {}}:{page:number;pageSize:number;total:number;onPage:(page:number)=>void;onPageSize?:(size:number)=>void}) {
  const host=useReferenceHost();const ph=host.preferenceHost;const rule=ph?.preferencePolicy?.rules.pageSize;
  const editable=!!ph?.onPreferenceChange && ph.preferencesAvailable!==false && !rule?.locked;
  return <OpsPagination page={page} pageSize={pageSize} total={total} onPageChange={onPage} pageSizeDisabled={!editable} onPageSizeChange={size=>{if(editable && (!rule?.allowedValues || rule.allowedValues.includes(size))){ph!.onPreferenceChange!('pageSize',size);onPageSize(size);}}}/>;
}
