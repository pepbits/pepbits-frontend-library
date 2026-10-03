'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import {useReferenceRouter as useRouter} from '@pepbits/reference-host';
import { Search } from 'lucide-react';
import { useApi, useCurrency, useDebounced } from '../../../lib/hooks';

import { Badge, Card, Empty, ErrorNote, Input, Loading, PageHeader, Select, Stat } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function BillingPage() {
 const referenceT = useReferenceLocalization().t;

 const {fmtDateTime,money}=useDiagnosticFormat();

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading } = useApi<any[]>('/billing/invoices', { q: dq, status });
  const router = useRouter();
  const currency = useCurrency();
  const rows = data || [];
  const sum = (k: string) => rows.filter((r) => r.status !== 'CANCELLED').reduce((s, r) => s + (r[k] || 0), 0);

  return (
    <div>
      <PageHeader title={referenceT("Billing")} subtitle={referenceT("Invoices, payments, refunds and outstanding balances")} />
      <ErrorNote error={error} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label={referenceT("Billed (listed)")} value={money(sum('netAmount'), currency)} />
        <Stat label={referenceT("Collected")} value={money(sum('paidAmount'), currency)} tone="ok" />
        <Stat label={referenceT("Outstanding")} value={money(sum('netAmount') - sum('paidAmount'), currency)} tone={sum('netAmount') - sum('paidAmount') > 0 ? 'warn' : undefined} />
      </div>
      <Card bodyClass="p-0">
        <div className="flex gap-2 border-b border-line p-3">
          <div className="relative w-72"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Invoice, order, MRN or name")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={referenceT("Any status")} options={['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
        </div>
        {loading && !data ? <Loading /> : !rows.length ? <Empty title={referenceT("No invoices")} hint={referenceT("Bill an order from its order page.")} /> : (
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Invoice" /></TableHead><TableHead><ReferenceText message="Date" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Payer" /></TableHead><TableHead className="text-right"><ReferenceText message="Net" /></TableHead><TableHead className="text-right"><ReferenceText message="Paid" /></TableHead><TableHead className="text-right"><ReferenceText message="Due" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => router.push(`/billing/${i.id}`)}>
                  <TableCell className="font-mono text-xs font-medium">{i.invoiceNo}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(i.createdAt)}</TableCell>
                  <TableCell>{i.patientName}<div className="font-mono text-xs2 text-ink-mute">{i.mrn}</div></TableCell>
                  <TableCell className="font-mono text-xs">{i.orderNo}</TableCell>
                  <TableCell className="text-xs">{i.payerType}{i.payerName ? ` · ${i.payerName}` : ''}</TableCell>
                  <TableCell className="num text-right">{money(i.netAmount, currency)}</TableCell>
                  <TableCell className="num text-right">{money(i.paidAmount, currency)}</TableCell>
                  <TableCell className="num text-right">{i.status === 'CANCELLED' ? '—' : money(i.netAmount - i.paidAmount, currency)}</TableCell>
                  <TableCell><Badge value={i.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
        )}
      </Card>
    </div>
  );
}
