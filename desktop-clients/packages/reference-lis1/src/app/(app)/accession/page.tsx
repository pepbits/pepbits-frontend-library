'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useRef, useState } from 'react';
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react';

import { useApi, useMaster } from '../../../lib/hooks';

import { Badge, Button, Card, Checkbox, Empty, ErrorNote, Input, Loading, PageHeader, ReasonDialog, TubeChip, useAction, useToast } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function AccessionPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const [code, setCode] = useState('');
  const [current, setCurrent] = useState<any>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const { data: queue, reload } = useApi<any[]>('/samples', { status: 'COLLECTED' });
  const reasons = useMaster('rejection-reasons');
  const { busy, run } = useAction();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const scan = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setLookupErr(null);
    try { setCurrent(await api.get(`/samples/barcode/${encodeURIComponent(code.trim())}`)); }
    catch (err: any) { setLookupErr(err.message); setCurrent(null); }
    setCode('');
    inputRef.current?.focus();
  };

  const describe = (r: any) => {
    const d = r?.dispatch;
    if (!d) return 'Sample accessioned';
    const parts = [`Accessioned ${r.sample.sampleNo}`];
    if (d.routed) parts.push(`${d.routed} test(s) sent to analyzer middleware`);
    if (d.manual) parts.push(`${d.manual} test(s) for manual entry`);
    return parts.join(' · ');
  };

  const accession = async (id: number) => {
    const r: any = await run(`a${id}`, () => api.post(`/samples/${id}/accession`), describe);
    if (r) { if (current?.id === id) setCurrent(r.sample); reload(); }
    return r;
  };

  const bulk = async () => {
    let ok = 0;
    for (const id of sel) { try { await api.post(`/samples/${id}/accession`); ok++; } catch (e: any) { toast.err(e.message); } }
    toast.ok(`${ok} sample(s) accessioned and routed`);
    setSel([]); reload();
  };

  return (
    <div>
      <PageHeader title={referenceT("Accessioning")} subtitle={referenceT("Receive tubes in the lab. Accessioning sends orders to the configured middleware or analyzer, and queues outsourced tests for shipment.")} />
      <CardGrid className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <Card title={referenceT("Scan a tube")}>
            <form onSubmit={scan} className="flex gap-2">
              <div className="relative flex-1"><ScanLine className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" />
                <Input ref={inputRef} autoFocus className="pl-8 font-mono" placeholder={referenceT("Scan or type sample barcode")} value={code} onChange={(e) => setCode(e.target.value)} /></div>
              <Button type="submit" variant="primary"><ReferenceText message="Find" /></Button>
            </form>
            <div className="mt-3"><ErrorNote error={lookupErr} /></div>
            {current && (
              <div className="rounded border border-line p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2"><TubeChip color={current.container?.capColor} /><span className="font-mono text-base font-semibold">{current.sampleNo}</span><Badge value={current.status} />{current.priority === 'STAT' && <Badge value="STAT" />}</div>
                    <div className="mt-1 text-sm">{current.patient?.fullName} <span className="font-mono text-xs text-ink-soft">{current.patient?.mrn}</span> · {current.patient?.gender} · {current.patient?.age}</div>
                    <div className="text-xs text-ink-soft">{current.sampleType?.name} <ReferenceText message="· collected" /> {fmtDateTime(current.collectedAt)} <ReferenceText message="by" /> {current.collectedByName ?? '—'}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">{current.tests.map((t: any) => <Badge key={t.id} value={t.status} label={referenceT("{value0} · {value1}", {value0: t.test?.code, value1: t.status.toLowerCase().replace('_', ' ')})} />)}</div>
                {current.rejectionReason && <div className="mt-2 text-sm text-flag-crit"><ReferenceText message="Rejected:" /> {current.rejectionReason}</div>}
                <div className="mt-3 flex gap-2">
                  <Button variant="primary" icon={CheckCircle2} disabled={current.status !== 'COLLECTED'} loading={busy === `a${current.id}`} onClick={() => accession(current.id)}><ReferenceText message="Accession" /></Button>
                  <Button variant="danger" icon={XCircle} disabled={['REJECTED', 'COMPLETED'].includes(current.status)} onClick={() => setRejecting(current.id)}><ReferenceText message="Reject sample" /></Button>
                </div>
              </div>
            )}
          </Card>
        </div>
        <Card title={referenceT("Awaiting accession ({value0})", {value0: queue?.length ?? 0})} bodyClass="p-0"
          actions={sel.length > 0 && <Button size="sm" variant="primary" onClick={bulk}><ReferenceText message="Accession" /> {sel.length} <ReferenceText message="selected" /></Button>}>
          {!queue ? <Loading /> : !queue.length ? <Empty title={referenceT("No tubes in transit")} hint={referenceT("Collected tubes wait here until the lab receives them.")} /> : (
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow><TableHead className="w-8"><Checkbox label="" checked={sel.length === queue.length} onChange={(v) => setSel(v ? queue.map((s) => s.id) : [])} /></TableHead><TableHead><ReferenceText message="Sample" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Tests" /></TableHead><TableHead><ReferenceText message="Collected" /></TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {queue.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell><Checkbox label="" checked={sel.includes(s.id)} onChange={(v) => setSel((x) => (v ? [...x, s.id] : x.filter((y) => y !== s.id)))} /></TableCell>
                    <TableCell><span className="inline-flex items-center gap-1.5"><TubeChip size="sm" color={s.container?.capColor} /><span className="font-mono text-xs">{s.sampleNo}</span></span>{s.priority === 'STAT' && <Badge value="STAT" className="ml-1" />}</TableCell>
                    <TableCell className="text-sm">{s.patientName}<div className="font-mono text-xs2 text-ink-mute">{s.mrn}</div></TableCell>
                    <TableCell className="text-xs">{s.tests.map((t: any) => t.code).join(', ')}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(s.collectedAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button size="sm" loading={busy === `a${s.id}`} onClick={() => accession(s.id)}><ReferenceText message="Accession" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejecting(s.id)}><ReferenceText message="Reject" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DiagnosticTable>
          )}
        </Card>
      </CardGrid>
      <ReasonDialog open={rejecting !== null} title={referenceT("Reject sample")} label={referenceT("Rejection reason")} confirmLabel={referenceT("Reject")} variant="danger" options={reasons.filter((r) => r.active).map((r) => r.name)}
        onClose={() => setRejecting(null)}
        onSubmit={async (reason) => {
          const s = await api.post(`/samples/${rejecting}/reject`, { reason });
          toast.info('Sample rejected. Its tests are back in the collection queue for a redraw.');
          if (current?.id === rejecting) setCurrent(s);
          reload();
        }} />
    </div>
  );
}
