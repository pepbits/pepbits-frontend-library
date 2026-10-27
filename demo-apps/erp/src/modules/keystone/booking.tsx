import {useEffect, useState} from 'react';
import {ResourceTimeline, minuteTime, timeMinutes} from '@pepbits/patterns/calendar';
import {useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {Avatar, Button, DateInput, Segmented} from '@pepbits/ui';
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
import {ChevronLeft,ChevronRight,Plus} from '@pepbits/icons';
import './transaction-booking.css';
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
    <Card className="erp-booking-toolbar">
      <div><Button size="sm" aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))}><ChevronLeft size={17}/></Button><Button size="xs" onClick={() => setDate(localDay())}>{t('Today')}</Button><Button size="sm" aria-label="Next day" onClick={() => setDate(shiftDay(date, 1))}><ChevronRight size={17}/></Button>
      <DateInput aria-label="Date" value={date} onChange={event => {if (event.target.value) setDate(event.target.value);}}/><strong>{format.date(date)}</strong>
      <div className="erp-booking-legend">{['Booked','Checked in','Completed','Cancelled'].map(status=><span key={status}><i className={'erp-booking-'+status.toLowerCase().replaceAll(' ','-')}/>{t(status)} <small>{format.number(rows.filter(row=>row.status===status).length)}</small></span>)}</div>
      <Segmented label="View" value={mode} onChange={setMode} options={[{value: 'day', label: 'Schedule'}, {value: 'list', label: 'List'}]}/>
      <Button size="sm" variant="primary" leftIcon={<Plus size={15}/>} disabled={!host.can('create') || !resources.length || result.loading || !!result.error || partial} onClick={() => book(resources[0]!, 540)}>{t('New')}</Button><Button size="sm" onClick={result.reload}>{t('Reload')}</Button></div>
      {mode==='day'&&<div className="erp-booking-resources" aria-label={t('Resources')}><span>{t('{resourceType} availability',{resourceType:t(def.fields.find(field=>field.key==='resource')?.label??'Resource')})}</span>{(def.resources ?? []).map(resource => <Button size="sm" key={resource} aria-pressed={!hidden.includes(resource)} onClick={() => setHidden(values => values.includes(resource) ? values.filter(value => value !== resource) : [...values, resource])}><Avatar name={resource} size="xs" decorative/>{resource}</Button>)}</div>}
    </Card>
    {mode === 'list' ? <ErpWorklist def={def} page={page} onOpen={onOpen}/> : <>
      {partial ? <p role="alert">{t('The schedule is incomplete. Reload before booking.')}</p> : null}
      {result.error ? <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/> : result.loading ? <LoadingState/> : <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_256px]">
        <ResourceTimeline geometry={{slotHeight:30,timeWidth:56,resourceWidth:170,headerHeight:49,eventInset:4,eventGap:3}} labelEvery={2} renderResource={(resource, events)=><span className="erp-calendar-resource"><Avatar name={resource.label} size="xs" decorative/><span className="erp-calendar-resource-copy"><span>{resource.label}</span><small>{format.number(events.filter(event=>!event.inactive).length)} {t('booked')}</small></span></span>} eventClassName={event=>`erp-booking-event erp-booking-${String(event.row.status).toLowerCase().replaceAll(' ','-')}`} label={def.title} resources={resources.map(resource => ({id: resource, label: resource}))} events={rows.map(row => ({id: row.id, resource: String(row.resource), start: timeMinutes(row.start), duration: Number(row.duration || 30), label: String(row.person ?? row.code), detail: `${format.time(row.start)} · ${t(row.type ?? '')}`, inactive: row.status === 'Cancelled', row}))} now={date === localDay(now) ? now.getHours() * 60 + now.getMinutes() : undefined} disabled={!host.can('create') || partial} slotLabel={(resource, time) => t('Book {value0} at {value1}', {value0: resource.label, value1: time})} onSlot={book} onOpen={event => open(event.row)}/>
        <Card className="erp-booking-upcoming"><header><h2>{t(date === localDay(now) ? 'Up next today' : 'Booked')}</h2><p>{format.number(rows.filter(row=>row.status!=='Cancelled').length)} {t(def.title)} · {format.number(resources.length)} {t('Resources')}</p></header><ul>{upcoming.map(row => <li key={row.id}><Button variant="ghost" onClick={() => open(row)}><time>{format.time(row.start)}</time><span><strong>{row.person}</strong><small>{row.resource}</small></span></Button></li>)}{!upcoming.length ? <li className="erp-booking-empty">{t('Nothing else booked. Click any free slot to add one.')}</li> : null}</ul></Card>
      </div>}
    </>}
    {variant === 'erp1' && current && (current.mode || current.recordId) ? <RecordEditor def={def} target={current} onOpen={onOpen} onClose={onClose} onSaved={row => {setDate(String(row.date)); result.reload(); open(row);}}/>:null}
  </div>;
}
