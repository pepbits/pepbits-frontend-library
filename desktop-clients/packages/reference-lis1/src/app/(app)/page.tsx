'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { RefreshCw } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import {dueIn,minutesLabel} from '../../lib/format';
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, Stat } from '../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** The specimen journey in order; each stage links to the page where that work happens. */
const RAIL = [
  { key: 'pendingCollection', label: 'To collect', href: '/collection' },
  { key: 'awaitingAccession', label: 'To accession', href: '/accession' },
  { key: 'inProcess', label: 'In process', href: '/results' },
  { key: 'awaitingValidation', label: 'To validate', href: '/validation' },
  { key: 'awaitingSign', label: 'To sign', href: '/validation?tab=sign' },
  { key: 'signedToday', label: 'Signed today', href: '/reports' },
];

export default function Dashboard() {
 const referenceT = useReferenceLocalization().t;

 const {money}=useDiagnosticFormat();

  const { data: d, error, loading, reload } = useApi<any>('/dashboard');
  const { user } = useAuth();
  const router = useRouter();

  return (
    <div>
      <PageHeader title={referenceT(new Date().getHours() < 12 ? "Good morning, {name}" : new Date().getHours() < 17 ? "Good afternoon, {name}" : "Good evening, {name}", {name: user?.fullName?.split(' ')[0] ?? ''})}
        subtitle={referenceT("Live position of today's work across the laboratory")}
        actions={<Button icon={RefreshCw} onClick={reload} loading={loading}><ReferenceText message="Refresh" /></Button>} />
      <ErrorNote error={error} />
      {!d ? <Loading /> : (
        <div className="space-y-4">
          <div className="card flex overflow-x-auto">
            {RAIL.map((s, i) => (
              <Link key={s.key} href={s.href} className="group relative min-w-[140px] flex-1 border-r border-line px-4 py-3 last:border-r-0 hover:bg-lab-50">
                <div className="flex items-center gap-2 text-xs text-ink-soft">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-lab-600 text-[9px] font-semibold text-lab-700">{i + 1}</span>
                  <ReferenceText message={s.label} />
                </div>
                <div className="num mt-1 text-2xl font-semibold text-ink group-hover:text-lab-700">{d[s.key]}</div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={referenceT("Orders today")} value={d.ordersToday} onClick={() => router.push('/orders')} />
            <Stat label={referenceT("Collected today (revenue)")} value={money(d.revenueToday, d.currency)} onClick={() => router.push('/billing')} />
            <Stat label={referenceT("Open critical results")} value={d.openCriticals} tone={d.openCriticals ? 'crit' : 'ok'} sub={d.openCriticals ? 'Notify the clinician and record read-back' : 'All notified'} onClick={() => router.push('/criticals')} />
            <Stat label={referenceT("Failed instrument messages")} value={d.failedMessages} tone={d.failedMessages ? 'warn' : 'ok'} onClick={() => router.push('/automation?status=FAILED')} />
          </div>

          <CardGrid className="grid gap-4 lg:grid-cols-5">
            <Card title={referenceT("Overdue tests")} className="lg:col-span-3" bodyClass="p-0">
              {!d.overdue.length ? <Empty title={referenceT("Nothing overdue")} hint={referenceT("Every open test is inside its configured turnaround time.")} /> : (
                <div className="max-h-[380px] overflow-y-auto">
                  <DiagnosticTable className="tbl">
                    <TableHeader><TableRow><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Test" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Late by" /></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {d.overdue.map((o: any) => (
                        <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.orderId}`)}>
                          <TableCell className="font-mono text-xs">{o.orderNo} {o.priority === 'STAT' && <Badge value="STAT" />}</TableCell>
                          <TableCell>{o.patient}</TableCell>
                          <TableCell>{o.test}<div className="text-xs2 text-ink-mute">{o.department}</div></TableCell>
                          <TableCell><Badge value={o.status} /></TableCell>
                          <TableCell className="text-flag-crit">{dueIn(o.dueAt).text.replace(' overdue', '')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </DiagnosticTable>
                </div>
              )}
            </Card>
            <Card title={referenceT("Turnaround time, last 7 days")} className="lg:col-span-2" bodyClass="p-0">
              {!d.tat.length ? <Empty title={referenceT("No signed tests yet")} hint={referenceT("TAT is measured from order to signature against each test's configured target.")} /> : (
                <DiagnosticTable className="tbl">
                  <TableHeader><TableRow><TableHead><ReferenceText message="Department" /></TableHead><TableHead className="text-right"><ReferenceText message="Tests" /></TableHead><TableHead className="text-right"><ReferenceText message="Average" /></TableHead><TableHead><ReferenceText message="Within target" /></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.tat.map((t: any) => (
                      <TableRow key={t.department}>
                        <TableCell>{t.department}</TableCell>
                        <TableCell className="num text-right">{t.tests}</TableCell>
                        <TableCell className="num text-right">{minutesLabel(t.avgMinutes)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded bg-paper"><div className={t.withinTatPercent >= 90 ? 'h-full bg-flag-ok' : t.withinTatPercent >= 70 ? 'h-full bg-flag-warn' : 'h-full bg-flag-crit'} style={{ width: `${t.withinTatPercent}%` }} /></div>
                            <span className="num text-xs">{t.withinTatPercent}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DiagnosticTable>
              )}
            </Card>
          </CardGrid>
        </div>
      )}
    </div>
  );
}
