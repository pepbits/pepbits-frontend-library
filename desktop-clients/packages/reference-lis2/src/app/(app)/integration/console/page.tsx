'use client';
import {DiagnosticButton,DiagnosticTextarea,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useEffect, useMemo, useState } from 'react';
import { Download, Send } from 'lucide-react';
import {API_URL} from '../../../../lib/api';
import { useResource } from '../../../../lib/hooks';

import { Badge, Button, ErrorBanner, Field, Loading, PageHeader, Section, Select, StatusBadge, Tabs, useToast } from '../../../../components/ui';
import { MessageView } from '../../../../components/message';
import { can, useUser } from '../../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type Proto = 'HL7V2' | 'ASTM' | 'FHIR_R4' | 'JSON';
const PATHS: Record<Proto, [string, string]> = {
  HL7V2: ['/integration/inbound/hl7', 'x-application/hl7-v2+er7'], ASTM: ['/integration/inbound/astm', 'text/plain'],
  FHIR_R4: ['/integration/inbound/fhir', 'application/fhir+json'], JSON: ['/integration/inbound/json', 'application/json'],
};
const ts = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const rnd = () => Math.random().toString(36).slice(2, 7).toUpperCase();

/** A plausible value for a parameter, taken from its own reference range (used to prefill result templates). */
function sampleValue(p: any) {
  if (p.result_type === 'OPTION') return p.options[0]?.value ?? '';
  if (p.result_type === 'NUMERIC') {
    const r = p.range;
    if (r?.low != null && r?.high != null) return (+((r.low + r.high) / 2).toFixed(p.decimals ?? 2)).toString();
    if (r?.high != null) return String(r.high / 2);
    if (r?.low != null) return String(r.low * 1.5);
    return '1';
  }
  return p.range?.normal_text || 'See report';
}

interface Template { key: string; label: string; protocol: Proto; sender: string; needsSample?: boolean; build: (ctx: any) => string }
const TEMPLATES: Template[] = [
  { key: 'orm', label: 'Order from client hospital (HL7 ORM^O01)', protocol: 'HL7V2', sender: 'CGH', build: () => {
    const o = `CGH-${rnd()}`;
    return [`MSH|^~\\&|CGH_HIS|CGH|LIS|CCL|${ts()}||ORM^O01|${o}|P|2.5.1`, `PID|1||H${rnd()}^^^CGH^MR||Fernandes^Clara^M||19820714|F|||4 Lake Rd^^Metro||555-3100`,
      `PV1|1|O|OPD1||||||||||||||||V${rnd()}`, `ORC|NW|${o}-1||${o}|||^^^^^R`, `OBR|1|${o}-1||CBC01^Full blood count^L|R||${ts()}`, `SPM|1|${o}-T1||BLD`,
      `ORC|NW|${o}-2||${o}`, `OBR|2|${o}-2||BMP01^Renal and electrolytes^L|R||${ts()}`, `SPM|1|${o}-T2||SER`].join('\n');
  } },
  { key: 'fhir', label: 'Order from clinic EMR (FHIR ServiceRequest bundle)', protocol: 'FHIR_R4', sender: 'SMC', build: () => {
    const id = rnd();
    return JSON.stringify({ resourceType: 'Bundle', type: 'transaction', entry: [
      { fullUrl: 'urn:uuid:pat', resource: { resourceType: 'Patient', identifier: [{ system: 'urn:smc:mrn', value: `SMC-${id}`, type: { coding: [{ code: 'MR' }] } }], name: [{ family: 'Okafor', given: ['Daniel'] }], birthDate: '1971-11-03', gender: 'male' } },
      { fullUrl: 'urn:uuid:spec', resource: { resourceType: 'Specimen', identifier: [{ value: `SMC-TUBE-${id}` }], collection: { collectedDateTime: new Date().toISOString() } } },
      { fullUrl: 'urn:uuid:sr1', resource: { resourceType: 'ServiceRequest', status: 'active', intent: 'order', priority: 'routine', identifier: [{ value: `SR-${id}-1` }], requisition: { value: `REQ-${id}` },
        code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }] }, subject: { reference: 'urn:uuid:pat' }, specimen: [{ reference: 'urn:uuid:spec' }] } },
    ] }, null, 2);
  } },
  { key: 'jsonorder', label: 'Order in custom JSON', protocol: 'JSON', sender: 'CGH', build: () => JSON.stringify({
    type: 'ORDER', orderNo: `CGH-J-${rnd()}`, priority: 'URGENT', clinicalInfo: 'Chest pain, rule out MI',
    patient: { id: `H${rnd()}`, firstName: 'Priya', lastName: 'Nair', dob: '1968-02-19', gender: 'F', phone: '555-8811' }, encounter: { id: `V${rnd()}`, type: 'ER' },
    tests: [{ code: 'LIP01', lineNo: '1' }, { code: 'A1C01', lineNo: '2' }],
  }, null, 2) },
  { key: 'oru', label: 'Results from middleware (HL7 ORU^R01)', protocol: 'HL7V2', sender: 'IF-DIIM', needsSample: true, build: ({ s, items }) => {
    const obx = items.filter((i: any) => !i.is_outsourced).flatMap((i: any) => i.parameters.filter((p: any) => p.result_type !== 'CALCULATED' && p.result_type !== 'MEMO'))
      .map((p: any, n: number) => `OBX|${n + 1}|${p.result_type === 'NUMERIC' ? 'NM' : 'ST'}|${p.code}^${p.name}||${sampleValue(p)}|${p.unit || ''}|||||F`);
    return [`MSH|^~\\&|IM|LABMW|LIS|CCL|${ts()}||ORU^R01|MW${rnd()}|P|2.5.1`, `PID|1||${s.mrn}^^^CCL^MR||${s.last_name || ''}^${s.first_name}`, `OBR|1|${s.sample_no}-1|${s.sample_no}`, ...obx].join('\n');
  } },
  { key: 'astm', label: 'Results from analyzer (ASTM E1394)', protocol: 'ASTM', sender: 'IF-D10', needsSample: true, build: ({ s, items }) => {
    const r = items.filter((i: any) => !i.is_outsourced).flatMap((i: any) => i.parameters.filter((p: any) => p.result_type === 'NUMERIC'))
      .map((p: any, n: number) => `R|${n + 1}|^^^${p.code}|${sampleValue(p)}|${p.unit || ''}||N||F||||${ts()}`);
    return [`H|\\^&|||D10^1.0|||||LIS||P|1394-97|${ts()}`, 'P|1', `O|1|${s.sample_no}||^^^ALL`, ...r, 'L|1|N'].join('\n');
  } },
  { key: 'query', label: 'Analyzer host query (ASTM Q)', protocol: 'ASTM', sender: 'IF-D10', needsSample: true, build: ({ s }) => [`H|\\^&|||D10^1.0|||||LIS||P|1394-97|${ts()}`, `Q|1|^${s.sample_no}||^^^ALL`, 'L|1|N'].join('\n') },
  { key: 'jsonresult', label: 'Results in custom JSON', protocol: 'JSON', sender: 'IF-DIIM', needsSample: true, build: ({ s, items }) => JSON.stringify({
    type: 'RESULT', sampleNo: s.sample_no, instrument: 'c311',
    results: items.filter((i: any) => !i.is_outsourced).flatMap((i: any) => i.parameters.filter((p: any) => p.result_type !== 'CALCULATED' && p.result_type !== 'MEMO')).map((p: any) => ({ code: p.code, value: sampleValue(p), unit: p.unit })),
  }, null, 2) },
  { key: 'ref', label: 'Reference lab result for an outsourced test (HL7 ORU)', protocol: 'HL7V2', sender: 'IF-REF', needsSample: true, build: ({ s, items }) => {
    const it = items.find((i: any) => i.is_outsourced) || items[0];
    const obx = it.parameters.map((p: any, n: number) => `OBX|${n + 1}|NM|${p.loinc_num || p.code}^${p.name}^${p.loinc_num ? 'LN' : 'L'}||${sampleValue(p)}|${p.unit || ''}|${p.range?.text || ''}||||F`);
    return [`MSH|^~\\&|NRL|NRL|LIS|CCL|${ts()}||ORU^R01|NRL${rnd()}|P|2.5.1`, `PID|1||${s.mrn}`, `OBR|1|${it.order_no}-${it.id}||${it.test_code}`, ...obx].join('\n');
  } },
];

export default function ConsolePage() {
 const referenceT = useReferenceLocalization().t;

 const {get,post,fetch}=useDiagnosticClient();

  const user = useUser();
  const toast = useToast();
  const { data: ep, error, reload } = useResource<any>('/integration/endpoints');
  const [tab, setTab] = useState<'send' | 'pull' | 'endpoints'>('send');
  const [tplKey, setTplKey] = useState('orm');
  const [protocol, setProtocol] = useState<Proto>('HL7V2');
  const [sender, setSender] = useState('');
  const [transport, setTransport] = useState<'HTTPS' | 'MLLP'>('HTTPS');
  const [body, setBody] = useState('');
  const [samples, setSamples] = useState<any[]>([]);
  const [sampleId, setSampleId] = useState('');
  const [resp, setResp] = useState<{ status: number; body: string; messageId?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const senders = useMemo(() => {
    if (!ep) return [] as { code: string; label: string; key: string }[];
    return [
      ...ep.facilities.filter((f: any) => f.api_key).map((f: any) => ({ code: f.code, label: `${f.name} (client hospital)`, key: f.api_key })),
      ...ep.interfaces.filter((i: any) => i.auth_secret && i.active).map((i: any) => ({ code: i.code, label: `${i.name} (${i.category.toLowerCase().replace('_', ' ')})`, key: i.auth_secret })),
    ];
  }, [ep]);
  useEffect(() => { get('/samples', { status: 'RECEIVED', pageSize: 50 }).then((r) => setSamples(r.data)).catch(() => {}); }, []);

  const tpl = TEMPLATES.find((t) => t.key === tplKey)!;
  const applyTemplate = async (key = tplKey, sid = sampleId) => {
    const t = TEMPLATES.find((x) => x.key === key)!;
    setProtocol(t.protocol); setSender(t.sender); setResp(null);
    if (t.protocol !== 'HL7V2') setTransport('HTTPS');
    if (t.needsSample) {
      if (!sid) { setBody(''); return; }
      const d = await get(`/results/sample/${sid}`);
      setBody(t.build({ s: d.sample, items: d.items }));
    } else setBody(t.build({}));
  };
  useEffect(() => { if (ep) applyTemplate(); }, [ep]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const s = senders.find((x) => x.code === sender);
    setBusy(true); setResp(null);
    try {
      if (transport === 'MLLP') {
        const r = await post('/integration/console/mllp', { message: body });
        setResp({ status: 200, body: r.ack });
      } else {
        const [path, ct] = PATHS[protocol];
        const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'Content-Type': ct, ...(s ? { 'x-api-key': s.key } : {}) }, body: protocol === 'HL7V2' || protocol === 'ASTM' ? body.replace(/\r?\n/g, '\r') : body });
        setResp({ status: res.status, body: await res.text(), messageId: res.headers.get('x-message-id') || undefined });
      }
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!ep) return <Loading />;
  const ok = resp && resp.status < 300 && !/MSA\|A[ER]|"status":"error"|NAK|"severity":"error"/.test(resp.body);
  return (
    <>
      <PageHeader title={referenceT("Interface console")} subtitle={referenceT("Send real messages to this LIS exactly as an external system would, over HTTPS with the sender’s API key or over TCP/MLLP. Every message is processed and logged.")} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'send', label: 'Send a message' }, { value: 'pull', label: 'Pull results as a client' }, { value: 'endpoints', label: 'Connection details' }]} />
      {tab === 'send' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title={referenceT("Message")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={referenceT("Template")} className="sm:col-span-2"><Select value={tplKey} onChange={(k) => { setTplKey(k); applyTemplate(k); }} options={TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} /></Field>
              {tpl.needsSample && (
                <Field label={referenceT("Received sample to use")} className="sm:col-span-2" hint={samples.length ? 'Values are prefilled from each parameter’s reference range. Edit them freely.' : 'Receive a sample at accession first.'}>
                  <Select value={sampleId} onChange={(v) => { setSampleId(v); applyTemplate(tplKey, v); }} placeholder={referenceT("Choose a sample")} options={samples.map((s) => ({ value: s.id, label: `${s.sample_no} – ${s.first_name} ${s.last_name || ''} – ${s.tests || ''}` }))} />
                </Field>
              )}
              <Field label={referenceT("Sender (identifies the API key)")}><Select value={sender} onChange={setSender} placeholder={referenceT("No key")} options={senders.map((s) => ({ value: s.code, label: s.label }))} /></Field>
              <Field label={referenceT("Protocol")}><Select value={protocol} onChange={(v) => setProtocol(v as Proto)} options={[{ value: 'HL7V2', label: 'HL7 v2' }, { value: 'ASTM', label: 'ASTM E1394' }, { value: 'FHIR_R4', label: 'FHIR R4' }, { value: 'JSON', label: 'JSON' }]} /></Field>
              {protocol === 'HL7V2' && can(user, 'INTEGRATION') && (
                <Field label={referenceT("Transport")} className="sm:col-span-2" hint={transport === 'MLLP' ? `Sent over TCP to port ${ep.mllpPort}; the sender is identified from MSH-3/MSH-4.` : 'HTTPS POST with the x-api-key header.'}>
                  <Select value={transport} onChange={(v) => setTransport(v as any)} options={[{ value: 'HTTPS', label: 'HTTPS API' }, { value: 'MLLP', label: `TCP / MLLP (port ${ep.mllpPort})` }]} />
                </Field>
              )}
            </div>
            <DiagnosticTextarea className="input mt-3 min-h-[320px] font-mono text-xs" spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)} aria-label={referenceT("Message body")} />
            <div className="mt-3 flex justify-end"><Button variant="primary" loading={busy} disabled={!body.trim()} icon={<Send className="h-4 w-4" />} onClick={send}><ReferenceText message="Send message" /></Button></div>
          </Section>
          <Section title={referenceT("Reply")} actions={resp && <><Badge tone={ok ? 'ok' : 'crit'}><ReferenceText message="HTTP" /> {resp.status}</Badge>{resp.messageId && <Link className="link text-xs" href={`/integration/messages?open=${resp.messageId}`}><ReferenceText message="Message #" />{resp.messageId}</Link>}</>}>
            {resp ? <MessageView raw={resp.body || '(empty reply)'} /> : <p className="text-sm text-ink-soft"><ReferenceText message="The acknowledgement (HL7 ACK, FHIR OperationOutcome, ASTM reply or JSON) appears here." /></p>}
          </Section>
        </div>
      )}
      {tab === 'pull' && <PullTester senders={senders.filter((s) => ep.facilities.some((f: any) => f.code === s.code))} />}
      {tab === 'endpoints' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title={referenceT("Listeners and endpoints")}>
            <DiagnosticTable className="w-full text-sm"><TableBody>
              <TableRow><TableCell className="td text-ink-soft"><ReferenceText message="HL7 over TCP (MLLP)" /></TableCell><TableCell className="td font-mono text-xs"><ReferenceText message="tcp://&lt;lis-host&gt;:" />{ep.mllpPort}</TableCell></TableRow>
              <TableRow><TableCell className="td text-ink-soft"><ReferenceText message="ASTM E1381 over TCP" /></TableCell><TableCell className="td font-mono text-xs"><ReferenceText message="tcp://&lt;lis-host&gt;:" />{ep.astmPort}</TableCell></TableRow>
              {Object.entries(ep.http).map(([k, v]) => <TableRow key={k}><TableCell className="td text-ink-soft">{k}</TableCell><TableCell className="td font-mono text-xs">{String(v).replace('/api', API_URL.replace(/\/api$/, '') + '/api')}</TableCell></TableRow>)}
              <TableRow><TableCell className="td text-ink-soft"><ReferenceText message="Push dispatcher interval" /></TableCell><TableCell className="td">{ep.dispatchIntervalMs / 1000} <ReferenceText message="s" /></TableCell></TableRow>
            </TableBody></DiagnosticTable>
          </Section>
          <Section title={referenceT("Client facilities")} bodyClass="p-0">
            <DiagnosticTable className="w-full text-sm"><TableHeader><TableRow><TableHead className="th"><ReferenceText message="Facility" /></TableHead><TableHead className="th"><ReferenceText message="API key" /></TableHead><TableHead className="th"><ReferenceText message="Results" /></TableHead></TableRow></TableHeader>
              <TableBody>{ep.facilities.map((f: any) => <TableRow key={f.id}><TableCell className="td">{f.name}<div className="text-2xs text-ink-soft">{f.interface}, {f.protocol}</div></TableCell><TableCell className="td font-mono text-xs">{f.api_key}</TableCell><TableCell className="td">{f.result_delivery} <ReferenceText message="as" /> {f.result_format}</TableCell></TableRow>)}</TableBody></DiagnosticTable>
          </Section>
          <Section title={referenceT("Interfaces")} bodyClass="p-0" className="xl:col-span-2">
            <DiagnosticTable className="w-full text-sm"><TableHeader><TableRow><TableHead className="th"><ReferenceText message="Code" /></TableHead><TableHead className="th"><ReferenceText message="Name" /></TableHead><TableHead className="th"><ReferenceText message="Category" /></TableHead><TableHead className="th"><ReferenceText message="Protocol / transport" /></TableHead><TableHead className="th"><ReferenceText message="MSH-3 / MSH-4" /></TableHead><TableHead className="th"><ReferenceText message="Outbound" /></TableHead><TableHead className="th"><ReferenceText message="Key" /></TableHead><TableHead className="th"><ReferenceText message="Active" /></TableHead></TableRow></TableHeader>
              <TableBody>{ep.interfaces.map((i: any) => <TableRow key={i.id}><TableCell className="td font-medium">{i.code}</TableCell><TableCell className="td">{i.name}</TableCell><TableCell className="td">{i.category}</TableCell><TableCell className="td">{i.protocol} / {i.transport}</TableCell>
                <TableCell className="td text-xs">{i.sending_app} / {i.sending_facility}</TableCell><TableCell className="td text-xs">{i.delivery_mode}{i.endpoint_url ? ` to ${i.endpoint_url}` : i.host ? ` to ${i.host}:${i.port}` : ''}</TableCell><TableCell className="td font-mono text-xs">{i.auth_secret}</TableCell><TableCell className="td">{i.active ? 'Yes' : 'No'}</TableCell></TableRow>)}</TableBody></DiagnosticTable>
          </Section>
          <Section title={referenceT("Analyzers")} bodyClass="p-0" className="xl:col-span-2">
            <DiagnosticTable className="w-full text-sm"><TableHeader><TableRow><TableHead className="th"><ReferenceText message="Analyzer" /></TableHead><TableHead className="th"><ReferenceText message="Instrument ID" /></TableHead><TableHead className="th"><ReferenceText message="Connection" /></TableHead><TableHead className="th"><ReferenceText message="Protocol" /></TableHead><TableHead className="th"><ReferenceText message="Order download" /></TableHead></TableRow></TableHeader>
              <TableBody>{ep.analyzers.map((a: any) => <TableRow key={a.id}><TableCell className="td">{a.name}</TableCell><TableCell className="td font-mono text-xs">{a.instrument_id}</TableCell><TableCell className="td">{a.middleware ? `via ${a.middleware} (${a.interface})` : `direct (${a.interface})`}</TableCell><TableCell className="td">{a.protocol}</TableCell><TableCell className="td">{a.query_mode === 'HOST_QUERY' ? 'Host query' : 'Broadcast'}</TableCell></TableRow>)}</TableBody></DiagnosticTable>
          </Section>
        </div>
      )}
    </>
  );
}

/** Acts as a client hospital polling for its results, then acknowledging them. */
function PullTester({ senders }: { senders: { code: string; label: string; key: string }[] }) {
 const referenceT = useReferenceLocalization().t;

 const {fetch}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const toast = useToast();
  const [code, setCode] = useState(senders[0]?.code || '');
  const [res, setRes] = useState<any>(null);
  const [open, setOpen] = useState<number | null>(null);
  const key = senders.find((s) => s.code === code)?.key;
  const pull = async (includeAcked = false) => {
    const r = await fetch(`${API_URL}/integration/results${includeAcked ? '?includeAcked=1' : ''}`, { headers: { 'x-api-key': key || '' } });
    setRes(await r.json());
  };
  const ack = async () => {
    const ids = res.results.filter((r: any) => r.status === 'AVAILABLE').map((r: any) => r.publicationId);
    const r = await fetch(`${API_URL}/integration/results/ack`, { method: 'POST', headers: { 'x-api-key': key || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }).then((x) => x.json());
    toast.ok(`${r.acknowledged} result(s) acknowledged; they will not be returned again.`);
    pull();
  };
  return (
    <Section title={referenceT("Pull results")} actions={<>
      <Select className="h-8 w-64 py-1" value={code} onChange={setCode} options={senders.map((s) => ({ value: s.code, label: s.label }))} />
      <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => pull()}><ReferenceText message="GET /integration/results" /></Button>
      <Button size="sm" variant="ghost" onClick={() => pull(true)}><ReferenceText message="Include acknowledged" /></Button>
      {res?.results?.some((r: any) => r.status === 'AVAILABLE') && <Button size="sm" variant="primary" onClick={ack}><ReferenceText message="Acknowledge all" /></Button>}
    </>}>
      {!res ? <p className="text-sm text-ink-soft"><ReferenceText message="Results signed for this client are waiting here until the client fetches and acknowledges them (at-least-once delivery)." /></p> : (
        res.results?.length ? (
          <ul className="divide-y divide-line">{res.results.map((r: any) => (
            <li key={r.publicationId} className="py-2">
              <DiagnosticButton className="flex w-full items-center gap-3 text-left text-sm" onClick={() => setOpen(open === r.publicationId ? null : r.publicationId)}>
                <span className="tnum text-ink-soft">#{r.publicationId}</span><span className="font-medium">{r.event} <ReferenceText message="v" />{r.reportVersion}</span>
                <span>{r.externalOrderNo || r.orderNo}{r.externalLineNo ? ` / ${r.externalLineNo}` : ''}</span><span className="text-ink-soft">{r.format}</span>
                <StatusBadge status={r.status} /><span className="ml-auto text-xs text-ink-soft">{fmtDateTime(r.createdAt)}</span>
              </DiagnosticButton>
              {open === r.publicationId && <MessageView className="mt-2" raw={typeof r.payload === 'string' ? r.payload : JSON.stringify(r.payload)} />}
            </li>
          ))}</ul>
        ) : <p className="text-sm text-ink-soft"><ReferenceText message="Nothing new for this client." /></p>
      )}
    </Section>
  );
}
