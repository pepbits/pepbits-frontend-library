'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, LayoutPanelLeft, Loader2, Search, User, UserPlus, Users } from 'lucide-react';
import type { PatientListItem } from '@allyvora/shared';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/hooks';
import { LAYOUTS } from '@/lib/layouts';
import { SEX_SHORT } from '@/lib/format';

interface Item {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { recent, settings, setSettings } = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const dq = useDebounced(q, 180);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setResults([]);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open || dq.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setLoading(true);
    api.patients
      .list({ q: dq, pageSize: 8, status: 'all' })
      .then((r) => live && setResults(r.items))
      .catch(() => live && setResults([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [dq, open]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const term = q.trim().toLowerCase();
    for (const p of results) {
      out.push({
        id: `p${p.id}`,
        group: 'Patients',
        label: p.displayName,
        detail: [p.mrn, [p.ageLabel, p.sex ? SEX_SHORT[p.sex] : null].filter(Boolean).join(' '), p.mobile].filter(Boolean).join('   '),
        icon: <User className="size-4" />,
        run: () => go(`/patients?mode=view&id=${p.id}`),
      });
    }
    if (!term) {
      for (const r of recent) {
        out.push({ id: `r${r.id}`, group: 'Recently opened', label: r.name, detail: r.mrn, icon: <User className="size-4" />, run: () => go(`/patients?mode=view&id=${r.id}`) });
      }
    }
    const actions: Item[] = [
      { id: 'new', group: 'Actions', label: 'Register a new patient', icon: <UserPlus className="size-4" />, run: () => go('/patients?mode=new') },
      { id: 'list', group: 'Actions', label: 'Open patient register', icon: <Users className="size-4" />, run: () => go('/patients') },
      { id: 'layout', group: 'Actions', label: 'Change form layout', icon: <LayoutPanelLeft className="size-4" />, run: () => go('/settings/layout') },
      ...LAYOUTS.filter((l) => l.id !== settings.layout).map<Item>((l) => ({
        id: `layout-${l.id}`,
        group: 'Actions',
        label: `Switch form to ${l.name.toLowerCase()}`,
        icon: <LayoutPanelLeft className="size-4" />,
        run: () => {
          onClose();
          api.settings.saveLayout({ ...settings, layout: l.id }).then(setSettings).catch(() => {});
        },
      })),
    ];
    out.push(...actions.filter((a) => !term || a.label.toLowerCase().includes(term)));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, recent, q, settings]);

  useEffect(() => setActive(0), [items.length]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open || typeof document === 'undefined') return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === 'Escape') onClose();
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[12vh]">
      <div className="absolute inset-0 bg-rail/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          {loading ? <Loader2 className="size-[18px] animate-spin text-ink-3" /> : <Search className="size-[18px] text-ink-3" aria-hidden />}
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search by name, MRN or mobile, or type an action"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pal-${items[active].id}` : undefined}
          />
        </div>
        <div ref={list} id="palette-list" role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-ink-2">
              {q.trim().length < 2 ? 'Type at least two characters to search patients.' : 'No patients or actions match.'}
            </p>
          )}
          {items.map((it, i) => {
            const header = it.group !== lastGroup;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <p className="px-3 pb-1 pt-2.5 text-2xs font-medium text-ink-3">{it.group}</p>}
                <button
                  id={`pal-${it.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={it.run}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active ? 'bg-brand-soft' : 'hover:bg-sunken')}
                >
                  <span className={cn('shrink-0', i === active ? 'text-brand' : 'text-ink-3')}>{it.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{it.label}</span>
                    {it.detail && <span className="tabular block truncate whitespace-pre text-xs text-ink-3">{it.detail}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="size-4 shrink-0 text-ink-3" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
