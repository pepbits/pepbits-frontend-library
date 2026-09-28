'use client';
import { cx, useFormat, useEntityApi, useList, Badge, Button, Empty, ErrorNote, IconButton, Input, Skeleton, StatusBadge, useToast, missingRequired, RecordForm, Card, Frame, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Folder, FolderOpen, FileText, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Hierarchies (chart of accounts, org structure, categories): tree on the left, node form on the right. */
export default function TreeTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const { fmtValue } = useFormat();
  const toast = useToast();
  const { data, loading, error, reload } = useList(def.entity, { size: 2000 });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Row> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const children = useMemo(() => {
    const m = new Map<string | null, Row[]>();
    rows.forEach((r) => { const k = r.parentId ?? null; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
    return m;
  }, [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const path = (id: string | null) => { const out: Row[] = []; let cur = id ? byId.get(id) : undefined; while (cur) { out.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; } return out; };
  const descendants = (id: string): number => (children.get(id) ?? []).reduce((s, c) => s + 1 + descendants(c.id), 0);

  // first load: open roots and select the first node
  useEffect(() => {
    if (!rows.length || sel) return;
    setOpen(new Set(rows.filter((r) => r.level === 0).map((r) => r.id)));
    setSel(rows[0].id);
  }, [rows, sel]);
  useEffect(() => {
    if (isNew) return;
    const r = sel ? byId.get(sel) : undefined;
    setDraft(r ? { ...r } : null);
    setErrors(false);
  }, [sel, byId, isNew]);

  const matches = useMemo(() => {
    if (!q.trim()) return null;
    const hit = new Set<string>();
    rows.forEach((r) => {
      if (`${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase())) path(r.id).forEach((p) => hit.add(p.id));
    });
    return hit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rows]);

  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const addChild = (parent: Row | null) => {
    setIsNew(true);
    setSel(parent?.id ?? null);
    if (parent) setOpen((o) => new Set(o).add(parent.id));
    setDraft({ parentId: parent?.id ?? null, level: parent ? parent.level + 1 : 0, status: 'Active', type: def.fields.find((f) => f.key === 'type')?.options?.slice(-1)[0], nature: parent?.nature });
  };
  const save = async () => {
    if (!draft) return;
    const miss = missingRequired(def.fields, draft);
    if (miss.length) { setErrors(true); toast(referenceT("{value0} is required", {value0: referenceT(miss[0].label)}), 'danger'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const parent = draft.parentId ? byId.get(String(draft.parentId)) : undefined;
        const siblings = children.get((draft.parentId as string) ?? null) ?? [];
        const code = draft.code || (parent ? `${parent.code}.${siblings.length + 1}` : String((siblings.length + 1) * 1000));
        const created = await entityApi.create(def.entity, { ...draft, code });
        toast(referenceT("{value0} added", {value0: created.name}));
        setIsNew(false);
        setSel(created.id);
      } else {
        await entityApi.update(def.entity, String(draft.id), draft);
        toast(referenceT("Changes saved"));
      }
      reload();
    } catch (e) { toast((e as Error).message, 'danger'); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!sel) return;
    const node = byId.get(sel);
    if (children.get(sel)?.length) { toast(referenceT("Move or delete the {value0} items under {value1} first", {value0: children.get(sel)!.length, value1: node?.name}), 'danger'); return; }
    await entityApi.remove(def.entity, sel);
    toast(referenceT("{value0} deleted", {value0: node?.name}));
    setSel(node?.parentId ?? null);
    reload();
  };

  const renderNodes = (parentId: string | null, depth: number) =>
    (children.get(parentId) ?? []).filter((n) => !matches || matches.has(n.id)).map((n) => {
      const kids = children.get(n.id) ?? [];
      const isOpen = matches ? true : open.has(n.id);
      const active = sel === n.id && !isNew;
      return (
        <li key={n.id}>
          <div
            onClick={() => { setIsNew(false); setSel(n.id); }}
            className={cx('group flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[length:calc(13px*var(--fs-scale))]', active ? 'bg-brand-soft text-brand-ink' : 'hover:bg-surface-2')}
            style={{ paddingLeft: 6 + depth * 16 }}
          >
            <button onClick={(e) => { e.stopPropagation(); toggle(n.id); }} className={cx('grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-surface-3', !kids.length && 'invisible')} aria-label={isOpen ? 'Collapse' : 'Expand'}>
              <ChevronRight size={14} className={cx('transition-transform', isOpen && 'rotate-90')} />
            </button>
            {kids.length ? (isOpen ? <FolderOpen size={15} className="text-accent" /> : <Folder size={15} className="text-accent" />) : <FileText size={14} className="text-ink-3" />}
            <span className={cx('flex-1 truncate', active && 'font-medium')}>{n.name}</span>
            <span className="text-[length:calc(11px*var(--fs-scale))] text-ink-3 tnum">{n.code}</span>
            <button onClick={(e) => { e.stopPropagation(); addChild(n); }} className="hidden rounded p-0.5 text-ink-3 hover:bg-surface-3 hover:text-brand group-hover:block" aria-label={referenceT("Add under {value0}", {value0: n.name})}><Plus size={13} /></button>
          </div>
          {kids.length > 0 && isOpen && <ul>{renderNodes(n.id, depth + 1)}</ul>}
        </li>
      );
    });

  const node = sel ? byId.get(sel) : undefined;
  const crumbs = isNew ? [...path(sel), { id: 'new', name: draft?.name || 'New item' } as Row] : path(sel);
  const kids = sel && !isNew ? children.get(sel) ?? [] : [];
  const formFields = def.fields;

  return (
    <Frame className="lg:flex-row">
      <Card className="flex max-h-[45vh] flex-col lg:max-h-none lg:w-[360px] lg:shrink-0 xl:w-[400px]">
        <div className="flex items-center gap-1.5 border-b border-line p-2.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Search the tree")} className="pl-8" />
          </div>
          <IconButton icon={ChevronsUpDown} label={referenceT("Expand all")} onClick={() => setOpen(new Set(rows.map((r) => r.id)))} />
          <IconButton icon={ChevronsDownUp} label={referenceT("Collapse all")} onClick={() => setOpen(new Set())} />
          <Button variant="primary" icon={Plus} onClick={() => addChild(null)} className="px-2" aria-label={referenceT("Add top-level item")} />
        </div>
        {error && <ErrorNote message={error} onRetry={reload} />}
        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {loading && !data && Array.from({ length: 12 }, (_, i) => <li key={i} className="py-1.5" style={{ paddingLeft: 8 + (i % 3) * 16 }}><Skeleton className="w-40" /></li>)}
          {renderNodes(null, 0)}
          {matches && matches.size === 0 && <li className="px-3 py-6 text-center text-[length:calc(13px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing in the tree matches “" />{q}”.</li>}
        </ul>
        <div className="border-t border-line bg-surface-2 px-3 py-1.5 text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{rows.length} <ReferenceText message="items," /> {rows.filter((r) => !children.get(r.id)?.length).length} <ReferenceText message="leaf nodes" /></div>
      </Card>

      <Card className="flex min-h-[420px] min-w-0 flex-1 flex-col">
        {!draft ? (
          <Empty icon={FolderOpen} title={referenceT("Select an item in the tree")} body="Its details show here. Use the plus on any row to add an item beneath it." className="h-full" />
        ) : (
          <>
            <div className="border-b border-line px-4 py-3">
              <nav className="mb-1 flex flex-wrap items-center gap-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3">
                {crumbs.map((c, i) => (
                  <span key={c.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={11} />}
                    <button className="hover:text-ink" onClick={() => c.id !== 'new' && (setIsNew(false), setSel(c.id))}>{c.name}</button>
                  </span>
                ))}
              </nav>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[length:calc(17px*var(--fs-scale))] font-semibold tracking-tight">{isNew ? `New item${node ? ` under ${node.name}` : ''}` : node?.name}</h2>
                {!isNew && node?.type && <Badge tone="brand">{node.type}</Badge>}
                {!isNew && <StatusBadge value={node?.status} />}
                <span className="flex-1" />
                {isNew ? (
                  <Button icon={X} onClick={() => { setIsNew(false); }}><ReferenceText message="Cancel" /></Button>
                ) : (
                  <>
                    <Button icon={Plus} onClick={() => addChild(node ?? null)}><ReferenceText message="Add child" /></Button>
                    <Button variant="danger" icon={Trash2} onClick={remove} aria-label={referenceT("Delete")} className="px-2" />
                  </>
                )}
                <Button variant="primary" icon={Save} loading={saving} onClick={save}>{isNew ? referenceT("Create") : referenceT("Save")}</Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <RecordForm fields={formFields} value={draft} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} showErrors={errors} columns={3} />
              {!isNew && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-[length:calc(13px*var(--fs-scale))] font-semibold"><ReferenceText message="Directly under" /> {node?.name}</h3>
                    <span className="text-[length:calc(12px*var(--fs-scale))] text-ink-3 tnum">{kids.length} <ReferenceText message="direct," /> {sel ? descendants(sel) : 0} <ReferenceText message="in total" /></span>
                  </div>
                  {kids.length ? (
                    <TableContainer overflow="hidden" className="overflow-hidden rounded-lg border border-line">
                      <Table className="w-full text-[length:calc(13px*var(--fs-scale))]">
                        <thead className="bg-surface-2 text-[length:calc(12px*var(--fs-scale))] text-ink-2">
                          <tr>{formFields.slice(0, 5).map((f) => <th key={f.key} className="px-3 py-1.5 text-left font-medium"><ReferenceText message={f.label} /></th>)}</tr>
                        </thead>
                        <tbody>
                          {kids.map((k) => (
                            <tr key={k.id} onClick={() => setSel(k.id)} className="cursor-pointer border-t border-line hover:bg-surface-2">
                              {formFields.slice(0, 5).map((f) => <td key={f.key} className="px-3 py-1.5">{f.type === 'status' ? <StatusBadge value={k[f.key]} /> : fmtValue(f, k[f.key])}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line px-3 py-4 text-[length:calc(13px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing sits under this item yet." /> <button className="text-brand hover:underline" onClick={() => addChild(node ?? null)}><ReferenceText message="Add the first one" /></button>.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </Frame>
  );
}
