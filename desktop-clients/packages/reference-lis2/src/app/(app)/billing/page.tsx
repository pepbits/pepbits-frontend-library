'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';

import { useFilters, useList } from '../../../lib/hooks';
import {fullName,titleCase} from '../../../lib/format';
import { Button, DL, ErrorBanner, Modal, PageHeader, Select, StatusBadge, useToast } from '../../../components/ui';
import { DataTable, FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { PaymentModal } from '../../../components/billing';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function BillingPage() {
 const referenceT = useReferenceLocalization().t;

 const {get}=useDiagnosticClient();
 const {fmtDateTime,money}=useDiagnosticFormat();

  const toast = useToast();
  const [f, set] = useFilters({ q: '', status: '', payerType: '', from: '', to: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/billing', f);
  const [bill, setBill] = useState<any>(null);
  const [pay, setPay] = useState(false);
  const open = async (id: number) => setBill(await get(`/billing/${id}`));
  return (
    <>
      <PageHeader title={referenceT("Billing")} subtitle={referenceT("Bills are raised automatically when tests are ordered. Client-hospital orders are billed on credit.")} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-72" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Bill, order, MRN or name")} />
          <FilterItem label={referenceT("Status")}><Select className="w-32" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['UNPAID', 'PARTIAL', 'PAID', 'CREDIT']} /></FilterItem>
          <FilterItem label={referenceT("Payer")}><Select className="w-32" value={f.payerType} onChange={(payerType) => set({ payerType })} placeholder={referenceT("Any")} options={['SELF', 'FACILITY', 'INSURANCE']} /></FilterItem>
          <FilterItem label={referenceT("From")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
          <FilterItem label={referenceT("To")}><DiagnosticDateInput  className="input w-36" value={f.to} onChange={(e) => set({ to: e.target.value })} /></FilterItem>
          {data?.sums && <div className="ml-auto text-right text-sm"><div className="text-2xs text-ink-faint"><ReferenceText message="Net / collected for these filters" /></div><div className="font-semibold tnum">{money(data.sums.net)} / {money(data.sums.paid)}</div></div>}
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r: any) => open(r.id)} empty="No bills match these filters"
          columns={[
            { key: 'bill_no', header: 'Bill', className: 'font-medium tnum' },
            { key: 'order_no', header: 'Order', className: 'tnum' },
            { key: 'patient', header: 'Patient', render: (r: any) => <>{fullName(r)} <span className="text-2xs text-ink-soft">{r.mrn}</span></> },
            { key: 'payer', header: 'Payer', render: (r: any) => r.facility || titleCase(r.payer_type) },
            { key: 'gross', header: 'Gross', align: 'right', render: (r: any) => money(r.gross) },
            { key: 'discount', header: 'Discount', align: 'right', render: (r: any) => money(r.discount) },
            { key: 'net', header: 'Net', align: 'right', render: (r: any) => money(r.net) },
            { key: 'paid', header: 'Paid', align: 'right', render: (r: any) => money(r.paid) },
            { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'created_at', header: 'Raised', render: (r: any) => fmtDateTime(r.created_at) },
          ]} />
      </div>
      <Modal open={!!bill} onClose={() => setBill(null)} title={bill ? `Bill ${bill.bill_no}` : ''} width="max-w-2xl"
        footer={bill && <><Link href={`/orders/${bill.order_id}`}><Button><ReferenceText message="Open order" /></Button></Link><Button variant="primary" onClick={() => setPay(true)}><ReferenceText message="Record payment" /></Button></>}>
        {bill && <>
          <DL cols={3} items={[['Patient', `${fullName(bill)} (${bill.mrn})`], ['Order', bill.order_no], ['Payer', bill.facility || titleCase(bill.payer_type)], ['Net', money(bill.net)], ['Paid', money(bill.paid)], ['Status', <StatusBadge key="s" status={bill.status} />]]} />
          <h3 className="mb-1 mt-4 text-sm font-semibold"><ReferenceText message="Items" /></h3>
          <DataTable rows={bill.items} dense columns={[{ key: 'code', header: 'Code' }, { key: 'name', header: 'Test' }, { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> }, { key: 'amount', header: 'Amount', align: 'right', render: (r: any) => money(r.amount) }]} />
          <h3 className="mb-1 mt-4 text-sm font-semibold"><ReferenceText message="Payments" /></h3>
          <DataTable rows={bill.payments} dense empty="No payments yet" columns={[{ key: 'created_at', header: 'When', render: (r: any) => fmtDateTime(r.created_at) }, { key: 'mode', header: 'Mode', render: (r: any) => titleCase(r.mode) }, { key: 'reference', header: 'Reference' }, { key: 'user', header: 'By' }, { key: 'amount', header: 'Amount', align: 'right', render: (r: any) => money(r.amount) }]} />
        </>}
      </Modal>
      <PaymentModal bill={bill} open={pay} onClose={() => setPay(false)} onPaid={(b) => { setBill(b); reload(); toast.ok('Payment recorded.'); }} />
    </>
  );
}
