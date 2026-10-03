'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticButton,DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat, useDiagnosticWorklist} from '@pepbits/reference-diagnostics';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { AlertTriangle } from 'lucide-react';
import { useFilters, useInterval, useList } from '../../../lib/hooks';
import {ago,age,fullName,minutesText,toDate} from '../../../lib/format';
import { Badge, ErrorBanner, FlagBadge, PageHeader, PriorityBadge, Select, cx } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const ITEM_TONE: Record<string, string> = {
  RECEIVED: 'border-hema-200 bg-white', OUTSOURCED: 'border-violet-200 bg-violet-50', IN_PROCESS: 'border-amber-300 bg-amber-50',
  RESULTED: 'border-orange-300 bg-orange-50', AMENDING: 'border-high bg-high-bg', VALIDATED: 'border-eosin-100 bg-eosin-50',
};

export default function WorklistPage() {
 const {setIds}=useDiagnosticWorklist();
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const router = useRouter();
  const sp = useSearchParams();
  const [f, set] = useFilters({ q: '', status: sp.get('status') || '', departmentId: sp.get('departmentId') || '', subDepartmentId: '', priority: '', facilityId: '', overdue: '', flag: '', from: '', to: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/results/worklist', f);
  useInterval(reload, 30000);
  const c = data?.counts || {};
  const open = (id: number) => {
    setIds((data?.data || []).map((r:any)=>r.sample_id));
    router.push(`/results/sample/${id}${f.departmentId ? `?departmentId=${f.departmentId}` : ''}`);
  };
  const chip = (label: string, n: number, patch: any, active: boolean) => (
    <DiagnosticButton onClick={() => set(patch)} className={cx('rounded-md border px-3 py-1.5 text-left', active ? 'border-hema-600 bg-hema-50' : 'border-line bg-white hover:bg-paper')}>
      <div className="text-lg font-semibold leading-none tnum">{n ?? 0}</div><div className="mt-0.5 text-2xs text-ink-soft">{label}</div>
    </DiagnosticButton>
  );
  return (
    <>
      <PageHeader title={referenceT("Worklist")} subtitle={referenceT("Received samples by bench. STAT first, then the closest due time. Open a sample to enter or review its results.")} />
      <div className="mb-3 flex flex-wrap gap-2">
        {chip('Awaiting results', (c.pending || 0) + (c.in_process || 0), { status: 'RECEIVED,OUTSOURCED,IN_PROCESS', overdue: '' }, f.status === 'RECEIVED,OUTSOURCED,IN_PROCESS')}
        {chip('Ready to validate', c.resulted, { status: 'RESULTED', overdue: '' }, f.status === 'RESULTED')}
        {chip('Amendments', c.amending, { status: 'AMENDING', overdue: '' }, f.status === 'AMENDING')}
        {chip('Past due', c.overdue, { overdue: '1', status: '' }, f.overdue === '1')}
        {chip('Everything open', (c.pending || 0) + (c.in_process || 0) + (c.resulted || 0) + (c.amending || 0), { status: '', overdue: '' }, !f.status && !f.overdue)}
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Sample, order, MRN, name")} autoFocus />
          <FilterItem label={referenceT("Department")}><RefSelect entity="departments" className="w-44" value={f.departmentId} onChange={(departmentId) => set({ departmentId, subDepartmentId: '' })} /></FilterItem>
          <FilterItem label={referenceT("Bench")}><RefSelect entity="sub_departments" className="w-44" params={f.departmentId ? { department_id: f.departmentId } : {}} value={f.subDepartmentId} onChange={(subDepartmentId) => set({ subDepartmentId })} /></FilterItem>
          <FilterItem label={referenceT("Priority")}><Select className="w-28" value={f.priority} onChange={(priority) => set({ priority })} placeholder={referenceT("Any")} options={['STAT', 'URGENT', 'ROUTINE']} /></FilterItem>
          <FilterItem label={referenceT("Flags")}><Select className="w-32" value={f.flag} onChange={(flag) => set({ flag })} placeholder={referenceT("Any")} options={[{ value: 'critical', label: 'Critical' }, { value: 'abnormal', label: 'Abnormal' }]} /></FilterItem>
          <FilterItem label={referenceT("Client")}><RefSelect entity="external_facilities" className="w-36" value={f.facilityId} onChange={(facilityId) => set({ facilityId })} placeholder={referenceT("Any")} /></FilterItem>
          <FilterItem label={referenceT("Received from")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r: any) => open(r.sample_id)} empty="No samples in this view" rowClass={(r: any) => (r.critical ? 'shadow-[inset_3px_0_0_#C62828]' : undefined)}
          columns={[
            { key: 'sample', header: 'Sample', render: (r: any) => <div><div className="font-semibold tnum">{r.sample_no}</div>{r.external_sample_no && <div className="text-2xs text-ink-soft"><ReferenceText message="client" /> {r.external_sample_no}</div>}</div> },
            { key: 'patient', header: 'Patient', render: (r: any) => <div><div>{fullName(r)}</div><div className="text-2xs text-ink-soft tnum">{r.mrn}, {[age(r.dob), r.gender].filter(Boolean).join(' ')}</div></div> },
            { key: 'priority', header: 'Priority', render: (r: any) => <PriorityBadge priority={r.priority} /> },
            { key: 'tests', header: 'Tests', render: (r: any) => (
              <div className="flex flex-wrap gap-1">{r.items.map((i: any) => (
                <span key={i.id} title={referenceT("{value0}: {value1}{value2}{value3}", {value0: i.test_name, value1: i.status.toLowerCase().replace('_', ' '), value2: i.analyzers ? `, on ${i.analyzers}` : '', value3: i.sent_back_reason ? `. Sent back: ${i.sent_back_reason}` : ''})}
                  className={cx('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs', ITEM_TONE[i.status] || 'border-line bg-white')}>
                  <b>{i.test_code}</b><span className="tnum text-ink-soft">{i.entered}/{i.params}</span>
                  {i.is_critical ? <FlagBadge flag="HH" critical /> : i.is_abnormal ? <span className="text-high">●</span> : null}
                  {i.sent_back_reason && <AlertTriangle className="h-3 w-3 text-high" />}
                </span>
              ))}</div>) },
            { key: 'received', header: 'Received', render: (r: any) => <span className="text-xs">{ago(r.received_at)}</span> },
            { key: 'due', header: 'Due', render: (r: any) => { const d = toDate(r.due_at); if (!d) return ''; const m = (d.getTime() - Date.now()) / 60000; return <span title={fmtDateTime(r.due_at)} className={cx('text-xs', m < 0 ? 'font-semibold text-crit' : m < 30 ? 'text-high' : 'text-ink-soft')}>{minutesText(m)}</span>; } },
            { key: 'flags', header: '', render: (r: any) => r.delta ? <Badge tone="violet" title={referenceT("Delta check failed")}>Δ</Badge> : null },
          ]} />
      </div>
    </>
  );
}
