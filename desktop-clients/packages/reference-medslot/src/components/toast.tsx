"use client";
import {useReferenceHost} from "@pepbits/reference-host";
import {SourceButton} from "@pepbits/ops-ui";

import { createContext, useCallback, useContext, useState, useRef, useEffect, type ReactNode } from "react";
import { CircleCheck, CircleAlert, X } from "lucide-react";
import { clsx } from "clsx";

type Toast = { id: number; tone: "success" | "error"; title: string; body?: string };
const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const {preferences}=useReferenceHost();
  const timers=useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(()=>()=>{for(const t of timers.current)clearTimeout(t);},[]);
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-3), { ...t, id }]);
    const timer=setTimeout(()=>{setItems(x=>x.filter(i=>i.id!==id));timers.current.delete(timer);},preferences.toastDuration);timers.current.add(timer);
  }, [preferences.toastDuration]);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className={clsx("pointer-events-none fixed z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2", {
        "top-4 left-4": preferences.toastPosition === "top-left",
        "top-4 left-1/2 -translate-x-1/2": preferences.toastPosition === "top-center",
        "top-4 right-4": preferences.toastPosition === "top-right",
        "bottom-4 left-4": preferences.toastPosition === "bottom-left",
        "bottom-4 left-1/2 -translate-x-1/2": preferences.toastPosition === "bottom-center",
        "bottom-4 right-4": preferences.toastPosition === "bottom-right",
      })} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={clsx("pointer-events-auto flex items-start gap-3 rounded-lg border bg-panel px-4 py-3 shadow-[var(--shadow-pop)] animate-pop-in",
            t.tone === "error" ? "border-triage/40" : "border-scrub/30")}>
            {t.tone === "error" ? <CircleAlert className="mt-0.5 size-4 text-triage" /> : <CircleCheck className="mt-0.5 size-4 text-scrub" />}
            <div className="flex-1 text-sm"><p className="font-semibold">{t.title}</p>{t.body && <p className="mt-0.5 text-mute">{t.body}</p>}</div>
            <SourceButton aria-label="Dismiss" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} className="text-mute hover:text-ink"><X className="size-4" /></SourceButton>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => {
  const { push } = useContext(Ctx);
  return {
    success: (title: string, body?: string) => push({ tone: "success", title, body }),
    error: (e: unknown, title = "That didn't work") => push({ tone: "error", title, body: (e as Error)?.message ?? String(e) }),
  };
};
