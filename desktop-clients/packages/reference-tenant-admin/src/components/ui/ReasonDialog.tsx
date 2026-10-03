"use client";
import { useEffect, useRef, useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceTextarea } from "./controls";
import { ModalDialog } from "./dialog";

export interface ReasonRequest {
  title: string;
  body: string;
  confirm: string;
  tone: "primary" | "danger" | "approve" | "attention";
  required: boolean;
  placeholder?: string;
}

const BUTTON = { primary: "btn-primary", danger: "btn bg-madder-600 text-white hover:bg-madder-700", approve: "btn-approve", attention: "btn-attention" } as const;

/**
 * Asks for a reason before a governed decision, on the shared Modal. `title`, `body` and `confirm` arrive already translated
 * (they carry record codes and dates). Ctrl/Cmd+Enter confirms when a reason is not required or has been given.
 */
export function ReasonDialog({ req, busy, onCancel, onConfirm }: { req: ReasonRequest; busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const { t } = useLocalization();
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const blocked = req.required && !reason.trim();

  return (
    <ModalDialog open onClose={onCancel} title={req.title}
      footer={<>
        <SourceButton className="btn-quiet" onClick={onCancel} disabled={busy}><LocalizedText message="Cancel" /></SourceButton>
        <SourceButton className={BUTTON[req.tone]} disabled={blocked || busy} onClick={() => onConfirm(reason.trim())}>{busy ? t("Working…") : req.confirm}</SourceButton>
      </>}>
      <p className="text-[13px] text-muted"><LocalizedText message={req.body} /></p>
      <label className="field-label mt-4" htmlFor="reason"><LocalizedText message={req.required ? "Reason" : "Reason (optional)"} /></label>
      <SourceTextarea
        id="reason"
        ref={ref}
        className="input"
        value={reason}
        placeholder={req.placeholder}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !blocked && !busy) onConfirm(reason.trim()); }}
      />
    </ModalDialog>
  );
}
