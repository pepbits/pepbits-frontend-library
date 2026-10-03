"use client";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { SourceDialog, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { SourceButton } from "./controls";

/**
 * The original RCM overlay frames over the shared SourceDialog (role=dialog, aria-modal, focus into the panel, Tab trap, Escape for
 * the top-most dialog, focus restore). They render in place, inside the .reference-rcm module root, so the scoped source styles, host
 * theme and preferences apply. While `busy`, the scrim, close button and Escape do nothing. `title` and `subtitle` arrive translated.
 */

/** The source CreatePanel: a right-hand 620px slide-over with icon tile, title, close button, scrolling body and footer. */
export function SideDrawer({ open, onClose, busy, title, subtitle, icon, children, footer }: {
  open: boolean; onClose: () => void; busy?: boolean; title: string; subtitle?: string; icon?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  const { t } = useLocalization();
  const close = () => { if (!busy) onClose(); };
  return (
    <SourceDialog open={open} onClose={close} title={title} className="fixed inset-0 z-[120] flex animate-fade-in justify-end bg-harbor-950/20">{(panel) => <>
      <div className="absolute inset-0" aria-hidden onMouseDown={close} />
      <div ref={panel} tabIndex={-1} className="relative flex h-full w-[min(620px,100%)] animate-drawer-in flex-col border-l border-line bg-white shadow-drawer outline-none">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon && <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-50 text-signal-700">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold">{title}</h2>
            {subtitle && <p className="text-[12.5px] text-muted">{subtitle}</p>}
          </div>
          <SourceButton onClick={close} disabled={busy} className="rounded-lg p-1.5 text-muted hover:bg-mist" aria-label={t("Close")}><X className="h-5 w-5" /></SourceButton>
        </div>
        {children}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </>}</SourceDialog>
  );
}

/** The source ActionDialog: a centered max-460px rounded-2xl p-5 panel with subject, title and a footer row below the body. */
export function ModalDialog({ open, onClose, busy, title, subject, children, footer, className }: {
  open: boolean; onClose: () => void; busy?: boolean; title: string; subject?: string; children: ReactNode; footer?: ReactNode; className?: string;
}) {
  const close = () => { if (!busy) onClose(); };
  return (
    <SourceDialog open={open} onClose={close} title={title} className="fixed inset-0 z-[120] flex animate-fade-in items-center justify-center bg-harbor-950/35 p-6">{(panel) => <>
      <div className="absolute inset-0" aria-hidden onMouseDown={close} />
      <div ref={panel} tabIndex={-1} className={cx("relative w-full max-w-[460px] rounded-2xl border border-line bg-white p-5 shadow-pop outline-none", className)}>
        {subject && <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted">{subject}</p>}
        <h3 className="mt-1 text-[18px] font-semibold">{title}</h3>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </>}</SourceDialog>
  );
}
