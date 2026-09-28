'use client';
import { useRouter, cx, relativeDays, todayISO, useFormat, listUrl, useDebounce, useFetch, useEntityApi, useScopeMemory, Avatar, Badge, Button, Checkbox, Empty, IconButton, Input, Segmented, Skeleton, useToast, Card, Frame, type ListResponse, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, CircleX, Eye, FileText, Plane, Receipt, Search, ShoppingBag, type LucideIcon } from 'lucide-react';
import { recordPath } from '../../lib/registry';
import { rememberIds } from '../record/RecordShell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const TYPE_ICON: Record<string, LucideIcon> = { Leave: Plane, 'Expense claim': Receipt, 'Purchase order': ShoppingBag, 'Payment voucher': Banknote, 'Credit note': FileText };

/** Approval queue: everything waiting on a decision, full width. Each request opens on its own decision page. */
export default function InboxTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency } = useFormat();
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<string | null>(null);
  const [status, setStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 250);
  const [tick, setTick] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const types = def.fields.find((f) => f.key === 'type')?.options ?? [];

  const { data, loading } = useFetch<ListResponse>(`${listUrl(def.entity, { q: dq, size: 300, facet: 'type', sort: 'due', dir: 'asc', filters: { status: [status], ...(type ? { type: [type] } : {}) } })}&_r=${tick}`);
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const memory = useScopeMemory();
  useEffect(() => { rememberIds(memory, def.slug, rows.map((r) => r.id)); }, [memory, rows, def.slug]);
  useEffect(() => setChecked(new Set()), [type, status, dq]);

  const bulk = async (s: string) => {
    setBusy(s);
    const ids = [...checked];
    await Promise.all(ids.map((id) => entityApi.update(def.entity, id, { status: s })));
    toast(referenceT(ids.length === 1 ? "{count} request {status}" : "{count} requests {status}", {count: ids.length, status: referenceT(s)}));
    setChecked(new Set());
    setBusy(null);
    setTick((t) => t + 1);
  };
  const facetTotal = data ? Object.values(data.facets).reduce((a, b) => a + b, 0) : 0;
  const all = rows.length > 0 && rows.every((r) => checked.has(r.id));

  return (
    <Frame>
      <Card className="flex flex-1 flex-col">
        <div className="space-y-2 border-b border-line px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Search by person, reference or department")} className="pl-8" />
            </div>
            <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'Pending', label: 'Waiting on me' }, { value: 'Approved', label: 'Approved' }, { value: 'Rejected', label: 'Rejected' }]} />
            <span className="flex-1" />
            {status === 'Pending' && rows[0] && <Button variant="primary" onClick={() => router.push(recordPath(def, rows[0].id))}><ReferenceText message="Start reviewing" /></Button>}
          </div>
          {checked.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-rail px-3 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] text-white anim-fade">
              <span className="flex-1 font-medium">{checked.size} <ReferenceText message="selected" /></span>
              <button disabled={Boolean(busy)} className="rounded px-2 py-0.5 hover:bg-rail-3" onClick={() => bulk('Approved')}><Check size={13} className="mr-1 inline" /><ReferenceText message="Approve all" /></button>
              <button disabled={Boolean(busy)} className="rounded px-2 py-0.5 text-[#ffb4a6] hover:bg-rail-3" onClick={() => bulk('Rejected')}><CircleX size={13} className="mr-1 inline" /><ReferenceText message="Reject all" /></button>
              <button className="rounded px-2 py-0.5 hover:bg-rail-3" onClick={() => setChecked(new Set())}><ReferenceText message="Clear" /></button>
            </div>
          ) : (
            <div className="flex gap-1 overflow-x-auto">
              {[null, ...types].map((t) => (
                <button key={t ?? 'all'} onClick={() => setType(t)} className={cx('shrink-0 rounded-full px-2.5 py-1 text-[length:calc(12.5px*var(--fs-scale))] font-medium', type === t ? 'bg-rail text-white dark:bg-brand' : 'text-ink-2 hover:bg-surface-3')}>
                  {t ?? 'All'} <span className="opacity-70 tnum">{t ? data?.facets[t] ?? 0 : facetTotal}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <TableContainer className="min-h-0 flex-1 overflow-auto">
          <Table className="w-full min-w-[820px] border-separate border-spacing-0 text-[length:calc(13px*var(--fs-scale))]">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[length:calc(12px*var(--fs-scale))] text-ink-2">
                {status === 'Pending' && <th className="w-9 border-b border-line bg-surface-2 pl-3"><Checkbox checked={all} indeterminate={!all && checked.size > 0} onChange={(on) => setChecked(on ? new Set(rows.map((r) => r.id)) : new Set())} /></th>}
                <th className="border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Request" /></th>
                <th className="border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Requested by" /></th>
                <th className="border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Priority" /></th>
                <th className="border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Submitted" /></th>
                <th className="border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Due" /></th>
                <th className="border-b border-line bg-surface-2 px-3 py-2 text-right font-medium"><ReferenceText message="Amount" /></th>
                <th className="w-12 border-b border-line bg-surface-2" />
              </tr>
            </thead>
            <tbody>
              {loading && !data && Array.from({ length: 10 }, (_, i) => <tr key={i}><td colSpan={8} className="border-b border-line px-3 py-3"><Skeleton className="w-2/3" /></td></tr>)}
              {rows.map((r) => {
                const I = TYPE_ICON[r.type] ?? FileText;
                const overdue = r.status === 'Pending' && r.due < todayISO();
                return (
                  <tr key={r.id} onClick={() => router.push(recordPath(def, r.id))} className={cx('group cursor-pointer hover:bg-surface-2', checked.has(r.id) && 'bg-brand-soft/50')}>
                    {status === 'Pending' && <td className="border-b border-line pl-3" onClick={(e) => e.stopPropagation()}><Checkbox checked={checked.has(r.id)} onChange={(on) => setChecked((s) => { const n = new Set(s); if (on) n.add(r.id); else n.delete(r.id); return n; })} /></td>}
                    <td className="border-b border-line px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-3 text-ink-2"><I size={16} /></span>
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{r.type}</div>
                          <div className="max-w-[360px] truncate text-[length:calc(12px*var(--fs-scale))] text-ink-3"><span className="tnum">{r.code}</span> {r.summary}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-line px-3"><div className="flex items-center gap-2"><Avatar name={r.requester} size={24} /><div><div>{r.requester}</div><div className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{r.department}</div></div></div></td>
                    <td className="border-b border-line px-3">{r.priority === 'Normal' ? <span className="text-ink-3"><ReferenceText message="Normal" /></span> : <Badge tone={r.priority === 'Urgent' ? 'danger' : 'warn'}>{r.priority}</Badge>}</td>
                    <td className="border-b border-line px-3 text-ink-2">{relativeDays(r.submitted)}</td>
                    <td className={cx('border-b border-line px-3', overdue ? 'font-medium text-danger' : 'text-ink-2')}>{overdue ? referenceT("Overdue") : relativeDays(r.due)}</td>
                    <td className="border-b border-line px-3 text-right font-medium tnum">{r.type === 'Leave' ? referenceT(r.days === 1 ? "{count} day" : "{count} days", { count: r.days }) : fmtCurrency(r.amount)}</td>
                    <td className="border-b border-line px-2 text-right"><IconButton icon={Eye} size="sm" label={referenceT("Review")} className="opacity-0 group-hover:opacity-100" onClick={() => router.push(recordPath(def, r.id))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {data && !rows.length && <Empty icon={Check} title={status === 'Pending' ? 'You are all caught up' : 'No requests here'} body={status === 'Pending' ? 'New requests appear here as soon as they are submitted.' : 'Try another type or clear the search.'} />}
        </TableContainer>
        <div className="border-t border-line bg-surface-2 px-3 py-1.5 text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{referenceT(rows.length === 1 ? "{count} request, soonest due first" : "{count} requests, soonest due first", {count: rows.length})}</div>
      </Card>
    </Frame>
  );
}

export type { Row };
