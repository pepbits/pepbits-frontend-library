'use client';
import type { ReactNode } from 'react';
import { LocalizedText as ReferenceText, Card as SharedCard } from '@pepbits/ops-ui';
import { cx } from '../../lib/format';
import type { PageDef, Row } from '../../lib/types';

/** Full-height page frame. Fills the main area on desktop, scrolls naturally on phones. */
export function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex h-full min-h-[560px] flex-col gap-3 p-2 md:p-3', className)}>{children}</div>;
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <SharedCard shadow="none" className={cx('min-h-0 overflow-hidden', className)}>{children}</SharedCard>;
}
export function Stat({ label, value, hint, tone, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'ok' | 'warn' | 'danger' | 'brand'; className?: string }) {
  const bar = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', brand: 'bg-brand' }[tone ?? 'brand'];
  return (
    <SharedCard data-reference-result shadow="none" className={cx('relative overflow-hidden px-3.5 py-2.5', className)}>
      <span className={cx('absolute left-0 top-0 h-full w-[3px]', tone ? bar : 'bg-transparent')} />
      <div className="truncate text-[length:calc(12px*var(--fs-scale))] text-ink-3">{typeof label === 'string' ? <ReferenceText message={label} /> : label}</div>
      <div className="mt-0.5 truncate text-[length:calc(18px*var(--fs-scale))] font-semibold tracking-tight text-ink tnum">{value}</div>
      {hint && <div className="truncate text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{typeof hint === 'string' ? <ReferenceText message={hint} /> : hint}</div>}
    </SharedCard>
  );
}
export { nounOf } from '../../lib/registry';
export const defaultsFor = (def: PageDef): Partial<Row> => {
  const d: Partial<Row> = {};
  def.fields.forEach((f) => {
    if (f.type === 'status' && f.options) d[f.key] = f.options[0];
    if (f.type === 'boolean') d[f.key] = false;
  });
  return d;
};
