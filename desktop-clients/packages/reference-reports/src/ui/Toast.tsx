"use client";
// Port of lumen-reports src/components/ui/Toast.tsx. Position, duration and visible count follow host preferences.
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { IconButton, useLocalization } from '@pepbits/ops-ui';
import { useReferenceHost } from '@pepbits/reference-host';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type ToastT = { id: number; tone: 'success' | 'error' | 'info'; message: string };
const Ctx = createContext<(tone: ToastT['tone'], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
 const referenceT = useReferenceLocalization().t;

  const { preferences } = useReferenceHost();
  const { t } = useLocalization();
  const [items, setItems] = useState<ToastT[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const duration = preferences.toastDuration;
  const push = useCallback((tone: ToastT['tone'], message: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, tone, message }]);
    const timer = setTimeout(() => { timers.current.delete(timer); setItems((x) => x.filter((i) => i.id !== id)); }, tone === 'error' ? Math.max(duration, 8000) : duration);
    timers.current.add(timer);
  }, [duration]);
  const visible = items.slice(-preferences.maxVisibleToasts);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="lr-toast-region" data-position={preferences.toastPosition}>
        {visible.map((item) => (
          <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} className={`lr-toast lr-toast-${item.tone}`} data-style={preferences.toastStyle}>
            {item.tone === 'error' ? <AlertTriangle className="lr-icon" aria-hidden /> : <CheckCircle2 className="lr-icon" aria-hidden />}
            <span className="lr-grow">{t(item.message)}</span>
            <IconButton label={referenceT("Dismiss")} onClick={() => setItems((x) => x.filter((i) => i.id !== item.id))}><X className="lr-icon" /></IconButton>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return useMemo(() => ({
    success: (m: string) => push('success', m),
    error: (m: unknown) => push('error', m instanceof Error ? m.message : String(m)),
    info: (m: string) => push('info', m),
  }), [push]);
}
