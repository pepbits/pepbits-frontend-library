'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useFilters, useList } from '../../../lib/hooks';
import {fullName} from '../../../lib/format';
import { Badge, ErrorBanner, PageHeader, Select, StatusBadge } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { ReportItemDrawer } from '../../../components/reportitem';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function ReportsPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const [f, set] = useFilters({ q: '', status: '', departmentId: '', facilityId: '', flag: '', versioned: '', from: '', to: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/reports', f);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <PageHeader title={referenceT("Reports")} subtitle={referenceT("Signed reports and open amendments. Open a report to print it, amend it or add an addendum.")} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-72" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Order, client order, sample, MRN, name")} />
          <FilterItem label={referenceT("Status")}><Select className="w-36" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Signed or amending")} options={['SIGNED', 'AMENDING']} /></FilterItem>
          <FilterItem label={referenceT("Department")}><RefSelect entity="departments" className="w-44" value={f.departmentId} onChange={(departmentId) => set({ departmentId })} /></FilterItem>
          <FilterItem label={referenceT("Client")}><RefSelect entity="external_facilities" className="w-40" value={f.facilityId} onChange={(facilityId) => set({ facilityId })} placeholder={referenceT("Any")} /></FilterItem>
          <FilterItem label={referenceT("Flags")}><Select className="w-32" value={f.flag} onChange={(flag) => set({ flag })} placeholder={referenceT("Any")} options={[{ value: 'critical', label: 'Critical' }, { value: 'abnormal', label: 'Abnormal' }]} /></FilterItem>
          <FilterItem label={referenceT("Versions")}><Select className="w-40" value={f.versioned} onChange={(versioned) => set({ versioned })} placeholder={referenceT("Any")} options={[{ value: '1', label: 'Amended or with addenda' }]} /></FilterItem>
          <FilterItem label={referenceT("Signed from")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
          <FilterItem label={referenceT("to")}><DiagnosticDateInput  className="input w-36" value={f.to} onChange={(e) => set({ to: e.target.value })} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r: any) => setOpen(r.id)} empty="No reports match these filters" columns={[
            { key: 'test', header: 'Test', render: (r: any) => <div><div className="font-medium">{r.test_name}</div><div className="text-2xs text-ink-soft tnum">{r.order_no}{r.external_order_no ? `, ${r.facility} ${r.external_order_no}` : ''}</div></div> },
            { key: 'patient', header: 'Patient', render: (r: any) => <>{fullName(r)} <span className="text-2xs text-ink-soft tnum">{r.mrn}</span></> },
            { key: 'sample_no', header: 'Sample', className: 'tnum' },
            { key: 'flags', header: 'Flags', render: (r: any) => r.is_critical ? <Badge tone="crit"><ReferenceText message="Critical" /></Badge> : r.is_abnormal ? <Badge tone="high"><ReferenceText message="Abnormal" /></Badge> : <span className="text-2xs text-ink-faint"><ReferenceText message="Normal" /></span> },
            { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'versions', header: 'Versions', className: 'text-xs', render: (r: any) => r.report_version > 1 ? <span title={r.versions}>{r.versions}</span> : 'Original' },
            { key: 'signed', header: 'Signed', render: (r: any) => <span className="text-xs">{fmtDateTime(r.signed_at)}<br /><span className="text-ink-soft">{r.signed_by_name}</span></span> },
            { key: 'print', header: '', render: (r: any) => r.status === 'SIGNED' && <Link onClick={(e) => e.stopPropagation()} href={`/print/order/${r.order_id}?itemIds=${r.id}`} target="_blank" className="inline-flex rounded p-1 text-ink-soft hover:bg-black/5" aria-label={referenceT("Print report")}><Printer className="h-4 w-4" /></Link> },
          ]} />
      </div>
      <ReportItemDrawer itemId={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
