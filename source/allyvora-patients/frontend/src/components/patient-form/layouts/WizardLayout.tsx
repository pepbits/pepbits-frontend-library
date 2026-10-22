'use client';

import { SECTIONS } from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { SectionPanel, StatusGlyph } from '../parts';
import type { LayoutProps } from './nav';

/** Guided steps: a labelled progress track with one step at a time. */
export function WizardLayout(props: LayoutProps) {
  const { active, onSelect, progress } = props;
  const idx = SECTIONS.findIndex((s) => s.id === active);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <nav aria-label="Registration steps" className="shrink-0 rounded-2xl border border-line bg-surface px-3 py-3 sm:px-5">
        <ol className="flex items-start">
          {SECTIONS.map((s, i) => {
            const p = progress[s.id];
            const isActive = s.id === active;
            return (
              <li key={s.id} className="relative flex min-w-0 flex-1 flex-col items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      'absolute left-[calc(-50%+18px)] right-[calc(50%+18px)] top-[13px] h-0.5 rounded-full',
                      progress[SECTIONS[i - 1]!.id].state === 'complete' ? 'bg-ok' : 'bg-line',
                    )}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${s.index}: ${s.title}`}
                  className="group relative z-10 flex flex-col items-center gap-1.5 rounded-lg px-1 outline-offset-4"
                >
                  <StatusGlyph index={s.index} progress={p} active={isActive} />
                  <span
                    className={cn(
                      'max-w-full truncate text-xs',
                      isActive ? 'font-semibold text-ink' : 'hidden text-ink-2 group-hover:text-ink md:block',
                      p.state === 'error' && 'text-danger',
                    )}
                  >
                    {s.short}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-center text-xs text-ink-3 md:hidden">
          Step {idx + 1} of {SECTIONS.length}
        </p>
      </nav>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-6">
        <SectionPanel key={active} section={active} active className="animate-field-in" />
      </div>
    </div>
  );
}
