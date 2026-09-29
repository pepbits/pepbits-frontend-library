'use client';
import {useCsvExport} from '../../lib/export';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {Drawer,Modal,CenterRecordCard} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import { CalendarPlus, Download, Stethoscope, UserPlus, Users } from 'lucide-react';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useEffect, useState } from 'react';

import { PatientPreview } from '../../components/patients/PatientPreview';
import { prefillFromQuery, QuickRegister } from '../../components/patients/QuickRegister';
import { Button, SearchInput, Segmented } from '../../components/ui/controls';
import { Column, DataTable, Pagination } from '../../components/ui/DataTable';
import { Badge, EmptyState, ErrorBanner } from '../../components/ui/display';
import { useApiClient, qs } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useApi, useDebounced } from '../../lib/hooks';
import { usePageHeader } from '../../lib/session';
import { Page, PatientSummary } from '../../lib/types';

export default function PatientsPage() {
 const exporter=useCsvExport();
 const {downloadCsv}=exporter;
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  const { fmtDate } = useFormat();
  usePageHeader(healthcareT("Patients"), healthcareT("Find a patient, then start an encounter or book an appointment"));
  const router = useReferenceRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'All'>('Active');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'mrn', dir: 'desc' });
  const [page, setPage] = useState(1);
  const {preferences} = useReferenceHost();
  const pageSize = preferences.pageSize;
  const setPageSize = () => {};
  const [selected, setSelected] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const q = useDebounced(search, 250);
  useEffect(() => setPage(1), [q, status, pageSize]);
  const params = { search: q, status, sort: sort.key, dir: sort.dir, page, pageSize };
  const { data, loading, error, reload } = useApi<Page<PatientSummary>>(`/patients${qs(params)}`);
  useEffect(() => { if (preferences.previewMode==='inline' && !selected && data?.data[0]) setSelected(data.data[0].id); }, [data, selected,preferences.previewMode]);

  const columns: Column<PatientSummary>[] = [
    { key: 'mrn', header: 'MRN', width: '110px', sortable: true, render: (p) => <span className="font-mono text-hc-xs text-hc-ink-soft">{p.mrn}</span> },
    { key: 'fullName', header: 'Patient', sortable: true, render: (p) => <span className="font-medium">{p.fullName}</span> },
    { key: 'age', header: 'Age / sex', width: '90px', render: (p) => <span className="hc-num">{p.age}<LocalizedText message="y" /> {p.gender?.[0]}</span> },
    { key: 'phone', header: 'Mobile', render: (p) => <span className="hc-num whitespace-nowrap">{p.phone}</span> },
    { key: 'nationalId', header: 'National ID', render: (p) => <span className="font-mono text-hc-xs text-hc-ink-soft">{p.nationalId}</span> },
    { key: 'insuranceLabel', header: 'Coverage', render: (p) => <Badge tone={p.primaryPolicy ? 'petrol' : 'selfpay'}>{p.insuranceLabel}</Badge> },
    { key: 'lastVisit', header: 'Last visit', render: (p) => <span className="hc-num text-hc-xs text-hc-ink-mute">{p.lastVisit ? fmtDate(p.lastVisit) : <LocalizedText message="Never"/>}</span> },
  ];

  const exportCsv = async () => {
    if(exporter.disabled)return;
    const all = await api<Page<PatientSummary>>(`/patients${qs({ ...params, page: 1, pageSize: 1000 })}`);
    downloadCsv('patients.csv', ['MRN', 'First name', 'Last name', 'Gender', 'DOB', 'Mobile', 'National ID', 'Coverage'], all.data.map((p) => [p.mrn, p.firstName, p.lastName, p.gender, p.dob, p.phone, p.nationalId, p.insuranceLabel]));
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="hc-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
          <SearchInput value={search} onChange={setSearch} autoFocus placeholder="MRN, name, mobile, national ID or email" className="w-80" />
          <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }, { value: 'All', label: 'All' }]} />
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled={exporter.disabled} title={exporter.reason} onClick={exportCsv}><LocalizedText message="Export" /></Button>
            <Button mutation size="sm" variant="secondary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setRegistering(true)}><LocalizedText message="Quick register" /></Button>
            <Button mutation size="sm" variant="primary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => router.push('/patients/new')}><LocalizedText message="New patient" /></Button>
          </div>
        </div>
        {error && <div className="p-3"><ErrorBanner message={error.message} onRetry={reload} /></div>}
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(p) => p.id}
          loading={loading}
          selectedKey={selected}
          onRowClick={(p) => setSelected(p.id)}
          sort={sort}
          onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
          rowActions={(p) => (
            <>
              <Button size="xs" variant="ghost" title="Create encounter" aria-label="Create encounter" icon={<Stethoscope className="h-3.5 w-3.5" />} onClick={() => router.push(`/encounters/new?patientId=${p.id}`)} />
              <Button size="xs" variant="ghost" title="Book appointment" aria-label="Book appointment" icon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => router.push(`/appointments?patientId=${p.id}`)} />
            </>
          )}
          empty={<EmptyState icon={<Users className="h-8 w-8" />} title="No patients found" body="Check the spelling or search by mobile number. New walk-ins can be registered in seconds." action={<Button mutation size="sm" variant="primary" onClick={() => setRegistering(true)}><LocalizedText message="Register" /> {search || 'patient'}</Button>} />}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} onPageSize={setPageSize} />}
      </div>
      {preferences.previewMode==='inline' && <aside className="hc-panel hidden w-[400px] shrink-0 flex-col overflow-hidden lg:flex">
        {selected ? <PatientPreview key={selected} id={selected} /> : <EmptyState title="Select a patient" body="Their coverage, bookings and visits appear here." />}
      </aside>}
      {selected && preferences.previewMode==='center-modal' && <Modal open onClose={()=>setSelected(null)} title="Patient" size="md"><PatientPreview key={selected} id={selected}/></Modal>}
      {selected && preferences.previewMode==='center-card' && <CenterRecordCard open onClose={()=>setSelected(null)} title="Patient"><PatientPreview key={selected} id={selected}/></CenterRecordCard>}
      {selected && ['left-drawer','right-drawer'].includes(preferences.previewMode) && <Drawer open onClose={()=>setSelected(null)} title="Patient" side={preferences.previewMode==='left-drawer'?'left':'right'}><PatientPreview key={selected} id={selected}/></Drawer>}
      <QuickRegister
        open={registering}
        onClose={() => setRegistering(false)}
        initial={prefillFromQuery(search)}
        onCreated={(p) => { setRegistering(false); setSearch(p.mrn); setSelected(p.id); reload(); }}
      />
    </div>
  );
}
