'use client';

import { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { SECTIONS } from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { SectionBody, StatusGlyph, StatusPill, scrollWithin, sectionDomId } from '../parts';
import type { LayoutProps } from './nav';

/** Accordion: sections fold open one at a time; closed ones still show status. */
export function AccordionLayout({ uid, active, onSelect, progress, compact, onNext }: LayoutProps) {
  useEffect(() => {
    const t = setTimeout(() => {
      const node = document.getElementById(sectionDomId(uid, active));
      if (node) scrollWithin(node, 'start');
    }, 60);
    return () => clearTimeout(t);
  }, [active, uid]);

  return (
    <div className="scroll-thin h-full min-h-0 overflow-y-auto pb-24">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {SECTIONS.map((s, i) => {
          const open = s.id === active;
          const p = progress[s.id];
          const domId = sectionDomId(uid, s.id);
          return (
            <section key={s.id} id={domId} data-section={s.id} className={cn('scroll-mt-2', i > 0 && 'border-t border-line')}>
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`${domId}-body`}
                  onClick={() => onSelect(s.id)}
                  className={cn('flex w-full items-center gap-3 text-left transition-colors', compact ? 'px-4 py-2.5' : 'px-5 py-3.5', open ? 'bg-brand-soft/50' : 'hover:bg-sunken')}
                >
                  <StatusGlyph index={s.index} progress={p} active={open} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{s.title}</span>
                    {!compact && <span className="block truncate text-[13px] font-normal text-ink-2">{s.description}</span>}
                  </span>
                  <StatusPill progress={p} />
                  <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} aria-hidden />
                </button>
              </h2>
              {open && (
                <div id={`${domId}-body`} className={cn('animate-field-in border-t border-line', compact ? 'p-4' : 'p-5')}>
                  <SectionBody section={s.id} />
                  {i < SECTIONS.length - 1 && (
                    <div className="mt-5 flex justify-end">
                      <Button variant="quiet" size="sm" onClick={onNext}>
                        Continue to {SECTIONS[i + 1]!.short.toLowerCase()}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
