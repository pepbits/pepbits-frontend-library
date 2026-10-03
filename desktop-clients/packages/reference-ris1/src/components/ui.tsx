'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFmt } from '../lib/client';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


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

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-bold text-ink-2">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex gap-1 border-b border-line" role="tablist">
      {items.map((it) => (
        <DiagnosticButton
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-bold ${value === it.value ? 'border-petrol text-petrol' : 'border-transparent text-ink-soft hover:text-ink'}`}
        >
          {typeof it.label === "string" ? <ReferenceText message={it.label} /> : it.label}
        </DiagnosticButton>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string; footer?: ReactNode }) {
 const referenceT = useReferenceLocalization().t;

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className={`w-full ${width} rounded-lg bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <DiagnosticButton className="btn-ghost h-8 w-8 p-0" onClick={onClose} aria-label={referenceT("Close")}><X size={18} /></DiagnosticButton>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-paper/50 px-5 py-3 rounded-b-lg">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; kind: 'ok' | 'error'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm shadow-lg ${t.kind === 'ok' ? 'border-ok/30 bg-white' : 'border-stat/40 bg-stat-bg'}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-stat" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

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
