'use client';

import clsx from 'clsx';
import { Ban, Check, ChevronLeft, ChevronRight, Download, Landmark, Printer, Search, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Timeline } from '@/components/bill/BillTabs';
import { Drawer, useErrorToast, useToast } from '@/components/ui/overlay';
import { Badge, Button, Checkbox, Empty, ErrorNote, Field, Input, Money, MoneyInput, PageHeader, Select, Skeleton, Tabs } from '@/components/ui/primitives';
import { api, qs, useApi, useDebounced, useMutation } from '@/lib/api';
import { availabilityLabel, dateTime, downloadCsv, money } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { AuditEntry, LedgerRow, SetOff } from '@/lib/types';

interface ListRes { rows: LedgerRow[]; total: number; inflow: number; outflow: number; unrealizedCount: number; page: number; size: number }

export default function ReceiptsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><ReceiptsInner /></Suspense>;
}

function ReceiptsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { meta, can } = useSession();
  const toast = useToast();
  const fail = useErrorToast();
  const { run, pending } = useMutation();
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounced(q, 250);
  const f = {
    kind: sp.get('kind') || '', from: sp.get('from') || '', to: sp.get('to') || '', mode: sp.get('mode') || '', counter: sp.get('counter') || '',
    type: sp.get('type') || '', status: sp.get('status') || '', unrealized: sp.get('unrealized') || '', page: Number(sp.get('page') || 1),
  };
  const open = sp.get('open');
  const set = (patch: Record<string, string | number | null>) => router.replace(`${pathname}${qs({ ...f, q: dq, page: 1, open, ...patch } as Record<string, string | number>)}`, { scroll: false });
  useEffect(() => { if (dq !== (sp.get('q') || '')) set({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, reload } = useApi<ListRes>(`/receipts${qs({ ...f, q: dq })}`);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [f.unrealized]);

  async function realize(bounced: boolean) {
    try {
      await run('/deposits/realize', 'POST', { depositNos: picked, bounced });
      toast({ tone: bounced ? 'info' : 'success', title: bounced ? `${picked.length} cheque${picked.length > 1 ? 's' : ''} marked bounced` : `${picked.length} cheque${picked.length > 1 ? 's' : ''} realized`, body: bounced ? 'The deposits were cancelled.' : 'The amounts now count toward the patients’ deposit balance.' });
      setPicked([]);
    } catch (e) { fail(e); }
  }

  async function exportCsv() {
    try {
      const { data: all } = await api<ListRes>(`/receipts${qs({ ...f, q: dq, page: 1, size: 500 })}`);
      downloadCsv(`receipts-${new Date().toISOString().slice(0, 10)}.csv`, all.rows.map((r) => ({
        number: r.no, date: r.created_at, type: r.label, patient: r.patient_name, mr_no: r.mr_no, bill: r.bill_no || '', mode: r.mode_name,
        reference: r.reference || '', counter: r.counter_name || '', user: r.username, amount: r.amount, status: r.status === 'X' ? 'Cancelled' : 'Active',
      })));
    } catch (e) { fail(e, 'Export failed'); }
  }

  const unrealizedView = f.unrealized === '1';
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div>
      <PageHeader title="Receipts" sub="Every rupee in and out: bill receipts, refunds, sponsor payments and deposits."
        actions={<Button icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Export CSV</Button>} />

      {data && data.unrealizedCount > 0 && !unrealizedView && (
        <button type="button" onClick={() => set({ unrealized: '1', kind: 'deposit' })}
          className="mb-4 flex w-full items-center gap-3 rounded-panel border border-marigold-100 bg-marigold-50 px-4 py-3 text-left text-[13.5px] text-marigold-800 hover:bg-marigold-100/60">
          <Landmark className="h-5 w-5" />
          <span className="flex-1"><b className="font-semibold">{data.unrealizedCount} cheque deposit{data.unrealizedCount > 1 ? 's' : ''}</b> waiting for realization. They don’t count toward balances until cleared.</span>
          <span className="font-medium">Review</span>
        </button>
      )}

      <div className="panel overflow-hidden">
        <Tabs className="px-2" value={unrealizedView ? 'unrealized' : f.kind} onChange={(v) => set(v === 'unrealized' ? { unrealized: '1', kind: 'deposit' } : { kind: v, unrealized: '' })} tabs={[
          { value: '', label: 'All' }, { value: 'bill', label: 'Bill receipts' }, { value: 'pharmacy', label: 'Pharmacy' }, { value: 'deposit', label: 'Deposits' },
          { value: 'unrealized', label: 'Cheques to realize', count: data?.unrealizedCount || null },
        ]} />
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1 md:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Number, bill, patient, reference" className="pl-9" aria-label="Search receipts" />
          </div>
          <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="From date" />
          <span className="text-ink-mute">to</span>
          <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="To date" />
          <Select value={f.type} onChange={(e) => set({ type: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="Type">
            <option value="">All types</option><option value="advance">Advances</option><option value="settlement">Settlements</option><option value="refund">Refunds</option><option value="sponsor">Sponsor</option>
          </Select>
          <Select value={f.mode} onChange={(e) => set({ mode: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="Mode">
            <option value="">All modes</option>{meta?.paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={f.counter} onChange={(e) => set({ counter: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="Counter">
            <option value="">All counters</option>{meta?.counters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={f.status} onChange={(e) => set({ status: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="Status">
            <option value="">Active and cancelled</option><option value="active">Active only</option><option value="cancelled">Cancelled only</option>
          </Select>
        </div>

        {data && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-mist/50 px-4 py-2 text-[13px]">
            <span className="text-ink-soft">{data.total} entries</span>
            <span>In <b className="font-semibold">{money(data.inflow)}</b></span>
            <span>Out <b className="font-semibold text-rose-600">{money(data.outflow)}</b></span>
            <span>Net <b className="font-semibold">{money(data.inflow + data.outflow)}</b></span>
            {unrealizedView && can('realize_cheques') && (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-ink-soft">{picked.length} selected</span>
                <Button size="sm" variant="secondary" icon={<Ban className="h-3.5 w-3.5" />} disabled={!picked.length} onClick={() => realize(true)}>Mark bounced</Button>
                <Button size="sm" variant="primary" icon={<Check className="h-3.5 w-3.5" />} disabled={!picked.length} loading={pending} onClick={() => realize(false)}>Realize</Button>
              </span>
            )}
          </div>
        )}

        {error ? <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                {unrealizedView && <th className="w-9"><Checkbox checked={!!data?.rows.length && picked.length === data.rows.length} onChange={(v) => setPicked(v ? data!.rows.map((r) => r.no) : [])} /></th>}
                <th>Number</th><th>When</th><th>Type</th><th>Patient</th><th className="hidden md:table-cell">Mode</th><th className="hidden lg:table-cell">Counter</th><th className="num">Amount</th>
              </tr></thead>
              <tbody>
                {loading && !data ? Array.from({ length: 10 }).map((_, i) => <tr key={i}><td colSpan={8}><Skeleton className="h-7" /></td></tr>) : data?.rows.map((r) => (
                  <tr key={r.no} className={clsx('row-link', r.status === 'X' && 'text-ink-mute', open === r.no && 'bg-pine-50')}
                    onClick={(e) => { if (!(e.target as HTMLElement).closest('label,input')) set({ open: r.no, page: f.page }); }}>
                    {unrealizedView && <td><Checkbox checked={picked.includes(r.no)} onChange={(v) => setPicked(v ? [...picked, r.no] : picked.filter((x) => x !== r.no))} /></td>}
                    <td className="whitespace-nowrap font-semibold">
                      {r.no}
                      {r.status === 'X' && <Badge tone="rose" className="ml-2">Cancelled</Badge>}
                      {!r.realized && r.status === 'A' && <Badge tone="marigold" className="ml-2">Not cleared</Badge>}
                    </td>
                    <td className="whitespace-nowrap text-ink-soft">{dateTime(r.created_at)}</td>
                    <td className="whitespace-nowrap">{r.label}{r.bill_no && <div className="text-[12px] text-ink-mute">{r.bill_no}</div>}</td>
                    <td className="min-w-[160px]">{r.patient_name}<div className="text-[12px] text-ink-mute">{r.mr_no}</div></td>
                    <td className="hidden whitespace-nowrap md:table-cell">{r.mode_name}{r.reference && <div className="text-[12px] text-ink-mute">{r.reference}</div>}</td>
                    <td className="hidden text-ink-soft lg:table-cell">{r.counter_name}<div className="text-[12px] text-ink-mute">{r.username}</div></td>
                    <td className={clsx('num font-medium', r.status === 'X' && 'line-through')}><Money value={r.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.rows.length === 0 && <Empty icon={<Wallet className="h-5 w-5" />} title={unrealizedView ? 'No cheques waiting' : 'No receipts match'} body={unrealizedView ? 'Every cheque deposit has been realized.' : 'Try widening the dates or clearing filters.'} />}
          </div>
        )}
        {data && data.total > data.size && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] text-ink-soft">
            <span>Page {f.page} of {pages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={f.page <= 1} onClick={() => set({ page: f.page - 1 })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" disabled={f.page >= pages} onClick={() => set({ page: f.page + 1 })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
      <ReceiptDrawer no={open} onClose={() => set({ open: null, page: f.page })} />
    </div>
  );
}

interface Detail extends LedgerRow { raw: Record<string, unknown>; reversal: string | null; usage: SetOff[]; history: AuditEntry[] }

function ReceiptDrawer({ no, onClose }: { no: string | null; onClose: () => void }) {
  const { meta, can } = useSession();
  const { data, error } = useApi<Detail>(no ? `/receipts/${no}` : null);
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ amount: '', modeId: 0, reference: '', bank: '', remarks: '' });
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => { setEdit(false); setCancel(false); setReason(''); }, [no]);
  useEffect(() => { if (data) setF({ amount: String(Math.abs(data.amount)), modeId: data.mode_id, reference: data.reference || '', bank: data.bank || '', remarks: (data.raw.remarks as string) || '' }); }, [data]);
  if (!no) return null;
  const isDeposit = data?.kind === 'deposit';
  const editable = !!data && can('edit_receipt') && data.status === 'A' && !data.reversal_of && !isDeposit && data.bill_status !== 'C' && data.bill_status !== 'X';

  return (
    <Drawer open onClose={onClose} width="lg" title={no} sub={data ? `${data.label}, ${dateTime(data.created_at)}` : 'Loading…'}
      footer={data && (cancel ? (
        <><Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancelling" className="flex-1" />
          <Button variant="ghost" onClick={() => setCancel(false)}>Keep</Button>
          <Button variant="danger" disabled={!reason.trim()} loading={pending} onClick={async () => {
            try { const { data: r } = await run<{ reversal: string }>(`/receipts/${no}/cancel`, 'POST', { reason }); toast({ tone: 'success', title: `${no} cancelled`, body: `Reversal ${r.reversal} recorded${data.card_last4 ? ' and voided on the card terminal' : ''}.` }); setCancel(false); } catch (e) { fail(e, 'Not cancelled'); }
          }}>Cancel receipt</Button></>
      ) : edit ? (
        <><Button variant="ghost" onClick={() => setEdit(false)}>Discard</Button>
          <Button variant="primary" loading={pending} onClick={async () => {
            try { await run(`/receipts/${no}`, 'PATCH', { amount: Number(f.amount), modeId: f.modeId, reference: f.reference, bank: f.bank, remarks: f.remarks }); toast({ tone: 'success', title: `${no} updated` }); setEdit(false); } catch (e) { fail(e, 'Not saved'); }
          }}>Save changes</Button></>
      ) : (
        <>{editable && <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" onClick={() => setCancel(true)}>Cancel receipt</Button>}
          {editable && <Button onClick={() => setEdit(true)}>Edit</Button>}
          <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.open(`/print/receipt/${no}`, '_blank')}>Print</Button></>
      ))}>
      {error ? <ErrorNote error={error} /> : !data ? <Skeleton className="h-64" /> : (
        <div className="space-y-5">
          <div className={clsx('rounded-xl px-4 py-4', data.amount < 0 ? 'bg-rose-50' : 'bg-pine-50')}>
            <p className="text-[12.5px] text-ink-soft">{data.amount < 0 ? 'Paid out' : 'Received'}</p>
            <p className={clsx('text-[30px] font-semibold tracking-[-0.02em]', data.status === 'X' && 'line-through opacity-60')}>{money(Math.abs(data.amount))}</p>
            {data.status === 'X' && <p className="text-[13px] text-rose-700">Cancelled{data.reversal ? ` — reversed by ${data.reversal}` : ''}. {String(data.raw.cancel_reason || '')}</p>}
            {data.reversal_of && <p className="text-[13px]">Reverses {data.reversal_of}</p>}
          </div>
          {edit ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" hint={data.bill_status !== 'A' ? 'Amounts can only change while the bill is open' : undefined}>
                <MoneyInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
              </Field>
              <Field label="Mode">
                <Select value={f.modeId} onChange={(e) => setF({ ...f, modeId: Number(e.target.value) })} disabled={!!data.card_last4}>
                  {meta?.paymentModes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
              <Field label="Bank"><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></Field>
              <Field label="Reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
              <Field label="Remarks" className="col-span-2"><Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></Field>
              <p className="col-span-2 text-[12.5px] text-ink-mute">The receipt keeps its type ({data.label.toLowerCase()}), so finance postings don’t move between accounts.</p>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
              <D label="Patient"><Link href={`/patients/${data.mr_no}`} className="font-medium text-pine-700 hover:underline">{data.patient_name}</Link> <span className="text-ink-mute">{data.mr_no}</span></D>
              <D label="Bill">{data.bill_no ? <Link href={`/bills/${data.bill_no}`} className="font-medium text-pine-700 hover:underline">{data.bill_no}</Link> : '—'}</D>
              <D label="Mode">{data.mode_name}{data.card_last4 ? ` ending ${data.card_last4}` : ''}</D>
              <D label="Reference">{[data.bank, data.reference].filter(Boolean).join(', ') || '—'}</D>
              {data.raw.card_auth ? <D label="Card authorization">{String(data.raw.card_auth)}{data.raw.card_rrn ? `, RRN ${String(data.raw.card_rrn)}` : ''}</D> : null}
              <D label="Counter">{data.counter_name || '—'}</D>
              <D label="Recorded by">{data.username}</D>
              {isDeposit && <D label="Usable for">{data.available_for ? availabilityLabel(data.available_for) : '—'}</D>}
              {isDeposit && <D label="Cheque status">{data.realized ? 'Cleared' : 'Waiting for realization'}</D>}
              {data.payer_name && <D label="Paid by">{data.payer_name}</D>}
              {data.raw.remarks ? <D label="Remarks">{String(data.raw.remarks)}</D> : null}
            </dl>
          )}
          {isDeposit && data.usage.length > 0 && (
            <div>
              <p className="label mb-2">Used on</p>
              <ul className="divide-y divide-line rounded-lg border border-line text-[13px]">
                {data.usage.map((u) => <li key={u.id} className="flex justify-between px-3 py-2"><span>{u.set_off_type === 'R' ? `Bill ${u.bill_no}` : `Refund ${u.refund_no}`}</span><span className="font-medium">{money(u.amount)}</span></li>)}
              </ul>
            </div>
          )}
          <div>
            <p className="label mb-1">History</p>
            <div className="-mx-4"><Timeline entries={data.history} /></div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function D({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-[12px] text-ink-mute">{label}</dt><dd className="mt-0.5">{children}</dd></div>;
}
