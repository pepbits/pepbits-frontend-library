'use client';
import React, {type ReactNode} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {Button, cn} from '@pepbits/ui';
import {Card, CardGrid} from './card';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer} from './table';
import {LoadingState} from './empty-state';

export interface CollectionColumn<T> {
  key: string; header: ReactNode; width?: string; align?: 'left' | 'right' | 'center'; sortable?: boolean;
  render?: (row: T) => ReactNode; className?: string;
}
export interface CollectionViewProps<T> {
  columns: CollectionColumn<T>[]; rows: T[]; rowKey: (row: T) => string; loading?: boolean;
  onRowClick?: (row: T) => void; selectedKey?: string | null;
  sort?: {key: string; dir: 'asc' | 'desc'}; onSort?: (key: string) => void;
  empty?: ReactNode; rowActions?: (row: T) => ReactNode; rowClassName?: (row: T) => string | undefined;
  className?: string; view?: 'table' | 'cards';
}
/** Typed read-only collection slots. Hosts own values, sorting, paging, preferences and commands. */
export function CollectionView<T>({columns, rows, rowKey, loading, onRowClick, selectedKey, sort, onSort, empty, rowActions, rowClassName, className, view = 'table'}: CollectionViewProps<T>) {
  const {t} = useLocalization();
  const heading = (column: CollectionColumn<T>) => typeof column.header === 'string' ? t(column.header) : column.header;
  const cell = (row: T, column: CollectionColumn<T>) => column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? '');
  const interactive = (row: T) => ({tabIndex: onRowClick ? 0 : undefined, onClick: () => onRowClick?.(row),
    onKeyDown: (event: React.KeyboardEvent) => {if (event.key === 'Enter' && event.target === event.currentTarget) onRowClick?.(row);}});
  return <div className={cn('min-w-0', className)} style={{'--fs-scale': 'var(--fs-result)'} as React.CSSProperties} aria-busy={loading || undefined}>
    {loading && <LoadingState/>}
    {view === 'cards' ? <CardGrid columns="auto">{rows.map(row => <Card key={rowKey(row)} className={cn('p-3', rowClassName?.(row))} {...interactive(row)}>
      <dl>{columns.map(column => <div key={column.key}><dt className="text-[var(--text-muted)]">{heading(column)}</dt><dd>{cell(row, column)}</dd></div>)}</dl>
      {rowActions && <div onClick={event => event.stopPropagation()}>{rowActions(row)}</div>}
    </Card>)}</CardGrid> : <TableContainer><Table>
      <TableHeader><TableRow>{columns.map(column => <TableHead key={column.key} scope="col" style={{width: column.width, textAlign: column.align}}
        aria-sort={sort?.key === column.key ? sort.dir === 'asc' ? 'ascending' : 'descending' : undefined}>
        {column.sortable && onSort ? <Button variant="ghost" size="sm" onClick={() => onSort(column.key)}>{heading(column)}</Button> : heading(column)}
      </TableHead>)}{rowActions && <TableHead scope="col">{t('Actions')}</TableHead>}</TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={rowKey(row)} {...interactive(row)} data-selected={selectedKey === rowKey(row) || undefined} className={rowClassName?.(row)}>
        {columns.map(column => <TableCell key={column.key} style={{textAlign: column.align}} className={column.className}>{cell(row, column)}</TableCell>)}
        {rowActions && <TableCell onClick={event => event.stopPropagation()}>{rowActions(row)}</TableCell>}
      </TableRow>)}</TableBody>
    </Table></TableContainer>}
    {!loading && !rows.length && empty}
  </div>;
}
