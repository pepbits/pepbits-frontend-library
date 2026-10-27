import {MetricTile} from '@pepbits/components/dashboard-visuals';
import {useEffect, useState} from 'react';
import {TemplateReport, type ReportFilters} from '@pepbits/page-engines/templates';
import {downloadGrid} from '@pepbits/page-engines/worklist';
import type {PageDefinition, PageTemplateDefinition, TemplateDocument} from '@pepbits/page-engines/types';
import {Button, Input, Select} from '@pepbits/ui';
import {Card, LoadingState, Pagination, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {formatCompactMoney} from '@pepbits/i18n';
import './workspace-reports.css';
import {useNavigation} from '@pepbits/platform/navigation';
import {useFetch, listUrl} from './client';
import {useValueFormat} from './fields';
import {useKeystone} from './context';
import {PAGES} from './catalog';
import {useReportColumns} from './report-columns';
import {ErpPersonalViews, encodeCondition, sourceFilters} from './personal-views';
import {ReportFilterPanel} from './report-filters';
import {pageId} from '../../navigation';
import {PERIODS, periodRange, ledgerStatement} from './analysis-model';
import type {PageDef, ListResponse, Row, Filters} from './types';
export function AnalyticsPage({def}: {def: PageDef; page: PageDefinition}) {
  const {t} = useLocalization(), {preferences,isLocked,allowedValues,update} = usePreferences(), format = useFormatters(), valueFormat = useValueFormat(), host = useScreenHost(), navigation = useNavigation(), {variant} = useKeystone();
  const ledger = def.template === 'ledger', partyField = ledger ? def.fields.find(field => field.type === 'ref') : undefined, partyResult = useFetch<ListResponse>(partyField?.ref ? listUrl(partyField.ref,{size:1000}) : null), parties = partyResult.data?.rows.map(row => String(row.name ?? row.code ?? row.id)) ?? [];
  const [party,setParty] = useState(''), [preset,setPreset] = useState(ledger ? 'year' : 'all'), [range,setRange] = useState<[string,string]>(() => periodRange(ledger ? 'year' : 'all')), [query,setQuery] = useState(''), [group,setGroup] = useState(''), [filters,setFilters] = useState<ReportFilters>({}), [advanced,setAdvanced] = useState(false), [page,setPage] = useState(1), [exportError,setExportError] = useState<unknown>();
  const columnLayout = useReportColumns(def), {sort,setSort} = columnLayout;
  useEffect(() => {if (ledger && !party && parties[0]) setParty(parties[0]);},[ledger,party,parties]);
  const hasDates = def.fields.some(field => field.key === 'date'), validRange = !hasDates || !ledger && ['all','advanced'].includes(preset) || !!range[0] && !!range[1] && range[0] <= range[1];
  const requested: Filters = ledger ? {[partyField!.key]:[party]} : {...filters,...(hasDates && !['all','advanced'].includes(preset) ? {date:{from:range[0],to:range[1]}} : {})};
  const result = useFetch<ListResponse>(!validRange || ledger && !party ? null : listUrl(def.entity,{size:5000,filters:requested,sort:ledger ? 'date' : sort?.key,dir:ledger ? 'asc' : sort?.direction,...(!ledger ? {q:query} : {})}));
  const readError = partyResult.error ?? result.error;
  const rows = result.data?.rows ?? [], complete = !!result.data && result.data.total <= rows.length;
  const statement = ledgerStatement(rows,range[0],range[1]);
  const shown = ledger ? statement.lines.filter(row => !query || `${row.code} ${row.type} ${row.narration}`.toLowerCase().includes(query.toLowerCase())) : group ? [...rows].sort((a,b) => String(a[group] ?? '—').localeCompare(String(b[group] ?? '—'),preferences.language)) : rows;
  const groupTotals: Record<string,Record<string,number>> = Object.create(null);
  if (group && complete) for (const row of rows) {const name = String(row[group] ?? '—');groupTotals[name] ??= {};for (const field of def.fields.filter(field => ['currency','number'].includes(field.type))) groupTotals[name]![field.key] = (groupTotals[name]![field.key] ?? 0) + Number(row[field.key] || 0);}
  const money = def.fields.filter(field => field.type === 'currency').slice(0,3), numbers = [...money,...(money.length<3?def.fields.filter(field=>field.type==='number').slice(-1):[])].slice(0,3), totals = ledger ? {debit:statement.debit,credit:statement.credit,balance:statement.closing} : result.data?.totals ?? {};
  const fields = ledger ? def.fields.filter(field => field.list !== false) : columnLayout.visibleKeys.flatMap(key => def.fields.filter(field => field.key === key)), groupFields = def.fields.filter(field => ['select','status','ref','person'].includes(field.type));
  const maxPage = Math.max(1,Math.ceil(shown.length / preferences.pageSize)), currentPage = Math.min(page,maxPage), visible = shown.slice((currentPage - 1) * preferences.pageSize,currentPage * preferences.pageSize);
  const definition: PageTemplateDefinition = {id:def.slug,group:def.group,engine:'report',title:def.title,description:def.description,layout:'rail',view:'table',sections:[],stages:[],tags:[],editable:false,columns:[...fields.map(field => ({key:field.key,label:field.label,type:(field.type === 'currency' ? 'money' : ['number','date','status'].includes(field.type) ? field.type : 'text') as 'money'|'number'|'date'|'status'|'text'})),...(ledger ? [{key:'balance',label:'Balance',type:'money' as const}] : [])],configuration:{reportDateKey:null,reportAmountKey:null}};
  const owner = variant === 'erp2' && def.view ? PAGES.find(page => page.entity === def.entity && !page.view) : undefined;
  const exportRows = () => {
    if (!host.can('export') || !complete || !validRange || result.loading || readError) return;
    try {setExportError(undefined);
      const toGrid = (row: Row) => [...fields.map(field => ['currency','number','percent'].includes(field.type) ? Number(row[field.key] || 0) : valueFormat(field,row[field.key])),...(ledger ? [Number(row.balance)] : [])];
      // A ledger export is the complete statement; text search never changes its balances.
      const data = (ledger ? statement.lines : shown).map(toGrid);
      if (ledger) {data.unshift(toGrid({id:'opening',code:t('Opening balance'),date:range[0],balance:statement.opening} as Row));data.push(toGrid({id:'closing',code:t('Closing balance'),date:range[1],debit:statement.debit,credit:statement.credit,balance:statement.closing} as Row));}
      else data.push(fields.map((field,index) => index === 0 ? t('Total') : totals[field.key] ?? ''));
      downloadGrid(definition.columns.map(column => t(column.label)),data,preferences.exportFormat,def.slug);
    } catch (error) {setExportError(error);}
  };
  const drcr = (value:number) => `${format.money(Math.abs(value))} ${t(value >= 0 ? 'Dr' : 'Cr')}`;
  const metricValue=(field:typeof numbers[number],value:number)=>field.type==='currency'?formatCompactMoney(preferences,value):format.number(value);
  const statistics=complete&&!result.loading&&!readError&&validRange?<div className="erp-report-stats" data-report-statistics>{ledger?<><MetricTile label="Opening balance" value={drcr(statement.opening)} hint={t('As on {value0}',{value0:format.date(range[0])})}/><MetricTile label="Debits in period" value={format.money(statement.debit)} color="var(--primary)" hint={t('{value0} invoices',{value0:format.number(statement.lines.filter(row=>row.debit).length)})}/><MetricTile label="Credits in period" value={format.money(statement.credit)} color="var(--success)" hint={t('{value0} receipts and notes',{value0:format.number(statement.lines.filter(row=>row.credit).length)})}/><MetricTile label="Closing balance" value={drcr(statement.closing)} color={statement.closing>0?'var(--warning)':'var(--success)'} hint={statement.closing>0?'Receivable from customer':'Advance held'}/></>:<><MetricTile label="Records in view" value={format.number(result.data!.total)} hint="After search and filters"/>{numbers.map((field,index)=><MetricTile key={field.key} label={t('Total {field}',{field:t(field.label)})} value={metricValue(field,Number(totals[field.key]??0))} color={['var(--success)','var(--warning)','var(--danger)'][index]} hint={result.data!.total?t('Avg {amount} per row',{amount:metricValue(field,field.type==='currency'?Number(totals[field.key]??0)/result.data!.total:Math.round(Number(totals[field.key]??0)/result.data!.total))}):undefined}/>)}</>}</div>:null;
  return <section data-erp-analytics={ledger?'ledger':'report'} data-density={preferences.density} className="erp-analytics space-y-3" aria-busy={result.loading || partyResult.loading}><h1 className="sr-only">{t(def.title)}</h1>{!ledger&&statistics}<Card data-report-toolbar className="erp-report-toolbar flex flex-wrap items-end gap-2 px-3 py-2.5">
    {ledger ? <Select label={partyField!.label} value={party} options={parties.map(value => ({value,label:value}))} onChange={event => {setParty(event.target.value);setPage(1);}}/> : null}
    {hasDates ? <><Select label="Period" value={preset} options={[...PERIODS,...(filters.date ? [{value:'advanced',label:'Advanced date range'}] : [])]} onChange={event => {if (event.target.value === 'advanced') return;setPreset(event.target.value);setFilters(values => {const next = {...values};delete next.date;return next;});if (event.target.value !== 'custom') setRange(periodRange(event.target.value));setPage(1);}}/>{preset === 'custom' ? <><Input label="From" type="date" value={range[0]} max={range[1]} onChange={event => {setRange([event.target.value,range[1]]);setPage(1);}}/><Input label="To" type="date" value={range[1]} min={range[0]} onChange={event => {setRange([range[0],event.target.value]);setPage(1);}}/></> : null}</> : null}
    <Input label="Search" value={query} onChange={event => {setQuery(event.target.value);setPage(1);}}/>
    {!ledger ? <><Select label="Group by" value={group} options={[{value:'',label:'No grouping'},...groupFields.map(field => ({value:field.key,label:field.label}))]} onChange={event => {setGroup(event.target.value);setPage(1);}}/>{def.fields.filter(field => field.filter && ['select','status'].includes(field.type)).map(field => <Select key={field.key} label={field.label} value={Array.isArray(filters[field.key]) && (filters[field.key] as string[]).length > 0 ? (filters[field.key] as string[]).length > 1 ? '__multiple' : String((filters[field.key] as string[])[0]) : ''} options={[{value:'',label:'All'},...(Array.isArray(filters[field.key]) && (filters[field.key] as string[]).length > 1 ? [{value:'__multiple',label:'Multiple values'}] : []),...(field.options ?? []).map(value => ({value,label:value}))]} onChange={event => {if (event.target.value === '__multiple') return;setFilters(values => ({...values,[field.key]:event.target.value ? [event.target.value] : []}));setPage(1);}}/>)}</> : null}
    {!ledger ? <><Button aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}>{t('Advanced filter')}</Button><Button onClick={() => {setFilters({});setQuery('');setPreset('all');setRange(periodRange('all'));setSort(null);setGroup('');setPage(1);}}>{t('Clear filters')}</Button></> : null}
    {!ledger && <>{columnLayout.controls}<ErpPersonalViews def={def} layout={{filters:{query,...Object.fromEntries(Object.entries(requested).map(([key,value])=>[key,encodeCondition(value)]))},columns:columnLayout.visibleKeys,sort,pageSize:preferences.pageSize}} onApply={layout=>{const restored=sourceFilters(def,layout.filters);setQuery(layout.filters.query??'');setFilters(restored as ReportFilters);setPreset(restored.date?'advanced':'all');columnLayout.setVisibleKeys(layout.columns);setSort(layout.sort);setPage(1);}}/></>}
    <Button onClick={exportRows} disabled={!host.can('export') || !complete || !validRange || result.loading || !!readError}>{t('Export')} {preferences.exportFormat.toUpperCase()}</Button>
  </Card>{ledger&&statistics}
  {advanced && !ledger ? <ReportFilterPanel fields={def.fields} value={{...filters,...(!['all','advanced'].includes(preset) ? {date:{from:range[0],to:range[1]}} : {})}} onClose={() => setAdvanced(false)} onApply={values => {setFilters(values);setPreset(values.date ? 'advanced' : 'all');setAdvanced(false);setPage(1);}}/> : null}
  {!ledger && Object.keys(filters).length ? <p role="status">{t('Applied filters')}: {def.fields.filter(field => filters[field.key] !== undefined && JSON.stringify(filters[field.key]) !== '[]').map(field => t(field.label)).join(', ')}</p> : null}
  {!validRange ? <p role="alert">{t('Choose a valid date range')}</p> : readError ? <RecoveryNotice failure={failureFromError(new Error(readError))} onRetry={() => partyResult.error ? partyResult.reload() : result.reload()}/> : result.loading ? <LoadingState/> : <>
    {ledger && !partyResult.loading && !parties.length ? <p role="status">{t('No customers available')}</p> : null}
    {result.data && !complete ? <p role="alert">{t('Too many rows. Narrow the filters before using totals or export.')}</p> : null}
    {ledger && complete ? <p>{t('Opening balance')} · {format.date(range[0])} · {drcr(statement.opening)}</p> : null}
    <div data-report-surface><TemplateReport preferences={preferences} definition={definition} document={{id:def.slug,version:0,values:{},lines:[],rows:visible} as TemplateDocument} update={() => {}} disabled errors={{}} format={format} density={preferences.density} precision={preferences.decimalPlaces} pageSize={preferences.pageSize} resultView={preferences.resultView} groupBy={group || undefined} groupTotals={complete ? groupTotals : undefined} sort={sort} onSort={!ledger ? key => {setSort(old => old?.key === key ? old.direction === 'asc' ? {key,direction:'desc'} : null : {key,direction:'asc'});setPage(1);} : undefined} totals={complete ? totals : undefined} footerLabel={ledger ? 'Closing balance' : 'Total'} onRowClick={owner ? row => navigation.open({pageId:pageId(variant,owner),recordId:String(row.id),mode:'view'}) : undefined}/></div>
    <Pagination page={currentPage} pageSize={preferences.pageSize} total={shown.length} onPageChange={setPage} onPageSizeChange={pageSize => {if (!isLocked('pageSize')) {void update({pageSize});setPage(1);}}} pageSizeDisabled={isLocked('pageSize')} allowedPageSizes={allowedValues('pageSize')}/>
  </>}{exportError ? <RecoveryNotice failure={failureFromError(exportError)} onRetry={exportRows}/> : null}</section>;
}
