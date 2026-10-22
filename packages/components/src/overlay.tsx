"use client";

import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import React, { useEffect, useRef } from "react";
import { X } from "@pepbits/icons";
import { cn } from "@pepbits/ui";
import { Button } from "@pepbits/ui";
import { IconButton } from "@pepbits/ui";

const dialogStack: HTMLElement[] = [];
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Escape to close, and focus kept inside the panel while it is open.
 *
 * The focus half is not decoration: aria-modal="true" tells assistive tech the
 * rest of the page is inert, and without a trap Tab walks straight out into it
 * while the screen reader still says the dialog is modal. Either the attribute
 * or the behaviour had to go, and the attribute is the one that is correct.
 *
 * onClose is held in a ref so the effect depends on `open` alone. Callers pass
 * an inline arrow -- onClose={() => setOpen(false)} -- which is a new function
 * on every render, so a dependency on it would re-run this effect constantly:
 * harmless when it only swapped a listener, but here it would yank focus back
 * to the panel and re-fire the restore on every keystroke inside the dialog.
 */
function useDialogBehaviour(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Track the trigger while closed, before React commits a child's autoFocus.
  // The initial snapshot also covers conditionally mounted, already-open dialogs.
  const [initialFocus] = React.useState(() => typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  const returnFocus = useRef(initialFocus);
  useEffect(() => {
    if (open) return;
    const remember = (event?: FocusEvent) => {
      const focused = document.activeElement as HTMLElement | null;
      // React autofocus can run before the closed-state listener is removed.
      if (event && focused?.closest('[role="dialog"]') && !dialogStack.some(panel => panel.contains(focused))) return;
      returnFocus.current = focused;
    };
    remember();
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const restoreTo = returnFocus.current;
    /* The panel itself, not its first control: starting on the first button
       skips the title, so a screen reader begins the dialog halfway down it.
       Unless something inside already has focus -- React applies a child's
       autoFocus during commit, before this parent effect runs, so focusing
       unconditionally would take it straight back off. The command palette is
       exactly that: Ctrl+K would open it with the caret nowhere and typing
       going into the void. */
    const panel = panelRef.current;
    if (panel) dialogStack.push(panel);
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    const onKey = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== panel || event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      if (!panel) return;
      const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));
      if (!stops.length) { event.preventDefault(); return; }
      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      /* Back to whatever opened it. Without this, closing a dialog drops focus
         to the document and the next Tab restarts from the top of the page. */
      const index = panel ? dialogStack.indexOf(panel) : -1;
      const wasTop = index === dialogStack.length - 1;
      if (index >= 0) dialogStack.splice(index, 1);
      if (wasTop && restoreTo?.isConnected) restoreTo.focus();
    };
  }, [open, panelRef]);
}

export function Modal({ open, onClose, title, subtitle, children, size = "lg", footer, className }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" | "full"; footer?: React.ReactNode; className?: string }) {
  const {t}=useLocalization();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panelRef);
  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl", full: "max-w-[calc(100vw-40px)]" };
  return (
    <div className="animate-fade fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-5 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={t(title)} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} className={cn("animate-slide-up flex max-h-[calc(100vh-40px)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] outline-none", widths[size], className)}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div><h2 className="text-[length:calc(15px*var(--fs-scale))] font-extrabold tracking-[-.02em] text-[var(--text)]">{t(title)}</h2>{subtitle ? <p className="mt-1 text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)]">{t(subtitle)}</p> : null}</div>
          <IconButton label="ui.close.7d9eb7ac" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
        <div className="nex-scrollbar min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, side = "right", width = "md", footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; side?: "left" | "right"; width?: "sm" | "md" | "lg"; footer?: React.ReactNode }) {
  const {t}=useLocalization();
  const panelRef = useRef<HTMLElement>(null);
  useDialogBehaviour(open, onClose, panelRef);
  if (!open) return null;
  const widths = { sm: "w-[360px]", md: "w-[460px]", lg: "w-[620px]" };
  return (
    <div className="fixed inset-0 z-[115] bg-slate-950/35 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label={t(title)} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={panelRef} tabIndex={-1} className={cn("animate-slide-up absolute inset-y-0 flex max-w-[92vw] flex-col border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] outline-none", widths[width], side === "right" ? "right-0 border-l" : "left-0 border-r")}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-[length:calc(15px*var(--fs-scale))] font-extrabold tracking-[-.02em]">{t(title)}</h2>{subtitle ? <p className="mt-1 text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)]">{t(subtitle)}</p> : null}</div><IconButton label="ui.close.7d9eb7ac" onClick={onClose}><X className="size-4" /></IconButton></div>
        <div className="nex-scrollbar min-h-0 flex-1 overflow-auto">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">{footer}</div> : null}
      </aside>
    </div>
  );
}

export function CenterRecordCard({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const {t}=useLocalization();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehaviour(open, onClose, panelRef);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/25 p-5 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label={t(title)} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} tabIndex={-1} className="animate-slide-up w-full max-w-xl rounded-[24px] border border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[var(--surface)] p-2 shadow-[var(--shadow-lg)] outline-none">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><h2 className="text-[length:calc(13px*var(--fs-scale))] font-extrabold">{t(title)}</h2><IconButton label="ui.close.7d9eb7ac" onClick={onClose}><X className="size-4" /></IconButton></div>
          <div className="nex-scrollbar max-h-[65vh] overflow-auto p-4">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * A yes/no question. Built on Modal so it inherits the focus trap and the
 * escape key, and sized "sm" because a confirmation with room for three
 * paragraphs invites three paragraphs.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", tone = "primary", onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm" footer={<>
      <Button variant="ghost" onClick={onCancel}><LocalizedText message="ui.cancel.19766ed6" /></Button>
      <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
    </>}>
      <div className="p-5 text-[length:calc(11px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{typeof message === "string" ? <LocalizedText message={message} /> : message}</div>
    </Modal>
  );
}
