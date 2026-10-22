'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { defaultValues, todayISO, type FormValues, type LayoutKind, type PatientRecord, type SectionId } from '@allyvora/shared';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { EmptyState, Skeleton } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { LayoutSwitcher } from '@/components/patient-form/LayoutSwitcher';
import { PatientForm, type SubmitResult } from '@/components/patient-form/PatientForm';
import { LIST_QS_KEY } from './PatientList';

function listHref() {
  try {
    const qs = sessionStorage.getItem(LIST_QS_KEY);
    return qs ? `/patients?${qs}` : '/patients';
  } catch {
    return '/patients';
  }
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6">
      <Skeleton className="h-[72px] w-full rounded-2xl" />
      <div className="flex flex-1 gap-4">
        <Skeleton className="hidden w-60 rounded-2xl lg:block" />
        <Skeleton className="h-[60vh] flex-1 rounded-2xl" />
      </div>
    </div>
  );
}

export function PatientEditor({ mode, id, section }: { mode: 'new' | 'edit'; id?: number; section?: SectionId }) {
  const router = useRouter();
  const toast = useToast();
  const { ready, settings, setSettings, lookups, branchId, session, pushRecent } = useApp();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    let live = true;
    setRecord(null);
    setLoadError(null);
    api.patients
      .get(id)
      .then((r) => live && setRecord(r))
      .catch((e: Error) => live && setLoadError(e));
    return () => {
      live = false;
    };
  }, [mode, id]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const initialValues = useMemo<FormValues | null>(() => {
    if (mode === 'new') return ready ? defaultValues(todayISO(), branchId) : null;
    return record ? { ...record.data } : null;
    // Branch changes after the form opens shouldn't reset what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready, record]);

  const backHref = mode === 'edit' && id ? `/patients?mode=view&id=${id}` : listHref();

  const leave = useCallback(
    (href: string) => {
      if (dirty.current) setLeaving(href);
      else router.push(href);
    },
    [router],
  );

  const onSubmit = useCallback(
    async (values: FormValues): Promise<SubmitResult> => {
      try {
        const saved =
          mode === 'new' ? await api.patients.create(values) : await api.patients.update(record!.id, values, record!.version);
        dirty.current = false;
        pushRecent({ id: saved.id, name: saved.displayName, mrn: saved.mrn });
        toast({
          tone: 'success',
          title: mode === 'new' ? 'Patient registered' : 'Changes saved',
          detail: `${saved.displayName}, MRN ${saved.mrn}`,
        });
        router.push(`/patients?mode=view&id=${saved.id}`);
        return { ok: true };
      } catch (e) {
        if (e instanceof ApiError && e.status === 422 && e.body.errors) {
          toast({ tone: 'error', title: 'Some fields need attention', detail: 'The server found problems the form highlighted for you.' });
          return { ok: false, errors: e.body.errors };
        }
        if (e instanceof ApiError && e.status === 409) {
          toast({ tone: 'error', title: 'Someone else saved this patient', detail: e.message });
          return { ok: false };
        }
        toast({ tone: 'error', title: 'Patient not saved', detail: (e as Error).message });
        return { ok: false };
      }
    },
    [mode, record, pushRecent, toast, router],
  );

  const changeLayout = (layout: LayoutKind) => {
    const nextSettings = { ...settings, layout };
    setSettings(nextSettings);
    api.settings.saveLayout(nextSettings).catch(() => toast({ tone: 'error', title: 'Layout not saved', detail: 'It applies to this visit only.' }));
  };

  if (loadError) {
    return (
      <EmptyState
        icon={<RefreshCw className="size-6" />}
        title={loadError instanceof ApiError && loadError.status === 404 ? 'This patient doesn’t exist' : 'Patient couldn’t load'}
        action={<Button onClick={() => router.push('/patients')}>Open patient register</Button>}
      >
        {loadError.message}
      </EmptyState>
    );
  }
  if (!initialValues) return <EditorSkeleton />;

  const title = mode === 'new' ? 'New patient' : `Edit ${record?.displayName ?? 'patient'}`;
  const branchName = session?.branches.find((b) => b.id === record?.branchId)?.name;

  return (
    <div className="flex h-[calc(100dvh-var(--header-h)-var(--footer-h))] min-h-[560px] flex-col gap-3 px-3 py-3 sm:px-4 lg:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-cond text-[22px] font-semibold leading-7 tracking-tight text-ink">{title}</h1>
        <LayoutSwitcher value={settings.layout} onChange={changeLayout} />
      </div>
      <div className="min-h-0 flex-1">
        <PatientForm
          key={`${mode}-${id ?? 'new'}-${record?.version ?? 0}`}
          mode={mode}
          initialValues={initialValues}
          settings={settings}
          lookups={lookups}
          identity={record ? { mrn: record.mrn, orgNumber: record.orgNumber, patientId: record.id, branchName } : undefined}
          initialSection={section}
          onSubmit={onSubmit}
          onCancel={() => leave(backHref)}
          onDirtyChange={(d) => {
            dirty.current = d;
          }}
          draftKey={mode === 'new' ? 'allyvora:draft:new' : null}
        />
      </div>
      <ConfirmDialog
        open={!!leaving}
        title="Leave without saving?"
        confirmLabel="Discard changes"
        tone="danger"
        onCancel={() => setLeaving(null)}
        onConfirm={() => {
          dirty.current = false;
          if (mode === 'new') {
            try {
              localStorage.removeItem('allyvora:draft:new');
            } catch {
              /* ignore */
            }
          }
          const href = leaving!;
          setLeaving(null);
          router.push(href);
        }}
      >
        Your changes to this patient will be lost.
      </ConfirmDialog>
    </div>
  );
}
