"use client";
import styles from "../school.module.css";
import {useScreenHost} from "@pepbits/patterns/screen-host";


import {Card as OpsCard, CardFooter, CardHeader as OpsCardHeader, CardTitle, CenterRecordCard, Drawer as OpsDrawer, Modal as OpsModal} from "@pepbits/components";
import {IconButton} from "@pepbits/ui";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import { useReferenceHost } from "../host";
import { CheckCircle2, Info, TriangleAlert, X } from "@pepbits/icons";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";
import {useLocalization as useReferenceLocalization} from "@pepbits/i18n/react";


/* Source Modal/Drawer API over the shared UI dialogs (focus trap, Escape, focus return, localized close label).
   Titles are plain strings as shared UI requires; a source title that carried a status badge passes it as `titleAddon`,
   rendered as the first line of the body. */

const MODAL_SIZE = { sm: "sm", md: "md", lg: "md", xl: "lg" } as const;

export function Modal({ open, onClose, title, sub, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; footer?: ReactNode; size?: keyof typeof MODAL_SIZE;
}) {
  return (
    <OpsModal open={open} onClose={onClose} title={title} subtitle={sub} size={MODAL_SIZE[size]} footer={footer}>
      <div className={`${styles.root} p-4`}>{children}</div>
    </OpsModal>
  );
}

/** Source widths were Tailwind max-width classes; shared UI drawers have three widths. */
function drawerWidth(width: string): "sm" | "md" | "lg" {
  if (/max-w-(xs|sm|md)\b/.test(width)) return "sm";
  if (/max-w-(lg)\b/.test(width)) return "md";
  return "lg";
}

/**
 * The source's record drawer (student, teacher, class, invoice, assignment grading), presented the way the user's
 * effective `previewMode` preference says: inline card, centre card, centre modal, or left/right drawer. Every mode is
 * a shared shared UI component with its own close control; the body, badge line and footer are the source's.
 * Callers keep all state above this component, so a preference or policy change while it is open changes only the
 * frame, never the record or an unsaved draft. Operation dialogs (create, pay, confirm) stay on `Modal` above.
 */
export function Drawer({ open, onClose, title, titleAddon, sub, children, footer, width = "max-w-xl" }: {
  open: boolean; onClose: () => void; title: string; titleAddon?: ReactNode; sub?: string; children: ReactNode; footer?: ReactNode; width?: string;
}) {
  const mode = useReferenceHost().preferences.previewMode;
  if (!open) return null;
  const body = (
    <div className={styles.root} data-record-preview={mode}>
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

/** Notifications use the shell's preference-controlled queue and surface. */
export function ToastProvider({children}:{children:ReactNode}){return <>{children}</>;}
export function useToast(){const {notify}=useScreenHost();return (message:string,kind:'success'|'error'|'info'='success')=>notify(message,{tone:kind});}
