'use client';

import { useEffect, useRef } from 'react';
import { SECTIONS, type SectionId, type SectionProgress } from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { StatusGlyph, statusText } from '../parts';

export interface LayoutProps {
  uid: string;
  active: SectionId;
  onSelect: (s: SectionId) => void;
  onActiveChange: (s: SectionId) => void;
  progress: Record<SectionId, SectionProgress>;
  compact: boolean;
  /** Called by "continue" affordances inside a layout. */
  onNext: () => void;
}

export function overall(progress: Record<SectionId, SectionProgress>) {
  const done = SECTIONS.filter((s) => progress[s.id].state === 'complete').length;
  return { done, total: SECTIONS.length };
}

function ErrorBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-2xs font-semibold text-white">
      {n}
      <span className="sr-only"> problems</span>
    </span>
  );
}

/** Vertical section list: the side rail (single page) and the side stepper. */
export function SectionList({
  active,
  onSelect,
  progress,
  variant,
}: Pick<LayoutProps, 'active' | 'onSelect' | 'progress'> & { variant: 'rail' | 'stepper' }) {
  const { done, total } = overall(progress);
  return (
    <nav aria-label="Form sections" className="flex h-full flex-col">
      <ol className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {SECTIONS.map((s, i) => {
          const p = progress[s.id];
          const isActive = active === s.id;
          const st = statusText(p);
          return (
            <li key={s.id} className="relative">
              {variant === 'stepper' && i < SECTIONS.length - 1 && (
                <span
                  className={cn('absolute left-[25px] top-[42px] h-[calc(100%-30px)] w-px', p.state === 'complete' ? 'bg-ok/50' : 'bg-line')}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors',
                  variant === 'stepper' ? 'py-2.5' : 'py-2',
                  isActive ? 'bg-brand-soft' : 'hover:bg-sunken',
                )}
              >
                <StatusGlyph index={s.index} progress={p} active={isActive} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13.5px]', isActive ? 'font-semibold text-ink' : 'font-medium text-ink')}>
                    {variant === 'stepper' ? s.title : s.short}
                  </span>
                  {variant === 'stepper' && (
                    <span
                      className={cn(
                        'tabular block truncate text-xs',
                        st.tone === 'danger' ? 'text-danger' : st.tone === 'ok' ? 'text-ok' : 'text-ink-3',
                      )}
                    >
                      {st.text}
                    </span>
                  )}
                </span>
                <ErrorBadge n={p.errorCount} />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-2">Sections complete</span>
          <span className="tabular font-semibold text-ink">
            {done} of {total}
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {SECTIONS.map((s) => {
            const st = progress[s.id].state;
            return (
              <span
                key={s.id}
                className={cn('h-1.5 flex-1 rounded-full', st === 'complete' ? 'bg-ok' : st === 'error' ? 'bg-danger' : st === 'in-progress' ? 'bg-accent' : 'bg-line')}
              />
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/** Horizontal tabs (Tabs layout) or chips (mobile fallback for side navigation). */
export function SectionTabs({
  active,
  onSelect,
  progress,
  variant,
  className,
}: Pick<LayoutProps, 'active' | 'onSelect' | 'progress'> & { variant: 'tabs' | 'chips'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  const idx = SECTIONS.findIndex((s) => s.id === active);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = SECTIONS[(idx + (e.key === 'ArrowRight' ? 1 : -1) + SECTIONS.length) % SECTIONS.length]!;
    onSelect(next.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Form sections"
      onKeyDown={onKey}
      className={cn('no-scrollbar flex overflow-x-auto', variant === 'tabs' ? 'gap-1 border-b border-line px-2' : 'gap-1.5 p-2', className)}
    >
      {SECTIONS.map((s) => {
        const p = progress[s.id];
        const sel = s.id === active;
        return (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={sel}
            tabIndex={sel ? 0 : -1}
            onClick={() => onSelect(s.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-medium transition-colors',
              variant === 'tabs'
                ? cn('h-12 px-3', sel ? 'text-ink' : 'text-ink-2 hover:text-ink')
                : cn('h-9 rounded-full border pl-1.5 pr-3', sel ? 'border-brand/40 bg-brand-soft text-ink' : 'border-line bg-surface text-ink-2'),
            )}
          >
            <StatusGlyph index={s.index} progress={p} active={sel} size="sm" />
            {s.short}
            {p.errorCount > 0 && (
              <span className="tabular inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10.5px] font-semibold text-white">
                {p.errorCount}
              </span>
            )}
            {variant === 'tabs' && sel && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
