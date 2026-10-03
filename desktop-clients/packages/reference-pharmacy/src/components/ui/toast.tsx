"use client";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import type { ToastPosition } from "@pepbits/erp-config";
import { useReferenceHost } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";
import { SourceButton } from "./controls";

type ToastTone = "ok" | "error" | "info";
interface Toast { id: number; tone: ToastTone; title: string; body?: string }
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

const POSITION: Record<ToastPosition, string> = {
  "top-left": "left-4 top-4", "top-center": "left-1/2 top-4 -translate-x-1/2", "top-right": "right-4 top-4",
  "bottom-left": "bottom-4 left-4", "bottom-center": "bottom-4 left-1/2 -translate-x-1/2", "bottom-right": "bottom-4 right-4",
};

/** The source toast on the host's toast preferences: position, how long it stays and how many show at once. Titles and bodies are catalog messages or server text. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { preferences } = useReferenceHost();
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const { toastDuration, maxVisibleToasts, toastPosition } = preferences;
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-(maxVisibleToasts - 1)), { ...t, id }]);
    const timer = setTimeout(() => { timers.current.delete(timer); setItems((s) => s.filter((x) => x.id !== id)); }, t.tone === "error" ? Math.max(toastDuration, 7000) : toastDuration);
    timers.current.add(timer);
  }, [toastDuration, maxVisibleToasts]);
  useEffect(() => { const pending = timers.current; return () => { pending.forEach(clearTimeout); pending.clear(); }; }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className={cx("pointer-events-none fixed z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2", POSITION[toastPosition])}>
        {items.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="anim-pop pointer-events-auto flex gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-pop">
            {t.tone === "ok" ? <CircleCheck className="mt-px size-4 shrink-0 text-ok" /> : t.tone === "error" ? <CircleAlert className="mt-px size-4 shrink-0 text-danger" /> : <Info className="mt-px size-4 shrink-0 text-cobalt" />}
            <div className="min-w-0 flex-1">
              <p className={cx("text-[13px] font-medium", t.tone === "error" ? "text-danger" : "text-ink")}><LocalizedText message={t.title} /></p>
              {t.body && <p className="mt-0.5 text-xs text-ink-2"><LocalizedText message={t.body} /></p>}
            </div>
            <SourceButton aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-ink-3 hover:text-ink"><X className="size-3.5" /></SourceButton>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
