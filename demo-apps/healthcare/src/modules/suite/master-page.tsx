import React, {useMemo, useState} from 'react';
import {WorklistPage, type WorklistAdapter} from '@pepbits/page-engines/worklist';
import {RecordPage, RecordIdentity} from '@pepbits/page-engines/record-page';
import {TemplateFields} from '@pepbits/page-engines/templates';
import type {PageDefinition, TemplateSection, TemplateField, TemplateValue, WorklistConfig} from '@pepbits/page-engines/types';
import type {NavigationTarget} from '@pepbits/platform/navigation';
import {DescriptionList, RecoveryNotice, failureFromError} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {useRequest} from '../../adapters/http';
import {useSuiteHost, useSuiteRouter, suiteScopeKey} from './host';
import {useApiClient, qs, ApiError} from './lib/api';
import {useApi} from './lib/hooks';
import {useSession} from './lib/session';
import {MASTERS, type MasterDef, type FieldDef} from './lib/masters';
import type {Row, Page} from './lib/types';
import {Field} from './components/ui/controls';
import {DaysPicker} from './components/masters/DaysPicker';
import {RefSelect} from './components/masters/RefSelect';
import {Spinner} from './components/ui/display';

export function masterWorklist(def: MasterDef, pageId: string): WorklistConfig {
  return {id: pageId, entity: def.entity, title: def.title, description: def.description, primaryKey: 'id', displayKey: 'name', rows: [],
    basicFilters: [{key: 'status', label: 'Status', type: 'select', classification: 'operational', options: ['Active', 'Inactive', 'All']}], advancedFilters: [],
    columns: def.columns.map(column => ({key: column.key, label: column.header, sortable: true, defaultVisible: true,
      classification: ['name', 'phone', 'email', 'licenseNo'].includes(column.key) ? 'pii' : 'operational',
      type: ['money', 'number', 'percent', 'date', 'status'].includes(column.kind ?? '') ? column.kind as 'money' | 'number' | 'percent' | 'date' | 'status' : 'text'}))};
}
export function SuiteMasterPage({page, target}: {page: PageDefinition; target: NavigationTarget}) {
  const def = MASTERS[page.entity!]!, api = useApiClient(), host = useSuiteHost(), request = useRequest();
  const config = useMemo(() => masterWorklist(def, page.id), [def, page.id]);
  const adapter = useMemo<WorklistAdapter>(() => ({identity: suiteScopeKey(host.scope), applicationId: host.scope.applicationId,
    sessionAvailable: true, actor: {id: host.scope.userId, tenantId: host.scope.tenantId}, request: async (path, init) => {
      if (path !== '/worklists/search') return request(path, init);
      const body = JSON.parse(String(init?.body ?? '{}'));
      try {
        const filters = {...body.safeFilters, ...body.sensitiveFilters};
        const result = await api<Page>(`/masters/${def.entity}${qs({search: filters.query, status: filters.status ?? 'All', page: body.page, pageSize: body.pageSize, sort: body.sort?.key, dir: body.sort?.direction})}`, {signal: init?.signal ?? undefined});
        return Response.json({rows: result.data, total: result.total, page: result.page});
      } catch (error) {return Response.json({error: 'Master data could not be loaded.'}, {status: error instanceof ApiError && error.status ? error.status : 503});}
    }}), [host.scope, api, def.entity, request]);
  return target.mode || target.recordId ? <MasterRecord key={JSON.stringify(target)} def={def} target={target}/> : <WorklistPage page={page} config={config} adapter={adapter}/>;
}
function MasterRecord({def, target}: {def: MasterDef; target: NavigationTarget}) {
  const router = useSuiteRouter(), api = useApiClient(), {session} = useSession(), format = useFormatters(), {t} = useLocalization();
  const loading = useApi<Row>(target.recordId ? `/masters/${def.entity}/${encodeURIComponent(target.recordId)}` : null);
  const defaults = Object.fromEntries(def.sections.flatMap(section => section.fields.map(field => [field.key, field.defaultValue ?? (field.type === 'checkbox' ? false : '')]))) as Row;
  const [draft, setDraft] = useState<Row | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [errors, setErrors] = useState<Record<string, string>>({});
  const [active, setActive] = useState('section-0');
  const value = draft ?? loading.data ?? defaults;
  const readOnly = target.mode === 'view' || session?.canWrite !== true;
  const fields = def.sections.flatMap(section => section.fields);
  const set = (field: FieldDef, next: TemplateValue, meta?: Row) => {
    if (readOnly || busy) return;
    const updated = {...value, [field.key]: field.key === 'code' ? String(next).toUpperCase() : next};
    for (const dependent of fields) if (dependent.ref?.filterBy && Object.values(dependent.ref.filterBy).includes(field.key)) updated[dependent.key] = '';
    if (field.onPick) Object.assign(updated, field.onPick(meta));
    setDraft(updated);
  };
  const save = async () => {
    if (readOnly || busy) return;
    setBusy(true); setError(null); setErrors({});
    try {
      const saved = await api<Row>(`/masters/${def.entity}${target.recordId ? '/' + encodeURIComponent(target.recordId) : ''}`, {method: target.recordId ? 'PUT' : 'POST', body: value});
      router.push(`/masters/${def.entity}/${saved.id}`);
    } catch (failure) {setError(failure); if (failure instanceof ApiError) setErrors(failure.fields);}
    finally {setBusy(false);}
  };
  if (target.recordId && !loading.data) return loading.error ? <RecoveryNotice failure={failureFromError(loading.error)} onRetry={loading.reload}/> : <Spinner label="Loading"/>;
  const sections = def.sections.map((section, index) => ({id: 'section-' + index, title: section.title, heading: section.title, fields: section.fields}));
  const fieldType = (field: FieldDef): TemplateField['type'] => ['money', 'percent'].includes(field.type) ? 'number' : ['ref', 'days'].includes(field.type) ? 'select' : field.type === 'tel' ? 'text' : field.type as TemplateField['type'];
  return <><h2 className="sr-only">{t(def.singular)}</h2><RecordPage sections={sections} active={active} onActive={setActive} showCompletion={false} isDone={() => false}
    identity={<RecordIdentity label={def.singular} name={String(value.name || value.code || t('New'))} reference={target.recordId}/>}
    feedback={error ? <RecoveryNotice failure={failureFromError(error)} onRetry={() => void save()}/> : undefined}
    actions={[{id: 'back', label: 'Back', onClick: () => {if (!draft || window.confirm(t('Discard unsaved changes?'))) router.push('/masters/' + def.entity);}},
      {id: 'save', label: 'Save', onClick: () => void save(), disabled: busy, hidden: readOnly, primary: true},
      {id: 'edit', label: 'Edit', onClick: () => router.push(`/masters/${def.entity}/${target.recordId}?mode=edit`), hidden: !readOnly || !session?.canWrite}]}
    renderSection={section => {
      const visible = section.fields.filter(field => !field.visibleIf || field.visibleIf(value));
      if (readOnly) return <DescriptionList items={visible.map(field => ({id: field.key, label: field.label, value: field.type === 'date' ? format.date(String(value[field.key] ?? '')) : ['number', 'money', 'percent'].includes(field.type) ? format.cell({type: field.type}, value[field.key]) : String(value[field.key] ?? '')}))}/>;
      const definition: TemplateSection = {id: section.id, title: section.title, fields: visible.map(field => ({id: field.key, label: field.label, type: fieldType(field), required: field.required, options: field.options?.map(option => ({value: option, label: option}))}))};
      return <TemplateFields section={definition} values={value} errors={errors} disabled={busy} onChange={(key, next) => set(fields.find(field => field.key === key)!, next)}
        renderField={item => {
          const field = fields.find(field => field.key === item.id)!;
          if (field.type === 'days') return <Field label={field.label} error={errors[field.key]}><DaysPicker disabled={busy} value={String(value[field.key] ?? '')} onChange={next => set(field, next)}/></Field>;
          if (!field.ref) return undefined;
          const filter = field.ref.filterBy;
          const params = filter && Object.values(filter).some(key => !value[key]) ? null : {...field.ref.staticFilter, ...Object.fromEntries(Object.entries(filter ?? {}).map(([key, source]) => [key, String(value[source] ?? '')]))};
          return <Field label={field.label} required={field.required} error={errors[field.key]}><RefSelect entity={field.ref.entity} params={params} disabled={busy} valueField={field.ref.valueField} value={String(value[field.key] ?? '')} onChange={(next, option) => set(field, next, option?.meta)}/></Field>;
        }}/>;
    }}/></>;
}
