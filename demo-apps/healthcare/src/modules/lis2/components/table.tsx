'use client';
import {CollectionView} from '@pepbits/components/collection-view';
import {Checkbox as SharedCheckbox} from '@pepbits/ui';
import {DiagnosticField} from '../../diagnostics/controls';
import {DiagnosticButton,DiagnosticInput,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '../../diagnostics';
import { Search } from '@pepbits/icons';
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

export function DataTable<T extends {id?:any}>({columns,rows,loading,empty='Nothing to show',onRowClick,rowClass,selected,onSelect,sort,onSort,footer}: {columns:Column<T>[];rows?:T[]|null;loading?:boolean;empty?:React.ReactNode;onRowClick?:(r:T)=>void;rowClass?:(r:T)=>string|undefined;selected?:Set<any>;onSelect?:(s:Set<any>)=>void;sort?:{key:string;dir:'asc'|'desc'};onSort?:(key:string)=>void;footer?:React.ReactNode;dense?:boolean}) {
 const list=rows??[];const cols=[...columns];if(selected)cols.unshift({key:'__select',header:<SharedCheckbox aria-label="Select all" checked={list.length>0&&list.every(r=>selected.has(r.id))} onChange={e=>onSelect?.(new Set(e.target.checked?list.map(r=>r.id):[]))}/>,render:r=><span onClick={e=>e.stopPropagation()}><SharedCheckbox aria-label={'Select '+r.id} checked={selected.has(r.id)} onChange={()=>{const next=new Set(selected);next.has(r.id)?next.delete(r.id):next.add(r.id);onSelect?.(next);}}/></span>});
 return <><CollectionView columns={cols} rows={list} rowKey={r=>String(r.id??list.indexOf(r))} loading={loading} onRowClick={onRowClick} rowClassName={rowClass} sort={sort} onSort={onSort} empty={typeof empty==='string'?<Empty title={empty}/>:empty}/>{footer}</>;
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
export const FilterItem = DiagnosticField;
