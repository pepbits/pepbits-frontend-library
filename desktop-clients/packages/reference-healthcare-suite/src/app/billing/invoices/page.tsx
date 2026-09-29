'use client';
import {useCsvExport} from '../../../lib/export';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import { Ban, Download, FileText, Printer, Wallet } from 'lucide-react';
import { useReferenceSearchParams } from '@pepbits/reference-host';
import { Suspense, useEffect, useState, useRef } from 'react';
import { PaymentRow, PaymentRows } from '../../../components/billing/BillingWorkbench';
import { InvoiceView } from '../../../components/billing/InvoiceView';

import { Button, Field, FilterChips, Input, SearchInput, Segmented , DateInput} from '../../../components/ui/controls';
import { Column, DataTable, Pagination } from '../../../components/ui/DataTable';
import { Badge, EmptyState, ErrorBanner, Money, Spinner, StatusBadge } from '../../../components/ui/display';
import { Modal } from '../../../components/ui/overlay';
import { useToast } from '../../../components/ui/Toast';
import { useApiClient, ApiError, errorMessage, qs } from '../../../lib/api';
import { useFormat } from '../../../lib/format';
import { useApi, useDebounced } from '../../../lib/hooks';
import { usePageHeader, useSession } from '../../../lib/session';
import { Page, Row } from '../../../lib/types';

function Invoices() {
 const exporter=useCsvExport();
 const {downloadCsv}=exporter;
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const {preferences} = useReferenceHost();
  const api = useApiClient();
  const { fmtDateTime, money } = useFormat();
  usePageHeader(healthcareT("Invoices"), healthcareT("Hospital and pharmacy bills, collections and payer claims"));
  const sp = useReferenceSearchParams();
  const toast = useToast();
  const { currency } = useSession();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | 'Hospital' | 'Pharmacy'>('All');
  const [status, setStatus] = useState('All');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(search, 250);
  useEffect(() => setPage(1), [dq, category, status, date]);
  const params = { search: dq, category, status, date, page, pageSize: preferences.pageSize };
  const list = useApi<Page>(`/billing/invoices${qs(params)}`);
  const [openId, setOpenId] = useState<string | null>(sp.get('open'));
  const detail = useApi<Row>(openId ? `/billing/invoices/${openId}` : null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [pay, setPay] = useState<PaymentRow[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const inv = detail.data;
  const paymentIntent=useRef<{signature:string;key:string}|null>(null);

  const collect = async () => {
    if (!inv || !pay[0]) return;
    const signature=JSON.stringify([inv.id,pay]);
    if(paymentIntent.current?.signature!==signature)paymentIntent.current={signature,key:crypto.randomUUID()};
    const intent=paymentIntent.current;
    setBusy(true); setErrors({});
    try {
      // The API records one payment per call; post each split in turn.
      for (const [index,p] of pay.filter(x=>Number(x.amount)>0).entries()) await api(`/billing/invoices/${inv.id}/payments`, {method:'POST',body:{...p,amount:Number(p.amount)},operationId:`${intent.key}:${index}`});
      paymentIntent.current=null;
      toast({ tone: 'ok', title: healthcareT("Payment recorded") }); setCollectOpen(false); detail.reload(); list.reload();
    } catch (e) {
      if (e instanceof ApiError && e.fields.amount) setErrors({ payments: e.fields.amount }); else setErrors({ payments: errorMessage(e) });
      detail.reload();
    } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!inv) return;
    setBusy(true); setErrors({});
    try {
      await api(`/billing/invoices/${inv.id}/cancel`, { method: 'POST', body: { reason } });
      toast({ tone: 'info', title: healthcareT("{v0} cancelled",{v0:inv.invoiceNo}), body: healthcareT("Lines are back in the billing queue and stock was returned.") });
      setCancelOpen(false); setReason(''); detail.reload(); list.reload();
    } catch (e) { setErrors(e instanceof ApiError ? e.fields : { reason: errorMessage(e) }); }
    finally { setBusy(false); }
  };

  const exportCsv = async () => {
    if(exporter.disabled)return;
    const all = await api<Page>(`/billing/invoices${qs({ ...params, page: 1, pageSize: 1000 })}`);
    downloadCsv('invoices.csv', ['Invoice', 'Date', 'Category', 'Patient', 'MRN', 'Payer', 'Net', 'Patient share', 'Payer share', 'Paid', 'Balance', 'Status', 'Claim'],
      all.data.map((i) => [i.invoiceNo, i.createdAt, i.category, i.patientName, i.mrn, i.payerName, i.net, i.patientShare, i.payerShare, i.paid, i.balance, i.status, i.claimStatus]));
  };

  const columns: Column<Row>[] = [
    { key: 'invoiceNo', header: 'Invoice', width: '110px', render: (i) => <span className="font-mono text-hc-xs">{i.invoiceNo}</span> },
    { key: 'createdAt', header: 'Date', render: (i) => <span className="hc-num whitespace-nowrap text-hc-xs">{fmtDateTime(i.createdAt)}</span> },
    { key: 'category', header: 'Bill', render: (i) => <Badge tone={i.category === 'Pharmacy' ? 'selfpay' : 'petrol'}>{i.category}</Badge> },
    { key: 'patientName', header: 'Patient', render: (i) => <span><span className="font-medium">{i.patientName}</span> <span className="font-mono text-hc-2xs text-hc-ink-mute">{i.mrn}</span></span> },
    { key: 'payerName', header: 'Payer', render: (i) => <span className="text-hc-xs">{i.payerName}</span> },
    { key: 'net', header: 'Net', align: 'right', render: (i) => <Money value={i.net} /> },
    { key: 'patientShare', header: 'Patient', align: 'right', render: (i) => <Money value={i.patientShare} /> },
    { key: 'balance', header: 'Balance', align: 'right', render: (i) => <Money value={i.balance} className={i.balance > 0 && i.status !== 'Cancelled' ? 'font-semibold text-hc-danger-700' : 'text-hc-ink-mute'} /> },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
    { key: 'claimStatus', header: 'Claim', render: (i) => i.paymentClass === 'Insurance' && i.status !== 'Cancelled' ? <StatusBadge status={i.claimStatus} /> : null },
  ];

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="hc-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Invoice, patient, MRN, payer" className="w-52" />
          <Segmented size="sm" value={category} onChange={setCategory} options={[{ value: 'All', label: 'All' }, { value: 'Hospital', label: 'Hospital' }, { value: 'Pharmacy', label: 'Pharmacy' }]} />
          <FilterChips value={status} onChange={setStatus} options={['All', 'Unpaid', 'Partially paid', 'Paid', 'Cancelled'].map((s) => ({ value: s, label: s === 'All' ? 'Any' : s === 'Partially paid' ? 'Part paid' : s }))} />
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className="!h-7 w-[140px] text-hc-xs" aria-label="Date" />
          <Button size="sm" className="ml-auto" icon={<Download className="h-3.5 w-3.5" />} disabled={exporter.disabled} title={exporter.reason} onClick={exportCsv}><LocalizedText message="Export" /></Button>
        </div>
        {list.error && <div className="p-3"><ErrorBanner message={list.error.message} onRetry={list.reload} /></div>}
        <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(i) => i.id} loading={list.loading} selectedKey={openId} onRowClick={(i) => setOpenId(i.id)}
          empty={<EmptyState icon={<FileText className="h-8 w-8" />} title="No invoices" body="Invoices are created from hospital and pharmacy billing." />} />
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </div>
      <aside className="hc-panel flex w-[500px] shrink-0 flex-col overflow-hidden">
        {!openId ? <EmptyState icon={<FileText className="h-8 w-8" />} title="Select an invoice" body="Preview, print, collect a balance or cancel." /> : !inv ? <div className="flex flex-1 items-center justify-center"><Spinner /></div> : (
          <>
            <div className="flex items-center justify-end gap-1.5 border-b border-hc-line px-3 py-2">
              {inv.status !== 'Cancelled' && inv.balance > 0 && <Button mutation size="sm" variant="primary" icon={<Wallet className="h-3.5 w-3.5" />} onClick={() => { setPay([{ mode: 'Cash', amount: String(inv.balance), reference: '' }]); setErrors({}); setCollectOpen(true); }}><LocalizedText message="Collect" /> {money(inv.balance)}</Button>}
              <Button size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}><LocalizedText message="Print" /></Button>
              {inv.status !== 'Cancelled' && <Button size="sm" variant="ghost" className="hover:text-hc-danger-700" icon={<Ban className="h-3.5 w-3.5" />} mutation onClick={() => { setErrors({}); setCancelOpen(true); }}><LocalizedText message="Cancel" /></Button>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4"><InvoiceView inv={inv} currency={currency} /></div>
          </>
        )}
      </aside>
      <Modal open={collectOpen} onClose={() => setCollectOpen(false)} title={t("Collect on {v0}",{v0:inv?.invoiceNo})} width="max-w-md"
        footer={<><Button variant="ghost" onClick={() => setCollectOpen(false)}><LocalizedText message="Cancel" /></Button><Button mutation variant="primary" loading={busy} onClick={collect}><LocalizedText message="Record payment" /></Button></>}>
        {inv && <PaymentRows value={pay} onChange={setPay} errors={errors} max={inv.balance} />}
      </Modal>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t("Cancel {v0}",{v0:inv?.invoiceNo})} subtitle="Lines return to the billing queue and dispensed stock is added back." width="max-w-md"
        footer={<><Button variant="ghost" onClick={() => setCancelOpen(false)}><LocalizedText message="Keep invoice" /></Button><Button mutation variant="danger" loading={busy} onClick={cancel}><LocalizedText message="Cancel invoice" /></Button></>}>
        <Field label="Reason" required error={errors.reason}><Input autoFocus value={reason} invalid={!!errors.reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Billed to wrong policy" /></Field>
      </Modal>
    </div>
  );
}

export default function InvoicesPage() { return <Suspense><Invoices /></Suspense>; }
