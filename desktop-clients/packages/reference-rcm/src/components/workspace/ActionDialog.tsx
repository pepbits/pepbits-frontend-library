"use client";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import type { ActionDef, FieldDef } from "../../lib/types";
import { FieldInput } from "../form/FieldInput";
import { SourceButton, SourceTextarea } from "../ui/controls";
import { ModalDialog } from "../ui/dialog";

const BTN: Record<ActionDef["tone"], string> = {
  primary: "btn-primary", approve: "btn-approve", attention: "btn-attention", quiet: "btn-primary", danger: "btn bg-madder-600 text-white hover:bg-madder-700",
};

export interface ActionRequest { action: Pick<ActionDef, "key" | "label" | "tone" | "reason" | "inputs" | "hint" | "independent">; subject: string }

/** Collects action inputs and a reason, then confirms, on the shared Modal. Server errors are shown in place and the typed values stay. */
export function ActionDialog({ req, busy, error, fieldErrors, onCancel, onConfirm }: {
  req: ActionRequest; busy: boolean; error?: string | null; fieldErrors?: Record<string, string>;
  onCancel: () => void; onConfirm: (input: Record<string, any>, reason: string) => void;
}) {
  const { t } = useLocalization();
  const a = req.action;
  const [input, setInput] = useState<Record<string, any>>({});
  const [reason, setReason] = useState("");
  const first = useRef<HTMLDivElement>(null);
  useEffect(() => { first.current?.querySelector<HTMLElement>("input,textarea,select,[role=combobox]")?.focus(); }, []);

  const missing = (a.inputs ?? []).some((f: FieldDef) => f.required && (input[f.key] === undefined || input[f.key] === "" || input[f.key] === null)) || (a.reason === "required" && !reason.trim());
  const confirm = () => { if (!busy && !missing) onConfirm(input, reason); };

  return (
    <ModalDialog open onClose={onCancel} busy={busy} title={a.label} subject={req.subject}
      footer={<>
        <SourceButton className="btn-quiet" onClick={onCancel} disabled={busy}><LocalizedText message="Cancel" /></SourceButton>
        <SourceButton className={BTN[a.tone]} disabled={busy || missing} onClick={confirm}>{busy ? t("Working…") : a.label}</SourceButton>
      </>}>
      <div ref={first}>
        {a.hint && <p className="mt-1.5 text-[13px] leading-snug text-muted">{a.hint}</p>}
        {a.independent && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-jade-50 px-3 py-2 text-[12.5px] text-jade-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> <LocalizedText message="Independent decision: recorded against your name as the second person." />
          </p>
        )}
        <div className="mt-4 space-y-3">
          {(a.inputs ?? []).map((f) => (
            <div key={f.key}>
              <label className="field-label" htmlFor={`act-${f.key}`}>{f.label}{f.required && <span className="text-madder-500">*</span>}</label>
              <FieldInput id={`act-${f.key}`} field={f} value={input[f.key]} onChange={(v) => setInput((s) => ({ ...s, [f.key]: v }))} invalid={!!fieldErrors?.[f.key]} />
              {fieldErrors?.[f.key] && <p className="field-error">{fieldErrors[f.key]}</p>}
            </div>
          ))}
          {a.reason && (
            <div>
              <label className="field-label" htmlFor="act-reason"><LocalizedText message="Reason" />{a.reason === "optional" && <span className="font-normal text-muted"> <LocalizedText message="(optional)" /></span>}</label>
              <SourceTextarea id="act-reason" className={cx("input", fieldErrors?.reason && "input-invalid")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in the audit trail"
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirm(); }} />
              {fieldErrors?.reason && <p className="field-error">{fieldErrors.reason}</p>}
            </div>
          )}
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-madder-50 px-3 py-2 text-[12.5px] font-medium text-madder-700">{error}</p>}
      </div>
    </ModalDialog>
  );
}
