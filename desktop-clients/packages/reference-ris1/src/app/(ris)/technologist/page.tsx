'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { Play, Scan, CheckCircle2, Images, AlertTriangle, Loader2 } from 'lucide-react';
import {useApi,useFmt} from '../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, Empty, Modal, Field, useToast } from '../../../components/ui';
import { useOrderAction } from '../../../components/OrderActions';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


function CompleteModal({ order, onClose, onDone }: { order: any; onClose: () => void; onDone: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const [f, setF] = useState({ contrast_used: order.procedure_contrast ? 'Iohexol 350, 80 mL IV' : '', dose_ctdivol: '', dose_dlp: '', tech_notes: '' });
  const { run, busy } = useOrderAction(onDone);
  const noImages = !order.image_count;
  const [force, setForce] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open onClose={onClose} title={referenceT("Complete exam")}
      footer={<><DiagnosticButton className="btn-secondary" onClick={onClose}><ReferenceText message="Back" /></DiagnosticButton>
        <DiagnosticButton className="btn-primary" disabled={busy || (noImages && !force)} onClick={() => run(order.id, 'complete', { ...f, force }, 'Exam complete. It is now on the reading worklist.')}><ReferenceText message="Complete and send to reading" /></DiagnosticButton></>}>
      <p className="mb-3 text-sm"><b>{order.procedure_name}</b> <ReferenceText message="for" /> {order.first_name} {order.last_name} · <span className="id">{order.accession}</span></p>
      {noImages ? (
        <div className="mb-3 rounded-md border border-urgent/40 bg-urgent-bg px-3 py-2 text-sm text-urgent">
          <b><ReferenceText message="No images have arrived in PACS for this accession." /></b><ReferenceText message="Send images from the modality first, or confirm the exam was completed without images." /><label className="mt-2 flex items-center gap-2 font-bold"><DiagnosticInput type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-urgent" /><ReferenceText message="Complete without images" /></label>
        </div>
      ) : <p className="mb-3 text-sm text-ok"><b>{order.image_count} <ReferenceText message="images" /></b> <ReferenceText message="received in PACS." /></p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={referenceT("Contrast given")} className="col-span-2"><DiagnosticInput className="field" value={f.contrast_used} onChange={set('contrast_used')} placeholder={referenceT("None")} /></Field>
        {order.modality_code === 'CT' && <>
          <Field label={referenceT("CTDIvol (mGy)")}><DiagnosticInput type="number" step="0.1" className="field" value={f.dose_ctdivol} onChange={set('dose_ctdivol')} /></Field>
          <Field label={referenceT("DLP (mGy·cm)")}><DiagnosticInput type="number" step="1" className="field" value={f.dose_dlp} onChange={set('dose_dlp')} /></Field>
        </>}
        <Field label={referenceT("Technologist notes")} className="col-span-2" hint={referenceT("Visible to the radiologist when reporting.")}><DiagnosticTextarea className="field" rows={3} value={f.tech_notes} onChange={set('tech_notes')} placeholder={referenceT("Positioning, motion, patient comments")} /></Field>
      </div>
    </Modal>
  );
}

export default function Technologist() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api}=useDiagnosticClient();

  const { data: lk } = useApi<any>('/api/lookups');
  const [mod, setMod] = useState('');
  const { data, reload } = useApi<any[]>(`/api/orders?view=tech${mod ? `&modality=${mod}` : ''}`, { poll: 15000 });
  const { run, busy } = useOrderAction(reload);
  const [completing, setCompleting] = useState<any>(null);
  const [acq, setAcq] = useState<number | null>(null);
  const toast = useToast();

  const acquire = async (o: any) => {
    setAcq(o.id);
    try {
      const r = await api(`/api/orders/${o.id}/images`, { method: 'POST' });
      toast('ok', `${r.images} images stored in PACS for ${o.accession}`);
      reload();
    } catch (e: any) { toast('error', e.message); } finally { setAcq(null); }
  };

  const active = (data || []).filter((o) => o.status !== 'COMPLETED');
  const done = (data || []).filter((o) => o.status === 'COMPLETED');

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Technologist worklist")} subtitle={referenceT("Patients checked in and ready for imaging. Images sent from the modality match automatically on accession number.")} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        <DiagnosticButton className={`btn-sm rounded-full border px-3 ${!mod ? 'border-petrol bg-petrol text-white' : 'border-line bg-white'}`} onClick={() => setMod('')}><ReferenceText message="All rooms" /></DiagnosticButton>
        {(lk?.modalities || []).map((m: any) => (
          <DiagnosticButton key={m.code} className={`btn-sm rounded-full border px-3 font-bold ${mod === m.code ? 'border-petrol bg-petrol text-white' : 'border-line bg-white text-ink-3'}`} onClick={() => setMod(m.code)}>{m.code}</DiagnosticButton>
        ))}
      </div>

      <div className="panel mb-5">
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Priority" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Exam" /></TableHead><TableHead><ReferenceText message="Safety" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Images" /></TableHead><TableHead className="text-right"><ReferenceText message="Actions" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {active.map((o) => {
                const allergy = o.allergies && !/^none/i.test(o.allergies);
                return (
                  <TableRow key={o.id} className={o.priority === 'STAT' ? 'bg-stat-bg/40' : ''}>
                    <TableCell><PriorityBadge priority={o.priority} /><div className="mt-1 text-xs text-ink-soft">{o.status === 'IN_PROGRESS' ? `started ${fmt.ago(o.exam_started_at)}` : `waiting ${fmt.ago(o.arrived_at || o.scheduled_at)}`}</div></TableCell>
                    <TableCell><Link href={`/orders/${o.id}`} className="font-bold hover:underline">{fmt.name(o)}</Link><div className="text-xs text-ink-soft"><span className="id">{o.accession}</span> · {fmt.age(o.dob)} {o.sex} · {o.patient_class}</div></TableCell>
                    <TableCell><div className="flex items-center gap-2"><ModalityChip code={o.modality_code} /><span>{o.procedure_name}</span></div>
                      {o.clinical_history && <div className="mt-0.5 line-clamp-1 max-w-sm text-xs text-ink-soft">{o.clinical_history}</div>}</TableCell>
                    <TableCell className="text-xs">
                      {allergy && <div className="flex items-center gap-1 font-bold text-stat"><AlertTriangle size={12} />{o.allergies}</div>}
                      {o.procedure_contrast ? <div className="font-bold text-urgent"><ReferenceText message="Contrast study" /></div> : null}
                      {o.prep && <div className="text-ink-soft">{o.prep}</div>}
                      {!allergy && !o.procedure_contrast && !o.prep && <span className="text-ink-soft">—</span>}
                    </TableCell>
                    <TableCell><StatusBadge status={o.status} />{o.technologist_name && <div className="mt-0.5 text-xs text-ink-soft">{o.technologist_name}</div>}</TableCell>
                    <TableCell>{o.image_count ? <Link href={`/viewer/${o.study_id}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold text-petrol hover:underline"><Images size={14} />{o.image_count}</Link> : <span className="text-sm text-ink-soft"><ReferenceText message="None yet" /></span>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {o.status === 'ARRIVED' && <DiagnosticButton className="btn-primary btn-sm" disabled={busy} onClick={() => run(o.id, 'start', {}, 'Exam started')}><Play size={14} /><ReferenceText message="Start" /></DiagnosticButton>}
                        {o.status === 'IN_PROGRESS' && <>
                          <DiagnosticButton className="btn-secondary btn-sm" disabled={acq === o.id} onClick={() => acquire(o)} title={referenceT("Generate synthetic images and send them to PACS as the modality would")}>
                            {acq === o.id ? <Loader2 size={14} className="animate-spin" /> : <Scan size={14} />}{o.image_count ? 'Acquire more' : 'Acquire images'}
                          </DiagnosticButton>
                          <DiagnosticButton className="btn-primary btn-sm" onClick={() => setCompleting(o)}><CheckCircle2 size={14} /><ReferenceText message="Complete" /></DiagnosticButton>
                        </>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DiagnosticTable>
          {data && !active.length && <Empty title={referenceT("No patients waiting for imaging")}><ReferenceText message="Checked-in patients appear here." /></Empty>}
        </div>
      </div>

      {done.length > 0 && (
        <section className="panel">
          <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Completed in the last 24 hours" /></h2></div>
          <ul>
            {done.map((o) => (
              <li key={o.id} className="flex items-center gap-3 border-b border-line/60 px-4 py-2 text-sm last:border-0">
                <ModalityChip code={o.modality_code} /><Link href={`/orders/${o.id}`} className="font-bold hover:underline">{fmt.name(o)}</Link>
                <span className="flex-1 truncate text-ink-3">{o.procedure_name}</span>
                <span className="text-xs text-ink-soft">{o.image_count || 0} <ReferenceText message="images · done" /> {fmt.time(o.exam_completed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {completing && <CompleteModal order={completing} onClose={() => setCompleting(null)} onDone={() => { setCompleting(null); reload(); }} />}
    </div>
  );
}
