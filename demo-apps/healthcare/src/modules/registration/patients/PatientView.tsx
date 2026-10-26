'use client';
import React, {useEffect, useMemo, useState} from 'react';
import {SECTIONS, formatValue, isEmptyValue, isRequired, sectionProgress, validateForm, visibleFields, type AuditEntry, type FieldDef, type PatientRecord, type SectionId} from '@allyvora/shared';
import {ConfirmDialog, LoadingState, NotFoundState, RecoveryNotice} from '@pepbits/components';
import {Button, NavLink, cn} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useNavigation} from '@pepbits/platform/navigation';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {Archive, FilePlus2, History, Pencil, Printer, RotateCcw, UserPlus} from '@pepbits/icons';
import {useAllyVora} from '../context';
import {PAGE} from '../routes';
import {AllyVoraFailure} from '../../../adapters/allyvora';
import {RecordForm,RecordSectionCard} from '@pepbits/page-engines/record-layout';
import {usePreferences} from '@pepbits/preferences/react';
import {GRID} from '../form/parts';
import {PatientBand} from '../form/PatientBand';
import {failureOf, messageOf, useTimeFormat} from '../support';

const ACTION_TEXT: Record<AuditEntry['action'], string> = {created: 'registered the patient', updated: 'updated the record', deactivated: 'marked the record inactive', reactivated: 'made the record active again'};
const editTarget = (record: PatientRecord, section?: SectionId) => ({pageId: PAGE.register, mode: 'edit' as const, recordId: String(record.id), ...(section ? {section} : {})});

function SectionCard({record, section}: {record: PatientRecord; section: SectionId}) {
  const {preferences}=usePreferences();
  const {lookups} = useAllyVora(), {t} = useLocalization(), navigation = useNavigation(), time = useTimeFormat(), host = useScreenHost();
  const def = SECTIONS.find(item => item.id === section)!, values = record.data;
  const errors = useMemo(() => validateForm(values), [values]);
  const progress = sectionProgress(section, values, errors, {});
  const rows = visibleFields(section, values).map(field => {
    if (field.id === 'mrn') return {field, text: record.mrn};
    if (field.id === 'orgNumber') return {field, text: record.orgNumber};
    if (field.id === 'branchId') return {field, text: record.branchName};
    if (field.type === 'switch') return values[field.id] === true ? {field, text: t('Yes')} : null;
    if (isEmptyValue(values[field.id])) return null;
    // Dates follow the effective date preference; everything else uses the shared definition's formatting and masking.
    return {field, text: field.type === 'date' ? time.date(String(values[field.id])) : formatValue(field, values[field.id], lookups, {mask: true})};
  }).filter(Boolean) as {field: FieldDef; text: string}[];
  const target = editTarget(record, section);
  return <RecordSectionCard id={section} title={def.title} index={def.index-1} progress={progress} actions={
      host.can('allyvora-edit') ? <NavLink href={navigation.hrefFor(target)} onClick={event => {event.preventDefault(); navigation.open(target);}} className="print:hidden focus-ring inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[length:calc(10.5px*var(--fs-scale))] font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]">
        <Pencil className="size-3.5" aria-hidden="true"/>{t('Edit')}<span className="sr-only"> {t(def.title)}</span>
      </NavLink> : null}>
    {rows.length === 0 ? <p className="px-4 py-4 text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Nothing recorded yet.')}</p>
      : <dl className={cn(GRID[preferences.formColumns],preferences.density==='compact'?'gap-x-4 gap-y-2':'gap-x-6 gap-y-3')}>
        {rows.map(({field, text}) => <div key={field.id} className={cn('min-w-0', (field.span === 2 || field.span === 'full' || field.type === 'textarea' || field.type === 'signature') && 'sm:col-span-2')}>
          <dt className="text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]">{t(field.label)}</dt>
          <dd className="mt-0.5 break-words text-[length:calc(12.5px*var(--fs-scale))] text-[var(--text)]">
            {field.type === 'signature' ? <img src={String(values[field.id])} alt={t('Patient signature')} className="h-16 rounded-md border border-[var(--border)] bg-white px-2"/>
              : field.type === 'multiselect' ? <span className="flex flex-wrap gap-1">{text.split(', ').map(item => <span key={item} className={cn('rounded-md px-2 py-0.5 text-[length:calc(10.5px*var(--fs-scale))] font-semibold', field.id === 'allergens' ? 'bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger-ink)]' : 'bg-[var(--surface-2)] text-[var(--text)]')}>{item}</span>)}</span>
              : <span className={cn(['mrn', 'orgNumber', 'mobile', 'idNumber', 'abhaNumber'].includes(field.id) && 'tabular-nums')}>{text}</span>}
          </dd>
        </div>)}
      </dl>}
  </RecordSectionCard>;
}

/** Patient record with section cards, missing optional details and the masked activity history. */
export function PatientView({id}: {id: number}) {
  const {client, lookups} = useAllyVora(), {t} = useLocalization(), navigation = useNavigation(), host = useScreenHost(), time = useTimeFormat();
  const [active,setActive]=useState('mrn');
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    Promise.all([client.patients.get(id), client.patients.audit(id)]).then(([next, history]) => {if (live) {setRecord(next); setAudit(history);}}).catch(failure => {if (live) setError(failure);});
    return () => {live = false;};
  }, [client, id, attempt]);
  const gaps = useMemo(() => record ? SECTIONS.map(section => ({section, missing: visibleFields(section.id, record.data).filter(field => field.type !== 'readonly' && field.type !== 'switch' && !isRequired(field, record.data) && isEmptyValue(record.data[field.id]))})).filter(gap => gap.missing.length > 0) : [], [record]);

  if (error) {
    if (error instanceof AllyVoraFailure && error.status === 404) return <div className="p-6"><NotFoundState title="This patient doesn’t exist" description={messageOf(error)} action={<Button variant="primary" onClick={() => navigation.open({pageId: PAGE.register})}>{t('Open patient register')}</Button>}/></div>;
    return <div className="p-6"><RecoveryNotice failure={failureOf(error)} onRetry={() => setAttempt(n => n + 1)} onReturn={() => navigation.open({pageId: PAGE.register})}/></div>;
  }
  if (!record) return <LoadingState/>;
  const inactive = record.status === 'inactive';
  const toggleStatus = async () => {
    setBusy(true);
    try {
      const next = await client.patients.setStatus(record.id, inactive ? 'active' : 'inactive');
      setRecord(next);
      setAudit(await client.patients.audit(record.id));
      host.notify(`${t(inactive ? 'Record is active again' : 'Record marked inactive')}: ${next.displayName}`, {tone: 'success'});
    } catch (failure) {
      host.notify(`${t('Status not changed')}: ${messageOf(failure)}`, {tone: 'error'});
    } finally {setBusy(false); setConfirm(false);}
  };
  const facts: [string, string][] = [
    ['Branch', record.branchName],
    ['Organisation number', record.orgNumber],
    ['Registered', t('{when} by {who}', {when: time.dateTime(record.createdAt), who: record.createdBy})],
    ['Last updated', t('{when} by {who}', {when: time.relative(record.updatedAt), who: record.updatedBy})],
    ['Status', t(inactive ? 'Inactive' : 'Active')],
  ];
  return <div className="flex flex-col gap-2 px-3 pt-2 pb-4 sm:px-4 lg:px-6" data-patient-view={record.id}>
    <h1 className="sr-only">{t('Patient record: {name}', {name: record.displayName})}</h1>
    <div className="grid min-h-[700px] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex h-[calc(100dvh-160px)] min-h-[600px] flex-col"><RecordForm mode="view" values={record.data} sections={SECTIONS} active={active} onActive={setActive}
        progress={Object.fromEntries(SECTIONS.map(section=>[section.id,sectionProgress(section.id,record.data,validateForm(record.data),{})]))}
        summary={<PatientBand values={record.data} lookups={lookups} mrn={record.mrn} completion={record.completion} size="compact" status={record.status}
      actions={<div className="flex flex-col gap-2 print:hidden sm:flex-row">
        {host.can('allyvora-edit') ? <Button variant="primary" onClick={() => navigation.open(editTarget(record))}><Pencil className="size-4" aria-hidden="true"/>{t('Edit')}</Button> : null}
        <Button variant="secondary" onClick={() => window.print()} className="hidden sm:inline-flex"><Printer className="size-4" aria-hidden="true"/>{t('Print')}</Button>
      </div>}/>} onBack={()=>navigation.open({pageId:PAGE.register})} backLabel="Back to patients"
        renderSection={section=><SectionCard record={record} section={section.id}/>}/></div>
      <aside className="flex flex-col gap-4 xl:sticky xl:top-4" aria-label={t('Record details')}>
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="record-facts">
          <h2 id="record-facts" className="text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]">{t('Record')}</h2>
          <dl className="mt-3 space-y-2.5 text-[length:calc(11.5px*var(--fs-scale))]">{facts.map(([label, value]) => <div key={label} className="flex gap-3"><dt className="w-32 shrink-0 text-[var(--text-muted)]">{t(label)}</dt><dd className="min-w-0 tabular-nums text-[var(--text)]">{value}</dd></div>)}</dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3 print:hidden">
            {host.can('allyvora-create') ? <Button size="sm" variant="ghost" onClick={() => navigation.open({pageId: PAGE.create, mode: 'new'})}><UserPlus className="size-4" aria-hidden="true"/>{t('Register another')}</Button> : null}
            {host.can('allyvora-archive') ? <Button size="sm" variant={inactive ? 'secondary' : 'danger'} onClick={() => setConfirm(true)} className="ms-auto">{inactive ? <RotateCcw className="size-4" aria-hidden="true"/> : <Archive className="size-4" aria-hidden="true"/>}{t(inactive ? 'Make active' : 'Mark inactive')}</Button> : null}
          </div>
        </section>
        {gaps.length > 0 ? <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 print:hidden" aria-labelledby="record-gaps">
          <h2 id="record-gaps" className="flex items-center gap-2 text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]"><FilePlus2 className="size-4 text-[var(--warning-ink)]" aria-hidden="true"/>{t('Details still missing')}</h2>
          <p className="mt-0.5 text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text-muted)]">{t('Optional, but they help the care team. Each opens the right section.')}</p>
          <ul className="mt-3 space-y-1">{gaps.map(({section, missing}) => {const target = editTarget(record, section.id); return <li key={section.id}>
            <NavLink href={navigation.hrefFor(target)} onClick={event => {event.preventDefault(); navigation.open(target);}} className="block rounded-lg px-2.5 py-2 hover:bg-[var(--surface-2)]">
              <span className="block text-[length:calc(11.5px*var(--fs-scale))] font-semibold text-[var(--text)]">{t(section.title)}</span>
              <span className="block truncate text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]">{missing.slice(0, 3).map(field => t(field.label)).join(', ')}{missing.length > 3 ? ' ' + t('and {count} more', {count: missing.length - 3}) : ''}</span>
            </NavLink>
          </li>;})}</ul>
        </section> : null}
        <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="record-activity" data-activity="">
          <h2 id="record-activity" className="flex items-center gap-2 text-[length:calc(13px*var(--fs-scale))] font-bold text-[var(--text)]"><History className="size-4 text-[var(--text-muted)]" aria-hidden="true"/>{t('Activity')}</h2>
          <ol className="mt-3">{(audit ?? []).map((entry, i, all) => <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < all.length - 1 ? <span className="absolute start-[5px] top-4 h-full w-px bg-[var(--border)]" aria-hidden="true"/> : null}
            <span className={cn('relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-[var(--surface)]', entry.action === 'created' ? 'bg-[var(--primary)]' : entry.action === 'deactivated' ? 'bg-[var(--danger)]' : 'bg-[var(--border-strong)]')} aria-hidden="true"/>
            <div className="min-w-0 flex-1">
              <p className="text-[length:calc(11.5px*var(--fs-scale))] text-[var(--text)]"><span className="font-semibold">{entry.actor}</span> {t(ACTION_TEXT[entry.action])}</p>
              <p className="text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]" title={time.dateTime(entry.at)}>{time.relative(entry.at)}</p>
              {entry.changes.length > 0 ? <ul className="mt-1.5 space-y-1 rounded-lg bg-[var(--surface-2)] p-2 text-[length:calc(10.5px*var(--fs-scale))]">
                {entry.changes.slice(0, 6).map(change => <li key={change.field} className="text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">{t(change.label)}</span>{' '}
                  {change.from ? <><span className="line-through">{change.from}</span> {t('to')} <span className="text-[var(--text)]">{change.to || t('blank')}</span></> : <>{t('set to')} <span className="text-[var(--text)]">{change.to}</span></>}</li>)}
                {entry.changes.length > 6 ? <li className="text-[var(--text-muted)]">{t('and {count} more changes', {count: entry.changes.length - 6})}</li> : null}
              </ul> : null}
            </div>
          </li>)}</ol>
        </section>
      </aside>
    </div>
    <ConfirmDialog open={confirm} title={inactive ? 'Make this record active?' : 'Mark this record inactive?'} confirmLabel={t(busy ? 'Saving…' : inactive ? 'Make active' : 'Mark inactive')} tone={inactive ? 'primary' : 'danger'}
      onCancel={() => {if (!busy) setConfirm(false);}} onConfirm={() => {if (!busy) void toggleStatus();}}
      message={inactive ? t('{name} will show in searches and duplicate checks again.', {name: record.displayName}) : t('{name} will be hidden from the register and duplicate checks. Their MRN is kept and the record can be made active again.', {name: record.displayName})}/>
  </div>;
}
