'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { Suspense, useState } from 'react';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { ArrowDownLeft, ArrowUpRight, PlugZap, RotateCw, Send, Search } from 'lucide-react';
import {useApi,useFmt} from '../../../lib/client';
import { PageHeader, StatusBadge, Tabs, Modal, useToast, Empty } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const pretty = (s?: string | null) => {
  if (!s) return '';
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s.replace(/\r/g, '\n'); }
};

function Payload({ label, text }: { label: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-ink-soft">{label}</div>
      <pre className="scroll-thin max-h-72 overflow-auto rounded-md bg-ink px-3 py-2 font-mono text-[12px] leading-relaxed text-[#D9E4EC]">{pretty(text)}</pre>
    </div>
  );
}

function Simulator({ onSent }: { onSent: () => void }) {
 const referenceT = useReferenceLocalization().t;

 const {api,fetch}=useDiagnosticClient();

  const toast = useToast();
  const { data: completed } = useApi<any[]>('/api/orders?status=COMPLETED,PRELIMINARY&limit=30');
  const [kind, setKind] = useState<'orm' | 'cancel' | 'oru' | 'adt' | 'bad' | 'fhir'>('orm');
  const [lastPlacer, setLastPlacer] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; body: string; status: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (k: typeof kind, acc?: string) => {
    setKind(k);setResult(null);
    try{const sample=await api('/api/integration/samples?'+new URLSearchParams({kind:k,placer:lastPlacer??'',accession:acc??completed?.[0]?.accession??''}));setLastPlacer(sample.placer);setText(sample.text);}catch(e:any){toast('error',e.message);}
  };

  const send = async () => {
    setBusy(true);
    try {
      const fhir = kind === 'fhir';
      const res = await fetch(fhir ? '/api/fhir/ServiceRequest' : '/api/integration/hl7', {
        method: 'POST', headers: { 'Content-Type': fhir ? 'application/fhir+json' : 'x-application/hl7-v2+er7', 'x-channel': 'Simulator' }, body: text,
      });
      const body = await res.text();
      setResult({ ok: res.ok, body, status: res.status });
      toast(res.ok ? 'ok' : 'error', res.ok ? 'Accepted by the RIS' : `Rejected: ${decodeURIComponent(res.headers.get('X-Ack-Note') || '') || 'see response'}`);
      onSent();
    } catch (e: any) { toast('error', e.message); } finally { setBusy(false); }
  };

  const items: [typeof kind, string][] = [['orm', 'New order (ORM NW)'], ['cancel', 'Cancel order (ORM CA)'], ['oru', 'Outside result (ORU)'], ['adt', 'Patient update (ADT A08)'], ['bad', 'Invalid order'], ['fhir', 'FHIR ServiceRequest']];
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm text-ink-soft"><ReferenceText message="Act as the HIS or EMR. Pick a sample, edit it if you like, and send it to the RIS. The response is the HL7 ACK or FHIR resource the sender would receive." /></p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {items.map(([k, l]) => (
            <DiagnosticButton key={k} onClick={() => load(k)} className={`rounded-full border px-3 py-1 text-xs font-bold ${kind === k ? 'border-petrol bg-petrol text-white' : 'border-line bg-white text-ink-3'}`}>{l}</DiagnosticButton>
          ))}
        </div>
        {kind === 'oru' && (
          <DiagnosticSelect className="field mb-2" onChange={(e) => load('oru', e.target.value)} aria-label={referenceT("Order the result belongs to")}>
            {(completed || []).map((o) => <option key={o.id} value={o.accession}>{o.accession} · {o.last_name} · {o.procedure_name}</option>)}
          </DiagnosticSelect>
        )}
        {kind === 'cancel' && !lastPlacer && <p className="mb-2 text-xs text-urgent"><ReferenceText message="Send a new order first; its placer number is used here." /></p>}
        <DiagnosticTextarea className="field h-72 font-mono text-[12px] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label={referenceT("Message")} />
        <DiagnosticButton className="btn-primary mt-2" disabled={busy} onClick={send}><Send size={15} /><ReferenceText message="Send to RIS" /></DiagnosticButton>
      </div>
      <div>
        {result ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-sm"><StatusBadge status={result.ok ? 'PROCESSED' : 'REJECTED'} /><span className="text-ink-soft"><ReferenceText message="HTTP" /> {result.status}</span></div>
            <Payload label={referenceT("Response")} text={result.body} />
            {result.ok && kind === 'orm' && <p className="mt-2 text-sm"><ReferenceText message="The order is now in the" /> <Link href="/orders" className="font-bold text-petrol hover:underline"><ReferenceText message="order list" /></Link> <ReferenceText message="with source HL7, and an outbound ORM was fanned out to subscribed systems." /></p>}
          </>
        ) : <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-line text-sm text-ink-soft"><ReferenceText message="The response will appear here." /></div>}
      </div>
    </div>
  );
}

function Integration() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api}=useDiagnosticClient();

  const sp = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<'log' | 'interfaces' | 'simulate' | 'endpoints'>(sp.get('q') ? 'log' : 'log');
  const [q, setQ] = useState(sp.get('q') || '');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const { data, reload } = useApi<any>(`/api/integration/messages?${new URLSearchParams({ ...(q && { q }), ...(direction && { direction }), ...(status && { status }) })}`, { poll: 10000 });
  const { data: lk, reload: reloadIf } = useApi<any>('/api/lookups');
  const [open, setOpen] = useState<any>(null);
  const [tests, setTests] = useState<Record<number, any>>({});

  const show = async (id: number) => setOpen(await api(`/api/integration/messages/${id}`));
  const retry = async (id: number) => {
    try { const r = await api(`/api/integration/messages/${id}/retry`, { method: 'POST' }); toast(r.status === 'SENT' ? 'ok' : 'error', r.status === 'SENT' ? 'Message delivered' : `Still failing: ${r.error}`); reload(); if (open) show(id); } catch (e: any) { toast('error', e.message); }
  };
  const test = async (i: any) => {
    setTests((t) => ({ ...t, [i.id]: { pending: true } }));
    try { const r = await api('/api/integration/test', { method: 'POST', json: { interfaceId: i.id } }); setTests((t) => ({ ...t, [i.id]: r })); } catch (e: any) { setTests((t) => ({ ...t, [i.id]: { ok: false, message: e.message } })); }
  };
  const st = data?.stats || {};
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title={referenceT("Integration")} subtitle={referenceT("HL7 v2, FHIR R4 and DICOM traffic between the RIS, HIS, EMR, modalities and other PACS.")} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['Inbound', st.inbound], ['Outbound', st.outbound], ['Pending', st.pending], ['Failed', st.failed], ['Rejected inbound', st.rejected]].map(([l, v]) => (
          <div key={l as string} className="panel px-4 py-3"><div className="text-[13px] text-ink-soft">{l}</div><div className={`text-2xl font-bold tabular-nums ${(l === 'Failed' || l === 'Rejected inbound') && v ? 'text-stat' : ''}`}>{v || 0}</div></div>
        ))}
      </div>
      <div className="panel">
        <div className="px-3 pt-1"><Tabs value={tab} onChange={setTab} items={[{ value: 'log', label: 'Message log' }, { value: 'interfaces', label: 'Interfaces' }, { value: 'simulate', label: 'Send test message' }, { value: 'endpoints', label: 'Endpoints' }]} /></div>

        {tab === 'log' && (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line p-3">
              <div className="relative w-full max-w-xs"><Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" /><DiagnosticInput className="field pl-9" placeholder={referenceT("Accession, control ID, type")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Search messages")} /></div>
              <DiagnosticSelect className="field w-36" value={direction} onChange={(e) => setDirection(e.target.value)} aria-label={referenceT("Direction")}><option value=""><ReferenceText message="Both ways" /></option><option value="IN"><ReferenceText message="Inbound" /></option><option value="OUT"><ReferenceText message="Outbound" /></option></DiagnosticSelect>
              <DiagnosticSelect className="field w-36" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={referenceT("Status")}><option value=""><ReferenceText message="Any status" /></option><option value="PROCESSED"><ReferenceText message="PROCESSED" /></option><option value="REJECTED"><ReferenceText message="REJECTED" /></option><option value="SENT"><ReferenceText message="SENT" /></option><option value="PENDING"><ReferenceText message="PENDING" /></option><option value="FAILED"><ReferenceText message="FAILED" /></option></DiagnosticSelect>
            </div>
            <div className="overflow-x-auto">
              <DiagnosticTable className="table-base">
                <TableHeader><TableRow><TableHead /><TableHead><ReferenceText message="Time" /></TableHead><TableHead><ReferenceText message="Type" /></TableHead><TableHead><ReferenceText message="Interface" /></TableHead><TableHead><ReferenceText message="Control ID" /></TableHead><TableHead><ReferenceText message="Accession" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Detail" /></TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {(data?.rows || []).map((m: any) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => show(m.id)}>
                      <TableCell>{m.direction === 'IN' ? <ArrowDownLeft size={16} className="text-petrol" aria-label={referenceT("Inbound")} /> : <ArrowUpRight size={16} className="text-ink-soft" aria-label={referenceT("Outbound")} />}</TableCell>
                      <TableCell className="whitespace-nowrap text-ink-3">{fmt.dateTime(m.created_at)}</TableCell>
                      <TableCell><b>{m.protocol}</b> <span className="text-ink-3">{m.message_type}</span></TableCell>
                      <TableCell className="text-ink-3">{m.interface_name || (m.direction === 'IN' ? 'External sender' : '—')}</TableCell>
                      <TableCell className="id text-ink-soft">{m.control_id || '—'}</TableCell>
                      <TableCell>{m.order_id ? <Link href={`/orders/${m.order_id}`} onClick={(e) => e.stopPropagation()} className="id text-petrol hover:underline">{m.accession}</Link> : <span className="id">{m.accession || '—'}</span>}</TableCell>
                      <TableCell><StatusBadge status={m.status} />{m.attempts > 1 && <span className="ml-1 text-xs text-ink-soft">×{m.attempts}</span>}</TableCell>
                      <TableCell className="max-w-xs"><span className="line-clamp-1 text-xs text-stat">{m.error}</span></TableCell>
                      <TableCell className="text-right">{m.direction === 'OUT' && ['FAILED', 'PENDING'].includes(m.status) && <DiagnosticButton className="btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); retry(m.id); }}><RotateCw size={13} /><ReferenceText message="Resend" /></DiagnosticButton>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DiagnosticTable>
              {data && !data.rows.length && <Empty title={referenceT("No messages match")} />}
            </div>
          </>
        )}

        {tab === 'interfaces' && (
          <ul>
            {(lk?.interfaces || []).map((i: any) => {
              const t = tests[i.id];
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-4 border-b border-line/70 px-4 py-3">
                  {i.direction === 'IN' ? <ArrowDownLeft size={20} className="text-petrol" /> : <ArrowUpRight size={20} className="text-ink-soft" />}
                  <div className="min-w-[240px] flex-1">
                    <div className="font-bold">{i.name} {!i.active && <span className="ml-1 text-xs font-normal text-ink-soft"><ReferenceText message="(inactive)" /></span>}</div>
                    <div className="text-sm text-ink-soft">{i.type.replace('_', ' ')} · {i.direction === 'IN' ? 'Inbound' : 'Outbound'} · <span className="id">{i.url || `${i.ae_title ? i.ae_title + '@' : ''}${i.host}:${i.port}`}</span></div>
                    {i.events && <div className="mt-1 flex flex-wrap gap-1">{i.events.split(',').filter(Boolean).map((e: string) => <span key={e} className="id rounded bg-paper px-1.5 text-[11px] text-ink-3">{e}</span>)}</div>}
                  </div>
                  <div className="w-72 text-sm">{t && (t.pending ? <span className="text-ink-soft"><ReferenceText message="Testing…" /></span> : <span className={t.ok ? 'text-ok' : 'text-stat'}><b>{t.ok ? 'Reachable' : 'Not reachable'}</b> · {t.message}{t.ms != null ? ` (${t.ms} ms)` : ''}</span>)}</div>
                  <DiagnosticButton className="btn-secondary btn-sm" onClick={() => test(i)}><PlugZap size={14} /><ReferenceText message="Test" /></DiagnosticButton>
                </li>
              );
            })}
            <li className="px-4 py-3 text-sm text-ink-soft"><ReferenceText message="Add or edit interfaces under" /> <Link href="/masters" className="font-bold text-petrol hover:underline"><ReferenceText message="Masters → Interfaces" /></Link>. <DiagnosticButton className="text-petrol hover:underline" onClick={reloadIf}><ReferenceText message="Refresh" /></DiagnosticButton></li>
          </ul>
        )}

        {tab === 'simulate' && <Simulator onSent={reload} />}

        {tab === 'endpoints' && (
          <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
            {[
              ['HL7 v2 inbound over MLLP', `tcp://<host>:2575`, 'Run npm run mllp. Accepts ORM^O01 (NW, CA, XO, SC), ORU^R01 and ADT. Replies with an ACK: AA accepted, AE validation error, AR processing error.'],
              ['HL7 v2 inbound over HTTP', `POST ${origin}/api/integration/hl7`, 'Body is the raw ER7 message. The response body is the ACK.'],
              ['FHIR ServiceRequest (order in)', `POST ${origin}/api/fhir/ServiceRequest`, 'Returns the created ServiceRequest with the accession identifier, or an OperationOutcome.'],
              ['FHIR search', `GET ${origin}/api/fhir/ServiceRequest?identifier=… · GET ${origin}/api/fhir/DiagnosticReport?identifier=…`, 'Order status and signed reports for EMRs that poll.'],
              ['Modality worklist', `GET ${origin}/api/mwl?ae=CT_SOMATOM`, 'Scheduled and arrived exams as MWL attributes, for modalities or a DICOM MWL bridge.'],
              ['DICOM C-STORE', 'AE RADIANT_RIS, port 11112', 'Run npm run dicom:scp. Images are archived and matched to orders on Accession Number (0008,0050).'],
              ['DICOMweb', `POST ${origin}/api/dicomweb/studies (STOW-RS) · GET …/studies (QIDO-RS)`, 'multipart/related; type="application/dicom" for STOW.'],
              ['Outbound', 'Configured per interface', 'ORM on order events, ORU (P/F/C) on sign-off, FHIR DiagnosticReport, and C-STORE routing when exams complete.'],
            ].map(([t, e, d]) => (
              <div key={t} className="rounded-md border border-line p-3"><div className="font-bold">{t}</div><div className="id mt-1 break-all text-petrol">{e}</div><p className="mt-1 text-ink-soft">{d}</p></div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <Modal open onClose={() => setOpen(null)} title={referenceT("{value0} {value1}", {value0: open.protocol, value1: open.message_type})} width="max-w-3xl"
          footer={<>{open.direction === 'OUT' && ['FAILED', 'PENDING'].includes(open.status) && <DiagnosticButton className="btn-secondary mr-auto" onClick={() => retry(open.id)}><RotateCw size={14} /><ReferenceText message="Resend" /></DiagnosticButton>}<DiagnosticButton className="btn-secondary" onClick={() => setOpen(null)}><ReferenceText message="Close" /></DiagnosticButton></>}>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge status={open.status} /><span>{open.direction === 'IN' ? 'Received' : 'Sent'} {fmt.dateTime(open.created_at)}</span>
            {open.interface_name && <span className="text-ink-soft"><ReferenceText message="via" /> {open.interface_name}</span>}
            {open.accession && <span className="id">{open.accession}</span>}
            <span className="text-ink-soft">{open.attempts} <ReferenceText message="attempt" />{open.attempts === 1 ? '' : 's'}</span>
          </div>
          {open.error && <p className="mb-3 rounded-md bg-stat-bg px-3 py-2 text-sm text-stat">{open.error}</p>}
          <div className="space-y-3"><Payload label={referenceT("Message")} text={open.payload} /><Payload label={open.direction === 'IN' ? 'Our reply' : 'Remote reply'} text={open.response} /></div>
        </Modal>
      )}
    </div>
  );
}

export default function IntegrationPage() { return <Suspense><Integration /></Suspense>; }
