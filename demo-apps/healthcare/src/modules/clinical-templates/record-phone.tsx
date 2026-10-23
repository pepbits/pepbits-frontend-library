"use client";
import React from "react";
import {FieldShell, Input, Select} from '@pepbits/ui';
/** Compound phone input assembled from the project's existing form controls. */
export function RecordPhoneField({
  value,
  code,
  options,
  disabled,
  error,
  onValue,
  onCode,
}: {
  value: string;
  code: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  error?: string;
  onValue: (value: string) => void;
  onCode: (value: string) => void;
}) {
  return (
    <FieldShell label="template.clinical.phone" error={error}>
      {(describedBy) => (
        <div className="flex items-start gap-2">
          <Select
            className="w-24 shrink-0"
            aria-label="template.clinical.countryCode"
            disabled={disabled}
            value={code}
            options={[
              { value: "", label: "—" },
              ...options,
              ...(code && !options.some((o) => o.value === code)
                ? [{ value: code, label: code }]
                : []),
            ]}
            onChange={(e) => onCode(e.target.value)}
          />
          <Input
            className="min-w-0 flex-1"
            type="tel"
            aria-label="template.clinical.phone"
            aria-describedby={describedBy}
            disabled={disabled}
            value={value}
            onChange={(e) => onValue(e.target.value)}
          />
        </div>
      )}
    </FieldShell>
  );
}
