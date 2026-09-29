'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableContainer} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { AlertTriangle, ExternalLink, Hospital, Pill, Plus, Printer, ReceiptText, RefreshCw, Trash2 } from 'lucide-react';
import {useReferenceHost} from '@pepbits/reference-host';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useReferenceRouter, useReferenceSearchParams } from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { useApiClient, ApiError, errorMessage, qs } from '../../lib/api';
import { useFormat } from '../../lib/format';
import { useApi, useDebounced, useInterval } from '../../lib/hooks';
import { useSession } from '../../lib/session';
import { Page, Row } from '../../lib/types';
import { PatientBanner } from '../patients/PatientBanner';
import { Button, Input, SearchInput, Select } from '../ui/controls';
import { Badge, EmptyState, ErrorBanner, Money, Spinner } from '../ui/display';
import { Modal } from '../ui/overlay';
import { useToast } from '../ui/Toast';
import { InvoiceView } from './InvoiceView';

export interface PaymentRow { mode: string; amount: string; reference: string }
const MODES = ['Cash', 'Card', 'Online', 'Advance'];

export function PaymentRows({ value, onChange, errors = {}, max }: { value: PaymentRow[]; onChange: (v: PaymentRow[]) => void; errors?: Record<string, string>; max: number }) {
  const { money } = useFormat();
  const set = (i: number, p: Partial<PaymentRow>) => onChange(value.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const paid = value.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-[92px_1fr_28px] gap-1.5">
          <Select options={MODES} value={r.mode} onChange={(v) => set(i, { mode: v })} aria-label="Payment mode" />
          <Input type="number" min={0} step="0.01" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })} className="hc-num text-right" aria-label="Amount" />
          <Button size="md" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Remove payment" onClick={() => onChange(value.filter((_, j) => j !== i))} />
          {r.mode !== 'Cash' && (
            <Input className="col-span-2" value={r.reference} invalid={!!errors[`payments.${i}.reference`]} onChange={(e) => set(i, { reference: e.target.value })}
              placeholder={r.mode === 'Card' ? 'Card approval code (required)' : 'Reference'} aria-label="Reference" />
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button size="xs" variant="ghost" icon={<Plus className="h-3 w-3" />} onClick={() => onChange([...value, { mode: 'Card', amount: String(Math.max(0, +(max - paid).toFixed(2))), reference: '' }])}><LocalizedText message="Split payment" /></Button>
        <span className={clsx('hc-num text-hc-xs', paid > max + 0.009 ? 'text-hc-danger-600' : 'text-hc-ink-mute')}><LocalizedText message="Collecting {paid} of {total}" values={{paid:money(paid),total:money(max)}}/></span>
      </div>
      {errors.payments && <p className="text-hc-xs text-hc-danger-600">{errors.payments}</p>}
    </div>
  );
}

export function BillingWorkbench({ category }: { category: 'Hospital' | 'Pharmacy' }) {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const api = useApiClient();
  const {preferences}=useReferenceHost();
  const { fmtTime, money } = useFormat();
  const sp = useReferenceSearchParams();
  const router = useReferenceRouter();
  const toast = useToast();
  const { currency } = useSession();
  const [search, setSearch] = useState('');
  const dq = useDebounced(search, 250);
  const [selected, setSelected] = useState<string | null>(sp.get('encounterId'));
  const pending = useApi<Page>(`/billing/pending${qs({ category, search: dq })}`);
  const preview = useApi<Row>(selected ? `/billing/preview/${selected}?category=${category}` : null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<Row | null>(null);
  useInterval(() => { pending.reload(); if (preview.data?.blocked?.length) preview.reload(); }, 10000);

  const rows = pending.data?.data ?? [];
  useEffect(() => { if (!selected && rows[0]) setSelected(rows[0].encounterId); }, [rows, selected]);
  const pv = preview.data;
  useEffect(() => {
    setErrors({}); setBanner(null);
    if (pv) setPayments(pv.totals.patientShare > 0 ? [{ mode: 'Cash', amount: String(pv.totals.patientShare), reference: '' }] : []);
  }, [pv?.encounter?.id, pv?.totals?.patientShare]); // eslint-disable-hc-line react-hooks/exhaustive-deps

  const create = async (collect: boolean) => {
    if (!pv) return;
    setSaving(true); setErrors({}); setBanner(null);
    try {
      const pays = collect ? payments.filter((p) => Number(p.amount) > 0).map((p) => ({ ...p, amount: Number(p.amount) })) : [];
      const inv = await api<Row>('/billing/invoices', { method: 'POST', body: { encounterId: pv.encounter.id, category, payments: pays } });
      const full = await api<Row>(`/billing/invoices/${inv.id}`);
      toast({ tone: 'ok', title: healthcareT("Invoice {v0} created",{v0:inv.invoiceNo}), body: healthcareT("{v0}{v1}",{v0:inv.status,v1:inv.paymentClass === 'Insurance' ? ` · ${money(inv.payerShare)} to claim` : ''}) });
      setInvoice(full); pending.reload(); preview.reload();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setBanner(Object.values(e.fields)[0]); }
      else setBanner(errorMessage(e));
    } finally { setSaving(false); }
  };

  const Icon = category === 'Pharmacy' ? Pill : Hospital;
  const insured = pv?.encounter?.paymentClass === 'Insurance';

  return (
    <div data-billing-layout={preferences.billingLayout} className="hc-billing flex min-h-0 flex-1 gap-3">
      <aside className="hc-panel flex w-[320px] shrink-0 flex-col overflow-hidden">
        <div className="space-y-2 border-b border-hc-line p-2.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-hc-sm font-semibold"><Icon className="h-4 w-4 text-hc-petrol-600" /><LocalizedText message="Waiting to bill" /> <span className="hc-num rounded bg-hc-canvas px-1.5 text-hc-xs">{pending.data?.total ?? '-'}</span></p>
            <Button size="xs" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} aria-label="Refresh" onClick={pending.reload} />
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Patient, MRN, encounter, payer" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {pending.error && <div className="p-2"><ErrorBanner message={pending.error.message} onRetry={pending.reload} /></div>}
          {!pending.data && pending.loading && <div className="p-4"><Spinner /></div>}
          {pending.data && rows.length === 0 && <EmptyState icon={<ReceiptText className="h-8 w-8" />} title="All caught up" body={t("Signed {v0} lines appear here until they are invoiced.",{v0:category.toLowerCase()})} />}
          {rows.map((r) => (
            <button key={r.encounterId} type="button" onClick={() => setSelected(r.encounterId)}
              className={clsx('block w-full border-b border-hc-line/70 px-3 py-2.5 text-left', selected === r.encounterId ? 'bg-hc-petrol-50' : 'hover:bg-[#F6F8F7]')}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-hc-sm font-medium">{r.patientName}</span>
                <Money value={r.estimatedNet} className="text-hc-xs" />
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2 text-hc-2xs text-hc-ink-mute">
                <span className="truncate"><span className="font-mono">{r.encNo}</span> · {fmtTime(r.createdAt)} · {r.mrn}</span>
                <Badge tone={r.paymentClass === 'Insurance' ? 'petrol' : 'selfpay'}>{r.payerName}</Badge>
              </span>
              <span className="mt-1 flex gap-1.5 text-hc-2xs">
                <span className="text-hc-ok-700">{r.readyCount} <LocalizedText message="ready" /></span>
                {r.blockedCount > 0 && <span className="text-hc-warn-700">· {r.blockedCount} <LocalizedText message="on hold" /></span>}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="hc-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!selected ? <EmptyState title="Select an encounter to bill" /> : preview.error ? <div className="p-3"><ErrorBanner message={preview.error.message} onRetry={preview.reload} /></div> : !pv ? <div className="flex flex-1 items-center justify-center"><Spinner label="Preparing bill" /></div> : (
          <>
            <div className="border-b border-hc-line p-2.5">
              <PatientBanner patient={pv.patient} coverage={pv.coverage} policy={pv.patient.primaryPolicy} paymentClass={pv.encounter.paymentClass} compact
                eligibility={insured ? { status: pv.encounter.eligibilityStatus, reference: pv.encounter.eligibilityRef } : null}
                right={<Link href={`/encounters/${pv.encounter.id}`} className="inline-flex items-center gap-1 text-hc-xs text-hc-petrol-700 hover:underline"><span className="font-mono">{pv.encounter.encNo}</span><ExternalLink className="h-3 w-3" /></Link>} />
            </div>
            <TableContainer className="min-h-0 flex-1 overflow-auto">
              <Table className="w-full border-separate border-spacing-0 text-hc-sm">
                <TableHeader className="sticky top-0 bg-[#F6F8F7] text-hc-xs text-hc-ink-mute">
                  <TableRow className="[&>th]:h-8 [&>th]:border-b [&>th]:border-hc-line [&>th]:px-2.5 [&>th]:font-medium">
                    <TableHead className="w-full text-left"><LocalizedText message="Line" /></TableHead><TableHead className="text-right"><LocalizedText message="Qty" /></TableHead><TableHead className="text-right"><LocalizedText message="Unit" /></TableHead><TableHead className="text-right"><LocalizedText message="Gross" /></TableHead><TableHead className="text-right"><LocalizedText message="Disc." /></TableHead><TableHead className="text-right"><LocalizedText message="Net" /></TableHead><TableHead className="text-right"><LocalizedText message="Patient" /></TableHead>{insured && <TableHead className="text-right"><LocalizedText message="Payer" /></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pv.lines.map((l: Row) => (
                    <TableRow key={l.id} className="[&>td]:h-10 [&>td]:border-b [&>td]:border-hc-line/70 [&>td]:px-2.5 [&>td]:whitespace-nowrap">
                      <TableCell className="max-w-0"><p className="truncate font-medium">{l.name}</p>
                        <p className="truncate text-hc-2xs text-hc-ink-mute"><span className="font-mono">{l.code}</span>{l.authorizationNo ? <LocalizedText message=" · Auth {v0}" values={{v0:l.authorizationNo}}/> : ''}{l.note && <span className="text-hc-warn-700"> · {l.note}</span>}</p></TableCell>
                      <TableCell className="hc-num text-right">{l.qty}</TableCell><TableCell className="hc-num text-right text-hc-ink-soft">{money(l.unitPrice)}</TableCell><TableCell className="hc-num text-right text-hc-ink-soft">{money(l.gross)}</TableCell>
                      <TableCell className="hc-num text-right text-hc-ink-soft">{money(l.discount)}</TableCell><TableCell className="hc-num text-right">{money(l.net)}</TableCell><TableCell className="hc-num text-right font-medium">{money(l.patientShare)}</TableCell>
                      {insured && <TableCell className="hc-num text-right text-hc-ink-soft">{money(l.payerShare)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pv.lines.length === 0 && <EmptyState title="Nothing ready to bill" body="All signed lines are on hold or already invoiced." />}
              {pv.blocked.length > 0 && (
                <div className="m-3 rounded-md border border-hc-warn-100 bg-hc-warn-50/60">
                  <p className="flex items-center gap-1.5 border-b border-hc-warn-100 px-3 py-1.5 text-hc-xs font-semibold text-hc-warn-700"><AlertTriangle className="h-3.5 w-3.5" /><LocalizedText message="On hold, not on this bill ({count})" values={{count:pv.blocked.length}}/></p>
                  {pv.blocked.map((l: Row) => (
                    <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-hc-xs">
                      <span className="truncate font-medium">{l.name}</span>
                      <span className="shrink-0 text-hc-warn-700">{l.reasons.join(' · ')}</span>
                    </div>
                  ))}
                </div>
              )}
              {pv.priorInvoices.length > 0 && (
                <div className="mx-3 mb-3 text-hc-xs text-hc-ink-mute"><LocalizedText message="Already billed on this encounter:" /> {pv.priorInvoices.map((i: Row) => (
                  <Link key={i.id} href={`/billing/invoices?open=${i.id}`} className="ml-1 font-mono text-hc-petrol-700 hover:underline">{i.invoiceNo}</Link>
                ))}</div>
              )}
            </TableContainer>
          </>
        )}
      </section>

      <aside className="hc-panel flex w-[300px] shrink-0 flex-col overflow-hidden">
        <div className="hc-panel-head"><h3 className="hc-panel-title"><LocalizedText message="Settlement" /></h3>{pv && <Badge tone={insured ? 'petrol' : 'selfpay'}>{insured ? <LocalizedText message="Insurance"/> : <LocalizedText message="Self-pay"/>}</Badge>}</div>
        {pv && !pv.lines.length ? (
          <EmptyState icon={<ReceiptText className="h-8 w-8" />} title={pv.blocked.length ? 'Waiting on approvals' : 'Fully billed'} body={pv.blocked.length ? 'On-hold lines move onto the bill once approved.' : 'Every signed line on this encounter has been invoiced.'} />
        ) : pv ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <dl className="hc-num space-y-1.5 border-b border-hc-line p-3 text-hc-sm">
              <div className="flex justify-between text-hc-ink-soft"><dt><LocalizedText message="Gross" /></dt><dd>{money(pv.totals.gross)}</dd></div>
              <div className="flex justify-between text-hc-ink-soft"><dt><LocalizedText message="Contract discount" /></dt><dd>-{money(pv.totals.discount)}</dd></div>
              <div className="flex justify-between font-medium"><dt><LocalizedText message="Net" /></dt><dd>{money(pv.totals.net)}</dd></div>
              {pv.adjustments.map((a: Row, i: number) => <div key={i} className="flex justify-between gap-2 text-hc-xs text-hc-info-700"><dt>{a.label}</dt><dd>{money(a.amount)}</dd></div>)}
              {insured && <div className="flex justify-between text-hc-petrol-700"><dt><LocalizedText message="Claim to payer" /></dt><dd>{money(pv.totals.payerShare)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-hc-line pt-2"><dt className="font-semibold"><LocalizedText message="Patient pays" /></dt><dd className="text-hc-xl font-semibold text-hc-ink"><span className="mr-1 text-hc-xs font-normal text-hc-ink-mute">{currency}</span>{money(pv.totals.patientShare)}</dd></div>
            </dl>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {pv.totals.patientShare > 0 ? <PaymentRows value={payments} onChange={setPayments} errors={errors} max={pv.totals.patientShare} /> : <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="Nothing to collect from the patient." /></p>}
            </div>
            <div className="space-y-1.5 border-t border-hc-line p-3">
              {banner && <ErrorBanner message={banner} />}
              <Button size="lg" variant="primary" className="w-full" loading={saving} disabled={!pv.lines.length} mutation onClick={() => create(true)}>
                {pv.totals.patientShare > 0 ? <LocalizedText message="Invoice & collect {v0}" values={{v0:money(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))}}/> : <LocalizedText message="Create invoice"/>}
              </Button>
              {pv.totals.patientShare > 0 && <Button size="sm" variant="ghost" className="w-full" disabled={!pv.lines.length || saving} mutation onClick={() => create(false)}><LocalizedText message="Invoice now, collect later" /></Button>}
            </div>
          </div>
        ) : <EmptyState title="No bill selected" />}
      </aside>

      <Modal open={!!invoice} onClose={() => setInvoice(null)} width="max-w-3xl" title={t("Invoice {v0}",{v0:invoice?.invoiceNo ?? ''})}
        footer={<>
          <Button variant="ghost" onClick={() => router.push(`/billing/invoices?open=${invoice?.id}`)}><LocalizedText message="Open in invoices" /></Button>
          <Button icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}><LocalizedText message="Print" /></Button>
          <Button variant="primary" onClick={() => { setInvoice(null); setSelected(null); }}><LocalizedText message="Next patient" /></Button>
        </>}>
        {invoice && <InvoiceView inv={invoice} currency={currency} />}
      </Modal>
    </div>
  );
}
