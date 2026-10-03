'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useRef, useState } from 'react';
import { Upload, Images, Link2, Send, Trash2, Search, Server } from 'lucide-react';
import {useApi,useFmt} from '../../../lib/client';
import { PageHeader, StatusBadge, ModalityChip, Empty, Modal, Field, useToast, useSession } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const mb = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function Pacs() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api,fetch}=useDiagnosticClient();

  const [q, setQ] = useState('');
  const [unmatched, setUnmatched] = useState(false);
  const { data, reload } = useApi<any[]>(`/api/dicom/studies?${new URLSearchParams({ ...(q && { q }), ...(unmatched && { unmatched: '1' }) })}`, { poll: 20000 });
  const { data: lk } = useApi<any>('/api/lookups');
  const { user } = useSession();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reconcile, setReconcile] = useState<any>(null);
  const [acc, setAcc] = useState('');
  const [route, setRoute] = useState<any>(null);
  const [dest, setDest] = useState('');
  const dicomDests = (lk?.interfaces || []).filter((i: any) => i.type === 'DICOM');

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      list.forEach((f) => form.append('files', f));
      const r = await fetch('/api/dicom/ingest', { method: 'POST', body: form, headers: { 'x-calling-ae': 'WEB_UPLOAD' } });
      const j = await r.json();
      const matched = j.results?.filter((x: any) => x.matchedOrderId).length || 0;
      const failed = j.results?.filter((x: any) => !x.ok) || [];
      if (j.stored) toast('ok', `Stored ${j.stored} of ${j.received} files${matched ? `, ${matched} matched to orders` : ', not matched to an order yet'}`);
      if (failed.length) toast('error', `${failed.length} file${failed.length > 1 ? 's' : ''} rejected: ${failed[0].error}`);
      reload();
    } catch (e: any) { toast('error', e.message); } finally { setUploading(false); }
  };

  const doReconcile = async () => {
    try {
      await api(`/api/dicom/studies/${reconcile.id}/reconcile`, { method: 'POST', json: { accession: acc } });
      toast('ok', `Study linked to ${acc}`);
      setReconcile(null); reload();
    } catch (e: any) { toast('error', e.message); }
  };
  const doRoute = async () => {
    try {
      await api(`/api/dicom/studies/${route.id}/route`, { method: 'POST', json: { interfaceId: Number(dest) } });
      toast('ok', 'Study queued for sending. Progress is in the integration message log.');
      setRoute(null);
    } catch (e: any) { toast('error', e.message); }
  };
  const del = async (s: any) => {
    if (!confirm(`Delete study ${s.description || s.study_uid} and its ${s.num_instances} images from the archive? This cannot be undone.`)) return;
    try { await api(`/api/dicom/studies/${s.id}`, { method: 'DELETE' }); toast('ok', 'Study deleted'); reload(); } catch (e: any) { toast('error', e.message); }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title={referenceT("PACS archive")} subtitle={referenceT("Studies received by C-STORE, STOW-RS or upload. Studies are matched to orders on accession number.")} />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <div
          className={`panel flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-4 py-6 text-center lg:col-span-2 ${drag ? 'border-petrol bg-petrol-light' : 'border-line'}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}>
          <Upload size={26} className="mb-2 text-petrol" />
          <div className="font-bold">{uploading ? 'Receiving…' : 'Drop DICOM files here or click to choose'}</div>
          <div className="mt-1 text-sm text-ink-soft"><ReferenceText message="Part 10 files (.dcm). Run" /> <code className="id"><ReferenceText message="npm run dicom:samples" /></code> <ReferenceText message="to generate test files for every modality." /></div>
          <DiagnosticInput ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
        </div>
        <div className="panel p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-bold"><Server size={16} /><ReferenceText message="Receiving endpoints" /></div>
          <dl className="grid grid-cols-[92px_1fr] gap-y-1.5">
            <dt className="text-ink-soft"><ReferenceText message="C-STORE SCP" /></dt><dd><span className="id"><ReferenceText message="RADIANT_RIS" /></span> <ReferenceText message="on port" /> <span className="id">11112</span><div className="text-xs text-ink-soft"><ReferenceText message="Start with npm run dicom:scp" /></div></dd>
            <dt className="text-ink-soft"><ReferenceText message="STOW-RS" /></dt><dd className="id break-all"><ReferenceText message="POST /api/dicomweb/studies" /></dd>
            <dt className="text-ink-soft"><ReferenceText message="QIDO-RS" /></dt><dd className="id break-all"><ReferenceText message="GET /api/dicomweb/studies" /></dd>
            <dt className="text-ink-soft"><ReferenceText message="MWL" /></dt><dd className="id break-all"><ReferenceText message="GET /api/mwl?modality=CT" /></dd>
          </dl>
        </div>
      </div>

      <div className="panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative w-full max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" />
            <DiagnosticInput className="field pl-9" placeholder={referenceT("Accession, patient, description")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search studies")} />
          </div>
          <label className="flex items-center gap-2 text-sm"><DiagnosticInput type="checkbox" className="accent-petrol" checked={unmatched} onChange={(e) => setUnmatched(e.target.checked)} /><ReferenceText message="Only studies without an order" /></label>
          <span className="ml-auto text-sm text-ink-soft">{data?.length ?? 0} <ReferenceText message="studies" /></span>
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow><TableHead><ReferenceText message="Received" /></TableHead><TableHead><ReferenceText message="Patient (DICOM)" /></TableHead><TableHead><ReferenceText message="Study" /></TableHead><TableHead><ReferenceText message="Accession" /></TableHead><TableHead className="text-right"><ReferenceText message="Series / images" /></TableHead><TableHead><ReferenceText message="Size" /></TableHead><TableHead><ReferenceText message="From AE" /></TableHead><TableHead><ReferenceText message="Order" /></TableHead><TableHead className="text-right"><ReferenceText message="Actions" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data || []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-ink-3">{fmt.dateTime(s.received_at)}</TableCell>
                  <TableCell><div className="font-bold">{(s.patient_name || '').replace(/\^/g, ', ')}</div><div className="id text-ink-soft">{s.patient_id_dicom}</div></TableCell>
                  <TableCell><div className="flex items-center gap-2"><ModalityChip code={s.modality} /><span>{s.description}</span></div></TableCell>
                  <TableCell className="id">{s.accession || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.num_series} / {s.num_instances}</TableCell>
                  <TableCell className="text-ink-3">{mb(s.size_bytes)}</TableCell>
                  <TableCell className="id text-ink-3">{s.source_ae}</TableCell>
                  <TableCell>{s.order_id ? <Link href={`/orders/${s.order_id}`}><StatusBadge status={s.report_status || s.order_status} /></Link> : <span className="rounded bg-stat-bg px-1.5 py-0.5 text-xs font-bold text-stat"><ReferenceText message="Unmatched" /></span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/viewer/${s.id}`} target="_blank" className="btn-secondary btn-sm"><Images size={14} /><ReferenceText message="View" /></Link>
                      {!s.order_id && <DiagnosticButton className="btn-secondary btn-sm" onClick={() => { setReconcile(s); setAcc(s.accession || ''); }}><Link2 size={14} /><ReferenceText message="Match" /></DiagnosticButton>}
                      <DiagnosticButton className="btn-ghost btn-sm" title={referenceT("Send to another PACS")} onClick={() => { setRoute(s); setDest(String(dicomDests[0]?.id || '')); }}><Send size={14} /></DiagnosticButton>
                      {user?.role === 'ADMIN' && <DiagnosticButton className="btn-ghost btn-sm text-stat" title={referenceT("Delete study")} onClick={() => del(s)}><Trash2 size={14} /></DiagnosticButton>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
          {data && !data.length && <Empty title={unmatched ? 'Every study is matched to an order' : 'No studies in the archive'} />}
        </div>
      </div>

      {reconcile && (
        <Modal open onClose={() => setReconcile(null)} title={referenceT("Match study to an order")}
          footer={<><DiagnosticButton className="btn-secondary" onClick={() => setReconcile(null)}><ReferenceText message="Cancel" /></DiagnosticButton><DiagnosticButton className="btn-primary" disabled={!acc.trim()} onClick={doReconcile}><ReferenceText message="Match" /></DiagnosticButton></>}>
          <p className="mb-3 text-sm"><ReferenceText message="The study arrived as" /> <b>{reconcile.patient_name}</b> ({reconcile.patient_id_dicom}<ReferenceText message=") with accession" /> <span className="id">{reconcile.accession || 'blank'}</span><ReferenceText message=". Enter the RIS accession it belongs to. The DICOM header is left untouched; the link is kept in the RIS." /></p>
          <Field label={referenceT("RIS accession number")}><DiagnosticInput className="field font-mono" value={acc} onChange={(e) => setAcc(e.target.value)} autoFocus /></Field>
        </Modal>
      )}
      {route && (
        <Modal open onClose={() => setRoute(null)} title={referenceT("Send study to another system")}
          footer={<><DiagnosticButton className="btn-secondary" onClick={() => setRoute(null)}><ReferenceText message="Cancel" /></DiagnosticButton><DiagnosticButton className="btn-primary" disabled={!dest} onClick={doRoute}><ReferenceText message="Send" /></DiagnosticButton></>}>
          <p className="mb-3 text-sm"><ReferenceText message="Checks the destination with C-ECHO, then sends all" /> {route.num_instances} <ReferenceText message="images with C-STORE." /></p>
          {dicomDests.length ? (
            <Field label={referenceT("Destination")}>
              <DiagnosticSelect className="field" value={dest} onChange={(e) => setDest(e.target.value)}>
                {dicomDests.map((d: any) => <option key={d.id} value={d.id}>{d.name} · {d.ae_title}@{d.host}:{d.port}{d.active ? '' : ' (inactive)'}</option>)}
              </DiagnosticSelect>
            </Field>
          ) : <p className="text-sm text-ink-soft"><ReferenceText message="No DICOM destinations are configured. Add one under Masters → Interfaces." /></p>}
        </Modal>
      )}
    </div>
  );
}
