import {useState} from 'react';
import {Button, Checkbox, DateInput, Input, Select} from '@pepbits/ui';
import {Card, Modal, LoadingState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import {useLocalization} from '@pepbits/i18n/react';
import type {PersonalViewLayout, WorklistFilterControls, WorklistViewControls} from '@pepbits/page-engines/worklist';
import {useStoredState, useFetch, listUrl} from './client';
import {useKeystone} from './context';
import {listFields} from './registry';
import type {Field, Filters, PageDef, ListResponse} from './types';

export const filterFields = (def: PageDef) => def.fields.filter(field => field.type !== 'code' && field.type !== 'textarea' && (field.filter || field.key === def.quickFilter || ['date', 'number', 'currency', 'percent', 'boolean'].includes(field.type)));
// String transport belongs to the shared worklist. Structured source conditions remain ERP-owned.
export const decodeCondition = (value: string): unknown => {try {return value.startsWith('json:') ? JSON.parse(value.slice(5)) : value;} catch {return '';}};
export const encodeCondition = (value: unknown): string => typeof value === 'string' && !value.startsWith('json:') ? value : 'json:' + JSON.stringify(value);
export const activeCondition = (value: unknown): boolean => value != null && value !== '' && (Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? Object.values(value).some(item => item != null && item !== '') : true);
export function sourceFilters(def: PageDef, values: Record<string, string>): Filters {
  return Object.fromEntries(filterFields(def).flatMap(field => {
    const value = decodeCondition(values[field.key] ?? '');
    return activeCondition(value) ? [[field.key, field.options && typeof value === 'string' ? [value] : value]] : [];
  }));
}
interface SourceView {
  name: string; q: string; quick: string | null; filters: Filters;
  /** Additive snapshot metadata accepted by the bounded source view-state contract. */
  snapshot?: {criteria: Filters; columns: string[]; sort: PersonalViewLayout['sort']; kind: 'view' | 'columns'};
}
export function restoreView(def: PageDef, view: SourceView, current: PersonalViewLayout): PersonalViewLayout {
  const known = new Set(filterFields(def).map(field => field.key));
  const criteria = view.snapshot?.criteria ?? {...view.filters, ...(view.quick && def.quickFilter ? {[def.quickFilter]: [view.quick]} : {})};
  const columns = Array.isArray(view.snapshot?.columns) ? view.snapshot.columns.filter(key => listFields(def).some(field => field.key === key)) : undefined;
  const sort = view.snapshot?.sort;
  return {...current, filters: view.snapshot?.kind === 'columns' ? current.filters : {...Object.fromEntries(Object.entries(criteria).filter(([key]) => known.has(key)).map(([key, value]) => [key, encodeCondition(value)])), ...(view.q ? {query: view.q} : {})}, columns: columns?.length ? columns : current.columns, sort: sort && listFields(def).some(field => field.key === sort.key) && ['asc', 'desc'].includes(sort.direction) ? sort : view.snapshot ? null : current.sort};
}

export function ErpPersonalViews({def, layout, onApply}: {def: PageDef} & WorklistViewControls) {
  const {preferences} = usePreferences(), {t} = useLocalization();
  const account = useStoredState<SourceView[]>('keystone.views.' + def.slug, [], {persist: preferences.rememberFilters});
  const session = useStoredState<SourceView[]>('session.keystone.views.' + def.slug, [], {persist: false});
  const [views, setViews, state] = preferences.rememberFilters ? account : session;
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const busy = state.persisted && state.status !== 'idle';
  const save = (kind: 'view' | 'columns') => {
    if (busy || !name.trim()) return;
    const criteria = kind === 'columns' ? {} : sourceFilters(def, layout.filters);
    const next: SourceView = {name: name.trim(), q: kind === 'columns' ? '' : layout.filters.query ?? '', quick: null,
      filters: Object.fromEntries(Object.entries(criteria).filter(([key]) => def.fields.some(field => field.key === key && field.filter) || key === def.quickFilter)),
      snapshot: {criteria, columns: layout.columns, sort: layout.sort, kind}};
    const updated = [...views.filter(view => view.name !== next.name), next];
    if (updated.length > 30 || JSON.stringify(updated).length > 20000 || next.q.length > 200) {setError(t('Saved views exceed the account limit. Remove a view or shorten the filters.')); return;}
    setViews(updated);setName('');setError('');
  };
  return <><Button data-erp-saved-views onClick={() => setOpen(true)}>{t('Saved views')}</Button>
    <Modal open={open} onClose={() => setOpen(false)} title="Saved views" size="lg">
      <p>{t(preferences.rememberFilters ? 'Views are saved to your account for this module and branch.' : 'Remember filters is off. Views are kept in this session only.')}</p>
      {state.persisted && state.status !== 'idle' && <div role={state.status === 'error' ? 'alert' : 'status'}>{state.error ?? t(state.status === 'loading' ? 'Loading saved views…' : 'Saving…')}{state.status === 'error' && <Button onClick={state.retry}>{t('Retry')}</Button>}</div>}
      {error && <p role="alert">{error}</p>}
      <Input label="View name" maxLength={60} value={name} onChange={event => setName(event.target.value)}/>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !name.trim()} onClick={() => save('view')}>{t('Save current view')}</Button><Button disabled={busy || !name.trim()} onClick={() => save('columns')}>{t('Save column set')}</Button></div>
      <ul className="erp-record-documents">{views.map((view, index) => <li key={index}><span>{view.name}</span><Button disabled={busy} onClick={() => {onApply(restoreView(def, view, layout));setOpen(false);}}>{t('Apply')} {view.name}</Button><Button disabled={busy} onClick={() => {if (!busy) setViews(views.filter((_, i) => i !== index));}}>{t('Delete')} {view.name}</Button></li>)}</ul>
      {!views.length && !busy && <p>{t('No saved views yet.')}</p>}
    </Modal>
  </>;
}

function FilterField({field, value, onChange}: {field: Field; value: unknown; onChange: (value: unknown) => void}) {
  const {t} = useLocalization();
  if (field.type === 'ref' && field.ref) return <ReferenceFilter field={field} value={value} onChange={onChange}/>;
  if (field.options || field.pool) {
    const options = field.options ?? field.pool ?? [], selected = Array.isArray(value) ? value : value ? [value] : [];
    return <fieldset className="min-w-0 space-y-1"><legend>{t(field.label)}</legend><div className="max-h-40 overflow-auto">{options.map(option => <Checkbox key={option} label={option} checked={selected.includes(option)} onChange={event => onChange(event.target.checked ? [...selected, option] : selected.filter(item => item !== option))}/>)}</div></fieldset>;
  }
  if (field.type === 'date' || ['number', 'currency', 'percent'].includes(field.type)) {
    const range = value && typeof value === 'object' ? value as Record<string, string> : {}, keys = field.type === 'date' ? ['from', 'to'] : ['min', 'max'];
    return <div className="space-y-1">{keys.map(key => field.type === 'date' ? <DateInput key={key} label={`${field.label} ${key}`} value={range[key] ?? ''} onChange={event => onChange({...range, [key]: event.target.value})}/> : <Input key={key} type="number" label={`${field.label} ${key}`} value={range[key] ?? ''} onChange={event => onChange({...range, [key]: event.target.value === '' ? '' : Number(event.target.value)})}/>)}</div>;
  }
  if (field.type === 'boolean') return <Select label={field.label} value={value === true ? 'true' : value === false ? 'false' : ''} options={[{value: '', label: 'Any'}, {value: 'true', label: 'Yes'}, {value: 'false', label: 'No'}]} onChange={event => onChange(event.target.value === '' ? '' : event.target.value === 'true')}/>;
  return <Input label={field.label} value={String(value ?? '')} maxLength={200} onChange={event => onChange(event.target.value)}/>;
}
function ReferenceFilter({field, value, onChange}: {field: Field; value: unknown; onChange: (value: unknown) => void}) {
  const result = useFetch<ListResponse>(listUrl(field.ref!, {size: 1000})), [search, setSearch] = useState(''), {t} = useLocalization();
  if (result.error) return <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/>;
  if (!result.data) return <LoadingState/>;
  const options = result.data.rows.map(row => String(row.name ?? row.code ?? row.id)).filter(option => option.toLowerCase().includes(search.toLowerCase()));
  return <div><Input label={'Find ' + field.label} value={search} onChange={event => setSearch(event.target.value)}/><FilterField field={{...field,type:'select',options}} value={value} onChange={onChange}/>{result.data.total > result.data.rows.length && <p>{t('Results are incomplete')}</p>}</div>;
}
export function ErpFilters({def, values, onChange, onReset, hideParent=false}: {def: PageDef;hideParent?:boolean} & WorklistFilterControls) {
  const {t} = useLocalization(), [open, setOpen] = useState(false);
  const first = def.fields.filter(field => field.filter && field.key !== def.parent?.key).slice(0, 3), basic = [...first, ...def.fields.filter(field => field.key === def.quickFilter && !first.includes(field))], fields = filterFields(def);
  const count = Object.keys(sourceFilters(def, values)).length;
  return <Card as="section" className="space-y-3 p-3">{def.parent && !hideParent && <ParentContext def={def} values={values} onChange={onChange}/>}{!open && <div className="grid gap-3 md:grid-cols-3">{basic.map(field => {
    const decoded = decodeCondition(values[field.key] ?? ''), multiple = Array.isArray(decoded), value = multiple ? decoded.length === 1 ? String(decoded[0]) : '__multiple' : String(decoded ?? '');
    return field.options ? <Select key={field.key} label={field.label} value={value} placeholder="All" options={[...field.options.map(value => ({value, label: value})), ...(multiple && decoded.length > 1 ? [{value: '__multiple', label: decoded.join(', ')}] : [])]} onChange={event => onChange(field.key, encodeCondition(event.target.value))}/> : <Input key={field.key} label={field.label} value={value} maxLength={200} onChange={event => onChange(field.key, encodeCondition(event.target.value))}/>;
  })}</div>}
    <Button data-erp-advanced-filters aria-expanded={open} onClick={() => setOpen(value => !value)}>{t('Advanced filters')} ({count})</Button><Button onClick={onReset}>{t('Reset filters')}</Button>
    {open && <div className="grid gap-3 md:grid-cols-3">{fields.map(field => <FilterField key={field.key} field={field} value={decodeCondition(values[field.key] ?? '')} onChange={value => onChange(field.key, activeCondition(value) ? encodeCondition(value) : '')}/>)}</div>}
  </Card>;
}

function ParentContext({def, values, onChange}: {def: PageDef; values: Record<string, string>; onChange: WorklistFilterControls['onChange']}) {
  const parent = def.parent!, {variant} = useKeystone(), {t} = useLocalization(), [search, setSearch] = useState('');
  const parents = useFetch<ListResponse>(listUrl(parent.entity, {size: 500})), counts = useFetch<ListResponse>(listUrl(def.entity, {size: 1, facet: parent.key}));
  if (parents.error || counts.error) return <RecoveryNotice failure={failureFromError(new Error(parents.error ?? counts.error ?? ''))} onRetry={() => {parents.reload();counts.reload();}}/>;
  if (!parents.data || !counts.data) return <LoadingState/>;
  const selected = decodeCondition(values[parent.key] ?? '');
  if (variant === 'erp2') return <Select label={parent.label} value={Array.isArray(selected) ? String(selected[0] ?? '') : String(selected ?? '')} placeholder="All" options={parents.data.rows.map(row => ({value: String(row.name), label: `${row.name} (${counts.data!.facets[row.name] ?? 0})`}))} onChange={event => onChange(parent.key, event.target.value ? encodeCondition([event.target.value]) : '')}/>;
  return <section aria-label={t('Parent records')}><h2>{t(parent.label)}</h2><Input label={'Find ' + parent.label} value={search} onChange={event => setSearch(event.target.value)}/>
    <div className="flex max-h-52 flex-wrap gap-2 overflow-auto"><Button aria-pressed={!activeCondition(selected)} onClick={() => onChange(parent.key, '')}>{t('All')} ({counts.data.total})</Button>{parents.data.rows.filter(row => `${row.name} ${row.code}`.toLowerCase().includes(search.toLowerCase())).map(row => <Button key={row.id} variant="ghost" aria-pressed={Array.isArray(selected) ? selected.includes(row.name) : selected === row.name} onClick={() => onChange(parent.key, encodeCondition([String(row.name)]))}>{row.name} ({counts.data!.facets[row.name] ?? 0})</Button>)}</div>
    {parents.data.total > parents.data.rows.length && <p role="status">{t('Results are incomplete')}</p>}
  </section>;
}
