'use client';
import type {ReactNode} from 'react';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '../screen-host';
import {minuteTime, overlaps, timelineLayout, type TimelineInterval} from './model';
export * from './model';
export * from './row-timeline';
export interface TimelineResource {id: string; label: string}
export interface ResourceEvent extends TimelineInterval {resource: string; label: string; detail?: ReactNode; inactive?: boolean}
export interface ResourceTimelineProps<T extends ResourceEvent> {
  label: string; resources: readonly TimelineResource[]; events: readonly T[];
  start?: number; end?: number; step?: number; now?: number;
  disabled?: boolean; onSlot: (resource: string, minute: number) => void; onOpen: (event: T) => void;
  slotLabel: (resource: TimelineResource, time: string) => string;
}
/** Controlled day canvas. The host owns dates, resources, commands and authorization. */
export function ResourceTimeline<T extends ResourceEvent>({label, resources, events, start = 480, end = 1110, step = 30, now, disabled = false, onSlot, onOpen, slotLabel}: ResourceTimelineProps<T>) {
  const {preferences} = usePreferences(), {t} = useLocalization(), format = useFormatters();
  const height = preferences.density === 'compact' ? 30 : preferences.density === 'spacious' ? 46 : 38;
  if (step <= 0 || end <= start || start < 0 || end > 1440) throw new Error('Invalid timeline range');
  const slots = Array.from({length: Math.ceil((end - start) / step)}, (_, i) => start + i * step);
  return <section aria-label={t(label)} data-resource-timeline data-density={preferences.density} className="overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]" style={{fontSize: 'calc(.85rem * var(--fs-result))'}}>
    <h2 className="sr-only">{t(label)}</h2>
    {!resources.length ? <p className="p-4">{t('Select a resource')}</p> : <div className="flex" style={{minWidth: 80 + resources.length * 180}}>
      <div className="sticky start-0 z-20 w-20 shrink-0 bg-[var(--surface)]"><div className="h-16 border-b border-[var(--border)]"/>{slots.map(minute => <div key={minute} className="border-b border-[var(--border)] px-1 text-end tabular-nums" style={{height}}>{format.time(minuteTime(minute))}</div>)}</div>
      {resources.map(resource => <div key={resource.id} data-timeline-resource={resource.id} className="min-w-[180px] flex-1 border-s border-[var(--border)]">
        <h3 className="sticky top-0 z-10 flex h-16 items-center bg-[var(--surface)] p-2 font-semibold">{resource.label}</h3>
        <div className="relative" style={{height: (end - start) / step * height}}>
          {slots.map(minute => {const occupied = events.some(e => e.resource === resource.id && !e.inactive && overlaps(minute, Math.min(step, end - minute), e.start, e.duration));return <button key={minute} type="button" disabled={disabled || occupied} aria-label={slotLabel(resource, format.time(minuteTime(minute)))} onClick={() => {if (!disabled && !occupied) onSlot(resource.id, minute);}} className="block w-full border-b border-[var(--border)] text-start hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:cursor-default" style={{height: Math.min(step, end - minute) / step * height}}/>;})}
          {timelineLayout(events.filter(e => e.resource === resource.id), start, end).map(({event, start: top, end: bottom, lane, lanes}) => <button key={event.id} type="button" data-timeline-event={event.id} onClick={() => onOpen(event)} className="absolute overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-1 text-start text-[var(--text)] focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-[var(--primary)]" style={{top: (top - start) / step * height + 1, height: Math.max(1, (bottom - top) / step * height - 2), insetInlineStart: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, textDecoration: event.inactive ? 'line-through' : undefined}}><span className="block truncate font-semibold">{event.label}</span>{bottom - top >= step * 2 ? <span className="block truncate">{event.detail}</span> : null}</button>)}
          {now !== undefined && now >= start && now < end ? <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-[var(--primary)]" style={{top: (now - start) / step * height}}/> : null}
        </div>
      </div>)}
    </div>}
  </section>;
}
