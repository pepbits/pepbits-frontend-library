import React from 'react';
import {test, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CollectionView} from './collection-view';
import {PresentationProvider} from './presentation';
import {DEFAULT_PREFERENCES} from '@pepbits/preferences';
const rows = [{id: 'item-1', name: 'Fictional item', amount: 25}];
const columns = [{key: 'name', header: 'Name', sortable: true}, {key: 'amount', header: 'Amount', render: (row: typeof rows[number]) => <span>{row.amount} credits</span>}];
test('collection delegates sort, keyboard selection and row actions independently', () => {
  const open = vi.fn(), action = vi.fn(), sort = vi.fn();
  render(<CollectionView rows={rows} columns={columns} rowKey={row => row.id} onRowClick={open} onSort={sort} sort={{key: 'name', dir: 'desc'}} rowActions={() => <button onClick={action}>Review</button>}/>);
  fireEvent.click(screen.getByRole('button', {name: 'Name'})); expect(sort).toHaveBeenCalledWith('name');
  expect(screen.getByRole('columnheader', {name: 'Name'})).toHaveAttribute('aria-sort', 'descending');
  fireEvent.click(screen.getByRole('button', {name: 'Review'})); expect(action).toHaveBeenCalledOnce(); expect(open).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByText('Fictional item').closest('tr')!, {key: 'Enter'}); expect(open).toHaveBeenCalledWith(rows[0]);
});
test('collection obeys shared table presentation and exposes the same values in cards', () => {
  const props = {rows, columns, rowKey: (row: typeof rows[number]) => row.id};
  const {rerender} = render(<PresentationProvider value={{...DEFAULT_PREFERENCES, density: 'compact', wrapCellText: true, zebraStripes: true}}><CollectionView {...props}/></PresentationProvider>);
  expect(screen.getByRole('table')).toHaveAttribute('data-density', 'compact'); expect(screen.getByRole('table')).toHaveAttribute('data-wrap', 'true');
  rerender(<CollectionView {...props} view="cards"/>); expect(screen.queryByRole('table')).toBeNull(); expect(screen.getByText('25 credits')).toBeInTheDocument();
});
test('collection distinguishes a pending request from an empty result', () => {
  const props = {rows: [], columns, rowKey: (row: typeof rows[number]) => row.id, empty: <p>No matching records</p>};
  const {rerender} = render(<CollectionView {...props} loading/>); expect(screen.queryByText('No matching records')).toBeNull();
  rerender(<CollectionView {...props}/>); expect(screen.getByText('No matching records')).toBeInTheDocument();
});
