'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { useApi, useFmt } from '../../lib/client';
import { PageHeader, ModalityChip, PriorityBadge, TatClock, useSession, Empty } from '../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const PIPE = [
  { status: 'ORDERED', label: 'Ordered', href: '/orders?status=ORDERED' },
  { status: 'SCHEDULED', label: 'Scheduled', href: '/schedule' },
  { status: 'ARRIVED', label: 'Waiting', href: '/reception' },
  { status: 'IN_PROGRESS', label: 'In exam', href: '/technologist' },
  { status: 'COMPLETED', label: 'Awaiting read', href: '/reading' },
  { status: 'PRELIMINARY', label: 'Preliminary', href: '/reading' },
  { status: 'FINAL', label: 'Final today', href: '/orders?status=FINAL' },
];

function Kpi({ label, value, note, tone, href }: { label: string; value: React.ReactNode; note?: string; tone?: 'stat' | 'crit' | 'ok'; href?: string }) {
  const body = (
    <div className="panel h-full px-4 py-3.5 transition-colors hover:border-ink-soft/50">
      <div className="text-[13px] text-ink-soft">{label}</div>
      <div className={`mt-1 text-[28px] font-bold leading-none tabular-nums ${tone === 'stat' ? 'text-stat' : tone === 'crit' ? 'text-crit' : tone === 'ok' ? 'text-ok' : 'text-ink'}`}>{value}</div>
      {note && <div className="mt-1.5 text-xs text-ink-soft"><ReferenceText message={note} /></div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function Dashboard() {
 const referenceLocale = useReferenceLocalization();
 const referenceT = referenceLocale.t;

 const fmt=useFmt();

  const { user } = useSession();
  const { data } = useApi<any>('/api/analytics?days=14', { poll: 30000 });
  const k = data?.kpi || {};
  const counts: Record<string, number> = Object.fromEntries((data?.statusCounts || []).map((r: any) => [r.status, r.n]));
  const max = Math.max(1, ...PIPE.map((p) => counts[p.status] || 0));
  const hour = new Date().getHours();

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={referenceT(hour < 12 ? "Good morning, {name}" : hour < 18 ? "Good afternoon, {name}" : "Good evening, {name}", {name: user?.name || ''})}
        subtitle={new Date().toLocaleDateString(referenceLocale.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={<><Link href="/orders?new=1" className="btn-primary"><ReferenceText message="New order" /></Link><Link href="/reading" className="btn-secondary"><ReferenceText message="Reading worklist" /></Link></>}
      />

      <section className="panel mb-5 p-5" aria-label={referenceT("Department flow")}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-bold"><ReferenceText message="Department flow right now" /></h2>
          <span className="text-xs text-ink-soft"><ReferenceText message="Refreshes every 30 seconds" /></span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {PIPE.map((p, i) => (
            <Link key={p.status} href={p.href} className="group relative rounded-md border border-line px-3 pb-3 pt-2.5 hover:border-petrol">
              <div className="text-xs text-ink-soft"><ReferenceText message={p.label} /></div>
              <div className="text-2xl font-bold tabular-nums">{counts[p.status] || 0}</div>
              <div className="mt-2 h-1.5 rounded bg-line">
                <div className={`h-1.5 rounded ${i >= 4 && i < 6 ? 'bg-urgent' : i === 6 ? 'bg-ok' : 'bg-petrol'}`} style={{ width: `${((counts[p.status] || 0) / max) * 100}%` }} />
              </div>
              {i < PIPE.length - 1 && <ArrowRight size={14} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-line lg:block" />}
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={referenceT("Orders today")} value={k.ordered_today ?? '–'} note={referenceT("{value0} exams performed", {value0:k.exams_today ?? 0})} href="/orders" />
        <Kpi label={referenceT("Awaiting report")} value={k.awaiting_read ?? '–'} note={referenceT("{value0} signed today", {value0:k.finals_today ?? 0})} href="/reading" />
        <Kpi label={referenceT("Open STAT")} value={k.stat_open ?? '–'} tone={k.stat_open ? 'stat' : undefined} note="Across all stages" href="/orders?priority=STAT" />
        <Kpi label={referenceT("Critical results open")} value={k.critical_open ?? '–'} tone={k.critical_open ? 'crit' : 'ok'} note="Not yet acknowledged" href="/critical" />
        <Kpi label={referenceT("Collected today")} value={fmt.money(k.collected_today)} note={referenceT("{value0} outstanding", {value0:fmt.money(k.outstanding)})} href="/billing" />
        <Kpi label={referenceT("Studies received today")} value={k.studies_today ?? '–'} note={k.unmatched_studies ? referenceT("{value0} unmatched in PACS", {value0:k.unmatched_studies}) : referenceT("All matched to orders")} tone={k.unmatched_studies ? 'stat' : undefined} href="/pacs" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="panel xl:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-bold"><ReferenceText message="Reports at risk of missing turnaround" /></h2>
            <Link href="/analytics" className="text-sm font-bold text-petrol hover:underline"><ReferenceText message="TAT analytics" /></Link>
          </div>
          {data && !data.atRisk.length && <Empty title={referenceT("Every unread exam is within its turnaround target.")} />}
          {!!data?.atRisk.length && (
            <div className="overflow-x-auto">
              <DiagnosticTable className="table-base">
                <TableHeader><TableRow><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Exam" /></TableHead><TableHead><ReferenceText message="Priority" /></TableHead><TableHead><ReferenceText message="Radiologist" /></TableHead><TableHead><ReferenceText message="Turnaround" /></TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.atRisk.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell><Link href={`/reading/${o.id}`} className="font-bold hover:underline">{fmt.name(o)}</Link><div className="id text-ink-soft">{o.accession}</div></TableCell>
                      <TableCell><div className="flex items-center gap-2"><ModalityChip code={o.modality_code} /><span className="line-clamp-1">{o.procedure_name}</span></div></TableCell>
                      <TableCell><PriorityBadge priority={o.priority} /></TableCell>
                      <TableCell className="text-ink-3">{o.radiologist_name || <span className="text-ink-soft"><ReferenceText message="Unassigned" /></span>}</TableCell>
                      <TableCell><TatClock tat={o.tat} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DiagnosticTable>
            </div>
          )}
        </section>

        <section className="panel xl:col-span-2">
          <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Modality load today" /></h2></div>
          <ul className="divide-y divide-line/70">
            {(data?.modalityToday || []).map((m: any) => {
              const pct = Math.min(100, (m.booked / Math.max(1, m.daily_capacity)) * 100);
              return (
                <li key={m.code} className="flex items-center gap-3 px-4 py-2.5">
                  <ModalityChip code={m.code} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm"><span className="truncate">{m.name}</span><span className="tabular-nums text-ink-soft">{m.booked}/{m.daily_capacity}</span></div>
                    <div className="mt-1 h-1.5 rounded bg-line"><div className={`h-1.5 rounded ${pct > 90 ? 'bg-stat' : pct > 70 ? 'bg-urgent' : 'bg-petrol'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                  <div className="w-20 text-right text-xs text-ink-soft">{m.done} <ReferenceText message="done" />{m.unread ? <><br /><span className="font-bold text-urgent">{m.unread} <ReferenceText message="unread" /></span></> : null}</div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel p-4 xl:col-span-5">
          <h2 className="mb-3 font-bold"><ReferenceText message="Orders and signed reports, last 14 days" /></h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.volume || []} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#D8DEE3" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#5B6B7A' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#5B6B7A' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: '#E3EEF4' }} contentStyle={{ borderRadius: 6, border: '1px solid #D8DEE3', fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="ordered" name="Ordered" fill="#1D4E6B" radius={[3, 3, 0, 0]} />
                <Bar dataKey="finalized" name="Final reports" fill="#8FB7CF" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
