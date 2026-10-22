'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
}

const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = ++seq;
      setToasts((all) => [...all.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-[calc(var(--footer-h)+12px)] right-3 z-[80] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2"
      >
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-pop"
            >
              <Icon
                className={cn(
                  'mt-0.5 size-[18px] shrink-0',
                  t.tone === 'success' && 'text-ok',
                  t.tone === 'error' && 'text-danger',
                  t.tone === 'info' && 'text-brand',
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-[13px] text-ink-2">{t.detail}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-ink-3 hover:text-ink" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
