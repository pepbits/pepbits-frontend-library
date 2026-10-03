"use client";
import { SourceButton } from "./controls";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { LocalizedText, type MessageValues } from "@pepbits/ops-ui";

type Tone = "success" | "error";
interface Toast { id: number; tone: Tone; message: string; values?: MessageValues }

/** `message` is an English catalog key (or an unlocalized server message, which passes through); `values` fill its {placeholders}. */
const ToastContext = createContext<(message: string, tone?: Tone, values?: MessageValues) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const push = useCallback((message: string, tone: Tone = "success", values?: MessageValues) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, message, values }]);
    const timer = setTimeout(() => { timers.current.delete(timer); setToasts((t) => t.filter((x) => x.id !== id)); }, tone === "error" ? 7000 : 4000);
    timers.current.add(timer);
  }, []);
  useEffect(() => { const pending = timers.current; return () => { pending.forEach(clearTimeout); pending.clear(); }; }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-md border bg-panel px-4 py-3 text-sm shadow-lg ${t.tone === "error" ? "border-bad/30" : "border-ok/30"}`}
          >
            {t.tone === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />}
            <p className="flex-1 text-ink"><LocalizedText message={t.message} values={t.values} /></p>
            <SourceButton className="text-ink-3 hover:text-ink" aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <X className="size-4" />
            </SourceButton>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
