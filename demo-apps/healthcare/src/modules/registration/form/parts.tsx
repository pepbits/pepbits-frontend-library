'use client';
import React, {createContext, useContext, type ReactNode} from 'react';
import {isRequired, optionsFor, visibleFields, type FieldDef, type FieldErrors, type FieldValue, type FormValues, type Lookups, type SectionId, type SectionProgress} from '@allyvora/shared';
import {Input, MultiSelect, SearchSelect, Segmented, SignaturePad, Textarea, Toggle, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {Density} from '@pepbits/preferences';
import {Info} from '@pepbits/icons';

import {scrollWithin} from '@pepbits/page-engines/record-layout';
export {scrollWithin,sectionDomId} from '@pepbits/page-engines/record-layout';
export {StatusGlyph,StatusPill,statusText} from '@pepbits/patterns/record-form';

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
  return <div className={compact ? 'space-y-4' : ctx.density==='spacious'?'space-y-8':'space-y-6'}>
    {note ? <div className="flex items-start gap-2.5 rounded-[var(--radius)] bg-[var(--primary-soft)] px-3.5 py-2.5 text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text)]"><Info className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" aria-hidden="true"/><div className="min-w-0">{note}</div></div> : null}
    {groups.map((group, index) => <div key={`${group.name ?? 'group'}-${index}`} role={headings && group.name ? 'group' : undefined} aria-label={headings && group.name ? t(group.name) : undefined}>
      {headings && group.name ? <div className="mb-3 flex items-center gap-3"><h3 className="shrink-0 text-[length:calc(11px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{t(group.name)}</h3><span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true"/></div> : null}
      <div className={cn(GRID[ctx.columns], compact ? 'gap-x-4 gap-y-3' : ctx.density==='spacious'?'gap-x-6 gap-y-6':'gap-x-5 gap-y-4')}>{group.fields.map(field => <FieldRenderer key={field.id} field={field}/>)}</div>
    </div>)}
  </div>;
}
