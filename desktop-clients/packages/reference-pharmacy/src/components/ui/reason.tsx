"use client";
import { useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Dialog } from "./dialog";
import { SourceButton } from "./controls";
import { Button, Field, Textarea } from "./primitives";

/** Asks for a reason before a state change that needs one (hold, cancel, return). Title/sub arrive already translated. */
export function ReasonDialog({ open, onClose, title, sub, label, confirm, danger, onConfirm, presets = [] }: {
  open: boolean; onClose: () => void; title: string; sub?: string; label: string; confirm: string; danger?: boolean; presets?: string[];
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useLocalization();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const done = () => { setText(""); onClose(); };
  return (
    <Dialog open={open} onClose={done} size="sm" title={title} sub={sub}
      footer={<><Button variant="ghost" onClick={done}><LocalizedText message="Back" /></Button>
        <Button variant={danger ? "danger" : "primary"} disabled={text.trim().length < 3} loading={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(text.trim()); done(); } finally { setBusy(false); } }}>{confirm}</Button></>}>
      <Field label={label}><Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} /></Field>
      {presets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => <SourceButton key={p} onClick={() => setText(t(p))} className="rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:border-cobalt hover:text-cobalt"><LocalizedText message={p} /></SourceButton>)}
        </div>
      )}
    </Dialog>
  );
}
