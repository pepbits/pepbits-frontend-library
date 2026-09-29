'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import { BadgeCheck, Clock, RefreshCw } from 'lucide-react';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { Button, FilterChips, SearchInput, Segmented } from '../../components/ui/controls';
import { Column, DataTable, Pagination } from '../../components/ui/DataTable';
import { Badge, EmptyState, ErrorBanner, Money, StatusBadge } from '../../components/ui/display';
import { qs } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useApi, useDebounced, useInterval } from '../../lib/hooks';
import { usePageHeader } from '../../lib/session';
import { Approval, Page } from '../../lib/types';

export default function ApprovalsPage() {
 const {t:healthcareT}=useHealthcareLocalization();
  const {preferences} = useReferenceHost();
  const { sinceLabel } = useFormat();
  usePageHeader(healthcareT("Approvals & eRx"), healthcareT("Prior approval requests and electronic prescriptions sent to payers"));
  const router = useReferenceRouter();
  const [status, setStatus] = useState('All');
  const [channel, setChannel] = useState<'All' | 'PriorAuth' | 'eRx'>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(search, 250);
  useEffect(() => setPage(1), [status, channel, dq]);
  const { data, loading, error, reload } = useApi<Page<Approval>>(`/approvals${qs({ status, channel, search: dq, page, pageSize: preferences.pageSize })}`);
  const pendingOnPage = data?.data.some((a) => a.status === 'Pending') ?? false;
  useInterval(reload, pendingOnPage ? 2000 : 15000);

  const columns: Column<Approval>[] = [
    { key: 'approvalNo', header: 'Request', width: '120px', render: (a) => <span className="font-mono text-hc-xs">{a.approvalNo}</span> },
    { key: 'channel', header: 'Type', render: (a) => a.channel === 'eRx' ? <Badge tone="info"><LocalizedText message="eRx" /></Badge> : <Badge tone="warn"><LocalizedText message="Prior approval" /></Badge> },
    { key: 'submittedAt', header: 'Sent', render: (a) => <span className="hc-num whitespace-nowrap text-hc-xs text-hc-ink-mute">{sinceLabel(a.submittedAt)}</span> },
    { key: 'patientName', header: 'Patient', render: (a) => <span><span className="font-medium">{a.patientName}</span> <span className="font-mono text-hc-2xs text-hc-ink-mute">{a.mrn}</span></span> },
    { key: 'encNo', header: 'Encounter', render: (a) => <span className="font-mono text-hc-xs">{a.encNo}</span> },
    { key: 'payerName', header: 'Payer', render: (a) => <span className="text-hc-xs">{a.payerName || 'eRx hub (self-pay)'}</span> },
    { key: 'itemsLabel', header: 'Lines', render: (a) => <span className="block max-w-[240px] truncate text-hc-xs" title={a.itemsLabel}>{a.itemsLabel}</span> },
    { key: 'diagnosis', header: 'Diagnosis', render: (a) => <span className="block max-w-[180px] truncate text-hc-xs text-hc-ink-soft" title={a.diagnosis}>{a.diagnosis}</span> },
    { key: 'requestedAmount', header: 'Requested', align: 'right', render: (a) => <Money value={a.requestedAmount} /> },
    { key: 'approvedAmount', header: 'Approved', align: 'right', render: (a) => a.status === 'Approved' ? <Money value={a.approvedAmount} className="text-hc-ok-700" /> : <span className="text-hc-ink-faint">-</span> },
    { key: 'status', header: 'Status', render: (a) => <span className="flex flex-col items-start gap-0.5"><StatusBadge status={a.status} />{a.authorizationNo && <span className="font-mono text-hc-2xs text-hc-ok-700">{a.authorizationNo}</span>}{a.status === 'Rejected' && <span className="max-w-[200px] truncate text-hc-2xs text-hc-danger-700" title={a.remarks}>{a.remarks}</span>}</span> },
  ];

  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Request no, patient, MRN, item, auth no" className="w-72" />
        <FilterChips value={status} onChange={setStatus} options={['All', 'Pending', 'Approved', 'Rejected'].map((s) => ({ value: s, label: s === 'All' ? 'Any status' : s }))} />
        <Segmented size="sm" value={channel} onChange={setChannel} options={[{ value: 'All', label: 'All' }, { value: 'PriorAuth', label: 'Prior approval' }, { value: 'eRx', label: 'eRx' }]} />
        <div className="ml-auto flex items-center gap-2">
          {pendingOnPage && <span className="flex items-center gap-1 text-hc-xs text-hc-warn-700"><Clock className="h-3.5 w-3.5 animate-pulse" /><LocalizedText message="Live: waiting for payer responses" /></span>}
          <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload} aria-label="Refresh" />
        </div>
      </div>
      {error && <div className="p-3"><ErrorBanner message={error.message} onRetry={reload} /></div>}
      <DataTable columns={columns} rows={data?.data ?? []} rowKey={(a) => a.id} loading={loading && !data} onRowClick={(a) => router.push(`/encounters/${a.encounterId}`)}
        empty={<EmptyState icon={<BadgeCheck className="h-8 w-8" />} title="No requests" body="Prior approvals and eRx are sent from the encounter ordering screen." />} />
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </div>
  );
}
