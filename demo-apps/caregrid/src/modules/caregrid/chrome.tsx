'use client';
import React, {useEffect, useRef, useState} from 'react';
import {AlertOctagon, Bell, CheckCircle2, Info, ShieldAlert, ShieldCheck} from '@pepbits/icons';
import {Badge, Segmented} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useNavigation} from '@pepbits/platform/navigation';
import type {CommandSearch} from '@pepbits/shell';
import type {CaregridClient} from '../../adapters/caregrid';
import {targetFromPath, to} from '../../navigation';
import {useCaregridQuery, useLive} from './live';
import {useCaregridFormat} from './format';
import {nowLocal} from './time';
import type {Notice, QueueItem} from './types';

const LEVEL = {success: {icon: CheckCircle2, color: 'var(--success)'}, info: {icon: Info, color: 'var(--info)'}, warning: {icon: ShieldAlert, color: 'var(--warning)'}, critical: {icon: AlertOctagon, color: 'var(--danger)'}};
/** Notification links are source paths, resolved through the same route table as deep links. */
export function noticeTarget(link: string) {const [path = '/', query = ''] = link.split('?'); return targetFromPath(path, query);}

/** Header inbox: live connection state, reschedule queue shortcut and the notification panel. */
export function CaregridInbox() {
  const {status, lastSync, notices, unread, markAllRead, markRead} = useLive();
  const {t} = useLocalization(), navigation = useNavigation(), f = useCaregridFormat();
  const {data: queue} = useCaregridQuery<QueueItem[]>('/queue');
  const [open, setOpen] = useState(false), [filter, setFilter] = useState('all');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {if (!ref.current?.contains(event.target as Node)) setOpen(false);};
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') setOpen(false);};
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape);};
  }, [open]);
  const now = nowLocal(), list = notices.filter(n => filter === 'all' || n.level === 'warning' || n.level === 'critical');
  const groups: [string, Notice[]][] = [['Today', list.filter(n => n.created_at.slice(0, 10) === now.slice(0, 10))], ['Earlier', list.filter(n => n.created_at.slice(0, 10) !== now.slice(0, 10))]];
  const statusText = status === 'live' ? t('Live updates on') : status === 'connecting' ? t('Connecting to scheduling server') : t('Offline: changes from others will appear when the connection returns');
  return <div ref={ref} className="relative flex shrink-0 items-center gap-1.5" data-caregrid-inbox>
    <span role="status" title={lastSync ? t('Last sync {time}', {time: f.time(lastSync)}) : statusText} className="hidden items-center gap-1.5 text-xs text-[var(--text-muted)] lg:flex">
      <span aria-hidden className="size-2 rounded-full" style={{background: status === 'live' ? 'var(--success)' : status === 'connecting' ? 'var(--warning)' : 'var(--danger)'}}/>
      <span className="sr-only">{statusText}</span><span aria-hidden>{status === 'live' ? t('Live') : status === 'connecting' ? t('Connecting') : t('Offline')}</span>
    </span>
    {queue?.length ? <button type="button" onClick={() => navigation.open(to('caregrid-exceptions'))} className="focus-ring flex h-[30px] items-center gap-1 rounded-lg px-2 text-xs font-semibold cg-wash-warning" title={t('Reschedule queue')}>
      <ShieldAlert aria-hidden className="size-3.5"/>{t('{count} to move', {count: f.number(queue.length)})}
    </button> : null}
    <button type="button" aria-expanded={open} aria-label={t('Notifications, {count} unread', {count: f.number(unread)})} onClick={() => setOpen(value => !value)} className="focus-ring relative grid size-[30px] place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
      <Bell aria-hidden className="size-4"/>
      {unread > 0 ? <span aria-hidden className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--danger-fill)] px-1 text-[0.6rem] font-bold text-white">{unread > 99 ? '99+' : unread}</span> : null}
    </button>
    {open ? <section aria-label={t('Notifications')} className="absolute end-0 top-10 z-[95] w-[24rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="font-semibold">{t('Notifications')}</h2>
        <div className="flex items-center gap-2"><Segmented size="sm" label="Notification filter" value={filter} onChange={setFilter} options={[{value: 'all', label: 'All'}, {value: 'action', label: 'Needs action'}]}/>
          <button type="button" className="focus-ring rounded px-2 py-1 text-xs font-semibold hover:bg-[var(--surface-2)]" onClick={markAllRead}>{t('Mark all read')}</button></div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {groups.map(([label, items]) => items.length ? <div key={label} role="group" aria-label={t(label)}>
          <p className="bg-[var(--surface-2)] px-4 py-1.5 text-[0.7rem] font-semibold text-[var(--text-muted)]">{t(label)}</p>
          {items.map(notice => {const level = LEVEL[notice.level] ?? LEVEL.info, Icon = level.icon; return <button key={notice.id} type="button" onClick={() => {markRead(notice.id); if (notice.link) {navigation.open(noticeTarget(notice.link)); setOpen(false);}}}
            className="flex w-full gap-3 border-b border-[var(--border)] px-4 py-3 text-start hover:bg-[var(--surface-2)]" style={notice.read ? undefined : {background: 'color-mix(in srgb, var(--primary) 6%, var(--surface))'}}>
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0" style={{color: level.color}}/>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{notice.title}</span><span className="shrink-0 text-[0.68rem] text-[var(--text-muted)]">{f.ago(notice.created_at, now)}</span></span>
              {notice.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--text-muted)]">{notice.body}</span> : null}</span>
            {!notice.read ? <Badge tone="warning">{t('New')}</Badge> : null}
          </button>;})}
        </div> : null)}
        {!list.length ? <p className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--text-muted)]"><ShieldCheck aria-hidden className="size-4"/>{t('You are all caught up.')}</p> : null}
      </div>
    </section> : null}
  </div>;
}

/** Command palette records: patients, bookable services and resources from the scheduling API. */
export function caregridCommandSearch(client: CaregridClient): CommandSearch {
  return async (query, signal) => {
    if (query.length < 1) return [];
    const result = await client.request<{patients: {id: number; full_name: string; mrn: string}[]; types: {id: number; name: string; category: string}[]; resources: {id: number; name: string; role_label: string}[]}>('/search?q=' + encodeURIComponent(query), {signal});
    return [
      ...result.patients.map(p => ({id: 'patient-' + p.id, group: 'Patients', label: p.full_name, hint: p.mrn, target: to('caregrid-patients', {id: p.id})})),
      ...result.types.map(s => ({id: 'service-' + s.id, group: 'Book a service', label: s.name, hint: s.category, target: to('caregrid-book', {type: s.id})})),
      ...result.resources.map(r => ({id: 'resource-' + r.id, group: 'Resources', label: r.name, hint: r.role_label, target: to('caregrid-resources', {id: r.id})})),
    ];
  };
}

/** Source `B` shortcut. Bound only while shortcuts are enabled and never while typing (PREF-07). */
export function BookShortcut() {
  const {preferences} = usePreferences(), navigation = useNavigation();
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null, tag = target?.tagName;
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.code === 'KeyB') {event.preventDefault(); navigation.open(to('caregrid-book'));}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preferences.keyboardShortcuts, navigation]);
  return null;
}
