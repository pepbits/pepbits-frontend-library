'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useFilters, useInterval, useList } from '../../../../lib/hooks';
import {fullName} from '../../../../lib/format';
import { ErrorBanner, PageHeader, Select, StatusBadge } from '../../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../../components/table';
import { RefSelect } from '../../../../components/refselect';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function InstrumentOrdersPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const [f, set] = useFilters({ q: '', status: '', analyzerId: '', pageSize: 50 });
  const { data, loading, error, reload } = useList('/integration/instrument-orders', f);
  useInterval(reload, 15000);
  return (
    <>
      <PageHeader title={referenceT("Analyzer orders")} subtitle={referenceT("Work orders generated at accession from the analyzer test mapping. Broadcast analyzers get them pushed or polled; host-query analyzers ask for them when the tube is loaded.")}
        actions={data && <div className="flex gap-2 text-xs">{data.stats.map((s: any) => <span key={s.status} className="flex items-center gap-1"><StatusBadge status={s.status} /><b className="tnum">{s.c}</b></span>)}</div>} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Sample number or MRN")} />
          <FilterItem label={referenceT("Analyzer")}><RefSelect entity="analyzers" className="w-52" value={f.analyzerId} onChange={(analyzerId) => set({ analyzerId })} /></FilterItem>
          <FilterItem label={referenceT("Status")}><Select className="w-40" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['QUEUED', 'SENT', 'AWAITING_QUERY', 'RESULTED', 'CANCELLED']} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} dense empty="No analyzer orders yet. They are created when a sample is received." columns={[
          { key: 'sample_no', header: 'Sample', render: (r: any) => <Link className="link tnum" href={`/results/sample/${r.sample_id}`}>{r.sample_no}</Link> },
          { key: 'patient', header: 'Patient', render: (r: any) => `${fullName(r)} (${r.mrn})` },
          { key: 'analyzer', header: 'Analyzer', render: (r: any) => <div>{r.analyzer_name}<div className="text-2xs text-ink-soft">{r.middleware ? `via ${r.middleware}` : 'direct'}</div></div> },
          { key: 'test_code', header: 'Test' }, { key: 'order_codes', header: 'Codes sent', className: 'font-mono text-xs' },
          { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
          { key: 'item_status', header: 'Test status', render: (r: any) => <StatusBadge status={r.item_status} /> },
          { key: 'created_at', header: 'Created', render: (r: any) => fmtDateTime(r.created_at) },
          { key: 'sent_at', header: 'Sent', render: (r: any) => fmtDateTime(r.sent_at) },
          { key: 'resulted_at', header: 'Resulted', render: (r: any) => fmtDateTime(r.resulted_at) },
        ]} />
      </div>
    </>
  );
}
