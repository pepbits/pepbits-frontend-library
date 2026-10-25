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
  /** Optional baseline dimensions; slot height still follows effective density. */
  geometry?: {slotHeight: number; timeWidth: number; resourceWidth: number; headerHeight: number; eventInset?: number; eventGap?: number};
  labelEvery?: number; renderResource?: (resource: TimelineResource, events: readonly T[]) => ReactNode;
  eventClassName?: (event: T) => string;
  start?: number; end?: number; step?: number; now?: number;
  disabled?: boolean; onSlot: (resource: string, minute: number) => void; onOpen: (event: T) => void;
  slotLabel: (resource: TimelineResource, time: string) => string;
}
/** Controlled day canvas. The host owns dates, resources, commands and authorization. */
export function ResourceTimeline<T extends ResourceEvent>({label, resources, events, start = 480, end = 1110, step = 30, now, disabled = false, onSlot, onOpen, slotLabel, geometry, labelEvery = 1, renderResource, eventClassName}: ResourceTimelineProps<T>) {
  const {preferences} = usePreferences(), {t} = useLocalization(), format = useFormatters();
  const height = geometry ? geometry.slotHeight * (preferences.density === 'compact' ? .8 : preferences.density === 'spacious' ? 1.2 : 1) : preferences.density === 'compact' ? 30 : preferences.density === 'spacious' ? 46 : 38;
  const timeWidth = geometry?.timeWidth ?? 80, resourceWidth = geometry?.resourceWidth ?? 180, headerHeight = geometry?.headerHeight ?? 64, inset = geometry?.eventInset ?? 2, eventGap = geometry?.eventGap ?? 2;
  if (labelEvery < 1 || !Number.isInteger(labelEvery) || [height,timeWidth,resourceWidth,headerHeight].some(value => !Number.isFinite(value) || value <= 0)) throw new Error('Invalid timeline geometry');
  if (step <= 0 || end <= start || start < 0 || end > 1440) throw new Error('Invalid timeline range');
  const slots = Array.from({length: Math.ceil((end - start) / step)}, (_, i) => start + i * step);
  return <section aria-label={t(label)} data-resource-timeline data-density={preferences.density} className="overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]" style={{fontSize: 'calc(.85rem * var(--fs-result))'}}>
    <h2 className="sr-only">{t(label)}</h2>
    {!resources.length ? <p className="p-4">{t('Select a resource')}</p> : <div className="flex" style={{minWidth: timeWidth + resources.length * resourceWidth}}>
      <div className="sticky start-0 z-20 shrink-0 bg-[var(--surface)]" style={{width: timeWidth}}><div className="border-b border-[var(--border)]" style={{height: headerHeight}}/>{slots.map((minute, index) => <div key={minute} className="border-b border-[var(--border)] px-1 text-end tabular-nums" style={{height}}>{index % labelEvery === 0 ? format.time(minuteTime(minute)) : null}</div>)}</div>
      {resources.map(resource => <div key={resource.id} data-timeline-resource={resource.id} className="flex-1 border-s border-[var(--border)]" style={{minWidth: resourceWidth}}>
        <h3 className={`sticky top-0 z-10 flex items-center font-semibold ${geometry ? 'bg-[var(--surface-2)] px-2.5 py-2' : 'bg-[var(--surface)] p-2'}`} style={{height: headerHeight}}>{renderResource ? renderResource(resource, events.filter(event => event.resource === resource.id)) : resource.label}</h3>
        <div className="relative" style={{height: (end - start) / step * height}}>
          {slots.map(minute => {const occupied = events.some(e => e.resource === resource.id && !e.inactive && overlaps(minute, Math.min(step, end - minute), e.start, e.duration));return <button key={minute} type="button" disabled={disabled || occupied} aria-label={slotLabel(resource, format.time(minuteTime(minute)))} onClick={() => {if (!disabled && !occupied) onSlot(resource.id, minute);}} className="block w-full border-b border-[var(--border)] text-start hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] disabled:cursor-default" style={{height: Math.min(step, end - minute) / step * height}}/>;})}
          {timelineLayout(events.filter(e => e.resource === resource.id), start, end).map(({event, start: top, end: bottom, lane, lanes}) => <button key={event.id} type="button" data-timeline-event={event.id} onClick={() => onOpen(event)} className={`absolute overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-1 text-start text-[var(--text)] focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${eventClassName?.(event) ?? ''}`} style={{top: (top - start) / step * height + 1, height: Math.max(1, (bottom - top) / step * height - eventGap), insetInlineStart: `calc(${lane / lanes * 100}% + ${inset}px)`, width: `calc(${100 / lanes}% - ${inset * 2}px)`, textDecoration: event.inactive ? 'line-through' : undefined}}><span className="block truncate font-semibold">{event.label}</span>{bottom - top >= step * 2 ? <span className="block truncate">{event.detail}</span> : null}</button>)}
          {now !== undefined && now >= start && now < end ? <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-[var(--primary)]" style={{top: (now - start) / step * height}}/> : null}
        </div>
      </div>)}
    </div>}
  </section>;
}
