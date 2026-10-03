'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { useFilters, useList } from '../../../lib/hooks';
import {fullName} from '../../../lib/format';
import { ErrorBanner, PageHeader, PriorityBadge, Select, StatusBadge } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { SampleDrawer } from '../../../components/sample';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function SamplesPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const [f, set] = useFilters({ q: '', status: sp.get('status') || '', priority: '', sampleTypeId: '', facilityId: '', from: '', to: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/samples', f);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { const o = sp.get('open'); if (o) setOpen(Number(o)); }, [sp]);
  return (
    <>
      <PageHeader title={referenceT("Samples")} subtitle={referenceT("Every specimen with its tests, analyzer orders and chain of custody.")} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-72" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Sample no., client barcode, MRN, name")} />
          <FilterItem label={referenceT("Status")}><Select className="w-32" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['COLLECTED', 'RECEIVED', 'REJECTED']} /></FilterItem>
          <FilterItem label={referenceT("Priority")}><Select className="w-28" value={f.priority} onChange={(priority) => set({ priority })} placeholder={referenceT("Any")} options={['STAT', 'URGENT', 'ROUTINE']} /></FilterItem>
          <FilterItem label={referenceT("Specimen")}><RefSelect entity="sample_types" className="w-40" value={f.sampleTypeId} onChange={(sampleTypeId) => set({ sampleTypeId })} placeholder={referenceT("Any")} /></FilterItem>
          <FilterItem label={referenceT("Client facility")}><RefSelect entity="external_facilities" className="w-40" value={f.facilityId} onChange={(facilityId) => set({ facilityId })} placeholder={referenceT("Any")} /></FilterItem>
          <FilterItem label={referenceT("From")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
          <FilterItem label={referenceT("To")}><DiagnosticDateInput  className="input w-36" value={f.to} onChange={(e) => set({ to: e.target.value })} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r: any) => setOpen(r.id)} empty="No samples match these filters" columns={[
            { key: 'sample_no', header: 'Sample', render: (r: any) => <div><div className="font-medium tnum">{r.sample_no}</div>{r.external_sample_no && <div className="text-2xs text-ink-soft">{r.facility}: {r.external_sample_no}</div>}</div> },
            { key: 'patient', header: 'Patient', render: (r: any) => <>{fullName(r)} <span className="text-2xs text-ink-soft tnum">{r.mrn}</span></> },
            { key: 'type', header: 'Specimen', render: (r: any) => <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-black/20" style={{ background: r.cap_color || '#ccc' }} />{r.sample_type}</span> },
            { key: 'tests', header: 'Tests' }, { key: 'orders', header: 'Orders', className: 'text-xs tnum' },
            { key: 'priority', header: 'Priority', render: (r: any) => <PriorityBadge priority={r.priority} /> },
            { key: 'status', header: 'Status', render: (r: any) => <><StatusBadge status={r.status} />{r.rejection_reason && <div className="text-2xs text-crit">{r.rejection_reason}</div>}</> },
            { key: 'collected_at', header: 'Collected', render: (r: any) => fmtDateTime(r.collected_at) },
            { key: 'received_at', header: 'Received', render: (r: any) => fmtDateTime(r.received_at) },
          ]} />
      </div>
      <SampleDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
    </>
  );
}
