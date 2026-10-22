'use client';

import clsx from 'clsx';
import { ArrowUpRight, BadgeCheck, Check, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useErrorToast, useToast } from '@/components/ui/overlay';
import { Badge, Button, Empty, ErrorNote, Field, PageHeader, Segmented, Skeleton, StatusBadge, Textarea } from '@/components/ui/primitives';
import { qs, useApi, useMutation } from '@/lib/api';
import { billTypeLabel, dateTime, kindLabel, money, relative } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Approval } from '@/lib/types';

interface Res { rows: Approval[]; counts: { kind: string; n: number; amount: number }[] }

export default function ApprovalsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Inner /></Suspense>;
}

function Inner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [kind, setKind] = useState('');
  const { data, error, loading, reload } = useApi<Res>(`/approvals${qs({ status, kind })}`);
  const selectedId = Number(sp.get('id')) || null;
  const selected = data?.rows.find((a) => a.id === selectedId) || null;
  const select = (id: number | null) => router.replace(`${pathname}${id ? `?id=${id}` : ''}`, { scroll: false });

  useEffect(() => {
    if (data && !selected && data.rows.length && window.matchMedia('(min-width: 1024px)').matches) select(data.rows[0].id);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = (k: string) => data?.counts.find((c) => c.kind === k)?.n || 0;
  const total = data?.counts.reduce((s, c) => s + c.n, 0) || 0;

  return (
    <div>
      <PageHeader title="Approvals" sub="Discounts above the limit, write-offs and bill cancellations, in one queue. You can’t approve your own requests." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented value={kind} onChange={setKind} options={[
          { value: '', label: 'Everything', count: total }, { value: 'discount', label: 'Discounts', count: count('discount') },
          { value: 'writeoff', label: 'Write-offs', count: count('writeoff') }, { value: 'cancellation', label: 'Cancellations', count: count('cancellation') },
        ]} />
        <Segmented size="sm" className="ml-auto" value={status} onChange={setStatus} options={[{ value: 'pending', label: 'Waiting' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: 'all', label: 'All' }]} />
      </div>
      {error && <ErrorNote error={error} onRetry={reload} />}
      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.9fr)_1.4fr]">
        <section className={clsx('panel overflow-hidden lg:max-h-[calc(100dvh-var(--header-h)-var(--footer-h)-190px)] lg:overflow-y-auto', selected && 'hidden lg:block')}>
          {loading && !data ? <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            : data?.rows.length ? (
              <ul className="divide-y divide-line">
                {data.rows.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => select(a.id)} className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors', a.id === selectedId ? 'bg-pine-50' : 'hover:bg-mist/60')}>
                      <span className={clsx('mt-1 h-2 w-2 shrink-0 rounded-full', a.status === 'pending' ? 'bg-marigold-500' : a.status === 'approved' ? 'bg-pine-500' : 'bg-rose-500')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14px] font-medium">{kindLabel(a.kind)} — {a.patient_name}</span>
                          <span className="shrink-0 text-[14px] font-semibold tabular-nums">{money(a.amount, { whole: true })}</span>
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-soft">{a.reason || 'No reason given'}</span>
                        <span className="block text-[12px] text-ink-mute">{a.bill_no}, by {a.requested_by}, {relative(a.requested_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={<BadgeCheck className="h-5 w-5" />} title={status === 'pending' ? 'Nothing waiting for approval' : 'No decisions here yet'} body={status === 'pending' ? 'New requests from billing will appear here.' : undefined} />}
        </section>
        <section className={clsx(!selected && 'hidden lg:block')}>
          {selected ? <Decision a={selected} onBack={() => select(null)} /> : <div className="panel"><Empty title="Pick a request" body="Choose an item on the left to see the bill context and decide." /></div>}
        </section>
      </div>
    </div>
  );
}

function Decision({ a, onBack }: { a: Approval; onBack: () => void }) {
  const { meta } = useSession();
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [a.id]);
  const own = a.requested_by === meta?.me.username && meta?.me.role !== 'admin';

  async function decide(decision: 'approved' | 'rejected') {
    try {
      const { data } = await run<{ note: string | null }>(`/approvals/${a.id}/decide`, 'POST', { decision, note });
      toast({ tone: 'success', title: `${kindLabel(a.kind)} ${decision}`, body: data.note || `Bill ${a.bill_no} updated.` });
    } catch (e) { fail(e, 'Decision not saved'); }
  }

  const effect = {
    discount: { approve: 'The discount stays on the bill and it can be finalized.', reject: 'The discount is removed and the charges go back to their previous amounts.' },
    writeoff: { approve: 'The balance is written off and the bill closes if nothing else is owed.', reject: 'The bill stays finalized with the balance due.' },
    cancellation: { approve: 'The bill is cancelled and kept for the record.', reject: 'The bill stays open.' },
  }[a.kind];

  return (
    <div className="panel animate-pop-in">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <button type="button" onClick={onBack} className="mb-1 text-[13px] text-ink-soft hover:text-ink lg:hidden">← All requests</button>
          <p className="text-[12.5px] text-ink-soft">{kindLabel(a.kind)} request</p>
          <p className="text-[28px] font-semibold tracking-[-0.02em]">{money(a.amount)}</p>
        </div>
        <Badge tone={a.status === 'pending' ? 'marigold' : a.status === 'approved' ? 'pine' : 'rose'}>{a.status === 'pending' ? 'Waiting for you' : a.status === 'approved' ? 'Approved' : 'Rejected'}</Badge>
      </div>
      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <div className="space-y-3 text-[13.5px]">
          <div>
            <p className="text-[12px] text-ink-mute">Reason given</p>
            <p className="mt-0.5 text-[15px] leading-relaxed">{a.reason || 'No reason given'}</p>
          </div>
          <p className="text-ink-soft">Requested by <b className="font-medium text-ink">{a.requested_by}</b>, {dateTime(a.requested_at)}</p>
          {a.payload.changes?.length ? (
            <div>
              <p className="mb-1.5 text-[12px] text-ink-mute">Discount changes</p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {a.payload.changes.map((c) => (
                  <li key={c.chargeId} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <span>{c.description}</span><span className="whitespace-nowrap tabular-nums text-ink-soft">{money(c.from)} → <b className="text-ink">{money(c.to)}</b></span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="rounded-xl bg-mist p-4 text-[13.5px]">
          <div className="flex items-center justify-between">
            <Link href={`/bills/${a.bill_no}`} className="inline-flex items-center gap-1 text-[15px] font-semibold text-pine-700 hover:underline">{a.bill_no}<ArrowUpRight className="h-4 w-4" /></Link>
            {a.bill_status && <StatusBadge status={a.bill_status} />}
          </div>
          <p className="mt-1">{a.patient_name} <span className="text-ink-mute">{a.mr_no}</span></p>
          <p className="text-ink-soft">{a.bill_type && billTypeLabel(a.bill_type as 'P' | 'C')}{a.is_tpa ? ', insured' : ', self pay'}{a.department ? `, ${a.department}` : ''}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <div><dt className="text-[12px] text-ink-mute">Bill total</dt><dd className="font-medium">{money(a.total_amount || 0)}</dd></div>
            <div><dt className="text-[12px] text-ink-mute">Discount so far</dt><dd className="font-medium">{money(a.total_discount || 0)}</dd></div>
            <div><dt className="text-[12px] text-ink-mute">Patient share</dt><dd className="font-medium">{money(a.patient_amount || 0)}</dd></div>
            <div><dt className="text-[12px] text-ink-mute">Patient owes</dt><dd className="font-medium">{money(Math.max(0, a.patient_due || 0))}</dd></div>
          </dl>
        </div>
      </div>
      {a.status === 'pending' ? (
        <div className="border-t border-line px-5 py-4">
          {!a.canDecide ? <p className="text-[13.5px] text-ink-soft">You don’t have the right to decide on {kindLabel(a.kind).toLowerCase()}s. Switch to the finance manager to try it.</p>
            : own ? <p className="text-[13.5px] text-ink-soft">This is your own request — someone else needs to decide.</p> : (
              <>
                <Field label="Note to the requester" hint="Required when rejecting.">
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional when approving" />
                </Field>
                <div className="mt-3 grid gap-2 text-[12.5px] text-ink-soft sm:grid-cols-2">
                  <p><b className="text-pine-700">Approve:</b> {effect.approve}</p>
                  <p><b className="text-rose-700">Reject:</b> {effect.reject}</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="secondary" icon={<X className="h-4 w-4" />} disabled={!note.trim()} loading={pending} onClick={() => decide('rejected')}>Reject</Button>
                  <Button variant="primary" icon={<Check className="h-4 w-4" />} loading={pending} onClick={() => decide('approved')}>Approve</Button>
                </div>
              </>
            )}
        </div>
      ) : (
        <div className="border-t border-line px-5 py-4 text-[13.5px] text-ink-soft">
          {a.status === 'approved' ? 'Approved' : 'Rejected'} by <b className="font-medium text-ink">{a.decided_by}</b>, {dateTime(a.decided_at)}{a.decision_note ? <> — “{a.decision_note}”</> : ''}
        </div>
      )}
    </div>
  );
}
