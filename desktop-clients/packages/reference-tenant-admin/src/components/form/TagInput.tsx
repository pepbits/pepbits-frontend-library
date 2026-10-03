"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { SourceButton, SourceInput } from "../ui/controls";

export function TagInput({ value, onChange, upper, disabled, invalid, placeholder, id, max }: {
  value: string[]; onChange: (v: string[]) => void; upper?: boolean; disabled?: boolean; invalid?: boolean; placeholder?: string; id?: string; max?: number;
}) {
  const { t } = useLocalization();
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const parts = raw.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean).map((p) => (upper ? p.toUpperCase().replace(/[^A-Z0-9_]/g, "_") : p));
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && (!max || next.length < max)) next.push(p);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };
  return (
    <div className={cx("input flex h-auto min-h-9 flex-wrap items-center gap-1 py-1", invalid && "input-invalid", disabled && "bg-mist")}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-spruce-50 px-1.5 py-0.5 text-[12px] font-medium text-spruce-800">
          {tag}
          {!disabled && (
            <SourceButton onClick={() => onChange(value.filter((x) => x !== tag))} className="text-spruce-500 hover:text-madder-600" aria-label={t("Remove {value0}", { value0: tag })}>
              <X className="h-3 w-3" />
            </SourceButton>
          )}
        </span>
      ))}
      {!disabled && (
        <SourceInput
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === "Tab") { if (draft.trim()) { e.preventDefault(); commit(draft); } }
            if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft.trim() && commit(draft)}
          onPaste={(e) => { e.preventDefault(); commit(e.clipboardData.getData("text")); }}
          placeholder={value.length ? "" : placeholder ?? "Type and press Enter"}
          className="min-w-[110px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#93A3A0]"
        />
      )}
      {disabled && value.length === 0 && <span className="text-muted"><LocalizedText message="None" /></span>}
    </div>
  );
}
