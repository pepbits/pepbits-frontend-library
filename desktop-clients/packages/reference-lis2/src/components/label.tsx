'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {DiagnosticBarcode} from '@pepbits/reference-diagnostics';


export const Barcode=DiagnosticBarcode;

/** 50 × 25 mm specimen label. */
export function SpecimenLabel({ l }: { l: any }) {
 const {fmtDateTime}=useDiagnosticFormat();

  return (
    <div className="flex h-[25mm] w-[50mm] flex-col justify-between overflow-hidden border border-dashed border-line-strong bg-white px-[2mm] py-[1.2mm] text-[7pt] leading-tight text-black print:border-0" style={{ breakInside: 'avoid' }}>
      <div className="flex justify-between gap-1 font-semibold"><span className="truncate">{l.patient}</span><span className="shrink-0">{l.age} {l.gender}</span></div>
      <Barcode value={l.sample_no} height={26} className="h-[9mm] w-full" />
      <div className="flex justify-between gap-1"><span className="font-semibold">{l.sample_no}</span><span>{l.mrn}</span></div>
      <div className="flex justify-between gap-1"><span className="truncate">{l.sample_type}: {l.tests.join(' ')}</span>{l.priority !== 'ROUTINE' && <b className="shrink-0">{l.priority}</b>}</div>
      <div className="text-[6pt] text-neutral-600">{fmtDateTime(l.collected_at)}{l.external_sample_no ? ` ext ${l.external_sample_no}` : ''}</div>
    </div>
  );
}
