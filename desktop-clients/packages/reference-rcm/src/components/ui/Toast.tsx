"use client";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import type { ToastPosition } from "@pepbits/erp-config";
import { useReferenceHost } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";
import { SourceButton } from "./controls";

type Tone = "success" | "error" | "info";
interface ToastItem { id: number; tone: Tone; title: string; detail?: string }
const Ctx = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});
let seq = 0;

const POSITION: Record<ToastPosition, string> = {
  "top-left": "left-5 top-5", "top-center": "left-1/2 top-5 -translate-x-1/2", "top-right": "right-5 top-5",
  "bottom-left": "bottom-12 left-5", "bottom-center": "bottom-12 left-1/2 -translate-x-1/2", "bottom-right": "bottom-12 right-5",
};

/** The source toast on the host's toast preferences: position, how long it stays and how many show at once. Titles and details are catalog messages or server text. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { preferences } = useReferenceHost();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const { toastDuration, maxVisibleToasts, toastPosition } = preferences;
  const dismiss = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++seq;
    setItems((xs) => [...xs.slice(-(maxVisibleToasts - 1)), { ...t, id }]);
    const timer = setTimeout(() => { timers.current.delete(timer); setItems((xs) => xs.filter((x) => x.id !== id)); }, t.tone === "error" ? Math.max(toastDuration, 7000) : toastDuration);
    timers.current.add(timer);
  }, [toastDuration, maxVisibleToasts]);
  useEffect(() => { const pending = timers.current; return () => { pending.forEach(clearTimeout); pending.clear(); }; }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className={cx("pointer-events-none fixed z-[130] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col gap-2", POSITION[toastPosition])} aria-live="polite">
        {items.map((t) => {
          const I = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertTriangle : Info;
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-line bg-white p-3 shadow-pop">
              <I className={cx("mt-0.5 h-[18px] w-[18px] shrink-0", t.tone === "success" && "text-jade-600", t.tone === "error" && "text-madder-600", t.tone === "info" && "text-cobalt-600")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug"><LocalizedText message={t.title} /></p>
                {t.detail && <p className="mt-0.5 text-[12.5px] leading-snug text-muted"><LocalizedText message={t.detail} /></p>}
              </div>
              <SourceButton className="rounded p-0.5 text-muted hover:bg-mist" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </SourceButton>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
