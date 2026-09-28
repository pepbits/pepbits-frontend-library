'use client';
import { cx, isNumeric, todayISO, useFormat, useMediaQuery, useStoredState, useEntityApi, Avatar, Button, Drawer, Empty, MenuItem, Popover, Segmented, StatusBadge, Tabs, useToast, LocalAttachments, missingRequired, RecordForm, FieldInput, WorkList, Card, defaultsFor, Frame, nounOf, type PageDef, type Row, RecordActivity, RecordDocuments, ViewStateStatus, useEntitySupport } from '@pepbits/reference-keystone-core';
import { useReferenceHost } from '@pepbits/reference-host';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Ellipsis, FileText, History, PanelLeft, Pencil, Save, Table2, Trash2, Upload, UserRoundX } from 'lucide-react';
import { primaryField } from '../../lib/registry';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


function Activity({ row, def }: { row: Row; def: PageDef }) {
  return <RecordActivity entity={def.entity} id={row.id} />;
}

function Documents({ row, def }: { row: Row; def: PageDef }) {
  return <RecordDocuments entity={def.entity} id={row.id} />;
}

export function ProfileDetail({ def, row, creating, onSaved, onDeleted, onCancelNew }: { def: PageDef; row: Row | null; creating: boolean; onSaved: (r: Row) => void; onDeleted: () => void; onCancelNew: () => void }) {
 const referenceT = useReferenceLocalization().t;

  const support = useEntitySupport(def.entity, creating ? undefined : row?.id);
  const entityApi = useEntityApi();
  const { fmtValue } = useFormat();
  const toast = useToast();
  const primary = primaryField(def);
  const statusF = def.fields.find((f) => f.type === 'status');
  const codeF = def.fields.find((f) => f.type === 'code');
  const secondaryF = def.fields.find((f) => f.secondary);
  const groups = useMemo(() => [...new Set(def.fields.filter((f) => f.group).map((f) => f.group!))], [def]);
  const stats = def.fields.filter((f) => isNumeric(f) && f.group).slice(0, 4);
  const [editing, setEditing] = useState(creating);
  const [draft, setDraft] = useState<Partial<Row>>(row ?? defaultsFor(def));
  const [tab, setTab] = useState('Details');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(row ?? defaultsFor(def));
    setEditing(creating);
    setShowErrors(false);
    if (creating) setTab('Details');
  }, [row, creating, def, groups]);

  if (!row && !creating) return <Empty icon={PanelLeft} title={referenceT("Pick a record")} body="Select a record on the left to see its details, or create a new one." className="h-full" />;

  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));
  const save = async () => {
    const miss = missingRequired(def.fields, draft);
    if (miss.length) {
      setShowErrors(true);
      setTab('Details');
      toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger');
      return;
    }
    setSaving(true);
    try {
      const saved = creating ? await entityApi.create(def.entity, draft) : await entityApi.update(def.entity, row!.id, draft);
      toast(creating ? `${nounOf(def)} ${saved.code ?? ''} created` : 'Changes saved');
      setEditing(false);
      onSaved(saved);
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    await entityApi.remove(def.entity, row!.id);
    toast(referenceT("{value0} deleted", {value0: fmtValue(primary, row![primary.key])}));
    onDeleted();
  };
  const setStatus = async (s: string) => {
    const saved = await entityApi.update(def.entity, row!.id, { status: s });
    toast(referenceT("Status changed to {value0}", {value0: s}));
    onSaved(saved);
  };

  const title = draft[primary.key] ? fmtValue(primary, draft[primary.key]) : `New ${nounOf(def)}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-3">
          <Avatar name={title} size={44} className="text-[length:calc(15px*var(--fs-scale))]" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[length:calc(17px*var(--fs-scale))] font-semibold tracking-tight">{title}</h2>
              {statusF && !editing && <StatusBadge value={draft[statusF.key]} />}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">
              {codeF && <span className="tnum">{creating ? referenceT("Number assigned on save") : String(draft[codeF.key] ?? '')}</span>}
              {secondaryF && draft[secondaryF.key] !== undefined && <span>{fmtValue(secondaryF, draft[secondaryF.key])}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {editing ? (
              <>
                <Button onClick={() => (creating ? onCancelNew() : (setDraft(row!), setEditing(false), setShowErrors(false)))}><ReferenceText message="Cancel" /></Button>
                <Button variant="primary" icon={Save} loading={saving} onClick={save}>{creating ? referenceT("Create") : referenceT("Save")}</Button>
              </>
            ) : (
              <>
                <Button icon={Pencil} onClick={() => setEditing(true)}><ReferenceText message="Edit" /></Button>
                <Popover align="right" width="w-52" trigger={(t) => <Button onClick={t} aria-label={referenceT("More actions")} className="px-2"><Ellipsis size={16} /></Button>}>
                  {(close) => (
                    <>
                      <MenuItem icon={Copy} onClick={() => { close(); toast(referenceT("Copied as a new draft"), 'info'); }}><ReferenceText message="Duplicate" /></MenuItem>
                      {statusF?.options?.filter((o) => o !== draft[statusF.key]).map((o) => (
                        <MenuItem key={o} icon={o === 'Inactive' || o === 'Exited' || o === 'Blocked' ? UserRoundX : History} onClick={() => { close(); setStatus(o); }}><ReferenceText message="Mark as" /> <ReferenceText message={o} /></MenuItem>
                      ))}
                      <div className="my-1 border-t border-line" />
                      <MenuItem icon={Trash2} danger onClick={() => { close(); remove(); }}><ReferenceText message="Delete" /></MenuItem>
                    </>
                  )}
                </Popover>
              </>
            )}
          </div>
        </div>
        {editing && statusF && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Status" /></span>
            <div className="w-44"><FieldInput field={statusF} value={draft[statusF.key]} onChange={(v) => set(statusF.key, v)} compact /></div>
          </div>
        )}
        {stats.length > 0 && !creating && (
          <div className="mt-3 grid grid-cols-2 gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(4, stats.length)}, minmax(0, 1fr))` }}>
            {stats.map((f) => (
              <div key={f.key} className="rounded-md bg-surface-2 px-3 py-2">
                <div className="truncate text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message={f.label} /></div>
                <div className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{fmtValue(f, draft[f.key])}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Tabs className="px-4 pt-2" value={tab} onChange={setTab} tabs={[{ key: 'Details', label: 'Details' }, ...(creating ? [] : [{ key: 'Activity', label: 'Activity' }, { key: 'Documents', label: 'Documents', count: support.data?.documents.length }])]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'Activity' && row ? <div className="p-4"><Activity row={row} def={def} /></div> : tab === 'Documents' && row ? <div className="p-4"><Documents def={def} row={row} /></div> : (
          <div className={cx('grid gap-0', !creating && '2xl:grid-cols-[minmax(0,1fr)_300px]')}>
            <div className="grid grid-cols-1 xl:grid-cols-2">
              {groups.filter((g) => def.fields.some((f) => f.group === g && (editing || !stats.includes(f)))).map((g) => (
                <section key={g} className="border-b border-line px-4 py-4 xl:odd:border-r">
                  <h3 className="mb-3 text-[length:calc(12.5px*var(--fs-scale))] font-semibold text-ink-2">{g}</h3>
                  <RecordForm fields={def.fields.filter((f) => f.group === g && !(stats.includes(f) && !editing))} value={draft} onChange={set} readOnly={!editing} showErrors={showErrors} columns={2} compact />
                </section>
              ))}
            </div>
            {!creating && row && (
              <aside className="hidden border-l border-line px-4 py-4 2xl:block">
                <h3 className="mb-3 text-[length:calc(12.5px*var(--fs-scale))] font-semibold text-ink-2"><ReferenceText message="Recent activity" /></h3>
                <Activity row={row} def={def} />
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Rich masters (customer, item, patient): list on the left, tabbed profile on the right. */
export default function ProfileTemplate({ def }: { def: PageDef }) {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const { preferences } = useReferenceHost();
  // Layout mode persists to the account only when the host remembers filters/views.
  const [mode, setMode, modeState] = useStoredState<'split' | 'table'>(`keystone.mode.${def.slug}`, 'split', { persist: Boolean(preferences.rememberFilters) });
  const [selected, setSelected] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const split = isWide && mode === 'split';

  const toggle = isWide && (
    <>
      <Segmented size="sm" value={mode} onChange={(m) => setMode(m)} options={[{ value: 'split', icon: PanelLeft, title: 'List and details side by side' }, { value: 'table', icon: Table2, title: 'Full table' }]} />
      <ViewStateStatus state={modeState} />
    </>
  );
  const detail = (
    <ProfileDetail
      def={def}
      row={selected}
      creating={creating}
      onSaved={(r) => { setSelected(r); setCreating(false); setReloadKey((k) => k + 1); }}
      onDeleted={() => { setSelected(null); setReloadKey((k) => k + 1); }}
      onCancelNew={() => setCreating(false)}
    />
  );
  const list = (
    <WorkList
      def={def}
      compact={split}
      selectedId={selected?.id}
      onOpen={(r) => { setSelected(r); setCreating(false); }}
      onNew={() => { setCreating(true); setSelected(null); }}
      newLabel={`New ${nounOf(def)}`}
      reloadKey={reloadKey}
      toolbarExtra={toggle}
      onLoaded={(res) => { if (split && !selected && !creating && res.rows[0]) setSelected(res.rows[0]); }}
    />
  );

  if (split) {
    return (
      <Frame className="flex-row">
        <Card className="flex w-[340px] shrink-0 flex-col xl:w-[380px]">{list}</Card>
        <Card className="min-w-0 flex-1">{detail}</Card>
      </Frame>
    );
  }
  return (
    <Frame>
      <Card className="flex-1">{list}</Card>
      <Drawer open={Boolean(selected) || creating} onClose={() => { setSelected(null); setCreating(false); }} title={creating ? `New ${nounOf(def)}` : def.title.replace(/ master$/i, '')} width="xl">
        <div className={cx('-mx-5 -my-4 h-[calc(100dvh-58px)]')}>{detail}</div>
      </Drawer>
    </Frame>
  );
}
