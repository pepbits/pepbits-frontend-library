import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Button, Checkbox, Segmented} from '@pepbits/ui';
import {Card, PrintDocument, Table, PresentationProvider, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {paginatePrintRows, type PrintPageRange} from '@pepbits/patterns/print-pagination';
import {englishNumberWords} from '@pepbits/i18n';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {useCompanyProfile, type CompanyProfile} from './api';
import {useFetch, listUrl} from './client';
import {useKeystone} from './context';
import {ZoomIn,ZoomOut,Printer} from '@pepbits/icons';
import './workspace-reports.css';
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
interface InvoiceProps {row: Row; customer?: Row; company: CompanyProfile; copy: string; terms: boolean}
function InvoiceSheet({row, customer, company, copy, terms, start = 0, end = row.lines?.length ?? 0, final = true, pageNumber = 1, pageCount = 1, measurement = false}: InvoiceProps & Partial<PrintPageRange> & {pageNumber?: number; pageCount?: number; measurement?: boolean}) {
  const {t} = useLocalization(), format = useFormatters(), {preferences} = usePreferences(), totals = invoiceTotals(row.lines ?? []);
  const cents = Math.round(Math.abs(totals.total) * 100), words = `${totals.total < 0 ? 'Minus ' : ''}${englishNumberWords(Math.floor(cents / 100))} ${preferences.currencyCode}${cents % 100 ? ' and ' + englishNumberWords(cents % 100) + ' Cents' : ''} only`;
  // A physical document deliberately has fixed geometry, independent of screen table settings.
  return <PresentationProvider value={null}><article className="erp-invoice" data-invoice-page={measurement ? undefined : pageNumber} aria-label={t('Tax invoice')}>
    <div data-print-heading><header><div className="invoice-brand"><svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#d9ad54"/><path d="M9.5 9h13l-3 14h-7z" fill="#173c35"/><path d="M5 25.5c2.2-1.6 4.4-2.4 7-2.5M27 25.5c-2.2-1.6-4.4-2.4-7-2.5" stroke="#173c35" strokeWidth="2" strokeLinecap="round" fill="none"/></svg><div><strong className="invoice-company">{company.company}</strong><div>{company.address}</div><div>{t('Tax reg.')} {company.taxId}, {company.email}</div></div></div><div className="invoice-end"><h2>{t('Tax invoice')}</h2><div>{t(copy)} {t('copy')}</div></div></header>
    <div className="invoice-parties"><div><b>{t('Bill to')}</b><h3>{row.customer}</h3>{customer ? <><div>{customer.contact}</div><div>{customer.city}, {customer.country}</div><div>{customer.email}</div></> : null}</div>
      <Table aria-label={t('Invoice details')}><tbody>{[['Invoice no.', row.code], ['Invoice date', format.date(row.date)], ['Due date', format.date(row.dueDate)], ['Salesperson', row.salesperson], ['Terms', customer?.paymentTerms ?? company.paymentTerms]].map(([label, value]) => <tr key={label}><th scope="row">{t(label)}</th><td>{value}</td></tr>)}</tbody></Table>
    </div>
    </div>
    {measurement || start > 0 ? <div className="invoice-carry" data-print-brought>{t('Brought forward')} ({t('Including tax')}) · {format.money(invoiceTotals((row.lines ?? []).slice(0,start)).total)}</div> : null}
    <Table className="invoice-lines" aria-label={t('Items')}><colgroup><col style={{width:"6%"}}/><col style={{width:"34%"}}/>{[0,1,2,3].map(i => <col key={i} style={{width:"15%"}}/>)}</colgroup><thead><tr>{['#', 'Description', 'Qty', 'Rate', 'Tax', 'Amount'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{(row.lines ?? []).slice(start,end).map((line: Record<string, unknown>, index: number) => <tr key={index} data-print-line={start + index}><td>{format.number(start + index + 1)}</td><td>{String(line.item ?? '')}</td><td>{format.number(Number(line.qty))}</td><td>{format.money(Number(line.rate))}</td><td>{format.number(Number(line.tax ?? 0))}%</td><td>{format.money(Number(line.amount) * (line.kind === 'Deduction' ? -1 : 1))}</td></tr>)}</tbody></Table>
    {measurement || !final ? <div className="invoice-carry" data-print-carried>{t('Carried forward')} ({t('Including tax')}) · {format.money(invoiceTotals((row.lines ?? []).slice(0,end)).total)}</div> : null}
    {final || measurement ? <div data-print-final><div className="invoice-totals"><div><b>{t('Amount in words')} (English)</b><p lang="en">{words}</p><b>{t('Pay to')}</b><p>{company.bank}, {company.account}<br/>{t('IFSC')} {company.ifsc}, {t('SWIFT')} {company.swift}</p></div><Table aria-label={t('Totals')}><tbody>{[['Subtotal', totals.subtotal], ['Tax', totals.tax], ['Total due', totals.total]].map(([label, value]) => <tr key={label}><th scope="row">{t(String(label))}</th><td>{format.money(Number(value))}</td></tr>)}</tbody></Table></div>
    {terms ? <div className="invoice-terms"><b>{t('Terms')}</b><p>{company.invoiceTerms}</p></div> : null}
    </div> : null}<div className="invoice-spacer"/>
    <footer data-print-footer><span>{t('This is a computer-generated invoice.')}<br/>{t('Page')} {format.number(pageNumber)} / {format.number(pageCount)}</span><span className="invoice-signature">{t('For')} {company.company}, {t('authorised signatory')}</span></footer>
  </article></PresentationProvider>;
}
function InvoiceDocument(props: InvoiceProps & {onReady: (ready: boolean, count: number) => void}) {
  const {t, direction} = useLocalization(), {preferences} = usePreferences(), measure = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<{key: string; pages: PrintPageRange[]; error?: string}>();
  const key = JSON.stringify([props.row,props.customer,props.company,props.copy,props.terms,preferences]);
  useLayoutEffect(() => {
    let active = true, fontsReady = !document.fonts;
    const calculate = () => {
      const root = measure.current, paper = root?.querySelector<HTMLElement>('.erp-invoice');
      if (!active || !fontsReady || !root || !paper || !paper.offsetHeight) return;
      const zoom = root.getBoundingClientRect().width / 794 || 1;
      const height = (selector: string) => (root.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0) / zoom;
      try {
        // CSS uses the same A4 geometry for measurement, preview and print. Reserve
        // two pixels for subpixel table borders and physical-unit rounding.
        const capacity = 1122 - 96 - height('[data-print-heading]') - height('thead') - height('[data-print-footer]') - 42;
        const pages = paginatePrintRows(Array.from(root.querySelectorAll<HTMLElement>('[data-print-line]'), row => row.getBoundingClientRect().height / zoom), {capacity, broughtForward: height('[data-print-brought]'), carriedForward: height('[data-print-carried]'), finalHeight: height('[data-print-final]')});
        if (active) setPagination(old => old?.key === key && JSON.stringify(old.pages) === JSON.stringify(pages) ? old : {key,pages});
      } catch (error) {if (active) setPagination({key,pages:[],error:(error as Error).message});}
    };
    calculate();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(calculate);
    if (measure.current) observer?.observe(measure.current.querySelector('.erp-invoice')!);
    void document.fonts?.ready.then(() => {fontsReady = true;calculate();});
    return () => {active = false;observer?.disconnect();};
  }, [key]);
  const ready = pagination?.key === key && !pagination.error;
  useEffect(() => {props.onReady(!!ready,pagination?.pages.length ?? 1);return () => props.onReady(false,1);}, [ready,pagination?.pages.length,props.onReady]);
  const pages = pagination?.key === key ? pagination.pages : [];
  const sheets = pages.map((page,index) => <InvoiceSheet {...props} {...page} key={index} pageNumber={index + 1} pageCount={pages.length}/>);
  return <>
    <div ref={measure} className="invoice-measure" style={{visibility:'hidden',height:0,overflow:'hidden'}} aria-hidden="true"><InvoiceSheet {...props} measurement pageNumber={999} pageCount={999}/></div>
    {pagination?.key === key && pagination.error ? <p role="alert">{t(pagination.error)}</p> : !ready ? <LoadingState/> : <div data-invoice-pages className="invoice-pages">{sheets}</div>}
    {ready ? <PrintDocument className="erp-invoice-print" style={{fontFamily:'var(--font-ui)',direction,'--fs-result':preferences.fontSizeResult / 13} as React.CSSProperties}>{sheets}</PrintDocument> : null}
  </>;
}

export function InvoicePreview({id, onClose}: {id: string; onClose: () => void}) {
  const {variant}=useKeystone(),format=useFormatters();
  const invoice = useFetch<Row>('/api/entities/sales-invoices/' + encodeURIComponent(id)), company = useCompanyProfile(), {t, direction} = useLocalization(), {preferences} = usePreferences();
  const customers = useFetch<ListResponse>(invoice.data?.customer ? listUrl('customers', {q: String(invoice.data.customer), size: 1000}) : null);
  const [printReady,setPrintReady] = useState(false), [pageCount,setPageCount] = useState(1), [copy, setCopy] = useState('Original'), [terms, setTerms] = useState(true), [zoom, setZoom] = useState(0), [fit, setFit] = useState(1), box = useRef<HTMLDivElement>(null);
  useEffect(() => {const element = box.current;if (!element || typeof ResizeObserver === 'undefined') return;const observer = new ResizeObserver(() => setFit(Math.min(1, Math.max(.3, (element.clientWidth - 40) / 794))));observer.observe(element);return () => observer.disconnect();}, [invoice.data]);
  const error = invoice.error ?? company.error ?? customers.error, ready = !!invoice.data && !!company.data && (!invoice.data.customer || !!customers.data), scale = Math.min(2, Math.max(.3, fit + zoom));
  const onReady = useCallback((ready:boolean,count:number) => {setPrintReady(ready);setPageCount(count);},[]);
  const content = ready ? <InvoiceDocument row={invoice.data!} customer={customers.data?.rows.find(row => row.name === invoice.data!.customer)} company={company.data!} copy={copy} terms={terms} onReady={onReady}/> : null;
  return <div data-invoice-preview aria-busy={!ready && !error} className="erp-print-preview"><Card shadow="none" data-print-toolbar className="flex flex-wrap items-center gap-2 px-3 py-2">{variant==='erp2'&&<Button onClick={onClose}>{t('Back')}</Button>}<Segmented label="Copy" value={copy} onChange={setCopy} options={[{value: 'Original', label: 'Original'}, {value: 'Duplicate', label: 'Duplicate'}]}/><Checkbox label="Show terms" checked={terms} onChange={event => setTerms(event.target.checked)}/><span className="flex-1"/><Button aria-label={t('Zoom out')} onClick={() => setZoom(value => Math.max(-.7, value - .1))}><ZoomOut size={16}/></Button><span data-print-zoom className="w-10 text-center tabular-nums">{format.number(Math.round(scale*100))}%</span><Button aria-label={t('Zoom in')} onClick={() => setZoom(value => Math.min(1, value + .1))}><ZoomIn size={16}/></Button><Button variant="primary" disabled={!ready || !!error || !printReady} onClick={() => {if (ready && !error && printReady) window.print();}}><Printer size={14}/>{t('Print or save PDF')}</Button></Card>
    {error ? <RecoveryNotice failure={failureFromError(new Error(error))} onRetry={() => {invoice.reload(); company.retry(); customers.reload();}}/> : !ready ? <LoadingState/> : <div ref={box} className="overflow-auto bg-[var(--surface-2)] p-5"><div style={{width: 794 * scale, height: (pageCount * 1122 + (pageCount - 1) * 24) * scale, margin: 'auto'}}><div style={{width: 794, transform: `scale(${scale})`, transformOrigin: direction === 'rtl' ? 'top right' : 'top left'}}>{content}</div></div></div>}
  </div>;
}
export function InvoicePage({def, page}: {def: PageDef; page: PageDefinition}) {
  const [selected, setSelected] = useState<ErpTarget>();
  return <div data-invoice-selector className="grid items-start gap-3 lg:grid-cols-[340px_minmax(0,1fr)]"><ErpWorklist def={def} page={page} onOpen={setSelected} onLoaded={data => {if (!selected && data.rows[0]) setSelected({pageId: page.id, recordId: data.rows[0].id});}}/>{selected?.recordId ? <InvoicePreview key={selected.recordId} id={selected.recordId} onClose={() => setSelected(undefined)}/> : null}</div>;
}
