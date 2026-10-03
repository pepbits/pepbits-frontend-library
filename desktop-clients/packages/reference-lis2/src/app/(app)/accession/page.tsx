'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useRef, useState } from 'react';
import { Ban, CheckCircle2, ScanBarcode } from 'lucide-react';

import { useFilters, useList } from '../../../lib/hooks';
import {ago,fullName} from '../../../lib/format';
import { Badge, Button, Empty, Input, PageHeader, PriorityBadge, Section, StatusBadge, cx, useToast } from '../../../components/ui';
import { PagedTable } from '../../../components/table';
import { RejectModal, SampleDrawer } from '../../../components/sample';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function AccessionPage() {
 const referenceT = useReferenceLocalization().t;

 const {post}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const toast = useToast();
  const [code, setCode] = useState('');
  const [storage, setStorage] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ ok: boolean; at: Date; sample?: any; again?: boolean; error?: string; code: string }[]>([]);
  const [reject, setReject] = useState<any>(null);
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const [f, set] = useFilters({ status: 'COLLECTED', pageSize: 10 });
  const transit = useList('/samples', f);
  const receive = async (barcode = code) => {
    const b = barcode.trim();
    if (!b) return;
    setBusy(true);
    try {
      const r = await post('/samples/receive', { barcode: b, storage: storage || undefined });
      setLog((l) => [{ ok: true, at: new Date(), sample: r.sample, again: r.alreadyReceived, code: b }, ...l].slice(0, 30));
      if (r.alreadyReceived) toast.warn(`${r.sample.sample_no} was already received.`);
      transit.reload();
    } catch (e: any) {
      setLog((l) => [{ ok: false, at: new Date(), error: e.message, code: b }, ...l].slice(0, 30));
    } finally { setBusy(false); setCode(''); ref.current?.focus(); }
  };
  const last = log[0];
  return (
    <>
      <PageHeader title={referenceT("Accession")} subtitle={referenceT("Scan each tube as it arrives. Our sample numbers and client-hospital barcodes are both recognised.")} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div className="panel p-4">
            <label htmlFor="scan" className="label"><ReferenceText message="Sample barcode" /></label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-hema-500" />
                <Input id="scan" ref={ref} autoFocus className="h-12 pl-10 text-lg tnum" placeholder={referenceT("Scan or type, then Enter")} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') receive(); }} />
              </div>
              <Button variant="primary" className="h-12" loading={busy} onClick={() => receive()}><ReferenceText message="Receive" /></Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="storage" className="text-xs text-ink-soft"><ReferenceText message="Store received tubes at" /></label>
              <Input id="storage" className="h-8 max-w-xs py-1" value={storage} onChange={(e) => setStorage(e.target.value)} placeholder={referenceT("optional, e.g. Rack A")} />
            </div>
          </div>
          {last && (
            <div className={cx('panel border-l-4 p-4', last.ok ? (last.again ? 'border-l-high' : 'border-l-ok') : 'border-l-crit')} aria-live="polite">
              {last.ok ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className={cx('h-5 w-5', last.again ? 'text-high' : 'text-ok')} />
                    <span className="text-lg font-semibold tnum">{last.sample.sample_no}</span>
                    {last.sample.external_sample_no && <Badge><ReferenceText message="client" /> {last.sample.external_sample_no}</Badge>}
                    <PriorityBadge priority={last.sample.priority} />
                    <span className="text-sm text-ink-soft">{last.again ? 'already received' : 'received'}</span>
                    <Button size="sm" variant="danger" className="ml-auto" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => setReject(last.sample)}><ReferenceText message="Reject" /></Button>
                  </div>
                  <p className="mt-1 text-sm">{fullName(last.sample)} <span className="text-ink-soft tnum">{last.sample.mrn}, {last.sample.age} {last.sample.gender}</span>, {last.sample.sample_type}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {last.sample.items.map((i: any) => <li key={i.id} className="rounded border border-line px-2 py-1 text-sm"><span className="font-medium">{i.test_code}</span> <StatusBadge status={i.status} />{i.due_at && <span className="ml-1 text-2xs text-ink-soft"><ReferenceText message="due" /> {fmtDateTime(i.due_at)}</span>}</li>)}
                  </ul>
                  {last.sample.instrumentOrders?.length > 0 && <p className="mt-2 text-xs text-ink-soft"><ReferenceText message="Sent to" /> {[...new Set(last.sample.instrumentOrders.map((x: any) => x.analyzer_name))].join(', ')}.</p>}
                </>
              ) : <p className="text-sm text-crit"><b className="tnum">{last.code}</b>: {last.error}</p>}
            </div>
          )}
          <Section title={referenceT("Scanned this session")} bodyClass="p-0">
            {log.length ? (
              <ul className="divide-y divide-line text-sm">{log.map((l, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-1.5">
                  <span className="w-12 text-2xs text-ink-faint">{l.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <DiagnosticButton className="font-medium tnum hover:underline" onClick={() => l.sample && setOpen(l.sample.id)}>{l.sample?.sample_no || l.code}</DiagnosticButton>
                  <span className={cx('flex-1 truncate', l.ok ? 'text-ink-soft' : 'text-crit')}>{l.ok ? `${fullName(l.sample)}${l.again ? ', duplicate scan' : ''}` : l.error}</span>
                </li>
              ))}</ul>
            ) : <Empty title={referenceT("Nothing scanned yet")} />}
          </Section>
        </div>
        <Section title={referenceT("Collected, not yet received")} bodyClass="p-0">
          <PagedTable result={transit.data} loading={transit.loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} dense
            empty="Every collected tube has been received" onRowClick={(r: any) => setOpen(r.id)} columns={[
              { key: 'sample_no', header: 'Sample', render: (r: any) => <div><div className="font-medium tnum">{r.sample_no}</div>{r.external_sample_no && <div className="text-2xs text-ink-soft">{r.facility}: {r.external_sample_no}</div>}</div> },
              { key: 'patient', header: 'Patient', render: (r: any) => fullName(r) },
              { key: 'tests', header: 'Tests' },
              { key: 'collected_at', header: 'Collected', render: (r: any) => ago(r.collected_at) },
              { key: 'rx', header: '', render: (r: any) => <Button size="sm" onClick={(e) => { e.stopPropagation(); receive(r.sample_no); }}><ReferenceText message="Receive" /></Button> },
            ]} />
        </Section>
      </div>
      <RejectModal sample={reject} open={!!reject} onClose={() => setReject(null)} onDone={(s) => { toast.warn(`Sample ${s.sample_no} rejected.`); setLog((l) => l.map((x) => (x.sample?.id === s.id ? { ...x, sample: s } : x))); }} />
      <SampleDrawer id={open} onClose={() => setOpen(null)} onChanged={transit.reload} />
    </>
  );
}
