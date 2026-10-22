'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import type { LookupOption } from '@allyvora/shared';
import { cn } from '@/lib/cn';

export interface ComboboxProps {
  id: string;
  options: LookupOption[];
  value: string | string[] | null | undefined;
  multiple?: boolean;
  onChange: (v: string | string[] | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  compact?: boolean;
  disabled?: boolean;
}

interface Placement {
  left: number;
  width: number;
  top: number;
  up: boolean;
  maxH: number;
}

function rank(options: LookupOption[], query: string): LookupOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const starts: LookupOption[] = [];
  const words: LookupOption[] = [];
  const contains: LookupOption[] = [];
  for (const o of options) {
    const l = o.label.toLowerCase();
    if (l.startsWith(q) || o.code.toLowerCase() === q) starts.push(o);
    else if (l.split(/[\s(/,-]+/).some((w) => w.startsWith(q))) words.push(o);
    else if (l.includes(q) || (o.hint ?? '').toLowerCase().includes(q)) contains.push(o);
  }
  return [...starts, ...words, ...contains];
}

export function Combobox({ id, options, value, multiple, onChange, onBlur, invalid, describedBy, placeholder, compact, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = `${id}-list`;

  const selected = useMemo<string[]>(
    () => (multiple ? (Array.isArray(value) ? value : []) : value ? [String(value)] : []),
    [multiple, value],
  );
  const labelOf = useCallback((code: string) => options.find((o) => o.code === code)?.label ?? code, [options]);
  const filtered = useMemo(() => rank(options, query), [options, query]);

  const measure = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    setPlace({ left: r.left, width: Math.max(r.width, 220), top: up ? r.top - 4 : r.bottom + 4, up, maxH: Math.min(300, up ? above : below) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const on = (e: Event) => {
      if (e.target === list.current) return;
      measure();
    };
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrap.current?.contains(t) || list.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setOpen(true);
    const idx = filtered.findIndex((o) => selected.includes(o.code));
    setActive(idx >= 0 ? idx : 0);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (o: LookupOption) => {
    if (multiple) {
      onChange(selected.includes(o.code) ? selected.filter((c) => c !== o.code) : [...selected, o.code]);
      setQuery('');
      input.current?.focus();
    } else {
      onChange(o.code);
      close();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) openList();
        else setActive((a) => Math.min(a + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (open) setActive((a) => Math.max(a - 1, 0));
        break;
      case 'Enter':
        if (open && filtered[active]) {
          e.preventDefault();
          choose(filtered[active]);
        } else if (!open) {
          e.preventDefault();
          openList();
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        // Typing then tabbing picks the best match: fast keyboard entry.
        if (open && !multiple && query.trim() && filtered[active]) onChange(filtered[active].code);
        close();
        break;
      case 'Backspace':
        if (multiple && !query && selected.length) onChange(selected.slice(0, -1));
        break;
    }
  };

  const singleLabel = !multiple && selected[0] ? labelOf(selected[0]) : '';
  const h = compact ? 'min-h-8' : 'min-h-10';

  return (
    <>
      <div
        ref={wrap}
        aria-invalid={invalid || undefined}
        onMouseDown={(e) => {
          if (disabled) return;
          if (e.target === input.current) {
            if (!open) openList();
            return;
          }
          if ((e.target as HTMLElement).closest('[data-chip-remove],[data-clear]')) return;
          e.preventDefault();
          input.current?.focus();
          if (open) close();
          else openList();
        }}
        className={cn(
          'control flex cursor-text items-center gap-1 pr-1.5 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15',
          invalid && 'focus-within:border-danger focus-within:ring-danger/15',
          h,
          multiple && selected.length > 0 && 'flex-wrap py-1 pl-1',
          disabled && 'cursor-not-allowed bg-sunken',
        )}
      >
        {multiple &&
          selected.map((code) => (
            <span key={code} className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-soft pl-2 pr-1 text-[12.5px] font-medium text-brand">
              {labelOf(code)}
              <button
                type="button"
                data-chip-remove
                tabIndex={-1}
                aria-label={`Remove ${labelOf(code)}`}
                onClick={() => onChange(selected.filter((c) => c !== code))}
                className="rounded p-0.5 hover:bg-brand/15"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-o${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={multiple ? query : open ? query : singleLabel}
          placeholder={open && singleLabel ? singleLabel : multiple && selected.length ? '' : (placeholder ?? 'Type or choose')}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && (wrap.current?.contains(next) || list.current?.contains(next))) return;
            close();
            onBlur?.();
          }}
          className={cn(
            'min-w-[5rem] flex-1 bg-transparent outline-none placeholder:text-ink-3 disabled:cursor-not-allowed',
            compact ? 'h-6 text-[13px]' : 'h-8 text-sm',
            multiple && selected.length ? 'px-1' : 'px-3',
          )}
        />
        {!multiple && selected.length > 0 && !disabled && (
          <button
            type="button"
            data-clear
            tabIndex={-1}
            aria-label="Clear"
            onClick={() => {
              onChange(null);
              input.current?.focus();
            }}
            className="rounded p-1 text-ink-3 hover:bg-sunken hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </div>

      {open &&
        place &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            style={{
              position: 'fixed',
              left: place.left,
              width: place.width,
              top: place.top,
              maxHeight: place.maxH,
              transform: place.up ? 'translateY(-100%)' : undefined,
            }}
            className="scroll-thin z-[95] animate-pop-in overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop"
          >
            {filtered.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-3">No matches for “{query}”</li>}
            {filtered.map((o, i) => {
              const isSel = selected.includes(o.code);
              return (
                <li
                  key={o.code}
                  id={`${id}-o${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px]',
                    i === active ? 'bg-brand-soft text-ink' : 'text-ink',
                  )}
                >
                  {multiple && (
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border',
                        isSel ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong',
                      )}
                      aria-hidden
                    >
                      {isSel && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-2xs text-ink-3">{o.hint}</span>}
                  {!multiple && isSel && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
