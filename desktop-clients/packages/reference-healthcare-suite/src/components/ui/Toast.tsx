'use client';
import {useReferenceHost} from '@pepbits/reference-host';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, ReactNode, useCallback, useContext, useState, useEffect, useRef } from 'react';

type ToastTone = 'ok' | 'danger' | 'info';
interface ToastItem { id: number; tone: ToastTone; title: string; body?: string }
const Ctx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const {preferences}=useReferenceHost();
  const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-(preferences.maxVisibleToasts-1)).slice(preferences.maxVisibleToasts===1?xs.length:0), { ...t, id }]);
    timers.current.push(setTimeout(() => setItems(xs=>xs.filter(x=>x.id!==id)), preferences.toastDuration));
  }, [preferences.toastDuration,preferences.maxVisibleToasts]);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className={clsx('pointer-events-none fixed z-[130] flex w-80 flex-col gap-2',preferences.toastPosition.startsWith('top')?'top-4':'bottom-4',preferences.toastPosition.endsWith('left')?'left-4':preferences.toastPosition.endsWith('right')?'right-4':'left-1/2 -translate-x-1/2')} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex gap-2.5 rounded-lg border border-hc-line bg-hc-surface p-3 shadow-hc-pop" data-toast-style={preferences.toastStyle}>
            {t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hc-ok-600" /> : t.tone === 'danger' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-hc-danger-600" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-hc-info-600" />}
            <div className="min-w-0 flex-1">
              <p className={clsx('text-hc-sm font-medium', t.tone === 'danger' ? 'text-hc-danger-700' : 'text-hc-ink')}><LocalizedText message={t.title}/></p>
              {t.body && <p className="mt-0.5 text-hc-xs text-hc-ink-mute"><LocalizedText message={t.body}/></p>}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))} className="self-start rounded p-0.5 text-hc-ink-faint hover:text-hc-ink"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
