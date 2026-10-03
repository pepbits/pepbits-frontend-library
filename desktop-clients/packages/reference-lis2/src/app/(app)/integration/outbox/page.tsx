'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { useFilters, useInterval, useList } from '../../../../lib/hooks';
import {fullName,titleCase} from '../../../../lib/format';
import { Button, DL, ErrorBanner, Modal, PageHeader, Select, StatusBadge, useToast } from '../../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../../components/table';
import { RefSelect } from '../../../../components/refselect';
import { MessageView } from '../../../../components/message';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OutboxPage() {
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const toast = useToast();
  const [f, set] = useFilters({ q: '', status: sp.get('status') || '', mode: '', event: '', facilityId: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/integration/publications', f);
  useInterval(reload, 15000);
  const [pub, setPub] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const count = (mode: string, st: string) => data?.stats?.find((s: any) => s.mode === mode && s.status === st)?.c || 0;
  return (
    <>
      <PageHeader title={referenceT("Result delivery")} subtitle={referenceT("Each signed report, corrected report and addendum is queued once per recipient. Push recipients are sent with automatic retries; pull recipients fetch and acknowledge through the API.")} />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Waiting for pull', count('PULL', 'AVAILABLE'), 'PULL', 'AVAILABLE'], ['Pulled and acknowledged', count('PULL', 'ACKED'), 'PULL', 'ACKED'], ['Pushed', count('PUSH', 'DELIVERED'), 'PUSH', 'DELIVERED'],
          ['Push retrying or failed', count('PUSH', 'RETRY') + count('PUSH', 'FAILED') + count('PUSH', 'PENDING'), 'PUSH', 'RETRY']].map(([l, n, mode, status]) => (
          <DiagnosticButton key={l as string} onClick={() => set({ mode: mode as string, status: status as string })} className="panel px-4 py-3 text-left hover:border-hema-200">
            <div className="text-xs text-ink-soft">{l}</div><div className={`text-2xl font-semibold tnum ${l === 'Push retrying or failed' && (n as number) > 0 ? 'text-crit' : ''}`}>{n}</div>
          </DiagnosticButton>
        ))}
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Order, client order, MRN")} />
          <FilterItem label={referenceT("Mode")}><Select className="w-28" value={f.mode} onChange={(mode) => set({ mode })} placeholder={referenceT("Both")} options={['PUSH', 'PULL']} /></FilterItem>
          <FilterItem label={referenceT("Status")}><Select className="w-32" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['PENDING', 'RETRY', 'DELIVERED', 'FAILED', 'AVAILABLE', 'ACKED']} /></FilterItem>
          <FilterItem label={referenceT("Event")}><Select className="w-32" value={f.event} onChange={(event) => set({ event })} placeholder={referenceT("Any")} options={['FINAL', 'CORRECTED', 'ADDENDUM']} /></FilterItem>
          <FilterItem label={referenceT("Client")}><RefSelect entity="external_facilities" className="w-44" value={f.facilityId} onChange={(facilityId) => set({ facilityId })} placeholder={referenceT("Any")} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={async (r: any) => setPub(await get(`/integration/publications/${r.id}`))} empty="Nothing has been published yet. Reports are published when signed." columns={[
            { key: 'id', header: '#', className: 'tnum text-ink-soft' },
            { key: 'to', header: 'Recipient', render: (r: any) => <div>{r.facility || r.interface}<div className="text-2xs text-ink-soft">{r.format}, {r.mode === 'PULL' ? 'client pulls' : 'pushed'}</div></div> },
            { key: 'event', header: 'Event', render: (r: any) => `${titleCase(r.event)} v${r.report_version}` },
            { key: 'order', header: 'Order', render: (r: any) => <div className="tnum">{r.order_no}<div className="text-2xs text-ink-soft">{r.external_order_no}</div></div> },
            { key: 'test_code', header: 'Test' }, { key: 'patient', header: 'Patient', render: (r: any) => fullName(r) },
            { key: 'status', header: 'Status', render: (r: any) => <div><StatusBadge status={r.status} />{r.last_error && <div className="max-w-[260px] truncate text-2xs text-crit" title={r.last_error}>{r.last_error}</div>}</div> },
            { key: 'attempts', header: 'Attempts', align: 'right' },
            { key: 'when', header: 'Created / delivered', render: (r: any) => <span className="text-xs">{fmtDateTime(r.created_at)}<br /><span className="text-ink-soft">{fmtDateTime(r.acked_at || r.delivered_at)}</span></span> },
          ]} />
      </div>
      <Modal open={!!pub} onClose={() => setPub(null)} title={pub ? `Publication #${pub.id}` : ''} width="max-w-4xl"
        footer={pub?.mode === 'PUSH' && pub.status !== 'DELIVERED' && <Button variant="primary" loading={busy} icon={<RotateCcw className="h-4 w-4" />} onClick={async () => {
          setBusy(true); try { const r = await post(`/integration/publications/${pub.id}/retry`); setPub(r); toast[r.status === 'DELIVERED' ? 'ok' : 'warn'](r.status === 'DELIVERED' ? 'Delivered.' : `Not delivered: ${r.last_error}`); reload(); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
        }}><ReferenceText message="Retry now" /></Button>}>
        {pub && <>
          <DL cols={4} items={[['Recipient', pub.facility || pub.interface], ['Mode', pub.mode === 'PULL' ? 'Client pulls' : 'Pushed by LIS'], ['Format', pub.format], ['Status', <StatusBadge key="s" status={pub.status} />],
            ['Event', `${titleCase(pub.event)} v${pub.report_version}`], ['Attempts', pub.attempts], ['Next attempt', pub.mode === 'PUSH' && pub.status === 'RETRY' ? fmtDateTime(pub.next_attempt_at) : null], ['Acknowledged', fmtDateTime(pub.acked_at)]]} />
          {pub.last_error && <p className="mt-3 rounded-md bg-crit-bg px-3 py-2 text-sm text-crit">{pub.last_error}</p>}
          <h3 className="mb-1 mt-3 text-sm font-semibold"><ReferenceText message="Payload" /></h3>
          <MessageView raw={pub.payload} />
        </>}
      </Modal>
    </>
  );
}
