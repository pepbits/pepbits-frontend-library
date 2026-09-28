"use client";

import {
  Card as OpsCard, CardFooter, CardHeader as OpsCardHeader, CardTitle, CenterRecordCard, Drawer as OpsDrawer, IconButton, LocalizedText, Modal as OpsModal, useLocalization,
} from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/* Source Modal/Drawer API over the ops-ui dialogs (focus trap, Escape, focus return, localized close label).
   Titles are plain strings as ops-ui requires; a source title that carried a status badge passes it as `titleAddon`,
   rendered as the first line of the body. */

const MODAL_SIZE = { sm: "sm", md: "md", lg: "md", xl: "lg" } as const;

export function Modal({ open, onClose, title, sub, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; footer?: ReactNode; size?: keyof typeof MODAL_SIZE;
}) {
  return (
    <OpsModal open={open} onClose={onClose} title={title} subtitle={sub} size={MODAL_SIZE[size]} footer={footer}>
      <div className="p-4">{children}</div>
    </OpsModal>
  );
}

/** Source widths were Tailwind max-width classes; ops-ui drawers have three widths. */
function drawerWidth(width: string): "sm" | "md" | "lg" {
  if (/max-w-(xs|sm|md)\b/.test(width)) return "sm";
  if (/max-w-(lg)\b/.test(width)) return "md";
  return "lg";
}

/**
 * The source's record drawer (student, teacher, class, invoice, assignment grading), presented the way the user's
 * effective `previewMode` preference says: inline card, centre card, centre modal, or left/right drawer. Every mode is
 * a shared ops-ui component with its own close control; the body, badge line and footer are the source's.
 * Callers keep all state above this component, so a preference or policy change while it is open changes only the
 * frame, never the record or an unsaved draft. Operation dialogs (create, pay, confirm) stay on `Modal` above.
 */
export function Drawer({ open, onClose, title, titleAddon, sub, children, footer, width = "max-w-xl" }: {
  open: boolean; onClose: () => void; title: string; titleAddon?: ReactNode; sub?: string; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  const mode = useReferenceHost().preferences.previewMode;
  if (!open) return null;
  const body = (
    <div data-record-preview={mode}>
      {titleAddon && <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">{titleAddon}</div>}
      {children}
    </div>
  );
  switch (mode) {
    case "inline":
      return <InlinePreview title={title} sub={sub} footer={footer} onClose={onClose}>{body}</InlinePreview>;
    case "center-card":
      return (
        <CenterRecordCard open onClose={onClose} title={title} footer={footer}>
          {sub && <p className="-mt-1 mb-2 text-xs text-muted">{sub}</p>}
          <div className="-mx-4">{body}</div>
        </CenterRecordCard>
      );
    case "center-modal":
      return <OpsModal open onClose={onClose} title={title} subtitle={sub} size="lg" footer={footer}>{body}</OpsModal>;
    default:
      return <OpsDrawer open onClose={onClose} title={title} subtitle={sub} side={mode === "left-drawer" ? "left" : "right"} width={drawerWidth(width)} footer={footer}>{body}</OpsDrawer>;
  }
}

/** Inline record preview: a shared Card in the page flow, focused when it opens, closed by its button or Escape. */
function InlinePreview({ title, sub, footer, onClose, children }: { title: string; sub?: string; footer?: ReactNode; onClose: () => void; children: ReactNode }) {
 const referenceT = useReferenceLocalization().t;

  const { t } = useLocalization();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <OpsCard as="section" ref={ref} tabIndex={-1} aria-label={t(title)} shadow="sm" className="outline-none"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <OpsCardHeader>
        <CardTitle title={title} subtitle={sub} action={<IconButton label={referenceT("ui.close.7d9eb7ac")} onClick={onClose}><X className="size-4" /></IconButton>} />
      </OpsCardHeader>
      {children}
      {footer && <CardFooter>{footer}</CardFooter>}
    </OpsCard>
  );
}

/* ---------------- Toasts ---------------- */
type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; text: string }
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

const POSITION: Record<string, string> = {
  "top-left": "top-3 left-3", "top-center": "top-3 left-1/2 -translate-x-1/2", "top-right": "top-3 right-3",
  "bottom-left": "bottom-10 left-3", "bottom-center": "bottom-10 left-1/2 -translate-x-1/2", "bottom-right": "bottom-10 right-3",
};

/** Source toast stack, positioned, timed and capped by the host's toast preferences. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { preferences } = useReferenceHost();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const duration = preferences.toastDuration ?? 3600;
  const max = preferences.maxVisibleToasts ?? 3;
  const push = useCallback((text: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }].slice(-max));
    const timer = setTimeout(() => { timers.current.delete(timer); setItems((x) => x.filter((t) => t.id !== id)); }, duration);
    timers.current.add(timer);
  }, [duration, max]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className={cn("pointer-events-none fixed z-[130] flex w-80 flex-col gap-2", POSITION[preferences.toastPosition] ?? POSITION["bottom-right"])}>
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? TriangleAlert : Info;
          const solid = preferences.toastStyle === "solid";
          return (
            <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
              className={cn("pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-lg",
                solid ? (t.kind === "success" ? "border-transparent bg-ok text-white" : t.kind === "error" ? "border-transparent bg-bad text-white" : "border-transparent bg-info text-white") : "border-line bg-surface")}>
              <Icon className={cn("mt-px size-4 shrink-0", solid ? "text-white" : t.kind === "success" ? "text-ok" : t.kind === "error" ? "text-bad" : "text-info")} />
              {/* Translated at render, so a language change updates an open toast. Messages already built with
                  referenceT, and server error text, are not catalog keys and render verbatim. */}
              <span className="flex-1"><LocalizedText message={t.text} /></span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
