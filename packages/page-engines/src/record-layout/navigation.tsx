"use client";
import React,{useRef,useEffect,createContext,useContext} from 'react';
import {cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {StatusGlyph,statusText,type RecordSectionProgress} from '@pepbits/patterns/record-form';
export interface RecordFormSection {id:string;title:string;short?:string;description?:string;index?:number}
export interface LayoutProps {uid:string;active:string;onSelect:(section:string)=>void;progress:Record<string,RecordSectionProgress>}
export const LayoutData=createContext<{sections:(RecordFormSection & {index:number})[]}>({sections:[]});
const useLayoutData=()=>useContext(LayoutData);
function ErrorBadge({count}: {count: number}) {
  const {t} = useLocalization();
  if (!count) return null;
  return <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger-fill)] px-1.5 text-[length:calc(10px*var(--fs-scale))] font-bold tabular-nums text-white">{count}<span className="sr-only"> {t('problems')}</span></span>;
}

/** Vertical section list: the side rail (single page) and the side stepper. */
export function SectionList({active, onSelect, progress, variant}: Pick<LayoutProps, 'active' | 'onSelect' | 'progress'> & {variant: 'rail' | 'stepper'}) {
  const {t} = useLocalization();
  const {sections}=useLayoutData();
  const done=sections.filter(section=>progress[section.id]?.state==='complete').length,total=sections.length;
  return <nav aria-label={t('Form sections')} className="flex h-full flex-col" data-section-list={variant}>
    <ol className="nex-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
      {sections.map((section, index) => {
        const p = progress[section.id]!, current = active === section.id, status = statusText(p);
        return <li key={section.id} className="relative">
          {variant === 'stepper' && index < sections.length - 1 ? <span className={cn('absolute start-[25px] top-[42px] h-[calc(100%-30px)] w-px', p.state === 'complete' ? 'bg-[var(--success)]' : 'bg-[var(--border)]')} aria-hidden="true"/> : null}
          <button type="button" onClick={() => onSelect(section.id)} aria-current={current ? 'step' : undefined}
            className={cn('focus-ring relative flex w-full items-center gap-3 rounded-xl px-3 text-start transition-colors', variant === 'stepper' ? 'py-2.5' : 'py-2', current ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--surface-2)]')}>
            <StatusGlyph index={section.index} progress={p} active={current}/>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-[length:calc(12px*var(--fs-scale))] text-[var(--text)]', current ? 'font-bold' : 'font-semibold')}>{t(variant === 'stepper' ? section.title : section.short ?? section.title)}</span>
              {variant === 'stepper' ? <span className={cn('block truncate text-[length:calc(10.5px*var(--fs-scale))] tabular-nums', status.tone === 'danger' ? 'text-[var(--danger-ink)]' : status.tone === 'ok' ? 'text-[var(--success-ink)]' : 'text-[var(--text-muted)]')}>{t(status.text, status.values)}</span> : null}
            </span>
            <ErrorBadge count={p.errorCount}/>
          </button>
        </li>;
      })}
    </ol>
    <div className="border-t border-[var(--border)] px-4 py-3">
      <div className="flex items-center justify-between text-[length:calc(10.5px*var(--fs-scale))]"><span className="text-[var(--text-muted)]">{t('Sections complete')}</span><span className="font-bold tabular-nums text-[var(--text)]">{t('{done} of {total}', {done, total})}</span></div>
      <div className="mt-2 flex gap-1" aria-hidden="true">{sections.map(section => {const state = progress[section.id]!.state;return <span key={section.id} className={cn('h-1.5 flex-1 rounded-full', state === 'complete' ? 'bg-[var(--success)]' : state === 'error' ? 'bg-[var(--danger)]' : state === 'in-progress' ? 'bg-[var(--warning)]' : 'bg-[var(--border)]')}/>;})}</div>
    </div>
  </nav>;
}

/** Horizontal status-aware tabs (Tabs layout) or chips (narrow fallback for side navigation). */
export function SectionTabs({uid, active, onSelect, progress, variant, className}: Pick<LayoutProps, 'uid' | 'active' | 'onSelect' | 'progress'> & {variant: 'tabs' | 'chips'; className?: string}) {
  const {t, direction} = useLocalization();
  const {sections}=useLayoutData();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});}, [active]);
  const index = sections.findIndex(section => section.id === active);
  const onKey = (event: React.KeyboardEvent) => {
    if (!['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const forward = (event.key === 'ArrowRight') !== (direction === 'rtl');
    const next = sections[event.key==='Home'?0:event.key==='End'?sections.length-1:(index + (forward ? 1 : -1) + sections.length) % sections.length]!;
    onSelect(next.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };
  return <div ref={ref} role="tablist" aria-label={t('Form sections')} onKeyDown={onKey} className={cn('flex overflow-x-auto', variant === 'tabs' ? 'gap-1 border-b border-[var(--border)] px-2' : 'gap-1.5 p-2', className)}>
    {sections.map(section => {
      const p = progress[section.id]!, selected = section.id === active;
      return <button key={section.id} role="tab" aria-label={`${String(section.index).padStart(2,"0")} ${t(section.short??section.title)}`} type="button" id={`${uid}-tab-${section.id}`} aria-selected={selected} aria-controls={`${uid}-panel-${section.id}`} tabIndex={selected ? 0 : -1} onClick={() => onSelect(section.id)}
        className={cn('focus-ring relative flex shrink-0 items-center gap-2 whitespace-nowrap text-[length:calc(12px*var(--fs-scale))] font-semibold transition-colors',
          variant === 'tabs' ? cn('h-12 px-3', selected ? 'text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]') : cn('h-9 rounded-full border ps-1.5 pe-3', selected ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'))}>
        <span aria-hidden="true"><StatusGlyph index={section.index} progress={p} active={selected} size="sm"/></span>
        {t(section.short ?? section.title)}
        {p.errorCount > 0 ? <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--danger-fill)] px-1 text-[length:calc(10px*var(--fs-scale))] font-bold tabular-nums text-white">{p.errorCount}<span className="sr-only"> {t('problems')}</span></span> : null}
        {variant === 'tabs' && selected ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--primary)]" aria-hidden="true"/> : null}
      </button>;
    })}
  </div>;
}
