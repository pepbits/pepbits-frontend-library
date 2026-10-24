'use client';
import {useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode} from 'react';
import {ChevronDown, Plus} from '@pepbits/icons';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '../screen-host';
import {minuteTime, timelineLayout} from './model';

export interface TimelineRow {id: string; label: string; group?: string; detail?: ReactNode; icon?: ReactNode}
/** Background availability. Only `blocked` refuses creation. */
export type RowBandTone = 'open' | 'reserved' | 'walk-in' | 'blocked';
export interface RowBand {row: string; start: number; end: number; tone: RowBandTone; label?: string}
/** `lead`/`trail` are held minutes before and after the event (preparation, turnover or travel). */
export interface RowEvent {id: string; row: string; start: number; end: number; label: string; detail?: string; color?: string; lead?: number; trail?: number; emphasis?: 'none' | 'warning'; inactive?: boolean; marker?: ReactNode}
export interface ResourceRowTimelineProps<T extends RowEvent> {
  label: string; rows: readonly TimelineRow[]; bands?: readonly RowBand[]; events: readonly T[];
  /** Minutes from the start of the displayed day. */
  start?: number; end?: number;
  /** Horizontal magnification; 1 fits the container. */
  zoom?: number; snap?: number; now?: number; disabled?: boolean;
  onOpen: (event: T) => void;
  onCreate?: (row: string, minute: number) => void;
  /** Accessible name of the per-row keyboard create command. Required for keyboard creation. */
  createLabel?: (row: TimelineRow) => string;
  emptyLabel?: string;
}

const BAND_STYLE: Record<RowBandTone, CSSProperties> = {
  open: {background: 'var(--surface)'},
  reserved: {background: 'repeating-linear-gradient(135deg, var(--surface) 0 5px, color-mix(in srgb, var(--warning) 22%, var(--surface)) 5px 9px)'},
  'walk-in': {background: 'radial-gradient(color-mix(in srgb, var(--success) 45%, transparent) 1px, var(--surface) 1.5px) 0 0 / 6px 6px'},
  blocked: {background: 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--danger) 10%, var(--surface)) 0 6px, color-mix(in srgb, var(--danger) 22%, var(--surface)) 6px 10px)', color: 'var(--danger-ink)'},
};

/**
 * Controlled horizontal resource timeline: one row per resource, availability bands behind
 * overlap-packed events, an optional now line and grouped rows. The host owns dates, data,
 * commands, authorization and server revalidation; this canvas performs no fetch or write.
 */
export function ResourceRowTimeline<T extends RowEvent>({label, rows, bands = [], events, start = 0, end = 1440, zoom = 1, snap = 15, now, disabled = false, onOpen, onCreate, createLabel, emptyLabel = 'No resources'}: ResourceRowTimelineProps<T>) {
  const {preferences} = usePreferences(), {t} = useLocalization(), format = useFormatters();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  if (end <= start || start < 0 || snap <= 0 || zoom <= 0) throw new Error('Invalid timeline range');
  const span = end - start, lane = preferences.density === 'compact' ? 1.5 : preferences.density === 'spacious' ? 2.3 : 1.9;
  const pos = (minute: number) => Math.max(0, Math.min(100, (minute - start) / span * 100));
  const hours = Array.from({length: Math.ceil(span / 60)}, (_, i) => start + i * 60);
  const groups = useMemo(() => {
    const map = new Map<string, TimelineRow[]>();
    for (const row of rows) map.set(row.group ?? '', [...(map.get(row.group ?? '') ?? []), row]);
    return [...map.entries()];
  }, [rows]);
  const layouts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof timelineLayout<T & {duration: number}>>>();
    for (const row of rows) {
      const own = events.filter(event => event.row === row.id).map(event => ({...event, start: event.start - (event.lead ?? 0), duration: event.end + (event.trail ?? 0) - (event.start - (event.lead ?? 0))}));
      map.set(row.id, timelineLayout(own, start, end));
    }
    return map;
  }, [rows, events, start, end]);
  const creatable = (row: string, minute: number) => bands.some(band => band.row === row && band.tone !== 'blocked' && band.start <= minute && band.end > minute)
    && !bands.some(band => band.row === row && band.tone === 'blocked' && band.start <= minute && band.end > minute);
  const firstOpen = (row: string) => {
    const candidates = bands.filter(band => band.row === row && band.tone !== 'blocked' && band.end > start && band.start < end)
      .flatMap(band => {
        for (let minute = Math.ceil(Math.max(band.start, start, now ?? start) / snap) * snap; minute < Math.min(band.end, end); minute += snap) {
          if (creatable(row, minute)) return [minute];
        }
        return [];
      }).sort((a, b) => a - b);
    return candidates[0];
  };
  const click = (event: MouseEvent<HTMLDivElement>, row: string) => {
    if (disabled || !onCreate) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const fraction = (rtl ? rect.right - event.clientX : event.clientX - rect.left) / rect.width;
    const minute = start + Math.round(fraction * span / snap) * snap;
    if (minute >= start && minute < end && creatable(row, minute)) onCreate(row, minute);
  };
  const nowAt = now !== undefined && now >= start && now <= end ? pos(now) : null;
  const header = '14rem';
  return <section aria-label={t(label)} data-row-timeline data-density={preferences.density} className="overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]" style={{fontSize: 'calc(.8rem * var(--fs-result))'}}>
    <h2 className="sr-only">{t(label)}</h2>
    <div className="relative" style={{minWidth: zoom > 1 ? `calc(${header} + ${zoom * 100}% - ${header})` : undefined}}>
      <div className="sticky top-0 z-20 grid border-b border-[var(--border)] bg-[var(--surface)]" style={{gridTemplateColumns: `${header} 1fr`}}>
        <div className="sticky start-0 z-10 border-e border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text-muted)]">{t('{count} resources', {count: format.number(rows.length)})}</div>
        <div className="relative h-8" aria-hidden>
          {hours.map(minute => <span key={minute} className="absolute top-0 h-full border-s border-[var(--border)] ps-1 pt-2 tabular-nums text-[var(--text-muted)]" style={{insetInlineStart: `${pos(minute)}%`}}>{format.time(minuteTime(minute % 1440))}</span>)}
          {nowAt !== null && now !== undefined ? <span className="absolute top-1 z-10 -translate-x-1/2 rounded bg-[var(--warning)] px-1 font-bold text-[var(--text)] rtl:translate-x-1/2" style={{insetInlineStart: `${nowAt}%`}}>{format.time(minuteTime(now % 1440))}</span> : null}
        </div>
      </div>
      {!rows.length ? <p className="p-4 text-[var(--text-muted)]">{t(emptyLabel)}</p> : groups.map(([group, members]) => <div key={group || 'rows'} data-row-group={group || undefined}>
        {group ? <button type="button" aria-expanded={!collapsed[group]} onClick={() => setCollapsed(value => ({...value, [group]: !value[group]}))} className="sticky start-0 flex w-full items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-start font-semibold text-[var(--text-muted)]">
          <ChevronDown aria-hidden className={`size-3.5 ${collapsed[group] ? '-rotate-90 rtl:rotate-90' : ''}`}/>{group}<span className="font-normal">({format.number(members.length)})</span>
        </button> : null}
        {!collapsed[group] && members.map(row => {
          const layout = layouts.get(row.id) ?? [], lanes = Math.max(1, ...layout.map(item => item.lane + 1));
          const open = onCreate && createLabel ? firstOpen(row.id) : undefined;
          return <div key={row.id} data-row-timeline-row={row.id} className="grid border-b border-[var(--border)]" style={{gridTemplateColumns: `${header} 1fr`, height: `${Math.max(2.4, lanes * lane + 0.5)}rem`}}>
            <div className="sticky start-0 z-10 flex items-center gap-2 border-e border-[var(--border)] bg-[var(--surface)] px-3">
              {row.icon}
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-[var(--text)]" title={row.label}>{row.label}</p>{row.detail ? <div className="truncate text-[var(--text-muted)]">{row.detail}</div> : null}</div>
              {onCreate && createLabel ? <button type="button" aria-label={t(createLabel(row))} title={t(createLabel(row))} disabled={disabled || open === undefined} onClick={() => {if (!disabled && open !== undefined) onCreate(row.id, open);}} className="grid size-6 shrink-0 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:opacity-40"><Plus aria-hidden className="size-3.5"/></button> : null}
            </div>
            <div className={`relative ${onCreate && !disabled ? 'cursor-crosshair' : ''}`} style={{background: 'color-mix(in srgb, var(--text-muted) 12%, var(--surface))'}} onClick={event => click(event, row.id)}>
              {hours.map(minute => <span key={minute} aria-hidden className="pointer-events-none absolute inset-y-0 border-s border-[var(--border)] opacity-50" style={{insetInlineStart: `${pos(minute)}%`}}/>)}
              {bands.filter(band => band.row === row.id && band.end > start && band.start < end).map((band, index) => <div key={index} data-row-band={band.tone} title={band.label} className={band.tone === 'blocked' ? 'absolute inset-y-0.5 flex items-center overflow-hidden rounded px-1.5 font-semibold' : 'absolute inset-y-0'} style={{...BAND_STYLE[band.tone], insetInlineStart: `${pos(band.start)}%`, width: `${Math.max(0.15, pos(band.end) - pos(band.start))}%`}}>{band.tone === 'blocked' && band.label ? <span className="truncate">{band.label}</span> : null}</div>)}
              {layout.map(({event, start: from, end: to, lane: index}) => {
                const original = events.find(item => item.id === event.id)!, held = to - from || 1;
                const lead = Math.max(0, Math.min(to, original.start) - from), trail = Math.max(0, to - Math.max(from, original.end));
                return <button key={event.id} type="button" data-row-event={event.id} onClick={clicked => {clicked.stopPropagation(); onOpen(original);}} title={[original.label, original.detail].filter(Boolean).join('\n')} aria-label={[original.label, original.detail].filter(Boolean).join(', ')}
                  className="absolute z-[5] flex overflow-hidden rounded-md text-start font-medium text-white shadow-sm ring-1 ring-white/60 hover:z-10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)]"
                  style={{top: `${0.25 + index * lane}rem`, height: `${lane - 0.25}rem`, insetInlineStart: `${pos(from)}%`, width: `${Math.max(0.15, pos(to) - pos(from))}%`, opacity: original.inactive ? 0.6 : undefined, outline: original.emphasis === 'warning' ? '2px solid var(--warning)' : undefined}}>
                  {lead ? <span aria-hidden className="h-full shrink-0 bg-black/30" style={{width: `${lead / held * 100}%`}}/> : null}
                  <span className="flex min-w-0 flex-1 items-center gap-1 px-1.5" style={{background: original.color ?? 'var(--primary-fill)'}}>{original.marker}<span className="truncate">{original.label}</span></span>
                  {trail ? <span aria-hidden className="h-full shrink-0 bg-black/30" style={{width: `${trail / held * 100}%`}}/> : null}
                </button>;
              })}
              {nowAt !== null ? <span aria-hidden className="pointer-events-none absolute inset-y-0 z-[6] w-0.5 bg-[var(--warning)]" style={{insetInlineStart: `${nowAt}%`}}/> : null}
            </div>
          </div>;
        })}
      </div>)}
    </div>
  </section>;
}
