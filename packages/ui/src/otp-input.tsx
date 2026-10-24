"use client";

import {useLocalization} from "@pepbits/i18n/react";
import React, {useEffect, useRef} from "react";
import {cn} from "./cn";

export interface OtpInputProps {
  /** Digits only; shorter values leave trailing boxes empty. */
  value: string;
  onChange: (value: string) => void;
  /** Called once every box holds a digit. */
  onComplete?: (value: string) => void;
  length?: number;
  /** Names the group, for example "6-digit sign-in code". */
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Id of an error or hint element describing every box. */
  describedBy?: string;
  className?: string;
  /** Replaces the default box presentation (size, radius, colors). Structural classes remain. */
  boxClassName?: string;
  /** Replaces the default border of an empty, valid box. */
  idleClassName?: string;
  /** Replaces the default border of a box holding a digit. */
  filledClassName?: string;
  /** Replaces the default invalid border. */
  invalidClassName?: string;
}

/**
 * One-time code entry as separate digit boxes that behave like one field: typing advances,
 * Backspace clears and moves back, arrows move (mirrored in RTL), and paste or autofill spreads digits.
 * Only digits are accepted. Verification, resend timers and rate limits belong to the host.
 */
export function OtpInput({value, onChange, onComplete, length = 6, label, invalid, disabled, autoFocus, describedBy, className, boxClassName, idleClassName, filledClassName, invalidClassName}: OtpInputProps) {
  const {t, direction} = useLocalization();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({length}, (_, index) => value[index] ?? "");

  useEffect(() => {if (autoFocus) refs.current[0]?.focus();}, [autoFocus]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length && clean !== value) onComplete?.(clean);
  };
  const setAt = (index: number, digit: string) => {const next = chars.slice(); next[index] = digit; commit(next.join(""));};
  const focus = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  const onInput = (index: number, raw: string) => {
    // Native Delete/cut clears the selected digit without a Backspace key event.
    if (!raw) {setAt(index, ""); return;}
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length > 1) {
      const next = chars.slice();
      digits.split("").forEach((digit, offset) => {if (index + offset < length) next[index + offset] = digit;});
      commit(next.join(""));
      focus(index + digits.length);
      return;
    }
    const position = Math.min(index, value.length);
    setAt(position, digits);
    if (position < length - 1) focus(position + 1);
  };
  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft", forward = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    if (event.key === "Backspace") {
      event.preventDefault();
      if (chars[index]) setAt(index, "");
      else if (index > 0) {setAt(index - 1, ""); focus(index - 1);}
    } else if (event.key === back && index > 0) {event.preventDefault(); focus(index - 1);}
    else if (event.key === forward && index < length - 1) {event.preventDefault(); focus(index + 1);}
  };
  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    event.preventDefault();
    commit(text);
    focus(text.length);
  };

  return (
    <div role="group" aria-label={t(label)} aria-describedby={describedBy} className={cn("flex justify-between gap-2", className)} data-otp-input>
      {chars.map((char, index) => (
        <input
          key={index}
          ref={element => {refs.current[index] = element;}}
          value={char}
          onChange={event => onInput(index, event.target.value)}
          onKeyDown={event => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={event => event.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={t("Digit {index} of {length}", {index: index + 1, length})}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full min-w-0 max-w-[3.5rem] border text-center font-semibold tabular-nums disabled:opacity-50",
            boxClassName ?? "focus-ring h-12 rounded-[var(--radius)] bg-[var(--surface)] text-[length:calc(20px*var(--fs-scale))] text-[var(--text)]",
            invalid ? invalidClassName ?? "border-[var(--danger)]" : char ? filledClassName ?? "border-[var(--primary)]" : idleClassName ?? "border-[var(--border-strong)]",
          )}
        />
      ))}
    </div>
  );
}
