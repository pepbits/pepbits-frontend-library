"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { SourceButton } from "./controls";
import { ModalDialog } from "./dialog";

export interface ConfirmRequest { title: string; body: string; confirm: string; tone: "danger" | "primary"; onConfirm: () => void }

/** Replaces the source's `window.confirm` (discard a draft, close with unsaved changes) with the shared Modal. */
export function ConfirmDialog({ req, busy, onCancel }: { req: ConfirmRequest; busy?: boolean; onCancel: () => void }) {
  return (
    <ModalDialog open onClose={onCancel} title={req.title}
      footer={<>
        <SourceButton className="btn-quiet" onClick={onCancel} disabled={busy}><LocalizedText message="Cancel" /></SourceButton>
        <SourceButton className={req.tone === "danger" ? "btn bg-madder-600 text-white hover:bg-madder-700" : "btn-primary"} disabled={busy} onClick={req.onConfirm}>{req.confirm}</SourceButton>
      </>}>
      <p className="text-[13px] text-muted"><LocalizedText message={req.body} /></p>
    </ModalDialog>
  );
}
