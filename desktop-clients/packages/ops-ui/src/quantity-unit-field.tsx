"use client";
import React, { useId } from "react";
import { Input, Select, type Option } from "./form-controls";
import { useLocalization } from "./localization";
import { cn } from "./cn";

/** Machine values stay strings. The host owns units, validation and exact conversion. */
export interface QuantityUnitValue {
  quantity: string;
  unit: string;
}
export interface QuantityUnitPreview {
  /** Exact input pair used by the host to obtain this preview. */
  forValue: QuantityUnitValue;
  content: React.ReactNode;
}
export interface QuantityUnitFieldProps {
  label: string;
  quantityLabel: string;
  unitLabel: string;
  value: QuantityUnitValue;
  options: Option[];
  onChange: (value: QuantityUnitValue) => void;
  quantityHint?: string;
  unitHint?: string;
  quantityError?: string;
  unitError?: string;
  error?: string;
  quantityPlaceholder?: string;
  unitPlaceholder?: string;
  quantityName?: string;
  unitName?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  preview?: QuantityUnitPreview;
  className?: string;
}

/** Product-neutral composition: no parsing, rounding, unit inference, network or persistence. */
export function QuantityUnitField({
  label, quantityLabel, unitLabel, value, options, onChange,
  quantityHint, unitHint, quantityError, unitError, error,
  quantityPlaceholder, unitPlaceholder = "", quantityName, unitName,
  required = false, disabled = false, readOnly = false, loading = false,
  loadingLabel, preview, className,
}: QuantityUnitFieldProps) {
  const id = useId();
  const { t } = useLocalization();
  const blocked = disabled || readOnly || loading;
  const currentPreview = preview && !loading && !error && !quantityError && !unitError
    && preview.forValue.quantity === value.quantity && preview.forValue.unit === value.unit;
  const noteId = error ? `${id}-error` : undefined;
  return (
    <fieldset className={cn("min-w-0 border-0 p-0", className)} disabled={disabled || loading} aria-busy={loading || undefined} aria-describedby={noteId}>
      <legend className="mb-2 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{t(label)}</legend>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label={quantityLabel} hint={quantityHint} error={quantityError}
          id={`${id}-quantity`} name={quantityName} type="text" inputMode="decimal"
          value={value.quantity} required={required} disabled={disabled || loading} readOnly={readOnly}
          placeholder={quantityPlaceholder} aria-describedby={noteId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => { if (!blocked) onChange({ ...value, quantity: event.target.value }); }} />
        <Select label={unitLabel} hint={unitHint} error={unitError}
          id={`${id}-unit`} name={unitName} options={options} placeholder={unitPlaceholder}
          value={value.unit} required={required} disabled={blocked}
          aria-describedby={noteId} aria-invalid={error ? true : undefined}
          onChange={(event) => { if (!blocked) onChange({ ...value, unit: event.target.value }); }} />
      </div>
      {error && <p id={noteId} role="alert" className="mt-2 text-[length:calc(11px*var(--fs-scale))] text-[var(--danger-ink)]">{t(error)}</p>}
      {loading && loadingLabel && <p role="status" className="mt-2 text-[length:calc(11px*var(--fs-scale))] text-[var(--text-subtle)]">{t(loadingLabel)}</p>}
      {currentPreview && <div role="status" aria-live="polite" className="mt-2 break-words text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)]">{preview.content}</div>}
    </fieldset>
  );
}
