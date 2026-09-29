'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, Clock, FileCheck2, Hospital, Pill, PlayCircle, PenLine, ReceiptText, RotateCcw, Send, Trash2, XCircle } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useReferenceRouter } from '@pepbits/reference-host';
import { useMemo, useState } from 'react';
import { ApprovalModal } from '../../../components/encounter/ApprovalModal';
import { CatalogSearch } from '../../../components/encounter/CatalogSearch';
import { Dosing, DrugDosing } from '../../../components/encounter/DrugDosing';
import { PatientBanner } from '../../../components/patients/PatientBanner';
import { Button, Checkbox, Segmented, Input } from '../../../components/ui/controls';
import { Badge, EmptyState, ErrorBanner, Money, Spinner, StatusBadge } from '../../../components/ui/display';
import { useToast } from '../../../components/ui/Toast';
import { useApiClient, errorMessage } from '../../../lib/api';
import { useFormat } from '../../../lib/format';
import { useApi, useInterval } from '../../../lib/hooks';
import { usePageHeader, useWriteAccess } from '../../../lib/session';
import { Approval, OrderLine, Quote, Row } from '../../../lib/types';

const needsPA = (l: OrderLine) => l.priorAuthRequired && !l.erxRequired && ['Required', 'Rejected'].includes(l.priorAuthStatus) && !['Cancelled', 'Billed'].includes(l.status);
const needsErx = (l: OrderLine) => l.erxRequired && ['Required', 'Rejected'].includes(l.erxStatus) && !['Cancelled', 'Billed'].includes(l.status);

function QtyCell({ line, onSaved }: { line: OrderLine; onSaved: () => void }) {
 const {t:healthcareT}=useHealthcareLocalization();
  const api = useApiClient();
  const toast = useToast();
  const [v, setV] = useState(String(line.qty));
  const canWrite=useWriteAccess();
  if (line.status !== 'Draft' || !canWrite) return <span className="hc-num">{line.qty}</span>;
  const commit = async () => {
    const n = Number(v);
    if (!n || n === line.qty) { setV(String(line.qty)); return; }
    try { await api(`/orders/${line.id}`, { method: 'PUT', body: { qty: n } }); onSaved(); }
    catch (e) { toast({ tone: 'danger', title: healthcareT("Could not change quantity"), body: errorMessage(e) }); setV(String(line.qty)); }
  };
  return <Input aria-label="Quantity" type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    onClick={(e) => e.stopPropagation()} className="hc-num h-7 w-14 rounded border border-hc-line-strong px-1.5 text-right text-hc-sm focus:border-hc-petrol-500 focus:outline-none" />;
}

export default function EncounterPage({ params }: { params: { id: string } }) {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t:translate}=useLocalization();
  const api = useApiClient();
  const { fmtDateTime, money, sinceLabel , fmtTime } = useFormat();
  const router = useReferenceRouter();
  const toast = useToast();
  const { data: enc, error, reload } = useApi<Row>(`/encounters/${params.id}`);
  usePageHeader(enc ? `${enc.encNo} · ${enc.patientName}` : 'Encounter', enc ? `${enc.encounterType} · ${enc.providerName || 'Pharmacy counter'} · ${fmtDateTime(enc.createdAt)}` : undefined);
  const [filter, setFilter] = useState<'All' | 'Hospital' | 'Pharmacy'>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dosing, setDosing] = useState<Quote | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<{ channel: 'PriorAuth' | 'eRx'; lines: OrderLine[] } | null>(null);

  const orders: OrderLine[] = useMemo(() => enc?.orders ?? [], [enc]);
  const approvals: Approval[] = enc?.approvals ?? [];
  const pending = approvals.some((a) => a.status === 'Pending');
  useInterval(reload, 2000, pending);

  if (error) return <ErrorBanner message={error.message} onRetry={reload} />;
  if (!enc) return <div className="flex flex-1 items-center justify-center"><Spinner label="Loading encounter" /></div>;

  const insured = enc.paymentClass === 'Insurance';
  const closed = ['Completed', 'Cancelled'].includes(enc.status);
  const live = orders.filter((o) => o.status !== 'Cancelled');
  const visible = orders.filter((o) => filter === 'All' || o.billingCategory === filter);
  const sel = orders.filter((o) => selected.has(o.id));
  const scope = sel.length ? sel : live;
  const drafts = scope.filter((o) => o.status === 'Draft');
  const paLines = insured ? scope.filter(needsPA) : [];
  const erxLines = scope.filter(needsErx);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const add = async (q: Quote, d?: Dosing) => {
    setAdding(true);
    try {
      const o = await api<OrderLine>(`/encounters/${enc.id}/orders`, { method: 'POST', body: { code: q.code, qty: d?.qty ?? 1, ...(d ?? {}) } });
      setDosing(null); reload();
      toast({ tone: 'ok', title: healthcareT("{v0} added",{v0:o.name}), body: [o.priorAuthStatus === 'Required' && !o.erxRequired && 'Needs prior approval', o.erxStatus === 'Required' && 'Needs eRx', !o.covered && 'Not covered: patient pays in full'].filter(Boolean).join(' · ') || undefined });
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not add line"), body: errorMessage(e) }); }
    finally { setAdding(false); }
  };
  const onPick = (q: Quote) => (q.category === 'Drug' ? setDosing(q) : add(q));

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast({ tone: 'ok', title: ok }); setSelected(new Set()); reload(); }
    catch (e) { toast({ tone: 'danger', title: healthcareT("Action failed"), body: errorMessage(e) }); }
    finally { setBusy(null); }
  };
  const sign = () => run('sign', () => api(`/encounters/${enc.id}/orders/sign`, { method: 'POST', body: { orderIds: drafts.map((d) => d.id) } }), `${drafts.length} line${drafts.length === 1 ? '' : 's'} signed`);
  const cancelLine = (o: OrderLine) => run(`x-${o.id}`, () => api(`/orders/${o.id}`, { method: 'DELETE' }), `${o.name} cancelled`);
  const setStatus = (status: string) => run(`s-${status}`, () => api(`/encounters/${enc.id}/status`, { method: 'PATCH', body: { status } }), `Encounter ${status.toLowerCase()}`);

  const totals = enc.totals ?? {};
  const inv: Row[] = enc.invoices ?? [];
  const unbilled = (cat: string) => live.filter((o) => o.billingCategory === cat && o.status !== 'Billed').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push('/encounters')} aria-label="Back to encounters" />
        <PatientBanner className="flex-1" patient={enc.patient} policy={enc.policy} coverage={enc.coverage} paymentClass={enc.paymentClass}
          eligibility={insured ? { status: enc.eligibilityStatus, reference: enc.eligibilityRef } : null}
          right={
            <div className="flex items-center gap-2">
              <div className="text-right leading-tight">
                <p className="font-mono text-hc-xs font-medium">{enc.encNo}</p>
                <p className="text-hc-2xs text-hc-ink-mute">{enc.appointment ? <LocalizedText message="{v0} · {v1}" values={{v0:enc.appointment.apptNo,v1:fmtTime(enc.appointment.startTime)}}/> : enc.encounterType}</p>
              </div>
              <StatusBadge status={enc.status} />
              {enc.status === 'Registered' && <Button mutation size="sm" variant="subtle" icon={<PlayCircle className="h-3.5 w-3.5" />} loading={busy === 's-In Consultation'} onClick={() => setStatus('In Consultation')}><LocalizedText message="Start" /></Button>}
              {enc.status === 'In Consultation' && <Button mutation size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={busy === 's-Completed'} onClick={() => setStatus('Completed')}><LocalizedText message="Complete" /></Button>}
              {!closed && <Button mutation size="sm" variant="ghost" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => confirm('Cancel this encounter? Unbilled lines will not be charged.') && setStatus('Cancelled')} aria-label="Cancel encounter" title="Cancel encounter" />}
              {enc.status === 'Completed' && <Button mutation size="sm" variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setStatus('In Consultation')}><LocalizedText message="Reopen" /></Button>}
            </div>
          } />
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <section className="hc-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-hc-line p-2.5">
            <CatalogSearch policyId={insured ? enc.policyId : undefined} encounterType={enc.encounterType} onPick={onPick} disabled={closed} kind="all" />
          </div>
          {dosing && <DrugDosing quote={dosing} allergies={enc.patient?.allergies ?? ''} adding={adding} onCancel={() => setDosing(null)} onAdd={(d) => add(dosing, d)} />}
          <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
            <Segmented size="sm" value={filter} onChange={setFilter} options={[
              { value: 'All', label: 'All lines', count: live.length },
              { value: 'Hospital', label: 'Hospital', icon: <Hospital className="h-3 w-3" />, count: live.filter((o) => o.billingCategory === 'Hospital').length },
              { value: 'Pharmacy', label: 'Pharmacy', icon: <Pill className="h-3 w-3" />, count: live.filter((o) => o.billingCategory === 'Pharmacy').length },
            ]} />
            {sel.length > 0 && <span className="text-hc-xs text-hc-ink-mute">{sel.length} <LocalizedText message="selected ·" /> <button type="button" className="text-hc-petrol-700 hover:underline" onClick={() => setSelected(new Set())}><LocalizedText message="clear" /></button></span>}
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button mutation size="sm" variant="secondary" icon={<PenLine className="h-3.5 w-3.5" />} disabled={!drafts.length || closed} loading={busy === 'sign'} onClick={sign}><LocalizedText message="Sign" />{drafts.length ? <LocalizedText message=" {v0}" values={{v0:drafts.length}}/> : ''}</Button>
              {insured && <Button size="sm" variant="secondary" className="border-hc-warn-100 text-hc-warn-700 hover:bg-hc-warn-50" icon={<FileCheck2 className="h-3.5 w-3.5" />} disabled={!paLines.length} mutation onClick={() => setModal({ channel: 'PriorAuth', lines: paLines })}><LocalizedText message="Prior approval" />{paLines.length ? <LocalizedText message=" {v0}" values={{v0:paLines.length}}/> : ''}</Button>}
              <Button size="sm" variant="secondary" className="border-hc-info-100 text-hc-info-700 hover:bg-hc-info-50" icon={<Send className="h-3.5 w-3.5" />} disabled={!erxLines.length} mutation onClick={() => setModal({ channel: 'eRx', lines: erxLines })}><LocalizedText message="Send eRx" />{erxLines.length ? <LocalizedText message=" {v0}" values={{v0:erxLines.length}}/> : ''}</Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {visible.length === 0 ? (
              <EmptyState icon={<ReceiptText className="h-8 w-8" />} title="No orders yet" body="Search the catalog above. Prices, coverage and approval needs are shown before you add a line." />
            ) : (
              <Table className="w-full border-separate border-spacing-0 text-hc-sm">
                <TableHeader className="sticky top-0 z-10 bg-[#F6F8F7] text-hc-xs text-hc-ink-mute">
                  <TableRow className="[&>th]:h-8 [&>th]:border-b [&>th]:border-hc-line [&>th]:px-2.5 [&>th]:font-medium">
                    <TableHead className="w-8"><span className="sr-only"><LocalizedText message="Select" /></span></TableHead>
                    <TableHead className="w-full text-left"><LocalizedText message="Order" /></TableHead><TableHead className="text-left"><LocalizedText message="Bill" /></TableHead><TableHead className="text-right"><LocalizedText message="Qty" /></TableHead><TableHead className="text-right"><LocalizedText message="Unit" /></TableHead><TableHead className="text-right"><LocalizedText message="Net" /></TableHead>
                    <TableHead className="text-right"><LocalizedText message="Patient" /></TableHead>{insured && <TableHead className="text-right"><LocalizedText message="Payer" /></TableHead>}<TableHead className="text-left"><LocalizedText message="Approval" /></TableHead><TableHead className="text-left"><LocalizedText message="Status" /></TableHead><TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((o) => {
                    const dead = o.status === 'Cancelled';
                    return (
                      <TableRow key={o.id} onClick={() => !dead && toggle(o.id)} className={clsx('group cursor-pointer [&>td]:h-11 [&>td]:border-b [&>td]:border-hc-line/70 [&>td]:px-2.5 [&>td]:whitespace-nowrap', selected.has(o.id) ? 'bg-hc-petrol-50' : 'hover:bg-[#F6F8F7]', dead && 'text-hc-ink-faint line-through')}>
                        <TableCell onClick={(e) => e.stopPropagation()}>{!dead && <Checkbox checked={selected.has(o.id)} onChange={() => toggle(o.id)} />}</TableCell>
                        <TableCell className="max-w-0">
                          <p className="truncate font-medium">{o.name}</p>
                          <p className="truncate text-hc-2xs text-hc-ink-mute"><span className="font-mono">{o.orderNo}</span> · {o.category}{o.dosage ? <LocalizedText message=" · {v0}, {v1}, {v2}d, {v3}" values={{v0:o.dosage,v1:o.frequency,v2:o.durationDays,v3:o.route}}/> : ''}{!o.covered && <span className="text-hc-danger-600"> <LocalizedText message="· not covered" /></span>}</p>
                        </TableCell>
                        <TableCell>{o.billingCategory === 'Pharmacy' ? <Badge tone="selfpay"><LocalizedText message="Pharmacy" /></Badge> : <Badge tone="petrol"><LocalizedText message="Hospital" /></Badge>}</TableCell>
                        <TableCell className="text-right"><QtyCell line={o} onSaved={reload} /></TableCell>
                        <TableCell className="hc-num text-right text-hc-ink-soft">{money(o.unitPrice)}</TableCell>
                        <TableCell className="hc-num text-right">{money(o.net)}</TableCell>
                        <TableCell className="hc-num text-right font-medium">{money(o.patientShare)}</TableCell>
                        {insured && <TableCell className="hc-num text-right text-hc-ink-soft">{money(o.payerShare)}</TableCell>}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {o.erxRequired ? <Badge tone={o.erxStatus === 'Approved' ? 'ok' : o.erxStatus === 'Rejected' ? 'danger' : o.erxStatus === 'Pending' ? 'warn' : 'info'} dot><LocalizedText message="eRx" /> {o.erxStatus === 'Required' ? <LocalizedText message="needed"/> : o.erxStatus.toLowerCase()}</Badge>
                              : o.priorAuthRequired ? <Badge tone={o.priorAuthStatus === 'Approved' ? 'ok' : o.priorAuthStatus === 'Rejected' ? 'danger' : 'warn'} dot><LocalizedText message="PA" /> {o.priorAuthStatus === 'Required' ? <LocalizedText message="needed"/> : o.priorAuthStatus.toLowerCase()}</Badge>
                              : <span className="text-hc-2xs text-hc-ink-faint"><LocalizedText message="Not needed" /></span>}
                          </div>
                        </TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {['Draft', 'Signed'].includes(o.status) && !closed && (
                            <Button mutation size="xs" variant="ghost" className="opacity-0 group-hover:opacity-100 hover:text-hc-danger-600" icon={<Trash2 className="h-3.5 w-3.5" />} aria-label={translate("Cancel {v0}",{v0:o.name})} title="Cancel line"
                              loading={busy === `x-${o.id}`} onClick={() => cancelLine(o)} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <div className="flex h-10 shrink-0 items-center gap-5 border-t border-hc-line bg-[#F6F8F7] px-3 text-hc-xs">
            <span className="text-hc-ink-mute"><LocalizedText message="Totals" /></span>
            <span><LocalizedText message="Net" /> <Money value={totals.net} strong /></span>
            <span><LocalizedText message="Patient" /> <Money value={totals.patientShare} strong className="text-hc-selfpay-700" /></span>
            {insured && <span><LocalizedText message="Payer" /> <Money value={totals.payerShare} strong className="text-hc-petrol-700" /></span>}
            <span className="ml-auto text-hc-2xs text-hc-ink-mute"><LocalizedText message="Co-pay caps and deductibles are applied on the bill" /></span>
          </div>
        </section>

        <aside className="flex w-[330px] shrink-0 flex-col gap-3">
          <section className="hc-panel">
            <div className="hc-panel-head"><h3 className="hc-panel-title"><LocalizedText message="Billing" /></h3></div>
            <div className="space-y-2 p-3">
              {[['Hospital', '/billing/hospital', Hospital, totals.hospital], ['Pharmacy', '/billing/pharmacy', Pill, totals.pharmacy]].map(([cat, href, Icon, amt]) => {
                const I = Icon as typeof Hospital; const n = unbilled(cat as string);
                return (
                  <Link key={cat as string} href={`${href}?encounterId=${enc.id}`} className="flex items-center gap-3 rounded-md border border-hc-line px-3 py-2 hover:border-hc-petrol-300 hover:bg-hc-petrol-50/40">
                    <I className="h-4 w-4 text-hc-petrol-600" />
                    <span className="flex-1"><span className="block text-hc-sm font-medium">{cat as string} <LocalizedText message="bill" /></span><span className="text-hc-2xs text-hc-ink-mute">{n ? <LocalizedText message="{v0} line{v1} to bill" values={{v0:n,v1:n === 1 ? '' : 's'}}/> : <LocalizedText message="Nothing pending"/>}</span></span>
                    <Money value={amt as number} />
                  </Link>
                );
              })}
              {inv.map((i) => (
                <Link key={i.id} href={`/billing/invoices?open=${i.id}`} className="flex items-center justify-between gap-2 px-1 text-hc-xs hover:text-hc-petrol-700">
                  <span className="font-mono">{i.invoiceNo}</span><Money value={i.net} /><StatusBadge status={i.status} />
                </Link>
              ))}
            </div>
          </section>
          <section className="hc-panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="hc-panel-head">
              <h3 className="hc-panel-title"><LocalizedText message="Approvals" /></h3>
              {pending && <span className="flex items-center gap-1 text-hc-2xs text-hc-warn-700"><Clock className="h-3 w-3 animate-pulse" /><LocalizedText message="Waiting for payer" /></span>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {approvals.length === 0 ? <p className="text-hc-xs text-hc-ink-mute">{orders.some((o) => needsPA(o) || needsErx(o)) ? <LocalizedText message="Some lines need approval. Select them and use Prior approval or Send eRx."/> : <LocalizedText message="No approvals needed so far."/>}</p> : (
                <ol className="relative space-y-3 border-l border-hc-line pl-4">
                  {approvals.map((a) => (
                    <li key={a.id} className="relative">
                      <span className={clsx('absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white', a.status === 'Approved' ? 'bg-hc-ok-600' : a.status === 'Rejected' ? 'bg-hc-danger-600' : 'bg-hc-warn-600')} />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-hc-xs font-medium">{a.channel === 'eRx' ? <LocalizedText message="eRx"/> : <LocalizedText message="Prior approval"/>} <span className="font-mono text-hc-ink-mute">{a.approvalNo}</span></span>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="mt-0.5 truncate text-hc-xs text-hc-ink-soft">{a.itemsLabel}</p>
                      <p className="text-hc-2xs text-hc-ink-mute">{a.diagnosis}</p>
                      <p className="hc-num mt-0.5 text-hc-2xs text-hc-ink-mute"><LocalizedText message="Requested" /> {money(a.requestedAmount)}{a.status === 'Approved' ? <LocalizedText message=" · approved {v0}" values={{v0:money(a.approvedAmount)}}/> : ''} · {sinceLabel(a.submittedAt)}</p>
                      {a.authorizationNo && <p className="mt-0.5 font-mono text-hc-2xs text-hc-ok-700">{a.authorizationNo}</p>}
                      {a.remarks && <p className={clsx('mt-0.5 text-hc-2xs', a.status === 'Rejected' ? 'text-hc-danger-700' : 'text-hc-ink-mute')}>{a.remarks}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </aside>
      </div>

      {modal && <ApprovalModal open onClose={() => setModal(null)} channel={modal.channel} encounterId={enc.id} lines={modal.lines} insured={insured} onSubmitted={() => { setSelected(new Set()); reload(); }} />}
    </div>
  );
}
