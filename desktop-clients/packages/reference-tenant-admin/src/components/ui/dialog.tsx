"use client";
import type { ReactNode } from "react";
import { Drawer as SharedDrawer, Modal as SharedModal } from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";

/**
 * Shared overlays render in the module tree but outside the page body, so their content is wrapped in the same scope class
 * (transparent, inheriting the host theme through data-theme): the scoped .reference-tenant-admin utilities then reach dialog
 * bodies and footers. The shared Modal/Drawer keep their own focus trap, Escape handling, stacking and focus restore.
 */
export function OverlayScope({ children, className }: { children: ReactNode; className?: string }) {
  const { preferences } = useReferenceHost();
  return <div className={cx("reference-tenant-admin", className)} data-overlay="true" data-theme={preferences.theme}>{children}</div>;
}

/** The source's right-hand record drawer on the shared Drawer. `title` is a catalog message or text already translated by the caller. */
export function SideDrawer({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <SharedDrawer open={open} onClose={onClose} title={title} subtitle={subtitle} width="lg"
      footer={footer ? <OverlayScope className="flex w-full flex-wrap items-center gap-2">{footer}</OverlayScope> : undefined}>
      <OverlayScope className="flex h-full min-h-0 flex-col">{children}</OverlayScope>
    </SharedDrawer>
  );
}

/** The source's centered reason dialog on the shared Modal. */
export function ModalDialog({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <SharedModal open={open} onClose={onClose} title={title} subtitle={subtitle} size="sm"
      footer={footer ? <OverlayScope className="flex w-full items-center justify-end gap-2">{footer}</OverlayScope> : undefined}>
      <OverlayScope className="px-5 py-4">{children}</OverlayScope>
    </SharedModal>
  );
}
