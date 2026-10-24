'use client';

import {TableRow} from '@pepbits/components';

import {usePreferences} from '@pepbits/preferences/react';

import clsx from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, History, Search } from '@pepbits/icons';
import { Link } from '../host';
import { Fragment, useState } from 'react';
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, Select, Skeleton, SettleTable } from '../components/ui/primitives';
import { qs, useApi, useDebounced } from '../lib/api';
import { useFormat } from '../lib/format';
import type { AuditEntry } from '../lib/types';

interface Res { rows: AuditEntry[]; total: number; users: string[]; entities: { entity: string; n: number }[]; page: number; size: number }

const ENTITY_LABEL: Record<string, string> = { bill: 'Bills', charge: 'Charges', receipt: 'Receipts', deposit: 'Deposits', patient: 'Patients', visit: 'Visits', settings: 'Settings', counter: 'Counters', card_txn: 'Card payments' };

export default function AuditPage() {
  const {preferences} = usePreferences();
  const { dateTime } = useFormat();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [entity, setEntity] = useState('');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const { data, error, loading, reload } = useApi<Res>(`/audit${qs({ q: dq, entity, user, from, to, page, size: preferences.pageSize })}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div>
      <PageHeader title="Audit trail" sub="Every change to bills, charges, money and settings — who, when and what changed." />
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Bill, MR, receipt or words in the change" className="ps-9" aria-label="Search audit" />
          </div>
          <Select value={user} onChange={(e) => { setUser(e.target.value); setPage(1); }} className="h-8 w-auto text-[length:calc(13px*var(--fs-scale,1))]" aria-label="User">
            <option value="">Everyone</option>{data?.users.map((u) => <option key={u}>{u}</option>)}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 w-auto text-[length:calc(13px*var(--fs-scale,1))]" aria-label="From" />
          <span className="text-ink-mute">to</span>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 w-auto text-[length:calc(13px*var(--fs-scale,1))]" aria-label="To" />
        </div>
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2">
          <Chip active={!entity} onClick={() => { setEntity(''); setPage(1); }}>All</Chip>
          {data?.entities.map((e) => <Chip key={e.entity} active={entity === e.entity} onClick={() => { setEntity(e.entity); setPage(1); }}>{ENTITY_LABEL[e.entity] || e.entity} <span className="text-ink-mute">{e.n}</span></Chip>)}
        </div>
        {error ? <div className="p-4"><ErrorNote error={error} onRetry={reload} /></div> : (
          <div className="overflow-x-auto">
            <SettleTable>
              <thead><TableRow><th className="w-[150px]">When</th><th>What happened</th><th className="hidden md:table-cell">Record</th><th className="hidden lg:table-cell">Bill</th><th>By</th><th className="w-8"><span className="sr-only">Details</span></th></TableRow></thead>
              <tbody>
                {loading && !data ? Array.from({ length: 10 }).map((_, i) => <TableRow key={i}><td colSpan={6}><Skeleton className="h-6" /></td></TableRow>) : data?.rows.map((r) => {
                  const hasDetail = Object.keys(r.detail || {}).length > 0;
                  return (
                    <Fragment key={r.id}>
                      <TableRow className={clsx(hasDetail && 'row-link')} onClick={() => hasDetail && setOpen(open === r.id ? null : r.id)}>
                        <td className="whitespace-nowrap text-ink-soft">{dateTime(r.at)}</td>
                        <td>{r.summary}</td>
                        <td className="hidden whitespace-nowrap md:table-cell"><Badge>{ENTITY_LABEL[r.entity]?.replace(/s$/, '') || r.entity}</Badge> <span className="text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-soft">{r.entity_id}</span></td>
                        <td className="hidden lg:table-cell">{r.bill_no ? <Link href={`/bills/${r.bill_no}`} className="font-medium text-pine-700 hover:underline" onClick={(e) => e.stopPropagation()}>{r.bill_no}</Link> : '—'}</td>
                        <td className="text-ink-soft">{r.username}</td>
                        <td>{hasDetail && <ChevronDown className={clsx('h-4 w-4 text-ink-mute transition-transform', open === r.id && 'rotate-180')} />}</td>
                      </TableRow>
                      {open === r.id && <TableRow><td colSpan={6} className="bg-mist/60"><Diff detail={r.detail} /></td></TableRow>}
                    </Fragment>
                  );
                })}
              </tbody>
            </SettleTable>
            {data?.rows.length === 0 && <Empty icon={<History className="h-5 w-5" />} title="No changes match" />}
          </div>
        )}
        {data && data.total > data.size && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">
            <span>{data.total} changes, page {page} of {pages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="rtl:-scale-x-100 h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="rtl:-scale-x-100 h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={clsx('rounded-full border px-3 py-1 text-[length:calc(12.5px*var(--fs-scale,1))] font-medium transition-colors', active ? 'border-pine-600 bg-pine-50 text-pine-800' : 'border-line hover:border-line-strong')}>{children}</button>;
}

const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Diff({ detail }: { detail: Record<string, unknown> }) {
  const before = detail.before as Record<string, unknown> | undefined;
  const changes = detail.changes as Record<string, unknown> | undefined;
  if (changes) {
    return (
      <table className="w-full text-[length:calc(12.5px*var(--fs-scale,1))]">
        <thead><TableRow className="text-start text-ink-mute"><th className="py-1 pe-4 font-medium">Field</th><th className="py-1 pe-4 font-medium">Before</th><th className="py-1 font-medium">After</th></TableRow></thead>
        <tbody>{Object.entries(changes).map(([k, v]) => (
          <TableRow key={k}><td className="py-1 pe-4 text-ink-soft">{k.replace(/_/g, ' ')}</td><td className="py-1 pe-4 text-rose-700 line-through">{fmt(before?.[k])}</td><td className="py-1 font-medium text-pine-800">{fmt(v)}</td></TableRow>
        ))}</tbody>
      </table>
    );
  }
  return (
    <dl className="grid gap-x-6 gap-y-1 text-[length:calc(12.5px*var(--fs-scale,1))] sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(detail).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-ink-mute">{k.replace(/_/g, ' ')}</dt><dd className="truncate font-medium">{fmt(v)}</dd></div>)}
    </dl>
  );
}
