'use client';
import { useRouter, useSearchParams, cx, isNumeric, todayISO, useFormat, useEntityApi, Avatar, Badge, Button, MenuItem, Modal, Popover, Progress, StatusBadge, useToast, LocalAttachments, missingRequired, RecordForm, type Field, type Row, RecordActivity, RecordDocuments } from '@pepbits/reference-keystone-core';
import { useReducedMotion } from '@pepbits/reference-keystone-core';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { Check, Copy, Ellipsis, FileText, History, Pencil, Save, Trash2, Upload, UserRoundX, X } from 'lucide-react';
import { newPath, nounOf, pagePath, primaryField, recordPath } from '../../lib/registry';
import { usePageTitle } from '../shell/pageTitle';
import { Page, RecordBar, RecordLoading, Section, SectionNav, StatStrip, useRecord, useSaveShortcut, useUnsavedGuard, type RecordProps } from './RecordShell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export function ActivityList({ row, entity }: { row: Row; entity: string; noun?: string }) {
  return <RecordActivity entity={entity} id={row.id} compact />;
}

export function DocumentList({ row, entity }: { row: Row; entity: string }) {
  return <RecordDocuments entity={entity} id={row.id} compact />;
}

const slugOf = (s: string) => `sec-${s.toLowerCase().replace(/[^a-z]+/g, '-')}`;

export default function ProfileRecord({ def, id, mode }: RecordProps) {
  const reducedMotion = useReducedMotion();
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtValue } = useFormat();
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const { row, loading, error, reload } = useRecord(def, id);
  const primary = primaryField(def);
  const statusF = def.fields.find((f) => f.type === 'status');
  const codeF = def.fields.find((f) => f.type === 'code');
  const noun = nounOf(def);
  const editing = mode !== 'view';

  const defaults = useMemo(() => {
    const d: Partial<Row> = {};
    def.fields.forEach((f) => {
      if (f.type === 'status' && f.options) d[f.key] = f.options[0];
      if (f.type === 'boolean') d[f.key] = false;
    });
    search.forEach((v, k) => { if (k !== 'copy') d[k] = v; });
    return d;
  }, [def, search]);
  const [draft, setDraft] = useState<Partial<Row>>(defaults);
  const [errors, setErrors] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (row) setDraft(row); }, [row]);
  // "Duplicate" opens /new?copy=<id>
  useEffect(() => {
    const copy = search.get('copy');
    if (mode !== 'new' || !copy) return;
    entityApi.get(def.entity, copy).then((r) => {
      const { id: _i, code: _c, ...rest } = r; void _i; void _c;
      setDraft({ ...rest, [primary.key]: `${rest[primary.key] ?? ''} (copy)` });
    }).catch(() => {});
  }, [mode, search, def.entity, primary.key]);

  const groups = useMemo(() => {
    const named = [...new Set(def.fields.filter((f) => f.group).map((f) => f.group!))];
    return named.length ? named : ['Details'];
  }, [def]);
  const fieldsOf = useCallback((g: string) => def.fields.filter((f) => (f.group ? f.group === g : g === 'Details') && !(f.type === 'code') && !(f.type === 'status' && !f.group)), [def]);
  const stats = def.fields.filter((f) => isNumeric(f) && f.group).slice(0, 4);
  const meta = def.fields.filter((f) => (f.type === 'select' || f.type === 'city' || f.type === 'date' || f.type === 'person') && f !== primary && !isNumeric(f)).slice(0, 4);

  const baseline = mode === 'new' ? defaults : row ?? {};
  const changed = editing ? def.fields.filter((f) => JSON.stringify(draft[f.key] ?? '') !== JSON.stringify(baseline[f.key] ?? '')) : [];
  const required = def.fields.filter((f) => f.required);
  const missing = missingRequired(def.fields, draft);
  useUnsavedGuard(editing && changed.length > 0);

  const title = mode === 'new' ? (draft[primary.key] ? String(draft[primary.key]) : `New ${noun}`) : row ? fmtValue(primary, row[primary.key]) : '';
  usePageTitle(mode === 'edit' && title ? `Edit ${title}` : title);

  const save = useCallback(async (andNew = false) => {
    if (missing.length) {
      setErrors(true);
      toast(referenceT("{value0} is required", {value0: referenceT(missing[0].label)}), 'danger');
      document.getElementById(slugOf(missing[0].group ?? 'Details'))?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    setSaving(andNew ? 'new' : 'save');
    try {
      const saved = mode === 'new' ? await entityApi.create(def.entity, draft) : await entityApi.update(def.entity, id!, draft);
      toast(mode === 'new' ? `${noun} ${saved.code ?? ''} created` : 'Changes saved');
      if (andNew) { setDraft(defaults); setErrors(false); router.replace(newPath(def)); window.scrollTo(0, 0); }
      else router.replace(recordPath(def, saved.id));
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setSaving(null); }
  }, [missing, mode, def, draft, id, noun, defaults, router, toast]);
  useSaveShortcut(editing ? () => save(false) : null);

  const setStatus = async (s: string) => {
    await entityApi.update(def.entity, id!, { status: s });
    toast(referenceT("Marked as {value0}", {value0: referenceT(s)}));
    reload();
  };
  const remove = async () => {
    await entityApi.remove(def.entity, id!);
    toast(referenceT("{value0} deleted", {value0: title}));
    router.push(pagePath(def));
  };

  const navItems = useMemo(() => groups.map((g) => ({ id: slugOf(g), label: g, flag: errors && fieldsOf(g).some((f) => missing.includes(f)) })), [groups, errors, missing, fieldsOf]);

  if (mode !== 'new' && (loading || error || !row)) return <RecordLoading error={error} onRetry={reload} />;

  const actions = editing ? (
    <>
      <Button icon={X} onClick={() => router.push(mode === 'new' ? pagePath(def) : recordPath(def, id!))}><ReferenceText message="Cancel" /></Button>
      {mode === 'new' && <Button loading={saving === 'new'} onClick={() => save(true)} className="hidden sm:inline-flex"><ReferenceText message="Save and add another" /></Button>}
      <Button variant="primary" icon={Save} loading={saving === 'save'} onClick={() => save(false)}>{mode === 'new' ? `Create ${noun}` : referenceT("Save changes")}</Button>
    </>
  ) : (
    <>
      <Popover align="right" width="w-56" trigger={(t) => <Button onClick={t} aria-label={referenceT("More actions")} className="px-2"><Ellipsis size={16} /></Button>}>
        {(close) => (
          <>
            <MenuItem icon={Copy} onClick={() => { close(); router.push(`${newPath(def)}?copy=${id}`); }}><ReferenceText message="Duplicate" /></MenuItem>
            {statusF?.options?.filter((o) => o !== row?.[statusF.key]).map((o) => (
              <MenuItem key={o} icon={/Inactive|Exited|Blocked|Disabled/.test(o) ? UserRoundX : History} onClick={() => { close(); setStatus(o); }}><ReferenceText message="Mark as" /> <ReferenceText message={o} /></MenuItem>
            ))}
            <div className="my-1 border-t border-line" />
            <MenuItem icon={Trash2} danger onClick={() => { close(); setConfirmDelete(true); }}><ReferenceText message="Delete" /> {noun}</MenuItem>
          </>
        )}
      </Popover>
      <Button variant="primary" icon={Pencil} onClick={() => router.push(recordPath(def, id!, true))}><ReferenceText message="Edit" /></Button>
    </>
  );

  const value = editing ? draft : row ?? {};
  return (
    <>
      <RecordBar def={def} id={id} mode={mode} dirty={changed.length > 0}>{actions}</RecordBar>
      <Page>
        {/* identity strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border border-line bg-surface p-4 md:p-5">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={title || noun} size={52} className="text-[length:calc(17px*var(--fs-scale))]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {codeF && <span className="text-[length:calc(13px*var(--fs-scale))] font-semibold text-brand-ink tnum">{mode === 'new' ? referenceT("Number assigned on save") : String(value[codeF.key] ?? '')}</span>}
                {statusF && <StatusBadge value={value[statusF.key]} />}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">
                {meta.map((f) => value[f.key] ? <span key={f.key}><span className="text-ink-3"><ReferenceText message={f.label} /></span> <span className="text-ink-2">{fmtValue(f, value[f.key])}</span></span> : null)}
              </div>
            </div>
          </div>
          {mode !== 'new' && stats.length > 0 && <div className="min-w-[280px] flex-1"><StatStrip items={stats.map((f) => ({ label: f.label, value: fmtValue(f, value[f.key]) }))} /></div>}
        </div>

        <div className={cx('grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]', 'xl:grid-cols-[170px_minmax(0,1fr)_300px]')}>
          <SectionNav items={navItems} />
          <div className="min-w-0 space-y-4">
            {editing && statusF && (
              <Section id="sec-status" title={referenceT("Status")} description={referenceT("Controls whether this {value0} can be used on new transactions.", {value0: noun})}>
                <div className="flex flex-wrap gap-2">
                  {statusF.options?.map((o) => (
                    <button key={o} onClick={() => setDraft((d) => ({ ...d, [statusF.key]: o }))} className={cx('rounded-full border px-3 py-1 text-[length:calc(12.5px*var(--fs-scale))] font-medium transition-colors', draft[statusF.key] === o ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-2 hover:border-line-strong')}>
                      {draft[statusF.key] === o && <Check size={12} className="-ml-0.5 mr-1 inline" strokeWidth={3} />}{o}
                    </button>
                  ))}
                </div>
              </Section>
            )}
            {groups.map((g) => {
              const fs: Field[] = fieldsOf(g).filter((f) => editing || !stats.includes(f));
              if (!fs.length) return null;
              return (
                <Section key={g} id={slugOf(g)} title={g}>
                  <RecordForm fields={fs} value={value} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} readOnly={!editing} showErrors={errors} columns={3} />
                </Section>
              );
            })}
          </div>
          <aside className="hidden space-y-4 xl:block">
            {mode === 'new' ? (
              <div className="sticky top-16 space-y-4">
                <Section title={referenceT("Before you create")} bodyClass="p-4">
                  <Progress value={required.length ? ((required.length - missing.length) / required.length) * 100 : 100} tone={missing.length ? 'warn' : 'ok'} className="mb-3" />
                  <ul className="space-y-1.5 text-[length:calc(12.5px*var(--fs-scale))]">
                    {required.map((f) => (
                      <li key={f.key} className="flex items-center gap-2">
                        <span className={cx('grid h-4 w-4 place-items-center rounded-full', missing.includes(f) ? 'border border-line-strong' : 'bg-ok text-white')}>{!missing.includes(f) && <Check size={10} strokeWidth={3} />}</span>
                        <span className={missing.includes(f) ? 'text-ink-2' : 'text-ink-3 line-through'}><ReferenceText message={f.label} /></span>
                      </li>
                    ))}
                    {!required.length && <li className="text-ink-3"><ReferenceText message="No mandatory fields. Fill what you know." /></li>}
                  </ul>
                  <p className="mt-3 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Tip: press Ctrl + S to save." /></p>
                </Section>
              </div>
            ) : mode === 'edit' ? (
              <div className="sticky top-16">
                <Section title={referenceT("Changes")} bodyClass="p-4">
                  {changed.length ? (
                    <ul className="space-y-2 text-[length:calc(12.5px*var(--fs-scale))]">
                      {changed.map((f) => (
                        <li key={f.key}>
                          <div className="font-medium text-ink"><ReferenceText message={f.label} /></div>
                          <div className="truncate text-ink-3"><span className="line-through">{fmtValue(f, baseline[f.key])}</span> <span className="text-ink-2"><ReferenceText message="to" /> {fmtValue(f, draft[f.key])}</span></div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[length:calc(12.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing changed yet." /></p>}
                </Section>
              </div>
            ) : (
              <>
                <Section title={referenceT("Activity")} bodyClass="p-4"><ActivityList row={row!} entity={def.entity} noun={noun} /></Section>
                <Section title={referenceT("Documents")} bodyClass="p-4"><DocumentList row={row!} entity={def.entity} /></Section>
              </>
            )}
          </aside>
        </div>
      </Page>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={referenceT("Delete {value0}?", {value0: title})}
        footer={<><Button onClick={() => setConfirmDelete(false)}><ReferenceText message="Keep it" /></Button><Button variant="danger" icon={Trash2} onClick={remove}><ReferenceText message="Delete" /></Button></>}>
        <p className="text-[length:calc(13px*var(--fs-scale))] text-ink-2"><ReferenceText message="Existing documents keep their copy of this" /> {noun}<ReferenceText message=". You cannot undo this." /></p>
      </Modal>
    </>
  );
}
