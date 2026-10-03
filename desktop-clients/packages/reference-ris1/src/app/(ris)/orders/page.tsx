'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { Suspense, useEffect, useState } from 'react';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Plus, Search } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, Empty } from '../../../components/ui';
import NewOrder from '../../../components/NewOrder';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STATUSES = ['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'PRELIMINARY', 'FINAL', 'CANCELLED'];
const SOURCE: Record<string, string> = { RIS: 'RIS', HL7: 'HL7 inbound', FHIR: 'FHIR inbound' };

function Orders() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const sp = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState(sp.get('status') || '');
  const [priority, setPriority] = useState(sp.get('priority') || '');
  const [modality, setModality] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const { data: lk } = useApi<any>('/api/lookups');
  const params = new URLSearchParams({ ...(status && { status }), ...(priority && { priority }), ...(modality && { modality }), ...(q && { q }) });
  const { data, loading, reload } = useApi<any[]>(`/api/orders?${params}`, { poll: 20000 });

  useEffect(() => { if (sp.get('new')) setOpen(true); }, [sp]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title={referenceT("Orders")} subtitle={referenceT("Every request placed in the RIS or received from HIS and EMR interfaces, with its accession number.")}
        actions={<DiagnosticButton className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /><ReferenceText message="New order" /></DiagnosticButton>} />
      <div className="panel">
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" />
            <DiagnosticInput className="field pl-9" placeholder={referenceT("Accession, MRN, name, exam")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search orders")} />
          </div>
          <DiagnosticSelect className="field w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={referenceT("Status")}>
            <option value=""><ReferenceText message="All statuses" /></option>
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'COMPLETED' ? 'Awaiting read' : fmt.status(s)}</option>)}
          </DiagnosticSelect>
          <DiagnosticSelect className="field w-36" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label={referenceT("Priority")}>
            <option value=""><ReferenceText message="Any priority" /></option><option value="STAT"><ReferenceText message="STAT" /></option><option value="URGENT"><ReferenceText message="Urgent" /></option><option value="ROUTINE"><ReferenceText message="Routine" /></option>
          </DiagnosticSelect>
          <DiagnosticSelect className="field w-40" value={modality} onChange={(e) => setModality(e.target.value)} aria-label={referenceT("Modality")}>
            <option value=""><ReferenceText message="All modalities" /></option>
            {(lk?.modalities || []).map((m: any) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
          </DiagnosticSelect>
          <span className="ml-auto text-sm text-ink-soft">{data?.length ?? 0} <ReferenceText message="orders" /></span>
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Accession" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Exam" /></TableHead><TableHead><ReferenceText message="Priority" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Referrer" /></TableHead><TableHead><ReferenceText message="Source" /></TableHead><TableHead><ReferenceText message="Ordered" /></TableHead><TableHead><ReferenceText message="Billing" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                  <TableCell><Link href={`/orders/${o.id}`} className="id font-medium text-petrol hover:underline">{o.accession}</Link></TableCell>
                  <TableCell><div className="font-bold">{fmt.name(o)}</div><div className="id text-ink-soft">{o.mrn}</div></TableCell>
                  <TableCell><div className="flex items-center gap-2"><ModalityChip code={o.modality_code} /><span>{o.procedure_name}</span></div></TableCell>
                  <TableCell><PriorityBadge priority={o.priority} /></TableCell>
                  <TableCell><StatusBadge status={o.status} />{o.report_critical ? <span className="ml-1 rounded bg-crit-bg px-1.5 py-0.5 text-xs font-bold text-crit"><ReferenceText message="Critical" /></span> : null}</TableCell>
                  <TableCell className="text-ink-3">{o.referrer_name || '—'}</TableCell>
                  <TableCell className="text-xs text-ink-soft">{SOURCE[o.source] || o.source}{o.source_system ? ` · ${o.source_system}` : ''}</TableCell>
                  <TableCell className="whitespace-nowrap text-ink-3">{fmt.dateTime(o.ordered_at)}</TableCell>
                  <TableCell>{o.billing_status && <StatusBadge status={o.billing_status} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
          {!loading && !data?.length && <Empty title={referenceT("No orders match these filters")} />}
        </div>
      </div>
      <NewOrder open={open} patientId={sp.get('patient') ? Number(sp.get('patient')) : undefined}
        onClose={() => { setOpen(false); if (sp.get('new')) router.replace('/orders'); }}
        onCreated={(orders) => { setOpen(false); reload(); if (orders.length === 1) router.push(`/orders/${orders[0].id}`); else router.replace('/orders'); }} />
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense><Orders /></Suspense>;
}
