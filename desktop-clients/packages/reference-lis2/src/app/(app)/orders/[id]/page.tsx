'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';

import {useParams} from '@pepbits/reference-diagnostics';
import { useState } from 'react';
import { Ban, CreditCard, Plus, Printer, Syringe } from 'lucide-react';

import { useResource } from '../../../../lib/hooks';
import {titleCase} from '../../../../lib/format';
import { Badge, Button, DL, ErrorBanner, FlagBadge, Loading, Modal, PageHeader, PriorityBadge, PromptModal, Section, StatusBadge, useToast } from '../../../../components/ui';
import { DataTable } from '../../../../components/table';
import { PatientBanner } from '../../../../components/patient';
import { PaymentModal } from '../../../../components/billing';
import { ReportItemDrawer } from '../../../../components/reportitem';
import { PickedTest, TestPicker } from '../../../../components/testpicker';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OrderDetail() {
 const referenceT = useReferenceLocalization().t;

 const {post}=useDiagnosticClient();
 const {fmtDateTime,money}=useDiagnosticFormat();

  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: o, error, reload } = useResource<any>(`/orders/${id}`);
  const [pay, setPay] = useState(false);
  const [cancel, setCancel] = useState<any>(null);
  const [item, setItem] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [extra, setExtra] = useState<PickedTest[]>([]);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!o) return <Loading />;
  const signed = o.items.filter((i: any) => i.status === 'SIGNED').length;
  const waitingCollection = o.items.filter((i: any) => i.status === 'BILLED').length;
  const addTests = async () => {
    setBusy(true);
    try { await post(`/orders/${o.id}/items`, { tests: extra.map((t) => ({ testId: t.test.id, bodySiteId: t.bodySiteId ? Number(t.bodySiteId) : undefined })) }); toast.ok('Tests added and billed.'); setAdding(false); setExtra([]); reload(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title={<span className="tnum"><ReferenceText message="Order" /> {o.order_no}</span>}
        subtitle={<>{titleCase(o.source)} <ReferenceText message="order" />{o.facility ? ` from ${o.facility}` : ''}{o.external_order_no ? `, their number ${o.external_order_no}` : ''}<ReferenceText message=". Created" /> {fmtDateTime(o.created_at)}{o.created_by_name ? ` by ${o.created_by_name}` : ''}.</>}
        actions={<>
          {waitingCollection > 0 && <Link href={`/collection?q=${o.mrn}`}><Button icon={<Syringe className="h-4 w-4" />}><ReferenceText message="Collect" /> {waitingCollection} <ReferenceText message="test" />{waitingCollection > 1 ? 's' : ''}</Button></Link>}
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)} disabled={o.status === 'CANCELLED'}><ReferenceText message="Add tests" /></Button>
          <Link href={`/print/order/${o.id}`} target="_blank"><Button variant="primary" icon={<Printer className="h-4 w-4" />} disabled={!signed}><ReferenceText message="Print report (" />{signed})</Button></Link>
        </>} />
      <PatientBanner p={o} className="mb-4">
        <div className="flex flex-wrap gap-x-6 text-sm">
          <span><span className="text-ink-soft"><ReferenceText message="Status" /> </span><StatusBadge status={o.status} /></span>
          <span className="flex items-center gap-1"><span className="text-ink-soft"><ReferenceText message="Priority" /> </span><PriorityBadge priority={o.priority} /></span>
          <span><span className="text-ink-soft"><ReferenceText message="Encounter" /> </span>{o.encounter_no} ({o.encounter_type}){o.location ? `, ${o.location}` : ''}</span>
          {o.doctor && <span><span className="text-ink-soft"><ReferenceText message="Doctor" /> </span>{o.doctor}</span>}
        </div>
      </PatientBanner>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Section title={referenceT("Tests")} bodyClass="p-0">
            <DataTable rows={o.items} onRowClick={(r: any) => setItem(r.id)} rowClass={(r: any) => (r.status === 'CANCELLED' ? 'opacity-60' : undefined)} columns={[
              { key: 'test', header: 'Test', render: (r: any) => <div><div className="font-medium">{r.test_name}</div><div className="text-2xs text-ink-soft">{r.test_code}, {r.department}{r.body_site ? `, ${r.body_site}` : ''}{r.external_line_no ? `, line ${r.external_line_no}` : ''}</div></div> },
              { key: 'sample', header: 'Sample', render: (r: any) => r.sample_no ? <Link className="link tnum" onClick={(e) => e.stopPropagation()} href={`/samples?open=${r.sample_id}`}>{r.sample_no}</Link> : <span className="text-ink-faint"><ReferenceText message="Not collected" /></span> },
              { key: 'status', header: 'Status', render: (r: any) => <div className="flex flex-wrap items-center gap-1"><StatusBadge status={r.status} />{r.is_outsourced ? <Badge tone="violet">{r.outsource_lab || 'Reference lab'}</Badge> : null}{r.is_critical ? <FlagBadge flag="HH" critical /> : r.is_abnormal ? <Badge tone="high"><ReferenceText message="Abnormal" /></Badge> : null}</div> },
              { key: 'due_at', header: 'Due', render: (r: any) => fmtDateTime(r.due_at) },
              { key: 'signed', header: 'Signed', render: (r: any) => r.signed_at ? <span className="text-xs">{fmtDateTime(r.signed_at)}<br /><span className="text-ink-soft">{r.signed_by_name}</span></span> : '' },
              { key: 'price', header: 'Price', align: 'right', render: (r: any) => money(r.price) },
              { key: 'act', header: '', render: (r: any) => !['RESULTED', 'VALIDATED', 'SIGNED', 'AMENDING', 'CANCELLED'].includes(r.status) && (
                <DiagnosticButton className="rounded p-1 text-ink-faint hover:bg-crit-bg hover:text-crit" title={referenceT("Cancel test")} aria-label={referenceT("Cancel {value0}", {value0: r.test_name})} onClick={(e) => { e.stopPropagation(); setCancel(r); }}><Ban className="h-4 w-4" /></DiagnosticButton>) },
            ]} />
          </Section>
          {o.publications.length > 0 && (
            <Section title={referenceT("Result delivery to client systems")} bodyClass="p-0">
              <DataTable rows={o.publications} columns={[
                { key: 'event', header: 'Event', render: (p: any) => titleCase(p.event) }, { key: 'format', header: 'Format' },
                { key: 'mode', header: 'Mode', render: (p: any) => p.mode === 'PULL' ? 'Client pulls' : 'Pushed' },
                { key: 'status', header: 'Status', render: (p: any) => <><StatusBadge status={p.status} />{p.last_error && <div className="text-2xs text-crit">{p.last_error}</div>}</> },
                { key: 'created_at', header: 'Published', render: (p: any) => fmtDateTime(p.created_at) },
                { key: 'delivered', header: 'Delivered / acknowledged', render: (p: any) => fmtDateTime(p.acked_at || p.delivered_at) },
              ]} />
            </Section>
          )}
        </div>
        <div className="space-y-4">
          <Section title={o.bill ? `Bill ${o.bill.bill_no}` : 'Bill'} actions={o.bill && <StatusBadge status={o.bill.status} />}>
            {o.bill ? (
              <>
                <DL cols={2} items={[['Payer', titleCase(o.bill.payer_type)], ['Gross', money(o.bill.gross)], ['Discount', money(o.bill.discount)], ['Net', <b key="n">{money(o.bill.net)}</b>], ['Paid', money(o.bill.paid)], ['Balance', money(o.bill.net - o.bill.paid)]]} />
                {o.payments.length > 0 && <ul className="mt-3 divide-y divide-line border-t border-line text-sm">{o.payments.map((p: any) => <li key={p.id} className="flex justify-between py-1.5"><span>{titleCase(p.mode)}{p.reference ? ` (${p.reference})` : ''}<br /><span className="text-2xs text-ink-soft">{fmtDateTime(p.created_at)}, {p.user}</span></span><span className="tnum">{money(p.amount)}</span></li>)}</ul>}
                <Button className="mt-3 w-full" icon={<CreditCard className="h-4 w-4" />} onClick={() => setPay(true)}><ReferenceText message="Record payment" /></Button>
              </>
            ) : <p className="text-sm text-ink-soft"><ReferenceText message="Not billed yet." /></p>}
          </Section>
          {(o.clinical_info || o.diagnosis) && <Section title={referenceT("Clinical details")}><DL cols={2} items={[['Diagnosis', o.diagnosis], ['Clinical information', o.clinical_info]]} /></Section>}
        </div>
      </div>
      <PaymentModal bill={o.bill} open={pay} onClose={() => setPay(false)} onPaid={() => { toast.ok('Payment recorded.'); reload(); }} />
      <PromptModal open={!!cancel} onClose={() => setCancel(null)} title={referenceT("Cancel {value0}", {value0: cancel?.test_name})} label={referenceT("Reason")} confirmText="Cancel test" variant="danger"
        onConfirm={async (reason) => { await post(`/orders/items/${cancel.id}/cancel`, { reason }); toast.ok('Test cancelled and removed from the bill.'); reload(); }} />
      <Modal open={adding} onClose={() => setAdding(false)} title={referenceT("Add tests to this order")} width="max-w-5xl"
        footer={<><Button onClick={() => setAdding(false)}><ReferenceText message="Close" /></Button><Button variant="primary" loading={busy} disabled={!extra.length} onClick={addTests}><ReferenceText message="Add and bill" /> {extra.length || ''}</Button></>}>
        <TestPicker value={extra} onChange={setExtra} />
      </Modal>
      <ReportItemDrawer itemId={item} onClose={() => setItem(null)} onChanged={reload} />
    </>
  );
}
