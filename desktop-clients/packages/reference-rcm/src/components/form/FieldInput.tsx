"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import type { FieldDef } from "../../lib/types";
import { Combobox } from "../ui/Combobox";
import { SourceButton, SourceDateInput, SourceInput, SourceSelect, SourceTextarea } from "../ui/controls";
import { Switch } from "../ui/Switch";
import { LinesEditor } from "./LinesEditor";
import { TagInput } from "./TagInput";
import { useRefOptions } from "./useRefOptions";

interface Props { field: FieldDef; value: any; onChange: (v: any) => void; disabled?: boolean; invalid?: boolean; id: string; compact?: boolean; labelHint?: string }

/** One registry field as its source control: the same element, the same `input` classes, the same value shapes the server expects. */
export function FieldInput({ field: f, value, onChange, disabled, invalid, id, compact, labelHint }: Props) {
  const { t } = useLocalization();
  const cls = cx("input", invalid && "input-invalid", compact && "h-8 px-2 text-[12.5px]");

  switch (f.type) {
    case "textarea":
      return <SourceTextarea id={id} className={cls} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
    case "number":
      return <SourceInput id={id} type="number" inputMode="numeric" className={cls} value={value ?? ""} min={f.min} max={f.max} step={1} disabled={disabled} placeholder={f.placeholder ?? (f.min !== undefined && f.max !== undefined ? `${f.min}–${f.max}` : undefined)} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
    case "decimal":
    case "money":
    case "percent":
      return (
        <div className="relative">
          <SourceInput id={id} inputMode="decimal" className={cx(cls, "text-right", f.type === "percent" && "pr-7")} value={value ?? ""} disabled={disabled} placeholder={disabled ? "" : f.type === "money" ? "0.00" : "0"} onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ""))} />
          {f.type === "percent" && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted">%</span>}
        </div>
      );
    case "date":
      return <SourceDateInput id={id} className={cls} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case "boolean":
      return (
        <div className={cx("flex items-center gap-2.5", compact ? "h-8" : "h-9")}>
          <Switch id={id} checked={Boolean(value)} onChange={onChange} disabled={disabled} label={f.label} />
          <span className="text-[12.5px] text-muted"><LocalizedText message={value ? "On" : "Off"} /></span>
        </div>
      );
    case "select":
      return (
        <SourceSelect id={id} className={cx(cls, "pr-8")} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t(f.required ? "Choose…" : "Not set")}</option>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SourceSelect>
      );
    case "multiselect": {
      const vals: string[] = Array.isArray(value) ? value : [];
      if ((f.options?.length ?? 0) <= 8)
        return (
          <div id={id} className="flex min-h-9 flex-wrap items-center gap-1.5" role="group" aria-label={f.label}>
            {f.options?.map((o) => {
              const on = vals.includes(o.value);
              return (
                <SourceButton key={o.value} disabled={disabled} aria-pressed={on}
                  onClick={() => onChange(on ? vals.filter((v) => v !== o.value) : [...vals, o.value])}
                  className={cx("rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:cursor-not-allowed",
                    on ? "border-harbor-900 bg-harbor-900 text-white" : "border-line bg-white text-harbor-800 hover:border-harbor-300",
                    disabled && !on && "opacity-60", invalid && !on && "border-madder-100")}>
                  {o.label}
                </SourceButton>
              );
            })}
          </div>
        );
      return <Combobox id={id} label={f.label} multiple items={f.options ?? []} value={vals} onChange={onChange} disabled={disabled} invalid={invalid} placeholder="Search and choose" />;
    }
    case "tags":
      return <TagInput id={id} value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} upper={f.upper} disabled={disabled} invalid={invalid} placeholder={f.placeholder} max={f.maxItems} />;
    case "ref":
      return <RefInput field={f} id={id} value={value} onChange={onChange} disabled={disabled} invalid={invalid} labelHint={labelHint} />;
    case "lines":
      return <LinesEditor field={f} value={Array.isArray(value) ? value : []} onChange={onChange} disabled={disabled} invalid={invalid} />;
    default:
      return <SourceInput id={id} className={cx(cls, f.upper && "uppercase")} value={value ?? ""} disabled={disabled} placeholder={f.placeholder} onChange={(e) => onChange(f.upper ? e.target.value.toUpperCase() : e.target.value)} />;
  }
}

function RefInput({ field, value, onChange, disabled, invalid, id, labelHint }: { field: FieldDef; value: any; onChange: (v: any) => void; disabled?: boolean; invalid?: boolean; id: string; labelHint?: string }) {
  const { items, loading, search } = useRefOptions(field.source);
  const vals = value ? [String(value)] : [];
  return (
    <Combobox
      id={id}
      label={field.label}
      items={items}
      loading={loading}
      value={vals}
      disabled={disabled}
      invalid={invalid}
      onSearch={search}
      selectedLabels={value && labelHint ? { [String(value)]: labelHint } : undefined}
      placeholder={field.source?.startsWith("res:") ? "Search by reference or patient" : "Search"}
      onChange={(v) => onChange(v[0] ? Number(v[0]) : null)}
    />
  );
}
