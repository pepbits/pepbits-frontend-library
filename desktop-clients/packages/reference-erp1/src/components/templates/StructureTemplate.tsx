'use client';
import { cx, useFormat, useMediaQuery, useEntityApi, Button, Drawer, Empty, StatusBadge, useToast, missingRequired, RecordForm, LinesEditor, lineTotals, WorkList, Card, defaultsFor, Frame, nounOf, type PageDef, type Row, type Line } from '@pepbits/reference-keystone-core';
import { useEffect, useState } from 'react';
import { Layers, Save } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


function StructureEditor({ def, row, creating, onSaved }: { def: PageDef; row: Row | null; creating: boolean; onSaved: (r: Row) => void }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtCurrency } = useFormat();
  const toast = useToast();
  const [draft, setDraft] = useState<Partial<Row>>(row ?? { ...defaultsFor(def), lines: [] });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(false);
  useEffect(() => { setDraft(row ?? { ...defaultsFor(def), lines: [] }); setDirty(false); setErrors(false); }, [row, creating, def]);

  if (!row && !creating) return <Empty icon={Layers} title={referenceT("Pick a structure")} body="Choose one from the list to see and edit its components." className="h-full" />;

  const lines = (draft.lines as Line[]) ?? [];
  const totals = lineTotals('structure', lines);
  const earnings = lines.filter((l) => l.kind !== 'Deduction').reduce((s, l) => s + Number(l.amount || 0), 0);
  const deductions = lines.filter((l) => l.kind === 'Deduction').reduce((s, l) => s + Number(l.amount || 0), 0);
  const hasKinds = def.lines!.fields.some((f) => f.key === 'kind');
  const headerFields = def.fields.filter((f) => f.type !== 'code' && f.key !== 'total');
  const set = (patch: Partial<Row>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };

  const save = async () => {
    const body = { ...draft, lines, total: totals.total };
    const miss = missingRequired(def.fields, body);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    setSaving(true);
    try {
      const saved = creating ? await entityApi.create(def.entity, body) : await entityApi.update(def.entity, row!.id, body);
      toast(creating ? `${saved.code} created` : 'Structure saved');
      setDirty(false);
      onSaved(saved);
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setSaving(false); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[length:calc(16px*var(--fs-scale))] font-semibold tracking-tight">{String(draft.name ?? `New ${nounOf(def)}`)}</h2>
            <StatusBadge value={draft.status} />
            {dirty && <span className="text-[length:calc(12px*var(--fs-scale))] text-warn"><ReferenceText message="Unsaved changes" /></span>}
          </div>
          <div className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{creating ? referenceT("Code assigned on save") : String(draft.code ?? '')}</div>
        </div>
        <div className="text-right">
          <div className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message={def.fields.find((f) => f.key === 'total')?.label ?? 'Total'} /></div>
          <div className="text-[length:calc(19px*var(--fs-scale))] font-semibold tracking-tight tnum">{fmtCurrency(totals.total)}</div>
        </div>
        <Button variant="primary" icon={Save} loading={saving} onClick={save} disabled={!dirty && !creating}>{creating ? referenceT("Create") : referenceT("Save")}</Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="rounded-lg border border-line p-3">
          <RecordForm fields={headerFields} value={draft} onChange={(k, v) => set({ [k]: v })} columns={4} compact showErrors={errors} />
        </div>
        {hasKinds && (
          <div className="grid grid-cols-3 gap-2 text-[length:calc(12.5px*var(--fs-scale))]">
            <div className="rounded-md bg-ok-soft px-3 py-2 text-ok"><div><ReferenceText message="Earnings" /></div><div className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{fmtCurrency(earnings)}</div></div>
            <div className="rounded-md bg-danger-soft px-3 py-2 text-danger"><div><ReferenceText message="Deductions" /></div><div className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{fmtCurrency(deductions)}</div></div>
            <div className="rounded-md bg-brand-soft px-3 py-2 text-brand-ink"><div><ReferenceText message="Net" /></div><div className="text-[length:calc(15px*var(--fs-scale))] font-semibold tnum">{fmtCurrency(earnings - deductions)}</div></div>
          </div>
        )}
        <div className="flex min-h-[280px] flex-1 flex-col">
          <LinesEditor fields={def.lines!.fields} lines={lines} kind="structure" title={def.lines!.label} onChange={(l) => set({ lines: l })} />
        </div>
      </div>
    </div>
  );
}

/** Things made of parts: bill of materials, salary structure, fee structure. */
export default function StructureTemplate({ def }: { def: PageDef }) {
  const isWide = useMediaQuery('(min-width: 1024px)');
  const [sel, setSel] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const editor = <StructureEditor def={def} row={sel} creating={creating} onSaved={(r) => { setSel(r); setCreating(false); setReloadKey((k) => k + 1); }} />;
  return (
    <Frame className={cx(isWide && 'flex-row')}>
      <Card className={cx('flex flex-col', isWide ? 'w-[340px] shrink-0 xl:w-[360px]' : 'flex-1')}>
        <WorkList
          def={def}
          compact
          selectedId={sel?.id}
          reloadKey={reloadKey}
          onOpen={(r) => { setSel(r); setCreating(false); }}
          onNew={() => { setSel(null); setCreating(true); }}
          newLabel={`New ${nounOf(def)}`}
          onLoaded={(res) => { if (isWide && !sel && !creating && res.rows[0]) setSel(res.rows[0]); }}
        />
      </Card>
      {isWide ? (
        <Card className="min-w-0 flex-1">{editor}</Card>
      ) : (
        <Drawer open={Boolean(sel) || creating} onClose={() => { setSel(null); setCreating(false); }} title={def.title} width="xl">
          <div className="-mx-5 -my-4 h-[calc(100dvh-58px)]">{editor}</div>
        </Drawer>
      )}
    </Frame>
  );
}
