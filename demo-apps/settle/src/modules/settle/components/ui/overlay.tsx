'use client';

import clsx from 'clsx';
import {X} from '@pepbits/icons';
import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {SourceDialog} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {usePreferences} from '@pepbits/preferences/react';
import {SourceButton} from '@pepbits/ui';
import {IconButton} from './primitives';

/* Dialog and drawer keep the source frames. The shared SourceDialog owns dialog semantics, localized
   naming, focus entry/restore, Tab containment and topmost Escape. Overlays portal to the body inside
   a `.settle-app` surface carrying the current direction, so theme tokens and RTL still apply. */
export function OverlaySurface({children}: {children: React.ReactNode}) {
  const {direction} = useLocalization();
  const {preferences} = usePreferences();
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="settle-app" dir={direction} data-reduced-motion={String(preferences.reducedMotion)}>{children}</div>, document.body);
}

function useAutofocus(open: boolean, panel: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const auto = panel.current?.querySelector<HTMLElement>('[autofocus],[data-autofocus]');
      (auto || panel.current?.querySelector<HTMLElement>('input:not([type=checkbox]),select,textarea'))?.focus();
    }, 30);
    return () => {clearTimeout(t); document.body.style.overflow = overflow;};
  }, [open, panel]);
}

export function Dialog({open, onClose, title, sub, children, footer, size = 'md'}: {
  open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const {t} = useLocalization();
  const holder = useRef<HTMLDivElement>(null);
  useAutofocus(open, holder);
  if (!open) return null;
  const name = typeof title === 'string' ? title : 'Dialog';
  return (
    <OverlaySurface>
      <SourceDialog open={open} onClose={onClose} title={name} className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
        {panel => (
          <>
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
            <div
              ref={node => {panel.current = node; holder.current = node;}}
              tabIndex={-1}
              data-dialog-open="true"
              className={clsx(
                'relative flex max-h-[92dvh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-panel shadow-pop outline-none sm:rounded-2xl',
                size === 'sm' && 'sm:max-w-md', size === 'md' && 'sm:max-w-xl', size === 'lg' && 'sm:max-w-3xl', size === 'xl' && 'sm:max-w-5xl',
              )}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-[length:calc(17px*var(--fs-scale,1))] font-semibold text-ink">{typeof title === 'string' ? t(title) : title}</h2>
                  {sub && <p className="mt-0.5 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">{typeof sub === 'string' ? t(sub) : sub}</p>}
                </div>
                <IconButton label="Close" onClick={onClose} className="-me-2 -mt-1"><X className="h-4 w-4" /></IconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
              {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div>}
            </div>
          </>
        )}
      </SourceDialog>
    </OverlaySurface>
  );
}

export function Drawer({open, onClose, title, sub, children, footer, width = 'md'}: {
  open: boolean; onClose: () => void; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; width?: 'md' | 'lg';
}) {
  const {t} = useLocalization();
  const holder = useRef<HTMLDivElement>(null);
  useAutofocus(open, holder);
  if (!open) return null;
  const name = typeof title === 'string' ? title : 'Details';
  return (
    <OverlaySurface>
      <SourceDialog open={open} onClose={onClose} title={name} className="fixed inset-0 z-[70] flex justify-end">
        {panel => (
          <>
            <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
            <aside
              ref={node => {panel.current = node as HTMLDivElement; holder.current = node as HTMLDivElement;}}
              tabIndex={-1}
              data-dialog-open="true"
              className={clsx('relative flex h-full w-full animate-slide-in flex-col bg-panel shadow-pop outline-none', width === 'md' ? 'sm:max-w-[460px]' : 'sm:max-w-[640px]')}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div className="min-w-0">
                  <h2 className="truncate text-[length:calc(17px*var(--fs-scale,1))] font-semibold text-ink">{typeof title === 'string' ? t(title) : title}</h2>
                  {sub && <div className="mt-0.5 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">{typeof sub === 'string' ? t(sub) : sub}</div>}
                </div>
                <IconButton label="Close" onClick={onClose} className="-me-2 -mt-1"><X className="h-4 w-4" /></IconButton>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
              {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-mist/60 px-5 py-3">{footer}</div>}
            </aside>
          </>
        )}
      </SourceDialog>
    </OverlaySurface>
  );
}

/* ---------------------------------------------------------------- Menu */
export function Menu({trigger, children, align = 'right', className}: {
  trigger: (p: {open: boolean; toggle: () => void}) => React.ReactNode; children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right'; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {if (!ref.current?.contains(e.target as Node)) setOpen(false);};
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {setOpen(false); (ref.current?.querySelector('[aria-expanded]') as HTMLElement | null)?.focus();}
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? [])];
        if (!items.length) return;
        e.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        items[(index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]!.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey);};
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({open, toggle: () => setOpen(o => !o)})}
      {open && (
        <div role="menu" className={clsx('absolute top-full z-[60] mt-2 min-w-[220px] animate-pop-in rounded-xl border border-line bg-panel p-1.5 shadow-pop', align === 'right' ? 'end-0' : 'start-0', className)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({children, onClick, icon, active, disabled, hint}: {
  children: React.ReactNode; onClick?: () => void; icon?: React.ReactNode; active?: boolean; disabled?: boolean; hint?: React.ReactNode;
}) {
  const {t} = useLocalization();
  return (
    <SourceButton
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={clsx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[length:calc(13.5px*var(--fs-scale,1))] transition-colors disabled:opacity-40',
        active ? 'bg-pine-50 text-pine-800' : 'text-ink hover:bg-mist')}
    >
      {icon && <span className="text-ink-soft" aria-hidden>{icon}</span>}
      <span className="flex-1">{typeof children === 'string' ? t(children) : children}</span>
      {hint && <span className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{typeof hint === 'string' ? t(hint) : hint}</span>}
    </SourceButton>
  );
}

/* ---------------------------------------------------------------- Notifications */
type ToastTone = 'success' | 'error' | 'info';
interface Toast {tone: ToastTone; title: string; body?: string}
/** Notifications go through the host ScreenHost, so toast position, duration, count and style follow
 * the effective preferences. Bodies are plain text. */
export function useToast() {
  const {notify} = useScreenHost();
  const {t} = useLocalization();
  return useCallback((toast: Toast) => notify(t(toast.title) + (toast.body ? ' · ' + toast.body : ''), {tone: toast.tone}), [notify, t]);
}

/** Shows API errors consistently: blocked reasons become a list. */
export function useErrorToast() {
  const toast = useToast();
  return useCallback((e: unknown, title = 'That didn’t go through') => {
    const err = e as {message?: string; details?: {reasons?: string[]}};
    const reasons = err.details?.reasons;
    toast({tone: 'error', title, body: reasons && reasons.length > 1 ? reasons.join('; ') : err.message});
  }, [toast]);
}
