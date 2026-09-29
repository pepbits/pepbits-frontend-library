'use client';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DaysPicker({ value, onChange, disabled, invalid }: { value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const set = new Set(String(value || '').split('|').filter(Boolean));
  const toggle = (d: string) => {
    const next = new Set(set);
    if (next.has(d)) next.delete(d); else next.add(d);
    onChange(DAYS.filter((x) => next.has(x)).join('|'));
  };
  const presets: [string, string[]][] = [['Weekdays', DAYS.slice(0, 5)], ['Every day', DAYS], ['Sun-Thu', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={clsx('inline-flex overflow-hidden rounded border', invalid ? 'border-hc-danger-600' : 'border-hc-line-strong')}>
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            aria-pressed={set.has(d)}
            onClick={() => toggle(d)}
            className={clsx('h-8 w-11 border-r border-hc-line text-hc-xs font-medium last:border-r-0', set.has(d) ? 'bg-hc-petrol-600 text-white' : 'bg-hc-surface text-hc-ink-soft hover:bg-hc-canvas')}
          >
            <LocalizedText message={d}/>
          </button>
        ))}
      </div>
      {!disabled && presets.map(([label, ds]) => (
        <button key={label} type="button" className="text-hc-xs text-hc-petrol-700 hover:underline" onClick={() => onChange(DAYS.filter((d) => ds.includes(d)).join('|'))}><LocalizedText message={label}/></button>
      ))}
    </div>
  );
}
