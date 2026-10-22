'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import { money } from '@/lib/format';
import type { Bill } from '@/lib/types';

/**
 * The balance line reads like the arithmetic a cashier does in their head:
 * charges − discount + tax − sponsor = patient share, then paid → due.
 */
export function BalanceLine({ bill }: { bill: Bill }) {
  const paid = bill.total_receipts + bill.deposit_set_off + bill.points_amount;
  const share = bill.patient_amount;
  const due = bill.patient_due;
  const sponsorTotal = bill.total_claim + bill.sponsor_vat;
  const gross = bill.total_amount - bill.round_off;
  const pct = (v: number) => (share > 0 ? Math.max(0, Math.min(100, (v / share) * 100)) : 0);
  const over = due < -0.004;
  const settled = Math.abs(due) < 0.005 && share > 0;

  return (
    <section aria-label="Bill balance" className="panel overflow-hidden">
      <div className="flex flex-wrap items-stretch">
        <Term label="Charges" value={gross} />
        {bill.total_discount > 0 && <><Op>−</Op><Term label="Discount" value={bill.total_discount} /></>}
        {bill.total_vat > 0 && <><Op>+</Op><Term label="Tax" value={bill.total_vat} /></>}
        {bill.is_tpa ? <><Op>−</Op><Term label={bill.secondary_claim > 0 ? 'Sponsors' : 'Sponsor'} value={sponsorTotal} accent="indigo" /></> : null}
        {Math.abs(bill.round_off) > 0.004 && <><Op>{bill.round_off < 0 ? '−' : '+'}</Op><Term label="Round-off" value={Math.abs(bill.round_off)} small /></>}
        <Op>=</Op>
        <Term label="Patient share" value={share} strong />
        <div className="hidden w-px self-stretch bg-line md:block" aria-hidden />
        <Term label="Paid" value={paid} sub={paidBreakdown(bill)} />
        <div className={clsx(
          'ml-auto flex min-w-[180px] flex-1 flex-col justify-center px-5 py-3 md:flex-none',
          over ? 'bg-rose-50' : settled ? 'bg-pine-50' : due > 0 ? 'bg-marigold-50' : 'bg-mist',
        )}>
          <span className={clsx('text-[12px] font-medium', over ? 'text-rose-700' : settled ? 'text-pine-700' : 'text-marigold-800')}>
            {over ? 'Overpaid — refund or move to deposit' : settled ? 'Settled' : bill.patient_writeoff === 'A' ? 'Written off' : 'Patient owes'}
          </span>
          <span className={clsx('flex items-center gap-2 text-[26px] font-semibold leading-tight tracking-[-0.02em]', over ? 'text-rose-600' : settled ? 'text-pine-700' : 'text-ink')}>
            {settled && <Check className="h-6 w-6" strokeWidth={2.5} />}
            {money(Math.abs(due))}
          </span>
        </div>
      </div>

      {/* Settlement track */}
      <div className="relative flex h-1.5 w-full bg-marigold-100" aria-hidden>
        <span className="h-full origin-left animate-fill-in bg-pine-600" style={{ width: `${pct(bill.total_receipts)}%` }} />
        <span className="h-full origin-left animate-fill-in bg-pine-300" style={{ width: `${pct(bill.deposit_set_off)}%` }} />
        <span className="h-full origin-left animate-fill-in bg-indigo-500" style={{ width: `${pct(bill.points_amount)}%` }} />
        {over && <span className="absolute inset-0 bg-rose-500" />}
      </div>

      {bill.is_tpa ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line bg-indigo-50/40 px-5 py-2 text-[12.5px] text-ink-soft">
          <span className="font-medium text-indigo-700">Sponsor account</span>
          <span>Claimed <b className="font-semibold text-ink">{money(sponsorTotal)}</b></span>
          {bill.secondary_claim > 0 && <span>Primary {money(bill.primary_claim)}, secondary {money(bill.secondary_claim)}</span>}
          <span>Received <b className="font-semibold text-ink">{money(bill.sponsor_receipts)}</b></span>
          <span className={clsx(bill.sponsor_due > 0.004 && 'text-indigo-700')}>Sponsor owes <b className="font-semibold">{money(Math.max(0, bill.sponsor_due))}</b></span>
        </div>
      ) : null}
    </section>
  );
}

function paidBreakdown(b: Bill) {
  const parts: string[] = [];
  if (Math.abs(b.total_receipts) > 0.004) parts.push(`${money(b.total_receipts)} receipts`);
  if (b.deposit_set_off > 0) parts.push(`${money(b.deposit_set_off)} deposit`);
  if (b.points_amount > 0) parts.push(`${money(b.points_amount)} points`);
  return parts.length > 1 ? parts.join(', ') : undefined;
}

function Term({ label, value, strong, small, accent, sub }: { label: string; value: number; strong?: boolean; small?: boolean; accent?: 'indigo'; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-center px-4 py-3 first:pl-5">
      <span className="text-[12px] text-ink-mute">{label}</span>
      <span className={clsx('whitespace-nowrap tabular-nums',
        strong ? 'text-[20px] font-semibold tracking-[-0.01em] text-ink' : small ? 'text-[14px] text-ink-soft' : 'text-[16px] font-medium text-ink',
        accent === 'indigo' && 'text-indigo-600')}>
        {money(value)}
      </span>
      {sub && <span className="truncate text-[11.5px] text-ink-mute">{sub}</span>}
    </div>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center px-0.5 text-[18px] font-light text-ink-mute" aria-hidden>{children}</span>;
}

/* ---------------------------------------------------------------- Lifecycle rail */
export function LifecycleRail({ bill }: { bill: Bill }) {
  if (bill.status === 'X') {
    return (
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        <span className="font-medium text-rose-700">Cancelled</span>
        {bill.cancel_reason && <span className="max-w-[260px] truncate text-ink-mute">{bill.cancel_reason}</span>}
      </div>
    );
  }
  const steps = [
    { key: 'A', label: 'Open', at: bill.created_at },
    { key: 'F', label: 'Finalized', at: bill.finalized_at },
    { key: 'C', label: 'Closed', at: bill.closed_at },
  ];
  const idx = steps.findIndex((s) => s.key === bill.status);
  return (
    <ol className="flex items-center" aria-label={`Status: ${steps[idx].label}`}>
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center">
          {i > 0 && <span className={clsx('mx-1.5 h-px w-6 sm:w-10', i <= idx ? 'bg-pine-500' : 'bg-line-strong')} aria-hidden />}
          <span className={clsx('flex items-center gap-1.5 text-[12.5px]', i === idx ? 'font-semibold text-ink' : i < idx ? 'text-pine-700' : 'text-ink-mute')}>
            <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full border',
              i < idx ? 'border-pine-600 bg-pine-600 text-white' : i === idx ? 'border-pine-600 bg-white' : 'border-line-strong bg-white')}>
              {i < idx ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i === idx ? <span className="h-1.5 w-1.5 rounded-full bg-pine-600" /> : null}
            </span>
            {s.label}
          </span>
        </li>
      ))}
      {bill.cancellation_status === 'S' && <li className="ml-3"><span className="chip bg-rose-50 text-rose-700">Cancellation requested</span></li>}
      {bill.patient_writeoff === 'M' && <li className="ml-3"><span className="chip bg-marigold-50 text-marigold-800">Write-off requested</span></li>}
    </ol>
  );
}
