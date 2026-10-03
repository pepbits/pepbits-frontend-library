'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { Pencil, Plus, Search } from 'lucide-react';
import { useApi, useDebounced } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';

import { Badge, Button, Card, Empty, ErrorNote, Input, Loading, Modal, PageHeader } from '../../../components/ui';
import { PatientForm } from './PatientForm';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export default function PatientsPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDate}=useDiagnosticFormat();

  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi<any[]>('/patients', { q: dq });
  const [edit, setEdit] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const router = useRouter();
  const { can } = useAuth();

  const open = async (id: number) => setView(await api.get(`/patients/${id}`));

  return (
    <div>
      <PageHeader title={referenceT("Patients")} subtitle={referenceT("Register patients and see their order history")}
        actions={can('RECEPTION', 'PHLEBOTOMIST') && <Button variant="primary" icon={Plus} onClick={() => setEdit({})}><ReferenceText message="Register patient" /></Button>} />
      <ErrorNote error={error} />
      <Card bodyClass="p-0">
        <div className="border-b border-line p-3">
          <div className="relative max-w-sm"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Search MRN, name, phone or national ID")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No patients found")} hint={referenceT("Register a patient to place the first order.")} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="MRN" /></TableHead><TableHead><ReferenceText message="Name" /></TableHead><TableHead><ReferenceText message="Sex / age" /></TableHead><TableHead><ReferenceText message="Date of birth" /></TableHead><TableHead><ReferenceText message="Phone" /></TableHead><TableHead><ReferenceText message="Source" /></TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => open(p.id)}>
                  <TableCell className="font-mono text-xs">{p.mrn}</TableCell>
                  <TableCell className="font-medium">{p.fullName}{p.isPregnant && <Badge value="PREG" label={referenceT("Pregnant")} className="ml-2" />}</TableCell>
                  <TableCell>{p.gender} · {p.age}</TableCell>
                  <TableCell>{fmtDate(p.dob)}</TableCell>
                  <TableCell>{p.phone || '—'}</TableCell>
                  <TableCell>{p.externalPatientId ? <Badge value="EXTERNAL" label={referenceT("External {value0}", {value0: p.externalPatientId})} /> : <span className="text-ink-mute"><ReferenceText message="Walk-in" /></span>}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {can('RECEPTION') && <Button size="sm" variant="primary" icon={Plus} onClick={() => router.push(`/orders/new?patientId=${p.id}`)}><ReferenceText message="Order" /></Button>}
                      {can('RECEPTION', 'PHLEBOTOMIST') && <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(p)}><ReferenceText message="Edit" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
        )}
      </Card>
      <PatientForm open={!!edit} patient={edit} onClose={() => setEdit(null)} onSaved={() => reload()} />
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.fullName} · ${view.mrn}` : ''} width="max-w-3xl">
        {view && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="label"><ReferenceText message="Sex / age" /></div>{view.gender} · {view.age}</div>
              <div><div className="label"><ReferenceText message="Date of birth" /></div>{fmtDate(view.dob)}</div>
              <div><div className="label"><ReferenceText message="Ethnicity" /></div>{view.ethnicity || '—'}</div>
              <div><div className="label"><ReferenceText message="Phone" /></div>{view.phone || '—'}</div>
              <div><div className="label"><ReferenceText message="Email" /></div>{view.email || '—'}</div>
              <div><div className="label"><ReferenceText message="National ID" /></div>{view.nationalId || '—'}</div>
            </div>
            <div className="text-sm font-semibold"><ReferenceText message="Orders" /></div>
            {!view.orders?.length ? <div className="text-sm text-ink-mute"><ReferenceText message="No orders yet." /></div> : (
              <DiagnosticTable className="tbl card">
                <TableHeader><TableRow><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Date" /></TableHead><TableHead><ReferenceText message="Priority" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
                <TableBody>{view.orders.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                    <TableCell className="font-mono text-xs">{o.orderNo}</TableCell><TableCell>{fmtDate(o.createdAt)}</TableCell><TableCell><Badge value={o.priority} /></TableCell><TableCell><Badge value={o.status} /></TableCell>
                  </TableRow>
                ))}</TableBody>
              </DiagnosticTable>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
