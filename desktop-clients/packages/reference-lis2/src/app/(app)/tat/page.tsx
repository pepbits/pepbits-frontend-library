'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useFilters, useInterval, useList } from '../../../lib/hooks';
import {fullName,minutesText} from '../../../lib/format';
import { ErrorBanner, PageHeader, PriorityBadge, Select, StatusBadge, Tabs, cx } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function TatPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const [f, set] = useFilters({ q: '', state: sp.get('state') || '', departmentId: '', priority: '', status: '', pageSize: 50 });
  const { data, loading, error, reload } = useList('/dashboard/tat', f);
  useInterval(reload, 30000);
  return (
    <>
      <PageHeader title={referenceT("Turnaround monitor")} subtitle={referenceT("Open tests against the due time set at receipt from each test’s TAT and priority. Refreshes every 30 seconds.")} />
      <Tabs className="mb-3" value={f.state as any} onChange={(state: string) => set({ state })} tabs={[{ value: '', label: 'All open' }, { value: 'breached', label: 'Past due' }, { value: 'risk', label: 'Due within 30 min' }, { value: 'ok', label: 'On track' }]} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Sample, order or MRN")} />
          <FilterItem label={referenceT("Department")}><RefSelect entity="departments" className="w-44" value={f.departmentId} onChange={(departmentId) => set({ departmentId })} /></FilterItem>
          <FilterItem label={referenceT("Priority")}><Select className="w-28" value={f.priority} onChange={(priority) => set({ priority })} placeholder={referenceT("Any")} options={['STAT', 'URGENT', 'ROUTINE']} /></FilterItem>
          <FilterItem label={referenceT("Stage")}><Select className="w-40" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['RECEIVED', 'OUTSOURCE_PENDING', 'OUTSOURCED', 'IN_PROCESS', 'RESULTED', 'VALIDATED', 'AMENDING']} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} dense empty="No open tests in this view" columns={[
          { key: 'left', header: 'Time', render: (r: any) => {
            const pct = Math.min(100, Math.max(0, (r.minutes_elapsed / Math.max(1, r.minutes_elapsed + r.minutes_left)) * 100));
            return <div className="w-36"><div className={cx('text-sm font-semibold tnum', r.minutes_left < 0 ? 'text-crit' : r.minutes_left < 30 ? 'text-high' : 'text-ink')}>{minutesText(r.minutes_left)}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-line"><div className={cx('h-full', r.minutes_left < 0 ? 'bg-crit' : r.minutes_left < 30 ? 'bg-high' : 'bg-hema-500')} style={{ width: `${r.minutes_left < 0 ? 100 : pct}%` }} /></div></div>;
          } },
          { key: 'test', header: 'Test', render: (r: any) => <div><div className="font-medium">{r.test_name}</div><div className="text-2xs text-ink-soft">{r.department}</div></div> },
          { key: 'sample', header: 'Sample', render: (r: any) => r.sample_id ? <Link className="link tnum" href={`/results/sample/${r.sample_id}`}>{r.sample_no}</Link> : '' },
          { key: 'patient', header: 'Patient', render: (r: any) => `${fullName(r)} (${r.age} ${r.gender})` },
          { key: 'priority', header: 'Priority', render: (r: any) => <PriorityBadge priority={r.priority} /> },
          { key: 'status', header: 'Stage', render: (r: any) => <StatusBadge status={r.status} /> },
          { key: 'received_at', header: 'Received', render: (r: any) => fmtDateTime(r.received_at) },
          { key: 'due_at', header: 'Due', render: (r: any) => fmtDateTime(r.due_at) },
        ]} />
      </div>
    </>
  );
}
