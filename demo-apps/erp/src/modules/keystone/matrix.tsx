import {useEffect, useRef, useState} from 'react';
import {EditableMatrix} from '@pepbits/page-engines/templates';
import {Card, Pagination, RecoveryNotice, failureFromError} from '@pepbits/components';
import {CollectionView} from '@pepbits/components/collection-view';
import {Button, Input, Select} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {useFetch, useEntityApi, listUrl} from './client';
import {useValueFormat} from './fields';
import {matrixPeriod, moveMatrixPeriod, matrixSummary} from './analysis-model';
import {localDay} from './dates';
import type {PageDef, Row, ListResponse} from './types';
export function MatrixPage({def}: {def: PageDef}) {
  const kind = def.matrix!.kind, {t} = useLocalization(), format = useFormatters(), valueFormat = useValueFormat(), api = useEntityApi(), host = useScreenHost(), {preferences,isLocked,allowedValues,update} = usePreferences();
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
  const summary = (row:Row) => {const result = matrixSummary(kind,row.cells);return kind === 'attendance' ? `${format.number(result.percent!)}% · P ${format.number(result.total)} · A ${format.number(result.absent!)} · L ${format.number(result.leave!)}` : kind === 'hours' ? `${format.number(result.total)} h · ${format.number(result.overtime!)} ${t('Hours overtime')}` : `${result.grade} · ${format.number(result.percent!)}% · ${format.number(result.total)}`;};
  const dimensionLabel = (value:string) => kind === 'marks' ? t(value) : format.date(value);
  const columns = def.fields.filter(field => field.list !== false).map(field => ({key:field.key,header:field.label,render:(row:Row) => valueFormat(field,row[field.key])}));
  const colTotals = cells.map((_,index) => {const values = presented.map(row => row.cells[index]);if (kind === 'attendance') return values.filter(value => value === 'P').length;const numbers = values.filter(value => value !== null && value !== '').map(Number), sum = numbers.reduce((a,b) => a + b,0);return kind === 'hours' ? sum : numbers.length ? Math.round(sum / numbers.length) : 0;});
  return <section className="space-y-3" data-erp-matrix aria-busy={fetched.loading}><h1>{t(def.title)}</h1><Card className="flex flex-wrap items-end gap-3 p-3">
    {kind === 'marks' ? <Select label="Term" value={period} disabled={busy || !!dirty} options={['Term 1','Term 2','Final'].map(value => ({value,label:value}))} onChange={event => move(event.target.value)}/> : <><Button disabled={busy || !!dirty} onClick={() => move(moveMatrixPeriod(kind,period,-1))}>{t('Previous period')}</Button><Input type={kind === 'attendance' ? 'month' : 'date'} label="Period" value={period} disabled={busy || !!dirty} onChange={event => {if (event.target.value) move(kind === 'hours' ? matrixPeriod(kind,event.target.value) : event.target.value);}}/><Button disabled={busy || !!dirty} onClick={() => move(moveMatrixPeriod(kind,period,1))}>{t('Next period')}</Button></>}
    <Input label="Search" value={query} onChange={event => {setQuery(event.target.value);setPage(1);}}/>
    {kind === 'attendance' ? <Button disabled={disabled || today < 0} onClick={() => {if (disabled || today < 0) return;setDrafts(values => {const next = {...values};for (const row of presented) if (!row.cells[today]) next[row.id] = {...row,cells:row.cells.map((cell:unknown,index:number) => index === today ? 'P' : cell)};return next;});}}>{t('Mark all present today')}</Button> : null}
    <Button disabled={disabled || !dirty} onClick={() => void save()}>{t('Save')}</Button><Button disabled={busy || !dirty} onClick={() => {setDrafts({});pending.current.clear();setFailure(undefined);}}>{t('Discard')}</Button>
    {!!dirty && <span role="status">{format.number(dirty)} {t('unsaved rows. Save or discard before changing period.')}</span>}
  </Card>
  {failure || fetched.error ? <><RecoveryNotice failure={failureFromError(failure ?? new Error(fetched.error!))} onRetry={() => failure ? void save() : fetched.reload()}/>{(failure as {status?:number})?.status === 409 ? <Button disabled={busy} onClick={() => {setDrafts({});pending.current.clear();setFailure(undefined);fetched.reload();}}>{t('Discard and reload')}</Button> : null}</> : null}
  {fetched.data && !complete ? <p role="alert">{t('Too many rows. Narrow the filters before using totals or export.')}</p> : null}
  <EditableMatrix columns={columns} dimensions={cells} dimensionLabel={dimensionLabel} rows={shown.slice((currentPage - 1) * preferences.pageSize,currentPage * preferences.pageSize)} rowKey={row => row.id} rowLabel={row => String(row.name ?? row.code)} values={row => row.cells} disabled={disabled} loading={fetched.loading} max={kind === 'hours' ? 24 : 100} step={kind === 'hours' ? .5 : 1} options={kind === 'attendance' ? [{value:'',label:'—'},...(def.matrix?.values ?? []).map(value => ({value,label:value}))] : undefined} onChange={change} summaryColumns={[{key:'summary',header:'Summary',render:summary}]}/>
  {complete ? <CollectionView rows={[{id:'totals'}]} rowKey={row => row.id} columns={[{key:'label',header:'Total',render:() => t(kind === 'attendance' ? 'Present' : kind === 'hours' ? 'Hours logged' : 'Class average')},...cells.map((cell,index) => ({key:cell,header:dimensionLabel(cell),render:() => format.number(colTotals[index]!)}))]}/> : null}
  <Pagination page={currentPage} pageSize={preferences.pageSize} total={shown.length} onPageChange={setPage} onPageSizeChange={pageSize => {if (!isLocked('pageSize')) {void update({pageSize});setPage(1);}}} pageSizeDisabled={isLocked('pageSize')} allowedPageSizes={allowedValues('pageSize')}/>
  </section>;
}
