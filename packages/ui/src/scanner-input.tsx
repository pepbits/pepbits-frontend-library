"use client";
import React, { useState } from "react";
import { Input } from "./form-controls";
/** Keyboard-wedge and pasted codes are captured only while this control has focus. */
export function ScannerInput({
  label,
  hint,
  disabled,
  onScan,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onScan: (value: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Input
      label={label}
      hint={hint}
      value={value}
      disabled={disabled || busy}
      maxLength={256}
      autoComplete="off"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={async (e) => {
        if (
          e.key !== "Enter" ||
          e.nativeEvent.isComposing ||
          busy ||
          disabled ||
          !value.trim()
        )
          return;
        e.preventDefault();
        setBusy(true);
        try {
          if (await onScan(value.trim())) setValue("");
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
