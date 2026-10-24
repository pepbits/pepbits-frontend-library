'use client';
import React, {type ReactNode} from 'react';
import {Check} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {cn, Segmented as SharedSegmented} from '@pepbits/ui';

/** Large toggle with icon, title and description. `single` shows a radio dot, `multi` a checkbox. */
export function SelectTile({selected, onToggle, title, description, icon, kind = 'multi', size = 'md', invalid, className, id}: {
  selected: boolean; onToggle: () => void; title: string; description?: string; icon?: ReactNode; kind?: 'single' | 'multi'; size?: 'md' | 'sm'; invalid?: boolean; className?: string; id?: string;
}) {
  const {t} = useLocalization();
  return <button id={id} type="button" aria-pressed={selected} onClick={onToggle} className={cn(
    'group relative flex w-full items-start gap-3 rounded-2xl border bg-surface text-start transition-[border-color,background-color,box-shadow] duration-150', size === 'md' ? 'p-4' : 'p-3',
    selected ? 'border-scrub-600 bg-scrub-50/60 shadow-[0_0_0_1px_var(--color-scrub-600)]' : invalid ? 'border-signal/50 hover:border-signal/70' : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50/40', className)}>
    {icon && <span className={cn('flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150', size === 'md' ? 'h-10 w-10' : 'h-9 w-9', selected ? 'bg-scrub-700 text-white' : 'bg-ink-50 text-ink-600 group-hover:bg-ink-100')}>{icon}</span>}
    <span className="min-w-0 flex-1 pe-6">
      <span className={cn('block font-semibold leading-snug text-ink-900', size === 'sm' && 'text-[length:calc(0.92rem*var(--fs-scale))]')}>{t(title)}</span>
      {description && <span className={cn('mt-0.5 block leading-snug text-ink-500', size === 'md' ? 'text-sm' : 'text-[length:calc(0.8rem*var(--fs-scale))]')}>{t(description)}</span>}
    </span>
    <Indicator selected={selected} kind={kind}/>
  </button>;
}
function Indicator({selected, kind}: {selected: boolean; kind: 'single' | 'multi'}) {
  if (kind === 'single') return <span aria-hidden="true" className={cn('absolute end-3.5 top-3.5 grid h-5 w-5 place-items-center rounded-full border-2 transition-colors', selected ? 'border-scrub-700' : 'border-ink-300')}>
    <span className={cn('h-2.5 w-2.5 rounded-full bg-scrub-700 transition-transform duration-150', selected ? 'scale-100' : 'scale-0')}/>
  </span>;
  return <span aria-hidden="true" className={cn('absolute end-3.5 top-3.5 grid h-5 w-5 place-items-center rounded-md border transition-colors', selected ? 'border-scrub-700 bg-scrub-700 text-white' : 'border-ink-300 bg-surface')}>
    <Check className={cn('h-3.5 w-3.5 transition-transform duration-150', selected ? 'scale-100' : 'scale-0')} strokeWidth={3}/>
  </span>;
}

/** Compact pill; the check slides in when selected. */
export function ToggleChip({selected, onToggle, children, tag}: {selected: boolean; onToggle: () => void; children: ReactNode; tag?: string}) {
  return <button type="button" aria-pressed={selected} onClick={onToggle} className={cn('inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-150',
    selected ? 'border-scrub-700 bg-scrub-700 text-white' : 'border-ink-200 bg-surface text-ink-700 hover:border-ink-300 hover:text-ink-900')}>
    <span aria-hidden="true" className={cn('grid place-items-center overflow-hidden transition-[width,margin,opacity] duration-150', selected ? 'me-1.5 w-3.5 opacity-100' : 'me-0 w-0 opacity-0')}><Check className="h-3.5 w-3.5" strokeWidth={3}/></span>
    {children}
    {tag && <span className={cn('ms-2 rounded-full px-1.5 py-px text-[length:calc(0.68rem*var(--fs-scale))] font-semibold', selected ? 'bg-white/15 text-white' : 'bg-scrub-50 text-scrub-800')}>{tag}</span>}
  </button>;
}

/** Native checkbox with custom visual. */
export function CheckRow({id, checked, onChange, label, description, tag, invalid, className}: {
  id: string; checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; description?: ReactNode; tag?: string; invalid?: boolean; className?: string;
}) {
  const {t} = useLocalization();
  return <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150', checked ? 'bg-scrub-50' : 'hover:bg-ink-50', className)}>
    <input id={id} type="checkbox" className="peer sr-only" checked={checked} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} onChange={event => onChange(event.target.checked)}/>
    <span aria-hidden="true" className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-scrub-500 peer-focus-visible:ring-offset-2',
      checked ? 'border-scrub-700 bg-scrub-700 text-white' : invalid ? 'border-signal bg-surface' : 'border-ink-300 bg-surface')}>
      <Check className={cn('h-3.5 w-3.5 transition-transform duration-150', checked ? 'scale-100' : 'scale-0')} strokeWidth={3}/>
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex flex-wrap items-center gap-x-2 text-[length:calc(0.92rem*var(--fs-scale))] font-medium leading-snug text-ink-900">
        <span>{typeof label === 'string' ? t(label) : label}</span>
        {tag && <span className="rounded-full bg-scrub-100 px-1.5 py-px text-[length:calc(0.68rem*var(--fs-scale))] font-semibold text-scrub-800">{t(tag)}</span>}
      </span>
      {description && <span className="mt-0.5 block text-[length:calc(0.8rem*var(--fs-scale))] leading-snug text-ink-500">{typeof description === 'string' ? t(description) : description}</span>}
    </span>
  </label>;
}

/** Orvia presentation over the shared radiogroup's keyboard, focus and selection behavior. */
export function Segmented<T extends string>({value, onChange, options, label, className, size = 'md', id}: {
  value: T; onChange: (value: T) => void; options: {value: T; label: ReactNode}[]; label: string; className?: string; size?: 'sm' | 'md'; id?: string;
}) {
  const {t, direction} = useLocalization();
  const index = Math.max(0, options.findIndex(option => option.value === value));
  return <SharedSegmented id={id} label={label} value={value} onChange={next => onChange(next as T)} className={className}
    options={options.map(option => ({value: option.value, label: typeof option.label === 'string' ? option.label : option.value}))}
    renderOption={option => {const content = options.find(item => item.value === option.value)?.label; return typeof content === 'string' ? t(content) : content;}}
    style={{gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`}}
    classes={{group: 'relative grid rounded-xl bg-ink-100/80 p-1', selected: 'text-ink-900', idle: 'text-ink-600 hover:text-ink-800',
      option: cn('relative z-[1] flex min-w-0 items-center justify-center gap-1.5 rounded-[calc(var(--radius)*10/14)] px-3 font-medium transition-colors duration-150', size === 'md' ? 'h-9 text-sm' : 'h-8 text-[length:calc(0.8rem*var(--fs-scale))]')}}
    decoration={<span aria-hidden="true" className="absolute bottom-1 start-1 top-1 rounded-[calc(var(--radius)*10/14)] bg-surface shadow-[0_1px_2px_rgba(15,36,48,0.08),0_2px_8px_-2px_rgba(15,36,48,0.12)] transition-transform duration-200 ease-out"
      style={{width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${(direction === 'rtl' ? -1 : 1) * index * 100}%)`}}/>}/>;
}
