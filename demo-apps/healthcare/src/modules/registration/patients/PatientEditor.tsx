'use client';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {defaultValues, todayISO, type FormValues, type PatientRecord, type SectionId} from '@allyvora/shared';
import {AccessDenied, ConfirmDialog, LoadingState, NotFoundState, RecoveryNotice} from '@pepbits/components';
import {Button} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {useNavigation, type NavigationTarget} from '@pepbits/platform/navigation';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {useAllyVora} from '../context';
import {PAGE} from '../routes';
import {AllyVoraFailure} from '../../../adapters/allyvora';
import {PatientForm, type SubmitResult} from '../form/PatientForm';
import {failureOf, messageOf} from '../support';

export const NEW_DRAFT_KEY = 'registration:new';

/** New and edit modes: loads the record, saves with the record version, and maps 422/409 responses back into the form. */
export function PatientEditor({mode, id, section}: {mode: 'new' | 'edit'; id?: number; section?: SectionId}) {
  const {client, settings, lookups, branchId, session, listQuery, saveDraft} = useAllyVora();
  const {t} = useLocalization(), navigation = useNavigation(), host = useScreenHost();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState<NavigationTarget | null>(null);
  const dirty = useRef(false);
  const allowed = host.can(mode === 'new' ? 'allyvora-create' : 'allyvora-edit');

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let live = true;
    setRecord(null); setLoadError(null);
    client.patients.get(id).then(next => {if (live) setRecord(next);}).catch(failure => {if (live) setLoadError(failure);});
    return () => {live = false;};
  }, [client, mode, id, attempt]);
  const documentHost = useRef(host.document);
  documentHost.current = host.document;
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {if (!dirty.current) return; event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', onUnload);
    // Leaving the editor (any route) clears the host navigation guard.
    return () => {window.removeEventListener('beforeunload', onUnload); documentHost.current.reportDirty(false);};
  }, []);

  // A branch change after the form opens doesn't reset what was typed.
  const initialValues = useMemo<FormValues | null>(() => mode === 'new' ? defaultValues(todayISO(), branchId) : record ? {...record.data} : null, [mode, record]); // eslint-disable-line react-hooks/exhaustive-deps
  const back: NavigationTarget = mode === 'edit' && id ? {pageId: PAGE.register, mode: 'view', recordId: String(id)} : {pageId: PAGE.register, ...(listQuery ? {query: listQuery} : {})} as NavigationTarget;
  const leave = useCallback((target: NavigationTarget) => {if (dirty.current) setLeaving(target); else navigation.open(target);}, [navigation]);
  const onDirtyChange = useCallback((next: boolean) => {dirty.current = next; host.document.reportDirty(next);}, [host.document]);

  const onSubmit = useCallback(async (values: FormValues): Promise<SubmitResult> => {
    try {
      const saved = mode === 'new' ? await client.patients.create(values) : await client.patients.update(record!.id, values, record!.version);
      dirty.current = false; host.document.reportDirty(false);
      host.notify(`${t(mode === 'new' ? 'Patient registered' : 'Changes saved')}: ${t('{name}, MRN {mrn}', {name: saved.displayName, mrn: saved.mrn})}`, {tone: 'success'});
      navigation.open({pageId: PAGE.register, mode: 'view', recordId: String(saved.id)});
      return {ok: true};
    } catch (failure) {
      if (failure instanceof AllyVoraFailure && failure.status === 422 && failure.body.errors) {
        host.notify(`${t('Some fields need attention')}: ${t('The server found problems the form highlighted for you.')}`, {tone: 'error'});
        return {ok: false, errors: failure.body.errors};
      }
      if (failure instanceof AllyVoraFailure && failure.status === 409) {
        host.notify(`${t('Someone else saved this patient')}: ${failure.message}`, {tone: 'error'});
        return {ok: false};
      }
      host.notify(`${t('Patient not saved')}: ${messageOf(failure)}`, {tone: 'error'});
      return {ok: false};
    }
  }, [mode, record, client, host, t, navigation]);


  if (!allowed) return <div className="p-6"><AccessDenied/></div>;
  if (loadError) {
    if (loadError instanceof AllyVoraFailure && loadError.status === 404) return <div className="p-6"><NotFoundState title="This patient doesn’t exist" description={messageOf(loadError)} action={<Button onClick={() => navigation.open({pageId: PAGE.register})}>{t('Open patient register')}</Button>}/></div>;
    return <div className="p-6"><RecoveryNotice failure={failureOf(loadError)} onRetry={() => setAttempt(n => n + 1)} onReturn={() => navigation.open({pageId: PAGE.register})}/></div>;
  }
  if (!initialValues) return <LoadingState/>;
  const title = mode === 'new' ? t('New patient') : t('Edit {name}', {name: record?.displayName ?? t('patient')});
  const branchName = session.branches.find(branch => branch.id === record?.branchId)?.name;
  return <div className="flex h-[calc(100dvh-var(--header-height,56px)-var(--footer-height,32px)-24px)] min-h-[560px] flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6" data-patient-editor={mode}>
    {/* Visible title and per-form layout switcher removed by owner request; the layout is chosen in Layout setup. */}
    <h1 className="sr-only">{title}</h1>
    <div className="min-h-0 flex-1">
      <PatientForm key={`${mode}-${id ?? 'new'}-${record?.version ?? 0}`} mode={mode} initialValues={initialValues} settings={settings} lookups={lookups}
        identity={record ? {mrn: record.mrn, orgNumber: record.orgNumber, patientId: record.id, ...(branchName ? {branchName} : {})} : undefined}
        initialSection={section} onSubmit={onSubmit} onCancel={() => leave(back)} onDirtyChange={onDirtyChange} draftKey={mode === 'new' ? NEW_DRAFT_KEY : null}/>
    </div>
    <ConfirmDialog open={!!leaving} title="Leave without saving?" confirmLabel={t('Discard changes')} tone="danger" message="Your changes to this patient will be lost."
      onCancel={() => setLeaving(null)}
      onConfirm={() => {dirty.current = false; host.document.reportDirty(false); if (mode === 'new') saveDraft(NEW_DRAFT_KEY, null); const target = leaving!; setLeaving(null); navigation.open(target);}}/>
  </div>;
}
