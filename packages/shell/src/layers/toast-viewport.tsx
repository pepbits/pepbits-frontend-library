"use client";

import {LocalizedText} from "@pepbits/i18n/react";
import React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "@pepbits/icons";
import {Badge, IconButton, cn} from "@pepbits/ui";
import type {BadgeTone} from "@pepbits/ui";
import type { ToastPosition } from "@pepbits/preferences";
import { useERP } from "../shell-context";

const toastPositionClass: Record<ToastPosition, string> = {
  "top-left": "left-4 top-4 items-start",
  "top-center": "left-1/2 top-4 -translate-x-1/2 items-center",
  "top-right": "right-4 top-4 items-end",
  "bottom-left": "bottom-12 left-4 items-start",
  "bottom-center": "bottom-12 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-12 right-4 items-end",
};

export function ToastViewport() {
  const { toasts, dismissToast, preferences } = useERP();
  const tone: Record<string, BadgeTone> = { success: "success", error: "danger", warning: "warning", info: "info" };
  const icons = { success: CheckCircle2, error: AlertCircle, warning: AlertCircle, info: Info };
  return (
    <div data-shell-toasts aria-live="polite" aria-atomic="false" className={cn("pointer-events-none fixed z-[180] flex max-w-[calc(100vw-2rem)] flex-col gap-2", toastPositionClass[preferences.toastPosition])}>
      {toasts.map((item) => {
        const Icon = icons[item.type];
        /* "solid" fills the whole toast with its tone and inverts the text;
           "light" is the historical look -- surface background, tinted icon. */
        const solid = preferences.toastStyle === "solid";
        const toneVar = item.type === "success" ? "--success" : item.type === "error" ? "--danger" : item.type === "warning" ? "--warning" : "--info";
        return (
          <div key={item.id} style={solid ? { background: `var(${toneVar})`, borderColor: `var(${toneVar})` } : undefined} className={cn("pointer-events-auto animate-slide-up flex w-[360px] max-w-full items-start gap-3 rounded-2xl border p-3 shadow-[var(--shadow-md)]", solid ? "text-white" : "border-[var(--border)] bg-[var(--surface)]")}>
            <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", solid ? "bg-white/20" : "bg-[var(--surface-2)]")}><Icon className={cn("size-4", solid ? "text-white" : item.type === "success" && "text-[var(--success-ink)]", !solid && item.type === "error" && "text-[var(--danger-ink)]", !solid && item.type === "warning" && "text-[var(--warning-ink)]", !solid && item.type === "info" && "text-[var(--info-ink)]")} /></span>
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[length:calc(11px*var(--fs-scale))] font-extrabold">{<LocalizedText message={item.title} />}</span>{solid ? null : <Badge tone={tone[item.type]}>{item.type}</Badge>}</span>{item.message ? <span className={cn("mt-1 block text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed", solid ? "text-white/85" : "text-[var(--text-muted)]")}>{<LocalizedText message={item.message} />}</span> : null}</span>
            <IconButton label="ui.dismiss.48845bff" className={cn("size-7", solid && "text-white hover:bg-white/15")} onClick={() => dismissToast(item.id)}><X className="size-3.5" /></IconButton>
          </div>
        );
      })}
    </div>
  );
}
