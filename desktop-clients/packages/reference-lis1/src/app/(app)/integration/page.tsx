'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import { useApi, useDebounced, useMaster } from '../../../lib/hooks';

import { Badge, Card, Empty, Field, Input, Loading, Modal, PageHeader, Select } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const pretty = (s?: string | null) => { if (!s) return ''; try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s.replace(/\r/g, '\n'); } };

export default function IntegrationLogs() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const [eventType, setEventType] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, loading } = useApi<any[]>('/integration/logs', { eventType, status, q: dq });
  const systems = useMaster('external-systems');
  const labs = useMaster('external-labs');
  const [view, setView] = useState<any>(null);
  const party = (l: any) => systems.find((s) => s.id === l.externalSystemId)?.name || labs.find((x) => x.id === l.externalLabId)?.name || '—';

  return (
    <div>
      <PageHeader title={referenceT("Integration logs")} subtitle={referenceT("Orders received from external systems, results published back, and reference-lab traffic")} />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <Input className="w-56" placeholder={referenceT("Reference (order no…)")} value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="w-48" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder={referenceT("Any event")} options={[{ value: 'ORDER_IN', label: 'Order received' }, { value: 'RESULT_OUT', label: 'Result published' }, { value: 'RESULT_IN', label: 'Reference-lab result' }, { value: 'MANIFEST_OUT', label: 'Manifest sent' }]} />
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={referenceT("Any status")} options={['SUCCESS', 'FAILED', 'ERROR'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
        </div>
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No integration traffic yet")} hint={referenceT("See the API guide for how external systems send orders.")} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Time" /></TableHead><TableHead><ReferenceText message="Event" /></TableHead><TableHead><ReferenceText message="Direction" /></TableHead><TableHead><ReferenceText message="Party" /></TableHead><TableHead><ReferenceText message="Reference" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
            <TableBody>{data.map((l) => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => setView(l)}>
                <TableCell className="text-xs">{fmtDateTime(l.createdAt)}</TableCell>
                <TableCell className="text-sm">{l.eventType?.replace('_', ' ').toLowerCase()}</TableCell>
                <TableCell className="text-xs">{l.direction?.toLowerCase()}</TableCell>
                <TableCell className="text-sm">{party(l)}</TableCell>
                <TableCell className="font-mono text-xs">{l.reference}</TableCell>
                <TableCell><Badge value={l.status} />{l.error && <div className="max-w-xs truncate text-xs2 text-flag-crit">{l.error}</div>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </DiagnosticTable>
        )}
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `${view.eventType} · ${view.reference ?? ''}` : ''} width="max-w-4xl">
        {view && <div className="space-y-3">
          {view.error && <div className="text-sm text-flag-crit">{view.error}</div>}
          <Field label={referenceT("Payload")}><pre className="max-h-80 overflow-auto rounded border border-line bg-paper p-3 font-mono text-xs">{pretty(view.payload)}</pre></Field>
          {view.response && <Field label={referenceT("Response")}><pre className="max-h-60 overflow-auto rounded border border-line bg-paper p-3 font-mono text-xs">{pretty(view.response)}</pre></Field>}
        </div>}
      </Modal>
    </div>
  );
}
