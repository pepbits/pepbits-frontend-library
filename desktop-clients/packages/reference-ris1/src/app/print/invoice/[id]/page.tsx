'use client';
import {useDiagnosticResource,useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';

import {notFound} from '@pepbits/reference-diagnostics';
import PrintButton from '../../../../components/PrintButton';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


export const dynamic = 'force-dynamic';

const INSTITUTION = process.env.NEXT_PUBLIC_INSTITUTION || 'Radiant Imaging Centre';

export default function PrintInvoice({ params }: { params: { id: string } }) {
  const {fmtDateTime:d,fmtDate:dob,money}=useDiagnosticFormat();
  const {data,error}=useDiagnosticResource<any>(`/api/print/invoice/${params.id}`);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status"><ReferenceText message="Loading print document…" /></p>;
  const {i,payments}=data;
  const balance = i.net - i.paid;
  return (
    <>
      <PrintButton />
      <article className="mx-auto max-w-[720px] bg-white px-10 py-8 text-[14px] shadow-sm print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-petrol pb-3">
          <div><div className="text-xl font-bold text-petrol">{INSTITUTION}</div><div className="text-sm text-ink-soft"><ReferenceText message="Department of Radiology" /></div></div>
          <div className="text-right"><div className="font-bold">{i.paid >= i.net ? 'Receipt' : 'Invoice'}</div><div className="font-mono text-[12.5px]">{i.invoice_no}</div><div className="text-[12px] text-ink-soft">{d(i.created_at)}</div></div>
        </header>
        <div className="mt-4 grid grid-cols-2 gap-4 text-[13px]">
          <div><div className="text-ink-soft"><ReferenceText message="Billed to" /></div><b>{i.first_name} {i.last_name}</b><div className="font-mono">{i.mrn}</div><div>{i.address}</div><div>{i.phone}</div></div>
          <div className="text-right"><div className="text-ink-soft"><ReferenceText message="Payer" /></div><b>{i.payer === 'SELF' ? 'Self pay' : i.payer}</b>{i.payer === 'INSURANCE' && <div>{i.insurance}</div>}<div className="mt-1 text-ink-soft"><ReferenceText message="Accession" /> <span className="font-mono">{i.accession}</span></div></div>
        </div>
        <DiagnosticTable className="mt-6 w-full text-[13px]">
          <TableHeader><TableRow className="border-b border-line text-left text-ink-soft"><TableHead className="py-1.5"><ReferenceText message="Description" /></TableHead><TableHead><ReferenceText message="Code" /></TableHead><TableHead className="text-right"><ReferenceText message="Amount" /></TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow className="border-b border-line/60"><TableCell className="py-2">{i.procedure_name}</TableCell><TableCell className="font-mono"><ReferenceText message="CPT" /> {i.cpt}</TableCell><TableCell className="text-right">{money(i.amount)}</TableCell></TableRow>
            {i.discount > 0 && <TableRow><TableCell className="py-1" colSpan={2}><ReferenceText message="Discount" /></TableCell><TableCell className="text-right">−{money(i.discount)}</TableCell></TableRow>}
            {i.tax > 0 && <TableRow><TableCell className="py-1" colSpan={2}><ReferenceText message="Tax" /></TableCell><TableCell className="text-right">{money(i.tax)}</TableCell></TableRow>}
            <TableRow className="border-t border-ink font-bold"><TableCell className="py-2" colSpan={2}><ReferenceText message="Total" /></TableCell><TableCell className="text-right">{money(i.net)}</TableCell></TableRow>
            {payments.map((p: any) => <TableRow key={p.id} className="text-ink-3"><TableCell className="py-1" colSpan={2}><ReferenceText message="Paid by" /> {String(p.mode).toLowerCase()} {p.reference ? `(${p.reference})` : ''} · {d(p.received_at)}</TableCell><TableCell className="text-right">−{money(p.amount)}</TableCell></TableRow>)}
            <TableRow className="border-t border-line font-bold"><TableCell className="py-2" colSpan={2}>{i.status === 'CANCELLED' ? 'Cancelled' : 'Balance due'}</TableCell><TableCell className="text-right">{money(i.status === 'CANCELLED' ? 0 : balance)}</TableCell></TableRow>
          </TableBody>
        </DiagnosticTable>
        <p className="mt-8 text-center text-[12px] text-ink-soft"><ReferenceText message="Thank you. Please keep this receipt for your records." /></p>
      </article>
    </>
  );
}