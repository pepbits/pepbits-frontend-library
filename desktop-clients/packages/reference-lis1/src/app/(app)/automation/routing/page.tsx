'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { ArrowRight, Hand, Truck } from 'lucide-react';
import { useApi } from '../../../../lib/hooks';
import { Badge, Card, Empty, Loading, PageHeader } from '../../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function RoutingPage() {
 const referenceT = useReferenceLocalization().t;

  const { data, loading } = useApi<any[]>('/automation/routing');
  return (
    <div>
      <PageHeader title={referenceT("Test routing")} subtitle={referenceT("Where each test goes after accessioning: analyzer (by mapping priority) through its middleware, the reference lab, or manual entry")}
        actions={<Link href="/masters/analyzer-test-mappings" className="text-sm text-lab-700 hover:underline"><ReferenceText message="Edit test mappings →" /></Link>} />
      <Card bodyClass="p-0">
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No active tests")} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Test" /></TableHead><TableHead><ReferenceText message="Route (first active wins)" /></TableHead><TableHead><ReferenceText message="Parameter coverage" /></TableHead></TableRow></TableHeader>
            <TableBody>{data.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="w-64"><div className="font-medium">{t.name}</div><div className="text-xs2 text-ink-mute">{t.code} · {t.parameterCount} <ReferenceText message="parameters" /></div></TableCell>
                <TableCell>
                  {t.isOutsourced ? <span className="inline-flex items-center gap-1.5 text-sm text-flag-warn"><Truck className="h-4 w-4" /><ReferenceText message="Reference laboratory" /></span>
                    : !t.routes.length ? <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft"><Hand className="h-4 w-4" /><ReferenceText message="Manual result entry" /></span>
                    : <div className="space-y-1">{t.routes.map((r: any, i: number) => (
                      <div key={i} className={`flex flex-wrap items-center gap-1.5 text-sm ${!r.analyzerActive || r.middlewareActive === false ? 'opacity-50' : ''}`}>
                        <span className="num text-xs2 text-ink-mute">#{r.priority}</span>
                        <span className="rounded border border-line px-1.5 py-px font-mono text-xs">{r.analyzerTestCode}</span>
                        <ArrowRight className="h-3 w-3 text-ink-mute" /><span>{r.analyzer}</span>
                        {r.middleware && <><ArrowRight className="h-3 w-3 text-ink-mute" /><span className="text-ink-soft">{r.middleware}</span><Badge value="DRAFT" label={r.orderMode === 'PULL' ? 'pull' : 'push'} /></>}
                        {!r.analyzerActive && <Badge value="CANCELLED" label={referenceT("analyzer inactive")} />}
                      </div>
                    ))}</div>}
                </TableCell>
                <TableCell className="w-56">
                  {t.routes.map((r: any, i: number) => {
                    const pct = r.totalParameters ? Math.round((r.mappedParameters / r.totalParameters) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="h-1.5 w-20 overflow-hidden rounded bg-paper"><div className={pct === 100 ? 'h-full bg-flag-ok' : 'h-full bg-flag-warn'} style={{ width: `${pct}%` }} /></div>
                        {r.mappedParameters}/{r.totalParameters}<ReferenceText message="mapped" /></div>
                    );
                  })}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </DiagnosticTable>
        )}
      </Card>
    </div>
  );
}
