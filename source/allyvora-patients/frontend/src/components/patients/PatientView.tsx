'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, Archive, FilePlus2, History, Pencil, Printer, RefreshCw, UserPlus } from 'lucide-react';
import {
  FIELDS,
  SECTIONS,
  formatValue,
  isEmptyValue,
  isRequired,
  sectionProgress,
  validateForm,
  visibleFields,
  type AuditEntry,
  type PatientRecord,
  type SectionId,
} from '@allyvora/shared';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/cn';
import { dateTime, relativeTime } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Confirm';
import { EmptyState, Skeleton } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { StatusGlyph } from '@/components/patient-form/parts';
import { PatientBand } from './PatientBand';

const ACTION_TEXT: Record<AuditEntry['action'], string> = {
  created: 'Registered the patient',
  updated: 'Updated the record',
  deactivated: 'Marked the record inactive',
  reactivated: 'Made the record active again',
};

function SectionCard({ record, section }: { record: PatientRecord; section: SectionId }) {
  const { lookups } = useApp();
  const def = SECTIONS.find((s) => s.id === section)!;
  const v = record.data;
  const errors = useMemo(() => validateForm(v), [v]);
  const progress = sectionProgress(section, v, errors, {});
  const rows = visibleFields(section, v)
    .map((f) => {
      if (f.id === 'mrn') return { f, text: record.mrn };
      if (f.id === 'orgNumber') return { f, text: record.orgNumber };
      if (f.id === 'branchId') return { f, text: record.branchName };
      if (f.type === 'switch') return v[f.id] === true ? { f, text: 'Yes' } : null;
      if (isEmptyValue(v[f.id])) return null;
      return { f, text: formatValue(f, v[f.id], lookups, { mask: true }) };
    })
    .filter(Boolean) as { f: (typeof FIELDS)[number]; text: string }[];

  return (
    <section className="mb-4 break-inside-avoid rounded-2xl border border-line bg-surface" aria-labelledby={`v-${section}`}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <StatusGlyph index={def.index} progress={progress} size="sm" />
        <h2 id={`v-${section}`} className="flex-1 font-semibold text-ink">
          {def.title}
        </h2>
        <Link
          href={`/patients?mode=edit&id=${record.id}&section=${section}`}
          className="print-hide inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-brand hover:bg-brand-soft"
          aria-label={`Edit ${def.title}`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-ink-3">Nothing recorded yet.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2">
          {rows.map(({ f, text }) => (
            <div key={f.id} className={cn('min-w-0', (f.span === 2 || f.span === 'full' || f.type === 'textarea' || f.type === 'signature') && 'sm:col-span-2')}>
              <dt className="text-xs text-ink-3">{f.label}</dt>
              <dd className="mt-0.5 break-words text-[13.5px] text-ink">
                {f.type === 'signature' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(v[f.id])} alt="Patient signature" className="h-16 rounded-md border border-line bg-white px-2" />
                ) : f.type === 'multiselect' ? (
                  <span className="flex flex-wrap gap-1">
                    {text.split(', ').map((t) => (
                      <span key={t} className={cn('rounded-md px-2 py-0.5 text-xs font-medium', f.id === 'allergens' ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink')}>
                        {t}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={cn(['mrn', 'orgNumber', 'mobile', 'idNumber', 'abhaNumber'].includes(f.id) && 'tabular')}>{text}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export function PatientView({ id }: { id: number }) {
  const router = useRouter();
  const toast = useToast();
  const { lookups, pushRecent } = useApp();
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    Promise.all([api.patients.get(id), api.patients.audit(id)])
      .then(([r, a]) => {
        if (!live) return;
        setRecord(r);
        setAudit(a);
        pushRecent({ id: r.id, name: r.displayName, mrn: r.mrn });
      })
      .catch((e: Error) => live && setError(e));
    return () => {
      live = false;
    };
  }, [id, attempt, pushRecent]);

  const gaps = useMemo(() => {
    if (!record) return [];
    return SECTIONS.map((s) => {
      const missing = visibleFields(s.id, record.data).filter(
        (f) => f.type !== 'readonly' && f.type !== 'switch' && !isRequired(f, record.data) && isEmptyValue(record.data[f.id]),
      );
      return { s, missing };
    }).filter((g) => g.missing.length > 0);
  }, [record]);

  if (error) {
    return (
      <EmptyState
        icon={<RefreshCw className="size-6" />}
        title="This patient couldn’t load"
        action={
          <div className="flex gap-2">
            <Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
            <Button variant="primary" onClick={() => router.push('/patients')}>
              Open patient register
            </Button>
          </div>
        }
      >
        {error.message}
      </EmptyState>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Skeleton className="h-[50vh] rounded-2xl" />
          <Skeleton className="h-[40vh] rounded-2xl" />
        </div>
      </div>
    );
  }

  const inactive = record.status === 'inactive';
  const toggleStatus = async () => {
    setBusy(true);
    try {
      const r = await api.patients.setStatus(record.id, inactive ? 'active' : 'inactive');
      setRecord(r);
      setAudit(await api.patients.audit(record.id));
      toast({ tone: 'success', title: inactive ? 'Record is active again' : 'Record marked inactive', detail: r.displayName });
    } catch (e) {
      toast({ tone: 'error', title: 'Status not changed', detail: (e as Error).message });
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-3 py-4 sm:px-4 lg:px-6">
      <PatientBand
        values={record.data}
        lookups={lookups}
        mrn={record.mrn}
        completion={record.completion}
        size="full"
        status={record.status}
        actions={
          <div className="print-hide flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" icon={<Pencil className="size-4" />} onClick={() => router.push(`/patients?mode=edit&id=${record.id}`)}>
              Edit
            </Button>
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()} className="hidden sm:inline-flex">
              Print
            </Button>
          </div>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="columns-1 gap-4 lg:columns-2">
          {SECTIONS.map((s) => (
            <SectionCard key={s.id} record={record} section={s.id} />
          ))}
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--header-h)+16px)]">
          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="font-semibold text-ink">Record</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              {[
                ['Branch', record.branchName],
                ['Organisation number', record.orgNumber],
                ['Registered', `${dateTime(record.createdAt)} by ${record.createdBy}`],
                ['Last updated', `${relativeTime(record.updatedAt)} by ${record.updatedBy}`],
                ['Status', inactive ? 'Inactive' : 'Active'],
              ].map(([k, val]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-32 shrink-0 text-ink-3">{k}</dt>
                  <dd className="tabular min-w-0 text-ink">{val}</dd>
                </div>
              ))}
            </dl>
            <div className="print-hide mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              <Button size="sm" variant="ghost" icon={<UserPlus className="size-4" />} onClick={() => router.push('/patients?mode=new')}>
                Register another
              </Button>
              <Button
                size="sm"
                variant={inactive ? 'secondary' : 'danger'}
                icon={inactive ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                onClick={() => setConfirm(true)}
                className="ml-auto"
              >
                {inactive ? 'Make active' : 'Mark inactive'}
              </Button>
            </div>
          </section>

          {gaps.length > 0 && (
            <section className="print-hide rounded-2xl border border-line bg-surface p-4">
              <h2 className="flex items-center gap-2 font-semibold text-ink">
                <FilePlus2 className="size-4 text-accent" aria-hidden />
                Details still missing
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-2">Optional, but they help the care team. Each opens the right section.</p>
              <ul className="mt-3 space-y-1">
                {gaps.map(({ s, missing }) => (
                  <li key={s.id}>
                    <Link href={`/patients?mode=edit&id=${record.id}&section=${s.id}`} className="block rounded-lg px-2.5 py-2 hover:bg-sunken">
                      <span className="block text-[13px] font-medium text-ink">{s.title}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {missing
                          .slice(0, 3)
                          .map((f) => f.label)
                          .join(', ')}
                        {missing.length > 3 ? ` and ${missing.length - 3} more` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="flex items-center gap-2 font-semibold text-ink">
              <History className="size-4 text-ink-3" aria-hidden />
              Activity
            </h2>
            <ol className="mt-3 space-y-0">
              {(audit ?? []).map((a, i, arr) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" aria-hidden />}
                  <span
                    className={cn(
                      'relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface',
                      a.action === 'created' ? 'bg-brand' : a.action === 'deactivated' ? 'bg-danger' : 'bg-line-strong',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      <span className="font-medium">{a.actor}</span> {ACTION_TEXT[a.action].charAt(0).toLowerCase() + ACTION_TEXT[a.action].slice(1)}
                    </p>
                    <p className="text-xs text-ink-3" title={dateTime(a.at)}>
                      {relativeTime(a.at)}
                    </p>
                    {a.changes.length > 0 && (
                      <ul className="mt-1.5 space-y-1 rounded-lg bg-sunken/70 p-2 text-xs">
                        {a.changes.slice(0, 6).map((c) => (
                          <li key={c.field} className="text-ink-2">
                            <span className="font-medium text-ink">{c.label}</span>{' '}
                            {c.from ? (
                              <>
                                <span className="line-through decoration-ink-3/60">{c.from}</span> to <span className="text-ink">{c.to || 'blank'}</span>
                              </>
                            ) : (
                              <>set to <span className="text-ink">{c.to}</span></>
                            )}
                          </li>
                        ))}
                        {a.changes.length > 6 && <li className="text-ink-3">and {a.changes.length - 6} more changes</li>}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm}
        title={inactive ? 'Make this record active?' : 'Mark this record inactive?'}
        confirmLabel={inactive ? 'Make active' : 'Mark inactive'}
        tone={inactive ? 'primary' : 'danger'}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={toggleStatus}
      >
        {inactive
          ? `${record.displayName} will show in searches and duplicate checks again.`
          : `${record.displayName} will be hidden from the register and duplicate checks. Their MRN is kept and the record can be made active again.`}
      </ConfirmDialog>
    </div>
  );
}
