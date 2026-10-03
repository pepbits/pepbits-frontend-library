'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import {useParams} from '@pepbits/reference-diagnostics';
import { Ban, FileText, Plus, Receipt, Syringe, Truck } from 'lucide-react';

import { useAuth } from '../../../../lib/auth';
import { useApi, useCurrency } from '../../../../lib/hooks';
import {dueIn} from '../../../../lib/format';
import { Badge, Button, Card, ErrorNote, Loading, Modal, PageHeader, ReasonDialog, TubeChip, useAction } from '../../../../components/ui';
import { StatusRail } from '../../../../components/Rail';
import { InvoiceDialog } from '../../../../components/InvoiceDialog';
import { TestPicker } from '../../../../components/TestPicker';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function OrderDetail() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {fmtDateTime,money}=useDiagnosticFormat();

  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { can } = useAuth();
  const currency = useCurrency();
  const { data: o, error, reload } = useApi<any>(`/orders/${id}`);
  const [billOpen, setBillOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState<number[]>([]);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const { busy, run } = useAction();

  useEffect(() => { if (sp.get('bill') && o && can('RECEPTION')) setBillOpen(true); }, [sp, o, can]);

  if (error) return <ErrorNote error={error} />;
  if (!o) return <Loading />;

  const active = o.tests.filter((t: any) => t.status !== 'CANCELLED');
  const total = active.reduce((s: number, t: any) => s + t.price, 0);
  const unbilled = active.filter((t: any) => !t.isBilled);
  const toCollect = active.filter((t: any) => ['ORDERED', 'BILLED'].includes(t.status));
  const signed = active.filter((t: any) => t.status === 'SIGNED').length;

  return (
    <div>
      <PageHeader title={referenceT("Order {value0}", {value0: o.orderNo})}
        subtitle={<><ReferenceText message="Placed" /> {fmtDateTime(o.createdAt)} · <Badge value={o.priority} /> <Badge value={o.source} /> <Badge value={o.status} />{o.externalOrderNo && <span className="ml-2 font-mono text-xs"><ReferenceText message="external" /> {o.externalOrderNo}</span>}</>}
        actions={<>
          {can('RECEPTION', 'TECHNOLOGIST') && o.status !== 'CANCELLED' && <Button icon={Plus} onClick={() => { setAdding([]); setAddOpen(true); }}><ReferenceText message="Add tests" /></Button>}
          {can('RECEPTION') && unbilled.length > 0 && <Button icon={Receipt} variant="primary" onClick={() => setBillOpen(true)}><ReferenceText message="Bill" /> {unbilled.length} <ReferenceText message="test" />{unbilled.length > 1 ? 's' : ''}</Button>}
          {can('PHLEBOTOMIST', 'RECEPTION') && toCollect.length > 0 && <Button icon={Syringe} onClick={() => router.push(`/collection?q=${o.patient.mrn}`)}><ReferenceText message="Collect samples" /></Button>}
          {(signed > 0 || o.report) && <Button icon={FileText} onClick={() => router.push(`/reports/${o.id}`)}><ReferenceText message="Report" /></Button>}
        </>} />

      <CardGrid className="grid gap-4 lg:grid-cols-3">
        <Card title={referenceT("Patient")}>
          <div className="text-base font-semibold">{o.patient.fullName}</div>
          <div className="text-sm text-ink-soft"><span className="font-mono">{o.patient.mrn}</span> · {o.patient.gender} · {o.patient.age}{o.patient.isPregnant ? ' · pregnant' : ''}</div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="label"><ReferenceText message="Doctor" /></dt><dd>{o.doctor?.name ?? 'Self'}</dd></div>
            <div><dt className="label"><ReferenceText message="Location" /></dt><dd>{o.patientLocation || '—'}</dd></div>
            <div><dt className="label"><ReferenceText message="Diagnosis" /></dt><dd>{o.diagnosis || '—'}</dd></div>
            <div><dt className="label"><ReferenceText message="Clinical notes" /></dt><dd>{o.clinicalNotes || '—'}</dd></div>
          </dl>
        </Card>
        <Card title={referenceT("Billing")} actions={can('RECEPTION') && o.invoices.length > 0 && <Link className="text-xs text-lab-700 hover:underline" href={`/billing/${o.invoices[o.invoices.length - 1].id}`}><ReferenceText message="Open invoice" /></Link>}>
          <div className="flex justify-between text-sm"><span><ReferenceText message="Order value" /></span><span className="num">{money(total, currency)}</span></div>
          {o.invoices.map((i: any) => (
            <Link key={i.id} href={`/billing/${i.id}`} className="mt-2 flex items-center justify-between rounded border border-line px-2 py-1.5 text-sm hover:border-lab-500">
              <span className="font-mono text-xs">{i.invoiceNo}</span>
              <span className="num">{money(i.netAmount, currency)}</span>
              <Badge value={i.status} />
            </Link>
          ))}
          {unbilled.length > 0 && <div className="mt-2 text-sm text-flag-warn">{unbilled.length} <ReferenceText message="test(s) not yet billed ·" /> {money(unbilled.reduce((s: number, t: any) => s + t.price, 0), currency)}</div>}
        </Card>
        <Card title={referenceT("Samples")}>
          {!o.samples.length ? <div className="text-sm text-ink-mute"><ReferenceText message="Not collected yet." /></div> : o.samples.map((s: any) => {
            const t = o.tests.find((x: any) => x.sampleId === s.id);
            return (
              <Link key={s.id} href={`/samples?open=${s.id}`} className="mb-1.5 flex items-center gap-2 rounded border border-line px-2 py-1.5 text-sm hover:border-lab-500">
                <TubeChip color={t?.container?.capColor} size="sm" />
                <span className="font-mono text-xs">{s.sampleNo}</span>
                <span className="flex-1 text-xs text-ink-soft">{t?.sampleType?.name}</span>
                <Badge value={s.status} />
              </Link>
            );
          })}
        </Card>
      </CardGrid>

      <Card title={referenceT("Tests")} className="mt-4" bodyClass="p-0">
        <div className="overflow-x-auto">
          <DiagnosticTable className="tbl">
            <TableHeader><TableRow><TableHead><ReferenceText message="Test" /></TableHead><TableHead><ReferenceText message="Department" /></TableHead><TableHead><ReferenceText message="Sample" /></TableHead><TableHead><ReferenceText message="Progress" /></TableHead><TableHead><ReferenceText message="Status" /></TableHead><TableHead><ReferenceText message="Due" /></TableHead><TableHead className="text-right"><ReferenceText message="Price" /></TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {o.tests.map((t: any) => {
                const due = dueIn(t.dueAt);
                const done = ['SIGNED', 'CANCELLED'].includes(t.status);
                return (
                  <TableRow key={t.id} className={t.status === 'CANCELLED' ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="font-medium">{t.test?.name}</div>
                      <div className="text-xs2 text-ink-mute">{t.test?.code}{t.bodySite ? ` · ${t.bodySite.name}` : ''}{t.amendCount > 0 ? ` · amended ×${t.amendCount}` : ''}{t.cancelReason ? ` · ${t.cancelReason}` : ''}</div>
                    </TableCell>
                    <TableCell className="text-sm">{t.department?.name}<div className="text-xs2 text-ink-mute">{t.subDepartment?.name}</div></TableCell>
                    <TableCell><span className="inline-flex items-center gap-1.5"><TubeChip size="sm" color={t.container?.capColor} /><span className="font-mono text-xs">{t.sample?.sampleNo ?? '—'}</span></span></TableCell>
                    <TableCell><StatusRail status={t.status} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1"><Badge value={t.status} />{t.isOutsourced && <Badge value="OUTSOURCED" label={referenceT("Ref lab")} />}{!t.isBilled && t.status !== 'CANCELLED' && <Badge value="UNPAID" label={referenceT("Unbilled")} />}</div>
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-xs ${!done && due.overdue ? 'font-medium text-flag-crit' : 'text-ink-soft'}`}>{done ? (t.signedAt ? `signed ${fmtDateTime(t.signedAt)}` : '—') : due.text}</TableCell>
                    <TableCell className="num text-right">{money(t.price, currency)}</TableCell>
                    <TableCell className="text-right">
                      {can('RECEPTION', 'TECHNOLOGIST') && !['SIGNED', 'CANCELLED', 'VALIDATED'].includes(t.status) && (
                        <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCancelId(t.id)}><ReferenceText message="Cancel" /></Button>
                      )}
                      {t.isOutsourced && t.status === 'ACCESSIONED' && <Link href="/outsource" className="ml-1 inline-flex items-center gap-1 text-xs text-flag-warn hover:underline"><Truck className="h-3 w-3" /><ReferenceText message="Ship" /></Link>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DiagnosticTable>
        </div>
      </Card>

      <InvoiceDialog open={billOpen} order={o} onClose={() => { setBillOpen(false); if (sp.get('bill')) router.replace(`/orders/${o.id}`); }} onDone={() => reload()} />
      <ReasonDialog open={cancelId !== null} title={referenceT("Cancel test")} label={referenceT("Reason for cancellation")} confirmLabel={referenceT("Cancel test")} variant="danger"
        options={['Ordered in error', 'Patient refused', 'Duplicate order', 'Doctor request']} onClose={() => setCancelId(null)}
        onSubmit={async (reason) => { await api.post(`/orders/order-tests/${cancelId}/cancel`, { reason }); reload(); }} />
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={referenceT("Add tests to this order")} width="max-w-3xl"
        footer={<><Button onClick={() => setAddOpen(false)}><ReferenceText message="Close" /></Button><Button variant="primary" disabled={!adding.length} loading={busy === 'add'}
          onClick={() => run('add', () => api.post(`/orders/${o.id}/tests`, { testIds: adding }), 'Tests added').then((r) => { if (r) { setAddOpen(false); reload(); } })}><ReferenceText message="Add" /> {adding.length || ''} <ReferenceText message="test" />{adding.length === 1 ? '' : 's'}</Button></>}>
        <div className="h-[420px]">
          <TestPicker showProfiles={false} currency={currency} excludeTestIds={active.map((t: any) => t.testId)} selectedTests={adding} onAddTest={(t) => setAdding((s) => [...s, t.id])} />
        </div>
        {adding.length > 0 && <div className="mt-2 text-xs text-ink-soft"><ReferenceText message="Selected:" /> {adding.length} <ReferenceText message="test(s). Add-on tests can be attached to an already collected tube at collection." /></div>}
      </Modal>
    </div>
  );
}
