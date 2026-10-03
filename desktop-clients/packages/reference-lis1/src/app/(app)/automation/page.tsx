'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Play, RefreshCw, RotateCcw } from 'lucide-react';

import { useApi, useDebounced, useMaster } from '../../../lib/hooks';

import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Textarea, useAction } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const pretty = (s?: string | null) => {
  if (!s) return '';
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s.replace(/\r/g, '\n'); }
};

/** Builds a realistic example message for the chosen analyzer/sample using its parameter mappings. */
function example(format: string, analyzer: any, sampleNo: string, maps: any[], params: any[], wanted: number[], ranges: any[]) {
  const mine = maps.filter((m) => m.analyzerId === analyzer?.id && (!wanted.length || wanted.includes(m.parameterId)));
  const val = (m: any) => {
    const p = params.find((x) => x.id === m.parameterId);
    if (p?.resultType === 'OPTION') return (p.defaultValue || (p.options || '').split(',')[0] || '').trim();
    // pick a plausible value inside the adult reference interval, reversing any unit conversion
    const r = ranges.find((x) => x.parameterId === m.parameterId && x.lowNormal != null && x.highNormal != null)
      || ranges.find((x) => x.parameterId === m.parameterId && (x.lowNormal != null || x.highNormal != null));
    const lo = r?.lowNormal ?? (r?.highNormal != null ? r.highNormal * 0.5 : 1);
    const hi = r?.highNormal ?? lo * 1.5;
    const v = (lo + Math.random() * (hi - lo)) / (m.conversionFactor || 1);
    return v.toFixed(Math.min(p?.decimals ?? 1, 3));
  };
  const code = analyzer?.code || 'ANALYZER';
  if (format === 'HL7') {
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return [`MSH|^~\\&|${code}|LAB|LIS|LAB|${ts}||ORU^R01|${Date.now()}|P|2.5.1`, 'PID|1||', `OBR|1||${sampleNo}`, ...mine.map((m, i) => `OBX|${i + 1}|NM|${m.analyzerCode}||${val(m)}|${m.analyzerUnit || ''}|||||F`)].join('\n');
  }
  if (format === 'ASTM') {
    return [`H|\\^&|||${code}`, 'P|1', `O|1||${sampleNo}`, ...mine.map((m, i) => `R|${i + 1}|^^^${m.analyzerCode}|${val(m)}|${m.analyzerUnit || ''}`), 'L|1|N'].join('\n');
  }
  return JSON.stringify({ analyzerCode: code, sampleNo, results: mine.map((m) => ({ code: m.analyzerCode, value: val(m), unit: m.analyzerUnit || undefined })) }, null, 2);
}

export default function AutomationPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const sp = useSearchParams();
  const [tab, setTab] = useState('messages');
  const [status, setStatus] = useState(sp.get('status') || '');
  const [direction, setDirection] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, loading, reload, error } = useApi<any[]>('/automation/messages', { status, direction, q: dq });
  const [view, setView] = useState<any>(null);
  const { busy, run } = useAction();

  const analyzers = useMaster('analyzers');
  const maps = useMaster('analyzer-parameter-mappings');
  const params = useMaster('parameters');
  const middlewares = useMaster('middlewares');
  const tests = useMaster('tests');
  const testParams = useMaster('test-parameters');
  const ranges = useMaster('reference-ranges');
  const { data: inProcess } = useApi<any[]>(tab === 'console' ? '/samples' : null, { status: 'IN_PROCESS' });
  const [fmt, setFmt] = useState('JSON');
  const [analyzerId, setAnalyzerId] = useState('');
  const [sampleNo, setSampleNo] = useState('');
  const [msg, setMsg] = useState('');
  const [outcome, setOutcome] = useState<any>(null);

  useEffect(() => { if (!analyzerId && analyzers.length) setAnalyzerId(String(analyzers[0].id)); }, [analyzers, analyzerId]);
  const analyzer = analyzers.find((a) => String(a.id) === analyzerId);

  const send = async () => {
    setOutcome(null);
    const r = await run('ingest', () => api.post('/automation/ingest', { message: msg, analyzerCode: fmt === 'JSON' ? undefined : analyzer?.code }));
    if (r) { setOutcome(r); reload(); }
  };

  return (
    <div>
      <PageHeader title={referenceT("Instrument automation")} subtitle={referenceT("Order messages sent to middleware on accession, and results received from analyzers")}
        actions={<Button icon={RefreshCw} onClick={reload} loading={loading}><ReferenceText message="Refresh" /></Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'messages', label: 'Message monitor' }, { value: 'console', label: 'Result test console' }, { value: 'middleware', label: 'Connected middleware' }]} />
      {tab === 'messages' && (
        <Card bodyClass="p-0">
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <Input className="w-56 font-mono" placeholder={referenceT("Sample number")} value={q} onChange={(e) => setQ(e.target.value)} />
            <Select className="w-40" value={direction} onChange={(e) => setDirection(e.target.value)} placeholder={referenceT("Both directions")} options={[{ value: 'OUTBOUND', label: 'Outbound orders' }, { value: 'INBOUND', label: 'Inbound results' }]} />
            <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder={referenceT("Any status")} options={['PENDING', 'SENT', 'FAILED', 'PROCESSED', 'PARTIAL', 'ERROR'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
          </div>
          <ErrorNote error={error} />
          {loading && !data ? <Loading /> : !data?.length ? <Empty title={referenceT("No messages")} hint={referenceT("Accession a sample routed to an analyzer to generate an order message.")} /> : (
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead><ReferenceText message="Time" /></TableHead><TableHead><ReferenceText message="Direction" /></TableHead><TableHead><ReferenceText message="Type" /></TableHead><TableHead><ReferenceText message="Sample" /></TableHead><TableHead><ReferenceText message="Analyzer / middleware" /></TableHead><TableHead><ReferenceText message="Attempts" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>{data.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setView(m)}>
                  <TableCell className="num text-xs text-ink-mute">{m.id}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(m.createdAt)}</TableCell>
                  <TableCell className="text-xs">{m.direction === 'OUTBOUND' ? 'LIS → instrument' : 'instrument → LIS'}</TableCell>
                  <TableCell className="text-xs">{m.messageType} · {m.format}</TableCell>
                  <TableCell className="font-mono text-xs">{m.sampleNo}</TableCell>
                  <TableCell className="text-xs">{m.analyzerName || '—'}<div className="text-ink-mute">{m.middlewareName}</div></TableCell>
                  <TableCell className="num">{m.attempts}</TableCell>
                  <TableCell><Badge value={m.status} />{m.error && <div className="mt-0.5 max-w-xs truncate text-xs2 text-flag-crit" title={m.error}>{m.error}</div>}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>{m.direction === 'OUTBOUND' && ['FAILED', 'PENDING'].includes(m.status) && <Button size="sm" icon={RotateCcw} loading={busy === `r${m.id}`} onClick={() => run(`r${m.id}`, () => api.post(`/automation/messages/${m.id}/retry`), 'Message re-sent').then(reload)}><ReferenceText message="Retry" /></Button>}</TableCell>
                </TableRow>
              ))}</TableBody>
            </DiagnosticTable>
          )}
        </Card>
      )}
      {tab === 'console' && (
        <CardGrid className="grid gap-4 xl:grid-cols-2">
          <Card title={referenceT("Send a result message")} actions={<Button variant="primary" size="sm" icon={Play} disabled={!msg.trim()} loading={busy === 'ingest'} onClick={send}><ReferenceText message="Process message" /></Button>}>
            <div className="mb-3 text-sm text-ink-soft"><ReferenceText message="Use this to commission an analyzer interface or re-process a captured message. It runs the same parser, parameter mapping and unit conversion as the live middleware endpoint." /></div>
            <div className="grid grid-cols-3 gap-2">
              <Field label={referenceT("Format")}><Select value={fmt} onChange={(e) => setFmt(e.target.value)} options={[{ value: 'JSON', label: 'JSON' }, { value: 'HL7', label: 'HL7 v2 ORU' }, { value: 'ASTM', label: 'ASTM E1394' }]} /></Field>
              <Field label={referenceT("Analyzer")}><Select value={analyzerId} onChange={(e) => setAnalyzerId(e.target.value)} options={analyzers.map((a) => ({ value: a.id, label: a.code }))} /></Field>
              <Field label={referenceT("Sample")}><Select value={sampleNo} onChange={(e) => setSampleNo(e.target.value)} placeholder={referenceT("Choose in-process sample")} options={(inProcess || []).map((s) => ({ value: s.sampleNo, label: `${s.sampleNo} · ${s.tests.map((t: any) => t.code).join(',')}` }))} /></Field>
            </div>
            <Button size="sm" className="my-2" disabled={!sampleNo} onClick={() => {
              const s = (inProcess || []).find((x) => x.sampleNo === sampleNo);
              const testIds = tests.filter((t) => s?.tests.some((x: any) => x.code === t.code)).map((t) => t.id);
              const wanted = testParams.filter((tp) => testIds.includes(tp.testId)).map((tp) => tp.parameterId);
              setMsg(example(fmt, analyzer, sampleNo, maps, params, wanted, ranges));
            }}><ReferenceText message="Generate example from mappings" /></Button>
            <Textarea rows={14} className="font-mono text-xs" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={referenceT("Paste an HL7 ORU^R01, ASTM or JSON result message")} />
          </Card>
          <Card title={referenceT("Outcome")}>
            {!outcome ? <Empty title={referenceT("No message processed yet")} /> : (
              <div className="space-y-2 text-sm">
                <div><ReferenceText message="Message #" />{outcome.messageId} <ReferenceText message="from" /> {outcome.analyzer}</div>
                {outcome.samples.map((s: any) => (
                  <div key={s.sampleNo} className="rounded border border-line p-2">
                    <div className="font-mono text-xs font-medium">{s.sampleNo}</div>
                    <div>{s.accepted} <ReferenceText message="result(s) accepted" />{s.autoValidated ? `, ${s.autoValidated} test(s) auto-validated` : ''}</div>
                    {s.unmapped?.length > 0 && <div className="text-flag-warn"><ReferenceText message="Unmapped codes:" /> {s.unmapped.join(', ')} <ReferenceText message="– add them under Masters → Analyzer parameter mappings" /></div>}
                    {s.errors?.map((e: string, i: number) => <div key={i} className="text-flag-crit">{e}</div>)}
                  </div>
                ))}
                {outcome.errors?.map((e: string, i: number) => <div key={i} className="text-flag-crit">{e}</div>)}
              </div>
            )}
          </Card>
        </CardGrid>
      )}
      {tab === 'middleware' && (
        <Card bodyClass="p-0">
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Middleware" /></TableHead><TableHead><ReferenceText message="Order mode" /></TableHead><TableHead><ReferenceText message="Format" /></TableHead><TableHead><ReferenceText message="Endpoint" /></TableHead><TableHead><ReferenceText message="Analyzers" /></TableHead><TableHead><ReferenceText message="Auto-send" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
            <TableBody>{middlewares.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}<div className="text-xs2 text-ink-mute">{m.code} · {m.vendor || 'generic'}</div></TableCell>
                <TableCell className="text-xs">{m.orderMode === 'PUSH' ? 'LIS pushes orders' : 'Middleware pulls orders'}</TableCell>
                <TableCell className="text-xs">{m.messageFormat}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs">{m.orderMode === 'PUSH' ? m.orderEndpointUrl || 'not set' : 'GET /api/automation/middleware/orders'}</TableCell>
                <TableCell className="text-xs">{analyzers.filter((a) => a.middlewareId === m.id).map((a) => a.code).join(', ') || '—'}</TableCell>
                <TableCell className="text-xs">{m.autoSendOnAccession ? 'On accession' : 'Manual'}</TableCell>
                <TableCell><Badge value={m.active ? 'SUCCESS' : 'CANCELLED'} label={m.active ? 'Active' : 'Inactive'} /></TableCell>
              </TableRow>
            ))}</TableBody>
          </DiagnosticTable>
        </Card>
      )}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Message #${view.id} · ${view.messageType} ${view.format}` : ''} width="max-w-4xl">
        {view && <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm"><Badge value={view.status} /><span>{view.direction.toLowerCase()}</span><span className="font-mono">{view.sampleNo}</span><span>{view.analyzerName}</span><span>{fmtDateTime(view.createdAt)}</span></div>
          {view.error && <ErrorNote error={view.error} />}
          <Field label={referenceT("Payload")}><pre className="max-h-80 overflow-auto rounded border border-line bg-paper p-3 font-mono text-xs">{pretty(view.payload)}</pre></Field>
          {view.response && <Field label={referenceT("Response")}><pre className="max-h-60 overflow-auto rounded border border-line bg-paper p-3 font-mono text-xs">{pretty(view.response)}</pre></Field>}
        </div>}
      </Modal>
    </div>
  );
}
