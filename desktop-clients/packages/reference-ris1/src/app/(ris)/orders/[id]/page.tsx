'use client';
import {DiagnosticButton,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { CalendarClock, DoorOpen, Play, Images, FileText, Printer, XCircle, Scan, Siren, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import {useApi,useFmt} from '../../../../lib/client';
import { PageHeader, StatusBadge, PriorityBadge, ModalityChip, WorkflowRail, useToast, TatClock, useSession } from '../../../../components/ui';
import { useOrderAction, ScheduleModal, CancelModal } from '../../../../components/OrderActions';
import PaymentModal from '../../../../components/PaymentModal';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <><dt className="text-ink-soft">{label}</dt><dd className="min-w-0 break-words">{children || '—'}</dd></>;
}

export default function OrderDetail({ params }: { params: { id: string } }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api}=useDiagnosticClient();

  const { data: o, reload } = useApi<any>(`/api/orders/${params.id}`, { poll: 15000 });
  const { data: lk } = useApi<any>('/api/lookups');
  const { user } = useSession();
  const toast = useToast();
  const { run, busy } = useOrderAction(reload);
  const [modal, setModal] = useState<'schedule' | 'cancel' | 'pay' | null>(null);
  const [acquiring, setAcquiring] = useState(false);
  if (!o) return null;

  const acquire = async () => {
    setAcquiring(true);
    try {
      const r = await api(`/api/orders/${o.id}/images`, { method: 'POST' });
      toast('ok', `${r.images} images received from the ${o.modality_code} modality and matched to ${o.accession}`);
      reload();
    } catch (e: any) { toast('error', e.message); } finally { setAcquiring(false); }
  };

  const s = o.status;
  const balance = o.invoice ? o.invoice.net - o.invoice.paid : 0;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-1 text-sm"><Link href="/orders" className="text-petrol hover:underline"><ReferenceText message="Orders" /></Link></div>
      <PageHeader
        title={o.procedure_name}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <span className="id text-ink">{o.accession}</span>
          <StatusBadge status={s} /><PriorityBadge priority={o.priority} />
          {o.report_critical ? <span className="rounded bg-crit-bg px-1.5 py-0.5 text-xs font-bold text-crit"><ReferenceText message="Critical result" /></span> : null}
          <span><ReferenceText message="for" /> <Link href={`/patients/${o.patient_id}`} className="font-bold text-ink hover:underline">{fmt.name(o)}</Link> <span className="id">{o.mrn}</span> · {fmt.age(o.dob)} {o.sex}</span>
        </span>}
        actions={<>
          {['ORDERED', 'SCHEDULED'].includes(s) && <DiagnosticButton className="btn-secondary" onClick={() => setModal('schedule')}><CalendarClock size={16} />{o.scheduled_at ? 'Reschedule' : 'Book'}</DiagnosticButton>}
          {['ORDERED', 'SCHEDULED'].includes(s) && <DiagnosticButton className="btn-primary" disabled={busy} onClick={() => run(o.id, 'arrive', {}, 'Patient checked in')}><DoorOpen size={16} /><ReferenceText message="Check in" /></DiagnosticButton>}
          {s === 'ARRIVED' && <DiagnosticButton className="btn-primary" disabled={busy} onClick={() => run(o.id, 'start', {}, 'Exam started')}><Play size={16} /><ReferenceText message="Start exam" /></DiagnosticButton>}
          {s === 'IN_PROGRESS' && <Link href="/technologist" className="btn-primary"><Scan size={16} /><ReferenceText message="Technologist worklist" /></Link>}
          {['COMPLETED', 'PRELIMINARY', 'FINAL'].includes(s) && <Link href={`/reading/${o.id}`} className="btn-primary"><FileText size={16} />{s === 'FINAL' ? 'Open report' : 'Report'}</Link>}
          {o.study_id && <Link href={`/viewer/${o.study_id}`} target="_blank" className="btn-secondary"><Images size={16} /><ReferenceText message="Images" /></Link>}
          {['PRELIMINARY', 'FINAL'].includes(s) && <Link href={`/print/report/${o.id}`} target="_blank" className="btn-secondary"><Printer size={16} /><ReferenceText message="Print" /></Link>}
          {['ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'].includes(s) && <DiagnosticButton className="btn-danger" onClick={() => setModal('cancel')}><XCircle size={16} /><ReferenceText message="Cancel" /></DiagnosticButton>}
        </>}
      />

      <section className="panel mb-5 px-5 py-4">
        <WorkflowRail order={o} />
        {s === 'CANCELLED' && <p className="mt-3 text-sm text-stat"><b><ReferenceText message="Cancelled" /></b> {fmt.dateTime(o.cancelled_at)}: {o.cancel_reason}</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="panel p-4">
            <h2 className="mb-3 font-bold"><ReferenceText message="Order" /></h2>
            <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 text-sm sm:grid-cols-[150px_1fr_150px_1fr]">
              <Row label={referenceT("Modality")}><span className="flex items-center gap-2"><ModalityChip code={o.modality_code} />{o.body_part}</span></Row>
              <Row label={referenceT("Procedure code")}>{o.procedure_code} <ReferenceText message="· CPT" /> {o.cpt}</Row>
              <Row label={referenceT("Referrer")}>{o.referrer_name}{o.referrer_facility ? `, ${o.referrer_facility}` : ''}</Row>
              <Row label={referenceT("Patient class")}>{({ OP: 'Outpatient', IP: 'Inpatient', ER: 'Emergency' } as any)[o.patient_class]}</Row>
              <Row label={referenceT("Source")}>{o.source}{o.source_system ? ` · ${o.source_system}` : ''}</Row>
              <Row label={referenceT("Placer order")}>{o.placer_order_no && <span className="id">{o.placer_order_no}</span>}</Row>
              <Row label={referenceT("Appointment")}>{o.scheduled_at && `${fmt.dateTime(o.scheduled_at)}${o.room ? ` · ${o.room}` : ''}`}</Row>
              <Row label={referenceT("Technologist")}>{o.technologist_name}</Row>
              <Row label={referenceT("Radiologist")}>
                {['COMPLETED', 'PRELIMINARY', 'ORDERED', 'SCHEDULED', 'ARRIVED', 'IN_PROGRESS'].includes(s) ? (
                  <DiagnosticSelect className="field h-7 py-0 text-sm" value={o.radiologist_id || ''} onChange={(e) => run(o.id, 'assign', { radiologist_id: Number(e.target.value) || null }, 'Radiologist assigned')} aria-label={referenceT("Assign radiologist")}>
                    <option value=""><ReferenceText message="Unassigned (any reader)" /></option>
                    {(lk?.radiologists || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </DiagnosticSelect>
                ) : o.radiologist_name}
              </Row>
              <Row label={referenceT("Report TAT")}><TatClock tat={o.tat} /></Row>
            </dl>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-paper px-3 py-2 text-sm"><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Clinical history" /></div>{o.clinical_history || '—'}</div>
              <div className="rounded-md bg-paper px-3 py-2 text-sm"><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Reason for exam" /></div>{o.reason || '—'}</div>
            </div>
            {(o.contrast_used || o.dose_dlp || o.tech_notes) && (
              <div className="mt-3 rounded-md border border-line px-3 py-2 text-sm">
                <div className="mb-1 text-xs font-bold text-ink-soft"><ReferenceText message="Acquisition" /></div>
                {o.contrast_used && <div><ReferenceText message="Contrast:" /> {o.contrast_used}</div>}
                {(o.dose_ctdivol || o.dose_dlp) && <div><ReferenceText message="Dose: CTDIvol" /> {o.dose_ctdivol ?? '—'} <ReferenceText message="mGy · DLP" /> {o.dose_dlp ?? '—'} <ReferenceText message="mGy·cm" /></div>}
                {o.tech_notes && <div><ReferenceText message="Notes:" /> {o.tech_notes}</div>}
              </div>
            )}
          </section>

          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold"><ReferenceText message="Report" /></h2>
              {o.report && <StatusBadge status={o.report.status} label={o.report.status === 'CORRECTED' ? `Amended v${o.report.version}` : undefined} />}
            </div>
            {!o.report && <p className="text-sm text-ink-soft">{['COMPLETED'].includes(s) ? 'Awaiting a radiologist.' : 'Reporting starts after the exam is complete.'}</p>}
            {o.report && (
              <div className="space-y-3 text-sm">
                {o.report.findings && <div><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Findings" /></div><p className="whitespace-pre-wrap">{o.report.findings}</p></div>}
                {o.report.impression && <div><div className="text-xs font-bold text-ink-soft"><ReferenceText message="Impression" /></div><p className="whitespace-pre-wrap font-bold">{o.report.impression}</p></div>}
                {o.report.addenda?.map((a: any) => (
                  <div key={a.id} className="rounded-md border-l-4 border-urgent bg-urgent-bg/50 px-3 py-2"><div className="text-xs font-bold text-urgent"><ReferenceText message="Addendum ·" /> {a.author_name} · {fmt.dateTime(a.signed_at)}</div><p className="whitespace-pre-wrap">{a.text}</p></div>
                ))}
                <p className="text-xs text-ink-soft">
                  {o.report.signed_name ? `Signed by ${o.report.signed_name}, ${fmt.dateTime(o.report.signed_at)}` : o.report.prelim_name ? `Preliminary by ${o.report.prelim_name}, ${fmt.dateTime(o.report.prelim_at)}` : `Draft by ${o.report.author_name || '—'}`}
                </p>
              </div>
            )}
            {o.critical.map((c: any) => (
              <div key={c.id} className="mt-3 flex items-start gap-2 rounded-md border border-crit/30 bg-crit-bg px-3 py-2 text-sm">
                <Siren size={16} className="mt-0.5 text-crit" />
                <div className="flex-1"><b className="text-crit">{c.category}</b> · <StatusBadge status={c.status} />
                  <div className="text-ink-3">{c.communicated_to ? `Told ${c.communicated_to} by ${c.method?.toLowerCase()} ${fmt.dateTime(c.communicated_at)}${c.readback ? ', read back' : ''}` : 'Not yet communicated'}</div>
                </div>
                {c.status !== 'ACKNOWLEDGED' && <Link href="/critical" className="btn-secondary btn-sm"><ReferenceText message="Manage" /></Link>}
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Order history" /></h2></div>
            <ol className="max-h-80 overflow-y-auto px-4 py-2 scroll-thin">
              {o.history.map((h: any) => (
                <li key={h.id} className="flex gap-3 border-b border-line/50 py-2 text-sm last:border-0">
                  <span className="w-36 shrink-0 text-ink-soft">{fmt.dateTime(h.at)}</span>
                  <span className="flex-1"><b>{fmt.status(h.action.replace(/^ORDER_/, ''))}</b> <span className="text-ink-soft"><ReferenceText message="by" /> {h.user_name || 'system'}</span></span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold"><ReferenceText message="Billing" /></h2>{o.invoice && <StatusBadge status={o.invoice.status} />}</div>
            {o.invoice ? (
              <>
                <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <dt className="text-ink-soft"><ReferenceText message="Invoice" /></dt><dd className="id text-right">{o.invoice.invoice_no}</dd>
                  <dt className="text-ink-soft"><ReferenceText message="Payer" /></dt><dd className="text-right">{fmt.status(o.invoice.payer)}</dd>
                  <dt className="text-ink-soft"><ReferenceText message="Charge" /></dt><dd className="text-right tabular-nums">{fmt.money(o.invoice.amount)}</dd>
                  {o.invoice.discount > 0 && <><dt className="text-ink-soft"><ReferenceText message="Discount" /></dt><dd className="text-right tabular-nums">−{fmt.money(o.invoice.discount)}</dd></>}
                  <dt className="font-bold"><ReferenceText message="Net" /></dt><dd className="text-right font-bold tabular-nums">{fmt.money(o.invoice.net)}</dd>
                  <dt className="text-ink-soft"><ReferenceText message="Paid" /></dt><dd className="text-right tabular-nums text-ok">{fmt.money(o.invoice.paid)}</dd>
                  <dt className="font-bold"><ReferenceText message="Balance" /></dt><dd className={`text-right font-bold tabular-nums ${balance > 0.001 ? 'text-stat' : 'text-ok'}`}>{fmt.money(balance)}</dd>
                </dl>
                {o.payments.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs text-ink-soft">
                    {o.payments.map((p: any) => <li key={p.id} className="flex justify-between"><span>{fmt.dateTime(p.received_at)} · {p.mode}</span><span className="tabular-nums">{fmt.money(p.amount)}</span></li>)}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  {balance > 0.001 && o.invoice.status !== 'CANCELLED' && ['ADMIN', 'BILLING', 'FRONT_DESK'].includes(user?.role || '') && <DiagnosticButton className="btn-primary flex-1" onClick={() => setModal('pay')}><ReferenceText message="Take payment" /></DiagnosticButton>}
                  <Link href={`/print/invoice/${o.invoice.id}`} target="_blank" className="btn-secondary flex-1"><Printer size={15} /><ReferenceText message="Receipt" /></Link>
                </div>
              </>
            ) : <p className="text-sm text-ink-soft"><ReferenceText message="No invoice." /></p>}
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 font-bold"><ReferenceText message="Images" /></h2>
            {o.studies.length ? o.studies.map((st: any) => (
              <div key={st.id} className="mb-2 rounded-md border border-line p-2.5 text-sm">
                <div className="flex items-center justify-between"><b>{st.description || st.modality}</b><Link href={`/viewer/${st.id}`} target="_blank" className="btn-secondary btn-sm"><Images size={14} /><ReferenceText message="View" /></Link></div>
                <div className="text-xs text-ink-soft">{st.num_series} <ReferenceText message="series ·" /> {st.num_instances} <ReferenceText message="images · from" /> {st.source_ae} · {fmt.dateTime(st.received_at)}</div>
                <div className="id mt-1 truncate text-[11px] text-ink-soft" title={st.study_uid}>{st.study_uid}</div>
              </div>
            )) : <p className="text-sm text-ink-soft"><ReferenceText message="No images received for this accession." /></p>}
            {['ARRIVED', 'IN_PROGRESS', 'SCHEDULED', 'ORDERED'].includes(s) && (
              <DiagnosticButton className="btn-secondary mt-1 w-full" disabled={acquiring} onClick={acquire}><Scan size={15} />{acquiring ? 'Receiving images…' : 'Simulate modality acquisition'}</DiagnosticButton>
            )}
          </section>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Interface messages" /></h2><Link href={`/integration?q=${o.accession}`} className="text-xs font-bold text-petrol hover:underline"><ReferenceText message="Message log" /></Link></div>
            {!o.messages.length && <p className="px-4 py-3 text-sm text-ink-soft"><ReferenceText message="No messages exchanged for this order." /></p>}
            <ul>
              {o.messages.map((m: any) => (
                <li key={m.id} className="flex items-center gap-2 border-b border-line/60 px-4 py-2 text-sm last:border-0">
                  {m.direction === 'IN' ? <ArrowDownLeft size={15} className="text-petrol" /> : <ArrowUpRight size={15} className="text-ink-soft" />}
                  <span className="flex-1 truncate"><b>{m.message_type}</b> <span className="text-ink-soft">{m.direction === 'IN' ? 'from' : 'to'} {m.interface_name || m.protocol}</span></span>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          </section>

          {o.priors.length > 0 && (
            <section className="panel">
              <div className="border-b border-line px-4 py-3"><h2 className="font-bold"><ReferenceText message="Prior exams" /></h2></div>
              <ul>
                {o.priors.map((p: any) => (
                  <li key={p.id} className="border-b border-line/60 px-4 py-2 text-sm last:border-0">
                    <div className="flex items-center gap-2"><ModalityChip code={p.modality_code} /><Link href={`/orders/${p.id}`} className="flex-1 truncate font-bold hover:underline">{p.procedure_name}</Link><span className="text-xs text-ink-soft">{fmt.date(p.ordered_at)}</span></div>
                    {p.impression && <p className="mt-1 line-clamp-2 text-xs text-ink-3">{p.impression}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {modal === 'schedule' && <ScheduleModal order={o} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === 'cancel' && <CancelModal order={o} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
      {modal === 'pay' && <PaymentModal invoice={o.invoice} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </div>
  );
}
