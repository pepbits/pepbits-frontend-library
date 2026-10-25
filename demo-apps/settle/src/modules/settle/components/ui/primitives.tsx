'use client';

import clsx from 'clsx';
import {Loader2} from '@pepbits/icons';
import {createContext, useContext, useId} from 'react';
import {SourceButton, SourceInput, SourceSelect, SourceTextarea} from '@pepbits/ui';
import {Table} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {STATUS, useFormat} from '../../lib/format';
import type {BillStatus} from '../../lib/types';

/* Source design primitives composed over the shared native-layout controls (Source*), so labels,
   placeholders and accessible names pass through the host translator. Appearance tokens map to the
   host theme in settle.css. */
const T = ({children}: {children: React.ReactNode}) => {const {t} = useLocalization(); return <>{typeof children === 'string' ? t(children) : children}</>;};

/* ---------------------------------------------------------------- Button */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'due' | 'quiet';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-800 disabled:bg-pine-200',
  secondary: 'bg-panel text-ink border border-line hover:border-line-strong hover:bg-mist active:bg-mist-2 disabled:text-ink-mute',
  ghost: 'text-ink-soft hover:bg-mist hover:text-ink disabled:text-ink-mute',
  quiet: 'text-pine-700 hover:bg-pine-50 disabled:text-ink-mute',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-100',
  due: 'bg-marigold-500 text-ink hover:bg-marigold-300 disabled:bg-marigold-100 disabled:text-ink-mute',
};

export interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  kbd?: string;
}

export function Button({variant = 'secondary', size = 'md', loading, icon, kbd, className, children, disabled, type = 'button', ...rest}: ButtonProps) {
  return (
    <SourceButton
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' && 'h-8 px-2.5 text-[length:calc(13px*var(--fs-scale,1))]',
        size === 'md' && 'h-9 px-3.5 text-[length:calc(14px*var(--fs-scale,1))]',
        size === 'lg' && 'h-11 px-5 text-[length:calc(15px*var(--fs-scale,1))]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {typeof children === 'string' ? <T>{children}</T> : children}
      {kbd && <Kbd inverse={variant === 'primary' || variant === 'danger'}>{kbd}</Kbd>}
    </SourceButton>
  );
}

export function IconButton({label, className, children, ...rest}: React.ComponentPropsWithRef<'button'> & {label: string}) {
  const {t} = useLocalization();
  return (
    <SourceButton
      aria-label={label}
      title={t(label)}
      className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </SourceButton>
  );
}

/** Keyboard hints follow the effective `showKeyboardHints` and `keyboardShortcuts` preferences. */
export function Kbd({children, className, inverse}: {children: React.ReactNode; className?: string; inverse?: boolean}) {
  const {preferences} = usePreferences();
  if (preferences.showKeyboardHints === false || preferences.keyboardShortcuts === false) return null;
  return (
    // The key is drawn with CSS content so it never becomes part of a control's accessible name.
    <kbd aria-hidden data-key={String(children)} className={clsx("hidden min-w-[20px] items-center justify-center rounded border px-1 text-[length:calc(11px*var(--fs-scale,1))] font-medium leading-[18px] before:content-[attr(data-key)] sm:inline-flex",
      inverse ? 'border-white/40 text-white' : 'border-line bg-mist text-ink-soft', className)} />
  );
}

/* ---------------------------------------------------------------- Badges */
export type Tone = 'pine' | 'sky' | 'indigo' | 'rose' | 'marigold' | 'gray';
const TONES: Record<Tone, string> = {
  pine: 'bg-pine-50 text-pine-700',
  sky: 'bg-sky-50 text-sky-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  rose: 'bg-rose-50 text-rose-700',
  marigold: 'bg-marigold-50 text-marigold-800',
  gray: 'bg-mist-2 text-ink-soft',
};
export function Badge({tone = 'gray', children, className, dot}: {tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean}) {
  return (
    <span className={clsx('chip', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {typeof children === 'string' ? <T>{children}</T> : children}
    </span>
  );
}
export function StatusBadge({status, className}: {status: BillStatus; className?: string}) {
  const s = STATUS[status];
  return <Badge tone={s.tone} dot className={className}>{s.label}</Badge>;
}

/* ---------------------------------------------------------------- Money */
export function Money({value, className, sign, tone = 'auto', whole}: {value: number; className?: string; sign?: boolean; tone?: 'auto' | 'plain' | 'due'; whole?: boolean}) {
  const {money} = useFormat();
  const neg = value < -0.004;
  return (
    <span className={clsx('tabular-nums whitespace-nowrap', tone === 'auto' && neg && 'text-rose-600', tone === 'due' && value > 0.004 && 'text-marigold-800 font-semibold', className)}>
      {money(value, {sign, whole})}
    </span>
  );
}

/* ---------------------------------------------------------------- Fields */
export function Field({label, hint, error, children, className, htmlFor, optional}: {
  label: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string; optional?: boolean;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div className={clsx('flex flex-col gap-1.5', className)} data-field-id={id}>
      <label htmlFor={id} className="label flex items-center justify-between">
        <span><T>{label}</T></span>
        {optional && <span className="font-normal text-ink-mute"><T>Optional</T></span>}
      </label>
      <FieldIdContext id={id}>{children}</FieldIdContext>
      {error ? <p className="text-[length:calc(12px*var(--fs-scale,1))] text-rose-600" role="alert"><T>{error}</T></p> : hint ? <p className="text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{typeof hint === 'string' ? <T>{hint}</T> : hint}</p> : null}
    </div>
  );
}
const FieldId = createContext<string | undefined>(undefined);
function FieldIdContext({id, children}: {id: string; children: React.ReactNode}) {return <FieldId.Provider value={id}>{children}</FieldId.Provider>;}
/** Controls inside a Field take its id so the label names them. A nested control claims it once. */
function useFieldId(id?: string) {const field = useContext(FieldId); return id ?? field;}
function ReleaseFieldId({children}: {children: React.ReactNode}) {return <FieldId.Provider value={undefined}>{children}</FieldId.Provider>;}

export function Input({className, id, ...rest}: React.ComponentPropsWithRef<'input'>) {
  return <SourceInput id={useFieldId(id)} className={clsx('input', className)} {...rest} />;
}

export function Select({className, children, id, ...rest}: React.ComponentPropsWithRef<'select'>) {
  return (
    <SourceSelect id={useFieldId(id)} className={clsx('input settle-select appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pe-8', className)} {...rest}>
      {children}
    </SourceSelect>
  );
}

export function Textarea({id, ...props}: React.ComponentPropsWithRef<'textarea'>) {
  return <SourceTextarea rows={3} id={useFieldId(id)} {...props} className={clsx('input', props.className)} />;
}

/** Amount entry keeps a plain decimal machine value; the currency hint follows the host preference. */
export function MoneyInput({value, onChange, className, autoFocus, id, placeholder, invalid, 'aria-label': ariaLabel}: {
  value: string; onChange: (v: string) => void; className?: string; autoFocus?: boolean; id?: string; placeholder?: string; invalid?: boolean; 'aria-label'?: string;
}) {
  const {currencyCode} = useFormat();
  const fieldId = useFieldId(id);
  return (
    <div className={clsx('relative', className)}>
      <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute" aria-hidden>{currencyCode}</span>
      <SourceInput
        id={fieldId}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder={placeholder || '0.00'}
        value={value}
        aria-label={fieldId ? undefined : ariaLabel ?? 'Amount'}
        aria-invalid={invalid || undefined}
        onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        className={clsx('input ps-12 text-end font-medium tabular-nums', invalid && 'border-rose-500 focus:ring-rose-100')}
      />
    </div>
  );
}

export function Checkbox({checked, onChange, label, className, indeterminate, disabled, 'aria-label': ariaLabel}: {
  checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string; indeterminate?: boolean; disabled?: boolean; 'aria-label'?: string;
}) {
  const id = useId();
  return (
    <ReleaseFieldId>
      <label htmlFor={id} className={clsx('inline-flex cursor-pointer items-center gap-2 text-[length:calc(14px*var(--fs-scale,1))]', disabled && 'cursor-not-allowed text-ink-mute', className)}>
        <SourceInput
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          ref={el => {if (el) el.indeterminate = !!indeterminate;}}
          onChange={e => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-line-strong accent-[var(--settle-pine-600)]"
        />
        {typeof label === 'string' ? <T>{label}</T> : label}
      </label>
    </ReleaseFieldId>
  );
}

export function Toggle({checked, onChange, label, disabled}: {checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean}) {
  return (
    <SourceButton
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-pine-600' : 'bg-line-strong')}
    >
      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px] rtl:-translate-x-[18px]' : 'translate-x-0.5 rtl:-translate-x-0.5')} />
    </SourceButton>
  );
}

/* ---------------------------------------------------------------- Segmented & Tabs */
export function Segmented<T extends string>({value, onChange, options, size = 'md', className, 'aria-label': ariaLabel}: {
  value: T; onChange: (v: T) => void; options: {value: T; label: React.ReactNode; count?: number}[]; size?: 'sm' | 'md'; className?: string; 'aria-label'?: string;
}) {
  const {t} = useLocalization();
  return (
    <div role="radiogroup" aria-label={ariaLabel ? t(ariaLabel) : undefined} className={clsx('inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-mist p-0.5', className)}>
      {options.map(o => (
        <SourceButton
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-[length:calc(12.5px*var(--fs-scale,1))]' : 'h-8 px-3 text-[length:calc(13px*var(--fs-scale,1))]',
            value === o.value ? 'bg-panel text-ink shadow-hair ring-1 ring-line' : 'text-ink-soft hover:text-ink',
          )}
        >
          {typeof o.label === 'string' ? <T>{o.label}</T> : o.label}
          {o.count !== undefined && <span className={clsx('text-[length:calc(11px*var(--fs-scale,1))]', value === o.value ? 'text-pine-600' : 'text-ink-mute')}>{o.count}</span>}
        </SourceButton>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({value, onChange, tabs, className, right, label = 'Sections'}: {
  value: T; onChange: (v: T) => void; tabs: {value: T; label: React.ReactNode; count?: number | null; hidden?: boolean}[];
  className?: string; right?: React.ReactNode; label?: string;
}) {
  const {t} = useLocalization();
  const visible = tabs.filter(tab => !tab.hidden);
  const move = (event: React.KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = visible[(next + visible.length) % visible.length]!;
    onChange(target.value);
    (event.currentTarget.parentElement?.querySelector(`[data-tab="${target.value}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className={clsx('flex items-end justify-between gap-4 border-b border-line', className)}>
      <div role="tablist" aria-label={t(label)} className="-mb-px flex gap-1 overflow-x-auto">
        {visible.map((tab, index) => (
          <SourceButton
            key={tab.value}
            role="tab"
            type="button"
            data-tab={tab.value}
            aria-selected={value === tab.value}
            tabIndex={value === tab.value ? 0 : -1}
            onKeyDown={event => move(event, index)}
            onClick={() => onChange(tab.value)}
            className={clsx(
              'inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[length:calc(14px*var(--fs-scale,1))] font-medium transition-colors',
              value === tab.value ? 'border-pine-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            {typeof tab.label === 'string' ? <T>{tab.label}</T> : tab.label}
            {tab.count ? <span className={clsx('chip px-1.5', value === tab.value ? 'bg-pine-50 text-pine-700' : 'bg-mist-2 text-ink-soft')}>{tab.count}</span> : null}
          </SourceButton>
        ))}
      </div>
      {right && <div className="pb-1.5">{right}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- States */
export function Empty({icon, title, body, action, className}: {icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-pine-50 text-pine-600" aria-hidden>{icon}</div>}
      <p className="text-[length:calc(15px*var(--fs-scale,1))] font-medium text-ink"><T>{title}</T></p>
      {body && <p className="max-w-sm text-[length:calc(13.5px*var(--fs-scale,1))] text-ink-soft">{typeof body === 'string' ? <T>{body}</T> : body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Loading placeholders follow the effective `loadingSkeletons` preference; motion follows reduced-motion. */
export function Skeleton({className}: {className?: string}) {
  const {preferences} = usePreferences();
  if (preferences.loadingSkeletons === false) return <div data-skeleton className={clsx('rounded-md', className)} aria-hidden />;
  return <div data-skeleton className={clsx('rounded-md bg-mist-2', !preferences.reducedMotion && 'animate-pulse', className)} aria-hidden />;
}

export function ErrorNote({error, onRetry}: {error: {message: string} | null; onRetry?: () => void}) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-[length:calc(13.5px*var(--fs-scale,1))] text-rose-700">
      <span>{error.message}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function PageHeader({title, sub, actions, children}: {title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode}) {
  return (
    <div className="flex flex-col gap-3 pb-4 pt-1 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[length:calc(22px*var(--fs-scale,1))] font-semibold leading-tight tracking-[-0.01em] text-ink">{typeof title === 'string' ? <T>{title}</T> : title}</h1>
        {sub && <p className="mt-1 text-[length:calc(13.5px*var(--fs-scale,1))] text-ink-soft">{typeof sub === 'string' ? <T>{sub}</T> : sub}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A small "why can't I" hint on hover/focus for disabled actions. The reasons are also the
 * button's accessible description, so keyboard and screen-reader users get the same explanation. */
export function Gated({reasons, children, side = 'top'}: {reasons?: string[]; children: React.ReactNode; side?: 'top' | 'bottom'}) {
  const id = useId();
  if (!reasons?.length) return <>{children}</>;
  return (
    <span className="group/gate relative inline-flex" tabIndex={0} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={clsx(
        'pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[260px] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-start text-[length:calc(12.5px*var(--fs-scale,1))] leading-snug text-panel shadow-pop group-focus-within/gate:block group-hover/gate:block',
        side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
      )}>
        {reasons.map(r => <span key={r} className="block">{r}</span>)}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- Table */
/** The source ledger table, with effective density, stripes, sticky header and wrapping (PREF-04). */
export function SettleTable({className, ...rest}: React.ComponentProps<typeof Table>) {
  return <Table className={clsx('tbl', className)} {...rest}/>;
}
