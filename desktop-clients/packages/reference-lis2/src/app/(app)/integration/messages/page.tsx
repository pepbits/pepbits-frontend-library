'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react';

import { useFilters, useInterval, useList } from '../../../../lib/hooks';
import {titleCase} from '../../../../lib/format';
import { Button, DL, ErrorBanner, Modal, PageHeader, Select, StatusBadge, Tabs, useToast } from '../../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../../components/table';
import { RefSelect } from '../../../../components/refselect';
import { MessageView } from '../../../../components/message';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function MessagesPage() {
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const toast = useToast();
  const [f, set] = useFilters({ q: '', direction: '', status: sp.get('status') || '', protocol: '', interfaceId: '', facilityId: '', from: '', to: '', pageSize: 50 });
  const { data, loading, error, reload } = useList('/integration/messages', f);
  useInterval(reload, 15000);
  const [msg, setMsg] = useState<any>(null);
  const [tab, setTab] = useState<'raw' | 'response'>('raw');
  const [busy, setBusy] = useState(false);
  const open = async (id: number) => { setTab('raw'); setMsg(await get(`/integration/messages/${id}`)); };
  useEffect(() => { const o = sp.get('open'); if (o) open(Number(o)); }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const stat = (dir: string, st: string) => data?.stats?.find((s: any) => s.direction === dir && s.status === st)?.c || 0;
  return (
    <>
      <PageHeader title={referenceT("Message log")} subtitle={referenceT("Every message received from or sent to analyzers, middleware, client hospitals, reference labs and the HIE. Refreshes every 15 seconds.")}
        actions={data && <span className="text-sm text-ink-soft"><ReferenceText message="Last 24 h:" /> {stat('IN', 'PROCESSED')} <ReferenceText message="processed in," /> <b className="text-crit">{stat('IN', 'ERROR') + stat('IN', 'REJECTED')}</b> <ReferenceText message="failed," /> {stat('OUT', 'QUEUED')} <ReferenceText message="queued out" /></span>} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Content, control ID, error")} />
          <FilterItem label={referenceT("Direction")}><Select className="w-28" value={f.direction} onChange={(direction) => set({ direction })} placeholder={referenceT("Both")} options={[{ value: 'IN', label: 'Inbound' }, { value: 'OUT', label: 'Outbound' }]} /></FilterItem>
          <FilterItem label={referenceT("Status")}><Select className="w-32" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['PROCESSED', 'ERROR', 'REJECTED', 'QUEUED', 'SENT', 'DELIVERED', 'ACKED', 'NACKED', 'FAILED']} /></FilterItem>
          <FilterItem label={referenceT("Protocol")}><Select className="w-28" value={f.protocol} onChange={(protocol) => set({ protocol })} placeholder={referenceT("Any")} options={[{ value: 'HL7V2', label: 'HL7 v2' }, { value: 'ASTM', label: 'ASTM' }, { value: 'FHIR_R4', label: 'FHIR R4' }, { value: 'JSON', label: 'JSON' }]} /></FilterItem>
          <FilterItem label={referenceT("Interface")}><RefSelect entity="interfaces" className="w-48" value={f.interfaceId} onChange={(interfaceId) => set({ interfaceId })} params={{ all: 1 }} /></FilterItem>
          <FilterItem label={referenceT("From")}><DiagnosticDateInput  className="input w-36" value={f.from} onChange={(e) => set({ from: e.target.value })} /></FilterItem>
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })} dense
          onRowClick={(r: any) => open(r.id)} empty="No messages yet. Send one from the interface console." columns={[
            { key: 'id', header: '#', className: 'tnum text-ink-soft' },
            { key: 'direction', header: '', render: (r: any) => r.direction === 'IN' ? <ArrowDownLeft className="h-4 w-4 text-hema-500" aria-label={referenceT("Inbound")} /> : <ArrowUpRight className="h-4 w-4 text-eosin-500" aria-label={referenceT("Outbound")} /> },
            { key: 'created_at', header: 'Time', render: (r: any) => fmtDateTime(r.created_at) },
            { key: 'who', header: 'Interface', render: (r: any) => r.interface || r.facility || <span className="text-ink-faint"><ReferenceText message="unidentified" /></span> },
            { key: 'type', header: 'Type', render: (r: any) => <span className="text-xs">{r.protocol} {r.message_type}</span> },
            { key: 'transport', header: 'Via', className: 'text-xs text-ink-soft', render: (r: any) => titleCase(r.transport) },
            { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
            { key: 'preview', header: 'Content / error', render: (r: any) => <span className={`block max-w-[420px] truncate text-xs ${r.error ? 'text-crit' : 'font-mono text-ink-soft'}`}>{r.error || r.preview}</span> },
          ]} />
      </div>
      <Modal open={!!msg} onClose={() => setMsg(null)} title={msg ? `Message #${msg.id}` : ''} width="max-w-4xl"
        footer={msg && <Button icon={<RotateCcw className="h-4 w-4" />} loading={busy} onClick={async () => {
          setBusy(true);
          try { const r = await post(`/integration/messages/${msg.id}/reprocess`); setMsg(r); toast[r.status === 'ERROR' ? 'error' : 'ok'](r.status === 'ERROR' ? `Still failing: ${r.error}` : msg.direction === 'IN' ? 'Reprocessed successfully.' : 'Queued for sending again.'); reload(); }
          catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
        }}>{msg.direction === 'IN' ? 'Reprocess' : 'Queue again'}</Button>}>
        {msg && <>
          <DL cols={4} items={[['Direction', msg.direction === 'IN' ? 'Inbound' : 'Outbound'], ['Interface', msg.interface_name || msg.facility], ['Protocol', msg.protocol], ['Type', msg.message_type],
            ['Control ID', msg.control_id], ['Transport', titleCase(msg.transport)], ['Remote', msg.remote], ['Status', <StatusBadge key="s" status={msg.status} />],
            ['Received / created', fmtDateTime(msg.created_at)], ['Processed', fmtDateTime(msg.processed_at)], ['Linked to', msg.ref_type ? `${titleCase(msg.ref_type)} ${msg.ref_id}` : null]]} />
          {msg.error && <p className="mt-3 rounded-md bg-crit-bg px-3 py-2 text-sm text-crit">{msg.error}</p>}
          <Tabs className="mt-3" value={tab} onChange={setTab} tabs={[{ value: 'raw', label: 'Message' }, { value: 'response', label: msg.direction === 'IN' ? 'Our reply' : 'Their response' }]} />
          <MessageView className="mt-2" raw={tab === 'raw' ? msg.raw : msg.response} />
        </>}
      </Modal>
    </>
  );
}
