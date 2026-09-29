'use client';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { ReactNode } from 'react';

export interface TabItem { key: string; label: ReactNode; icon?: ReactNode; closable?: boolean; dirty?: boolean }

/** Workspace tabs: a fixed first tab (the worklist) followed by open records. */
export function Tabs({ items, active, onSelect, onClose, right }: { items: TabItem[]; active: string; onSelect: (k: string) => void; onClose?: (k: string) => void; right?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-end gap-0.5 border-b border-hc-line px-2" role="tablist">
      <div className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto">
        {items.map((t) => {
          const on = t.key === active;
          return (
            <div
              key={t.key}
              role="tab"
              aria-selected={on}
              tabIndex={0}
              onClick={() => onSelect(t.key)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(t.key)}
              className={clsx(
                'group relative flex h-9 max-w-[240px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-hc-sm transition-colors',
                on ? 'border-hc-line bg-hc-surface font-medium text-hc-ink after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-hc-surface' : 'border-transparent text-hc-ink-mute hover:bg-hc-surface/60 hover:text-hc-ink',
              )}
            >
              {on && <span className="absolute inset-x-2 top-0 h-0.5 rounded-b bg-hc-petrol-500" />}
              {t.icon}
              <span className="truncate">{t.label}</span>
              {t.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-hc-warn-600" title="Unsaved changes" />}
              {t.closable && onClose && (
                <button
                  type="button"
                  aria-label="Close tab"
                  onClick={(e) => { e.stopPropagation(); onClose(t.key); }}
                  className="-mr-1 rounded p-0.5 text-hc-ink-faint opacity-0 hover:bg-hc-canvas hover:text-hc-ink group-hover:opacity-100 aria-selected:opacity-100"
                  style={on ? { opacity: 1 } : undefined}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2 pb-1.5">{right}</div>}
    </div>
  );
}
