'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { FilePlus } from 'lucide-react';
import { useFilters, useList } from '../../../lib/hooks';
import {fullName,age} from '../../../lib/format';
import { Button, ErrorBanner, PageHeader, PriorityBadge, Select, StatusBadge } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OrdersPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime,money}=useDiagnosticFormat();

  const router = useRouter();
  const sp = useSearchParams();
  const [f, set] = useFilters({ q: '', status: sp.get('status') || '', source: '', priority: '', facilityId: '', from: '', to: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/orders', f);
  return (
    <>
      <PageHeader title={referenceT("Orders")} subtitle={referenceT("Internal requests and orders received from client hospitals.")}
        actions={<Link href="/orders/new"><Button variant="primary" icon={<FilePlus className="h-4 w-4" />}><ReferenceText message="New order" /></Button></Link>} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-72" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Order no., external no., MRN, name")} />
          <FilterItem label={referenceT("Status")}><Select className="w-32" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['ACTIVE', 'PARTIAL', 'COMPLETED', 'CANCELLED']} /></FilterItem>
          <FilterItem label={referenceT("Priority")}><Select className="w-28" value={f.priority} onChange={(priority) => set({ priority })} placeholder={referenceT("Any")} options={['STAT', 'URGENT', 'ROUTINE']} /></FilterItem>
          <FilterItem label={referenceT("Source")}><Select className="w-32" value={f.source} onChange={(source) => set({ source })} placeholder={referenceT("Any")} options={['INTERNAL', 'EXTERNAL', 'HIS']} /></FilterItem>
          <FilterItem label={referenceT("Client facility")}><RefSelect entity="external_facilities" className="w-44" value={f.facilityId} onChange={(facilityId) => set({ facilityId })} placeholder={referenceT("Any")} /></FilterItem>
          <FilterItem label={referenceT("From")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
          <FilterItem label={referenceT("To")}><DiagnosticDateInput  className="input w-36" value={f.to} onChange={(e) => set({ to: e.target.value })} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r: any) => router.push(`/orders/${r.id}`)} empty="No orders match these filters"
          columns={[
            { key: 'order_no', header: 'Order', render: (r: any) => <div><div className="font-medium tnum">{r.order_no}</div>{r.external_order_no && <div className="text-2xs text-ink-soft">{r.facility}: {r.external_order_no}</div>}</div> },
            { key: 'patient', header: 'Patient', render: (r: any) => <div><div>{fullName(r)}</div><div className="text-2xs text-ink-soft tnum">{r.mrn}, {[age(r.dob), r.gender].filter(Boolean).join(' ')}</div></div> },
            { key: 'tests', header: 'Tests', className: 'max-w-[260px]' },
            { key: 'priority', header: 'Priority', render: (r: any) => <PriorityBadge priority={r.priority} /> },
            { key: 'progress', header: 'Signed', align: 'right', render: (r: any) => `${r.signed}/${r.total_items}` },
            { key: 'net', header: 'Net', align: 'right', render: (r: any) => money(r.net) },
            { key: 'bill_status', header: 'Bill', render: (r: any) => <StatusBadge status={r.bill_status} /> },
            { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'created_at', header: 'Ordered', render: (r: any) => fmtDateTime(r.created_at) },
          ]} />
      </div>
    </>
  );
}
