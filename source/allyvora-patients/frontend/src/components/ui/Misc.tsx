import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('rounded border border-line bg-sunken px-1.5 py-px font-sans text-2xs font-medium text-ink-3', className)}>
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-sunken', className)} aria-hidden />;
}

export function ProgressRing({ value, size = 40, stroke = 4, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 100 ? 'text-ok' : v >= 70 ? 'text-brand' : 'text-accent';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn('-rotate-90', className)} role="img" aria-label={`${v}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * v) / 100}
        className={cn('stroke-current transition-[stroke-dashoffset] duration-500', tone)}
      />
    </svg>
  );
}

export function CompletionBar({ value, className }: { value: number; className?: string }) {
  const tone = value >= 100 ? 'bg-ok' : value >= 70 ? 'bg-brand' : 'bg-accent';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="tabular w-8 text-right text-xs text-ink-2">{value}%</span>
    </div>
  );
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand',
        className,
      )}
      aria-hidden
    >
      {text}
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-ink-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
