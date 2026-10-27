import {useEffect, useRef, useState} from 'react';
import {EntryMatrix} from '@pepbits/page-engines/templates';
import {Card, Pagination, RecoveryNotice, failureFromError} from '@pepbits/components';
import {Avatar, Button, IconButton, Input, Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {useFetch, useEntityApi, listUrl} from './client';
import {matrixPeriod, moveMatrixPeriod, matrixSummary} from './analysis-model';
import {localDay} from './dates';
import {ChevronLeft,ChevronRight,RotateCcw,Save,Search,Wand2} from '@pepbits/icons';
import type {PageDef, Row, ListResponse} from './types';
import './transaction-matrix.css';
export function MatrixPage({def}: {def: PageDef}) {
  const kind = def.matrix!.kind, {t} = useLocalization(), format = useFormatters(), api = useEntityApi(), host = useScreenHost(), {preferences,isLocked,allowedValues,update} = usePreferences();
  const [period,setPeriod] = useState(() => matrixPeriod(kind)), [query,setQuery] = useState(''), [page,setPage] = useState(1), [drafts,setDrafts] = useState<Record<string,Row>>({}), [busy,setBusy] = useState(false), [failure,setFailure] = useState<unknown>();
  const pending = useRef(new Map<string,{signature:string;operationId:string}>()), live = useRef(true), access = useRef(host);access.current = host;
  useEffect(() => {live.current = true;return () => {live.current = false;};},[]);
  const fetched = useFetch<ListResponse>(listUrl(def.entity,{size:5000,period})), rows = fetched.data?.rows ?? [], dirty = Object.keys(drafts).length, cells: string[] = rows[0]?.columns ?? [], today = cells.indexOf(localDay());
  const presented = rows.map(row => drafts[row.id] ?? row), shown = presented.filter(row => `${row.name} ${row.code}`.toLowerCase().includes(query.toLowerCase())), currentPage = Math.min(page,Math.max(1,Math.ceil(shown.length / preferences.pageSize)));
  const complete = !!fetched.data && fetched.data.total <= rows.length;
  const disabled = busy || !host.can('edit') || fetched.loading || !!fetched.error || !complete;
  const change = (row:Row,index:number,value:string|number|null) => {if (disabled) return;setDrafts(values => ({...values,[row.id]:{...row,cells:row.cells.map((cell:unknown,i:number) => i === index ? value : cell)}}));};
  const save = async () => {
    if (disabled || !dirty) return;
    setBusy(true);setFailure(undefined);
    try {
      for (const row of Object.values(drafts)) {
        if (!live.current || !access.current.can('edit')) break;
        const signature = JSON.stringify([period,row.cells,row.version]), old = pending.current.get(row.id), command = old?.signature === signature ? old : {signature,operationId:crypto.randomUUID()};pending.current.set(row.id,command);
        const saved = await api.update(def.entity,row.id,{cells:row.cells,expectedVersion:row.version ?? 0,operationId:command.operationId},period);
        if (!live.current) return;
        pending.current.delete(row.id);setDrafts(values => {const next = {...values};delete next[row.id];return next;});
        fetched.setData(data => data ? {...data,rows:data.rows.map(item => item.id === saved.id ? saved : item)} : data);
      }
    } catch (error) {if (live.current) setFailure(error);} finally {if (live.current) setBusy(false);}
  };
  const move = (next:string) => {if (busy || dirty) return;setPeriod(next);setPage(1);setFailure(undefined);};
  const summary = (row:Row) => {const result = matrixSummary(kind,row.cells);return <div className="erp-matrix-summary" data-kind={kind}><strong data-low={kind==='attendance'&&result.percent!<75||undefined}>{kind==='attendance'?`${format.number(result.percent!)}%`:kind==='hours'?`${format.number(result.total)} ${t('h')}`:<>{result.grade} <span>{format.number(result.percent!)}%</span></>}</strong><small data-overtime={kind==='hours'&&!!result.overtime||undefined}>{kind==='attendance'?`P ${format.number(result.total)} A ${format.number(result.absent!)} L ${format.number(result.leave!)}`:kind==='hours'?result.overtime?`${format.number(result.overtime)} ${t('h')} ${t('Overtime').toLocaleLowerCase(preferences.language)}`:t('No overtime'):`${format.number(result.total)} ${t('of')} ${format.number(cells.length*100)}`}</small></div>;};
  const dimensions=cells.map(value=>{const date=new Date(value+'T00:00:00'),weekday=date.getDay();return {id:value,label:kind==='marks'?t(value):kind==='attendance'?format.number(date.getDate()):date.toLocaleDateString(preferences.language,{weekday:'short'}),hint:kind==='marks'?t('of 100'):kind==='attendance'?date.toLocaleDateString(preferences.language,{weekday:'narrow'}):format.number(date.getDate()),width:kind==='attendance'?32:kind==='hours'?64:96,current:value===localDay(),muted:kind!=='marks'&&(weekday===0||weekday===6)};});
  const colTotals = cells.map((_,index) => {const values = presented.map(row => row.cells[index]);if (kind === 'attendance') return values.filter(value => value === 'P').length;const numbers = values.filter(value => value !== null && value !== '').map(Number), sum = numbers.reduce((a,b) => a + b,0);return kind === 'hours' ? sum : numbers.length ? Math.round(sum / numbers.length) : 0;});
  const periodLabel=kind==='marks'?t(period):kind==='hours'?`${t('Week of')} ${format.date(period)}`:new Date(period+'-01T12:00:00').toLocaleDateString(preferences.language,{month:'long',year:'numeric'});
  return <section className="erp-matrix-page" data-reference-layout="fill" data-erp-matrix aria-busy={fetched.loading}><h1 className="sr-only">{t(def.title)}</h1><Card shadow="none" className="erp-matrix-toolbar">
    {kind === 'marks' ? <Select aria-label="Term" value={period} disabled={busy || !!dirty} options={['Term 1','Term 2','Final'].map(value => ({value,label:value}))} onChange={event => move(event.target.value)}/> : <div className="erp-matrix-period"><IconButton label="Previous period" disabled={busy || !!dirty} onClick={() => move(moveMatrixPeriod(kind,period,-1))}><ChevronLeft size={17} strokeWidth={1.8}/></IconButton><span data-matrix-period={period}>{periodLabel}</span><IconButton label="Next period" disabled={busy || !!dirty} onClick={() => move(moveMatrixPeriod(kind,period,1))}><ChevronRight size={17} strokeWidth={1.8}/></IconButton></div>}
    <Input aria-label="Search" placeholder="Find a person" prefix={<Search size={14}/>} value={query} onChange={event => {setQuery(event.target.value);setPage(1);}}/>
    {kind==='attendance'&&<div className="erp-matrix-legend">{(def.matrix?.values??[]).map(value=><span key={value} className={'erp-matrix-code-'+value}><b>{value}</b>{t(({P:'Present',A:'Absent',L:'Leave',H:'Half day',WO:'Week off'} as Record<string,string>)[value]??value)}</span>)}</div>}
    <span className="erp-matrix-toolbar-spacer" aria-hidden/>
    {kind === 'attendance' ? <Button size="sm" leftIcon={<Wand2 size={15}/>} disabled={disabled || today < 0} onClick={() => {if (disabled || today < 0) return;setDrafts(values => {const next = {...values};for (const row of presented) if (!row.cells[today]) next[row.id] = {...row,cells:row.cells.map((cell:unknown,index:number) => index === today ? 'P' : cell)};return next;});}}>{t('Mark all present today')}</Button> : null}
    {!!dirty&&<Button size="sm" leftIcon={<RotateCcw size={15}/>} disabled={busy} onClick={() => {setDrafts({});pending.current.clear();setFailure(undefined);}}>{t('Discard')}</Button>}<Button size="sm" variant="primary" loading={busy} leftIcon={<Save size={15}/>} disabled={disabled || !dirty} onClick={() => void save()}>{dirty?t(dirty===1?'Save {count} row':'Save {count} rows',{count:format.number(dirty)}):t('Save')}</Button>
    {!!dirty && <span role="status" className="sr-only">{format.number(dirty)} {t('unsaved rows. Save or discard before changing period.')}</span>}
  </Card>
  {failure || fetched.error ? <><RecoveryNotice failure={failureFromError(failure ?? new Error(fetched.error!))} onRetry={() => failure ? void save() : fetched.reload()}/>{(failure as {status?:number})?.status === 409 ? <Button disabled={busy} onClick={() => {setDrafts({});pending.current.clear();setFailure(undefined);fetched.reload();}}>{t('Discard and reload')}</Button> : null}</> : null}
  {fetched.data && !complete ? <p role="alert">{t('Too many rows. Narrow the filters before using totals or export.')}</p> : null}
  <EntryMatrix fillHeight loadingRows={preferences.loadingSkeletons?12:0} emptyCode="" emptyState={null} showTotalsWhenEmpty={rows.length>0} title={def.title} dimensions={dimensions} rows={shown.slice((currentPage - 1) * preferences.pageSize,currentPage * preferences.pageSize)} rowKey={row => row.id} rowLabel={row => String(row.name ?? row.code)} identityLabel={`${t(def.fields.find(field=>field.primary)?.label??'Name')} (${format.number(shown.length)})`} identity={row=><div className="erp-matrix-identity" data-dirty={!!drafts[row.id]||undefined}><Avatar name={String(row.name)} size="xs" decorative/><div><strong>{row.name}</strong><small>{row.code} {row.department??row.project??(row.section?`${t('Section')} ${row.section}`:'')}</small></div></div>} values={row => row.cells} disabled={disabled} loading={fetched.loading} max={kind === 'hours' ? 24 : 100} step={kind === 'hours' ? .5 : 1} options={kind === 'attendance' ? [...(def.matrix?.values ?? []).map(value => ({value,label:t(({P:'Present',A:'Absent',L:'Leave',H:'Half day',WO:'Week off'} as Record<string,string>)[value]??value)})),{value:'',label:t('Not marked')}] : undefined} onChange={change} summaryLabel="Summary" summary={summary} totalsLabel={kind==='attendance'?'Present':kind==='hours'?'Hours logged':'Class average'} totals={complete?colTotals.map(value=>value?format.number(value):''):undefined} cellClassName={value=>kind==='attendance'?'erp-matrix-code-'+(value||'blank'):kind==='marks'&&value!==null&&Number(value)<40?'erp-matrix-low':undefined}/>
  <Pagination page={currentPage} pageSize={preferences.pageSize} total={shown.length} onPageChange={setPage} onPageSizeChange={pageSize => {if (!isLocked('pageSize')) {void update({pageSize});setPage(1);}}} pageSizeDisabled={isLocked('pageSize')} allowedPageSizes={allowedValues('pageSize')}/>
  </section>;
}
