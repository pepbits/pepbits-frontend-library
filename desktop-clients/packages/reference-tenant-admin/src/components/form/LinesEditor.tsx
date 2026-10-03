"use client";
import { Plus, Trash2 } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import type { FieldDef, RecordData } from "../../lib/types";
import { SourceButton } from "../ui/controls";
import { FieldInput } from "./FieldInput";

export function LinesEditor({ field, value, onChange, disabled, invalid }: { field: FieldDef; value: RecordData[]; onChange: (v: RecordData[]) => void; disabled?: boolean; invalid?: boolean }) {
  const { t } = useLocalization();
  const cols = field.columns ?? [];
  const set = (i: number, key: string, v: unknown) => onChange(value.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  const weight = (c: FieldDef) => (["ref", "refs", "text", "select"].includes(c.type) ? 1.8 : c.type === "number" ? 0.8 : 1);
  const template = cols.map((c) => `minmax(0, ${weight(c)}fr)`).join(" ") + (disabled ? "" : " 36px");
  const count = value.length === 1
    ? (field.maxItems ? t("{value0} row of up to {value1}", { value0: value.length, value1: field.maxItems }) : t("{value0} row", { value0: value.length }))
    : (field.maxItems ? t("{value0} rows of up to {value1}", { value0: value.length, value1: field.maxItems }) : t("{value0} rows", { value0: value.length }));

  return (
    <div className={cx("overflow-hidden rounded-xl border", invalid ? "border-madder-500" : "border-line")}>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid gap-2 border-b border-line bg-mist px-3 py-2 text-[11.5px] font-semibold text-muted" style={{ gridTemplateColumns: template }}>
            {cols.map((c) => <span key={c.key}>{c.label}{c.required && <span className="text-madder-500"> *</span>}</span>)}
            {!disabled && <span />}
          </div>
          {value.length === 0 && <p className="px-3 py-4 text-[12.5px] text-muted"><LocalizedText message={disabled ? "No rows yet." : "No rows yet. Add the first one below."} /></p>}
          <div className="divide-y divide-line">
            {value.map((row, i) => (
              <div key={i} className="grid items-center gap-2 px-3 py-1.5" style={{ gridTemplateColumns: template }}>
                {cols.map((c) => (
                  <FieldInput key={c.key} id={`${field.key}-${i}-${c.key}`} field={c} value={row[c.key]} onChange={(v) => set(i, c.key, v)} disabled={disabled} compact />
                ))}
                {!disabled && (
                  <SourceButton onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-madder-50 hover:text-madder-600" aria-label={t("Remove row {value0}", { value0: i + 1 })}>
                    <Trash2 className="h-4 w-4" />
                  </SourceButton>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {!disabled && (
        <div className="flex items-center justify-between border-t border-line bg-white px-3 py-1.5">
          <SourceButton className="btn-ghost btn-sm -ml-2" onClick={() => onChange([...value, {}])}>
            <Plus className="h-4 w-4" /> <LocalizedText message="Add row" />
          </SourceButton>
          <span className="text-[11.5px] text-muted">{count}</span>
        </div>
      )}
    </div>
  );
}
