"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
}

/** Six boxes that behave like one field: auto-advance, backspace, arrows and paste. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid,
  disabled,
  autoFocus,
  label,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  }

  function setAt(i: number, digit: string) {
    const arr = chars.slice();
    arr[i] = digit;
    commit(arr.join(""));
  }

  function onInput(i: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length > 1) {
      // Autofill or fast typing: spread from this box onward
      const arr = chars.slice();
      digits.split("").forEach((d, k) => {
        if (i + k < length) arr[i + k] = d;
      });
      commit(arr.join(""));
      refs.current[Math.min(i + digits.length, length - 1)]?.focus();
      return;
    }
    setAt(i, digits);
    if (i < length - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (chars[i]) setAt(i, "");
      else if (i > 0) {
        setAt(i - 1, "");
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    commit(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2 sm:gap-3">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={c}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 w-full min-w-0 max-w-[3.5rem] rounded-xl border bg-white text-center font-display text-2xl font-semibold tabular-nums text-ink-900",
            "transition-[border-color,box-shadow,transform] duration-150 focus:outline-none focus:ring-4",
            invalid
              ? "border-signal focus:ring-signal/15"
              : c
                ? "border-scrub-500 focus:border-scrub-600 focus:ring-scrub-100"
                : "border-ink-200 focus:border-scrub-500 focus:ring-scrub-100",
            c && "scale-[1.02]",
          )}
        />
      ))}
    </div>
  );
}
