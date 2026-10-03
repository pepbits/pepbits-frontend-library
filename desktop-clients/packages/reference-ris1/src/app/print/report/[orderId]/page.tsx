'use client';
import {useDiagnosticResource,useDiagnosticFormat} from '@pepbits/reference-diagnostics';

import {notFound} from '@pepbits/reference-diagnostics';
import PrintButton from '../../../../components/PrintButton';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


export const dynamic = 'force-dynamic';

const INSTITUTION = process.env.NEXT_PUBLIC_INSTITUTION || 'Radiant Imaging Centre';

export default function PrintReport({ params }: { params: { orderId: string } }) {
  const {fmtDateTime:d,fmtDate:dob,money}=useDiagnosticFormat();
  const {data,error}=useDiagnosticResource<any>(`/api/print/report/${params.orderId}`);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p role="status"><ReferenceText message="Loading print document…" /></p>;
  const {o,r,crit}=data;
  const amended = r?.status === 'CORRECTED' ? r.versions.find((v: any) => String(v.reason).startsWith('Amended')) : null;
  const Section = ({ t, v, bold }: { t: string; v?: string; bold?: boolean }) => v ? (
    <section className="mt-4"><h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-soft">{t}</h3><p className={`whitespace-pre-wrap leading-relaxed ${bold ? 'font-bold' : ''}`}>{v}</p></section>
  ) : null;

  return (
    <>
      <PrintButton />
      <article className="relative mx-auto max-w-[800px] bg-white px-12 py-10 text-[14px] text-ink shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {r?.status === 'PRELIMINARY' && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[90px] font-bold text-stat/10 [transform:rotate(-24deg)]"><ReferenceText message="PRELIMINARY" /></div>}
        <header className="flex items-start justify-between border-b-2 border-petrol pb-3">
          <div>
            <div className="text-2xl font-bold text-petrol">{INSTITUTION}</div>
            <div className="text-sm text-ink-soft"><ReferenceText message="Department of Radiology" /></div>
          </div>
          <div className="text-right text-sm">
            <div className="font-bold"><ReferenceText message="Radiology report" /></div>
            <div className="font-mono text-[12.5px]">{o.accession}</div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 rounded-md bg-paper px-4 py-3 text-[13px] print:bg-white print:ring-1 print:ring-line">
          <div><span className="text-ink-soft"><ReferenceText message="Patient:" /></span> <b>{o.last_name.toUpperCase()}, {o.first_name}</b></div>
          <div><span className="text-ink-soft"><ReferenceText message="MRN:" /></span> <span className="font-mono">{o.mrn}</span></div>
          <div><span className="text-ink-soft"><ReferenceText message="Date of birth:" /></span> {dob(o.dob)} · {o.sex}</div>
          <div><span className="text-ink-soft"><ReferenceText message="Referrer:" /></span> {o.referrer_name || '—'}</div>
          <div><span className="text-ink-soft"><ReferenceText message="Examination:" /></span> <b>{o.procedure_name}</b></div>
          <div><span className="text-ink-soft"><ReferenceText message="Exam date:" /></span> {d(o.exam_completed_at || o.exam_started_at || o.ordered_at)}</div>
          <div><span className="text-ink-soft"><ReferenceText message="Priority:" /></span> {o.priority}</div>
          <div><span className="text-ink-soft"><ReferenceText message="Patient class:" /></span> {({ OP: 'Outpatient', IP: 'Inpatient', ER: 'Emergency' } as any)[o.patient_class]}</div>
        </div>

        {!r ? <p className="mt-8 text-center text-ink-soft"><ReferenceText message="No report has been written for this examination yet." /></p> : (
          <>
            {r.status === 'PRELIMINARY' && <p className="mt-4 rounded bg-urgent-bg px-3 py-2 text-[13px] font-bold text-urgent"><ReferenceText message="Preliminary report. Not yet verified by an attending radiologist; findings may change." /></p>}
            {amended && <p className="mt-4 rounded bg-urgent-bg px-3 py-2 text-[13px] text-urgent"><b><ReferenceText message="Amended report (version" /> {r.version}).</b> {amended.reason.replace(/^Amended:\s*/, 'Reason: ')}</p>}
            <Section t="Clinical history" v={o.clinical_history || o.reason} />
            <Section t="Technique" v={[r.technique, o.contrast_used ? `Contrast: ${o.contrast_used}.` : '', o.dose_dlp ? `Dose: CTDIvol ${o.dose_ctdivol ?? '—'} mGy, DLP ${o.dose_dlp} mGy·cm.` : ''].filter(Boolean).join(' ')} />
            <Section t="Comparison" v={r.comparison} />
            <Section t="Findings" v={r.findings} />
            <Section t="Impression" v={r.impression} bold />
            {r.addenda.map((a: any) => (
              <section key={a.id} className="mt-4 border-l-4 border-urgent pl-3">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-urgent"><ReferenceText message="Addendum ·" /> {d(a.signed_at)}</h3>
                <p className="whitespace-pre-wrap">{a.text}</p>
                <p className="text-[12px] text-ink-soft">{a.author_name}</p>
              </section>
            ))}
            {crit && <p className="mt-4 text-[13px]"><b><ReferenceText message="Critical result communication:" /></b> {crit.category} <ReferenceText message="discussed with" /> {crit.communicated_to} <ReferenceText message="by" /> {String(crit.method).toLowerCase().replace('_', ' ')} <ReferenceText message="on" /> {d(crit.communicated_at)}{crit.readback ? ', with read-back' : ''}.</p>}
            <footer className="mt-10 flex items-end justify-between border-t border-line pt-3 text-[13px]">
              <div>
                {r.signed_name ? <>
                  <div className="font-bold">{r.signed_signature || r.signed_name}</div>
                  <div className="text-ink-soft">{r.signed_title}</div>
                  <div className="text-ink-soft"><ReferenceText message="Electronically signed" /> {d(r.signed_at)}</div>
                </> : <>
                  <div className="font-bold">{r.prelim_name || r.author_name}</div>
                  <div className="text-ink-soft"><ReferenceText message="Preliminary," /> {d(r.prelim_at)}</div>
                </>}
              </div>
              <div className="text-right text-[11px] text-ink-soft"><ReferenceText message="Report version" />{r.version}<br /><ReferenceText message="Printed" /> {d(new Date().toISOString())}
              </div>
            </footer>
          </>
        )}
      </article>
    </>
  );
}