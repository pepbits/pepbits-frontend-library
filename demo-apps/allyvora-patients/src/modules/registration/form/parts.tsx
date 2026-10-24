'use client';
import React, {createContext, useContext, type ReactNode} from 'react';
import {isRequired, optionsFor, sectionDef, visibleFields, type Density, type FieldDef, type FieldErrors, type FieldValue, type FormValues, type Lookups, type SectionId, type SectionProgress} from '@allyvora/shared';
import {Input, MultiSelect, SearchSelect, Segmented, SignaturePad, Textarea, Toggle, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {Check, Info} from '@pepbits/icons';

/* One field renderer and one set of section parts for all five layouts. Field metadata, visibility and
   rules come unchanged from the shared AllyVora definition; the controls are the public @pepbits/ui ones. */

export interface FormCtx {
  uid: string;
  values: FormValues;
  errors: FieldErrors;
  lookups: Lookups;
  density: Density;
  columns: 2 | 3 | 4;
  reducedMotion: boolean;
  setValue: (id: string, value: FieldValue) => void;
  blur: (id: string) => void;
  /** Fields that can't be changed in this mode. */
  locked: Set<string>;
  readonlyText: (id: string) => {text: string; muted: boolean};
  hintFor: (id: string) => string | null;
  sectionNote: (section: SectionId) => ReactNode;
  progress: Record<SectionId, SectionProgress>;
}
const Ctx = createContext<FormCtx | null>(null);
export const FormProvider = Ctx.Provider;
export function useFormCtx(): FormCtx {
  const value = useContext(Ctx);
  if (!value) throw new Error('useFormCtx outside PatientForm');
  return value;
}

export const fieldDomId = (uid: string, fieldId: string) => `${uid}-f-${fieldId}`;
export const sectionDomId = (uid: string, section: SectionId) => `${uid}-s-${section}`;

/** Scrolls only the nearest scrollable panel, so the shell, summary band and action bar stay put. */
export function scrollWithin(element: HTMLElement, align: 'start' | 'center' = 'center', reducedMotion = false) {
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      const rect = element.getBoundingClientRect(), box = parent.getBoundingClientRect(), offset = rect.top - box.top;
      const delta = align === 'start' ? offset - 4 : offset - box.height / 2 + Math.min(rect.height, box.height) / 2;
      parent.scrollTo?.({top: parent.scrollTop + delta, behavior: reducedMotion ? 'auto' : 'smooth'});
      return;
    }
    parent = parent.parentElement;
  }
}

/** Moves focus to a field, whatever kind of control it is. */
export function focusField(uid: string, fieldId: string, reducedMotion = false) {
  const wrapper = document.getElementById(fieldDomId(uid, fieldId));
  if (!wrapper) return;
  const target = wrapper.querySelector<HTMLElement>('[role="radio"][aria-checked="true"], input:not([type="hidden"]), textarea, button, [role="img"]') ?? wrapper;
  scrollWithin(target, 'center', reducedMotion);
  target.focus?.({preventScroll: true});
}

const SPAN: Record<string, string> = {'1': '', '2': 'sm:col-span-2', full: 'col-span-full'};
export const GRID: Record<2 | 3 | 4, string> = {
  2: 'grid grid-cols-1 sm:grid-cols-2',
  3: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
};
const digitsOnly = (text: string, separators = false) => text.replace(separators ? /[^\d\s-]/g : /\D/g, '');

export function FieldRenderer({field: f}: {field: FieldDef}) {
  const ctx = useFormCtx(), {t} = useLocalization();
  const {values, lookups, uid} = ctx;
  const error = ctx.errors[f.id];
  const required = isRequired(f, values);
  const hint = ctx.hintFor(f.id) ?? f.help ?? undefined;
  const value = values[f.id];
  const set = (next: FieldValue) => ctx.setValue(f.id, next);
  const label = f.label, disabled = ctx.locked.has(f.id);
  const errorText = error ?? undefined;
  let control: ReactNode;
  switch (f.type) {
    case 'switch':
      control = <div className={cn('rounded-[var(--radius)]', error && 'ring-1 ring-[var(--danger)]')}>
        <Toggle label={required ? `${t(label)} *` : label} checked={value === true} onChange={checked => {set(checked); ctx.blur(f.id);}} disabled={disabled}/>
        {error ? <span className="mt-1 block text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</span> : hint ? <span className="mt-1 block text-[length:calc(10px*var(--fs-scale))] text-[var(--text-subtle)]">{t(hint)}</span> : null}
      </div>;
      break;
    case 'select':
    case 'segmented': {
      const options = optionsFor(f, values, lookups).map(option => ({value: option.code, label: option.label, ...(option.hint ? {description: option.hint} : {})}));
      if (f.type === 'segmented' && options.length <= 5) {
        control = <div>
          <span className="mb-1.5 flex items-center gap-1 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]" aria-hidden="true">{t(label)}{required ? <span className="text-[var(--danger-ink)]">*</span> : null}</span>
          <Segmented label={required ? t('{label} (required)', {label: t(label)}) : label} options={options.map(option => ({...option, disabled}))} value={typeof value === 'string' ? value : ''} onChange={next => {set(next); ctx.blur(f.id);}} size={ctx.density === 'compact' ? 'sm' : 'md'} className={cn('flex w-full flex-wrap [&>button]:flex-1', error && 'border-[var(--danger)]')}/>
          {error ? <span className="mt-1 block text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">{t(error)}</span> : hint ? <span className="mt-1 block text-[length:calc(10px*var(--fs-scale))] text-[var(--text-subtle)]">{t(hint)}</span> : null}
        </div>;
      } else {
        const choices = !required && value ? [{value: '', label: 'Not recorded'}, ...options] : options;
        control = <SearchSelect label={label} required={required} error={errorText} hint={hint} options={choices} value={value === null || value === undefined ? '' : String(value)} onChange={next => set(next === '' ? null : next)} placeholder="Type or choose" disabled={disabled} quickPick/>;
      }
      break;
    }
    case 'multiselect': {
      const options = optionsFor(f, values, lookups).map(option => ({value: option.code, label: option.label}));
      control = <MultiSelect label={label} required={required} error={errorText} hint={hint} options={options} value={Array.isArray(value) ? value : []} onChange={next => set(next)} placeholder="Type to add" disabled={disabled}/>;
      break;
    }
    case 'textarea':
      control = <Textarea label={label} required={required} error={errorText} hint={hint} rows={ctx.density === 'compact' ? 2 : 3} maxLength={f.maxLength} placeholder={f.placeholder} value={typeof value === 'string' ? value : ''} onChange={event => set(event.target.value)} onBlur={() => ctx.blur(f.id)} disabled={disabled}/>;
      break;
    case 'readonly': {
      const text = ctx.readonlyText(f.id);
      control = <Input label={label} hint={hint} readOnly value={text.text} className={cn(text.muted && '[&_input]:text-[var(--text-subtle)]')} aria-readonly="true"/>;
      break;
    }
    case 'signature':
      control = <SignaturePad label={label} required={required} error={errorText} hint={hint} value={typeof value === 'string' ? value : null} onChange={next => set(next)} onBlur={() => ctx.blur(f.id)} placeholder="Patient signs here" disabled={disabled}/>;
      break;
    default: {
      const isDigits = f.type === 'tel' || f.type === 'number';
      control = <Input label={label} required={required} error={errorText} hint={hint}
        type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
        inputMode={f.inputMode} autoComplete={f.autoComplete ?? 'off'} maxLength={f.type === 'date' ? undefined : f.maxLength}
        placeholder={f.placeholder} prefix={f.prefix} disabled={disabled}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={event => {
          let text = event.target.value;
          if (isDigits) text = digitsOnly(text);
          else if (f.inputMode === 'numeric') text = digitsOnly(text, true);
          if (f.uppercase) text = text.toUpperCase();
          set(text);
        }}
        onBlur={() => ctx.blur(f.id)}
        className={cn((isDigits || f.type === 'date') && '[&_input]:tabular-nums')}/>;
    }
  }
  return <div id={fieldDomId(uid, f.id)} data-field={f.id} className={cn('min-w-0', SPAN[String(f.span ?? 1)], f.type === 'switch' && 'self-end')}
    onBlur={event => {if (['select', 'segmented', 'multiselect'].includes(f.type) && !event.currentTarget.contains(event.relatedTarget as Node | null)) ctx.blur(f.id);}}>
    {control}
  </div>;
}

export function SectionBody({section}: {section: SectionId}) {
  const ctx = useFormCtx(), {t} = useLocalization();
  const fields = visibleFields(section, ctx.values);
  const groups: {name?: string; fields: FieldDef[]}[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (!last || last.name !== f.group) groups.push({name: f.group, fields: [f]});
    else last.fields.push(f);
  }
  const headings = groups.length > 1, compact = ctx.density === 'compact', note = ctx.sectionNote(section);
  return <div className={compact ? 'space-y-4' : 'space-y-6'}>
    {note ? <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-[var(--primary-soft)] px-3.5 py-2.5 text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text)]"><Info className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true"/><div className="min-w-0">{note}</div></div> : null}
    {groups.map((group, index) => <div key={`${group.name ?? 'group'}-${index}`} role={headings && group.name ? 'group' : undefined} aria-label={headings && group.name ? t(group.name) : undefined}>
      {headings && group.name ? <div className="mb-3 flex items-center gap-3"><h3 className="shrink-0 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{t(group.name)}</h3><span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true"/></div> : null}
      <div className={cn(GRID[ctx.columns], compact ? 'gap-x-4 gap-y-3' : 'gap-x-5 gap-y-4')}>{group.fields.map(field => <FieldRenderer key={field.id} field={field}/>)}</div>
    </div>)}
  </div>;
}

export function statusText(progress: SectionProgress): {text: string; values?: Record<string, number>; tone: 'ok' | 'danger' | 'accent' | 'muted'} {
  if (progress.state === 'error') return {text: '{count} to fix', values: {count: progress.errorCount}, tone: 'danger'};
  if (progress.state === 'complete') return {text: 'Complete', tone: 'ok'};
  if (progress.optional) return {text: 'Optional', tone: 'muted'};
  return {text: '{done} of {total} required', values: {done: progress.requiredDone, total: progress.requiredTotal}, tone: progress.requiredDone ? 'accent' : 'muted'};
}

export function StatusGlyph({index, progress, active, size = 'md'}: {index: number; progress: SectionProgress; active?: boolean; size?: 'sm' | 'md'}) {
  const {t} = useLocalization();
  const state = progress.state, dimension = size === 'sm' ? 'size-6 text-[length:calc(10px*var(--fs-scale))]' : 'size-7 text-[length:calc(11px*var(--fs-scale))]';
  const base = cn(dimension, 'flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums');
  if (state === 'complete') return <span className={cn(base, 'bg-[var(--success-fill)] text-white', active && 'ring-2 ring-[var(--success)] ring-offset-2 ring-offset-[var(--surface)]')}><Check className="size-3.5" strokeWidth={3} aria-hidden="true"/><span className="sr-only">{t('Complete')}</span></span>;
  if (state === 'error') return <span className={cn(base, 'bg-[var(--danger-fill)] text-white', active && 'ring-2 ring-[var(--danger)] ring-offset-2 ring-offset-[var(--surface)]')}>!<span className="sr-only">{t('Has problems')}</span></span>;
  if (active) return <span className={cn(base, 'bg-[var(--primary-fill)] text-white')}>{index}</span>;
  if (state === 'in-progress') {
    const portion = progress.requiredTotal ? progress.requiredDone / progress.requiredTotal : 0.5;
    return <span className={cn(base, 'relative text-[var(--warning-ink)]')} style={{background: `conic-gradient(var(--warning) ${portion * 360}deg, var(--border) 0)`}}>
      <span className="absolute inset-[2.5px] rounded-full bg-[var(--surface)]" aria-hidden="true"/><span className="relative">{index}</span>
    </span>;
  }
  return <span className={cn(base, 'border border-[var(--border-strong)] text-[var(--text-muted)]')}>{index}</span>;
}

export function StatusPill({progress}: {progress: SectionProgress}) {
  const {t} = useLocalization();
  const {text, values, tone} = statusText(progress);
  return <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[length:calc(10.5px*var(--fs-scale))] font-semibold tabular-nums',
    tone === 'ok' && 'bg-[color-mix(in_srgb,var(--success)_14%,var(--surface))] text-[var(--success-ink)]',
    tone === 'danger' && 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger-ink)]',
    tone === 'accent' && 'bg-[color-mix(in_srgb,var(--warning)_16%,var(--surface))] text-[var(--warning-ink)]',
    tone === 'muted' && 'bg-[var(--surface-2)] text-[var(--text-muted)]')}>{t(text, values)}</span>;
}

/** The section card used by every layout. */
export function SectionPanel({section, active, className}: {section: SectionId; active?: boolean; className?: string}) {
  const ctx = useFormCtx(), {t} = useLocalization();
  const def = sectionDef(section), progress = ctx.progress[section], compact = ctx.density === 'compact', domId = sectionDomId(ctx.uid, section);
  return <section id={domId} aria-labelledby={`${domId}-t`} data-section={section} className={cn('scroll-mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]', className)}>
    <header className={cn('flex items-center gap-3 border-b border-[var(--border)]', compact ? 'px-4 py-2.5' : 'px-5 py-3.5')}>
      <StatusGlyph index={def.index} progress={progress} active={active}/>
      <div className="min-w-0 flex-1">
        <h2 id={`${domId}-t`} className="truncate text-[length:calc(14px*var(--fs-scale))] font-bold text-[var(--text)]">{t(def.title)}</h2>
        {!compact ? <p className="truncate text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(def.description)}</p> : null}
      </div>
      <StatusPill progress={progress}/>
    </header>
    <div className={compact ? 'p-4' : 'p-5'}><SectionBody section={section}/></div>
  </section>;
}
