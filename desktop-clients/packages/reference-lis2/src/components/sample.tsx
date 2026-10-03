'use client';
import {DiagnosticTable,TableBody,TableRow,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { Ban, FileText, Printer, RefreshCw } from 'lucide-react';

import {fullName,titleCase} from '../lib/format';
import { useOptions } from './refselect';
import { Button, DL, Field, Input, Loading, Modal, PriorityBadge, Select, StatusBadge, Textarea, useToast } from './ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function RejectModal({ sample, open, onClose, onDone }: { sample: any; open: boolean; onClose: () => void; onDone: (s: any) => void }) {
 const referenceT = useReferenceLocalization().t;

 const {post}=useDiagnosticClient();

  const {options:reasons,error:lookupError} = useOptions('rejection_reasons');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setReason(''); setNote(''); setErr(null); } }, [open]);
  const go = async () => {
    if (!reason) return setErr('Choose a reason');
    setBusy(true);
    try { onDone(await post(`/samples/${sample.id}/reject`, { reasonId: Number(reason), note })); onClose(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={referenceT("Reject sample {value0}", {value0: sample?.sample_no || ''})}
      footer={<><Button onClick={onClose}><ReferenceText message="Keep sample" /></Button><Button variant="danger" loading={busy} onClick={go}><ReferenceText message="Reject sample" /></Button></>}>
      <p className="mb-3 text-sm text-ink-soft"><ReferenceText message="Its tests return to the collection list for a new draw, and any analyzer orders are cancelled." /></p>
      <div className="space-y-3">
        {lookupError && <p role="alert">{lookupError}</p>}<Field label={referenceT("Reason *")}><Select value={reason} onChange={setReason} placeholder={referenceT("Choose")} options={reasons.map((r) => ({ value: r.id, label: r.label }))} /></Field>
        <Field label={referenceT("Note")}><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={referenceT("Who was informed, what was observed")} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-crit">{err}</p>}
    </Modal>
  );
}

export function SampleDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged?: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const {get,post,put}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const toast = useToast();
  const [s, setS] = useState<any>(null);
  const [reject, setReject] = useState(false);
  const [storage, setStorage] = useState('');
  const load = () => id && get(`/samples/${id}`).then((x) => { setS(x); setStorage(x.storage_location || ''); }).catch((e) => toast.error(e.message));
  useEffect(() => { setS(null); load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id) return null;
  return (
    <Modal side open onClose={onClose} title={s ? `Sample ${s.sample_no}` : 'Sample'}
      footer={s && <>
        <Link href={`/print/labels?ids=${s.id}`} target="_blank"><Button icon={<Printer className="h-4 w-4" />}><ReferenceText message="Reprint label" /></Button></Link>
        {s.status === 'RECEIVED' && <Button icon={<RefreshCw className="h-4 w-4" />} onClick={async () => { const r = await post(`/integration/samples/${s.id}/resend`); toast.ok(`Work order re-sent to ${r.analyzers} analyzer(s).`); load(); }}><ReferenceText message="Resend to analyzers" /></Button>}
        {s.status === 'RECEIVED' && <Link href={`/results/sample/${s.id}`}><Button variant="primary" icon={<FileText className="h-4 w-4" />}><ReferenceText message="Enter results" /></Button></Link>}
        {['COLLECTED', 'RECEIVED'].includes(s.status) && <Button variant="danger" icon={<Ban className="h-4 w-4" />} onClick={() => setReject(true)}><ReferenceText message="Reject" /></Button>}
      </>}>
      {!s ? <Loading /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={s.status} /><PriorityBadge priority={s.priority} /><span className="text-sm">{fullName(s)} <span className="text-ink-soft tnum">{s.mrn}, {s.age} {s.gender}</span></span></div>
          <DL cols={3} items={[
            ['Specimen', s.sample_type], ['Container', <span key="c" className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full border border-black/20" style={{ background: s.cap_color || '#ccc' }} />{s.container}</span>],
            ['Body site', s.body_site ? `${s.body_site}${s.laterality ? ` (${s.laterality})` : ''}` : null], ['Client barcode', s.external_sample_no], ['From', s.facility || 'This laboratory'], ['Storage', s.storage_temp && titleCase(s.storage_temp)],
            ['Collected', s.collected_at && `${fmtDateTime(s.collected_at)}${s.collected_by_name ? `, ${s.collected_by_name}` : ''}`], ['Received', s.received_at && `${fmtDateTime(s.received_at)}${s.received_by_name ? `, ${s.received_by_name}` : ''}`],
            ['Rejected for', s.rejection_reason && `${s.rejection_reason}${s.rejection_note ? `: ${s.rejection_note}` : ''}`],
          ]} />
          <div className="flex items-end gap-2">
            <Field label={referenceT("Storage location")} className="flex-1"><Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder={referenceT("e.g. Fridge 2, rack B, position 14")} /></Field>
            <Button onClick={async () => { await put(`/samples/${s.id}/storage`, { location: storage }); toast.ok('Storage location saved.'); load(); }}><ReferenceText message="Save" /></Button>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold"><ReferenceText message="Tests on this sample" /></h3>
            <DiagnosticTable className="w-full text-sm"><TableBody>{s.items.map((i: any) => (
              <TableRow key={i.id}><TableCell className="td font-medium">{i.test_code}</TableCell><TableCell className="td">{i.test_name}</TableCell><TableCell className="td"><Link className="link tnum" href={`/orders/${i.order_id}`}>{i.order_no}</Link></TableCell><TableCell className="td"><StatusBadge status={i.status} /></TableCell><TableCell className="td text-xs text-ink-soft">{i.due_at && `due ${fmtDateTime(i.due_at)}`}</TableCell></TableRow>
            ))}</TableBody></DiagnosticTable>
          </div>
          {s.instrumentOrders.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold"><ReferenceText message="Analyzer orders" /></h3>
              <DiagnosticTable className="w-full text-sm"><TableBody>{s.instrumentOrders.map((io: any) => (
                <TableRow key={io.id}><TableCell className="td">{io.analyzer_name}</TableCell><TableCell className="td">{io.test_code}</TableCell><TableCell className="td text-xs text-ink-soft"><ReferenceText message="codes" /> {io.order_codes}</TableCell><TableCell className="td"><StatusBadge status={io.status} /></TableCell><TableCell className="td text-xs">{fmtDateTime(io.resulted_at || io.sent_at || io.created_at)}</TableCell></TableRow>
              ))}</TableBody></DiagnosticTable>
            </div>
          )}
          <div>
            <h3 className="mb-1 text-sm font-semibold"><ReferenceText message="Chain of custody" /></h3>
            <ol className="relative ml-2 border-l border-line pl-4">
              {s.events.map((e: any) => {
                let d: any = null; try { d = JSON.parse(e.details); } catch { /* */ }
                return (
                  <li key={e.id} className="mb-2">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-hema-500" />
                    <div className="text-sm font-medium">{titleCase(e.event)}</div>
                    <div className="text-xs text-ink-soft">{fmtDateTime(e.at)}{e.user ? `, ${e.user}` : ''}{d?.reason ? `, ${d.reason}` : ''}{d?.note ? ` (${d.note})` : ''}{d?.location ? `, ${d.location}` : ''}{d?.lab ? `, ${d.lab}` : ''}{d?.from ? `, from ${d.from}` : ''}</div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
      <RejectModal sample={s} open={reject} onClose={() => setReject(false)} onDone={(x) => { toast.warn(`Sample ${x.sample_no} rejected; tests returned to collection.`); load(); onChanged?.(); }} />
    </Modal>
  );
}
