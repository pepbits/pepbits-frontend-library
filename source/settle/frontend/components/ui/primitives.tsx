'use client';

import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { forwardRef, useId } from 'react';
import { money, STATUS } from '@/lib/format';
import type { BillStatus } from '@/lib/types';

/* ---------------------------------------------------------------- Button */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'due' | 'quiet';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pine-600 text-white hover:bg-pine-700 active:bg-pine-800 disabled:bg-pine-200',
  secondary: 'bg-white text-ink border border-line hover:border-line-strong hover:bg-mist active:bg-mist-2 disabled:text-ink-mute',
  ghost: 'text-ink-soft hover:bg-mist hover:text-ink disabled:text-ink-mute',
  quiet: 'text-pine-700 hover:bg-pine-50 disabled:text-ink-mute',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-100',
  due: 'bg-marigold-500 text-ink hover:bg-marigold-300 disabled:bg-marigold-100 disabled:text-ink-mute',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  kbd?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, kbd, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' && 'h-8 px-2.5 text-[13px]',
        size === 'md' && 'h-9 px-3.5 text-[14px]',
        size === 'lg' && 'h-11 px-5 text-[15px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {kbd && <Kbd className={variant === 'primary' || variant === 'danger' ? 'border-white/30 bg-white/10 text-white/80' : ''}>{kbd}</Kbd>}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={clsx('hidden min-w-[20px] items-center justify-center rounded border border-line bg-mist px-1 text-[11px] font-medium leading-[18px] text-ink-soft sm:inline-flex', className)}>
      {children}
    </kbd>
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
export function Badge({ tone = 'gray', children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx('chip', TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
export function StatusBadge({ status, className }: { status: BillStatus; className?: string }) {
  const s = STATUS[status];
  return <Badge tone={s.tone} dot className={className}>{s.label}</Badge>;
}

/* ---------------------------------------------------------------- Money */
export function Money({ value, className, sign, tone = 'auto', whole }: { value: number; className?: string; sign?: boolean; tone?: 'auto' | 'plain' | 'due'; whole?: boolean }) {
  const neg = value < -0.004;
  return (
    <span className={clsx('tabular-nums whitespace-nowrap', tone === 'auto' && neg && 'text-rose-600', tone === 'due' && value > 0.004 && 'text-marigold-800 font-semibold', className)}>
      {money(value, { sign, whole })}
    </span>
  );
}

/* ---------------------------------------------------------------- Fields */
export function Field({ label, hint, error, children, className, htmlFor, optional }: {
  label: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string; optional?: boolean;
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="label flex items-center justify-between">
        <span>{label}</span>
        {optional && <span className="font-normal text-ink-mute">Optional</span>}
      </label>
      {children}
      {error ? <p className="text-[12px] text-rose-600" role="alert">{error}</p> : hint ? <p className="text-[12px] text-ink-mute">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx('input', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('input appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237B8E8B' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={clsx('input', props.className)} />;
}

export function MoneyInput({ value, onChange, className, autoFocus, id, placeholder, invalid }: {
  value: string; onChange: (v: string) => void; className?: string; autoFocus?: boolean; id?: string; placeholder?: string; invalid?: boolean;
}) {
  return (
    <div className={clsx('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-mute">₹</span>
      <input
        id={id}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder={placeholder || '0.00'}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        className={clsx('input pl-7 text-right font-medium tabular-nums', invalid && 'border-rose-500 focus:ring-rose-100')}
      />
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, indeterminate, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; className?: string; indeterminate?: boolean; disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx('inline-flex cursor-pointer items-center gap-2 text-[14px]', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-line-strong accent-pine-600"
      />
      {label}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-pine-600' : 'bg-line-strong')}
    >
      <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/* ---------------------------------------------------------------- Segmented & Tabs */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; count?: number }[]; size?: 'sm' | 'md'; className?: string;
}) {
  return (
    <div role="radiogroup" className={clsx('inline-flex rounded-lg border border-line bg-mist p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-white text-ink shadow-hair ring-1 ring-line' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={clsx('text-[11px]', value === o.value ? 'text-pine-600' : 'text-ink-mute')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className, right }: {
  value: T; onChange: (v: T) => void; tabs: { value: T; label: React.ReactNode; count?: number | null; hidden?: boolean }[];
  className?: string; right?: React.ReactNode;
}) {
  return (
    <div className={clsx('flex items-end justify-between gap-4 border-b border-line', className)}>
      <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.filter((t) => !t.hidden).map((t) => (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={clsx(
              'inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[14px] font-medium transition-colors',
              value === t.value ? 'border-pine-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            {t.label}
            {t.count ? <span className={clsx('chip px-1.5', value === t.value ? 'bg-pine-50 text-pine-700' : 'bg-mist-2 text-ink-soft')}>{t.count}</span> : null}
          </button>
        ))}
      </div>
      {right && <div className="pb-1.5">{right}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- States */
export function Empty({ icon, title, body, action, className }: { icon?: React.ReactNode; title: string; body?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-pine-50 text-pine-600">{icon}</div>}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-[13.5px] text-ink-soft">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-mist-2', className)} />;
}

export function ErrorNote({ error, onRetry }: { error: { message: string } | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-[13.5px] text-rose-700">
      <span>{error.message}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function PageHeader({ title, sub, actions, children }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 pb-4 pt-1 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {sub && <p className="mt-1 text-[13.5px] text-ink-soft">{sub}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A small "why can't I" hint on hover/focus for disabled actions. */
export function Gated({ reasons, children, side = 'top' }: { reasons?: string[]; children: React.ReactNode; side?: 'top' | 'bottom' }) {
  if (!reasons?.length) return <>{children}</>;
  return (
    <span className="group/gate relative inline-flex" tabIndex={0}>
      {children}
      <span role="tooltip" className={clsx(
        'pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[260px] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-left text-[12.5px] leading-snug text-white shadow-pop group-focus-within/gate:block group-hover/gate:block',
        side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
      )}>
        {reasons.map((r) => <span key={r} className="block">{r}</span>)}
      </span>
    </span>
  );
}
