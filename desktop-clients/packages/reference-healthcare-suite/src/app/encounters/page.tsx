'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import { AlertCircle, ChevronLeft, ChevronRight, Plus, RefreshCw, Stethoscope } from 'lucide-react';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { Button, FilterChips, Input, SearchInput, Segmented, Select , DateInput} from '../../components/ui/controls';
import { Column, DataTable, Pagination } from '../../components/ui/DataTable';
import { Badge, EmptyState, ErrorBanner, StatusBadge } from '../../components/ui/display';
import { qs } from '../../lib/api';
import { addDays, todayIso, useFormat } from '../../lib/format';
import { useApi, useDebounced, useInterval } from '../../lib/hooks';
import { usePageHeader } from '../../lib/session';
import { Page, Row } from '../../lib/types';

export default function EncountersPage() {
 const {t:healthcareT}=useHealthcareLocalization();
  const {preferences} = useReferenceHost();
  const { fmtTime } = useFormat();
  usePageHeader(healthcareT("Encounters"), healthcareT("Registered visits, orders in progress and what is left to bill"));
  const router = useReferenceRouter();
  const [date, setDate] = useState(todayIso());
  const [status, setStatus] = useState('All');
  const [type, setType] = useState('All');
  const [pay, setPay] = useState<'All' | 'Insurance' | 'Cash'>('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(search, 250);
  useEffect(() => setPage(1), [date, status, type, pay, dq]);
  const { data, loading, error, reload } = useApi<Page>(`/encounters${qs({ date, status, encounterType: type, paymentClass: pay, search: dq, page, pageSize: preferences.pageSize })}`);
  useInterval(reload, 20000);

  const columns: Column<Row>[] = [
    { key: 'encNo', header: 'Encounter', width: '110px', render: (e) => <span className="font-mono text-hc-xs">{e.encNo}</span> },
    { key: 'createdAt', header: 'Time', width: '64px', render: (e) => <span className="hc-num">{fmtTime(e.createdAt)}</span> },
    { key: 'patient', header: 'Patient', render: (e) => <span><span className="font-medium">{e.patientName}</span> <span className="font-mono text-hc-2xs text-hc-ink-mute">{e.mrn}</span></span> },
    { key: 'encounterType', header: 'Type', render: (e) => <span className="text-hc-xs">{e.encounterType} · {e.visitType}</span> },
    { key: 'providerName', header: 'Provider', render: (e) => <span className="text-hc-xs">{e.providerName || 'Pharmacy counter'}<span className="block text-hc-2xs text-hc-ink-mute">{e.departmentName}</span></span> },
    { key: 'payer', header: 'Payment', render: (e) => e.paymentClass === 'Insurance' ? <Badge tone="petrol">{e.payerName}</Badge> : <Badge tone="selfpay"><LocalizedText message="Self-pay" /></Badge> },
    { key: 'eligibilityStatus', header: 'Eligibility', render: (e) => e.paymentClass === 'Insurance' ? <StatusBadge status={e.eligibilityStatus} /> : <span className="text-hc-2xs text-hc-ink-faint"><LocalizedText message="n/a" /></span> },
    { key: 'lines', header: 'Orders', align: 'right', render: (e) => <span className="hc-num text-hc-xs">{e.lineCount}{e.unbilled ? <span className="text-hc-warn-700"> · {e.unbilled} <LocalizedText message="unbilled" /></span> : ''}</span> },
    { key: 'pendingApprovals', header: 'Approvals', render: (e) => e.pendingApprovals ? <Badge tone="warn" dot>{e.pendingApprovals} <LocalizedText message="pending" /></Badge> : null },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ];

  return (
    <div className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} />
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} className="!h-7 w-[140px] text-hc-xs" aria-label="Date" />
          <Button size="sm" variant="ghost" icon={<ChevronRight className="h-4 w-4" />} aria-label="Next day" onClick={() => setDate(addDays(date, 1))} />
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Encounter, patient, MRN, provider" className="w-64" />
        <FilterChips value={status} onChange={setStatus} options={['All', 'Registered', 'In Consultation', 'Completed', 'Cancelled'].map((s) => ({ value: s, label: s === 'All' ? 'All statuses' : s }))} />
        <Segmented size="sm" value={pay} onChange={setPay} options={[{ value: 'All', label: 'All' }, { value: 'Insurance', label: 'Insured' }, { value: 'Cash', label: 'Self-pay' }]} />
        <Select aria-label="Encounter type" value={type} onChange={setType} className="w-36" options={['All','Outpatient','Walk-in','Emergency','Pharmacy'].map(value=>({value,label:value==='All'?'All types':value}))}/>

        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload} aria-label="Refresh" />
          <Button mutation size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => router.push('/encounters/new')}><LocalizedText message="New encounter" /></Button>
        </div>
      </div>
      {error && <div className="p-3"><ErrorBanner message={error.message} onRetry={reload} /></div>}
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(e) => e.id}
        loading={loading && !data}
        onRowClick={(e) => router.push(`/encounters/${e.id}`)}
        rowClassName={(e) => (e.status === 'Cancelled' ? 'text-hc-ink-mute line-through decoration-hc-ink-faint/50' : undefined)}
        empty={<EmptyState icon={<Stethoscope className="h-8 w-8" />} title="No encounters for this day" body="Check in an appointment or start a walk-in encounter." action={<Button mutation size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => router.push('/encounters/new')}><LocalizedText message="New encounter" /></Button>} />}
      />
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      {data && data.data.some((e) => e.pendingApprovals) && (
        <div className="flex items-center gap-2 border-t border-hc-line bg-hc-warn-50 px-3 py-1.5 text-hc-xs text-hc-warn-700"><AlertCircle className="h-3.5 w-3.5" /><LocalizedText message="Some encounters are waiting on payer approvals. The list refreshes automatically." /></div>
      )}
    </div>
  );
}
