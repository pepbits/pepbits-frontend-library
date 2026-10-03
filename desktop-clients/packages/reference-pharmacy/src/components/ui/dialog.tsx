"use client";
import type { ReactNode } from "react";
import { Drawer as SharedDrawer, Modal as SharedModal } from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { cx } from "../../lib/cx";

/**
 * Shared overlays render in the module tree but outside the page body, so their content is wrapped in the same scope
 * class (transparent, inheriting the host theme through data-theme): the scoped .reference-pharmacy utilities then reach
 * dialog bodies and footers. The shared Modal/Drawer keep their own focus trap, Escape handling and focus restore.
 */
export function OverlayScope({ children, className }: { children: ReactNode; className?: string }) {
  const { preferences } = useReferenceHost();
  return <div className={cx("reference-pharmacy", className)} data-overlay="true" data-theme={preferences.theme}>{children}</div>;
}

const SIZE = { sm: "sm", md: "md", lg: "lg", xl: "xl" } as const;

/**
 * The source Dialog on the shared Modal (centered) or Drawer (`side`). Titles and sub-titles are English catalog
 * messages or text already translated by the caller (`t("Verify {value0}", { value0: rx.rx_no })`).
 */
export function Dialog({ open, onClose, title, sub, children, footer, size = "md", side = false }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; side?: boolean;
}) {
  if (side) {
    return (
      <SharedDrawer open={open} onClose={onClose} title={title} subtitle={sub} width="lg" footer={footer ? <OverlayScope className="flex w-full items-center justify-end gap-2">{footer}</OverlayScope> : undefined}>
        <OverlayScope className="px-5 py-4">{children}</OverlayScope>
      </SharedDrawer>
    );
  }
  return (
    <SharedModal open={open} onClose={onClose} title={title} subtitle={sub} size={SIZE[size]} footer={footer ? <OverlayScope className="flex w-full items-center justify-end gap-2">{footer}</OverlayScope> : undefined}>
      <OverlayScope className="px-5 py-4">{children}</OverlayScope>
    </SharedModal>
  );
}
