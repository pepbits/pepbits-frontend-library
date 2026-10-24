import React, {useEffect, useMemo, useState} from 'react';
import {WorklistPage} from '@pepbits/page-engines/worklist';
import {DynamicRecordForm} from '@pepbits/page-engines/forms';
import {RecordAdapterProvider} from '@pepbits/page-engines/records';
import {RecordIdentity, RecordPage} from '@pepbits/page-engines/record-page';
import type {PageRenderContext} from '@pepbits/page-engines/renderer';
import type {FormValues} from '@pepbits/page-engines/types';
import type {RecordBundle} from '@pepbits/data';
import {useFetch} from '@pepbits/patterns/resources';
import {DescriptionList, LoadingState, NotFoundState, RecoveryNotice, failureFromError} from '@pepbits/components';
import {ScreenHostProvider, useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {useLocalization} from '@pepbits/i18n/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {API_PRODUCT, useRequest} from '../../adapters/http';
import {findRow, useRecordHostValue, useWorklistAdapter} from '../../adapters/records';
import {RECORDS, type RecordDestination} from './catalog';

type Row = Record<string, string | number | boolean>;
/** Worklist, editable record form or read-only summary, chosen by the target's mode. */
export function DesktopRecordsPage({page, target}: PageRenderContext) {
  const destination = RECORDS[page.id], adapter = useWorklistAdapter(), host = useScreenHost();
  // Read-only destinations narrow the shell grants; they never widen them.
  const narrowed = useMemo(() => destination?.form ? null : {...host, can: (action: string, subject?: unknown) => !['create', 'edit', 'archive'].includes(action) && host.can(action, subject)}, [destination, host]);
  if (!destination) return <NotFoundState/>;
  if (!target.recordId && target.mode !== 'new') {
    const list = <WorklistPage page={page} config={destination.config} adapter={adapter} rowClick="open"/>;
    return narrowed ? <ScreenHostProvider value={narrowed}>{list}</ScreenHostProvider> : list;
  }
  if (destination.form) return <EditableRecord key={JSON.stringify([target.mode, target.recordId])} destination={destination} context={{page, target}}/>;
  if (target.mode !== 'view' || !target.recordId) return <NotFoundState/>;
  return <ScreenHostProvider value={narrowed!}><ReadOnlyRecord key={target.recordId} destination={destination} context={{page, target}} recordId={target.recordId}/></ScreenHostProvider>;
}

function useRow(destination: RecordDestination, context: PageRenderContext, recordId: string | undefined) {
  const request = useRequest(), [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{row?: Row | null; error?: unknown}>({});
  useEffect(() => {
    if (!recordId) {setState({row: null}); return;}
    const controller = new AbortController(); setState({});
    findRow(request, context.page, destination.config.primaryKey, recordId, controller.signal)
      .then(row => {if (!controller.signal.aborted) setState({row});}, error => {if (!controller.signal.aborted) setState({error});});
    return () => controller.abort();
  }, [request, context.page, destination, recordId, attempt]);
  return {...state, retry: () => setAttempt(value => value + 1)};
}

/** The record store holds saved values; the worklist row seeds a record that has never been saved. */
function EditableRecord({destination, context}: {destination: RecordDestination; context: PageRenderContext}) {
  const {page, target} = context, form = destination.form!, record = useRecordHostValue();
  const row = useRow(destination, context, target.mode === 'new' ? undefined : target.recordId);
  // Created records live in the record store before the generated worklist contains them.
  // Check existence there; DynamicRecordForm still owns validation, loading and editing.
  const saved = useFetch<RecordBundle<FormValues>>(row.row === null && target.recordId
    ? '/records/' + encodeURIComponent(JSON.stringify([API_PRODUCT, `form:${page.id}:${target.recordId}`])) : null);
  const initialValues = useMemo<FormValues | undefined>(() => row.row ? form.fromRow(row.row) : undefined, [row.row, form]);
  if (row.error) return <RecoveryNotice failure={failureFromError(row.error)} onRetry={row.retry}/>;
  if (row.row === undefined) return <LoadingState/>;
  if (row.row === null && target.mode !== 'new') {
    if (saved.error) return <RecoveryNotice failure={failureFromError(new Error(saved.error))} onRetry={saved.reload}/>;
    if (saved.loading) return <LoadingState/>;
    if (!saved.data?.record) return <NotFoundState/>;
  }
  return <section aria-label={destination.singular} className="p-3"><h1 className="sr-only">{page.title}</h1>
    <RecordAdapterProvider value={record}><DynamicRecordForm page={page} target={target} schema={form.schema} initialValues={initialValues}/></RecordAdapterProvider>
  </section>;
}

function ReadOnlyRecord({destination, context, recordId}: {destination: RecordDestination; context: PageRenderContext; recordId: string}) {
  const {page} = context, navigation = useNavigation(), format = useFormatters(), {t} = useLocalization();
  const row = useRow(destination, context, recordId), sections = destination.summary ?? [];
  const [active, setActive] = useState(sections[0]?.id ?? '');
  if (row.error) return <RecoveryNotice failure={failureFromError(row.error)} onRetry={row.retry}/>;
  if (row.row === undefined) return <LoadingState/>;
  if (!row.row) return <NotFoundState/>;
  const value = row.row, columns = destination.config.columns;
  const display = (key: string) => {const column = columns.find(item => item.key === key), raw = value[key];
    return column?.type === 'date' ? format.date(String(raw ?? '')) : column?.type && ['money', 'number', 'percent'].includes(column.type) ? format.cell({type: column.type}, raw) : String(raw ?? '');};
  return <section aria-label={destination.singular} className="p-3"><h2 className="sr-only">{page.title}</h2>
    <RecordPage sections={sections.map(section => ({id: section.id, title: section.title, heading: section.title}))} active={active} onActive={setActive} showCompletion={false} isDone={() => false}
      identity={<RecordIdentity label={destination.singular} name={String(value[destination.config.displayKey] ?? '')} reference={recordId}/>}
      actions={[{id: 'back', label: 'Back', onClick: () => navigation.open({pageId: page.id})}]}
      renderSection={section => <DescriptionList items={(sections.find(item => item.id === section.id)?.fields ?? []).map(key => ({id: key, label: t(columns.find(item => item.key === key)?.label ?? key), value: display(key)}))}/>}/>
  </section>;
}
