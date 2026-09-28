'use client';
import { useRouter, cx, isNumeric, useFormat, useList, useScopeMemory, Button, ErrorNote, IconButton, Input, Skeleton, StatusBadge, Card, Frame, type PageDef, type Row } from '@pepbits/reference-keystone-core';
import { Table, TableContainer } from '@pepbits/ops-ui';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Eye, FileText, Folder, FolderOpen, Plus, Search, X } from 'lucide-react';
import { newPath, recordPath } from '../../lib/registry';
import { rememberIds } from '../record/RecordShell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Hierarchies as a full-width tree grid. Each node opens on its own page; add children from any row. */
export default function TreeTemplate({ def }: { def: PageDef }) {
 const referenceT = useReferenceLocalization().t;

  const { fmtValue } = useFormat();
  const router = useRouter();
  const { data, loading, error, reload } = useList(def.entity, { size: 2000 });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  const children = useMemo(() => {
    const m = new Map<string | null, Row[]>();
    rows.forEach((r) => { const k = r.parentId ?? null; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
    return m;
  }, [rows]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  useEffect(() => {
    if (!rows.length) return;
    setOpen((o) => (o.size ? o : new Set(rows.filter((r) => r.level === 0).map((r) => r.id))));
  }, [rows]);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    const hit = new Set<string>();
    rows.forEach((r) => {
      if (`${r.name} ${r.code}`.toLowerCase().includes(term)) {
        let cur: Row | undefined = r;
        while (cur) { hit.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
      }
    });
    return hit;
  }, [q, rows, byId]);

  const cols = def.fields.filter((f) => f.key !== 'name' && f.key !== 'code' && f.list !== false);
  const countUnder = (id: string): number => (children.get(id) ?? []).reduce((s, c) => s + 1 + countUnder(c.id), 0);
  const visible: Row[] = [];
  const walk = (pid: string | null) => (children.get(pid) ?? []).forEach((n) => {
    if (matches && !matches.has(n.id)) return;
    visible.push(n);
    if (matches || open.has(n.id)) walk(n.id);
  });
  walk(null);
  const visibleKey = visible.map((r) => r.id).join(',');
  const memory = useScopeMemory();
  useEffect(() => { rememberIds(memory, def.slug, visibleKey ? visibleKey.split(',') : []); }, [memory, def.slug, visibleKey]);

  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const highlight = (text: string) => {
    const term = q.trim();
    const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
    if (i < 0) return text;
    return <>{text.slice(0, i)}<mark className="rounded bg-accent-soft px-0.5 text-ink">{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
  };

  return (
    <Frame>
      <Card className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Search {value0}", {value0: referenceT(def.title)})} className="pl-8 pr-7" />
            {q && <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink" aria-label={referenceT("Clear search")}><X size={14} /></button>}
          </div>
          <Button icon={ChevronsUpDown} onClick={() => setOpen(new Set(rows.map((r) => r.id)))}><ReferenceText message="Expand all" /></Button>
          <Button icon={ChevronsDownUp} onClick={() => setOpen(new Set())}><ReferenceText message="Collapse all" /></Button>
          <span className="flex-1" />
          <span className="hidden text-[length:calc(12.5px*var(--fs-scale))] text-ink-3 md:inline tnum">{rows.length} <ReferenceText message="items," /> {rows.filter((r) => !children.get(r.id)?.length).length} <ReferenceText message="at the lowest level" /></span>
          <Button variant="primary" icon={Plus} onClick={() => router.push(newPath(def))}><ReferenceText message="New top-level item" /></Button>
        </div>
        {error && <ErrorNote message={error} onRetry={reload} />}
        <TableContainer className="min-h-0 flex-1 overflow-auto">
          <Table className="w-full min-w-[760px] border-separate border-spacing-0 text-[length:calc(13px*var(--fs-scale))]">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-[length:calc(12px*var(--fs-scale))] text-ink-2">
                <th className="border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Name" /></th>
                <th className="w-28 border-b border-line bg-surface-2 px-3 py-2 font-medium"><ReferenceText message="Code" /></th>
                {cols.map((f) => <th key={f.key} className={cx('border-b border-line bg-surface-2 px-3 py-2 font-medium', isNumeric(f) && 'text-right')}><ReferenceText message={f.label} /></th>)}
                <th className="w-20 border-b border-line bg-surface-2" aria-label={referenceT("Actions")} />
              </tr>
            </thead>
            <tbody>
              {loading && !data && Array.from({ length: 14 }, (_, i) => <tr key={i}><td className="border-b border-line py-2.5 pr-3" style={{ paddingLeft: 12 + (i % 3) * 22 }}><Skeleton className="w-44" /></td><td colSpan={cols.length + 2} className="border-b border-line" /></tr>)}
              {visible.map((n) => {
                const kids = children.get(n.id) ?? [];
                const isOpen = Boolean(matches) || open.has(n.id);
                return (
                  <Fragment key={n.id}>
                    <tr onClick={() => router.push(recordPath(def, n.id))} className={cx('group cursor-pointer hover:bg-surface-2', n.level === 0 && 'bg-surface-2/60')}>
                      <td className="border-b border-line py-[7px] pr-3" style={{ paddingLeft: 8 + n.level * 22 }}>
                        <div className="flex items-center gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); toggle(n.id); }} className={cx('grid h-5 w-5 place-items-center rounded text-ink-3 hover:bg-surface-3', !kids.length && 'invisible')} aria-label={isOpen ? 'Collapse' : 'Expand'}>
                            <ChevronRight size={14} className={cx('transition-transform', isOpen && 'rotate-90')} />
                          </button>
                          {kids.length ? (isOpen ? <FolderOpen size={15} className="shrink-0 text-accent" /> : <Folder size={15} className="shrink-0 text-accent" />) : <FileText size={14} className="shrink-0 text-ink-3" />}
                          <span className={cx('truncate', n.level === 0 ? 'font-semibold text-ink' : kids.length ? 'font-medium text-ink' : 'text-ink-2')}>{highlight(String(n.name))}</span>
                          {kids.length > 0 && <span className="rounded bg-surface-3 px-1.5 text-[length:calc(11px*var(--fs-scale))] text-ink-3 tnum">{countUnder(n.id)}</span>}
                        </div>
                      </td>
                      <td className="border-b border-line px-3 text-ink-3 tnum">{n.code}</td>
                      {cols.map((f) => <td key={f.key} className={cx('border-b border-line px-3', isNumeric(f) && 'text-right tnum')}>{f.type === 'status' ? <StatusBadge value={n[f.key]} /> : fmtValue(f, n[f.key])}</td>)}
                      <td className="border-b border-line px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <IconButton icon={Plus} size="sm" label={referenceT("Add under {value0}", {value0: n.name})} onClick={() => router.push(newPath(def, { parent: n.id }))} />
                          <IconButton icon={Eye} size="sm" label={referenceT("Open")} onClick={() => router.push(recordPath(def, n.id))} />
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {matches && matches.size === 0 && <tr><td colSpan={cols.length + 3} className="px-3 py-10 text-center text-[length:calc(13px*var(--fs-scale))] text-ink-3"><ReferenceText message="Nothing matches “" />{q}”.</td></tr>}
            </tbody>
          </Table>
        </TableContainer>
      </Card>
    </Frame>
  );
}
