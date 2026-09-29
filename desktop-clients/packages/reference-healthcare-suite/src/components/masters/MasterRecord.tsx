'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useWriteAccess} from '../../lib/session';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import { ArrowLeft, ArrowUpRight, Pencil, Power, Save } from 'lucide-react';
import { ReferenceLink as Link } from '@pepbits/reference-host';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient, ApiError, errorMessage } from '../../lib/api';
import { useLookupInvalidation } from '../../lib/lookups';
import { blankRecord, MasterDef, toPayload } from '../../lib/masters';
import { Row } from '../../lib/types';
import { Button } from '../ui/controls';
import { ErrorBanner, Spinner, StatusBadge } from '../ui/display';
import { useToast } from '../ui/Toast';
import { DynamicForm } from './DynamicForm';

export type RecordMode = 'view' | 'edit' | 'new';

export function MasterRecord({ def, id, initialMode, editSignal = 0, active = true, prefill, onSaved, onDirty, onTitle, onBack, onCancelNew }: {
  def: MasterDef; id: string | null; initialMode: RecordMode; editSignal?: number; active?: boolean; prefill?: Row;
  onSaved?: (row: Row, created: boolean, again?: boolean) => void; onDirty?: (dirty: boolean) => void; onTitle?: (t: string) => void;
  onBack?: () => void; onCancelNew?: () => void;
}) {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const invalidateLookups = useLookupInvalidation();
  const api = useApiClient();
  const canWrite=useWriteAccess();
  const shortcutsEnabled = useReferenceHost().preferences.keyboardShortcuts;
  const toast = useToast();
  const [mode, setMode] = useState<RecordMode>(canWrite?initialMode:'view');
  const [row, setRow] = useState<Row | null>(id ? null : { ...blankRecord(def), ...prefill });
  const [draft, setDraft] = useState<Row>(row ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try { const r = await api<Row>(`/masters/${def.entity}/${id}`); setRow(r); setDraft(r); onTitle?.(def.titleOf(r)); }
    catch (e) { setLoadError(errorMessage(e)); }
  }, [id, def]); // eslint-disable-hc-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (canWrite && editSignal) setMode((m) => (m === 'view' ? 'edit' : m)); }, [editSignal,canWrite]);

  const dirty = mode !== 'view' && !!row && JSON.stringify(toPayload(def, draft)) !== JSON.stringify(toPayload(def, row));
  const dirtyRef = useRef(dirty);
  useEffect(() => { if (dirtyRef.current !== dirty) { dirtyRef.current = dirty; onDirty?.(dirty); } }, [dirty, onDirty]);

  const save = useCallback(async (again = false) => {
    setSaving(true); setErrors({}); setBanner(null);
    try {
      const payload = toPayload(def, draft);
      const saved = mode === 'new'
        ? await api<Row>(`/masters/${def.entity}`, { method: 'POST', body: payload })
        : await api<Row>(`/masters/${def.entity}/${id}`, { method: 'PUT', body: payload });
      invalidateLookups();
      toast({ tone: 'ok', title: healthcareT("{v0} {v1}",{v0:def.singular,v1:mode === 'new' ? 'created' : 'saved'}), body: def.titleOf(saved) });
      const created = mode === 'new';
      if (again) { const blank = { ...blankRecord(def), ...prefill }; setRow(blank); setDraft(blank); }
      else { setRow(saved); setDraft(saved); setMode('view'); onTitle?.(def.titleOf(saved)); }
      dirtyRef.current = false; onDirty?.(false);
      onSaved?.(saved, created, again);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setBanner('Fix the highlighted fields and save again.'); }
      else setBanner(errorMessage(e));
    } finally { setSaving(false); }
  }, [def, draft, mode, id, prefill, toast, onSaved, onTitle, onDirty]);

  useEffect(() => {
    if (!active || mode === 'view' || !shortcutsEnabled) return;
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, mode, save, shortcutsEnabled]);

  const toggleStatus = async () => {
    if (!row) return;
    const next = row.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const r = await api<Row>(`/masters/${def.entity}/${row.id}/status`, { method: 'PATCH', body: { status: next } });
      invalidateLookups(); setRow(r); setDraft(r); onSaved?.(r, false);
      toast({ tone: 'ok', title: healthcareT("{v0} {v1}",{v0:def.singular,v1:next === 'Active' ? 'activated' : 'deactivated'}) });
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not change status"), body: errorMessage(e) }); }
  };

  const cancel = () => {
    if (mode === 'new') { onCancelNew?.(); return; }
    setDraft(row!); setErrors({}); setBanner(null); setMode('view');
  };

  if (loadError) return <div className="p-4"><ErrorBanner message={loadError} onRetry={load} /></div>;
  if (!row) return <div className="flex flex-1 items-center justify-center"><Spinner label={t("Loading {v0}",{v0:def.singular.toLowerCase()})} /></div>;

  const title = mode === 'new' ? `New ${def.singular.toLowerCase()}` : def.titleOf(row);
  const Icon = def.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hc-line px-4">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && <Button size="sm" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBack} aria-label="Back to worklist" />}
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-hc-petrol-50 text-hc-petrol-600"><Icon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold">{title}</h2>
              {mode !== 'new' && <StatusBadge status={row.status} />}
              {mode === 'edit' && <span className="text-hc-2xs font-medium text-hc-warn-700"><LocalizedText message="Editing" /></span>}
            </div>
            <p className="truncate text-hc-xs text-hc-ink-mute">{mode === 'new' ? def.description : [row.id, def.subtitleOf?.(row)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode === 'view' ? (
            <>
              {def.links?.(row).map((l) => (
                <Link key={l.href} href={l.href} className="inline-flex h-8 items-center gap-1 rounded px-2.5 text-hc-sm text-hc-petrol-700 hover:bg-hc-petrol-50">
                  {l.label}<ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              ))}
              <Button variant="ghost" icon={<Power className="h-3.5 w-3.5" />} onClick={toggleStatus}>{row.status === 'Active' ? <LocalizedText message="Deactivate"/> : <LocalizedText message="Activate"/>}</Button>
              <Button mutation variant="primary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setMode('edit')}><LocalizedText message="Edit" /></Button>
            </>
          ) : (
            <>
              <span className="mr-1 hidden text-hc-2xs text-hc-ink-faint lg:inline"><LocalizedText message="Ctrl+S to save" /></span>
              <Button variant="ghost" onClick={cancel}><LocalizedText message="Cancel" /></Button>
              {mode === 'new' && <Button mutation variant="secondary" loading={saving} onClick={() => save(true)}><LocalizedText message="Save & new" /></Button>}
              <Button variant="primary" icon={<Save className="h-3.5 w-3.5" />} loading={saving} onClick={() => save()}>{mode === 'new' ? <LocalizedText message="Create"/> : <LocalizedText message="Save changes"/>}</Button>
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-hc-canvas/50 p-3">
        {banner && <div className="mb-3"><ErrorBanner message={banner} /></div>}
        <DynamicForm sections={def.sections} value={mode === 'view' ? row : draft} onChange={setDraft} errors={errors} readOnly={mode === 'view'} idPrefix={`${def.entity}-${id ?? 'new'}`} />
      </div>
    </div>
  );
}
