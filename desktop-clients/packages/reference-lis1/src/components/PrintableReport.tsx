'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { Fragment } from 'react';

import { Barcode } from './Barcode';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const PAPER: Record<string, string> = { A4: '210mm', A5: '148mm', LETTER: '216mm', LEGAL: '216mm' };
const PAPER_LANDSCAPE: Record<string, string> = { A4: '297mm', A5: '210mm', LETTER: '279mm', LEGAL: '356mm' };

/** Replaces {{lab.name}}, {{patient.fullName}}, {{order.orderNo}} ... in template HTML. */
function fill(html: string | null | undefined, ctx: any) {
  if (!html) return '';
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = path.split('.').reduce((o: any, k: string) => (o == null ? o : o[k]), ctx);
    return v == null ? '' : String(v).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  });
}

const flagStyle = (f: string) => (['LL', 'HH', 'AA'].includes(f) ? { color: '#B42318', fontWeight: 700 } : f ? { color: '#B4461A', fontWeight: 700 } : {});

/**
 * Renders a lab report exactly as configured by the chosen report template:
 * paper size, orientation, fonts, accent colour, header/footer HTML and which columns to show.
 */
export function PrintableReport({ r, watermark }: { r: any; watermark?: string }) {
 const referenceT = useReferenceLocalization().t;

 const {fmtDate,fmtDateTime}=useDiagnosticFormat();

  const t = r.template || {};
  const accent = t.accentColor || '#0E7C7B';
  const width = t.orientation === 'landscape' ? PAPER_LANDSCAPE[t.paperSize] || '297mm' : PAPER[t.paperSize] || '210mm';
  const ctx = { lab: r.lab, patient: r.patient, order: r.order, doctor: r.doctor || {}, report: r.report || {} };
  const cols = [
    { key: 'name', label: 'Test', show: true },
    { key: 'value', label: 'Result', show: true },
    { key: 'flag', label: 'Flag', show: t.showFlags !== false },
    { key: 'unit', label: 'Units', show: t.showUnits !== false },
    { key: 'ref', label: 'Reference interval', show: t.showReferenceRange !== false },
    { key: 'method', label: 'Method', show: !!t.showMethod },
    { key: 'loinc', label: 'LOINC', show: !!t.showLoinc },
  ].filter((c) => c.show);
  const status = r.report?.status || (r.pending?.length ? 'PARTIAL' : 'FINAL');

  return (
    <div className="print-area relative mx-auto bg-white text-black shadow-sm" style={{ width, maxWidth: '100%', fontFamily: t.fontFamily || 'Georgia, serif', fontSize: `${t.fontSizePx || 12}px`, padding: '14mm 12mm' }}>
      <style>{referenceT("@media print { @page { size: {value0} {value1}; margin: 10mm; } }", {value0: t.paperSize || 'A4', value1: t.orientation || 'portrait'})}</style>
      {watermark && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[64px] font-bold uppercase text-black/5" style={{ transform: 'rotate(-24deg)' }}>{watermark}</div>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-3" style={{ borderBottom: `2px solid ${accent}` }}>
        <div className="flex items-start gap-3">
          {t.logoUrl && <img src={t.logoUrl} alt="" style={{ maxHeight: 56, maxWidth: 160 }} />}
          {t.headerHtml ? <div dangerouslySetInnerHTML={{ __html: fill(t.headerHtml, ctx) }} /> : (
            <div>
              <div style={{ fontSize: '1.5em', fontWeight: 700, color: accent }}>{r.lab?.name}</div>
              <div style={{ whiteSpace: 'pre-line', fontSize: '0.9em' }}>{r.lab?.address}</div>
              <div style={{ fontSize: '0.9em' }}>{[r.lab?.phone, r.lab?.email].filter(Boolean).join(' · ')}</div>
              {r.lab?.accreditation && <div style={{ fontSize: '0.85em', color: '#555' }}>{r.lab.accreditation}</div>}
            </div>
          )}
        </div>
        <div className="text-right" style={{ fontSize: '0.9em' }}>
          <div style={{ fontSize: '1.2em', fontWeight: 700 }}><ReferenceText message="Laboratory report" /></div>
          {r.report && <div><ReferenceText message="Report" /> {r.report.reportNo} <ReferenceText message="· version" /> {r.report.version}</div>}
          <div style={{ fontWeight: 700, color: status === 'FINAL' ? '#127A4B' : status === 'AMENDED' ? '#B4461A' : '#A15C07' }}>{status === 'PARTIAL' ? 'Partial report' : status === 'AMENDED' ? 'Amended report' : 'Final report'}</div>
          {t.showBarcode !== false && <div className="mt-1 flex justify-end"><Barcode value={r.order.orderNo} height={26} width={1.1} fontSize={9} /></div>}
        </div>
      </div>

      {/* Patient block */}
      <DiagnosticTable className="my-3 w-full" style={{ fontSize: '0.95em', borderCollapse: 'collapse' }}>
        <TableBody>
          <TableRow>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Patient" /></TableCell><TableCell className="py-0.5 pr-6 font-bold">{r.patient.fullName}</TableCell>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Order" /></TableCell><TableCell className="py-0.5">{r.order.orderNo}{r.order.externalOrderNo ? ` (${r.order.externalOrderNo})` : ''}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="MRN" /></TableCell><TableCell className="py-0.5 pr-6">{r.patient.mrn}</TableCell>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Registered" /></TableCell><TableCell className="py-0.5">{fmtDateTime(r.order.createdAt)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Sex / age" /></TableCell><TableCell className="py-0.5 pr-6">{r.patient.gender} · {r.patient.age} <ReferenceText message="(DOB" /> {fmtDate(r.patient.dob)})</TableCell>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Collected" /></TableCell><TableCell className="py-0.5">{r.samples?.map((s: any) => `${s.sampleNo} ${fmtDateTime(s.collectedAt)}`).join('; ') || '—'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Referred by" /></TableCell><TableCell className="py-0.5 pr-6">{r.doctor?.name || 'Self'}</TableCell>
            <TableCell className="py-0.5 pr-2" style={{ color: '#555' }}><ReferenceText message="Reported" /></TableCell><TableCell className="py-0.5">{fmtDateTime(r.report?.lastReleasedAt || new Date())}</TableCell>
          </TableRow>
        </TableBody>
      </DiagnosticTable>

      {/* Results by department */}
      {r.departments.map((dep: any, di: number) => (
        <div key={dep.id} className={di > 0 && t.pageBreakPerDepartment ? 'page-break' : ''}>
          <div className="mt-3 px-2 py-1" style={{ background: `${accent}14`, color: accent, fontWeight: 700, borderLeft: `3px solid ${accent}` }}>{dep.name}</div>
          {dep.tests.map((test: any) => (
            <div key={test.orderTestId} className="avoid-break mt-2">
              <div className="flex items-baseline justify-between">
                <div style={{ fontWeight: 700 }}>{test.name}{test.amended ? <span style={{ color: '#B4461A', fontWeight: 400 }}> <ReferenceText message="· amended" /></span> : null}</div>
                <div style={{ fontSize: '0.8em', color: '#666' }}>{[test.sampleType, test.bodySite, test.sampleNo, test.isOutsourced ? 'performed at reference laboratory' : null].filter(Boolean).join(' · ')}{t.showMethod && test.method ? ` · ${test.method}` : ''}</div>
              </div>
              <DiagnosticTable className="mt-1 w-full" style={{ borderCollapse: 'collapse' }}>
                <TableHeader>
                  <TableRow>{cols.map((c) => <TableHead key={c.key} className="py-1 pr-2 text-left" style={{ fontSize: '0.85em', color: '#555', borderBottom: '1px solid #ccc', fontWeight: 600 }}><ReferenceText message={c.label} /></TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {test.rows.map((row: any, i: number) => (
                    <Fragment key={i}>
                      {row.section && row.section !== test.rows[i - 1]?.section && <TableRow><TableCell colSpan={cols.length} className="pt-1.5" style={{ fontStyle: 'italic', color: '#555' }}>{row.section}</TableCell></TableRow>}
                      <TableRow style={{ borderBottom: '1px solid #eee' }}>
                        {cols.map((c) => {
                          if (c.key === 'name') return <TableCell key={c.key} className="py-1 pr-2">{row.name}</TableCell>;
                          if (c.key === 'value') return <TableCell key={c.key} className="py-1 pr-2" style={{ ...flagStyle(row.flag), whiteSpace: row.resultType === 'MEMO' ? 'pre-line' : undefined }}>{row.value || '—'}{row.comment ? <div style={{ fontSize: '0.8em', color: '#666', fontWeight: 400 }}>{row.comment}</div> : null}</TableCell>;
                          if (c.key === 'flag') return <TableCell key={c.key} className="py-1 pr-2" style={flagStyle(row.flag)}>{row.flag}</TableCell>;
                          if (c.key === 'unit') return <TableCell key={c.key} className="py-1 pr-2">{row.unit}</TableCell>;
                          if (c.key === 'ref') return <TableCell key={c.key} className="py-1 pr-2" style={{ whiteSpace: 'pre-line' }}>{row.referenceText}</TableCell>;
                          if (c.key === 'method') return <TableCell key={c.key} className="py-1 pr-2">{row.method}</TableCell>;
                          return <TableCell key={c.key} className="py-1 pr-2">{row.loinc}</TableCell>;
                        })}
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </DiagnosticTable>
              {t.showInterpretation !== false && test.interpretation && <div className="mt-1" style={{ fontSize: '0.85em', color: '#444' }}><b><ReferenceText message="Interpretation:" /></b> {test.interpretation}</div>}
              <div className="mt-0.5 text-right" style={{ fontSize: '0.75em', color: '#777' }}>{test.validatedByName ? `Validated by ${test.validatedByName}` : ''}{test.signedByName ? ` · signed by ${test.signedByName} ${fmtDateTime(test.signedAt)}` : ''}</div>
            </div>
          ))}
        </div>
      ))}

      {r.pending?.length > 0 && <div className="mt-3" style={{ fontSize: '0.9em' }}><b><ReferenceText message="Pending:" /></b> {r.pending.map((p: any) => p.name).join(', ')} <ReferenceText message="– will follow in a later version of this report." /></div>}

      {r.amendments?.length > 0 && (
        <div className="avoid-break mt-3 p-2" style={{ border: '1px solid #F0CDB6', background: '#FFF9F5', fontSize: '0.9em' }}>
          <b><ReferenceText message="Amendments" /></b>
          {r.amendments.map((a: any, i: number) => <div key={i}>{fmtDateTime(a.completedAt)} · {a.test}: {a.reason}{a.author ? ` (${a.author})` : ''}</div>)}
        </div>
      )}
      {r.addenda?.length > 0 && (
        <div className="avoid-break mt-3 p-2" style={{ border: `1px solid ${accent}55`, fontSize: '0.9em' }}>
          <b><ReferenceText message="Addendum" /></b>
          {r.addenda.map((a: any) => <div key={a.id} className="mt-1" style={{ whiteSpace: 'pre-line' }}>{a.text}<div style={{ fontSize: '0.8em', color: '#666' }}>{a.author} · {fmtDateTime(a.createdAt)}</div></div>)}
        </div>
      )}

      {/* Signatures */}
      {r.signers?.length > 0 && (
        <div className="avoid-break mt-8 flex flex-wrap justify-end gap-10">
          {r.signers.map((s: any, i: number) => (
            <div key={i} className="min-w-[160px] text-center">
              <div style={{ fontFamily: 'cursive', fontSize: '1.2em' }}>{s.signatureText || s.fullName}</div>
              <div className="pt-1" style={{ borderTop: '1px solid #999', fontSize: '0.85em' }}>{s.fullName}{s.qualification ? `, ${s.qualification}` : ''}<div style={{ color: '#666' }}>{t.signatureLabel || 'Pathologist'}</div></div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-2" style={{ borderTop: '1px solid #ddd', fontSize: '0.75em', color: '#666' }}>
        {t.disclaimer && <div style={{ whiteSpace: 'pre-line' }}>{t.disclaimer}</div>}
        {t.footerHtml && <div dangerouslySetInnerHTML={{ __html: fill(t.footerHtml, ctx) }} />}
        <div className="mt-1 text-center"><ReferenceText message="— End of report —" /></div>
      </div>
    </div>
  );
}
