'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, Empty } from '../../../components/ui';
import PatientForm from '../../../components/PatientForm';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function Patients() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data, loading } = useApi<any[]>(`/api/patients?q=${encodeURIComponent(q)}`);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Patients")} subtitle={referenceT("Register patients, check demographics and see their imaging history.")}
        actions={<DiagnosticButton className="btn-primary" onClick={() => setOpen(true)}><UserPlus size={16} /><ReferenceText message="Register patient" /></DiagnosticButton>} />
      <div className="panel">
        <div className="border-b border-line p-3">
          <div className="relative max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" />
            <DiagnosticInput className="field pl-9" placeholder={referenceT("Name, MRN or phone")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search patients")} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="MRN" /></TableHead><TableHead><ReferenceText message="Date of birth" /></TableHead><TableHead><ReferenceText message="Phone" /></TableHead><TableHead><ReferenceText message="Payer" /></TableHead><TableHead><ReferenceText message="Allergies" /></TableHead><TableHead className="text-right"><ReferenceText message="Exams" /></TableHead><TableHead><ReferenceText message="Last visit" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/patients/${p.id}`)}>
                  <TableCell><Link href={`/patients/${p.id}`} className="font-bold hover:underline">{fmt.name(p)}</Link></TableCell>
                  <TableCell className="id">{p.mrn}</TableCell>
                  <TableCell>{fmt.date(p.dob)} <span className="text-ink-soft">· {fmt.age(p.dob)} {p.sex}</span></TableCell>
                  <TableCell className="text-ink-3">{p.phone || '—'}</TableCell>
                  <TableCell className="text-ink-3">{p.insurance || 'Self pay'}</TableCell>
                  <TableCell>{p.allergies && !/^none/i.test(p.allergies) ? <span className="font-bold text-stat">{p.allergies}</span> : <span className="text-ink-soft"><ReferenceText message="None known" /></span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.order_count}</TableCell>
                  <TableCell className="text-ink-3">{fmt.date(p.last_visit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
          {!loading && !data?.length && <Empty title={q ? `No patient matches “${q}”` : 'No patients registered yet'}><ReferenceText message="Register the patient to start an order." /></Empty>}
        </div>
      </div>
      <PatientForm open={open} onClose={() => setOpen(false)} onSaved={(p) => { setOpen(false); router.push(`/patients/${p.id}`); }} />
    </div>
  );
}
