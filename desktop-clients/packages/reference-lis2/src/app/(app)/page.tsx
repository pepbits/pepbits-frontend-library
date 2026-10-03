'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { useResource, useInterval } from '../../lib/hooks';

import { Button, ErrorBanner, Loading, PageHeader, Section, cx } from '../../components/ui';
import { useUser } from '../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const STAGES = [
  { key: 'awaitingCollection', label: 'Awaiting collection', href: '/collection' },
  { key: 'inTransit', label: 'Collected, not received', href: '/samples?status=COLLECTED' },
  { key: 'pendingResults', label: 'On the bench', href: '/worklist' },
  { key: 'awaitingValidation', label: 'Awaiting validation', href: '/worklist?status=RESULTED,AMENDING' },
  { key: 'awaitingSignature', label: 'Awaiting signature', href: '/signing' },
  { key: 'signedToday', label: 'Signed today', href: '/reports' },
];

export default function Dashboard() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const user = useUser();
  const { data, loading, error, reload } = useResource<any>('/dashboard');
  useInterval(reload, 30000);
  if (!data) return loading ? <Loading /> : <ErrorBanner error={error} onRetry={reload} />;
  const k = data.kpi;
  const alerts = [
    { n: k.criticalPending, text: 'critical values not yet phoned through', href: '/critical?status=PENDING', tone: 'crit' },
    { n: k.tatBreached, text: 'tests past their turnaround time', href: '/tat?state=breached', tone: 'crit' },
    { n: k.tatAtRisk, text: 'tests due within 30 minutes', href: '/tat?state=risk', tone: 'high' },
    { n: k.interfaceErrors24h, text: 'interface messages failed in the last 24 h', href: '/integration/messages?status=ERROR', tone: 'crit' },
    { n: k.failedPublications, text: 'result deliveries failing or retrying', href: '/integration/outbox?status=RETRY', tone: 'high' },
    { n: k.outsourcePending, text: 'tests waiting to be shipped to a reference lab', href: '/outsource', tone: 'high' },
    { n: k.lowReagents, text: 'reagents at or below reorder level', href: '/inventory?low=1', tone: 'high' },
  ].filter((a) => a.n > 0);
  const maxDaily = Math.max(1, ...data.daily.map((d: any) => d.c));
  const hours = Array.from({ length: 24 }, (_, h) => data.hourly.find((x: any) => x.hour === h)?.c || 0);
  const maxHour = Math.max(1, ...hours);
  const onTime = data.tat.total ? Math.round((data.tat.onTime / data.tat.total) * 100) : null;
  return (
    <>
      <PageHeader title={referenceT(new Date().getHours() < 12 ? "Good morning, {name}" : new Date().getHours() < 17 ? "Good afternoon, {name}" : "Good evening, {name}", {name: (user?.full_name || '').split(' ').find((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w)) || ''})}
        subtitle={referenceT("{value0} orders today, {value1} of them from client hospitals. {value2} samples received.", {value0: k.ordersToday, value1: k.externalOrdersToday, value2: k.receivedToday})}
        actions={<Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload}><ReferenceText message="Refresh" /></Button>} />

      {/* Specimen pipeline */}
      <div className="panel mb-4 grid grid-cols-2 overflow-hidden sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s, i) => (
          <Link key={s.key} href={s.href} className="group relative border-b border-r border-line px-4 py-3.5 hover:bg-hema-50/60 lg:border-b-0">
            <div className="text-xs text-ink-soft"><ReferenceText message={s.label} /></div>
            <div className={cx('mt-1 text-[28px] font-semibold leading-none tnum', s.key === 'awaitingSignature' && k[s.key] > 0 ? 'text-eosin-600' : 'text-ink')}>{k[s.key]}</div>
            {i < STAGES.length - 1 && <ChevronRight className="absolute right-[-9px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-white text-ink-faint lg:block" />}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Section title={referenceT("Needs attention")} bodyClass="p-0">
            {alerts.length ? (
              <ul className="divide-y divide-line">
                {alerts.map((a) => (
                  <li key={a.text}>
                    <Link href={a.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper">
                      <span className={cx('grid h-7 min-w-7 place-items-center rounded px-1.5 text-sm font-semibold tnum', a.tone === 'crit' ? 'bg-crit text-white' : 'bg-high-bg text-high')}>{a.n}</span>
                      <span className="flex-1 text-sm">{a.text}</span>
                      <ChevronRight className="h-4 w-4 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-5 text-sm text-ink-soft"><ReferenceText message="Nothing is overdue, failing or waiting on a phone call." /></p>}
          </Section>

          <Section title={referenceT("Open work by department")} bodyClass="p-0">
            <DiagnosticTable className="w-full text-sm">
              <TableHeader><TableRow><TableHead className="th"><ReferenceText message="Department" /></TableHead><TableHead className="th text-right"><ReferenceText message="To result" /></TableHead><TableHead className="th text-right"><ReferenceText message="To sign" /></TableHead><TableHead className="th text-right"><ReferenceText message="Overdue" /></TableHead><TableHead className="th text-right"><ReferenceText message="Open" /></TableHead></TableRow></TableHeader>
              <TableBody>
                {data.workload.map((d: any) => (
                  <TableRow key={d.id} className="hover:bg-paper">
                    <TableCell className="td"><Link className="link" href={`/worklist?departmentId=${d.id}`}>{d.name}</Link></TableCell>
                    <TableCell className="td text-right tnum">{d.to_result || 0}</TableCell>
                    <TableCell className="td text-right tnum">{d.to_sign || 0}</TableCell>
                    <TableCell className={cx('td text-right tnum', d.overdue > 0 && 'font-semibold text-crit')}>{d.overdue || 0}</TableCell>
                    <TableCell className="td text-right tnum">{d.open_items}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DiagnosticTable>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title={referenceT("Turnaround, last 7 days")}>
            <div className="flex items-end gap-6">
              <div><div className="text-[28px] font-semibold leading-none tnum">{onTime === null ? '–' : `${onTime}%`}</div><div className="mt-1 text-xs text-ink-soft"><ReferenceText message="signed within TAT (" />{data.tat.onTime}/{data.tat.total})</div></div>
              <div><div className="text-[28px] font-semibold leading-none tnum">{data.tat.avgMinutes ?? '–'}</div><div className="mt-1 text-xs text-ink-soft"><ReferenceText message="average minutes, receipt to signature" /></div></div>
            </div>
          </Section>
          <Section title={referenceT("Orders, last 14 days")}>
            {data.daily.length ? (
              <div className="flex h-28 items-end gap-1.5">
                {data.daily.map((d: any) => (
                  <div key={d.day} className="flex max-w-[44px] flex-1 flex-col items-center gap-1" title={referenceT("{value0}: {value1} orders", {value0: d.day, value1: d.c})}>
                    <span className="text-2xs text-ink-soft tnum">{d.c}</span>
                    <div className="w-full rounded-t bg-hema-500" style={{ height: `${(d.c / maxDaily) * 80}px` }} />
                    <span className="text-2xs text-ink-faint">{d.day.slice(8)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-ink-soft"><ReferenceText message="No orders yet. Register a patient and create the first order from New order." /></p>}
          </Section>
          <Section title={referenceT("Samples received today, by hour")}>
            <div className="flex h-20 items-end gap-[3px]">
              {hours.map((c, h) => <div key={h} title={referenceT("{value0}:00 – {value1}", {value0: h, value1: c})} className={cx('flex-1 rounded-t', c ? 'bg-eosin-400' : 'bg-line')} style={{ height: `${Math.max(3, (c / maxHour) * 72)}px` }} />)}
            </div>
            <div className="mt-1 flex justify-between text-2xs text-ink-faint"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
          </Section>
          {data.recentErrors.length > 0 && (
            <Section title={referenceT("Recent interface errors")} bodyClass="p-0">
              <ul className="divide-y divide-line">
                {data.recentErrors.map((m: any) => (
                  <li key={m.id}><Link href={`/integration/messages?open=${m.id}`} className="flex gap-2 px-4 py-2 text-sm hover:bg-paper">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-crit" />
                    <span className="min-w-0 flex-1"><span className="block truncate">{m.error}</span><span className="text-2xs text-ink-soft">{m.interface || 'Unknown sender'}, {m.message_type || m.protocol}, {fmtDateTime(m.created_at)}</span></span>
                  </Link></li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
