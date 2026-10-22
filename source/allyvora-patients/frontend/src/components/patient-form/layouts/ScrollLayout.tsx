'use client';

import { useEffect, useRef } from 'react';
import { SECTIONS } from '@allyvora/shared';
import { SectionPanel, sectionDomId } from '../parts';
import { SectionList, SectionTabs, type LayoutProps } from './nav';

/** Single page: every section stacked, with a scroll-following section list. */
export function ScrollLayout(props: LayoutProps) {
  const { uid, active, onActiveChange, compact } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const lock = useRef(0);

  // Scroll spy: the section whose top has passed the top edge is active.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Date.now() < lock.current) return;
        const top = el.getBoundingClientRect().top;
        let current = SECTIONS[0]!.id;
        for (const s of SECTIONS) {
          const node = document.getElementById(sectionDomId(uid, s.id));
          if (node && node.getBoundingClientRect().top - top <= 120) current = s.id;
        }
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1]!.id;
        onActiveChange(current);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [uid, onActiveChange]);

  const select = (s: typeof active) => {
    lock.current = Date.now() + 700;
    props.onSelect(s);
  };

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4">
      <aside className="hidden w-60 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface lg:block">
        <SectionList {...props} onSelect={select} variant="rail" />
      </aside>
      <SectionTabs {...props} onSelect={select} variant="chips" className="shrink-0 lg:hidden" />
      <div ref={scroller} className="scroll-thin min-h-0 flex-1 overflow-y-auto scroll-smooth pb-24" data-scroll-root>
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
          {SECTIONS.map((s) => (
            <SectionPanel key={s.id} section={s.id} active={s.id === active} />
          ))}
        </div>
      </div>
    </div>
  );
}
