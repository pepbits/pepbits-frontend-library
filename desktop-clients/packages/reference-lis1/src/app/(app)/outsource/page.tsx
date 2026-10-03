'use client';
import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useMemo, useState } from 'react';
import { FileJson, Printer, Send, Truck } from 'lucide-react';

import { useApi, useMaster } from '../../../lib/hooks';
import {dueIn} from '../../../lib/format';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Loading, Modal, PageHeader, Select, Tabs, TubeChip, useAction } from '../../../components/ui';
import { Barcode } from '../../../components/Barcode';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OutsourcePage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const [tab, setTab] = useState('pending');
  const { data: pending, reload: reloadPending } = useApi<any[]>('/outsource/pending');
  const { data: shipments, reload: reloadShipments } = useApi<any[]>('/outsource/shipments');
  const labs = useMaster('external-labs');
  const [sel, setSel] = useState<number[]>([]);
  const [draft, setDraft] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [manifest, setManifest] = useState<any>(null);
  const { busy, run } = useAction();

  const byLab = useMemo(() => {
    const m = new Map<number, { lab: any; rows: any[] }>();
    for (const r of pending || []) {
      const k = r.externalLabId || 0;
      if (!m.has(k)) m.set(k, { lab: r.externalLab, rows: [] });
      m.get(k)!.rows.push(r);
    }
    return [...m.entries()];
  }, [pending]);

  const openShipment = async (id: number) => setView(await api.get(`/outsource/shipments/${id}`));
  const createShipment = async () => {
    const r: any = await run('create', () => api.post('/outsource/shipments', { externalLabId: Number(draft.externalLabId), orderTestIds: sel, courier: draft.courier || undefined, trackingNo: draft.trackingNo || undefined, notes: draft.notes || undefined }), (s: any) => `Shipment ${s.shipmentNo} created`);
    if (r) { setDraft(null); setSel([]); reloadPending(); reloadShipments(); setTab('shipments'); openShipment(r.id); }
  };
  const dispatch = async (id: number) => {
    const r: any = await run('dispatch', () => api.post(`/outsource/shipments/${id}/dispatch`), (s: any) => s.transmissionStatus === 'SENT' ? 'Dispatched and manifest transmitted to the reference lab' : s.transmissionStatus === 'FAILED' ? 'Dispatched – electronic manifest failed, send the printed copy' : 'Dispatched – print the manifest to send with the box');
    if (r) { reloadShipments(); openShipment(id); }
  };

  return (
    <div>
      <PageHeader title={referenceT("Outsourcing")} subtitle={referenceT("Tests marked as outsourced are shipped to reference labs; their results come back through the reference-lab API or manual entry")} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'pending', label: `Ready to ship (${pending?.length ?? 0})` }, { value: 'shipments', label: 'Shipments' }]} />
      {tab === 'pending' && (!pending ? <Loading /> : !pending.length ? <Card><Empty icon={Truck} title={referenceT("Nothing waiting to ship")} hint={referenceT("Outsourced tests appear here once their sample is accessioned.")} /></Card> : (
        <div className="space-y-3">
          {byLab.map(([labId, g]) => {
            const ids = g.rows.map((r) => r.id);
            const chosen = sel.filter((id) => ids.includes(id));
            return (
              <Card key={labId} title={g.lab ? `${g.lab.name} (${g.lab.code})` : 'No reference lab configured on the test'} bodyClass="p-0"
                actions={<Button size="sm" variant="primary" icon={Truck} disabled={!chosen.length || !labId} onClick={() => { setSel(chosen); setDraft({ externalLabId: labId, courier: '', trackingNo: '', notes: '' }); }}><ReferenceText message="Create shipment (" />{chosen.length})</Button>}>
                <DiagnosticTable className="tbl">
                  <TableHeader><TableRow><TableHead className="w-8"><Checkbox label="" checked={chosen.length === ids.length} onChange={(v) => setSel((s) => (v ? [...new Set([...s, ...ids])] : s.filter((x) => !ids.includes(x))))} /></TableHead><TableHead><ReferenceText message="Sample" /></TableHead><TableHead><ReferenceText message="Test" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Order" /></TableHead><TableHead><ReferenceText message="Due" /></TableHead></TableRow></TableHeader>
                  <TableBody>{g.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><Checkbox label="" checked={sel.includes(r.id)} onChange={(v) => setSel((s) => (v ? [...s, r.id] : s.filter((x) => x !== r.id)))} /></TableCell>
                      <TableCell><span className="inline-flex items-center gap-1.5"><TubeChip size="sm" color={r.container?.capColor} /><span className="font-mono text-xs">{r.sample?.sampleNo}</span></span></TableCell>
                      <TableCell>{r.test?.name}</TableCell>
                      <TableCell className="text-sm">{r.patient?.fullName}<div className="font-mono text-xs2 text-ink-mute">{r.patient?.mrn}</div></TableCell>
                      <TableCell className="font-mono text-xs">{r.order?.orderNo} {r.order?.priority === 'STAT' && <Badge value="STAT" />}</TableCell>
                      <TableCell className={`text-xs ${dueIn(r.dueAt).overdue ? 'text-flag-crit' : 'text-ink-soft'}`}>{dueIn(r.dueAt).text}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </DiagnosticTable>
              </Card>
            );
          })}
        </div>
      ))}
      {tab === 'shipments' && (
        <Card bodyClass="p-0">
          {!shipments ? <Loading /> : !shipments.length ? <Empty title={referenceT("No shipments yet")} /> : (
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow><TableHead><ReferenceText message="Shipment" /></TableHead><TableHead><ReferenceText message="Reference lab" /></TableHead><TableHead><ReferenceText message="Created" /></TableHead><TableHead><ReferenceText message="Dispatched" /></TableHead><TableHead><ReferenceText message="Courier" /></TableHead><TableHead><ReferenceText message="Results" /></TableHead><TableHead><ReferenceText message="Transmission" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead></TableRow></TableHeader>
              <TableBody>{shipments.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => openShipment(s.id)}>
                  <TableCell className="font-mono text-xs font-medium">{s.shipmentNo}</TableCell>
                  <TableCell>{s.externalLab?.name}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(s.createdAt)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(s.dispatchedAt)}</TableCell>
                  <TableCell className="text-xs">{s.courier || '—'}{s.trackingNo ? ` · ${s.trackingNo}` : ''}</TableCell>
                  <TableCell className="num">{s.receivedCount}/{s.itemCount}</TableCell>
                  <TableCell>{s.transmissionStatus ? <Badge value={s.transmissionStatus === 'NOT_CONFIGURED' ? 'DRAFT' : s.transmissionStatus} label={s.transmissionStatus.replace('_', ' ').toLowerCase()} /> : '—'}</TableCell>
                  <TableCell><Badge value={s.status} /></TableCell>
                </TableRow>
              ))}</TableBody>
            </DiagnosticTable>
          )}
        </Card>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={referenceT("New shipment")} width="max-w-md"
        footer={<><Button onClick={() => setDraft(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy === 'create'} onClick={createShipment}><ReferenceText message="Create shipment" /></Button></>}>
        {draft && <div className="space-y-3">
          <Field label={referenceT("Reference lab")}><Select value={draft.externalLabId} onChange={(e) => setDraft({ ...draft, externalLabId: e.target.value })} options={labs.map((l) => ({ value: l.id, label: l.name }))} /></Field>
          <Field label={referenceT("Courier")}><Input value={draft.courier} onChange={(e) => setDraft({ ...draft, courier: e.target.value })} /></Field>
          <Field label={referenceT("Tracking number")}><Input value={draft.trackingNo} onChange={(e) => setDraft({ ...draft, trackingNo: e.target.value })} /></Field>
          <Field label={referenceT("Notes")}><Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
          <div className="text-sm text-ink-soft">{sel.length} <ReferenceText message="test(s) will be added." /></div>
        </div>}
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Shipment ${view.shipmentNo}` : ''} width="max-w-4xl"
        footer={view && <>
          <Button icon={FileJson} onClick={async () => setManifest(await api.get(`/outsource/shipments/${view.id}/manifest`))}><ReferenceText message="Electronic manifest" /></Button>
          <Button icon={Printer} onClick={() => window.print()}><ReferenceText message="Print manifest" /></Button>
          {view.status === 'DRAFT' && <Button variant="primary" icon={Send} loading={busy === 'dispatch'} onClick={() => dispatch(view.id)}><ReferenceText message="Dispatch" /></Button>}
        </>}>
        {view && <ShipmentSheet s={view} />}
      </Modal>
      {view && <div className="hidden print:block print-area"><ShipmentSheet s={view} /></div>}
      <Modal open={!!manifest} onClose={() => setManifest(null)} title={referenceT("Electronic manifest (JSON sent to the reference lab)")} width="max-w-3xl">
        <pre className="max-h-[60vh] overflow-auto rounded bg-paper p-3 font-mono text-xs">{JSON.stringify(manifest, null, 2)}</pre>
      </Modal>
    </div>
  );
}

function ShipmentSheet({ s }: { s: any }) {
 const {fmtDateTime}=useDiagnosticFormat();

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-semibold"><ReferenceText message="Specimen manifest ·" /> {s.externalLab?.name}</div>
          <div className="text-ink-soft">{s.externalLab?.address}</div>
          <div className="mt-1 text-xs text-ink-soft"><ReferenceText message="Status" /> {s.status.toLowerCase()} <ReferenceText message="· dispatched" /> {fmtDateTime(s.dispatchedAt)} <ReferenceText message="· courier" /> {s.courier || '—'} {s.trackingNo || ''}</div>
          {s.transmissionResponse && <div className="mt-1 text-xs text-ink-mute"><ReferenceText message="Transmission:" /> {s.transmissionStatus} – {String(s.transmissionResponse).slice(0, 200)}</div>}
        </div>
        <Barcode value={s.shipmentNo} height={34} />
      </div>
      <DiagnosticTable className="tbl card">
        <TableHeader><TableRow><TableHead>#</TableHead><TableHead><ReferenceText message="Sample" /></TableHead><TableHead><ReferenceText message="Test" /></TableHead><TableHead><ReferenceText message="Patient" /></TableHead><TableHead><ReferenceText message="Result" /></TableHead></TableRow></TableHeader>
        <TableBody>{s.items.map((i: any, n: number) => (
          <TableRow key={i.id}><TableCell>{n + 1}</TableCell><TableCell className="font-mono text-xs">{i.orderTest?.sample?.sampleNo ?? i.sampleId}</TableCell><TableCell>{i.orderTest?.test?.name}</TableCell><TableCell>{i.orderTest?.patient?.fullName} <span className="font-mono text-xs text-ink-mute">{i.orderTest?.patient?.mrn}</span></TableCell><TableCell><Badge value={i.status === 'RESULT_RECEIVED' ? 'RESULTED' : 'PENDING'} label={i.status?.toLowerCase().replace('_', ' ')} /></TableCell></TableRow>
        ))}</TableBody>
      </DiagnosticTable>
      <div className="grid grid-cols-2 gap-8 pt-6 text-xs text-ink-soft"><div className="border-t border-line pt-1"><ReferenceText message="Dispatched by" /></div><div className="border-t border-line pt-1"><ReferenceText message="Received by (reference lab)" /></div></div>
    </div>
  );
}
