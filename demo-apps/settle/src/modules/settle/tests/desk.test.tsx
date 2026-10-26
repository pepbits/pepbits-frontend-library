import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {renderSettle} from '../../../test/host';
import {mockSettle} from '../../../test/mock-settle';

describe('Desk, desk user and counter', () => {
  it('shows the work queue, the till and links each item to a filtered list', async () => {
    renderSettle('/');
    await screen.findByText('Needs your attention');
    expect(await screen.findByText(/approvals? waiting/)).toBeInTheDocument();
    expect(screen.getByText('Today’s till')).toBeInTheDocument();
    const queue = screen.getByText(/approvals? waiting/).closest('a')!;
    expect(queue).toHaveAttribute('href', '/approvals');
    expect(screen.getByRole('img', {name: 'Collections by hour'})).toBeInTheDocument();
  });

  it('switching the desk user re-reads every screen as that user', async () => {
    const settle = mockSettle();
    renderSettle('/', {settle});
    await screen.findAllByText('Priya Nair');
    fireEvent.click(screen.getByRole('button', {name: /Desk user/}));
    fireEvent.click(screen.getByRole('menuitem', {name: /Suresh Pillai/}));
    await waitFor(() => expect(settle.calls.filter(c => c.path === '/meta').at(-1)?.user).toBe('4'));
    await waitFor(() => expect(settle.calls.filter(c => c.path === '/dashboard').at(-1)?.user).toBe('4'));
    expect(await screen.findByRole('button', {name: /Counter: No counter/})).toBeInTheDocument();
    expect(sessionStorage.getItem('pepbits-settle-desk-user:' + JSON.stringify(['fictional-tenant', 'fixture-admin', 'admin', 'head-office']))).toBe('4');
  });

  it('picks a counter through the API and reports it', async () => {
    const settle = mockSettle();
    renderSettle('/', {settle});
    fireEvent.click(await screen.findByRole('button', {name: /Counter: Main billing/}));
    fireEvent.click(screen.getByRole('menuitem', {name: /OPD counter/}));
    await waitFor(() => expect(settle.calls.find(c => c.path === '/me/counter')?.body).toEqual({counterId: 2}));
  });

  it('creates a bill for a patient, visit and bill type and opens it', async () => {
    const settle = mockSettle();
    const {navigation} = renderSettle('/patients', {settle});
    await screen.findAllByText('Patient accounts');
    fireEvent.click((await screen.findAllByRole('button', {name: 'New bill'}))[0]!);
    const dialog = await screen.findByRole('dialog', {name: 'New bill'});
    const patient = await within(dialog).findAllByRole('button', {name: /MR/});
    fireEvent.click(patient[0]!);
    await within(dialog).findAllByText(/Outpatient|Inpatient/);
    const create = within(dialog).getByRole('button', {name: 'Create bill'});
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', {name: /Bill Later/}));
    fireEvent.click(create);
    await waitFor(() => expect(settle.calls.find(c => c.method === 'POST' && c.path === '/bills')?.body).toMatchObject({billType: 'C', restrictionType: 'N'}));
    await waitFor(() => expect(navigation.open).toHaveBeenCalledWith({pageId: 'settle-bill', recordId: 'BL002001'}));
  });

  it('quick search finds bills from / and opens the chosen one', async () => {
    const user = userEvent.setup();
    const settle = mockSettle();
    const {navigation} = renderSettle('/', {settle});
    await screen.findByText('Needs your attention');
    await user.keyboard('/');
    const dialog = await screen.findByRole('dialog', {name: 'Search'});
    fireEvent.change(within(dialog).getByRole('combobox', {name: 'Search'}), {target: {value: 'BL'}});
    await waitFor(() => expect(settle.calls.some(c => c.path === '/search' && c.search.get('q') === 'BL')).toBe(true));
    const first = (await within(dialog).findAllByRole('option')).find(o => /BL\d+/.test(o.textContent ?? ''))!;
    fireEvent.click(first);
    await waitFor(() => expect(navigation.open).toHaveBeenCalledWith(expect.objectContaining({pageId: 'settle-bill'})));
  });

  it('the bills summary figures double as filters', async () => {
    const {navigation} = renderSettle('/bills');
    fireEvent.click(await screen.findByRole('button', {name: /Overpaid, needs action/}));
    await waitFor(() => expect(navigation.open).toHaveBeenCalledWith({pageId: 'settle-bills', query: 'due=overpaid&sort=updated&page=1'}));
  });
});
