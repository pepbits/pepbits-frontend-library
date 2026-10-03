'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { Printer, Search } from 'lucide-react';
import { useApi, useFmt } from '../../../lib/client';
import { PageHeader, StatusBadge, ModalityChip, Empty } from '../../../components/ui';
import PaymentModal from '../../../components/PaymentModal';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function Billing() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [pay, setPay] = useState<any>(null);
  const params = new URLSearchParams({ ...(status && { status }), ...(q && { q }) });
  const { data, reload } = useApi<any>(`/api/billing?${params}`);
  const s = data?.summary || {};

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Billing")} subtitle={referenceT("An invoice is raised automatically for every order, priced from the procedure master.")} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Billed', s.billed, ''], ['Collected', s.collected, 'text-ok'], ['Outstanding', s.outstanding, 'text-stat'], ['Collected on invoices raised today', s.today, '']].map(([l, v, c]) => (
          <div key={l as string} className="panel px-4 py-3"><div className="text-[13px] text-ink-soft">{l}</div><div className={`mt-1 text-2xl font-bold tabular-nums ${c}`}>{fmt.money(v as number)}</div></div>
        ))}
      </div>
      <div className="panel">
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" />
            <DiagnosticInput className="field pl-9" placeholder={referenceT("Invoice, accession, MRN or name")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search invoices")} />
          </div>
          <DiagnosticSelect className="field w-44" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={referenceT("Invoice status")}>
            <option value=""><ReferenceText message="All invoices" /></option><option value="UNPAID"><ReferenceText message="Unpaid" /></option><option value="PARTIAL"><ReferenceText message="Part paid" /></option><option value="PAID"><ReferenceText message="Paid" /></option><option value="CANCELLED"><ReferenceText message="Cancelled" /></option><option value="REFUNDED"><ReferenceText message="For refund" /></option>
          </DiagnosticSelect>
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Invoice" /></TableHead><TableHead><ReferenceText message="Date" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Exam" /></TableHead><TableHead><ReferenceText message="Payer" /></TableHead><TableHead className="text-right"><ReferenceText message="Net" /></TableHead><TableHead className="text-right"><ReferenceText message="Paid" /></TableHead><TableHead className="text-right"><ReferenceText message="Balance" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data?.rows || []).map((i: any) => {
                const bal = i.net - i.paid;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="id">{i.invoice_no}</TableCell>
                    <TableCell className="whitespace-nowrap text-ink-3">{fmt.date(i.created_at)}</TableCell>
                    <TableCell><div className="font-bold">{fmt.name(i)}</div><div className="id text-ink-soft">{i.mrn}</div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><ModalityChip code={i.modality_code} /><Link href={`/orders/${i.order_id}`} className="hover:underline">{i.procedure_name}</Link></div><div className="text-xs text-ink-soft"><ReferenceText message="CPT" /> {i.cpt} · <span className="id">{i.accession}</span></div></TableCell>
                    <TableCell className="text-ink-3">{fmt.status(i.payer)}{i.insurance && i.payer === 'INSURANCE' ? <div className="text-xs text-ink-soft">{i.insurance}</div> : null}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.money(i.net)}</TableCell>
                    <TableCell className="text-right tabular-nums text-ok">{fmt.money(i.paid)}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${bal > 0.001 && i.status !== 'CANCELLED' ? 'text-stat' : 'text-ink-soft'}`}>{fmt.money(i.status === 'CANCELLED' ? 0 : bal)}</TableCell>
                    <TableCell><StatusBadge status={i.status} label={i.status === 'PARTIAL' ? 'Part paid' : undefined} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {bal > 0.001 && !['CANCELLED', 'REFUNDED'].includes(i.status) && <DiagnosticButton className="btn-primary btn-sm" onClick={() => setPay(i)}><ReferenceText message="Take payment" /></DiagnosticButton>}
                        <Link href={`/print/invoice/${i.id}`} target="_blank" className="btn-ghost btn-sm" title={referenceT("Print receipt")}><Printer size={14} /></Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DiagnosticTable>
          {data && !data.rows.length && <Empty title={referenceT("No invoices match")} />}
        </div>
      </div>
      {pay && <PaymentModal invoice={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); reload(); }} />}
    </div>
  );
}
