'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useState } from 'react';
import { useFilters, useInterval, useList } from '../../../lib/hooks';
import {fullName,titleCase} from '../../../lib/format';
import { Button, ErrorBanner, PageHeader, Select, StatusBadge, cx, useToast } from '../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../components/table';
import { CriticalNotifyModal } from '../../../components/critical';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function CriticalPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const toast = useToast();
  const [f, set] = useFilters({ q: '', status: sp.get('status') ?? 'PENDING', pageSize: 25 });
  const { data, loading, error, reload } = useList('/critical', f);
  useInterval(reload, 30000);
  const [n, setN] = useState<any>(null);
  return (
    <>
      <PageHeader title={referenceT("Critical values")} subtitle={referenceT("Every critical result must be phoned to the clinical team, with read-back, before the report can be signed.")} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-72" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("MRN, order or patient")} />
          <FilterItem label={referenceT("Status")}><Select className="w-36" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['PENDING', 'NOTIFIED', 'CLEARED']} /></FilterItem>
          {data && <span className="ml-auto self-center text-sm">{data.pending ? <b className="text-crit">{data.pending} <ReferenceText message="awaiting notification" /></b> : <span className="text-ink-soft"><ReferenceText message="No pending notifications" /></span>}</span>}
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} empty="No critical values in this view"
          rowClass={(r: any) => (r.status === 'PENDING' ? 'bg-crit-bg/40' : undefined)} columns={[
            { key: 'value', header: 'Result', render: (r: any) => <div><div className="font-semibold text-crit tnum">{r.parameter} {r.value} {r.unit} <span className="text-2xs">{r.flag}</span></div><div className="text-2xs text-ink-soft">{r.test_name}<ReferenceText message=", ref" /> {r.ref_text}</div></div> },
            { key: 'patient', header: 'Patient', render: (r: any) => <div><div>{fullName(r)}</div><div className="text-2xs text-ink-soft tnum">{r.mrn}{r.phone ? `, ${r.phone}` : ''}</div></div> },
            { key: 'who', header: 'Ordering doctor / location', render: (r: any) => <div className="text-xs">{r.doctor || '–'}{r.doctor_phone ? `, ${r.doctor_phone}` : ''}<div className="text-ink-soft">{r.location}</div></div> },
            { key: 'order_no', header: 'Order', className: 'tnum text-xs' },
            { key: 'open', header: 'Open for', render: (r: any) => <span className={cx('text-xs tnum', r.status === 'PENDING' && r.minutes_open > 30 && 'font-semibold text-crit')}>{r.minutes_open} <ReferenceText message="min" /></span> },
            { key: 'status', header: 'Status', render: (r: any) => <div><StatusBadge status={r.status} />{r.notified_to && <div className="text-2xs text-ink-soft">{titleCase(r.method)} <ReferenceText message="to" /> {r.notified_to}, {fmtDateTime(r.notified_at)} <ReferenceText message="by" /> {r.notified_by_name}</div>}</div> },
            { key: 'act', header: '', render: (r: any) => r.status === 'PENDING' && <Button size="sm" variant="danger" onClick={() => setN(r)}><ReferenceText message="Record notification" /></Button> },
          ]} />
      </div>
      {n && <CriticalNotifyModal open notification={n} onClose={() => setN(null)} onDone={() => { toast.ok('Notification recorded.'); reload(); }}
        context={<p className="mb-3 text-sm">{fullName(n)}: <b className="text-crit">{n.parameter} {n.value} {n.unit}</b>{n.doctor ? `. Ordering doctor ${n.doctor}${n.doctor_phone ? `, ${n.doctor_phone}` : ''}` : ''}</p>} />}
    </>
  );
}
