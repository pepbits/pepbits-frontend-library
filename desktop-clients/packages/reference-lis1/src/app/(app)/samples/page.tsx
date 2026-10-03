'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Printer, Search } from 'lucide-react';

import { useApi, useDebounced } from '../../../lib/hooks';

import { Badge, Button, Card, Empty, ErrorNote, Input, Loading, Modal, PageHeader, Select, TubeChip } from '../../../components/ui';
import { StatusRail } from '../../../components/Rail';
import { SampleLabel } from '../../../components/SampleLabel';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function SamplesPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading } = useApi<any[]>('/samples', { q: dq, status });
  const [open, setOpen] = useState<any>(null);

  useEffect(() => {
    const id = sp.get('open');
    if (id) api.get(`/samples/${id}`).then(setOpen).catch(() => {});
  }, [sp]);
  const close = () => { setOpen(null); if (sp.get('open')) router.replace('/samples'); };

  return (
    <div>
      <PageHeader title={referenceT("Samples")} subtitle={referenceT("Every tube, the tests it carries across orders, and its journey")} />
      <ErrorNote error={error} />
      <Card bodyClass="p-0">
        <div className="flex gap-2 border-b border-line p-3">
          <div className="relative w-72"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8 font-mono" placeholder={referenceT("Sample number")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={referenceT("Any status")} options={['COLLECTED', 'ACCESSIONED', 'IN_PROCESS', 'SENT_OUT', 'COMPLETED', 'REJECTED'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ') }))} />
        </div>
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No samples")} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Sample" /></TableHead><TableHead><ReferenceText message="Type" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Tests (orders)" /></TableHead><TableHead><ReferenceText message="Collected" /></TableHead><TableHead><ReferenceText message="Accessioned" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => api.get(`/samples/${s.id}`).then(setOpen)}>
                  <TableCell><span className="inline-flex items-center gap-1.5"><TubeChip size="sm" color={s.container?.capColor} /><span className="font-mono text-xs font-medium">{s.sampleNo}</span></span></TableCell>
                  <TableCell className="text-sm">{s.sampleType?.name}</TableCell>
                  <TableCell className="text-sm">{s.patientName}<div className="font-mono text-xs2 text-ink-mute">{s.mrn}</div></TableCell>
                  <TableCell className="text-xs">{s.tests.map((t: any) => t.code).join(', ')}<div className="text-ink-mute">{[...new Set(s.tests.map((t: any) => t.orderNo))].join(', ')}</div></TableCell>
                  <TableCell className="text-xs">{fmtDateTime(s.collectedAt)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(s.accessionedAt)}</TableCell>
                  <TableCell><Badge value={s.status} />{s.priority === 'STAT' && <Badge value="STAT" className="ml-1" />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
        )}
      </Card>

      <Modal open={!!open} onClose={close} title={open ? <span className="flex items-center gap-2"><TubeChip color={open.container?.capColor} /><span className="font-mono">{open.sampleNo}</span><Badge value={open.status} /></span> : ''} width="max-w-4xl"
        footer={<Button icon={Printer} onClick={() => window.print()}><ReferenceText message="Reprint label" /></Button>}>
        {open && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div><div className="label"><ReferenceText message="Patient" /></div>{open.patient?.fullName}<div className="font-mono text-xs text-ink-soft">{open.patient?.mrn}</div></div>
              <div><div className="label"><ReferenceText message="Specimen" /></div>{open.sampleType?.name}<div className="text-xs text-ink-soft">{open.container?.name}</div></div>
              <div><div className="label"><ReferenceText message="Collected" /></div>{fmtDateTime(open.collectedAt)}<div className="text-xs text-ink-soft">{open.collectedByName}</div></div>
              <div><div className="label"><ReferenceText message="Accessioned" /></div>{fmtDateTime(open.accessionedAt)}<div className="text-xs text-ink-soft">{open.accessionedByName}</div></div>
            </div>
            {open.rejectionReason && <ErrorNote error={`Rejected: ${open.rejectionReason}`} />}
            <SampleLabel s={open} />
            <DiagnosticTable className="tbl card">
              <TableHeader><TableRow><TableHead><ReferenceText message="Test" /></TableHead><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Progress" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
              <TableBody>{open.tests.map((t: any) => (
                <TableRow key={t.id}><TableCell>{t.test?.name}</TableCell><TableCell><Link className="font-mono text-xs text-lab-700 hover:underline" href={`/orders/${t.orderId}`}>{t.order?.orderNo}</Link></TableCell><TableCell><StatusRail status={t.status} compact /></TableCell><TableCell><Badge value={t.status} /></TableCell></TableRow>
              ))}</TableBody>
            </DiagnosticTable>
            {open.messages?.length > 0 && (
              <div>
                <div className="mb-1 text-sm font-semibold"><ReferenceText message="Instrument messages" /></div>
                <DiagnosticTable className="tbl card">
                  <TableHeader><TableRow><TableHead><ReferenceText message="Time" /></TableHead><TableHead><ReferenceText message="Direction" /></TableHead><TableHead><ReferenceText message="Type" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Attempts" /></TableHead></TableRow></TableHeader>
                  <TableBody>{open.messages.map((m: any) => <TableRow key={m.id}><TableCell className="text-xs">{fmtDateTime(m.createdAt)}</TableCell><TableCell>{m.direction.toLowerCase()}</TableCell><TableCell>{m.messageType} · {m.format}</TableCell><TableCell><Badge value={m.status} /></TableCell><TableCell className="num">{m.attempts}</TableCell></TableRow>)}</TableBody>
                </DiagnosticTable>
              </div>
            )}
          </div>
        )}
      </Modal>
      {open && <div className="hidden print:block print-area"><SampleLabel s={open} /></div>}
    </div>
  );
}
