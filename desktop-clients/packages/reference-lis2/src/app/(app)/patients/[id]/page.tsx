'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link,useReferenceRouter} from '@pepbits/reference-host';

import {useParams} from '@pepbits/reference-diagnostics';
import { useMemo, useState } from 'react';
import { FilePlus, Pencil } from 'lucide-react';
import { useResource } from '../../../../lib/hooks';

import { Button, DL, ErrorBanner, Loading, PageHeader, Section, StatusBadge, Tabs, flagTextClass } from '../../../../components/ui';
import { DataTable } from '../../../../components/table';
import { PatientBanner, PatientFormModal } from '../../../../components/patient';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function PatientDetail() {
 const router=useReferenceRouter();
 const referenceT = useReferenceLocalization().t;

 const {fmtDate,fmtDateTime}=useDiagnosticFormat();

  const { id } = useParams<{ id: string }>();
  const { data: p, error, reload } = useResource<any>(`/patients/${id}`);
  const { data: cum } = useResource<any[]>(`/patients/${id}/cumulative`);
  const [tab, setTab] = useState<'orders' | 'results' | 'visits'>('orders');
  const [edit, setEdit] = useState(false);

  // Cumulative report: one row per parameter, one column per signed report time.
  const grid = useMemo(() => {
    if (!cum?.length) return null;
    const times = [...new Set(cum.map((r) => r.signed_at))].sort().reverse().slice(0, 8);
    const params = new Map<string, any>();
    cum.forEach((r) => {
      const k = `${r.test}|${r.code}`;
      if (!params.has(k)) params.set(k, { test: r.test, name: r.name, unit: r.unit, cells: {} });
      params.get(k).cells[r.signed_at] = r;
    });
    return { times, rows: [...params.values()].sort((a, b) => a.test.localeCompare(b.test)) };
  }, [cum]);

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!p) return <Loading />;
  return (
    <>
      <PageHeader title={referenceT("Patient record")} actions={<>
        <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}><ReferenceText message="Edit details" /></Button>
        <Link href={`/orders/new?patientId=${p.id}`}><Button variant="primary" icon={<FilePlus className="h-4 w-4" />}><ReferenceText message="New order" /></Button></Link>
      </>} />
      <PatientBanner p={p} className="mb-4" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Section title={referenceT("Demographics")}>
            <DL cols={2} items={[['Phone', p.phone], ['Email', p.email], ['National ID', p.national_id], ['Ethnicity', p.ethnicity], ['Pregnant', p.pregnant ? 'Yes' : 'No'], ['Registered', fmtDate(p.created_at)], ['Address', p.address]]} />
          </Section>
          <Section title={referenceT("Identifiers at other facilities")} bodyClass="p-0">
            {p.identifiers.length ? (
              <ul className="divide-y divide-line text-sm">{p.identifiers.map((i: any) => <li key={i.id} className="flex justify-between px-4 py-2"><span>{i.facility || 'Internal'}</span><span className="font-medium tnum">{i.identifier}</span></li>)}</ul>
            ) : <p className="px-4 py-3 text-sm text-ink-soft"><ReferenceText message="Only known by this laboratory’s MRN." /></p>}
          </Section>
        </div>
        <div className="panel">
          <Tabs className="px-2" value={tab} onChange={setTab} tabs={[{ value: 'orders', label: 'Orders', count: p.orders.length }, { value: 'results', label: 'Cumulative results' }, { value: 'visits', label: 'Encounters', count: p.encounters.length }]} />
          {tab === 'orders' && (
            <DataTable rows={p.orders} empty="No orders for this patient yet" onRowClick={(o: any) => router.push(`/orders/${o.id}`)} columns={[
              { key: 'order_no', header: 'Order', className: 'font-medium tnum' }, { key: 'created_at', header: 'Ordered', render: (o: any) => fmtDateTime(o.created_at) },
              { key: 'tests', header: 'Tests' }, { key: 'priority', header: 'Priority' }, { key: 'source', header: 'Source' },
              { key: 'status', header: 'Status', render: (o: any) => <StatusBadge status={o.status} /> },
            ]} />
          )}
          {tab === 'results' && (grid ? (
            <div className="overflow-x-auto">
              <DiagnosticTable className="w-full text-sm">
                <TableHeader><TableRow><TableHead className="th"><ReferenceText message="Test" /></TableHead><TableHead className="th"><ReferenceText message="Parameter" /></TableHead>{grid.times.map((t) => <TableHead key={t} className="th text-right">{fmtDateTime(t)}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{grid.rows.map((r, i) => (
                  <TableRow key={i}><TableCell className="td text-ink-soft">{r.test}</TableCell><TableCell className="td">{r.name} <span className="text-2xs text-ink-faint">{r.unit}</span></TableCell>
                    {grid.times.map((t) => { const c = r.cells[t]; return <TableCell key={t} className={`td text-right tnum ${flagTextClass(c?.flag)}`}>{c ? `${c.value}${c.flag && c.flag !== 'N' ? ` ${c.flag}` : ''}` : ''}</TableCell>; })}</TableRow>
                ))}</TableBody>
              </DiagnosticTable>
            </div>
          ) : <p className="p-4 text-sm text-ink-soft"><ReferenceText message="Signed results will appear here as a cumulative table." /></p>)}
          {tab === 'visits' && (
            <DataTable rows={p.encounters} empty="No encounters" columns={[
              { key: 'encounter_no', header: 'Encounter', className: 'tnum' }, { key: 'type', header: 'Type' }, { key: 'facility', header: 'Facility', render: (e: any) => e.facility || 'This laboratory' },
              { key: 'external_encounter_no', header: 'External visit no.' }, { key: 'location', header: 'Location' }, { key: 'doctor', header: 'Doctor' },
              { key: 'created_at', header: 'Opened', render: (e: any) => fmtDateTime(e.created_at) },
            ]} />
          )}
        </div>
      </div>
      <PatientFormModal open={edit} patient={p} onClose={() => setEdit(false)} onSaved={() => reload()} />
    </>
  );
}
