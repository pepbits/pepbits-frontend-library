'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { Pencil, Plus, Images, FileText } from 'lucide-react';
import { useApi, useFmt } from '../../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, Empty } from '../../../../components/ui';
import PatientForm from '../../../../components/PatientForm';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function PatientDetail({ params }: { params: { id: string } }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const { data: p, reload } = useApi<any>(`/api/patients/${params.id}`);
  const [edit, setEdit] = useState(false);
  if (!p) return null;
  const allergy = p.allergies && !/^none/i.test(p.allergies);

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-1 text-sm"><Link href="/patients" className="text-petrol hover:underline"><ReferenceText message="Patients" /></Link></div>
      <PageHeader title={referenceT("{value0}, {value1}", {value0: p.last_name.toUpperCase(), value1: p.first_name})}
        subtitle={<span><span className="id">{p.mrn}</span> · {fmt.date(p.dob)} ({fmt.age(p.dob)}) · {({ M: 'Male', F: 'Female', O: 'Other' } as any)[p.sex] || 'Unknown'}</span>}
        actions={<>
          <DiagnosticButton className="btn-secondary" onClick={() => setEdit(true)}><Pencil size={15} /><ReferenceText message="Edit" /></DiagnosticButton>
          <Link href={`/orders?new=1&patient=${p.id}`} className="btn-primary"><Plus size={16} /><ReferenceText message="New order" /></Link>
        </>} />

      {allergy && <div className="mb-4 rounded-md border border-stat/40 bg-stat-bg px-4 py-2.5 text-sm"><b className="text-stat"><ReferenceText message="Allergy:" /></b> {p.allergies}</div>}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="panel p-4">
          <h2 className="mb-3 font-bold"><ReferenceText message="Demographics" /></h2>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt className="text-ink-soft"><ReferenceText message="Phone" /></dt><dd>{p.phone || '—'}</dd>
            <dt className="text-ink-soft"><ReferenceText message="Email" /></dt><dd className="break-all">{p.email || '—'}</dd>
            <dt className="text-ink-soft"><ReferenceText message="Address" /></dt><dd>{p.address || '—'}</dd>
            <dt className="text-ink-soft"><ReferenceText message="Payer" /></dt><dd>{p.insurance || 'Self pay'}</dd>
            <dt className="text-ink-soft"><ReferenceText message="External ID" /></dt><dd className="id">{p.external_id || '—'}</dd>
            <dt className="text-ink-soft"><ReferenceText message="Registered" /></dt><dd>{fmt.date(p.created_at)}</dd>
          </dl>
        </section>

        <section className="panel lg:col-span-2">
          <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Imaging history" /></h2></div>
          {!p.orders.length && <Empty title={referenceT("No exams yet")}><ReferenceText message="Create an order to book this patient." /></Empty>}
          <ol className="relative">
            {p.orders.map((o: any) => (
              <li key={o.id} className="flex gap-4 border-b border-line/70 px-4 py-3 last:border-0">
                <div className="w-24 shrink-0 text-sm">
                  <div className="font-bold">{fmt.date(o.scheduled_at || o.ordered_at)}</div>
                  <div className="id text-ink-soft">{o.accession}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ModalityChip code={o.modality_code} />
                    <Link href={`/orders/${o.id}`} className="font-bold hover:underline">{o.procedure_name}</Link>
                    <StatusBadge status={o.status} />
                    {o.priority !== 'ROUTINE' && <PriorityBadge priority={o.priority} />}
                    {o.report_critical ? <span className="rounded bg-crit-bg px-1.5 py-0.5 text-xs font-bold text-crit"><ReferenceText message="Critical" /></span> : null}
                  </div>
                  <div className="mt-1 text-sm text-ink-soft">{o.referrer_name ? `Referred by ${o.referrer_name}` : 'No referrer'}{o.radiologist_name ? ` · Reported by ${o.radiologist_name}` : ''}</div>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  {o.study_id && <Link href={`/viewer/${o.study_id}`} className="btn-ghost btn-sm" title={referenceT("Open images")}><Images size={15} />{o.image_count}</Link>}
                  {['PRELIMINARY', 'FINAL'].includes(o.status) && <Link href={`/print/report/${o.id}`} target="_blank" className="btn-ghost btn-sm" title={referenceT("Report")}><FileText size={15} /><ReferenceText message="Report" /></Link>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {edit && <PatientForm open patient={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
    </div>
  );
}
