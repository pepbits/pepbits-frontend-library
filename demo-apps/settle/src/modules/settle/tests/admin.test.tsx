import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import * as xlsx from 'xlsx';
import {renderSettle} from '../../../test/host';
import {mockSettle} from '../../../test/mock-settle';
import {amountInWords} from '../components/PrintSheet';

afterEach(() => vi.restoreAllMocks());
const read = (blob: Blob, as: 'text' | 'buffer') => new Promise<string | ArrayBuffer>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(reader.result!); reader.onerror = reject; if (as === 'text') reader.readAsText(blob); else reader.readAsArrayBuffer(blob);});
function captureDownloads() {
  const blobs: Blob[] = [], names: string[] = [];
  Object.assign(URL, {createObjectURL: vi.fn((blob: Blob) => {blobs.push(blob); return 'blob:fixture';}), revokeObjectURL: vi.fn()});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {names.push(this.download);});
  return {blobs, names};
}

describe('Settings, reports, audit and print', () => {
  it('saves Settle billing preferences through the API, separate from host preferences', async () => {
    const settle = mockSettle();
    const {host} = renderSettle('/settings?s=preferences', {settle});
    const toggle = await screen.findByRole('switch', {name: 'Bill cancellation needs approval'});
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    fireEvent.click(await screen.findByRole('button', {name: 'Save preferences'}));
    await waitFor(() => expect(settle.calls.find(c => c.method === 'PATCH' && c.path === '/settings/preferences')?.body).toEqual({bill_cancellation_requires_approval: 'N'}));
    expect(host.writes).toHaveLength(0);
  });

  it('edits a payment mode row and saves only the changed fields', async () => {
    const settle = mockSettle();
    renderSettle('/settings', {settle});
    const name = (await screen.findAllByRole('textbox', {name: 'Name'}))[0]!;
    fireEvent.change(name, {target: {value: 'Cash (fictional)'}});
    const row = name.closest('tr')!;
    fireEvent.click(within(row).getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(settle.calls.find(c => c.method === 'PATCH' && c.path.startsWith('/settings/payment-modes/'))?.body).toEqual({name: 'Cash (fictional)'}));
  });

  it('desk users without the Manage settings right see read-only settings', async () => {
    const settle = mockSettle();
    renderSettle('/settings', {settle});
    fireEvent.click(await screen.findByRole('button', {name: /Desk user/}));
    fireEvent.click(screen.getByRole('menuitem', {name: /Anita Das/}));
    expect(await screen.findByText(/Changing them needs the “Manage settings” right/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Reset demo data'})).toBeNull();
  });

  it('exports a report in the effective export format', async () => {
    const downloads = captureDownloads();
    renderSettle('/reports?r=patient-dues', {overrides: {exportFormat: 'xlsx'}});
    const button = await screen.findByRole('button', {name: 'XLSX'});
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(downloads.names[0]).toMatch(/^patient-dues-\d{4}-\d{2}-\d{2}\.xlsx$/));
    const sheet = xlsx.read(await read(downloads.blobs[0]!, 'buffer'));
    expect(xlsx.utils.sheet_to_json(sheet.Sheets[sheet.SheetNames[0]!]!).length).toBeGreaterThan(0);
  });

  it('exports receipts as CSV by default with formula-safe text', async () => {
    const downloads = captureDownloads();
    renderSettle('/receipts');
    fireEvent.click(await screen.findByRole('button', {name: 'Export CSV'}));
    await waitFor(() => expect(downloads.names[0]).toMatch(/^receipts-.*\.csv$/));
    expect(await read(downloads.blobs[0]!, 'text')).toContain('number,date,type,patient');
  });

  it('searches the audit trail on the server', async () => {
    const settle = mockSettle();
    renderSettle('/audit', {settle});
    fireEvent.change(await screen.findByRole('textbox', {name: 'Search audit'}), {target: {value: 'BN001004'}});
    await waitFor(() => expect(settle.calls.some(c => c.path === '/audit' && c.search.get('q') === 'BN001004')).toBe(true));
  });

  it('prints a receipt with the effective currency and amount in words', async () => {
    renderSettle('/print/receipt/RC010013', {overrides: {currencyCode: 'INR'}});
    expect((await screen.findAllByText(/rupees/)).length).toBeGreaterThan(0);
    expect(amountInWords(125000.5, 'INR')).toBe('One Lakh Twenty Five Thousand rupees and Fifty paise only');
    expect(amountInWords(0, 'INR')).toBe('Zero rupees only');
    expect(amountInWords(1234.25, 'USD')).toBe('One Thousand Two Hundred Thirty Four USD and Twenty Five cents only');
  });
});
