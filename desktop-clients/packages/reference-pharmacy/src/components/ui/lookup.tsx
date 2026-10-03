"use client";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { useApiClient } from "../../lib/api";
import { SourceInput } from "./controls";

/** Type-ahead backed by an API endpoint. Keyboard: ↑ ↓ Enter Esc. Each keystroke cancels the previous lookup; a late reply is discarded. */
export function Lookup<T extends { id: string }>({ endpoint, placeholder, render, onPick, autoFocus, className, value, minChars = 1, inputClassName }: {
  endpoint: (q: string) => string; placeholder: string; render: (item: T, active: boolean) => ReactNode; onPick: (item: T) => void;
  autoFocus?: boolean; className?: string; value?: string; minChars?: number; inputClassName?: string;
}) {
  const api = useApiClient();
  const [q, setQ] = useState(value ?? "");
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < minChars) return;
    const controller = new AbortController();
    const t = setTimeout(() => api.get<T[]>(endpoint(q.trim()), { signal: controller.signal }).then((r) => { if (!controller.signal.aborted) { setItems(r); setActive(0); } }).catch(() => {}), 120);
    return () => { controller.abort(); clearTimeout(t); };
  }, [api, q, endpoint, minChars]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const visible = q.trim().length < minChars ? [] : items;
  const pick = (it?: T) => { if (!it) return; onPick(it); setOpen(false); setQ(""); setItems([]); };

  return (
    <div ref={box} className={cx("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
      <SourceInput autoFocus={autoFocus} value={q} placeholder={placeholder} role="combobox" aria-expanded={open && visible.length > 0} aria-controls={id} aria-autocomplete="list"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, visible.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); pick(visible[active]); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        className={cx("h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2.5 text-[13px] placeholder:text-ink-3 focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/20", inputClassName)} />
      {open && visible.length > 0 && (
        <ul id={id} role="listbox" className="anim-pop scroll-y absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 rounded-lg border border-line bg-surface p-1 shadow-pop">
          {visible.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(it); }}
              className={cx("cursor-pointer rounded-md px-2 py-1.5", i === active && "bg-cobalt-wash")}>
              {render(it, i === active)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
