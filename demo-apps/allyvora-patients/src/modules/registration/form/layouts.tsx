'use client';
import React, {useEffect, useRef} from 'react';
import {SECTIONS, type LayoutKind, type SectionId, type SectionProgress} from '@allyvora/shared';
import {Button, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {ChevronDown} from '@pepbits/icons';
import {SectionBody, SectionPanel, StatusGlyph, StatusPill, scrollWithin, sectionDomId, statusText} from './parts';

/* The five organisation-wide arrangements of the same nine sections. These are specialised layout
   markup (CMP-04): the shared RecordSectionLayout follows each user's formNavigation preference, while
   AllyVora's arrangement is an administrator setting stored by its own API and includes accordion and
   side-step forms. Fields, rules and controls are shared; reduced motion disables smooth scrolling. */

export interface LayoutProps {
  uid: string;
  active: SectionId;
  onSelect: (section: SectionId) => void;
  onActiveChange: (section: SectionId) => void;
  progress: Record<SectionId, SectionProgress>;
  compact: boolean;
  reducedMotion: boolean;
  /** Called by "continue" affordances inside a layout. */
  onNext: () => void;
}

export function overall(progress: Record<SectionId, SectionProgress>) {
  return {done: SECTIONS.filter(section => progress[section.id].state === 'complete').length, total: SECTIONS.length};
}

function ErrorBadge({count}: {count: number}) {
  const {t} = useLocalization();
  if (!count) return null;
  return <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger-fill)] px-1.5 text-[length:calc(10px*var(--fs-scale))] font-bold tabular-nums text-white">{count}<span className="sr-only"> {t('problems')}</span></span>;
}

/** Vertical section list: the side rail (single page) and the side stepper. */
export function SectionList({active, onSelect, progress, variant}: Pick<LayoutProps, 'active' | 'onSelect' | 'progress'> & {variant: 'rail' | 'stepper'}) {
  const {t} = useLocalization();
  const {done, total} = overall(progress);
  return <nav aria-label={t('Form sections')} className="flex h-full flex-col" data-section-list={variant}>
    <ol className="nex-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
      {SECTIONS.map((section, index) => {
        const p = progress[section.id], current = active === section.id, status = statusText(p);
        return <li key={section.id} className="relative">
          {variant === 'stepper' && index < SECTIONS.length - 1 ? <span className={cn('absolute start-[25px] top-[42px] h-[calc(100%-30px)] w-px', p.state === 'complete' ? 'bg-[var(--success)]' : 'bg-[var(--border)]')} aria-hidden="true"/> : null}
          <button type="button" onClick={() => onSelect(section.id)} aria-current={current ? 'step' : undefined}
            className={cn('focus-ring relative flex w-full items-center gap-3 rounded-xl px-3 text-start transition-colors', variant === 'stepper' ? 'py-2.5' : 'py-2', current ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-2)]')}>
            <StatusGlyph index={section.index} progress={p} active={current}/>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-[length:calc(12px*var(--fs-scale))] text-[var(--text)]', current ? 'font-bold' : 'font-semibold')}>{t(variant === 'stepper' ? section.title : section.short)}</span>
              {variant === 'stepper' ? <span className={cn('block truncate text-[length:calc(10.5px*var(--fs-scale))] tabular-nums', status.tone === 'danger' ? 'text-[var(--danger-ink)]' : status.tone === 'ok' ? 'text-[var(--success-ink)]' : 'text-[var(--text-muted)]')}>{t(status.text, status.values)}</span> : null}
            </span>
            <ErrorBadge count={p.errorCount}/>
          </button>
        </li>;
      })}
    </ol>
    <div className="border-t border-[var(--border)] px-4 py-3">
      <div className="flex items-center justify-between text-[length:calc(10.5px*var(--fs-scale))]"><span className="text-[var(--text-muted)]">{t('Sections complete')}</span><span className="font-bold tabular-nums text-[var(--text)]">{t('{done} of {total}', {done, total})}</span></div>
      <div className="mt-2 flex gap-1" aria-hidden="true">{SECTIONS.map(section => {const state = progress[section.id].state;return <span key={section.id} className={cn('h-1.5 flex-1 rounded-full', state === 'complete' ? 'bg-[var(--success)]' : state === 'error' ? 'bg-[var(--danger)]' : state === 'in-progress' ? 'bg-[var(--warning)]' : 'bg-[var(--border)]')}/>;})}</div>
    </div>
  </nav>;
}

/** Horizontal status-aware tabs (Tabs layout) or chips (narrow fallback for side navigation). */
export function SectionTabs({uid, active, onSelect, progress, variant, className}: Pick<LayoutProps, 'uid' | 'active' | 'onSelect' | 'progress'> & {variant: 'tabs' | 'chips'; className?: string}) {
  const {t, direction} = useLocalization();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});}, [active]);
  const index = SECTIONS.findIndex(section => section.id === active);
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const forward = (event.key === 'ArrowRight') !== (direction === 'rtl');
    const next = SECTIONS[(index + (forward ? 1 : -1) + SECTIONS.length) % SECTIONS.length]!;
    onSelect(next.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };
  return <div ref={ref} role="tablist" aria-label={t('Form sections')} onKeyDown={onKey} className={cn('flex overflow-x-auto', variant === 'tabs' ? 'gap-1 border-b border-[var(--border)] px-2' : 'gap-1.5 p-2', className)}>
    {SECTIONS.map(section => {
      const p = progress[section.id], selected = section.id === active;
      return <button key={section.id} role="tab" type="button" id={`${uid}-tab-${section.id}`} aria-selected={selected} aria-controls={variant === 'tabs' && selected ? `${uid}-panel` : undefined} tabIndex={selected ? 0 : -1} onClick={() => onSelect(section.id)}
        className={cn('focus-ring relative flex shrink-0 items-center gap-2 whitespace-nowrap text-[length:calc(12px*var(--fs-scale))] font-semibold transition-colors',
          variant === 'tabs' ? cn('h-12 px-3', selected ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]') : cn('h-9 rounded-full border ps-1.5 pe-3', selected ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'))}>
        <StatusGlyph index={section.index} progress={p} active={selected} size="sm"/>
        {t(section.short)}
        {p.errorCount > 0 ? <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--danger-fill)] px-1 text-[length:calc(10px*var(--fs-scale))] font-bold tabular-nums text-white">{p.errorCount}<span className="sr-only"> {t('problems')}</span></span> : null}
        {variant === 'tabs' && selected ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--primary)]" aria-hidden="true"/> : null}
      </button>;
    })}
  </div>;
}

/** Single page: every section stacked, with a scroll-following section list. */
export function ScrollLayout(props: LayoutProps) {
  const {uid, active, onActiveChange, compact} = props;
  const scroller = useRef<HTMLDivElement>(null), lock = useRef(0);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (Date.now() < lock.current) return;
        const top = element.getBoundingClientRect().top;
        let current = SECTIONS[0]!.id;
        for (const section of SECTIONS) {
          const node = document.getElementById(sectionDomId(uid, section.id));
          if (node && node.getBoundingClientRect().top - top <= 120) current = section.id;
        }
        if (element.scrollTop + element.clientHeight >= element.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1]!.id;
        onActiveChange(current);
      });
    };
    element.addEventListener('scroll', onScroll, {passive: true});
    return () => {element.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame);};
  }, [uid, onActiveChange]);
  const select = (section: SectionId) => {lock.current = Date.now() + 700; props.onSelect(section);};
  return <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4" data-layout="scroll">
    <aside className="hidden w-60 shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] lg:block"><SectionList {...props} onSelect={select} variant="rail"/></aside>
    <SectionTabs {...props} onSelect={select} variant="chips" className="shrink-0 lg:hidden"/>
    <div ref={scroller} className="nex-scrollbar min-h-0 flex-1 overflow-y-auto pb-24" data-scroll-root>
      <div className={compact ? 'space-y-3' : 'space-y-4'}>{SECTIONS.map(section => <SectionPanel key={section.id} section={section.id} active={section.id === active}/>)}</div>
    </div>
  </div>;
}

/** Tabs: one section at a time, switched from a status-aware tab bar. */
export function TabsLayout(props: LayoutProps) {
  return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]" data-layout="tabs">
    <SectionTabs {...props} variant="tabs" className="shrink-0"/>
    <div role="tabpanel" id={`${props.uid}-panel`} aria-labelledby={`${props.uid}-tab-${props.active}`} className="nex-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--surface-2)] p-3 sm:p-4">
      <SectionPanel key={props.active} section={props.active} active/>
    </div>
  </div>;
}

/** Guided steps: a labelled progress track with one step at a time. */
export function WizardLayout(props: LayoutProps) {
  const {active, onSelect, progress} = props, {t} = useLocalization();
  const index = SECTIONS.findIndex(section => section.id === active);
  return <div className="flex h-full min-h-0 flex-col gap-3" data-layout="wizard">
    <nav aria-label={t('Registration steps')} className="shrink-0 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:px-5">
      <ol className="flex items-start">
        {SECTIONS.map((section, i) => {
          const p = progress[section.id], current = section.id === active;
          return <li key={section.id} className="relative flex min-w-0 flex-1 flex-col items-center">
            {i > 0 ? <span className={cn('absolute start-[calc(-50%+18px)] end-[calc(50%+18px)] top-[13px] h-0.5 rounded-full', progress[SECTIONS[i - 1]!.id].state === 'complete' ? 'bg-[var(--success)]' : 'bg-[var(--border)]')} aria-hidden="true"/> : null}
            <button type="button" onClick={() => onSelect(section.id)} aria-current={current ? 'step' : undefined} aria-label={t('Step {index}: {title}', {index: section.index, title: t(section.title)})} className="focus-ring group relative z-10 flex flex-col items-center gap-1.5 rounded-lg px-1">
              <StatusGlyph index={section.index} progress={p} active={current}/>
              <span className={cn('max-w-full truncate text-[length:calc(10.5px*var(--fs-scale))]', current ? 'font-bold text-[var(--text)]' : 'hidden text-[var(--text-muted)] md:block', p.state === 'error' && 'text-[var(--danger-ink)]')} aria-hidden="true">{t(section.short)}</span>
            </button>
          </li>;
        })}
      </ol>
      <p className="mt-2 text-center text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)] md:hidden">{t('Step {index} of {total}', {index: index + 1, total: SECTIONS.length})}</p>
    </nav>
    <div className="nex-scrollbar min-h-0 flex-1 overflow-y-auto pb-6"><SectionPanel key={active} section={active} active/></div>
  </div>;
}

/** Side steps: labelled vertical steps on the start side, the open step beside them. */
export function StepperLayout(props: LayoutProps) {
  return <div className="flex h-full min-h-0 flex-col lg:flex-row lg:gap-4" data-layout="stepper">
    <aside className="hidden w-72 shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] lg:block"><SectionList {...props} variant="stepper"/></aside>
    <SectionTabs {...props} variant="chips" className="shrink-0 lg:hidden"/>
    <div className="nex-scrollbar min-h-0 flex-1 overflow-y-auto pb-6"><SectionPanel key={props.active} section={props.active} active/></div>
  </div>;
}

/** Accordion: sections fold open one at a time; closed ones still show status. */
export function AccordionLayout({uid, active, onSelect, progress, compact, reducedMotion, onNext}: LayoutProps) {
  const {t} = useLocalization();
  useEffect(() => {
    const timer = setTimeout(() => {const node = document.getElementById(sectionDomId(uid, active)); if (node) scrollWithin(node, 'start', reducedMotion);}, 60);
    return () => clearTimeout(timer);
  }, [active, uid, reducedMotion]);
  return <div className="nex-scrollbar h-full min-h-0 overflow-y-auto pb-24" data-layout="accordion">
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      {SECTIONS.map((section, i) => {
        const open = section.id === active, p = progress[section.id], domId = sectionDomId(uid, section.id);
        return <section key={section.id} id={domId} data-section={section.id} aria-labelledby={`${domId}-h`} className={cn('scroll-mt-2', i > 0 && 'border-t border-[var(--border)]')}>
          <h2 id={`${domId}-h`}>
            <button type="button" aria-expanded={open} aria-controls={`${domId}-body`} onClick={() => onSelect(section.id)}
              className={cn('focus-ring flex w-full items-center gap-3 text-start transition-colors', compact ? 'px-4 py-2.5' : 'px-5 py-3.5', open ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-2)]')}>
              <StatusGlyph index={section.index} progress={p} active={open}/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:calc(14px*var(--fs-scale))] font-bold text-[var(--text)]">{t(section.title)}</span>
                {!compact ? <span className="block truncate text-[length:calc(11.5px*var(--fs-scale))] font-normal text-[var(--text-muted)]">{t(section.description)}</span> : null}
              </span>
              <StatusPill progress={p}/>
              <ChevronDown className={cn('size-4 shrink-0 text-[var(--text-muted)]', !reducedMotion && 'transition-transform', open && 'rotate-180')} aria-hidden="true"/>
            </button>
          </h2>
          {open ? <div id={`${domId}-body`} className={cn('border-t border-[var(--border)]', compact ? 'p-4' : 'p-5')}>
            <SectionBody section={section.id}/>
            {i < SECTIONS.length - 1 ? <div className="mt-5 flex justify-end"><Button variant="ghost" size="sm" onClick={onNext}>{t('Continue to {section}', {section: t(SECTIONS[i + 1]!.short).toLowerCase()})}</Button></div> : null}
          </div> : null}
        </section>;
      })}
    </div>
  </div>;
}

export const LAYOUT_COMPONENTS: Record<LayoutKind, (props: LayoutProps) => React.ReactElement> = {scroll: ScrollLayout, tabs: TabsLayout, wizard: WizardLayout, stepper: StepperLayout, accordion: AccordionLayout};
