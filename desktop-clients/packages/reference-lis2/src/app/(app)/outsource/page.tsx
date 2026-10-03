'use client';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useMemo, useState } from 'react';
import { Printer, Truck } from 'lucide-react';

import { useFilters, useList, useResource } from '../../../lib/hooks';
import {age,fullName,titleCase} from '../../../lib/format';
import { Button, DL, Empty, Field, Input, Modal, PageHeader, PriorityBadge, Section, Select, StatusBadge, Tabs, Textarea, useToast } from '../../../components/ui';
import { DataTable, FilterBar, FilterItem, PagedTable } from '../../../components/table';
import { RefSelect } from '../../../components/refselect';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OutsourcePage() {
 const referenceT = useReferenceLocalization().t;

 const {get,post,put}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const toast = useToast();
  const [tab, setTab] = useState<'pending' | 'shipments'>('pending');
  const pending = useResource<any[]>('/outsource/pending');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [ship, setShip] = useState<{ labId: number; lab: string } | null>(null);
  const [form, setForm] = useState({ courier: '', trackingNo: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [f, set] = useFilters({ status: '', labId: '', pageSize: 25 });
  const shipments = useList('/outsource/shipments', f);
  const [manifest, setManifest] = useState<any>(null);

  const byLab = useMemo(() => {
    const m = new Map<number, any[]>();
    (pending.data || []).forEach((i) => m.set(i.outsource_lab_id, [...(m.get(i.outsource_lab_id) || []), i]));
    return [...m.entries()];
  }, [pending.data]);

  const create = async () => {
    if (!ship) return;
    const ids = (pending.data || []).filter((i) => i.outsource_lab_id === ship.labId && sel.has(i.id)).map((i) => i.id);
    setBusy(true);
    try {
      const r = await post('/outsource/shipments', { labId: ship.labId, itemIds: ids, ...form });
      toast.ok(`Manifest ${r.manifest_no} created with ${r.items.length} test(s).`);
      setShip(null); setSel(new Set()); setForm({ courier: '', trackingNo: '', notes: '' });
      pending.reload(); shipments.reload(); setManifest(r);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={referenceT("Outsourcing")} subtitle={referenceT("Tests the laboratory sends to reference labs. Referral orders are transmitted through the reference lab’s interface when a manifest is created.")} />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ value: 'pending', label: 'Ready to ship', count: pending.data?.length }, { value: 'shipments', label: 'Manifests' }]} />
      {tab === 'pending' && (
        byLab.length ? <div className="space-y-4">{byLab.map(([labId, items]) => {
          const chosen = items.filter((i) => sel.has(i.id)).length;
          return (
            <Section key={labId} title={items[0].outsource_lab || 'Reference lab'} bodyClass="p-0"
              actions={<Button size="sm" variant="primary" disabled={!chosen} icon={<Truck className="h-3.5 w-3.5" />} onClick={() => setShip({ labId, lab: items[0].outsource_lab })}><ReferenceText message="Create manifest (" />{chosen})</Button>}>
              <DataTable rows={items} selected={sel} onSelect={setSel} dense columns={[
                { key: 'sample_no', header: 'Sample', className: 'font-medium tnum' }, { key: 'test', header: 'Test', render: (r: any) => `${r.test_code} ${r.test_name}` },
                { key: 'patient', header: 'Patient', render: (r: any) => `${fullName(r)} (${r.mrn})` }, { key: 'sample_type', header: 'Specimen' },
                { key: 'storage', header: 'Ship', render: (r: any) => titleCase(r.storage_temp) }, { key: 'priority', header: 'Priority', render: (r: any) => <PriorityBadge priority={r.priority} /> },
                { key: 'received_at', header: 'Received', render: (r: any) => fmtDateTime(r.received_at) },
              ]} />
            </Section>
          );
        })}</div> : <div className="panel"><Empty icon={<Truck className="h-6 w-6" />} title={referenceT("Nothing waiting to be shipped")}><ReferenceText message="Outsourced tests appear here after their sample is received." /></Empty></div>
      )}
      {tab === 'shipments' && (
        <div className="panel">
          <FilterBar>
            <FilterItem label={referenceT("Status")}><Select className="w-40" value={f.status} onChange={(status) => set({ status })} placeholder={referenceT("Any")} options={['DISPATCHED', 'IN_TRANSIT', 'RECEIVED_BY_LAB', 'COMPLETED', 'CANCELLED']} /></FilterItem>
            <FilterItem label={referenceT("Reference lab")}><RefSelect entity="outsource_labs" className="w-52" value={f.labId} onChange={(labId) => set({ labId })} /></FilterItem>
          </FilterBar>
          <PagedTable result={shipments.data} loading={shipments.loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })}
            onRowClick={async (r: any) => setManifest(await get(`/outsource/shipments/${r.id}`))} empty="No manifests yet" columns={[
              { key: 'manifest_no', header: 'Manifest', className: 'font-medium tnum' }, { key: 'lab', header: 'Reference lab' },
              { key: 'items', header: 'Tests', align: 'right' }, { key: 'resulted', header: 'Resulted', align: 'right' },
              { key: 'courier', header: 'Courier' }, { key: 'tracking_no', header: 'Tracking' },
              { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
              { key: 'dispatched_at', header: 'Dispatched', render: (r: any) => fmtDateTime(r.dispatched_at) },
            ]} />
        </div>
      )}
      <Modal open={!!ship} onClose={() => setShip(null)} title={referenceT("New manifest for {value0}", {value0: ship?.lab ?? ""})}
        footer={<><Button onClick={() => setShip(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={create}><ReferenceText message="Create manifest and send referral" /></Button></>}>
        <div className="space-y-3">
          <Field label={referenceT("Courier")}><Input value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} /></Field>
          <Field label={referenceT("Tracking number")}><Input value={form.trackingNo} onChange={(e) => setForm({ ...form, trackingNo: e.target.value })} /></Field>
          <Field label={referenceT("Notes")}><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={!!manifest} onClose={() => setManifest(null)} title={manifest ? `Manifest ${manifest.manifest_no}` : ''} width="max-w-3xl"
        footer={manifest && <>
          <Select className="w-48" value={manifest.status} onChange={async (status) => { const r = await put(`/outsource/shipments/${manifest.id}`, { status }); setManifest(r); shipments.reload(); toast.ok('Status updated.'); }}
            options={['DISPATCHED', 'IN_TRANSIT', 'RECEIVED_BY_LAB', 'COMPLETED', 'CANCELLED']} />
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}><ReferenceText message="Print manifest" /></Button>
        </>}>
        {manifest && <div className="print-page">
          <DL cols={3} items={[['Reference lab', manifest.lab], ['Address', manifest.lab_address], ['Phone', manifest.lab_phone], ['Courier', manifest.courier], ['Tracking', manifest.tracking_no], ['Dispatched', fmtDateTime(manifest.dispatched_at)]]} />
          <DataTable rows={manifest.items} dense columns={[
            { key: 'sample_no', header: 'Sample', className: 'tnum' }, { key: 'test', header: 'Test', render: (r: any) => `${r.test_code} ${r.test_name}` },
            { key: 'p', header: 'Patient', render: (r: any) => `${fullName(r)}, ${age(r.dob)} ${r.gender}` }, { key: 'sample_type', header: 'Specimen' },
            { key: 'status', header: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
          ]} />
          {manifest.messages?.length > 0 && <p className="mt-3 text-xs text-ink-soft"><ReferenceText message="Referral messages:" /> {manifest.messages.map((m: any) => `#${m.id} ${m.status.toLowerCase()}`).join(', ')}</p>}
        </div>}
      </Modal>
    </>
  );
}
