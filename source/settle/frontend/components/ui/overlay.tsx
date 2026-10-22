'use client';

import clsx from 'clsx';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './primitives';

/* ---------------------------------------------------------------- Dialog */
function useOverlay(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const auto = panel.current?.querySelector<HTMLElement>('[autofocus],[data-autofocus]');
      (auto || panel.current?.querySelector<HTMLElement>('input,select,textarea,button:not([aria-label="Close"])'))?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  return panel;
}

export function Dialog({ open, onClose, title, sub, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const panel = useOverlay(open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div data-dialog-open="true" className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative flex max-h-[92dvh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md', size === 'md' && 'sm:max-w-xl', size === 'lg' && 'sm:max-w-3xl', size === 'xl' && 'sm:max-w-5xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {sub && <p className="mt-0.5 text-[13px] text-ink-soft">{sub}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1"><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- Drawer */
export function Drawer({ open, onClose, title, sub, children, footer, width = 'md' }: {
  open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; width?: 'md' | 'lg';
}) {
  const panel = useOverlay(open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div data-dialog-open="true" className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={clsx('relative flex h-full w-full animate-slide-in flex-col bg-white shadow-pop', width === 'md' ? 'sm:max-w-[460px]' : 'sm:max-w-[640px]')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-ink">{title}</h2>
            {sub && <div className="mt-0.5 text-[13px] text-ink-soft">{sub}</div>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1"><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- Menu */
export function Menu({ trigger, children, align = 'right', className }: {
  trigger: (p: { open: boolean; toggle: () => void }) => React.ReactNode; children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right'; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="menu" className={clsx('absolute top-full z-[60] mt-2 min-w-[220px] animate-pop-in rounded-xl border border-line bg-white p-1.5 shadow-pop', align === 'right' ? 'right-0' : 'left-0', className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ children, onClick, icon, active, disabled, hint }: {
  children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; active?: boolean; disabled?: boolean; hint?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors disabled:opacity-40',
        active ? 'bg-pine-50 text-pine-800' : 'text-ink hover:bg-mist')}
    >
      {icon && <span className="text-ink-soft">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[12px] text-ink-mute">{hint}</span>}
    </button>
  );
}

/* ---------------------------------------------------------------- Toasts */
type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: ToastTone; title: string; body?: React.ReactNode; action?: { label: string; onClick: () => void } }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.tone === 'error' ? 7000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-12 right-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-slide-in gap-3 rounded-xl border border-line bg-white p-3.5 shadow-pop">
            {t.tone === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pine-600" />}
            {t.tone === 'error' && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />}
            {t.tone === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">{t.title}</p>
              {t.body && <div className="mt-0.5 text-[13px] text-ink-soft">{t.body}</div>}
              {t.action && <button className="mt-1.5 text-[13px] font-medium text-pine-700 hover:underline" onClick={t.action.onClick}>{t.action.label}</button>}
            </div>
            <button aria-label="Dismiss" className="self-start text-ink-mute hover:text-ink" onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Shows API errors consistently: blocked reasons become a list. */
export function useErrorToast() {
  const toast = useToast();
  return useCallback((e: unknown, title = 'That didn’t go through') => {
    const err = e as { message?: string; details?: { reasons?: string[] } };
    const reasons = err.details?.reasons;
    toast({
      tone: 'error', title,
      body: reasons && reasons.length > 1 ? <ul className="list-disc pl-4">{reasons.map((r) => <li key={r}>{r}</li>)}</ul> : err.message,
    });
  }, [toast]);
}
