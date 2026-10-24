"use client";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import React, {useCallback, useEffect, useId, useRef, useState} from "react";
import {PenLine, Undo2} from "@pepbits/icons";
import {cn} from "./cn";

/**
 * Pointer-drawn signature capture, as a controlled PNG data URL.
 *
 * The drawing surface is paper: dark ink on a white card in every theme, because
 * the captured image is printed and archived, not shown in the application
 * chrome. The host owns the value, validation, persistence and any keyboard
 * alternative (for example a paper-form reference); this control only draws,
 * clears and reports. In environments without a 2D canvas context the surface
 * renders but cannot draw, and the clear action still works.
 */
export function SignaturePad({id, label, hint, error, required, disabled, value, onChange, onBlur, placeholder = "Sign here", areaLabel = "Signature area. Draw with a mouse, pen or finger.", clearLabel = "Clear signature", className}: {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** PNG data URL, or empty when unsigned. */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  placeholder?: string;
  areaLabel?: string;
  clearLabel?: string;
  className?: string;
}) {
  const {t} = useLocalization();
  const generated = useId();
  const base = id ?? generated;
  const noteId = error || hint ? `${base}-note` : undefined;
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{x: number; y: number} | null>(null);
  const renderedValue = useRef<string | null | undefined>(undefined);
  const [hasInk, setHasInk] = useState(!!value);

  const context = useCallback(() => canvas.current?.getContext("2d") ?? null, []);

  // Replay host changes (including a restored draft), but do not reload our own
  // emitted bitmap while the user is adding another stroke.
  useEffect(() => {
    const next = value || null;
    if (renderedValue.current === next) return;
    renderedValue.current = next;
    drawing.current = false;
    last.current = null;
    setHasInk(!!next);
    const element = canvas.current, ctx = context();
    if (!element || !ctx) return;
    const ratio = window.devicePixelRatio || 1, width = element.clientWidth, height = element.clientHeight;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#12242b";
    ctx.lineWidth = 2.2;
    ctx.clearRect(0, 0, width, height);
    if (next) {
      const image = new Image();
      let live = true;
      image.onload = () => {if (live && !drawing.current) ctx.drawImage(image, 0, 0, width, height);};
      image.src = next;
      return () => {live = false;};
    }
  }, [value, context]);

  const point = (event: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (disabled) return;
    const next = canvas.current?.toDataURL("image/png") ?? null;
    renderedValue.current = next;
    onChange(next);
    onBlur?.();
  };
  const clear = () => {
    const element = canvas.current, ctx = context();
    if (element && ctx) ctx.clearRect(0, 0, element.width, element.height);
    setHasInk(false);
    renderedValue.current = null;
    onChange(null);
    onBlur?.();
  };

  return (
    <div className={cn("block min-w-0", className)} data-signature-pad="">
      {label ? <span id={`${base}-label`} className="mb-1.5 flex items-center gap-1 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{t(label)}{required ? <span className="text-[var(--danger-ink)]" aria-hidden="true">*</span> : null}</span> : null}
      <div className={cn("relative overflow-hidden rounded-[var(--radius)] border bg-white", error ? "border-[var(--danger)]" : "border-[var(--border)]", disabled && "opacity-60")}>
        <canvas
          ref={canvas}
          id={base}
          role="img"
          /* An image role allows no state attributes; the required/invalid state is
             carried by the visible label, the described error and the data marker. */
          aria-label={required ? `${t(areaLabel)} ${t("(required)")}` : t(areaLabel)}
          aria-describedby={noteId}
          data-invalid={error ? "" : undefined}
          className={cn("block h-36 w-full touch-none", disabled ? "cursor-not-allowed" : "cursor-crosshair")}
          onPointerDown={event => {
            if (disabled || !context()) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            drawing.current = true;
            last.current = point(event);
            setHasInk(true);
          }}
          onPointerMove={event => {
            const ctx = context();
            if (!drawing.current || !last.current || !ctx) return;
            const next = point(event);
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(next.x, next.y);
            ctx.stroke();
            last.current = next;
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-slate-300" aria-hidden="true"/>
        {!hasInk ? <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[length:calc(11px*var(--fs-scale))] text-slate-500" aria-hidden="true"><PenLine className="size-4"/>{t(placeholder)}</span> : null}
      </div>
      <div className="mt-1 flex items-start justify-between gap-2">
        {error ? <span id={noteId} className="block text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</span>
          : hint ? <span id={noteId} className="block text-[length:calc(10px*var(--fs-scale))] text-[var(--text-subtle)]">{t(hint)}</span> : <span/>}
        <button type="button" onClick={clear} disabled={disabled || !hasInk} className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:opacity-40">
          <Undo2 className="size-3.5" aria-hidden="true"/><LocalizedText message={clearLabel}/>
        </button>
      </div>
    </div>
  );
}
