'use client';
import {DiagnosticLabel} from '../../diagnostics/controls';
import {DiagnosticField, DiagnosticModal, DiagnosticTabs, DiagnosticCard, DiagnosticToastProvider, DiagnosticLoading, DiagnosticEmpty, DiagnosticPagination, useDiagnosticToast} from '../../diagnostics/controls';
import {DiagnosticButton,DiagnosticInput,DiagnosticDateInput,DiagnosticTextarea,DiagnosticSelect} from '../../diagnostics';
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X, XCircle } from '@pepbits/icons';
import { titleCase } from '../lib/format';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/i18n/react';


export const cx = (...c: any[]) => c.filter(Boolean).join(' ');

/* ───────── Buttons ───────── */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-hema-600 text-white hover:bg-hema-700 border-hema-600',
  accent: 'bg-eosin-500 text-white hover:bg-eosin-600 border-eosin-500',
  secondary: 'bg-white text-ink border-line-strong hover:bg-paper',
  ghost: 'bg-transparent text-ink-soft border-transparent hover:bg-black/5',
  danger: 'bg-white text-crit border-crit/40 hover:bg-crit-bg',
};
export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: React.ReactNode }>(
  function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) {
    return (
      <DiagnosticButton variant={variant==='accent'?'primary':variant} ref={ref} disabled={disabled || loading} {...rest}
        className={cx('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm', BTN[variant], className)}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </DiagnosticButton>
    );
  });

/* ───────── Form controls ───────── */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <DiagnosticInput ref={ref} {...p} className={cx('input', className)} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <DiagnosticTextarea ref={ref} {...p} className={cx('input min-h-[72px]', className)} />;
});
export function Select({ options, placeholder, className, value, onChange, ...p }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  options: (string | { value: any; label: string })[]; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <DiagnosticSelect title={placeholder} {...p} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cx('input pr-7', className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === 'string'
        ? <option key={o} value={o}><ReferenceText message={titleCase(o)} /></option>
        : <option key={String(o.value)} value={o.value}><ReferenceText message={o.label} /></option>)}
    </DiagnosticSelect>
  );
}
export const Field = DiagnosticField;
export function Checkbox({ checked, onChange, label, className, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <DiagnosticLabel className={cx('inline-flex cursor-pointer items-center gap-2 text-sm', className)} onClick={(e) => e.stopPropagation()}>
      <DiagnosticInput aria-label={label?undefined:"Select row"} ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-line-strong accent-hema-600" />
      {label}
    </DiagnosticLabel>
  );
}

/* ───────── Status language ───────── */
const STATUS_TONE: Record<string, string> = {
  ORDERED: 'bg-slate-100 text-slate-700', BILLED: 'bg-slate-100 text-slate-700', COLLECTED: 'bg-sky-50 text-sky-800', RECEIVED: 'bg-hema-50 text-hema-700',
  OUTSOURCE_PENDING: 'bg-violet-50 text-violet-800', OUTSOURCED: 'bg-violet-50 text-violet-800', IN_PROCESS: 'bg-amber-50 text-amber-800',
  RESULTED: 'bg-orange-50 text-orange-800', VALIDATED: 'bg-eosin-50 text-eosin-600', SIGNED: 'bg-ok-bg text-ok', AMENDING: 'bg-high-bg text-high',
  CANCELLED: 'bg-zinc-100 text-zinc-500 line-through', REJECTED: 'bg-crit-bg text-crit', ACTIVE: 'bg-hema-50 text-hema-700', PARTIAL: 'bg-eosin-50 text-eosin-600',
  COMPLETED: 'bg-ok-bg text-ok', PAID: 'bg-ok-bg text-ok', UNPAID: 'bg-crit-bg text-crit', CREDIT: 'bg-violet-50 text-violet-800',
  PENDING: 'bg-amber-50 text-amber-800', NOTIFIED: 'bg-ok-bg text-ok', CLEARED: 'bg-zinc-100 text-zinc-600', PROCESSED: 'bg-ok-bg text-ok', RECEIVED_BY_LAB: 'bg-hema-50 text-hema-700',
  ERROR: 'bg-crit-bg text-crit', FAILED: 'bg-crit-bg text-crit', NACKED: 'bg-crit-bg text-crit', QUEUED: 'bg-amber-50 text-amber-800', SENT: 'bg-sky-50 text-sky-800',
  DELIVERED: 'bg-ok-bg text-ok', ACKED: 'bg-ok-bg text-ok', AVAILABLE: 'bg-hema-50 text-hema-700', RETRY: 'bg-high-bg text-high', DISPATCHED: 'bg-sky-50 text-sky-800',
  IN_TRANSIT: 'bg-sky-50 text-sky-800', AWAITING_QUERY: 'bg-slate-100 text-slate-700',
};
export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null;
  return <span className={cx('chip whitespace-nowrap', STATUS_TONE[status] || 'bg-slate-100 text-slate-700', className)}>{titleCase(status)}</span>;
}
export function Badge({ children, tone = 'slate', className, title }: { children: React.ReactNode; tone?: 'slate' | 'hema' | 'eosin' | 'crit' | 'high' | 'low' | 'ok' | 'violet'; className?: string; title?: string }) {
  const t = { slate: 'bg-slate-100 text-slate-700', hema: 'bg-hema-50 text-hema-700', eosin: 'bg-eosin-50 text-eosin-600', crit: 'bg-crit-bg text-crit', high: 'bg-high-bg text-high', low: 'bg-low-bg text-low', ok: 'bg-ok-bg text-ok', violet: 'bg-violet-50 text-violet-800' }[tone];
  return <span title={title} className={cx('chip', t, className)}>{children}</span>;
}
/** Result flag: LL/HH critical, L low, H high, A abnormal. */
export function FlagBadge({ flag, critical }: { flag?: string | null; critical?: boolean | number }) {
 const referenceT = useReferenceLocalization().t;

  if (!flag || flag === 'N') return null;
  if (critical || flag === 'LL' || flag === 'HH') return <span className="chip bg-crit text-white" title={referenceT("Critical value")}>{flag}</span>;
  if (flag === 'L') return <span className="chip bg-low-bg text-low" title={referenceT("Below reference range")}><ReferenceText message="L" /></span>;
  if (flag === 'H') return <span className="chip bg-high-bg text-high" title={referenceT("Above reference range")}><ReferenceText message="H" /></span>;
  return <span className="chip bg-eosin-50 text-eosin-600" title={referenceT("Abnormal")}>{flag}</span>;
}
export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority || priority === 'ROUTINE') return <span className="text-2xs text-ink-faint"><ReferenceText message="Routine" /></span>;
  return priority === 'STAT' ? <span className="chip bg-crit text-white"><ReferenceText message="STAT" /></span> : <span className="chip bg-high-bg text-high"><ReferenceText message="Urgent" /></span>;
}
export function flagTextClass(flag?: string | null, critical?: any) {
  if (critical || flag === 'LL' || flag === 'HH') return 'text-crit font-semibold';
  if (flag === 'H') return 'text-high font-semibold';
  if (flag === 'L') return 'text-low font-semibold';
  if (flag === 'A') return 'text-eosin-600 font-semibold';
  return '';
}

/* ───────── Layout primitives ───────── */
export function PageHeader({ title, subtitle, actions, children }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export const Section = DiagnosticCard;
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('h-4 w-4 animate-spin text-hema-500', className)} />;
}
export const Loading = DiagnosticLoading;
export const Empty = DiagnosticEmpty;
export function ErrorBanner({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-crit/30 bg-crit-bg px-3 py-2 text-sm text-crit">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
      {onRetry && <DiagnosticButton className="font-medium underline" onClick={onRetry}><ReferenceText message="Try again" /></DiagnosticButton>}
    </div>
  );
}
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line-strong bg-white px-1 py-px font-sans text-2xs font-medium text-ink-soft shadow-[0_1px_0_#C6CCC7]">{children}</kbd>;
}

/* ───────── Tabs ───────── */
export const Tabs = DiagnosticTabs;

/* ───────── Pagination ───────── */
export const Pagination = DiagnosticPagination;

/* ───────── Modal ───────── */
export const Modal = DiagnosticModal;

/** Small modal that asks for a required reason / text. */
export function PromptModal({ open, title, label, placeholder, confirmText, variant = 'primary', onClose, onConfirm, children, multiline = true }: {
  open: boolean; title: string; label: string; placeholder?: string; confirmText: string; variant?: BtnVariant; onClose: () => void; onConfirm: (v: string) => Promise<any> | void; children?: React.ReactNode; multiline?: boolean;
}) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setV(''); setErr(null); } }, [open]);
  const go = async () => {
    if (!v.trim()) { setErr(`${label} is required`); return; }
    setBusy(true);
    try { await onConfirm(v.trim()); onClose(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}><ReferenceText message="Cancel" /></Button><Button variant={variant} loading={busy} onClick={go}>{confirmText}</Button></>}>
      {children}
      <Field label={label} error={err || undefined}>
        {multiline ? <Textarea autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go(); }} />
          : <Input autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />}
      </Field>
    </Modal>
  );
}

/* ───────── Toasts ───────── */
type Toast = { id: number; kind: 'ok' | 'error' | 'warn'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const ToastProvider = DiagnosticToastProvider;
export function useToast(){const push=useDiagnosticToast();return {ok:(t:string)=>push('ok',t),err:(t:string)=>push('err',t),error:(t:string)=>push('error',t),warn:(t:string)=>push('warn',t),info:(t:string)=>push('info',t)};}

/* ───────── Key/value list ───────── */
export function DL({ items, cols = 2 }: { items: [string, React.ReactNode][]; cols?: number }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-2 text-sm', cols === 3 ? 'sm:grid-cols-3' : cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-2')}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-2xs text-ink-faint">{k}</dt>
          <dd className="truncate text-ink">{v === null || v === undefined || v === '' ? <span className="text-ink-faint">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export const DateInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(function DateInput(p, ref) {
  return <DiagnosticDateInput ref={ref} {...p} className={cx('input', p.className)} />;
});
