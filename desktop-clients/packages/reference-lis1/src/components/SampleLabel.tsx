'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { Barcode } from './Barcode';


/** 50 x 25 mm style tube label. */
export function SampleLabel({ s }: { s: any }) {
 const {fmtDateTime}=useDiagnosticFormat();

  const tests: string[] = (s.tests || []).map((t: any) => t.code || t.test?.code).filter(Boolean);
  const patient = s.patient?.fullName || s.patientName;
  const mrn = s.patient?.mrn || s.mrn;
  return (
    <div className="avoid-break inline-block w-[250px] rounded border border-ink/30 bg-white px-2 py-1.5 text-[10px] leading-tight text-black">
      <div className="flex justify-between gap-2 font-semibold"><span className="truncate">{patient}</span><span>{s.priority === 'STAT' ? 'STAT' : ''}</span></div>
      <div className="flex justify-between text-[9px]"><span>{mrn}</span><span>{s.patient?.gender ?? ''} {s.patient?.age ?? ''}</span></div>
      <div className="my-0.5 flex justify-center"><Barcode value={s.sampleNo} height={30} width={1.25} fontSize={10} /></div>
      <div className="flex justify-between gap-1 text-[9px]"><span className="truncate">{s.sampleType?.name} · {tests.join(' ')}</span><span className="whitespace-nowrap">{fmtDateTime(s.collectedAt)}</span></div>
    </div>
  );
}
