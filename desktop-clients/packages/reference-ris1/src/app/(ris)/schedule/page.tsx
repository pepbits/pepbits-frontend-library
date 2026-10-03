'use client';
import {DiagnosticDateInput} from '@pepbits/reference-diagnostics';

import {DiagnosticButton,DiagnosticInput} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, Empty } from '../../../components/ui';
import { ScheduleModal } from '../../../components/OrderActions';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export default function Schedule() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const [day, setDay] = useState(dayStart(new Date()));
  const [booking, setBooking] = useState<any>(null);
  const end = new Date(day.getTime() + 86400000);
  const { data: lk } = useApi<any>('/api/lookups');
  const { data, reload } = useApi<any[]>(`/api/orders?view=schedule&from=${day.toISOString()}&to=${end.toISOString()}`, { poll: 30000 });
  const { data: waiting, reload: reloadWaiting } = useApi<any[]>('/api/orders?status=ORDERED');
  const unscheduled = (waiting || []).filter((o) => !o.scheduled_at);

  const byModality = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const o of data || []) (m[o.modality_code] ||= []).push(o);
    return m;
  }, [data]);
  const shift = (n: number) => setDay(new Date(day.getTime() + n * 86400000));
  const isToday = day.getTime() === dayStart(new Date()).getTime();

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title={referenceT("Schedule")} subtitle={referenceT("Appointments by modality. Booked exams appear on the modality worklist (MWL) for the scanner.")}
        actions={<div className="flex items-center gap-1">
          <DiagnosticButton className="btn-secondary w-9 p-0" onClick={() => shift(-1)} aria-label={referenceT("Previous day")}><ChevronLeft size={18} /></DiagnosticButton>
          <DiagnosticDateInput  className="field w-40" value={`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`}
            onChange={(e) => e.target.value && setDay(dayStart(new Date(e.target.value + 'T00:00:00')))} aria-label={referenceT("Day")} />
          <DiagnosticButton className="btn-secondary w-9 p-0" onClick={() => shift(1)} aria-label={referenceT("Next day")}><ChevronRight size={18} /></DiagnosticButton>
          {!isToday && <DiagnosticButton className="btn-ghost" onClick={() => setDay(dayStart(new Date()))}><ReferenceText message="Today" /></DiagnosticButton>}
        </div>} />

      {unscheduled.length > 0 && (
        <section className="panel mb-5">
          <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Waiting to be booked" /> <span className="ml-1 font-normal text-ink-soft">{unscheduled.length}</span></h2></div>
          <div className="flex gap-2 overflow-x-auto p-3 scroll-thin">
            {unscheduled.map((o) => (
              <div key={o.id} className="w-64 shrink-0 rounded-md border border-line p-2.5 text-sm">
                <div className="flex items-center gap-2"><ModalityChip code={o.modality_code} /><PriorityBadge priority={o.priority} /><span className="ml-auto text-xs text-ink-soft">{fmt.ago(o.ordered_at)}</span></div>
                <div className="mt-1.5 font-bold">{fmt.name(o)}</div>
                <div className="truncate text-ink-3">{o.procedure_name}</div>
                <DiagnosticButton className="btn-secondary btn-sm mt-2 w-full" onClick={() => setBooking(o)}><CalendarClock size={14} /><ReferenceText message="Book" /></DiagnosticButton>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(lk?.modalities || []).map((m: any) => {
          const list = byModality[m.code] || [];
          return (
            <section key={m.code} className="panel flex flex-col">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <ModalityChip code={m.code} /><span className="flex-1 truncate font-bold">{m.name}</span>
                <span className="text-xs tabular-nums text-ink-soft">{list.length}/{m.daily_capacity}</span>
              </div>
              <div className="text-xs text-ink-soft px-3 pt-1.5">{m.room} <ReferenceText message="· AE" /> {m.ae_title}</div>
              <ol className="flex-1 space-y-1.5 p-2">
                {!list.length && <li className="px-1 py-4 text-center text-sm text-ink-soft"><ReferenceText message="Nothing booked" /></li>}
                {list.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className={`block rounded-md border-l-[3px] bg-paper/70 px-2.5 py-1.5 text-sm hover:bg-petrol-light ${o.priority === 'STAT' ? 'border-stat' : o.priority === 'URGENT' ? 'border-urgent' : 'border-petrol/40'}`}>
                      <div className="flex items-center justify-between gap-2"><b className="tabular-nums">{fmt.time(o.scheduled_at || o.ordered_at)}</b><StatusBadge status={o.status} /></div>
                      <div className="truncate font-bold">{fmt.name(o)}</div>
                      <div className="truncate text-xs text-ink-3">{o.procedure_name}</div>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      {data && !data.length && <Empty title={referenceT("No exams on this day")} />}
      {booking && <ScheduleModal order={booking} onClose={() => setBooking(null)} onDone={() => { setBooking(null); reload(); reloadWaiting(); }} />}
    </div>
  );
}
