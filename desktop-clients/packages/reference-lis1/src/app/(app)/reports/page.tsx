'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { Search } from 'lucide-react';
import { useApi, useDebounced } from '../../../lib/hooks';

import { Badge, Card, Empty, Input, Loading, PageHeader, Select } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function ReportsPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime}=useDiagnosticFormat();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDebounced(q);
  const { data, loading } = useApi<any[]>('/reports', { q: dq, status });
  const router = useRouter();
  return (
    <div>
      <PageHeader title={referenceT("Reports")} subtitle={referenceT("Released reports with version history. A report is created on first signature and re-versioned on amendments and addenda.")} />
      <Card bodyClass="p-0">
        <div className="flex gap-2 border-b border-line p-3">
          <div className="relative w-72"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Report, order, MRN or name")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={referenceT("Any status")} options={[{ value: 'PARTIAL', label: 'Partial' }, { value: 'FINAL', label: 'Final' }, { value: 'AMENDED', label: 'Amended' }]} />
        </div>
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No reports released yet")} hint={referenceT("Reports appear after a pathologist signs the first test of an order.")} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Report" /></TableHead><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Version" /></TableHead><TableHead><ReferenceText message="Last released" /></TableHead><TableHead><ReferenceText message="Published" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
            <TableBody>{data.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/reports/${r.orderId}`)}>
                <TableCell className="font-mono text-xs font-medium">{r.reportNo}</TableCell>
                <TableCell className="font-mono text-xs">{r.orderNo} {r.priority === 'STAT' && <Badge value="STAT" />} {r.source === 'EXTERNAL' && <Badge value="EXTERNAL" />}</TableCell>
                <TableCell>{r.patientName}<div className="font-mono text-xs2 text-ink-mute">{r.mrn}</div></TableCell>
                <TableCell className="num"><ReferenceText message="v" />{r.version}</TableCell>
                <TableCell className="text-xs">{fmtDateTime(r.lastReleasedAt)}</TableCell>
                <TableCell className="text-xs">{r.lastPublishedStatus || '—'}</TableCell>
                <TableCell><Badge value={r.status} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </DiagnosticTable>
        )}
      </Card>
    </div>
  );
}
