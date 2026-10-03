'use client';
import {DiagnosticInput,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { useState } from 'react';
import { FileText, Images } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, TatClock, Empty, Tabs, useSession } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Tab = 'unread' | 'prelim' | 'signed';

export default function Reading() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const router = useRouter();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('unread');
  const [mod, setMod] = useState('');
  const [mine, setMine] = useState(false);
  const { data: lk } = useApi<any>('/api/lookups');
  const { data } = useApi<any[]>(`/api/orders?view=reading${mod ? `&modality=${mod}` : ''}${mine ? '&mine=1' : ''}`, { poll: 15000 });
  const all = data || [];
  const sets: Record<Tab, any[]> = {
    unread: all.filter((o) => o.status === 'COMPLETED'),
    prelim: all.filter((o) => o.status === 'PRELIMINARY'),
    signed: all.filter((o) => o.status === 'FINAL').sort((a, b) => b.final_at.localeCompare(a.final_at)),
  };
  const rows = sets[tab];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title={referenceT("Reading worklist")} subtitle={referenceT("Sorted by priority, then by how long the exam has waited. The clock shows time left against the turnaround target.")}
        actions={rows[0] && tab !== 'signed' ? <Link href={`/reading/${rows[0].id}`} className="btn-primary"><FileText size={16} /><ReferenceText message="Read next case" /></Link> : null} />
      <div className="panel">
        <div className="flex flex-wrap items-end gap-3 px-3 pt-2">
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'unread', label: <><ReferenceText message="To read" /> <span className="ml-1 rounded bg-urgent-bg px-1.5 text-urgent">{sets.unread.length}</span></> },
            { value: 'prelim', label: <><ReferenceText message="Preliminary, to verify" /> <span className="ml-1 rounded bg-paper px-1.5">{sets.prelim.length}</span></> },
            { value: 'signed', label: 'Signed in last 24 hours' },
          ]} />
          <div className="mb-2 ml-auto flex items-center gap-2">
            {['RADIOLOGIST', 'RESIDENT'].includes(user?.role || '') && (
              <label className="flex items-center gap-1.5 text-sm"><DiagnosticInput type="checkbox" className="accent-petrol" checked={mine} onChange={(e) => setMine(e.target.checked)} /><ReferenceText message="Mine and unassigned" /></label>
            )}
            <DiagnosticSelect className="field h-8 w-40" value={mod} onChange={(e) => setMod(e.target.value)} aria-label={referenceT("Modality")}>
              <option value=""><ReferenceText message="All modalities" /></option>
              {(lk?.modalities || []).map((m: any) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
            </DiagnosticSelect>
          </div>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Priority" /></TableHead><TableHead>{tab === 'signed' ? 'Final TAT' : 'Turnaround'}</TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Exam" /></TableHead><TableHead><ReferenceText message="Clinical question" /></TableHead><TableHead><ReferenceText message="Images" /></TableHead><TableHead><ReferenceText message="Radiologist" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((o) => (
                <TableRow key={o.id} className={`cursor-pointer ${o.priority === 'STAT' && tab !== 'signed' ? 'bg-stat-bg/40' : ''}`} onClick={() => router.push(`/reading/${o.id}`)}>
                  <TableCell><PriorityBadge priority={o.priority} /><div className="mt-0.5 text-xs text-ink-soft">{o.patient_class}</div></TableCell>
                  <TableCell><TatClock tat={o.tat} /></TableCell>
                  <TableCell><Link href={`/reading/${o.id}`} className="font-bold hover:underline">{fmt.name(o)}</Link><div className="text-xs text-ink-soft"><span className="id">{o.accession}</span> · {fmt.age(o.dob)} {o.sex}</div></TableCell>
                  <TableCell><div className="flex items-center gap-2"><ModalityChip code={o.modality_code} /><span>{o.procedure_name}</span></div><div className="mt-0.5 text-xs text-ink-soft"><ReferenceText message="done" /> {fmt.dateTime(o.exam_completed_at)}</div></TableCell>
                  <TableCell className="max-w-xs"><span className="line-clamp-2 text-sm text-ink-3">{o.clinical_history || o.reason || '—'}</span></TableCell>
                  <TableCell>{o.study_id ? <span className="inline-flex items-center gap-1 text-sm"><Images size={14} className="text-ink-soft" />{o.image_count}</span> : <span className="text-xs text-stat"><ReferenceText message="None" /></span>}</TableCell>
                  <TableCell className="text-sm text-ink-3">{o.radiologist_name || <span className="text-ink-soft"><ReferenceText message="Unassigned" /></span>}</TableCell>
                  <TableCell><StatusBadge status={o.report_status === 'DRAFT' && o.status === 'COMPLETED' ? 'DRAFT' : o.status} label={o.report_status === 'DRAFT' && o.status === 'COMPLETED' ? 'Draft saved' : undefined} />
                    {o.report_critical ? <span className="ml-1 rounded bg-crit-bg px-1.5 py-0.5 text-xs font-bold text-crit"><ReferenceText message="Critical" /></span> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
          {data && !rows.length && <Empty title={tab === 'unread' ? 'The worklist is clear' : tab === 'prelim' ? 'No preliminary reports waiting for verification' : 'Nothing signed in the last 24 hours'} />}
        </div>
      </div>
    </div>
  );
}
