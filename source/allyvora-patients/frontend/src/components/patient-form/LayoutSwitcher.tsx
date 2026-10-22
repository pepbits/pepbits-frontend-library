'use client';

import { ListOrdered, Milestone, PanelTop, Rows3, ScrollText } from 'lucide-react';
import type { LayoutKind } from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { LAYOUTS } from '@/lib/layouts';

export const LAYOUT_ICONS: Record<LayoutKind, typeof ScrollText> = {
  scroll: ScrollText,
  tabs: PanelTop,
  wizard: Milestone,
  stepper: ListOrdered,
  accordion: Rows3,
};

/** Compact icon switcher so staff can change layout without leaving the form. */
export function LayoutSwitcher({ value, onChange, className }: { value: LayoutKind; onChange: (l: LayoutKind) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Form layout" className={cn('flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5', className)}>
      {LAYOUTS.map((l) => {
        const Icon = LAYOUT_ICONS[l.id];
        const sel = l.id === value;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={sel}
            title={l.name}
            aria-label={l.name}
            onClick={() => onChange(l.id)}
            className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors', sel ? 'bg-rail text-white' : 'text-ink-3 hover:bg-sunken hover:text-ink')}
          >
            <Icon className="size-4" aria-hidden />
            {sel && <span className="hidden sm:inline">{l.name}</span>}
          </button>
        );
      })}
    </div>
  );
}
