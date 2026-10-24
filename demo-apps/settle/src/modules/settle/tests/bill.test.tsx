import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {renderSettle} from '../../../test/host';
import {mockSettle, settleFixtures} from '../../../test/mock-settle';

const loaded = async (text: string) => {await screen.findAllByText(text); await waitFor(() => expect(document.querySelector('[data-skeleton]')).toBeNull());};

describe('Bill workspace', () => {
  it('explains why finalize is blocked on BL002001 and keeps the server reason visible', async () => {
    renderSettle('/bills/BL002001');
    await loaded('BL002001');
    const finalize = screen.getByRole('button', {name: /Finalize/});
    expect(finalize).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent('1 test has pending results');
    expect(screen.getByText('Overpaid — refund or move to deposit')).toBeInTheDocument();
  });

  it('marks a pending result ready from the charge drawer', async () => {
    const settle = mockSettle();
    renderSettle('/bills/BL002001', {settle});
    await loaded('BL002001');
    fireEvent.click(screen.getByRole('button', {name: 'Edit Blood culture & sensitivity'}));
    const drawer = await screen.findByRole('dialog', {name: 'Blood culture & sensitivity'});
    fireEvent.click(within(drawer).getByRole('button', {name: 'Mark result ready'}));
    await waitFor(() => expect(settle.calls.some(c => c.method === 'POST' && c.path === '/charges/8/result-ready')).toBe(true));
  });

  it('adds a charge with the A shortcut, keyboard selection and Enter (BN001002)', async () => {
    const settle = mockSettle();
    renderSettle('/bills/BN001002', {settle});
    await loaded('BN001002');
    fireEvent.keyDown(window, {key: 'a'});
    const box = screen.getByRole('combobox', {name: 'Add a charge'});
    await waitFor(() => expect(box).toHaveFocus());
    fireEvent.change(box, {target: {value: 'echo'}});
    await screen.findByRole('option', {name: /2D echocardiogram/});
    fireEvent.keyDown(box, {key: 'Enter'});
    await waitFor(() => expect(settle.calls.find(c => c.method === 'POST' && c.path === '/bills/BN001002/charges')?.body).toEqual({items: [{catalogueId: 20, qty: 1}]}));
  });

  it('collects the due and closes a Bill Now bill in one action', async () => {
    const settle = mockSettle();
    const open = settleFixtures['/bills/BN001002'];
    // After the payment the server reports the bill closed; the print link must stay available.
    settle.override('GET /bills/BN001002', () => settle.calls.some(c => c.path === '/bills/BN001002/payments')
      ? {...structuredClone(open), bill: {...open.bill, status: 'C', patient_due: 0, total_receipts: open.bill.patient_amount}, actions: {...open.actions, takePayment: {allowed: false, reasons: ['Bill is closed']}}}
      : structuredClone(open));
    renderSettle('/bills/BN001002', {settle});
    await loaded('BN001002');
    const collect = await screen.findByRole('button', {name: /and close bill/});
    fireEvent.click(collect);
    await waitFor(() => expect(settle.calls.find(c => c.path === '/bills/BN001002/payments')?.body).toMatchObject({finalize: true, close: true, rows: [{kind: 'settlement', amount: 4700, modeId: 1}]}));
    expect(await screen.findByText('This bill is closed and fully settled.')).toBeInTheDocument();
    expect(await screen.findByText('Receipt RC-FIXTURE-1 recorded')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Print receipt'})).toHaveAttribute('href', '/print/receipt/RC-FIXTURE-1');
  });

  it('waits for the card terminal before any receipt exists', async () => {
    const settle = mockSettle();
    settle.override('POST /bills/BN001002/payments', () => settle.json({cardTxn: {id: 'CT-1', amount: 4700, terminal: 'T-01'}}, 202));
    settle.override('POST /card-txns/CT-1/approve', () => ({status: 'approved', meta: {auth: 'A1', rrn: 'R1', last4: '4242'}, result: {receipts: ['RC-CARD-1']}, bill: structuredClone(settleFixtures['/bills/BN001002'])}));
    renderSettle('/bills/BN001002', {settle});
    await loaded('BN001002');
    const rail = screen.getByRole('radiogroup', {name: 'Payment mode'});
    fireEvent.click(within(rail).getByRole('radio', {name: /Credit/}));
    fireEvent.click(screen.getByRole('button', {name: /^Collect .* and close bill$/}));
    const terminal = await screen.findByRole('dialog', {name: 'Card terminal T-01'});
    fireEvent.click(within(terminal).getByRole('button', {name: 'Simulate approval'}));
    await waitFor(() => expect(settle.calls.some(c => c.path === '/card-txns/CT-1/approve')).toBe(true), {timeout: 5000});
    expect(screen.queryByText(/Receipt .* recorded/)).toBeNull();
    // The approval result (not the earlier 202) supplies the receipt; the dialog then closes itself.
    expect(await screen.findByText('Receipt RC-CARD-1 recorded', {}, {timeout: 10000})).toBeInTheDocument();
  });

  it('turning shortcuts off removes the listeners but keeps the buttons', async () => {
    renderSettle('/bills/BN001002', {overrides: {keyboardShortcuts: false}});
    await loaded('BN001002');
    fireEvent.keyDown(window, {key: 'a'});
    expect(screen.getByRole('combobox', {name: 'Add a charge'})).not.toHaveFocus();
    expect(screen.getByRole('button', {name: /Finalize/})).toBeEnabled();
    expect(document.querySelector('.settle-app kbd')).toBeNull();
  });

  it('reopen asks for a reason code and note before calling the API', async () => {
    const settle = mockSettle();
    const finalized = structuredClone((await import('../../../test/mock-settle')).settleFixtures['/bills/BN001002']);
    finalized.bill.status = 'F'; finalized.actions.reopen = {allowed: true, reasons: []};
    settle.override('GET /bills/BN001002', () => finalized);
    renderSettle('/bills/BN001002', {settle});
    await loaded('BN001002');
    fireEvent.click(screen.getByRole('button', {name: /More/}));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Reopen bill'}));
    const dialog = await screen.findByRole('dialog', {name: 'Reopen BN001002'});
    const confirm = within(dialog).getByRole('button', {name: 'Reopen bill'});
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Charge missed'}));
    fireEvent.change(within(dialog).getByRole('textbox', {name: 'Note'}), {target: {value: 'Fictional missed ECG'}});
    fireEvent.click(confirm);
    await waitFor(() => expect(settle.calls.find(c => c.path === '/bills/BN001002/reopen')?.body).toEqual({reason: 'Fictional missed ECG', reasonCode: 'Charge missed'}));
  });
});
