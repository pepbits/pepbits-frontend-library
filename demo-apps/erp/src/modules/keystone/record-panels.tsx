import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Card, DescriptionList, LoadingState, RecoveryNotice, StatCard, failureFromError} from '@pepbits/components';
import {CollectionView} from '@pepbits/components/collection-view';
import {Button, FilePicker, Select, Textarea} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters, useScreenHost} from '@pepbits/patterns/screen-host';
import {useEntitySupport} from './api';
import {listUrl, useEntityApi, useFetch} from './client';
import {Fields,useValueFormat} from './fields';
import {useKeystone} from './context';
import {localDay} from './dates';
import {invoiceTotals} from './invoice';
import type {ListResponse, PageDef, Row} from './types';
import type {ErpTarget} from '../../navigation';

export function Panel({title, children}: {title: string; children: ReactNode}) {
  const {t} = useLocalization();
  return <Card as="section" className="erp-record-panel"><h3>{t(title)}</h3>{children}</Card>;
}

/** The support endpoint is metadata only. It supplies neither downloadable bytes nor an upload command. */
export function RecordSupport({entity, id, kind, revision}: {entity: string; id: string; kind: 'activity' | 'documents' | 'process'; revision?: number}) {
  const support = useEntitySupport(entity, id, revision), format = useFormatters(), {t} = useLocalization();
  if (support.error) return <RecoveryNotice failure={failureFromError(new Error(support.error))} onRetry={support.retry}/>;
  if (!support.data) return <div aria-busy="true"><LoadingState/></div>;
  if (kind === 'process') return support.data.processEvents?.length ? <ol className="erp-record-timeline">{support.data.processEvents.map((event, index) => <li key={index} data-tone={event.tone}><time>{event.time}</time><p>{event.text}</p></li>)}</ol> : <p>{t('No run history recorded for this record yet.')}</p>;
  if (kind === 'activity') return support.data.activities.length ? <ol className="erp-record-timeline">{support.data.activities.map((event, index) => <li key={index}><p>{event.text}</p><small>{event.who} · <time dateTime={event.when}>{format.dateTime(event.when)}</time></small></li>)}</ol> : <p>{t('No activity recorded for this record yet.')}</p>;
  return support.data.documents.length ? <ul className="erp-record-documents">{support.data.documents.map((doc, index) => <li key={index}><span>{doc.name}</span><small>{doc.size}{doc.when && <> · <time dateTime={doc.when}>{format.date(doc.when)}</time></>}</small></li>)}</ul> : <p>{t('No documents are stored for this record.')}</p>;
}

/** Matches the source's explicitly unsaved file selection; only names/sizes live on this mounted record. */
export function RecordDocumentSelection() {
  const [files, setFiles] = useState<{name: string; size: number}[]>([]), {t} = useLocalization(), format = useFormatters(), host = useScreenHost();
  return <div className="space-y-2"><FilePicker label="Choose files" disabled={!host.can('edit')} onFile={file => {if (host.can('edit')) setFiles(items => [...items, {name: file.name, size: file.size}]);}}/><p>{t('Selected on this screen only — not uploaded or saved.')}</p><ul aria-label={t('Selected files')} className="erp-record-documents">{files.map((file, index) => <li key={index}><span>{file.name} · {format.number(Math.ceil(file.size / 1024))} KB</span><Button variant="ghost" disabled={!host.can('edit')} onClick={() => {if (host.can('edit')) setFiles(items => items.filter((_, i) => i !== index));}}>{t('Remove {value0}', {value0: file.name})}</Button></li>)}</ul></div>;
}

export function ProfileSummary({def, row}: {def: PageDef; row: Row}) {
  const format = useValueFormat();
  const stats = def.fields.filter(field => ['number', 'currency', 'percent'].includes(field.type) && field.group).slice(0, 4);
  const meta = def.fields.filter(field => ['select', 'city', 'date', 'person', 'status'].includes(field.type) && !field.primary).slice(0, 4);
  return <div data-profile-summary className="space-y-3"><DescriptionList items={meta.map(field => ({id: field.key, label: field.label, value: format(field, row[field.key])}))}/><div className="grid gap-2 sm:grid-cols-2">{stats.map(field => <StatCard key={field.key} label={field.label} value={format(field, row[field.key])}/>)}</div></div>;
}

export function ProfileChanges({def, initial, row, creating}: {def: PageDef; initial: Row; row: Row; creating: boolean}) {
  const format = useValueFormat(), {t} = useLocalization();
  const fields = creating ? def.fields.filter(field => field.required && !field.readOnly) : def.fields.filter(field => JSON.stringify(initial[field.key] ?? '') !== JSON.stringify(row[field.key] ?? ''));
  return <Panel title={creating ? 'Before you create' : 'Changes'}>{fields.length ? <ul className="erp-record-documents">{fields.map(field => <li key={field.key}><span>{t(field.label)}</span>{creating ? <span>{t(row[field.key] == null || row[field.key] === '' ? 'Required' : 'Done')}</span> : <span><del>{format(field, initial[field.key])}</del> → {format(field, row[field.key])}</span>}</li>)}</ul> : <p>{t(creating ? 'No mandatory fields. Fill what you know.' : 'Nothing changed yet.')}</p>}</Panel>;
}

export function BookingContext({def, row, target, onOpen, onClose, editing}: {def: PageDef; row: Row; target: ErpTarget; onOpen: (target: ErpTarget) => void; onClose: () => void; editing: boolean}) {
  const result = useFetch<ListResponse>(row.date ? listUrl(def.entity, {size: 5000, filters: {date: [String(row.date)]}, sort: 'start', dir: 'asc'}) : null), format = useFormatters(), {t} = useLocalization();
  const rows = result.data?.rows.filter(item => item.resource === row.resource && (!editing || item.status !== 'Cancelled')) ?? [];
  return <Panel title="Resource schedule"><p>{String(row.resource ?? '')} · {row.date ? format.date(row.date) : t('Choose a date')}</p><Button disabled={editing} onClick={onClose}>{t('Open schedule')}</Button>{result.error ? <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/> : row.date && !result.data ? <div aria-busy="true"><LoadingState/></div> : <>
    {result.data && result.data.total > result.data.rows.length && <p role="alert">{t('The schedule is incomplete. Reload before booking.')}</p>}
    <ul className="erp-record-documents">{rows.map(item => <li key={item.id}><Button variant="ghost" disabled={editing} aria-current={item.id === row.id ? 'true' : undefined} onClick={() => onOpen({...target, recordId: item.id, mode: 'view'})}>{format.time(item.start)} · {item.person} · {t(item.status)}</Button></li>)}</ul>
    {!rows.length && <p>{t('Nothing else booked. Every slot is free.')}</p>}
  </>}</Panel>;
}

export function hierarchyPath(rows: Row[], id?: string): Row[] {
  const byId = new Map(rows.map(row => [row.id, row])), seen = new Set<string>(), path: Row[] = [];
  let row = id ? byId.get(id) : undefined;
  while (row && !seen.has(row.id)) {seen.add(row.id); path.unshift(row); row = byId.get(row.parentId);}
  return path;
}

export function TreeContext({def, row, target, onOpen, onClose, editing}: {def: PageDef; row: Row; target: ErpTarget; onOpen: (target: ErpTarget) => void; onClose: () => void; editing: boolean}) {
  const result = useFetch<ListResponse>(listUrl(def.entity, {size: 2000})), api = useEntityApi(), host = useScreenHost(), {t} = useLocalization();
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [failure, setFailure] = useState<unknown>();
  const alive = useRef(true), locked = useRef(false);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  const rows = result.data?.rows ?? [], kids = rows.filter(item => item.parentId === row.id), partial = !result.data || result.data.total > rows.length;
  const open = (item: Row) => onOpen({...target, mode: 'view', recordId: item.id});
  const create = () => {if (!host.can('create') || editing || partial) return; onOpen({pageId: target.pageId, mode: 'new', query: new URLSearchParams({parentId: row.id, level: String(Number(row.level) + 1), code: `${row.code}.${kids.length + 1}`, ...(row.nature ? {nature: String(row.nature)} : {})}).toString()});};
  const remove = async () => {
    if (locked.current || !host.can('delete') || editing || partial || kids.length) return;
    locked.current = true; setBusy(true); setFailure(undefined);
    try {await api.remove(def.entity, row.id); if (alive.current) onClose();}
    catch (error) {if (alive.current) setFailure(error);}
    finally {locked.current = false; if (alive.current) setBusy(false);}
  };
  if (result.error) return <RecoveryNotice failure={failureFromError(new Error(result.error))} onRetry={result.reload}/>;
  if (!result.data) return <div aria-busy="true"><LoadingState/></div>;
  return <Panel title="Position in hierarchy"><nav aria-label={t('Position in hierarchy')} className="flex flex-wrap gap-2"><Button variant="ghost" disabled={editing || busy} onClick={onClose}>{t('Top')}</Button>{hierarchyPath(rows, row.id || String(row.parentId ?? '')).map(item => <Button key={item.id} variant="ghost" disabled={editing || busy} aria-current={item.id === row.id ? 'page' : undefined} onClick={() => open(item)}>{item.name}</Button>)}</nav>
    {partial && <p role="alert">{t('Hierarchy is incomplete. Reload before changing it.')}</p>}
    {!!row.id && <><h4>{t('Directly under')} {row.name}</h4><CollectionView columns={[{key: 'name', header: 'Name'}, {key: 'code', header: 'Code'}]} rows={kids} rowKey={item => item.id} onRowClick={editing || busy ? undefined : open}/>{!kids.length && <p>{t('Nothing sits under this item yet.')}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={editing || busy || partial || !host.can('create')} onClick={create}>{t('Add child')}</Button><Button disabled={editing || busy || partial || !!kids.length || !host.can('delete')} onClick={() => setConfirm(true)}>{t('Delete')}</Button></div>
      {confirm && <div role="group" aria-label={t('Delete')}><Button disabled={busy || !host.can('delete')} onClick={() => void remove()}>{t('Confirm delete')}</Button><Button disabled={busy} onClick={() => setConfirm(false)}>{t('Cancel')}</Button></div>}
      {!!failure && <RecoveryNotice failure={failureFromError(failure)} onRetry={() => void remove()}/>}
    </>}
  </Panel>;
}

export type SavePatch = (patch: Partial<Row>) => Promise<boolean>;
export function CaseConversation({def, row, busy, save}: {def: PageDef; row: Row; busy: boolean; save: SavePatch}) {
  const [comment, setComment] = useState(''), {t} = useLocalization(), format = useFormatters(), host = useScreenHost(), {preferences} = usePreferences(), {actor, variant} = useKeystone();
  const activities = [...(row.activity ?? [])] as {at: string; by: string; text: string}[];
  if (variant === 'erp1') activities.reverse(); else activities.sort((a, b) => a.at.localeCompare(b.at));
  const disabled = busy || !host.can('edit');
  const post = async () => {if (disabled || !comment.trim()) return; const accepted = await save({activity: [...(row.activity ?? []), {at: localDay(), by: actor?.name ?? t('You'), text: comment.trim()}]}); if (accepted) setComment('');};
  return <div data-case-conversation className="space-y-3"><ol className="erp-record-timeline">{activities.map((item, index) => <li key={index}><strong>{item.by}</strong> · <time dateTime={item.at}>{format.date(item.at)}</time><p>{item.text}</p></li>)}</ol>{!activities.length && <p>{t('No activity recorded for this record yet.')}</p>}
    <Textarea label="Add an update or reply" value={comment} disabled={disabled} onChange={event => setComment(event.target.value)} onKeyDown={event => {if (preferences.keyboardShortcuts && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault(); void post();}}}/><Button disabled={disabled || !comment.trim()} onClick={() => void post()}>{t('Post update')}</Button>
  </div>;
}

export function CaseProperties({def, row, busy, save}: {def: PageDef; row: Row; busy: boolean; save: SavePatch}) {
  const {t} = useLocalization(), host = useScreenHost(), {actor} = useKeystone(), disabled = busy || !host.can('edit'), [assignee, setAssignee] = useState(String(row.assignee ?? ''));
  return <><Panel title="Properties">
    <Select label="Stage" value={row.status} disabled={disabled} options={(def.statusFlow ?? []).map(value => ({value, label: value}))} onChange={event => {const status = event.target.value; if (!disabled && def.statusFlow?.includes(status)) void save({status, activity: [...(row.activity ?? []), {at: localDay(), by: actor?.name ?? t('You'), text: `Moved from ${row.status} to ${status}`}]});}}/>
    <Select label="Priority" value={row.priority} disabled={disabled} options={(def.fields.find(field => field.key === 'priority')?.options ?? []).map(value => ({value, label: value}))} onChange={event => {if (!disabled) void save({priority: event.target.value});}}/>
    <Fields fields={def.fields.filter(field => field.key === "assignee")} value={{...row, assignee}} readOnly={disabled} onChange={(_, value) => setAssignee(String(value))}/><Button disabled={disabled || assignee === String(row.assignee ?? '')} onClick={() => {if (!disabled) void save({assignee});}}>{t('Save assignee')}</Button>
  </Panel><Panel title="Details"><Fields fields={def.fields.filter(field => !["code", "status", "subject", "priority", "assignee"].includes(field.key))} value={row} readOnly onChange={() => {}}/></Panel></>;
}

export function ApprovalContext({def, row, target, onOpen, busy, note, onNote}: {def: PageDef; row: Row; target: ErpTarget; onOpen: (target: ErpTarget) => void; busy: boolean; note: string; onNote: (value: string) => void}) {
  const {t} = useLocalization(), host = useScreenHost(), format = useFormatters(), {variant} = useKeystone();
  const related = useFetch<ListResponse>(variant === 'erp1' && row.department ? listUrl(def.entity, {size: 5000, filters: {department: [String(row.department)], status: ['Pending']}}) : null);
  return <><Panel title="Request"><p>{row.summary}</p><DescriptionList items={[{id:'requester',label:'Requester',value:String(row.requester ?? '')},{id:'amount',label:row.type === 'Leave' ? 'Days' : 'Amount',value:row.type === 'Leave' ? format.number(Number(row.days)) : format.money(Number(row.amount))},{id:'submitted',label:'Submitted',value:format.date(row.submitted)},{id:'due',label:'Due',value:format.date(row.due)}]}/>{row.status === 'Pending' && row.due < localDay() && <p>{t('Overdue')}</p>}</Panel><Panel title="Attachments"><RecordSupport entity={def.entity} id={row.id} revision={row.version} kind="documents"/></Panel><Panel title="Route"><ol className="erp-record-timeline">{[row.requester, t('You'), t('Finance controller')].map((person, index) => <li key={index}>{person} · {t(index === 0 ? 'Submitted' : index === 1 ? row.status === 'Pending' ? 'Waiting on you' : row.status : 'Next')}</li>)}</ol></Panel>
    {row.status === 'Pending' && <Panel title="Note to requester"><Textarea label="Note to the requester (optional)" value={note} disabled={busy || !host.can('edit')} onChange={event => onNote(event.target.value)}/></Panel>}
    {variant === 'erp1' && <Panel title="Related requests"><p>{row.department}</p>{related.error ? <RecoveryNotice failure={failureFromError(new Error(related.error))} onRetry={related.reload}/> : !related.data && row.department ? <div aria-busy="true"><LoadingState/></div> : <>{related.data && related.data.total > related.data.rows.length && <p role="alert">{t('Results are incomplete')}</p>}<ul className="erp-record-documents">{related.data?.rows.filter(item => item.id !== row.id).map(item => <li key={item.id}><Button variant="ghost" disabled={busy} onClick={() => onOpen({...target, recordId: item.id, mode: 'view'})}>{item.type} · {item.requester} · {item.type === 'Leave' ? format.number(Number(item.days)) : format.money(Number(item.amount))}</Button></li>)}</ul>{!related.data?.rows.some(item => item.id !== row.id) && <p>{t('Nothing else pending from')} {row.department}</p>}</>}</Panel>}
  </>;
}

export function RequestContext({def, row, editing}: {def: PageDef; row: Row; editing: boolean}) {
  const {t} = useLocalization(), format = useFormatters();
  const status = String(row.status ?? 'Pending'), money = (def.balances?.[0]?.total ?? 0) > 100;
  const state = (index: number) => status === 'Paid' ? 'Done' : status === 'Approved' ? (def.steps!.length > 3 && index === def.steps!.length - 1 ? 'Waiting now' : 'Done') : index === 0 ? status === 'Withdrawn' ? 'Withdrawn' : 'Done' : index === 1 ? status === 'Rejected' ? 'Rejected' : status === 'Withdrawn' ? 'Not started' : 'Waiting now' : 'Not started';
  return <>{editing && def.balances && <Panel title="Your balances"><DescriptionList items={def.balances.map(balance => ({id: balance.label, label: balance.label, value: `${money ? format.money(balance.total - balance.used) : format.number(balance.total - balance.used)} ${t('left')}`}))}/></Panel>}<Panel title={editing ? 'Approval route' : 'Approval trail'}><ol className="erp-record-timeline">{def.steps?.map((step, index) => <li key={index}><strong>{t(step)}</strong><p>{index === 0 ? row.employee ?? t('You') : (def.approvers?.length ? def.approvers[(index - 1) % def.approvers.length] : '—')}</p>{!editing && <small>{t(state(index))}</small>}</li>)}</ol></Panel></>;
}

export function DocumentSummary({def, row}: {def: PageDef; row: Row}) {
  const format = useFormatters(), lines = (row.lines ?? []) as Row[], voucher = def.template === 'voucher';
  const sum = (key: string) => lines.reduce((total, line) => total + Number(line[key] || 0), 0);
  const {subtotal, tax} = invoiceTotals(lines);
  return <Panel title={voucher ? 'Balance check' : 'Summary'}><DescriptionList items={(voucher ? [{id: 'debit', label: 'Total debit', value: format.money(sum('debit'))}, {id: 'credit', label: 'Total credit', value: format.money(sum('credit'))}, {id: 'difference', label: 'Difference', value: format.money(Math.abs(sum('debit') - sum('credit')))}] : [{id: 'subtotal', label: 'Subtotal', value: format.money(subtotal)}, {id: 'tax', label: 'Tax', value: format.money(tax)}, {id: 'total', label: 'Total', value: format.money(subtotal + tax)}])}/></Panel>;
}

export function ProcessSteps({def, row}: {def: PageDef; row: Row}) {
  const support = useEntitySupport(def.entity, row.id, row.version), {t} = useLocalization();
  if (support.error) return <RecoveryNotice failure={failureFromError(new Error(support.error))} onRetry={support.retry}/>;
  if (!support.data) return <div aria-busy="true"><LoadingState/></div>;
  return <Panel title="Steps"><ol className="erp-record-timeline">{def.steps?.map((step, index) => {
    const events = support.data?.processEvents?.filter(event => event.step === index) ?? [];
    const status = events.some(event => event.tone === 'warn' || event.tone === 'danger') ? 'Warning' : events.some(event => event.progress === undefined || event.progress >= 100) ? 'Done' : 'Not started';
    return <li key={index}>{t(step)} · {t(status)}</li>;
  })}</ol></Panel>;
}

export function InspectionSummary({def, row}: {def: PageDef; row: Row}) {
  const format = useFormatters(), checks = (row.checks ?? def.checks ?? []) as {result?: string}[];
  return <div className="grid gap-2 sm:grid-cols-3" data-inspection-summary>{[['Checked', checks.filter(check => check.result).length], ['Pass', checks.filter(check => check.result === 'Pass').length], ['Fail', checks.filter(check => check.result === 'Fail').length]].map(([label, value]) => <StatCard key={label} label={String(label)} value={format.number(Number(value))}/>)}</div>;
}
