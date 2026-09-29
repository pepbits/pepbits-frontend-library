import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';
import { useFormat } from '../../lib/format';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'petrol' | 'selfpay';
const toneCls: Record<Tone, string> = {
  ok: 'bg-hc-ok-50 text-hc-ok-700 ring-hc-ok-100',
  warn: 'bg-hc-warn-50 text-hc-warn-700 ring-hc-warn-100',
  danger: 'bg-hc-danger-50 text-hc-danger-700 ring-hc-danger-100',
  info: 'bg-hc-info-50 text-hc-info-700 ring-hc-info-100',
  neutral: 'bg-hc-canvas text-hc-ink-soft ring-hc-line',
  petrol: 'bg-hc-petrol-50 text-hc-petrol-700 ring-hc-petrol-100',
  selfpay: 'bg-hc-selfpay-50 text-hc-selfpay-700 ring-hc-selfpay-100',
};
const dotCls: Record<Tone, string> = {
  ok: 'bg-hc-ok-600', warn: 'bg-hc-warn-600', danger: 'bg-hc-danger-600', info: 'bg-hc-info-600', neutral: 'bg-hc-ink-faint', petrol: 'bg-hc-petrol-500', selfpay: 'bg-hc-selfpay-500',
};

export function Badge({ tone = 'neutral', children, dot, className, title }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex h-5 items-center gap-1 whitespace-nowrap rounded px-1.5 text-hc-2xs font-medium ring-1 ring-inset', toneCls[tone], className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dotCls[tone])} />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  Active: 'ok', Approved: 'ok', Eligible: 'ok', Paid: 'ok', Completed: 'ok', Billed: 'neutral', Signed: 'info',
  Arrived: 'info', 'In Consultation': 'petrol', Confirmed: 'info', Booked: 'petrol', Registered: 'info',
  Pending: 'warn', Required: 'warn', 'Partially paid': 'warn', Manual: 'warn', Draft: 'neutral', Unpaid: 'warn', 'Ready to claim': 'info',
  Rejected: 'danger', Ineligible: 'danger', Cancelled: 'danger', 'No-show': 'danger', Inactive: 'neutral', Unregistered: 'selfpay',
  NotRequired: 'neutral', 'Not required': 'neutral', 'Not applicable': 'neutral',
};
const STATUS_LABEL: Record<string, string> = { NotRequired: 'Not required', PriorAuth: 'Prior approval' };

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (!status) return null;
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot className={className}><LocalizedText message={STATUS_LABEL[status] ?? status}/></Badge>;
}

export function Money({ value, className, strong, currency }: { value: number | null | undefined; className?: string; strong?: boolean; currency?: string }) {
  const { money } = useFormat();
  return (
    <span className={clsx('hc-num whitespace-nowrap', strong && 'font-semibold', className)}>
      {currency && <span className="mr-1 text-hc-2xs font-normal text-hc-ink-mute">{currency}</span>}
      {money(value)}
    </span>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 text-hc-ink-mute', className)} role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label && <span className="text-hc-xs">{label}</span>}
    </span>
  );
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {icon && <div className="mb-1 text-hc-ink-faint">{icon}</div>}
      <p className="text-hc-sm font-semibold text-hc-ink"><LocalizedText message={title}/></p>
      {body && <p className="max-w-sm text-hc-xs text-hc-ink-mute">{typeof body==='string'?<LocalizedText message={body}/>:body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function KV({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('min-w-0', className)}>
      <dt className="text-hc-2xs text-hc-ink-mute"><LocalizedText message={label}/></dt>
      <dd className="truncate text-hc-sm text-hc-ink">{children || <span className="text-hc-ink-faint"><LocalizedText message="Not set" /></span>}</dd>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-hc-danger-100 bg-hc-danger-50 px-3 py-2 text-hc-sm text-hc-danger-700" role="alert">
      <span><LocalizedText message={message}/></span>
      {onRetry && <button type="button" className="shrink-0 font-medium underline underline-offset-2" onClick={onRetry}><LocalizedText message="Try again" /></button>}
    </div>
  );
}
