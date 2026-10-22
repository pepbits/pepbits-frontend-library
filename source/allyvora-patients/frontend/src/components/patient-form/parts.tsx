'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';
import {
  isRequired,
  optionsFor,
  sectionDef,
  visibleFields,
  type Density,
  type FieldDef,
  type FieldErrors,
  type FieldValue,
  type FormValues,
  type Lookups,
  type SectionId,
  type SectionProgress,
} from '@allyvora/shared';
import { cn } from '@/lib/cn';
import { Combobox } from '@/components/form/Combobox';
import { ReadonlyValue, Segmented, SignaturePad, Switch, TextArea, TextInput } from '@/components/form/Controls';

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface FormCtx {
  uid: string;
  values: FormValues;
  errors: FieldErrors;
  lookups: Lookups;
  density: Density;
  columns: 2 | 3 | 4;
  setValue: (id: string, v: FieldValue) => void;
  blur: (id: string) => void;
  /** Fields that can't be changed in this mode. */
  locked: Set<string>;
  readonlyText: (id: string) => { text: string; muted: boolean };
  hintFor: (id: string) => string | null;
  sectionNote: (s: SectionId) => ReactNode;
  progress: Record<SectionId, SectionProgress>;
}

const Ctx = createContext<FormCtx | null>(null);
export const FormProvider = Ctx.Provider;

export function useFormCtx(): FormCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFormCtx outside PatientForm');
  return v;
}

export const fieldDomId = (uid: string, fieldId: string) => `${uid}-f-${fieldId}`;
export const sectionDomId = (uid: string, s: SectionId) => `${uid}-s-${s}`;

/**
 * Scrolls only the nearest scrollable panel, never the whole page, so the
 * header, patient band and action bar stay where they are.
 */
export function scrollWithin(el: HTMLElement, align: 'start' | 'center' | 'nearest' = 'center') {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
      const r = el.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const offset = r.top - pr.top;
      if (align === 'nearest' && offset >= 0 && r.bottom <= pr.bottom) return;
      const target =
        align === 'start' ? offset - 4 : align === 'center' ? offset - pr.height / 2 + Math.min(r.height, pr.height) / 2 : offset < 0 ? offset - 8 : r.bottom - pr.bottom + 8;
      p.scrollTo({ top: p.scrollTop + target, behavior: 'smooth' });
      return;
    }
    p = p.parentElement;
  }
}

/** Moves focus to a field, whatever kind of control it is. */
export function focusField(uid: string, fieldId: string) {
  const el = document.getElementById(fieldDomId(uid, fieldId));
  if (!el) return;
  const target = el.matches('input, textarea, button')
    ? el
    : (el.querySelector<HTMLElement>('[aria-checked="true"], input, textarea, button, canvas') ?? el);
  scrollWithin(target as HTMLElement, 'center');
  (target as HTMLElement).focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

const SPAN: Record<string, string> = { '1': '', '2': 'sm:col-span-2', full: 'col-span-full' };
export const GRID: Record<2 | 3 | 4, string> = {
  2: 'grid grid-cols-1 sm:grid-cols-2',
  3: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
};

function digitsOnly(s: string, allowSeparators = false) {
  return s.replace(allowSeparators ? /[^\d\s-]/g : /\D/g, '');
}

export function FieldRenderer({ field: f }: { field: FieldDef }) {
  const ctx = useFormCtx();
  const { values, lookups, uid } = ctx;
  const id = fieldDomId(uid, f.id);
  const labelId = `${id}-label`;
  const msgId = `${id}-msg`;
  const error = ctx.errors[f.id];
  const required = isRequired(f, values);
  const hint = ctx.hintFor(f.id) ?? f.help ?? null;
  const compact = ctx.density === 'compact';
  const v = values[f.id];
  const describedBy = error || hint ? msgId : undefined;
  const set = (val: FieldValue) => ctx.setValue(f.id, val);
  const blur = () => ctx.blur(f.id);

  const message = error ? (
    <p id={msgId} className="mt-1 flex items-start gap-1 text-xs font-medium text-danger">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
      {error}
    </p>
  ) : hint ? (
    <p id={msgId} className="mt-1 text-xs text-ink-3">
      {hint}
    </p>
  ) : null;

  const wrapClass = cn('min-w-0', SPAN[String(f.span ?? 1)], f.visibleWhen && 'animate-field-in');

  if (f.type === 'switch') {
    return (
      <div className={wrapClass}>
        <div
          className={cn(
            'flex items-start gap-3 rounded-lg border px-3 transition-colors',
            compact ? 'py-2' : 'py-2.5',
            error ? 'border-danger bg-danger-soft/40' : v === true ? 'border-brand/30 bg-brand-soft/40' : 'border-line',
          )}
        >
          <Switch id={id} checked={v === true} onChange={(c) => { set(c); blur(); }} describedBy={describedBy} invalid={!!error} />
          <label htmlFor={id} id={labelId} className="-mt-px cursor-pointer text-[13.5px] leading-5 text-ink">
            {f.label}
            {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
          </label>
        </div>
        {message}
      </div>
    );
  }

  let control: ReactNode;
  switch (f.type) {
    case 'select':
    case 'multiselect':
      control = (
        <Combobox
          id={id}
          options={optionsFor(f, values, lookups)}
          value={v as string | string[] | null}
          multiple={f.type === 'multiselect'}
          onChange={set}
          onBlur={blur}
          invalid={!!error}
          describedBy={describedBy}
          compact={compact}
          placeholder={f.type === 'multiselect' ? 'Type to add' : undefined}
          disabled={ctx.locked.has(f.id)}
        />
      );
      break;
    case 'segmented': {
      const options = optionsFor(f, values, lookups);
      control =
        options.length > 5 ? (
          <Combobox id={id} options={options} value={v as string} onChange={set} onBlur={blur} invalid={!!error} describedBy={describedBy} compact={compact} />
        ) : (
          <Segmented
            id={id}
            labelId={labelId}
            options={options}
            value={v as string}
            onChange={(c) => {
              set(c);
              blur();
            }}
            invalid={!!error}
            compact={compact}
            allowDeselect={!required}
            describedBy={describedBy}
          />
        );
      break;
    }
    case 'textarea':
      control = (
        <TextArea
          id={id}
          value={(v as string) ?? ''}
          maxLength={f.maxLength}
          onChange={(e) => set(e.target.value)}
          onBlur={blur}
          invalid={!!error}
          aria-describedby={describedBy}
          compact={compact}
          placeholder={f.placeholder}
        />
      );
      break;
    case 'readonly': {
      const r = ctx.readonlyText(f.id);
      control = <ReadonlyValue id={id} text={r.text} muted={r.muted} compact={compact} />;
      break;
    }
    case 'signature':
      control = <SignaturePad id={id} value={v as string} onChange={(s) => { set(s); blur(); }} invalid={!!error} describedBy={describedBy} />;
      break;
    default: {
      const isDigits = f.type === 'tel' || f.type === 'number';
      control = (
        <TextInput
          id={id}
          type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
          inputMode={f.inputMode}
          autoComplete={f.autoComplete ?? 'off'}
          maxLength={f.type === 'date' ? undefined : f.maxLength}
          placeholder={f.placeholder}
          prefix={f.prefix}
          value={v === null || v === undefined ? '' : String(v)}
          onChange={(e) => {
            let s = e.target.value;
            if (isDigits) s = digitsOnly(s);
            else if (f.inputMode === 'numeric') s = digitsOnly(s, true);
            if (f.uppercase) s = s.toUpperCase();
            set(s);
          }}
          onBlur={blur}
          invalid={!!error}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          compact={compact}
          className={cn((isDigits || f.type === 'date') && 'tabular')}
        />
      );
    }
  }

  return (
    <div className={wrapClass}>
      <label id={labelId} htmlFor={f.type === 'segmented' || f.type === 'signature' || f.type === 'readonly' ? undefined : id} className="mb-1.5 flex items-baseline gap-1 text-[13px] font-medium text-ink">
        <span className="truncate">{f.label}</span>
        {required && <span className="text-danger" aria-hidden>*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {control}
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export function SectionBody({ section }: { section: SectionId }) {
  const ctx = useFormCtx();
  const fields = visibleFields(section, ctx.values);
  const groups: { name?: string; fields: FieldDef[] }[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (!last || last.name !== f.group) groups.push({ name: f.group, fields: [f] });
    else last.fields.push(f);
  }
  const headings = groups.length > 1;
  const gap = ctx.density === 'compact' ? 'gap-x-4 gap-y-3' : 'gap-x-5 gap-y-4';
  const note = ctx.sectionNote(section);

  return (
    <div className={ctx.density === 'compact' ? 'space-y-4' : 'space-y-6'}>
      {note && (
        <div className="flex items-start gap-2.5 rounded-lg bg-brand-soft/60 px-3.5 py-2.5 text-[13px] text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0">{note}</div>
        </div>
      )}
      {groups.map((g, i) => (
        <div key={`${g.name ?? 'g'}-${i}`} role={headings && g.name ? 'group' : undefined} aria-label={headings ? g.name : undefined}>
          {headings && g.name && (
            <div className="mb-3 flex items-center gap-3">
              <h3 className="shrink-0 text-[12.5px] font-semibold text-ink-2">{g.name}</h3>
              <span className="h-px flex-1 bg-line" aria-hidden />
            </div>
          )}
          <div className={cn(GRID[ctx.columns], gap)}>
            {g.fields.map((f) => (
              <FieldRenderer key={f.id} field={f} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusGlyph({ index, progress, active, size = 'md' }: { index: number; progress: SectionProgress; active?: boolean; size?: 'sm' | 'md' }) {
  const s = progress.state;
  const dim = size === 'sm' ? 'size-6 text-[11px]' : 'size-7 text-xs';
  if (s === 'complete')
    return (
      <span className={cn(dim, 'flex shrink-0 items-center justify-center rounded-full bg-ok text-white', active && 'ring-2 ring-ok/30 ring-offset-2 ring-offset-surface')}>
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        <span className="sr-only">Complete</span>
      </span>
    );
  if (s === 'error')
    return (
      <span className={cn(dim, 'tabular flex shrink-0 items-center justify-center rounded-full bg-danger font-semibold text-white', active && 'ring-2 ring-danger/30 ring-offset-2 ring-offset-surface')}>
        !<span className="sr-only">Has problems</span>
      </span>
    );
  if (active)
    return <span className={cn(dim, 'tabular flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-ink')}>{index}</span>;
  if (s === 'in-progress') {
    const pct = progress.requiredTotal ? progress.requiredDone / progress.requiredTotal : 0.5;
    return (
      <span
        className={cn(dim, 'tabular relative flex shrink-0 items-center justify-center rounded-full font-semibold text-accent-ink')}
        style={{ background: `conic-gradient(rgb(var(--accent)) ${pct * 360}deg, rgb(var(--line)) 0)` }}
      >
        <span className="absolute inset-[2.5px] rounded-full bg-surface" aria-hidden />
        <span className="relative">{index}</span>
      </span>
    );
  }
  return <span className={cn(dim, 'tabular flex shrink-0 items-center justify-center rounded-full border border-line-strong font-semibold text-ink-3')}>{index}</span>;
}

export function statusText(p: SectionProgress): { text: string; tone: 'ok' | 'danger' | 'accent' | 'muted' } {
  if (p.state === 'error') return { text: `${p.errorCount} to fix`, tone: 'danger' };
  if (p.state === 'complete') return { text: 'Complete', tone: 'ok' };
  if (p.optional) return { text: 'Optional', tone: 'muted' };
  return { text: `${p.requiredDone} of ${p.requiredTotal} required`, tone: p.requiredDone ? 'accent' : 'muted' };
}

export function StatusPill({ progress }: { progress: SectionProgress }) {
  const { text, tone } = statusText(progress);
  return (
    <span
      className={cn(
        'tabular inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium',
        tone === 'ok' && 'bg-ok-soft text-ok',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'accent' && 'bg-accent-soft text-accent-ink',
        tone === 'muted' && 'bg-sunken text-ink-3',
      )}
    >
      {text}
    </span>
  );
}

/** The section card used by every layout. */
export function SectionPanel({ section, active, className }: { section: SectionId; active?: boolean; className?: string }) {
  const ctx = useFormCtx();
  const def = sectionDef(section);
  const p = ctx.progress[section];
  const compact = ctx.density === 'compact';
  const domId = sectionDomId(ctx.uid, section);
  return (
    <section id={domId} aria-labelledby={`${domId}-t`} data-section={section} className={cn('scroll-mt-3 rounded-2xl border border-line bg-surface', className)}>
      <header className={cn('flex items-center gap-3 border-b border-line', compact ? 'px-4 py-2.5' : 'px-5 py-3.5')}>
        <StatusGlyph index={def.index} progress={p} active={active} />
        <div className="min-w-0 flex-1">
          <h2 id={`${domId}-t`} className="truncate text-[15px] font-semibold text-ink">
            {def.title}
          </h2>
          {!compact && <p className="truncate text-[13px] text-ink-2">{def.description}</p>}
        </div>
        <StatusPill progress={p} />
      </header>
      <div className={compact ? 'p-4' : 'p-5'}>
        <SectionBody section={section} />
      </div>
    </section>
  );
}
