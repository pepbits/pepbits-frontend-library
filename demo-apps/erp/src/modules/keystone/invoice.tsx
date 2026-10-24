import {useEffect, useRef, useState} from 'react';
import {Button, Checkbox, Segmented} from '@pepbits/ui';
import {Card, PrintDocument, Table, PresentationProvider, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {englishNumberWords} from '@pepbits/i18n';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {useCompanyProfile, type CompanyProfile} from './api';
import {useFetch, listUrl} from './client';
import {ErpWorklist} from './worklist';
import type {PageDefinition} from '@pepbits/page-engines/types';
import type {ErpTarget} from '../../navigation';
import type {ListResponse, PageDef, Row} from './types';
export function invoiceTotals(lines: Record<string, unknown>[]) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  let subtotal = 0, tax = 0;
  for (const line of lines) {const amount = Number(line.amount || 0) * (line.kind === 'Deduction' ? -1 : 1); subtotal += amount; tax += amount * Number(line.tax || 0) / 100;}
  return {subtotal: round(subtotal), tax: round(tax), total: round(subtotal + tax)};
}
function InvoiceDocument({row, customer, company, copy, terms}: {row: Row; customer?: Row; company: CompanyProfile; copy: string; terms: boolean}) {
  const {t} = useLocalization(), format = useFormatters(), {preferences} = usePreferences(), totals = invoiceTotals(row.lines ?? []);
  const cents = Math.round(Math.abs(totals.total) * 100), words = `${totals.total < 0 ? 'Minus ' : ''}${englishNumberWords(Math.floor(cents / 100))} ${preferences.currencyCode}${cents % 100 ? ' and ' + englishNumberWords(cents % 100) + ' Cents' : ''} only`;
  // A physical document deliberately has fixed geometry, independent of screen table settings.
  return <PresentationProvider value={null}><article className="erp-invoice" aria-label={t('Tax invoice')}>
    <header><div className="invoice-brand"><svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#d9ad54"/><path d="M9.5 9h13l-3 14h-7z" fill="#173c35"/><path d="M5 25.5c2.2-1.6 4.4-2.4 7-2.5M27 25.5c-2.2-1.6-4.4-2.4-7-2.5" stroke="#173c35" strokeWidth="2" strokeLinecap="round" fill="none"/></svg><div><strong className="invoice-company">{company.company}</strong><div>{company.address}</div><div>{t('Tax reg.')} {company.taxId}, {company.email}</div></div></div><div className="invoice-end"><h2>{t('Tax invoice')}</h2><div>{t(copy)} {t('copy')}</div></div></header>
    <div className="invoice-parties"><div><b>{t('Bill to')}</b><h3>{row.customer}</h3>{customer ? <><div>{customer.contact}</div><div>{customer.city}, {customer.country}</div><div>{customer.email}</div></> : null}</div>
      <Table aria-label={t('Invoice details')}><tbody>{[['Invoice no.', row.code], ['Invoice date', format.date(row.date)], ['Due date', format.date(row.dueDate)], ['Salesperson', row.salesperson], ['Terms', customer?.paymentTerms ?? company.paymentTerms]].map(([label, value]) => <tr key={label}><th scope="row">{t(label)}</th><td>{value}</td></tr>)}</tbody></Table>
    </div>
    <Table className="invoice-lines" aria-label={t('Items')}><thead><tr>{['#', 'Description', 'Qty', 'Rate', 'Tax', 'Amount'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{(row.lines ?? []).map((line: Record<string, unknown>, index: number) => <tr key={index}><td>{format.number(index + 1)}</td><td>{String(line.item ?? '')}</td><td>{format.number(Number(line.qty))}</td><td>{format.money(Number(line.rate))}</td><td>{format.number(Number(line.tax ?? 0))}%</td><td>{format.money(Number(line.amount))}</td></tr>)}</tbody></Table>
    <div className="invoice-totals"><div><b>{t('Amount in words')} (English)</b><p lang="en">{words}</p><b>{t('Pay to')}</b><p>{company.bank}, {company.account}<br/>{t('IFSC')} {company.ifsc}, {t('SWIFT')} {company.swift}</p></div><Table aria-label={t('Totals')}><tbody>{[['Subtotal', totals.subtotal], ['Tax', totals.tax], ['Total due', totals.total]].map(([label, value]) => <tr key={label}><th scope="row">{t(String(label))}</th><td>{format.money(Number(value))}</td></tr>)}</tbody></Table></div>
    <div className="invoice-spacer"/>{terms ? <div className="invoice-terms"><b>{t('Terms')}</b><p>{company.invoiceTerms}</p></div> : null}
    <footer><span>{t('This is a computer-generated invoice.')}</span><span className="invoice-signature">{t('For')} {company.company}, {t('authorised signatory')}</span></footer>
  </article></PresentationProvider>;
}
export function InvoicePreview({id, onClose}: {id: string; onClose: () => void}) {
  const invoice = useFetch<Row>('/api/entities/sales-invoices/' + encodeURIComponent(id)), company = useCompanyProfile(), {t, direction} = useLocalization(), {preferences} = usePreferences();
  const customers = useFetch<ListResponse>(invoice.data?.customer ? listUrl('customers', {q: String(invoice.data.customer), size: 1000}) : null);
  const [copy, setCopy] = useState('Original'), [terms, setTerms] = useState(true), [zoom, setZoom] = useState(0), [fit, setFit] = useState(1), box = useRef<HTMLDivElement>(null);
  useEffect(() => {const element = box.current;if (!element || typeof ResizeObserver === 'undefined') return;const observer = new ResizeObserver(() => setFit(Math.min(1, Math.max(.3, (element.clientWidth - 40) / 794))));observer.observe(element);return () => observer.disconnect();}, [invoice.data]);
  const error = invoice.error ?? company.error ?? customers.error, ready = !!invoice.data && !!company.data && (!invoice.data.customer || !!customers.data), scale = Math.min(2, Math.max(.3, fit + zoom));
  const content = ready ? <InvoiceDocument row={invoice.data!} customer={customers.data?.rows.find(row => row.name === invoice.data!.customer)} company={company.data!} copy={copy} terms={terms}/> : null;
  return <div data-invoice-preview aria-busy={!ready && !error} className="space-y-3"><Card className="flex flex-wrap items-center gap-2 p-3"><Button onClick={onClose}>{t('Back')}</Button><Segmented label="Copy" value={copy} onChange={setCopy} options={[{value: 'Original', label: 'Original'}, {value: 'Duplicate', label: 'Duplicate'}]}/><Checkbox label="Show terms" checked={terms} onChange={event => setTerms(event.target.checked)}/><Button onClick={() => setZoom(value => Math.max(-.7, value - .1))}>{t('Zoom out')}</Button><Button onClick={() => setZoom(value => Math.min(1, value + .1))}>{t('Zoom in')}</Button><Button disabled={!ready || !!error} onClick={() => {if (ready && !error) window.print();}}>{t('Print or save PDF')}</Button></Card>
    {error ? <RecoveryNotice failure={failureFromError(new Error(error))} onRetry={() => {invoice.reload(); company.retry(); customers.reload();}}/> : !ready ? <LoadingState/> : <div ref={box} className="overflow-auto bg-[var(--surface-2)] p-5"><div style={{width: 794 * scale, minHeight: 1123 * scale, margin: 'auto'}}><div style={{width: 794, transform: `scale(${scale})`, transformOrigin: direction === 'rtl' ? 'top right' : 'top left'}}>{content}</div></div></div>}
    {ready && !error ? <PrintDocument className="erp-invoice-print" style={{fontFamily: 'var(--font-ui)', direction, '--fs-result': preferences.fontSizeResult / 13} as React.CSSProperties}>{content}</PrintDocument> : null}
  </div>;
}
export function InvoicePage({def, page}: {def: PageDef; page: PageDefinition}) {
  const [selected, setSelected] = useState<ErpTarget>();
  return <div className="grid items-start gap-3 xl:grid-cols-[340px_minmax(0,1fr)]"><ErpWorklist def={def} page={page} onOpen={setSelected} onLoaded={data => {if (!selected && data.rows[0]) setSelected({pageId: page.id, recordId: data.rows[0].id});}}/>{selected?.recordId ? <InvoicePreview key={selected.recordId} id={selected.recordId} onClose={() => setSelected(undefined)}/> : null}</div>;
}
