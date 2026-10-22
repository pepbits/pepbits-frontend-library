'use client';

import clsx from 'clsx';
import { CheckCircle2, Lock, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useErrorToast, useToast } from '@/components/ui/overlay';
import { Badge, Button, Empty, ErrorNote, Field, Input, Money, PageHeader, Skeleton, Textarea } from '@/components/ui/primitives';
import { qs, useApi, useMutation } from '@/lib/api';
import { money, time, todayISO } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Counter } from '@/lib/types';

interface Summary {
  counter: Counter; count: number; net: number; expectedCash: number;
  modes: { mode: string; code: string; inflow: number; outflow: number }[]; types: { type: string; amount: number }[];
  closure: { expected_cash: number; declared_cash: number; variance: number; note: string | null; closed_by: string; closed_at: string } | null;
}
interface Res { date: string; counters: Summary[]; items: { no: string; kind: string; type: string; amount: number; created_at: string; bill_no: string | null; patient_name: string; mode_name: string; counter_id: number; username: string; label: string }[] }

const NOTES = [500, 200, 100, 50, 20, 10];

export default function DayClosePage() {
  const { meta, can } = useSession();
  const [date, setDate] = useState(todayISO());
  const { data, error, loading, reload } = useApi<Res>(`/daybook${qs({ date })}`);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { if (data && sel === null) setSel(meta?.me.counter_id || data.counters.find((c) => !c.counter.is_system)?.counter.id || null); }, [data, meta, sel]);
  const current = data?.counters.find((c) => c.counter.id === sel);
  const items = useMemo(() => data?.items.filter((i) => i.counter_id === sel) || [], [data, sel]);
  const all = data ? data.counters.reduce((s, c) => s + c.net, 0) : 0;

  return (
    <div>
      <PageHeader title="Day close" sub="The day book by counter. Count the cash drawer, record any difference, and close the counter."
        actions={<>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); }} className="w-auto" aria-label="Business date" />
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print day book</Button>
        </>} />
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data ? <Skeleton className="h-40" /> : data && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {data.counters.map((c) => (
              <button key={c.counter.id} type="button" onClick={() => setSel(c.counter.id)} aria-pressed={sel === c.counter.id}
                className={clsx('panel flex flex-col items-start p-4 text-left transition-colors hover:border-line-strong', sel === c.counter.id && '!border-pine-500 ring-2 ring-pine-100')}>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium">{c.counter.name}</span>
                  {c.closure ? <Badge tone="pine"><Lock className="h-3 w-3" />Closed</Badge> : c.counter.is_system ? <Badge>Automatic</Badge> : c.count ? <Badge tone="marigold">Open</Badge> : null}
                </span>
                <span className="mt-1 text-[22px] font-semibold tracking-[-0.01em]"><Money value={c.net} /></span>
                <span className="text-[12px] text-ink-mute">{c.count} entr{c.count === 1 ? 'y' : 'ies'}, cash {money(c.expectedCash)}</span>
              </button>
            ))}
          </div>
          <p className="mb-4 text-[13px] text-ink-soft">All counters together: <b className="font-semibold text-ink">{money(all)}</b> net on {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>

          {current && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
              <section className="panel overflow-hidden">
                <div className="grid gap-px border-b border-line bg-line sm:grid-cols-2">
                  <div className="bg-white p-4">
                    <p className="mb-2 text-[13px] font-semibold">By mode</p>
                    {current.modes.length ? current.modes.map((m) => (
                      <div key={m.mode} className="flex items-baseline gap-2 py-1 text-[13.5px]">
                        <span>{m.mode}</span><span className="flex-1 border-b border-dotted border-line-strong" />
                        <span className="tabular-nums">{money(m.inflow + m.outflow)}</span>
                      </div>
                    )) : <p className="text-[13px] text-ink-mute">No entries</p>}
                  </div>
                  <div className="bg-white p-4">
                    <p className="mb-2 text-[13px] font-semibold">By type</p>
                    {current.types.length ? current.types.map((t) => (
                      <div key={t.type} className="flex items-baseline gap-2 py-1 text-[13.5px]">
                        <span>{t.type}</span><span className="flex-1 border-b border-dotted border-line-strong" />
                        <span className={clsx('tabular-nums', t.amount < 0 && 'text-rose-600')}>{money(t.amount)}</span>
                      </div>
                    )) : <p className="text-[13px] text-ink-mute">No entries</p>}
                  </div>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  {items.length ? (
                    <table className="tbl">
                      <thead><tr><th>Time</th><th>Number</th><th>Type</th><th>Patient</th><th className="hidden md:table-cell">Mode</th><th className="hidden md:table-cell">By</th><th className="num">Amount</th></tr></thead>
                      <tbody>{items.map((i) => (
                        <tr key={i.no}>
                          <td className="text-ink-soft">{time(i.created_at)}</td><td className="font-medium">{i.no}</td><td>{i.type}</td>
                          <td>{i.patient_name}</td><td className="hidden md:table-cell">{i.mode_name}</td><td className="hidden text-ink-soft md:table-cell">{i.username}</td>
                          <td className="num font-medium"><Money value={i.amount} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ) : <Empty title="Nothing recorded at this counter" body="Payments taken here on this date will appear in the list." />}
                </div>
              </section>
              <CloseCounter s={current} date={date} canClose={can('close_counter')} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CloseCounter({ s, date, canClose }: { s: Summary; date: string; canClose: boolean }) {
  const { run, pending } = useMutation();
  const toast = useToast();
  const fail = useErrorToast();
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [coins, setCoins] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { setCounts({}); setCoins(''); setNote(''); }, [s.counter.id, date]);
  const declared = NOTES.reduce((sum, n) => sum + n * (Number(counts[n]) || 0), 0) + (Number(coins) || 0);
  const variance = Math.round((declared - s.expectedCash) * 100) / 100;

  if (s.counter.is_system) {
    return <section className="panel p-5 text-[13.5px] text-ink-soft">The system counter holds automatic postings such as overpayment refunds moved to deposit. It doesn’t hold cash and isn’t closed by hand.</section>;
  }
  if (s.closure) {
    return (
      <section className="panel p-5">
        <div className="flex items-center gap-2 text-pine-700"><CheckCircle2 className="h-5 w-5" /><h2 className="text-[15px] font-semibold">Closed by {s.closure.closed_by}</h2></div>
        <dl className="mt-4 space-y-2 text-[14px]">
          <div className="flex justify-between"><dt className="text-ink-soft">Expected cash</dt><dd className="tabular-nums">{money(s.closure.expected_cash)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">Counted</dt><dd className="tabular-nums">{money(s.closure.declared_cash)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Difference</dt><dd className={clsx('tabular-nums', Math.abs(s.closure.variance) > 0.004 && 'text-rose-600')}>{money(s.closure.variance, { sign: true })}</dd></div>
        </dl>
        {s.closure.note && <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-[13px]">{s.closure.note}</p>}
      </section>
    );
  }
  return (
    <section className="panel p-5">
      <h2 className="text-[15px] font-semibold">Count the cash drawer</h2>
      <p className="mt-0.5 text-[13px] text-ink-soft">Enter how many of each note you have. The total updates as you type.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {NOTES.map((n) => (
          <label key={n} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 focus-within:border-pine-500">
            <span className="w-12 text-[13px] font-medium">₹{n}</span>
            <span className="text-ink-mute">×</span>
            <input inputMode="numeric" value={counts[n] || ''} onChange={(e) => setCounts({ ...counts, [n]: e.target.value.replace(/\D/g, '') })}
              className="h-7 w-full bg-transparent text-right text-[14px] outline-none" aria-label={`Number of ₹${n} notes`} placeholder="0" />
          </label>
        ))}
        <label className="col-span-2 flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 focus-within:border-pine-500">
          <span className="text-[13px] font-medium">Coins, total ₹</span>
          <input inputMode="decimal" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^0-9.]/g, ''))} className="h-7 w-full bg-transparent text-right text-[14px] outline-none" aria-label="Coins total" placeholder="0" />
        </label>
      </div>
      <dl className="mt-4 space-y-1.5 text-[14px]">
        <div className="flex justify-between"><dt className="text-ink-soft">Expected cash</dt><dd className="tabular-nums">{money(s.expectedCash)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-soft">You counted</dt><dd className="tabular-nums">{money(declared)}</dd></div>
        <div className={clsx('flex justify-between rounded-lg px-3 py-2 font-semibold', Math.abs(variance) < 0.005 ? 'bg-pine-50 text-pine-800' : 'bg-rose-50 text-rose-700')}>
          <dt>{Math.abs(variance) < 0.005 ? 'Matches' : variance < 0 ? 'Short' : 'Over'}</dt><dd className="tabular-nums">{money(variance, { sign: true })}</dd>
        </div>
      </dl>
      {Math.abs(variance) > 0.004 && (
        <Field label="Explain the difference" className="mt-3"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. change given twice to one patient" /></Field>
      )}
      <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!canClose || (Math.abs(variance) > 0.004 && !note.trim())} loading={pending}
        onClick={async () => {
          try { await run('/daybook/close', 'POST', { counterId: s.counter.id, date, declaredCash: declared, note }); toast({ tone: 'success', title: `${s.counter.name} closed for the day` }); } catch (e) { fail(e, 'Counter not closed'); }
        }}>Close {s.counter.name}</Button>
      {!canClose && <p className="mt-2 text-[12.5px] text-ink-mute">You need the “Close counter” right.</p>}
    </section>
  );
}
