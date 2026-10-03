'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useFilters, useList } from '../../../lib/hooks';
import {age,fullName} from '../../../lib/format';
import { Button, ErrorBanner, PageHeader } from '../../../components/ui';
import { FilterBar, PagedTable, SearchBox } from '../../../components/table';
import { PatientFormModal } from '../../../components/patient';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function PatientsPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDate,fmtDateTime}=useDiagnosticFormat();

  const router = useRouter();
  const [f, set] = useFilters({ q: '', pageSize: 25 });
  const { data, loading, error, reload } = useList('/patients', f);
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader title={referenceT("Patients")} subtitle={referenceT("Search by name, MRN, phone, national ID or a client hospital's patient number.")}
        actions={<Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}><ReferenceText message="Register patient" /></Button>} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar><SearchBox className="w-80" autoFocus value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Name, MRN, phone or ID")} /></FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          onRowClick={(r: any) => router.push(`/patients/${r.id}`)} empty="No patients match this search"
          columns={[
            { key: 'mrn', header: 'MRN', className: 'tnum font-medium' },
            { key: 'name', header: 'Name', render: (r: any) => fullName(r) },
            { key: 'age', header: 'Age / sex', render: (r: any) => [age(r.dob), r.gender].filter(Boolean).join(' ') },
            { key: 'dob', header: 'Born', render: (r: any) => fmtDate(r.dob) },
            { key: 'phone', header: 'Phone' },
            { key: 'source_facility', header: 'Referred from', render: (r: any) => r.source_facility || <span className="text-ink-faint"><ReferenceText message="Walk-in" /></span> },
            { key: 'order_count', header: 'Orders', align: 'right' },
            { key: 'created_at', header: 'Registered', render: (r: any) => fmtDateTime(r.created_at) },
          ]} />
      </div>
      <PatientFormModal open={open} onClose={() => setOpen(false)} onSaved={(p) => router.push(`/patients/${p.id}`)} />
    </>
  );
}
