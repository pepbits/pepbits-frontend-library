'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Plus, ReceiptText, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useShell } from '@/components/shell/AppShell';
import { Badge, Button, Empty, ErrorNote, Input, Money, PageHeader, Segmented, Select, Skeleton, StatusBadge } from '@/components/ui/primitives';
import { qs, useApi, useDebounced } from '@/lib/api';
import { billTypeLabel, money, relative } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Bill } from '@/lib/types';

interface ListRes {
  rows: Bill[]; total: number; page: number; size: number;
  kpi: { open: number; finalized_due: number; patient_outstanding: number; sponsor_outstanding: number; overpaid: number };
}

export default function BillsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><BillsInner /></Suspense>;
}

function BillsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { openNewBill } = useShell();
  const { can } = useSession();
  const [q, setQ] = useState(sp.get('q') || '');
  const dq = useDebounced(q, 250);
  const f = {
    status: sp.get('status') || '', type: sp.get('type') || '', insured: sp.get('insured') || '', due: sp.get('due') || '',
    sort: sp.get('sort') || 'updated', page: Number(sp.get('page') || 1),
  };
  const set = (patch: Partial<Record<keyof typeof f | 'q', string | number>>) => {
    const next = { ...f, q: dq, page: 1, ...patch };
    router.replace(`${pathname}${qs(next as Record<string, string | number>)}`, { scroll: false });
  };
  useEffect(() => { if (dq !== (sp.get('q') || '')) set({ q: dq }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, reload } = useApi<ListRes>(`/bills${qs({ ...f, q: dq, size: 30 })}`);
  const k = data?.kpi;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const tiles = [
    { key: 'open', label: 'Open bills', value: k ? String(k.open) : '–', active: f.status === 'A' && !f.due, onClick: () => set({ status: f.status === 'A' && !f.due ? '' : 'A', due: '' }) },
    { key: 'fd', label: 'Finalized, patient owes', value: k ? String(k.finalized_due) : '–', active: f.status === 'F' && f.due === 'patient', onClick: () => set(f.status === 'F' && f.due === 'patient' ? { status: '', due: '' } : { status: 'F', due: 'patient' }) },
    { key: 'po', label: 'Patient outstanding', value: k ? money(k.patient_outstanding, { whole: true }) : '–', tone: 'due', active: !f.status && f.due === 'patient', onClick: () => set(!f.status && f.due === 'patient' ? { due: '' } : { status: '', due: 'patient' }) },
    { key: 'so', label: 'Sponsor outstanding', value: k ? money(k.sponsor_outstanding, { whole: true }) : '–', active: f.due === 'sponsor', onClick: () => set({ status: '', due: f.due === 'sponsor' ? '' : 'sponsor' }) },
    { key: 'op', label: 'Overpaid, needs action', value: k ? String(k.overpaid) : '–', tone: 'rose', active: f.due === 'overpaid', onClick: () => set({ status: '', due: f.due === 'overpaid' ? '' : 'overpaid' }) },
  ];

  return (
    <div>
      <PageHeader title="Bills" sub="Every bill across visits. Click a figure to filter by it."
        actions={can('edit_bill') && <Button variant="primary" icon={<Plus className="h-4 w-4" />} kbd="N" onClick={() => openNewBill()}>New bill</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-5">
        {tiles.map((t) => (
          <button key={t.key} type="button" onClick={t.onClick} aria-pressed={t.active}
            className={clsx('flex flex-col items-start gap-0.5 bg-white px-4 py-3 text-left transition-colors hover:bg-mist/60', t.active && '!bg-pine-50 ring-2 ring-inset ring-pine-500')}>
            <span className="text-[12px] text-ink-soft">{t.label}</span>
            <span className={clsx('text-[20px] font-semibold tracking-[-0.01em]', t.tone === 'due' && 'text-marigold-800', t.tone === 'rose' && k?.overpaid ? 'text-rose-600' : '')}>{t.value}</span>
          </button>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-[340px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill, patient, MR, phone or visit" className="pl-9" aria-label="Search bills" />
          </div>
          <Segmented size="sm" value={f.status} onChange={(v) => set({ status: v, due: '' })}
            options={[{ value: '', label: 'All' }, { value: 'A', label: 'Open' }, { value: 'F', label: 'Finalized' }, { value: 'C', label: 'Closed' }, { value: 'X', label: 'Cancelled' }]} />
          <Select value={f.type} onChange={(e) => set({ type: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="Bill type">
            <option value="">Any type</option><option value="P">Bill Now</option><option value="C">Bill Later</option>
          </Select>
          <Select value={f.insured} onChange={(e) => set({ insured: e.target.value })} className="h-8 w-auto text-[13px]" aria-label="Insurance">
            <option value="">Insured or not</option><option value="1">Insured</option><option value="0">Self pay</option>
          </Select>
          <Select value={f.sort} onChange={(e) => set({ sort: e.target.value })} className="ml-auto h-8 w-auto text-[13px]" aria-label="Sort">
            <option value="updated">Recently changed</option><option value="created">Newest</option><option value="due">Highest due</option><option value="amount">Largest bill</option>
          </Select>
        </div>

        {error ? <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Bill</th><th>Patient</th><th className="hidden lg:table-cell">Visit</th><th>Status</th>
                  <th className="num">Patient share</th><th className="num hidden md:table-cell">Paid</th><th className="num">Due</th><th className="hidden xl:table-cell">Changed</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? Array.from({ length: 8 }).map((_, i) => <tr key={i}><td colSpan={8}><Skeleton className="h-7" /></td></tr>)
                  : data?.rows.map((b) => {
                    const paid = b.total_receipts + b.deposit_set_off + b.points_amount;
                    return (
                      <tr key={b.bill_no} className="row-link" onClick={() => router.push(`/bills/${b.bill_no}`)}>
                        <td className="whitespace-nowrap">
                          <a href={`/bills/${b.bill_no}`} onClick={(e) => e.preventDefault()} className="font-semibold text-ink">{b.bill_no}</a>
                          <div className="mt-0.5 flex gap-1">
                            <span className="text-[12px] text-ink-mute">{billTypeLabel(b.bill_type)}{b.restriction_type === 'P' ? ', pharmacy' : ''}</span>
                          </div>
                        </td>
                        <td className="min-w-[180px]">
                          <span className="font-medium">{b.patient_name}</span>
                          <div className="text-[12px] text-ink-mute">{b.mr_no}</div>
                        </td>
                        <td className="hidden text-[13px] text-ink-soft lg:table-cell">
                          {b.visit_type === 'i' ? 'Inpatient' : 'Outpatient'}{b.department ? `, ${b.department}` : ''}
                          {b.sponsor_name && b.is_tpa ? <div className="text-[12px] text-indigo-600">{b.sponsor_name}</div> : null}
                        </td>
                        <td className="whitespace-nowrap">
                          <StatusBadge status={b.status} />
                          {b.pending_approvals ? <Badge tone="marigold" className="ml-1.5">Approval</Badge> : null}
                        </td>
                        <td className="num">{money(b.patient_amount)}</td>
                        <td className="num hidden text-ink-soft md:table-cell">{money(paid)}</td>
                        <td className="num">
                          {b.patient_due > 0.004 ? <Money value={b.patient_due} tone="due" /> : b.patient_due < -0.004 ? <span className="font-medium text-rose-600">{money(b.patient_due)}</span> : <span className="text-ink-mute">—</span>}
                          {b.is_tpa && b.sponsor_due > 0.004 ? <div className="text-[12px] text-indigo-600">+{money(b.sponsor_due)} sponsor</div> : null}
                        </td>
                        <td className="hidden whitespace-nowrap text-[12.5px] text-ink-mute xl:table-cell">{relative(b.updated_at)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {data && data.rows.length === 0 && (
              <Empty icon={<ReceiptText className="h-5 w-5" />} title="No bills match" body="Try a different search or clear the filters."
                action={<Button size="sm" onClick={() => { setQ(''); router.replace(pathname); }}>Clear filters</Button>} />
            )}
          </div>
        )}

        {data && data.total > data.size && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] text-ink-soft">
            <span>{(f.page - 1) * data.size + 1}–{Math.min(f.page * data.size, data.total)} of {data.total}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={f.page <= 1} onClick={() => set({ page: f.page - 1 })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" disabled={f.page >= pages} onClick={() => set({ page: f.page + 1 })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
