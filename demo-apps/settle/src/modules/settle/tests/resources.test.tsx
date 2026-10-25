import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {SettleRuntimeProvider, type SettleRuntime} from '../host';
import {SettleDataProvider, useApi, useMutation} from '../lib/api';
import type {SettleTransport} from '../../../adapters/settle';
import {renderSettle} from '../../../test/host';

function Probe({path}: {path: string}) {
  const {data, loading} = useApi<{value: string}>(path);
  const {run} = useMutation();
  return <><output>{loading ? 'Loading record' : data?.value}</output><input aria-label="Draft"/><button onClick={() => void run('/save', 'POST', {})}>Save fixture</button></>;
}
function Host({scope = 'one', path = '/one', transport}: {scope?: string; path?: string; transport: SettleTransport}) {
  const runtime: SettleRuntime = {scopeKey: scope, deskUserId: 1, setDeskUserId: vi.fn(), transport};
  return <SettleRuntimeProvider value={runtime}><SettleDataProvider><Probe path={path}/></SettleDataProvider></SettleRuntimeProvider>;
}
it('discards obsolete reads and clears record data and editors across desk identities', async () => {
  const reads: {path: string; signal?: AbortSignal; resolve: (value: {data: {value: string}; status: number}) => void}[] = [];
  const transport = vi.fn((path, call) => new Promise(resolve => reads.push({path, signal: call?.signal, resolve}))) as unknown as SettleTransport;
  const view = render(<Host transport={transport}/>);
  await act(async () => reads[0]!.resolve({data: {value: 'First desk record'}, status: 200}));
  expect(screen.getByText('First desk record')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Draft'), {target: {value: 'Unsaved first desk'}});
  view.rerender(<Host path="/two" transport={transport}/>);
  expect(screen.queryByText('First desk record')).toBeNull();
  view.rerender(<Host scope="two" path="/two" transport={transport}/>);
  expect(reads[1]!.signal?.aborted).toBe(true);
  expect(screen.getByLabelText('Draft')).toHaveValue('');
  await act(async () => reads[1]!.resolve({data: {value: 'Obsolete record'}, status: 200}));
  expect(screen.queryByText('Obsolete record')).toBeNull();
  await act(async () => reads[2]!.resolve({data: {value: 'Current desk record'}, status: 200}));
  expect(screen.getByText('Current desk record')).toBeInTheDocument();
});
it('revalidates successful commands without unmounting a current editor', async () => {
  let saved = false;
  const transport: SettleTransport = async <T,>(_path: string, call?: {method?: string}) => {
    if (call?.method === 'POST') saved = true;
    return {data: {value: saved ? 'Refreshed balance' : 'Original balance'} as T, status: 200};
  };
  render(<Host transport={transport}/>);
  await screen.findByText('Original balance');
  const draft = screen.getByLabelText('Draft');
  fireEvent.change(draft, {target: {value: 'Keep this note'}});
  fireEvent.click(screen.getByText('Save fixture'));
  await screen.findByText('Refreshed balance');
  expect(screen.getByLabelText('Draft')).toBe(draft);
  expect(draft).toHaveValue('Keep this note');
});
it.each(['/bills', '/receipts', '/audit'])('%s sends the tenant-locked page size to the API', async path => {
  const {settle} = renderSettle(path, {overrides: {pageSize: 100}, rules: {pageSize: {value: 10, locked: true}}});
  await waitFor(() => expect(settle.calls.filter(c => c.path === path).at(-1)?.search.get('size')).toBe('10'));
});
it('receipt row detail is reachable by keyboard', async () => {
  const {navigation} = renderSettle('/receipts');
  const row = (await screen.findAllByText('RC010013'))[0]!.closest('tr')!;
  expect(row).toHaveAttribute('tabindex', '0');
  fireEvent.keyDown(row, {key: 'Enter'});
  await waitFor(() => expect(navigation.open).toHaveBeenCalledWith(expect.objectContaining({pageId: 'settle-receipts', query: expect.stringContaining('open=RC010013')})));
});
