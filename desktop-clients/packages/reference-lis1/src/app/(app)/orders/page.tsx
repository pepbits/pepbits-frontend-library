'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Plus, Search } from 'lucide-react';
import { useApi, useCurrency, useDebounced } from '../../../lib/hooks';

import { Badge, Card, Empty, ErrorNote, Input, Loading, PageHeader, Select , DateInput} from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OrdersPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime,money}=useDiagnosticFormat();

  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading } = useApi<any[]>('/orders', { q: dq, status, source, from, to });
  const router = useRouter();
  const currency = useCurrency();

  return (
    <div>
      <PageHeader title={referenceT("Orders")} subtitle={referenceT("Internal and externally received lab orders")}
        actions={<Link href="/orders/new" className="inline-flex items-center gap-1.5 rounded border border-lab-700 bg-lab-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-lab-700"><Plus className="h-4 w-4" /><ReferenceText message="New order" /></Link>} />
      <ErrorNote error={error} />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
          <div className="relative w-72"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Order no, MRN, name, external no")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={referenceT("Any status")} options={['NEW', 'IN_PROGRESS', 'PARTIAL', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) }))} />
          <Select className="w-36" value={source} onChange={(e) => setSource(e.target.value)} placeholder={referenceT("Any source")} options={[{ value: 'INTERNAL', label: 'Internal' }, { value: 'EXTERNAL', label: 'External' }]} />
          <DateInput  className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} title={referenceT("From")} />
          <DateInput  className="w-40" value={to} onChange={(e) => setTo(e.target.value)} title={referenceT("To")} />
        </div>
        {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No orders")} hint={referenceT("Orders placed here or received from external systems appear in this list.")} /> : (
          <div className="overflow-x-auto">
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Placed" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Priority" /></TableHead><TableHead><ReferenceText message="Source" /></TableHead><TableHead><ReferenceText message="Tests" /></TableHead><TableHead className="text-right"><ReferenceText message="Total" /></TableHead><TableHead className="text-right"><ReferenceText message="Balance" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
              <TableBody>
                {data.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                    <TableCell className="font-mono text-xs font-medium">{o.orderNo}{o.externalOrderNo && <div className="text-xs2 text-ink-mute"><ReferenceText message="ext" /> {o.externalOrderNo}</div>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(o.createdAt)}</TableCell>
                    <TableCell>{o.patientName}<div className="font-mono text-xs2 text-ink-mute">{o.mrn}</div></TableCell>
                    <TableCell><Badge value={o.priority} /></TableCell>
                    <TableCell><Badge value={o.source} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(o.statusCounts || {}).map(([s, n]) => <Badge key={s} value={s} label={referenceT("{value0} {value1}", {value0: String(n), value1: s.toLowerCase().replace('_', ' ')})} />)}
                      </div>
                    </TableCell>
                    <TableCell className="num text-right">{money(o.total, currency)}</TableCell>
                    <TableCell className="num text-right">{o.unbilled > 0 ? <span className="text-flag-warn">{money(o.unbilled, currency)} <ReferenceText message="unbilled" /></span> : o.balance > 0 ? <span className="text-flag-crit">{money(o.balance, currency)}</span> : <span className="text-ink-mute">—</span>}</TableCell>
                    <TableCell><Badge value={o.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DiagnosticTable>
          </div>
        )}
      </Card>
    </div>
  );
}
