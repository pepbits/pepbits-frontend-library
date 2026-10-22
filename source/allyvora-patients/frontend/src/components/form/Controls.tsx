'use client';

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import type { LookupOption } from '@allyvora/shared';
import { cn } from '@/lib/cn';

export function TextInput({
  prefix,
  compact,
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { prefix?: string; compact?: boolean; invalid?: boolean }) {
  const h = compact ? 'h-8 text-[13px]' : 'h-10 text-sm';
  if (prefix) {
    return (
      <div
        aria-invalid={invalid || undefined}
        className={cn(
          'control flex items-center overflow-hidden focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15',
          invalid && 'focus-within:border-danger focus-within:ring-danger/15',
          h,
        )}
      >
        <span className="tabular flex h-full items-center border-r border-line bg-sunken px-2.5 text-[13px] text-ink-2">{prefix}</span>
        <input aria-invalid={invalid || undefined} className={cn('tabular h-full min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-ink-3', className)} {...rest} />
      </div>
    );
  }
  return <input aria-invalid={invalid || undefined} className={cn('control px-3', h, className)} {...rest} />;
}

export function Segmented({
  id,
  labelId,
  options,
  value,
  onChange,
  onBlur,
  invalid,
  compact,
  allowDeselect,
  describedBy,
}: {
  id: string;
  labelId: string;
  options: LookupOption[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  compact?: boolean;
  allowDeselect?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.code === value);
  const move = (to: number) => {
    const n = (to + options.length) % options.length;
    onChange(options[n]!.code);
    refs.current[n]?.focus();
  };
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onBlur?.();
      }}
      className={cn(
        'flex flex-wrap gap-1 rounded-lg border bg-sunken/70 p-1',
        invalid ? 'border-danger' : 'border-line',
      )}
    >
      {options.map((o, i) => {
        const sel = o.code === value;
        return (
          <button
            key={o.code}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={sel}
            tabIndex={sel || (idx < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(sel && allowDeselect ? null : o.code)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(i - 1);
              }
            }}
            className={cn(
              'min-w-0 flex-1 basis-auto truncate whitespace-nowrap rounded-md px-3 font-medium transition-colors',
              compact ? 'h-6 text-[12.5px]' : 'h-8 text-[13px]',
              sel ? 'bg-surface text-brand shadow-sm ring-1 ring-brand/35' : 'text-ink-2 hover:bg-surface/60 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  id,
  checked,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-brand' : invalid ? 'bg-danger/40' : 'bg-line-strong',
      )}
    >
      <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function TextArea({
  compact,
  invalid,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { compact?: boolean; invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      rows={compact ? 2 : 3}
      className={cn('control block resize-y px-3 py-2 [field-sizing:content]', compact ? 'min-h-[56px] text-[13px]' : 'min-h-[76px] text-sm', 'max-h-56', className)}
      {...rest}
    />
  );
}

export function ReadonlyValue({ id, text, muted, compact }: { id: string; text: string; muted?: boolean; compact?: boolean }) {
  return (
    <div
      id={id}
      className={cn(
        'tabular flex items-center rounded-lg border border-dashed border-line-strong bg-sunken/60 px-3',
        compact ? 'h-8 text-[13px]' : 'h-10 text-sm',
        muted ? 'text-ink-3' : 'font-medium text-ink',
      )}
    >
      <span className="truncate">{text}</span>
    </div>
  );
}

/** Signature pad. Always drawn as dark ink on a white card, like paper. */
export function SignaturePad({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  const setup = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#12242b';
    ctx.lineWidth = 2.2;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChange(canvas.current!.toDataURL('image/png'));
  };

  const clear = () => {
    const c = canvas.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div id={id} className="space-y-1.5">
      <div className={cn('relative overflow-hidden rounded-lg border bg-white', invalid ? 'border-danger' : 'border-line')}>
        <canvas
          ref={canvas}
          aria-label="Signature area. Draw with a mouse, pen or finger."
          aria-describedby={describedBy}
          role="img"
          className="block h-36 w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = point(e);
            setHasInk(true);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = point(e);
            const ctx = canvas.current!.getContext('2d')!;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={end}
          onPointerCancel={end}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-slate-300" />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-slate-400">
            <PenLine className="size-4" aria-hidden /> Patient signs here
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={clear} disabled={!hasInk} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-sunken disabled:opacity-40">
          <Eraser className="size-3.5" aria-hidden /> Clear signature
        </button>
      </div>
    </div>
  );
}
