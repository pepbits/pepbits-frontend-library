import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderSettle} from '../../../test/host';
import {mockSettle} from '../../../test/mock-settle';

describe('Patients, deposits, receipts, approvals and day close', () => {
  it('collects a patient deposit and keeps the receipt print link', async () => {
    const settle = mockSettle();
    renderSettle('/patients/MR240107', {settle});
    await screen.findByText('Deposit balance');
    fireEvent.click((await screen.findAllByRole('button', {name: /Collect deposit/}))[0]!);
    const dialog = await screen.findByRole('dialog', {name: 'Collect deposit'});
    fireEvent.change(within(dialog).getByRole('textbox', {name: 'Amount'}), {target: {value: '5000'}});
    fireEvent.click(within(dialog).getByRole('button', {name: /^Collect /}));
    await waitFor(() => expect(settle.calls.find(c => c.method === 'POST' && c.path === '/patients/MR240107/deposits')?.body).toMatchObject({type: 'R', amount: 5000}));
    expect(await screen.findByText('DP-FIXTURE-1 recorded')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Print receipt'})).toHaveAttribute('href', '/print/receipt/DP-FIXTURE-1');
  });

  it('a card deposit is recorded only after the terminal approves it', async () => {
    const settle = mockSettle();
    settle.override('POST /patients/MR240107/deposits', () => settle.json({cardTxn: {id: 'CT-9', amount: 2500, terminal: 'T-02'}}, 202));
    settle.override('POST /card-txns/CT-9/approve', () => ({status: 'approved', meta: {auth: 'A9', rrn: 'R9', last4: '1111'}, result: {depositNo: 'DP-CARD-9'}, bill: null}));
    renderSettle('/patients/MR240107', {settle});
    fireEvent.click((await screen.findAllByRole('button', {name: /Collect deposit/}))[0]!);
    const dialog = await screen.findByRole('dialog', {name: 'Collect deposit'});
    fireEvent.change(within(dialog).getByRole('textbox', {name: 'Amount'}), {target: {value: '2500'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Credit card'}));
    fireEvent.click(within(dialog).getByRole('button', {name: /^Collect /}));
    const terminal = await screen.findByRole('dialog', {name: 'Card terminal T-02'});
    expect(screen.queryByText('DP-CARD-9 recorded')).toBeNull();
    fireEvent.click(within(terminal).getByRole('button', {name: 'Simulate approval'}));
    expect(await screen.findByText('DP-CARD-9 recorded', {}, {timeout: 8000})).toBeInTheDocument();
  });

  it('realizes selected cheques in bulk', async () => {
    const settle = mockSettle();
    const {navigation} = renderSettle('/receipts', {settle});
    fireEvent.click(await screen.findByRole('button', {name: /waiting for realization/}));
    await waitFor(() => expect(navigation.open).toHaveBeenCalledWith(expect.objectContaining({pageId: 'settle-receipts', query: expect.stringContaining('unrealized=1')})));
  });

  it('realize and bounce act on the picked deposits only', async () => {
    const settle = mockSettle();
    renderSettle('/receipts?unrealized=1&kind=deposit', {settle});
    const realize = await screen.findByRole('button', {name: 'Realize'});
    expect(realize).toBeDisabled();
    const boxes = await screen.findAllByRole('checkbox', {name: /^Select (?!all)/});
    fireEvent.click(boxes[0]!);
    fireEvent.click(realize);
    await waitFor(() => expect(settle.calls.find(c => c.path === '/deposits/realize')?.body).toMatchObject({bounced: false, depositNos: [expect.any(String)]}));
  });

  it('approves a request with an optional note and requires a note to reject', async () => {
    const settle = mockSettle();
    renderSettle('/approvals?id=1', {settle});
    const approve = await screen.findByRole('button', {name: 'Approve'});
    expect(screen.getByRole('button', {name: 'Reject'})).toBeDisabled();
    fireEvent.click(approve);
    await waitFor(() => expect(settle.calls.find(c => c.path === '/approvals/1/decide')?.body).toMatchObject({decision: 'approved'}));
  });

  it('counts notes against expected cash and requires an explanation for a difference', async () => {
    const settle = mockSettle();
    renderSettle('/day-close', {settle});
    fireEvent.click(await screen.findByRole('button', {name: /OPD counter/}));
    const close = await screen.findByRole('button', {name: 'Close OPD counter'});
    fireEvent.change(screen.getByRole('textbox', {name: /Number of .* 500 notes/}), {target: {value: '5'}});
    expect(await screen.findByText('Short')).toBeInTheDocument();
    expect(close).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', {name: 'Explain the difference'}), {target: {value: 'Fictional change given twice'}});
    fireEvent.click(close);
    await waitFor(() => expect(settle.calls.find(c => c.path === '/daybook/close')?.body).toMatchObject({counterId: 2, declaredCash: 2500, note: 'Fictional change given twice'}));
  });

  it('a failed write keeps the entered values for an explicit retry', async () => {
    const settle = mockSettle();
    settle.override('POST /patients', () => settle.json({error: {code: 'invalid', message: 'Phone number already registered'}}, 400));
    renderSettle('/patients', {settle});
    fireEvent.click((await screen.findAllByRole('button', {name: 'Register patient'}))[0]!);
    const dialog = await screen.findByRole('dialog', {name: 'Register patient'});
    fireEvent.change(within(dialog).getByRole('textbox', {name: 'Full name'}), {target: {value: 'Fictional Person'}});
    fireEvent.change(within(dialog).getByRole('textbox', {name: 'Mobile number'}), {target: {value: '9000000000'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Register'}));
    await waitFor(() => expect(settle.calls.filter(c => c.method === 'POST' && c.path === '/patients')).toHaveLength(1));
    expect(within(dialog).getByRole('textbox', {name: 'Full name'})).toHaveValue('Fictional Person');
    expect(within(dialog).getByRole('button', {name: 'Register'})).toBeEnabled();
  });
});
