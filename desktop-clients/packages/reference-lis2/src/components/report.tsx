'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {age,fullName} from '../lib/format';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';


const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** Fills {{placeholders}} in template HTML; strips scripts and inline handlers. */
export function fillTemplate(html: string | null | undefined, ctx: Record<string, any>) {
  if (!html) return '';
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
  return clean.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => esc(k.split('.').reduce((o: any, p: string) => (o == null ? undefined : o[p]), ctx) ?? ''));
}

const flagStyle = (r: any, tpl: any) => {
  const abn = r.flag && r.flag !== 'N';
  return { fontWeight: abn && tpl.highlight_abnormal ? 700 : 400, color: r.is_critical || r.flag === 'LL' || r.flag === 'HH' ? '#B71C1C' : '#000' };
};

/** Printable laboratory report, driven by a report template from master data. */
export function ReportDocument({ data, template }: { data: any; template?: any }) {
 const {fmtDate,fmtDateTime}=useDiagnosticFormat();

  const tpl = template || data.template || {};
  const { order, items, settings, printedAt } = data;
  const accent = tpl.accent_color || '#2f3a8f';
  const ctx = {
    lab: { name: settings['lab.name'], address: settings['lab.address'], phone: settings['lab.phone'], accreditation: settings['lab.accreditation'] },
    patient: { name: fullName(order), mrn: order.mrn, age: order.age, gender: order.gender, dob: fmtDate(order.dob) },
    order: { order_no: order.order_no, external_order_no: order.external_order_no, doctor: order.doctor, facility: order.facility },
    printed_at: fmtDateTime(printedAt),
  };
  const groups: [string, any[]][] = [];
  items.forEach((it: any) => { const g = groups.find((x) => x[0] === it.department); g ? g[1].push(it) : groups.push([it.department, [it]]); });
  const signers = [...new Map(items.filter((i: any) => i.signed_by_name).map((i: any) => [i.signed_by_name, i])).values()];
  const collected = items.map((i: any) => i.collected_at).filter(Boolean).sort()[0];
  const received = items.map((i: any) => i.received_at).filter(Boolean).sort()[0];
  const reported = items.map((i: any) => i.signed_at).filter(Boolean).sort().pop();
  const unsigned = items.some((i: any) => i.status !== 'SIGNED');
  const colCount = 3 + (tpl.show_flags ? 1 : 0) + (tpl.show_ref_range ? 1 : 0) + (tpl.show_previous ? 1 : 0);
  return (
    <div className="print-page relative mx-auto bg-white text-black shadow-pop" style={{ width: tpl.paper_size === 'A5' ? '148mm' : tpl.paper_size === 'LETTER' ? '216mm' : '210mm', minHeight: '270mm', padding: '12mm 14mm', fontFamily: tpl.font_family || 'IBM Plex Sans, Arial, sans-serif', fontSize: `${tpl.font_size || 10}pt`, lineHeight: 1.35 }}>
      {unsigned && <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"><span style={{ transform: 'rotate(-30deg)', fontSize: '42pt', color: 'rgba(198,40,40,.12)', fontWeight: 700 }}><ReferenceText message="PRELIMINARY, NOT SIGNED" /></span></div>}
      <header style={{ borderBottom: `2px solid ${accent}`, paddingBottom: '3mm', marginBottom: '3mm' }} dangerouslySetInnerHTML={{ __html: fillTemplate(tpl.header_html, ctx) || `<b>${esc(ctx.lab.name)}</b>` }} />
      <DiagnosticTable style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92em', marginBottom: '4mm' }}>
        <TableBody>
          <TableRow><Cell k="Patient" v={<b>{fullName(order)}</b>} /><Cell k="MRN" v={order.mrn} /><Cell k="Age / sex" v={`${age(order.dob)} ${order.gender}`} /></TableRow>
          <TableRow><Cell k="Order" v={order.order_no} /><Cell k="Client order" v={order.external_order_no ? `${order.facility || ''} ${order.external_order_no}` : null} /><Cell k="Date of birth" v={fmtDate(order.dob)} /></TableRow>
          <TableRow><Cell k="Referred by" v={order.doctor || order.facility} /><Cell k="Location" v={[order.location, order.bed].filter(Boolean).join(', ') || order.encounter_type} /><Cell k="Encounter" v={order.external_encounter_no || order.encounter_no} /></TableRow>
          <TableRow><Cell k="Collected" v={fmtDateTime(collected)} /><Cell k="Received" v={fmtDateTime(received)} /><Cell k="Reported" v={fmtDateTime(reported)} /></TableRow>
        </TableBody>
      </DiagnosticTable>
      {groups.map(([dept, list], gi) => (
        <section key={dept} style={{ breakBefore: tpl.group_by_department && gi > 0 ? 'page' : 'auto' }}>
          <h2 style={{ color: accent, fontSize: '1.15em', fontWeight: 600, borderBottom: `1px solid ${accent}55`, margin: '3mm 0 1.5mm' }}>{dept}</h2>
          {list.map((it: any) => {
            const memo = it.results.filter((r: any) => r.result_type === 'MEMO');
            const tab = it.results.filter((r: any) => r.result_type !== 'MEMO');
            const amendment = [...it.versions].reverse().find((v: any) => v.kind === 'AMENDMENT');
            const addenda = it.versions.filter((v: any) => v.kind === 'ADDENDUM');
            let section = '';
            return (
              <div key={it.id} style={{ breakInside: 'avoid', marginBottom: '3.5mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4mm' }}>
                  <b style={{ fontSize: '1.05em' }}>{it.test_name}{it.test_loinc && tpl.show_loinc ? <span style={{ fontWeight: 400, color: '#555' }}> <ReferenceText message="(LOINC" /> {it.test_loinc})</span> : null}</b>
                  <span style={{ fontSize: '0.85em', color: '#444' }}>{it.sample_type}{it.body_site ? `, ${it.body_site}` : ''}<ReferenceText message=", sample" /> {it.sample_no}{tpl.show_method && it.method ? `, ${it.method}` : ''}{it.outsource_lab ? `, performed at ${it.outsource_lab}` : ''}</span>
                </div>
                {amendment && <p style={{ margin: '1mm 0', padding: '1mm 2mm', background: '#FFF4E0', fontSize: '0.9em' }}><b><ReferenceText message="Amended report" /></b> <ReferenceText message="(version" /> {amendment.version}, {fmtDateTime(amendment.signed_at)}): {amendment.reason}<ReferenceText message=". This report replaces all earlier versions." /></p>}
                {tab.length > 0 && (
                  <DiagnosticTable style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1mm' }}>
                    <TableHeader><TableRow style={{ borderBottom: '1px solid #999', textAlign: 'left', fontSize: '0.85em', color: '#333' }}>
                      <TableHead style={{ padding: '1mm 1mm 1mm 0', width: '38%' }}><ReferenceText message="Investigation" /></TableHead><TableHead style={{ padding: '1mm' }}><ReferenceText message="Result" /></TableHead>{tpl.show_flags ? <TableHead style={{ padding: '1mm' }}><ReferenceText message="Flag" /></TableHead> : null}
                      <TableHead style={{ padding: '1mm' }}><ReferenceText message="Unit" /></TableHead>{tpl.show_ref_range ? <TableHead style={{ padding: '1mm' }}><ReferenceText message="Reference interval" /></TableHead> : null}{tpl.show_previous ? <TableHead style={{ padding: '1mm' }}><ReferenceText message="Previous" /></TableHead> : null}
                    </TableRow></TableHeader>
                    <TableBody>
                      {tab.map((r: any) => {
                        const head = r.section_title && r.section_title !== section ? (section = r.section_title) : null;
                        return [
                          head && <TableRow key={`h${r.id}`}><TableCell colSpan={colCount} style={{ paddingTop: '1.5mm', fontWeight: 600, fontSize: '0.9em' }}>{head}</TableCell></TableRow>,
                          <TableRow key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                            <TableCell style={{ padding: '0.8mm 1mm 0.8mm 0' }}>{r.name}{tpl.show_loinc && r.loinc_num ? <span style={{ color: '#777', fontSize: '0.8em' }}> {r.loinc_num}</span> : null}{r.comment ? <div style={{ fontSize: '0.82em', color: '#444' }}>{r.comment}</div> : null}</TableCell>
                            <TableCell style={{ padding: '0.8mm 1mm', ...flagStyle(r, tpl), fontVariantNumeric: 'tabular-nums' }}>{r.value}</TableCell>
                            {tpl.show_flags ? <TableCell style={{ padding: '0.8mm 1mm', ...flagStyle(r, tpl) }}>{r.flag && r.flag !== 'N' ? r.flag : ''}</TableCell> : null}
                            <TableCell style={{ padding: '0.8mm 1mm', color: '#333' }}>{r.unit}</TableCell>
                            {tpl.show_ref_range ? <TableCell style={{ padding: '0.8mm 1mm', color: '#333' }}>{r.ref_text}</TableCell> : null}
                            {tpl.show_previous ? <TableCell style={{ padding: '0.8mm 1mm', color: '#555', fontSize: '0.88em' }}>{r.prev_value ? `${r.prev_value} (${fmtDate(r.prev_at)})` : ''}</TableCell> : null}
                          </TableRow>,
                        ];
                      })}
                    </TableBody>
                  </DiagnosticTable>
                )}
                {memo.map((r: any) => <div key={r.id} style={{ marginTop: '2mm' }}><div style={{ fontWeight: 600, fontSize: '0.92em' }}>{r.name}</div><div style={{ whiteSpace: 'pre-wrap' }}>{r.value}</div></div>)}
                {it.interpretation && <p style={{ marginTop: '1.5mm', fontSize: '0.92em' }}><b><ReferenceText message="Interpretation:" /> </b>{it.interpretation}</p>}
                {addenda.map((a: any) => <p key={a.id} style={{ marginTop: '1.5mm', padding: '1mm 2mm', borderLeft: `3px solid ${accent}`, fontSize: '0.92em' }}><b><ReferenceText message="Addendum" /></b> ({fmtDateTime(a.signed_at)}, {a.signed_by_name}): {a.addendum_text}</p>)}
              </div>
            );
          })}
        </section>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14mm', marginTop: '10mm', breakInside: 'avoid' }}>
        {signers.map((s: any) => (
          <div key={s.signed_by_name} style={{ textAlign: 'center', minWidth: '45mm' }}>
            <div style={{ fontStyle: 'italic', fontSize: '1.1em', color: accent }}>{s.signed_by_name}</div>
            <div style={{ borderTop: '1px solid #000', marginTop: '1mm', paddingTop: '1mm', fontSize: '0.85em', whiteSpace: 'pre-wrap' }}>{s.signature_text || [s.signed_by_name, s.signed_by_qualification].filter(Boolean).join('\n')}</div>
          </div>
        ))}
      </div>
      {tpl.disclaimer && <p style={{ marginTop: '6mm', fontSize: '0.8em', color: '#555' }}>{tpl.disclaimer}</p>}
      <p style={{ textAlign: 'center', fontSize: '0.8em', margin: '3mm 0' }}><ReferenceText message="End of report" /></p>
      <footer style={{ borderTop: '1px solid #ccc', paddingTop: '2mm', fontSize: '0.8em', color: '#444' }} dangerouslySetInnerHTML={{ __html: fillTemplate(tpl.footer_html, ctx) }} />
    </div>
  );
}
function Cell({ k, v }: { k: string; v: any }) {
  return <TableCell style={{ padding: '0.6mm 2mm 0.6mm 0', verticalAlign: 'top', width: '33%' }}><span style={{ color: '#555', fontSize: '0.9em' }}>{k}: </span>{v || '–'}</TableCell>;
}
