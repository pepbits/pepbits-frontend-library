'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticDateInput,DiagnosticTextarea,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { cls, titleCase } from '../lib/format';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* ---------- Buttons ---------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-lab-600 text-white border-lab-700 hover:bg-lab-700',
  secondary: 'bg-white text-ink border-line-strong hover:bg-paper',
  ghost: 'bg-transparent text-ink-soft border-transparent hover:bg-paper hover:text-ink',
  danger: 'bg-white text-flag-crit border-[#E7B7B2] hover:bg-[#FDF3F2]',
  warn: 'bg-[#FFF7E8] text-flag-warn border-[#EBCB94] hover:bg-[#FDEFD3]',
};
export function Button({ variant = 'secondary', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: any }) {
  return (
    <DiagnosticButton
      {...rest}
      disabled={disabled || loading}
      className={cls(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded border font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
        BTN[variant], className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
      {children}
    </DiagnosticButton>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, hint, children, className, required }: { label: string; hint?: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={cls('block', className)}>
      <span className="label">{label}{required && <span className="text-flag-crit"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs2 text-ink-mute">{hint}</span>}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(p, ref) {
  return <DiagnosticInput ref={ref} {...p} className={cls('input', p.className)} />;
});
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <DiagnosticTextarea rows={3} {...p} className={cls('input', p.className)} />;
export function Select({ options, placeholder, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: any; label: string }[]; placeholder?: string }) {
  return (
    <DiagnosticSelect {...p} className={cls('input pr-7', p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={String(o.value)} value={o.value}><ReferenceText message={o.label} /></option>)}
    </DiagnosticSelect>
  );
}
export function Checkbox({ label, checked, onChange, disabled }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cls('inline-flex cursor-pointer select-none items-center gap-2 text-sm', disabled && 'opacity-50')}>
      <DiagnosticInput type="checkbox" className="h-4 w-4 rounded border-line-strong accent-lab-600" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/* ---------- Layout ---------- */
export function PageHeader({ title, subtitle, actions, children }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function Card({ title, actions, children, className, bodyClass }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cls('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cls(bodyClass ?? 'p-4')}>{children}</div>
    </section>
  );
}
export function Stat({ label, value, tone, sub, onClick }: { label: string; value: React.ReactNode; tone?: 'crit' | 'warn' | 'ok'; sub?: string; onClick?: () => void }) {
  return (
    <DiagnosticButton type="button" onClick={onClick} className={cls('card w-full px-4 py-3 text-left transition', onClick && 'hover:border-lab-500')}>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={cls('num mt-1 text-2xl font-semibold', tone === 'crit' ? 'text-flag-crit' : tone === 'warn' ? 'text-flag-warn' : tone === 'ok' ? 'text-flag-ok' : 'text-ink')}>{value}</div>
      {sub && <div className="text-xs2 text-ink-mute"><ReferenceText message={sub} /></div>}
    </DiagnosticButton>
  );
}
export function Tabs({ tabs, value, onChange }: { tabs: { value: string; label: React.ReactNode }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="no-print mb-3 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <DiagnosticButton key={t.value} onClick={() => onChange(t.value)}
          className={cls('-mb-px border-b-2 px-3 py-2 text-sm font-medium', value === t.value ? 'border-lab-600 text-lab-700' : 'border-transparent text-ink-soft hover:text-ink')}>
          {typeof t.label === "string" ? <ReferenceText message={t.label} /> : t.label}
        </DiagnosticButton>
      ))}
    </div>
  );
}
export function Empty({ title, hint, icon: Icon = Info }: { title: string; hint?: React.ReactNode; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="mb-2 h-6 w-6 text-ink-mute" />
      <div className="text-sm font-medium text-ink">{title}</div>
      {hint && <div className="mt-1 max-w-md text-sm text-ink-soft">{hint}</div>}
    </div>
  );
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center gap-2 px-4 py-8 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}
export function ErrorNote({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="mb-3 flex items-start gap-2 rounded border border-[#E7B7B2] bg-[#FDF3F2] px-3 py-2 text-sm text-flag-crit"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>;
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, width = 'max-w-2xl' }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: string }) {
 const referenceT = useReferenceLocalization().t;

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[6vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cls('w-full rounded border border-line bg-white shadow-xl', width)}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <DiagnosticButton onClick={onClose} className="rounded p-1 text-ink-mute hover:bg-paper hover:text-ink" aria-label={referenceT("Close")}><X className="h-4 w-4" /></DiagnosticButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-paper/60 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Small prompt dialog for reasons (cancel, reject, amend...). */
export function ReasonDialog({ open, title, label, confirmLabel = 'Confirm', options, onClose, onSubmit, variant = 'primary' }:
  { open: boolean; title: string; label: string; confirmLabel?: string; options?: string[]; onClose: () => void; onSubmit: (reason: string) => Promise<any>; variant?: BtnVariant }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setReason(''); setErr(null); } }, [open]);
  const submit = async () => {
    if (!reason.trim()) { setErr('Please enter a reason.'); return; }
    setBusy(true);
    try { await onSubmit(reason.trim()); onClose(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-md"
      footer={<><Button onClick={onClose}><ReferenceText message="Back" /></Button><Button variant={variant} loading={busy} onClick={submit}>{confirmLabel}</Button></>}>
      <ErrorNote error={err} />
      {options?.length ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {options.map((o) => <DiagnosticButton key={o} onClick={() => setReason(o)} className={cls('rounded border px-2 py-1 text-xs', reason === o ? 'border-lab-600 bg-lab-50 text-lab-700' : 'border-line-strong hover:bg-paper')}>{o}</DiagnosticButton>)}
        </div>
      ) : null}
      <Field label={label}><Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}

/* ---------- Status & flags ---------- */
const STATUS_TONE: Record<string, string> = {
  ORDERED: 'bg-[#EEF1F4] text-ink-soft border-line-strong',
  NEW: 'bg-[#EEF1F4] text-ink-soft border-line-strong',
  BILLED: 'bg-[#EEF1F4] text-ink border-line-strong',
  COLLECTED: 'bg-[#EAF1FB] text-[#1D5FBF] border-[#C5D8F3]',
  ACCESSIONED: 'bg-[#E9F0FF] text-[#2F4FB0] border-[#C6D3F5]',
  IN_ANALYZER: 'bg-[#F1ECFB] text-[#5B3FA6] border-[#D8CCF1]',
  IN_PROCESS: 'bg-[#F1ECFB] text-[#5B3FA6] border-[#D8CCF1]',
  IN_PROGRESS: 'bg-[#F1ECFB] text-[#5B3FA6] border-[#D8CCF1]',
  OUTSOURCED: 'bg-[#FFF4E5] text-flag-warn border-[#EBCB94]',
  SENT_OUT: 'bg-[#FFF4E5] text-flag-warn border-[#EBCB94]',
  RESULTED: 'bg-[#E6F4F4] text-lab-700 border-lab-100',
  PARTIAL: 'bg-[#FFF4E5] text-flag-warn border-[#EBCB94]',
  VALIDATED: 'bg-[#E4F3EC] text-flag-ok border-[#BFE3D0]',
  SIGNED: 'bg-flag-ok text-white border-flag-ok',
  COMPLETED: 'bg-flag-ok text-white border-flag-ok',
  FINAL: 'bg-flag-ok text-white border-flag-ok',
  PAID: 'bg-[#E4F3EC] text-flag-ok border-[#BFE3D0]',
  UNPAID: 'bg-[#FDF3F2] text-flag-crit border-[#E7B7B2]',
  AMENDING: 'bg-[#FDF0E7] text-flag-high border-[#F0CDB6]',
  AMENDED: 'bg-[#FDF0E7] text-flag-high border-[#F0CDB6]',
  CANCELLED: 'bg-white text-ink-mute border-line line-through',
  REJECTED: 'bg-[#FDF3F2] text-flag-crit border-[#E7B7B2]',
  OPEN: 'bg-[#FDF3F2] text-flag-crit border-[#E7B7B2]',
  NOTIFIED: 'bg-[#E4F3EC] text-flag-ok border-[#BFE3D0]',
  PENDING: 'bg-[#FFF4E5] text-flag-warn border-[#EBCB94]',
  SENT: 'bg-[#E4F3EC] text-flag-ok border-[#BFE3D0]',
  PROCESSED: 'bg-[#E4F3EC] text-flag-ok border-[#BFE3D0]',
  SUCCESS: 'bg-[#E4F3EC] text-flag-ok border-[#BFE3D0]',
  FAILED: 'bg-[#FDF3F2] text-flag-crit border-[#E7B7B2]',
  ERROR: 'bg-[#FDF3F2] text-flag-crit border-[#E7B7B2]',
  DRAFT: 'bg-[#EEF1F4] text-ink-soft border-line-strong',
  DISPATCHED: 'bg-[#FFF4E5] text-flag-warn border-[#EBCB94]',
  STAT: 'bg-flag-crit text-white border-flag-crit',
  ROUTINE: 'bg-white text-ink-soft border-line-strong',
  EXTERNAL: 'bg-[#F1ECFB] text-[#5B3FA6] border-[#D8CCF1]',
  INTERNAL: 'bg-white text-ink-soft border-line-strong',
};
export function Badge({ value, label, className }: { value?: string | null; label?: string; className?: string }) {
  if (!value) return null;
  return (
    <span className={cls('inline-flex items-center whitespace-nowrap rounded border px-1.5 py-px text-xs2 font-medium', STATUS_TONE[value] || 'border-line-strong bg-white text-ink-soft', className)}>
      {label ?? titleCase(value)}
    </span>
  );
}
const FLAG_STYLE: Record<string, string> = {
  L: 'text-flag-low bg-[#EAF1FB] border-[#C5D8F3]',
  H: 'text-flag-high bg-[#FDF0E7] border-[#F0CDB6]',
  A: 'text-flag-high bg-[#FDF0E7] border-[#F0CDB6]',
  LL: 'text-white bg-flag-crit border-flag-crit',
  HH: 'text-white bg-flag-crit border-flag-crit',
  AA: 'text-white bg-flag-crit border-flag-crit',
};
export function Flag({ flag }: { flag?: string | null }) {
  if (!flag || flag === 'N') return null;
  return <span className={cls('inline-flex min-w-[26px] justify-center rounded border px-1 text-xs2 font-bold', FLAG_STYLE[flag] || 'border-line')}>{flag}</span>;
}

/** Tube cap colour chip – the visual anchor for containers and samples throughout the app. */
export function TubeChip({ color, label, size = 'md' }: { color?: string | null; label?: string; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className={cls('inline-block shrink-0 rounded-t-[3px] rounded-b-[8px] border border-black/15', size === 'sm' ? 'h-3.5 w-2' : 'h-5 w-2.5')} style={{ background: `linear-gradient(${color || '#9ca3af'} 0 38%, #EEF1F4 38% 100%)` }} />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; tone: 'ok' | 'err' | 'info'; text: string };
const ToastCtx = createContext<(tone: Toast['tone'], text: string) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, tone, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), tone === 'err' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className={cls('flex items-start gap-2 rounded border bg-white px-3 py-2 text-sm shadow-lg', t.tone === 'err' ? 'border-[#E7B7B2]' : t.tone === 'ok' ? 'border-[#BFE3D0]' : 'border-line')}>
            {t.tone === 'err' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-flag-crit" /> : t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-flag-ok" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-lab-600" />}
            <span className="flex-1">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const push = useContext(ToastCtx);
  return { ok: (t: string) => push('ok', t), err: (t: string) => push('err', t), info: (t: string) => push('info', t) };
}

/** Wraps an async action with toast feedback. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (success) toast.ok(typeof success === 'function' ? success(r) : success);
      return r;
    } catch (e: any) {
      toast.err(e.message || 'Something went wrong');
      return undefined;
    } finally { setBusy(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { busy, run };
}

export const DateInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(function DateInput(p, ref) {
  return <DiagnosticDateInput ref={ref} {...p} className={cls('input', p.className)} />;
});
