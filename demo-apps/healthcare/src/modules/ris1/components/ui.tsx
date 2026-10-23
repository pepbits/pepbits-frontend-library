'use client';
import {DiagnosticField, DiagnosticModal, DiagnosticTabs, DiagnosticCard, DiagnosticToastProvider, DiagnosticLoading, DiagnosticEmpty, DiagnosticPagination, useDiagnosticToast} from '../../diagnostics/controls';
import {DiagnosticButton} from '../../diagnostics';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from '@pepbits/icons';
import { useFmt } from '../lib/client';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/i18n/react';


// ---------- Badges ----------
const STATUS_STYLE: Record<string, string> = {
  ORDERED: 'bg-slate-100 text-slate-700',
  SCHEDULED: 'bg-sky-50 text-sky-800',
  ARRIVED: 'bg-indigo-50 text-indigo-800',
  IN_PROGRESS: 'bg-violet-50 text-violet-800',
  COMPLETED: 'bg-amber-50 text-amber-900',
  PRELIMINARY: 'bg-orange-50 text-orange-900',
  FINAL: 'bg-ok-bg text-ok',
  CORRECTED: 'bg-ok-bg text-ok',
  CANCELLED: 'bg-slate-100 text-slate-500 line-through',
  DRAFT: 'bg-slate-100 text-slate-700',
  PAID: 'bg-ok-bg text-ok',
  PARTIAL: 'bg-urgent-bg text-urgent',
  UNPAID: 'bg-stat-bg text-stat',
  REFUNDED: 'bg-slate-100 text-slate-600',
  SENT: 'bg-ok-bg text-ok',
  PROCESSED: 'bg-ok-bg text-ok',
  PENDING: 'bg-sky-50 text-sky-800',
  FAILED: 'bg-stat-bg text-stat',
  REJECTED: 'bg-stat-bg text-stat',
  OPEN: 'bg-crit-bg text-crit',
  COMMUNICATED: 'bg-urgent-bg text-urgent',
  ACKNOWLEDGED: 'bg-ok-bg text-ok',
};

const STATUS_LABEL: Record<string, string> = { COMPLETED: 'Awaiting read', IN_PROGRESS: 'In exam', CORRECTED: 'Final (amended)' };

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
 const fmt=useFmt();

  if (!status) return null;
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-700'}`}>
      {label || STATUS_LABEL[status] || fmt.status(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority?: string }) {
  if (priority === 'STAT') return <span className="inline-flex rounded bg-stat px-1.5 py-0.5 text-xs font-bold text-white"><ReferenceText message="STAT" /></span>;
  if (priority === 'URGENT') return <span className="inline-flex rounded bg-urgent-bg px-1.5 py-0.5 text-xs font-bold text-urgent ring-1 ring-urgent/30"><ReferenceText message="Urgent" /></span>;
  return <span className="inline-flex rounded px-1.5 py-0.5 text-xs text-ink-soft"><ReferenceText message="Routine" /></span>;
}

export function ModalityChip({ code }: { code?: string }) {
  return <span className="inline-flex min-w-[2.25rem] justify-center rounded border border-ink/15 bg-paper px-1 py-0.5 text-xs font-bold text-ink-2">{code}</span>;
}

export function TatClock({ tat }: { tat?: { target: number; elapsed: number | null; state: string; done?: boolean } }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  if (!tat || tat.elapsed == null) return <span className="text-ink-soft text-xs">—</span>;
  if (tat.done) {
    const late = tat.elapsed > tat.target;
    return <div className={`text-xs font-bold ${late ? 'text-stat' : 'text-ok'}`} title={referenceT("Target {value0}", {value0: fmt.minutes(tat.target)})}><ReferenceText message="Signed in" /> {fmt.minutes(tat.elapsed)}{late ? ' (late)' : ''}</div>;
  }
  const remaining = tat.target - tat.elapsed;
  const pct = Math.min(100, (tat.elapsed / tat.target) * 100);
  const color = tat.state === 'BREACHED' ? 'bg-stat' : tat.state === 'AT_RISK' ? 'bg-urgent' : 'bg-ok';
  const text = tat.state === 'BREACHED' ? 'text-stat' : tat.state === 'AT_RISK' ? 'text-urgent' : 'text-ink-3';
  return (
    <div className="min-w-[92px]" title={referenceT("Target {value0}, elapsed {value1}", {value0: fmt.minutes(tat.target), value1: fmt.minutes(tat.elapsed)})}>
      <div className={`text-xs font-bold ${text}`}>{remaining >= 0 ? `${fmt.minutes(remaining)} left` : `${fmt.minutes(-remaining)} over`}</div>
      <div className="mt-1 h-1 rounded bg-line"><div className={`h-1 rounded ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// ---------- Layout helpers ----------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const Empty = DiagnosticEmpty;

export const Field = DiagnosticField;

export const Tabs = DiagnosticTabs;

export const Modal = DiagnosticModal;

// ---------- Toasts ----------
type Toast = { id: number; kind: 'ok' | 'error'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = useDiagnosticToast;

export const ToastProvider = DiagnosticToastProvider;

// ---------- Session ----------
export type SessionUser = { id: number; name: string; role: string; title?: string };
export const SessionCtx = createContext<{ user: SessionUser | null; users: SessionUser[]; switchUser: (id: number) => Promise<void> }>({ user: null, users: [], switchUser: async () => {} });
export const useSession = () => useContext(SessionCtx);

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator', FRONT_DESK: 'Front desk', BILLING: 'Billing', TECHNOLOGIST: 'Technologist', RADIOLOGIST: 'Radiologist', RESIDENT: 'Resident',
};

// ---------- Workflow rail ----------
const RAIL = [
  { key: 'ordered_at', label: 'Ordered' },
  { key: 'scheduled_at', label: 'Scheduled' },
  { key: 'arrived_at', label: 'Arrived' },
  { key: 'exam_started_at', label: 'Exam started' },
  { key: 'exam_completed_at', label: 'Exam complete' },
  { key: 'prelim_at', label: 'Preliminary' },
  { key: 'final_at', label: 'Final' },
];

/** The order's journey through the department. Each stop shows when it happened. */
export function WorkflowRail({ order }: { order: Record<string, any> }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

  const cancelled = order.status === 'CANCELLED';
  const lastDone = RAIL.reduce((acc, s, i) => (order[s.key] ? i : acc), -1);
  return (
    <ol className="grid grid-cols-7 gap-0" aria-label={referenceT("Order progress")}>
      {RAIL.map((s, i) => {
        const done = !!order[s.key];
        const skipped = !done && i < lastDone;
        const current = i === lastDone && !cancelled && order.status !== 'FINAL';
        return (
          <li key={s.key} className="relative pr-2">
            <div className="flex items-center">
              <span
                className={`z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  done ? (cancelled ? 'border-ink-soft bg-ink-soft' : 'border-petrol bg-petrol') : skipped ? 'border-line bg-paper' : 'border-line bg-white'
                } ${current ? 'ring-4 ring-petrol/20' : ''}`}
              />
              {i < RAIL.length - 1 && <span className={`h-0.5 flex-1 ${i < lastDone ? (cancelled ? 'bg-ink-soft' : 'bg-petrol') : 'bg-line'}`} />}
            </div>
            <div className={`mt-2 text-xs font-bold ${done ? 'text-ink' : 'text-ink-soft'}`}><ReferenceText message={s.label} /></div>
            <div className="text-xs text-ink-soft">{done ? fmt.time(order[s.key]) : skipped ? 'skipped' : ''}</div>
            {done && <div className="text-[11px] text-ink-soft/80">{fmt.date(order[s.key])}</div>}
          </li>
        );
      })}
    </ol>
  );
}
