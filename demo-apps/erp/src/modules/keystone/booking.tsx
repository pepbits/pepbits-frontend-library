import {useEffect, useState} from 'react';
import {ResourceTimeline, minuteTime, timeMinutes} from '@pepbits/patterns/calendar';
import {useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {Avatar, Button, Input, Segmented} from '@pepbits/ui';
import {Card, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {PageDefinition} from '@pepbits/page-engines/types';
import {useFetch, listUrl, useScopeMemory, rememberIds} from './client';
import {ErpWorklist} from './worklist';
import {RecordEditor} from './record';
import {useKeystone} from './context';
import type {ErpTarget} from '../../navigation';
import type {ListResponse, PageDef, Row} from './types';
import {localDay,shiftDay} from './dates';
export function BookingPage({def, page, current, onOpen, onClose}: {def: PageDef; page: PageDefinition; current?: ErpTarget; onOpen: (target: ErpTarget) => void; onClose: () => void}) {
  const {t} = useLocalization(), format = useFormatters(), host = useScreenHost(), memory = useScopeMemory(), {variant} = useKeystone();
  const [date, setDate] = useState(localDay), [mode, setMode] = useState('day'), [hidden, setHidden] = useState<string[]>([]), [now, setNow] = useState(() => new Date());
  useEffect(() => {const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer);}, []);
  const result = useFetch<ListResponse>(listUrl(def.entity, {size: 1000, filters: {date: [date]}, sort: 'start', dir: 'asc'}));
  const rows = result.data?.rows ?? [], resources = (def.resources ?? []).filter(resource => !hidden.includes(resource));
  useEffect(() => {rememberIds(memory, def.slug, rows.map(row => row.id));}, [memory, def.slug, result.data]);
  const open = (row: Row) => onOpen({pageId: page.id, recordId: row.id, mode: 'view'});
  const book = (resource: string, minute: number) => {if (!host.can('create')) return; onOpen({pageId: page.id, mode: 'new', query: new URLSearchParams({resource, date, start: minuteTime(minute), duration: '30', status: 'Booked', type: def.fields.find(field => field.key === 'type')?.options?.[0] ?? ''}).toString()});};
  const partial = !!result.data && result.data.total > rows.length;
  const upcoming = rows.filter(row => row.status === 'Booked' && (date !== localDay(now) || timeMinutes(row.start) >= now.getHours() * 60 + now.getMinutes())).slice(0, 6);

  return <div data-erp-booking className="space-y-3" aria-busy={result.loading}>
    <Card className="flex flex-wrap items-end gap-2 p-3">
      <Button onClick={() => setDate(shiftDay(date, -1))}>{t('Previous day')}</Button><Button onClick={() => setDate(localDay())}>{t('Today')}</Button><Button onClick={() => setDate(shiftDay(date, 1))}>{t('Next day')}</Button>
      <Input type="date" label="Date" value={date} onChange={event => {if (event.target.value) setDate(event.target.value);}}/>
      <Segmented label="View" value={mode} onChange={setMode} options={[{value: 'day', label: 'Schedule'}, {value: 'list', label: 'List'}]}/>
      <Button disabled={!host.can('create') || !resources.length || result.loading || !!result.error || partial} onClick={() => book(resources[0]!, 540)}>{t('New')}</Button><Button onClick={result.reload}>{t('Reload')}</Button>
    </Card>
    {mode === 'list' ? <ErpWorklist def={def} page={page} onOpen={onOpen}/> : <>
      <div className="flex flex-wrap gap-2" aria-label={t('Resources')}>{(def.resources ?? []).map(resource => <Button key={resource} aria-pressed={!hidden.includes(resource)} onClick={() => setHidden(values => values.includes(resource) ? values.filter(value => value !== resource) : [...values, resource])}>{resource}</Button>)}</div>
      {partial ? <p role="alert">{t('The schedule is incomplete. Reload before booking.')}</p> : null}
      <p>{format.date(date)} · {['Booked', 'Checked in', 'Completed', 'Cancelled'].map(status => `${t(status)} ${format.number(rows.filter(row => row.status === status).length)}`).join(' · ')}</p>
      {result.error ? <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/> : result.loading ? <LoadingState/> : <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_256px]">
        <ResourceTimeline geometry={{slotHeight:30,timeWidth:56,resourceWidth:170,headerHeight:49,eventInset:4,eventGap:3}} labelEvery={2} renderResource={(resource, events)=><span className="erp-calendar-resource"><Avatar name={resource.label} size="xs" decorative/><span className="erp-calendar-resource-copy"><span>{resource.label}</span><small>{format.number(events.filter(event=>!event.inactive).length)} {t('booked')}</small></span></span>} eventClassName={event=>`erp-booking-event erp-booking-${String(event.row.status).toLowerCase().replaceAll(' ','-')}`} label={def.title} resources={resources.map(resource => ({id: resource, label: resource}))} events={rows.map(row => ({id: row.id, resource: String(row.resource), start: timeMinutes(row.start), duration: Number(row.duration || 30), label: String(row.person ?? row.code), detail: `${format.time(row.start)} · ${t(row.type ?? '')}`, inactive: row.status === 'Cancelled', row}))} now={date === localDay(now) ? now.getHours() * 60 + now.getMinutes() : undefined} disabled={!host.can('create') || partial} slotLabel={(resource, time) => t('Book {value0} at {value1}', {value0: resource.label, value1: time})} onSlot={book} onOpen={event => open(event.row)}/>
        <Card className="space-y-3 p-3"><h2>{t(date === localDay(now) ? 'Up next today' : 'Booked')} · {format.number(upcoming.length)}</h2>{upcoming.map(row => <Button key={row.id} variant="ghost" onClick={() => open(row)}>{format.time(row.start)} · {row.person} · {row.resource}</Button>)}{!upcoming.length ? <p>{t('Nothing else booked. Click any free slot to add one.')}</p> : null}</Card>
      </div>}
    </>}
    {variant === 'erp1' && current && (current.mode || current.recordId) ? <RecordEditor def={def} target={current} onOpen={onOpen} onClose={onClose} onSaved={row => {setDate(String(row.date)); result.reload(); open(row);}}/>:null}
  </div>;
}
