'use client';
import {DiagnosticButton,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { DoorOpen, Undo2, Play, AlertTriangle, CalendarClock, Plus } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, Empty, Tabs } from '../../../components/ui';
import { useOrderAction, ScheduleModal } from '../../../components/OrderActions';
import PaymentModal from '../../../components/PaymentModal';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function Reception() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {fetch}=useDiagnosticClient();

  const [tab, setTab] = useState<'expected' | 'waiting'>('expected');
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const { data, reload } = useApi<any[]>(`/api/orders?view=reception`, { poll: 15000 });
  const { run, busy } = useOrderAction(reload);
  const [pay, setPay] = useState<any>(null);
  const [book, setBook] = useState<any>(null);

  const rows = (data || []).filter((o) => {
    if (tab === 'waiting') return o.status === 'ARRIVED';
    if (o.status === 'ARRIVED') return false;
    const t = new Date(o.scheduled_at || o.ordered_at).getTime();
    return (t >= start.getTime() && t < end.getTime()) || o.priority !== 'ROUTINE' || (!o.scheduled_at && o.patient_class !== 'OP');
  });
  const waitingCount = (data || []).filter((o) => o.status === 'ARRIVED').length;

  const checkIn = async (o: any) => {
    await run(o.id, 'arrive', {}, `${o.first_name} ${o.last_name} checked in for ${o.procedure_name}`);
  };
  const openInvoice = async (o: any) => {
    const r = await fetch(`/api/orders/${o.id}`).then((r) => r.json());
    setPay(r.invoice);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Arrivals")} subtitle={referenceT("Check patients in, collect payment and hand them over to the technologist.")}
        actions={<Link href="/orders?new=1" className="btn-primary"><Plus size={16} /><ReferenceText message="Walk-in order" /></Link>} />
      <div className="panel">
        <div className="px-3 pt-2">
          <Tabs value={tab} onChange={setTab} items={[{ value: 'expected', label: 'Expected today' }, { value: 'waiting', label: <><ReferenceText message="In waiting room" /> <span className="ml-1 rounded bg-petrol-light px-1.5 text-petrol">{waitingCount}</span></> }]} />
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Time" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Exam" /></TableHead><TableHead><ReferenceText message="Priority" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Payment" /></TableHead><TableHead className="text-right"><ReferenceText message="Actions" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((o) => {
                const due = (o.billing_net || 0) - (o.billing_paid || 0);
                const allergy = o.allergies && !/^none/i.test(o.allergies);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="whitespace-nowrap">
                      {tab === 'waiting' ? <><b>{fmt.ago(o.arrived_at)}</b><div className="text-xs text-ink-soft"><ReferenceText message="arrived" /> {fmt.time(o.arrived_at)}</div></>
                        : o.scheduled_at ? <b className="tabular-nums">{fmt.time(o.scheduled_at)}</b> : <span className="text-ink-soft"><ReferenceText message="Walk-in" /></span>}
                    </TableCell>
                    <TableCell>
                      <Link href={`/orders/${o.id}`} className="font-bold hover:underline">{fmt.name(o)}</Link>
                      <div className="text-xs text-ink-soft"><span className="id">{o.mrn}</span> · {fmt.age(o.dob)} {o.sex}</div>
                      {allergy && <div className="flex items-center gap-1 text-xs font-bold text-stat"><AlertTriangle size={12} />{o.allergies}</div>}
                    </TableCell>
                    <TableCell><div className="flex items-center gap-2"><ModalityChip code={o.modality_code} /><span>{o.procedure_name}</span></div>{o.prep && <div className="mt-0.5 text-xs text-urgent">{o.prep}</div>}</TableCell>
                    <TableCell><PriorityBadge priority={o.priority} /></TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell>{due > 0.001 ? <DiagnosticButton className="text-sm font-bold text-stat hover:underline" onClick={() => openInvoice(o)}>{fmt.money(due)} <ReferenceText message="due" /></DiagnosticButton> : <StatusBadge status="PAID" />}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {o.status !== 'ARRIVED' && <>
                          <DiagnosticButton className="btn-ghost btn-sm" onClick={() => setBook(o)} title={referenceT("Reschedule")}><CalendarClock size={14} /></DiagnosticButton>
                          <DiagnosticButton className="btn-primary btn-sm" disabled={busy} onClick={() => checkIn(o)}><DoorOpen size={14} /><ReferenceText message="Check in" /></DiagnosticButton>
                        </>}
                        {o.status === 'ARRIVED' && <>
                          <DiagnosticButton className="btn-ghost btn-sm" disabled={busy} onClick={() => run(o.id, 'revert_arrival', {}, 'Check-in undone')}><Undo2 size={14} /><ReferenceText message="Undo" /></DiagnosticButton>
                          <DiagnosticButton className="btn-secondary btn-sm" disabled={busy} onClick={() => run(o.id, 'start', {}, 'Exam started')}><Play size={14} /><ReferenceText message="Start exam" /></DiagnosticButton>
                        </>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DiagnosticTable>
          {data && !rows.length && <Empty title={tab === 'waiting' ? 'Nobody is waiting' : 'No more arrivals expected today'} />}
        </div>
      </div>
      {pay && <PaymentModal invoice={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); reload(); }} />}
      {book && <ScheduleModal order={book} onClose={() => setBook(null)} onDone={() => { setBook(null); reload(); }} />}
    </div>
  );
}
