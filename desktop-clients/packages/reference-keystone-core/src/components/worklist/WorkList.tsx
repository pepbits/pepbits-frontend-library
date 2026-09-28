'use client';
import { CardGrid } from '@pepbits/ops-ui';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from '../../lib/navigation';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bookmark, Check, ChevronLeft, ChevronRight, Columns3, Download, Filter as Funnel, LayoutGrid,
  Plus, Rows3, Rows4, Search, SearchX, Trash2, X, Table2, Eye, Pencil,
} from 'lucide-react';
import type { Field, Filters, ListResponse, PageDef, Row } from '../../lib/types';
import { cx, isNumeric, useFormat, type ReferenceFormat } from '../../lib/format';
import { defaultHidden, listFields, newPath, primaryField, recordPath } from '../../lib/registry';
import { useKeystoneVariant } from '../../lib/variant';
import { listUrl, useDebounce, useFetch, useMediaQuery, useRefOptions, useStoredState, useEntityApi, useViewMemory, rememberIds } from '../../lib/client';
import { Avatar, Badge, Button, Checkbox, Drawer, Empty, ErrorNote, IconButton, Input, MenuItem, Modal, Popover, Segmented, Select, Skeleton, StatusBadge, DateInput } from '../ui';
import { FieldInput, missingRequired } from '../form/RecordForm';
import { useToast } from '../ui';
import { Pagination, Table, TableBody, TableFooter, TableHeader } from '@pepbits/ops-ui';
import { useManagedPreference } from '../../lib/preferences';
import { useExport } from '../../lib/export';
import { useOpenInNewContext } from '../../lib/navigation';
import { useShortcutsEnabled } from '../../lib/session';
import { useReferenceHost } from '@pepbits/reference-host';
import type { StoredStateMeta } from '../../lib/client';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface ExtraColumn { key: string; label: string; render: (row: Row) => ReactNode; align?: 'right' | 'left' }

export interface WorkListProps {
  def: PageDef;
  fields?: Field[];
  fixedFilters?: Filters;
  extraParams?: { asOf?: string; period?: string };
  selectedId?: string | null;
  onOpen?: (row: Row) => void;
  onNew?: () => void;
  newLabel?: string;
  newDefaults?: Partial<Row>;
  compact?: boolean;
  readOnly?: boolean;
  inlineEdit?: boolean;
  showTotals?: boolean;
  groupable?: boolean;
  renderers?: Record<string, (row: Row) => ReactNode>;
  extraColumns?: ExtraColumn[];
  toolbarExtra?: ReactNode;
  reloadKey?: number;
  defaultSize?: number;
  onLoaded?: (res: ListResponse) => void;
  hideQuick?: boolean;
  /** hide the New button */
  hideNew?: boolean;
}

/* ───────── cell rendering ───────── */
export function CellValue({ field, row, primary }: { field: Field; row: Row; primary?: boolean }) {
  const { fmtDate, fmtValue } = useFormat();
  const v = row[field.key];
  if (field.type === 'status') return <StatusBadge value={v} />;
  if (field.type === 'boolean') return v ? <Check size={15} className="text-ok" /> : <span className="text-ink-3">—</span>;
  if (field.type === 'person' && v) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={v} size={22} />
        <span className={cx('truncate', primary && 'font-medium text-ink')}>{String(v)}</span>
      </span>
    );
  }
  if (field.type === 'code') return <span className="font-medium text-brand-ink tnum">{String(v ?? '—')}</span>;
  if (field.key === 'priority' && v) return <Badge tone={v === 'Urgent' ? 'danger' : v === 'High' ? 'warn' : 'neutral'}>{String(v)}</Badge>;
  if (field.type === 'date') return <span className="tnum text-ink-2">{fmtDate(v)}</span>;
  if (isNumeric(field)) return <span className="tnum">{fmtValue(field, v)}</span>;
  return <span className={cx('truncate', primary ? 'font-medium text-ink' : 'text-ink-2')}>{fmtValue(field, v)}</span>;
}

function filterSummary(f: Field, c: unknown, { fmtDate, fmtCurrency }: Pick<ReferenceFormat, 'fmtDate' | 'fmtCurrency'>): string {
  if (Array.isArray(c)) return c.join(', ');
  if (typeof c === 'boolean') return c ? 'Yes' : 'No';
  if (c && typeof c === 'object') {
    const o = c as { from?: string; to?: string; min?: number; max?: number };
    if (o.from || o.to) return `${o.from ? fmtDate(o.from) : '…'} to ${o.to ? fmtDate(o.to) : '…'}`;
    const fm = (n?: number) => (n === undefined || String(n) === '' ? '…' : f.type === 'currency' ? fmtCurrency(Number(n)) : String(n));
    return `${fm(o.min)} to ${fm(o.max)}`;
  }
  return `contains “${c}”`;
}
const isActive = (c: unknown) => {
  if (c === undefined || c === null || c === '') return false;
  if (Array.isArray(c)) return c.length > 0;
  if (typeof c === 'object') return Object.values(c as object).some((v) => v !== undefined && v !== '' && v !== null);
  return true;
};

/* ───────── advanced filter drawer ───────── */
function RefChoice({ field, value, onChange }: { field: Field; value: string[]; onChange: (v: string[]) => void }) {
 const referenceT = useReferenceLocalization().t;

  const opts = useRefOptions(field.ref);
  const [q, setQ] = useState('');
  const shown = opts.filter((o) => o.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={referenceT("Search {value0}", {value0: referenceT(field.label)})} className="mb-1.5 h-7 text-[length:calc(12.5px*var(--fs-scale))]" />
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-line p-2">
        {shown.map((o) => <Checkbox key={o} checked={value.includes(o)} onChange={(on) => onChange(on ? [...value, o] : value.filter((x) => x !== o))} label={<span className="truncate text-[length:calc(12.5px*var(--fs-scale))]">{o}</span>} className="w-full" />)}
        {!shown.length && <p className="text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Loading options…" /></p>}
      </div>
    </div>
  );
}

function AdvancedFilter({ open, onClose, fields, value, onApply }: { open: boolean; onClose: () => void; fields: Field[]; value: Filters; onApply: (f: Filters) => void }) {
 const referenceT = useReferenceLocalization().t;

  const [draft, setDraft] = useState<Filters>(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));
  const activeCount = Object.values(draft).filter(isActive).length;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={referenceT("Advanced filter")}
      subtitle={activeCount ? referenceT(activeCount === 1 ? "{count} condition set" : "{count} conditions set", { count: activeCount }) : referenceT("Narrow the list by any column")}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDraft({})}><ReferenceText message="Reset" /></Button>
          <span className="flex-1" />
          <Button onClick={onClose}><ReferenceText message="Cancel" /></Button>
          <Button variant="primary" onClick={() => { onApply(Object.fromEntries(Object.entries(draft).filter(([, c]) => isActive(c)))); onClose(); }}><ReferenceText message="Apply filters" /></Button>
        </>
      }
    >
      <div className="space-y-4">
        {fields.map((f) => {
          const c = draft[f.key];
          let body: ReactNode;
          if ((f.type === 'select' || f.type === 'status') && f.options) {
            const arr = (c as string[]) ?? [];
            body = (
              <div className="flex flex-wrap gap-1.5">
                {f.options.map((o) => {
                  const on = arr.includes(o);
                  return (
                    <button key={o} onClick={() => set(f.key, on ? arr.filter((x) => x !== o) : [...arr, o])} className={cx('rounded-full border px-2.5 py-0.5 text-[length:calc(12.5px*var(--fs-scale))] transition-colors', on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-ink-2 hover:border-line-strong')}>
                      {on && <Check size={11} className="-ml-0.5 mr-1 inline" strokeWidth={3} />}{o}
                    </button>
                  );
                })}
              </div>
            );
          } else if (f.type === 'ref') {
            body = <RefChoice field={f} value={(c as string[]) ?? []} onChange={(v) => set(f.key, v)} />;
          } else if (f.type === 'date') {
            const o = (c as { from?: string; to?: string }) ?? {};
            body = (
              <div className="grid grid-cols-2 gap-2">
                <DateInput value={o.from ?? ''} onChange={(e) => set(f.key, { ...o, from: e.target.value })} aria-label={referenceT("{value0} from", {value0: referenceT(f.label)})} />
                <DateInput value={o.to ?? ''} onChange={(e) => set(f.key, { ...o, to: e.target.value })} aria-label={referenceT("{value0} to", {value0: referenceT(f.label)})} />
              </div>
            );
          } else if (isNumeric(f)) {
            const o = (c as { min?: number; max?: number }) ?? {};
            body = (
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder={referenceT("Min")} value={o.min ?? ''} onChange={(e) => set(f.key, { ...o, min: e.target.value === '' ? undefined : Number(e.target.value) })} className="tnum" />
                <Input type="number" placeholder={referenceT("Max")} value={o.max ?? ''} onChange={(e) => set(f.key, { ...o, max: e.target.value === '' ? undefined : Number(e.target.value) })} className="tnum" />
              </div>
            );
          } else if (f.type === 'boolean') {
            body = <Segmented size="sm" value={c === true ? 'yes' : c === false ? 'no' : 'any'} onChange={(v) => set(f.key, v === 'any' ? undefined : v === 'yes')} options={[{ value: 'any', label: 'Any' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />;
          } else {
            body = <Input value={(c as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder={referenceT("Contains…")} />;
          }
          return (
            <div key={f.key}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[length:calc(12.5px*var(--fs-scale))] font-medium text-ink-2"><ReferenceText message={f.label} /></span>
                {isActive(c) && <button className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3 hover:text-danger" onClick={() => set(f.key, undefined)}><ReferenceText message="Clear" /></button>}
              </div>
              {body}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

/** Load/save state of a persisted layout or saved-view list, with retry on failure. */
export function ViewStateStatus({ state }: { state: StoredStateMeta }) {
 const referenceT = useReferenceLocalization().t;

  if (!state.persisted || state.status === 'idle') return null;
  if (state.status === 'error') {
    return (
      <div role="alert" className="mx-1 mb-1 flex items-center gap-2 rounded bg-danger-soft px-2 py-1 text-[length:calc(11.5px*var(--fs-scale))] text-danger">
        <span className="flex-1">{state.error}</span>
        <Button size="sm" variant="ghost" onClick={state.retry}><ReferenceText message="Retry" /></Button>
      </div>
    );
  }
  return <div role="status" className="mx-1 mb-1 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{state.status === 'loading' ? referenceT("Loading saved layout…") : referenceT("Saving…")}</div>;
}

/* ───────── main component ───────── */
type SavedView = { name: string; q: string; quick: string | null; filters: Filters };

export function WorkList(props: WorkListProps) {
 const referenceT = useReferenceLocalization().t;

  const entityApi = useEntityApi();
  const fmt = useFormat();
  const { fmtCurrency, fmtValue } = fmt;
  const { def, fixedFilters, extraParams, selectedId, newLabel = 'New', newDefaults, compact, readOnly, inlineEdit, showTotals, groupable, renderers, extraColumns, toolbarExtra, reloadKey, defaultSize, onLoaded, hideQuick, hideNew } = props;
  const router = useRouter();
  const { records } = useKeystoneVariant();
  const { preferences } = useReferenceHost();
  // ERP2 (records): by default a row opens its own record page and New opens the create page.
  // ERP1: rows and New use the caller's callbacks (source dialogs / drawers) only.
  const navigates = records && !props.onOpen && !inlineEdit && !readOnly;
  const onOpen = props.onOpen ?? (navigates ? (r: Row) => router.push(recordPath(def, r.id)) : undefined);
  const onNew = props.onNew ?? (records && !readOnly && !inlineEdit && !hideNew ? () => router.push(newPath(def, newDefaults as Record<string, string> | undefined)) : undefined);
  const toast = useToast();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const allFields = useMemo(() => props.fields ?? listFields(def), [props.fields, def]);
  const primary = primaryField(def);
  const quickKey = def.quickFilter ?? (def.fields.some((f) => f.key === 'status') ? 'status' : undefined);
  const quickField = def.fields.find((f) => f.key === quickKey);

  const [q, setQ] = useState('');
  const dq = useDebounce(q, 260);
  const [quick, setQuick] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const pageSizePref = useManagedPreference('pageSize');
  const [localSize, setSize] = useState<number>(defaultSize ?? (compact ? 40 : pageSizePref.value));
  // A locked page size wins over the source defaultSize / compact overrides as well.
  const size = pageSizePref.locked ? pageSizePref.value : localSize;
  // A host page-size change (or a newly locked value) replaces the local size.
  useEffect(() => { if (!defaultSize && !compact) { setSize(pageSizePref.value); setPage(1); } }, [pageSizePref.value, pageSizePref.locked, defaultSize, compact]);
  const changeSize = (n: number) => {
    const next = n as 10 | 20 | 50 | 100;
    if (!defaultSize && !compact) { if (!pageSizePref.set(next)) return; }
    else if (pageSizePref.locked || !pageSizePref.isAllowed(next)) return;
    setSize(n);
    setPage(1);
  };
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const viewPref = useManagedPreference('resultView');
  const view = viewPref.value;
  const setView = viewPref.set;
  const densityPref = useManagedPreference('density');
  const density = densityPref.value;
  const setDensity = densityPref.set;
  const shortcuts = useShortcutsEnabled();
  const memory = useViewMemory();
  // Column layout persists to the account only when the host chooses account scope;
  // saved views (explicit q/filter snapshots) persist only when rememberFilters is on.
  const [hidden, setHidden, colsState] = useStoredState<string[]>(`keystone.cols.${def.slug}`, props.fields || !records ? [] : defaultHidden(def), { persist: preferences.columnLayoutScope === 'account' });
  const [views, setViews, viewsState] = useStoredState<SavedView[]>(`keystone.views.${def.slug}`, [], { persist: Boolean(preferences.rememberFilters) });
  const [viewName, setViewName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advOpen, setAdvOpen] = useState(false);
  const [groupBy, setGroupBy] = useState('');
  const [editing, setEditing] = useState<{ id: string; draft: Partial<Row> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tick, setTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const reqFilters = useMemo(() => ({ ...filters, ...(fixedFilters ?? {}), ...(quick && quickKey ? { [quickKey]: [quick] } : {}) }), [filters, fixedFilters, quick, quickKey]);
  const filterSig = JSON.stringify(reqFilters) + JSON.stringify(extraParams ?? {});
  useEffect(() => { setPage(1); setSelected(new Set()); }, [dq, filterSig]);

  const url = listUrl(def.entity, { q: dq, page, size, sort: sort?.key, dir: sort?.dir, filters: reqFilters, facet: quickKey, ...(extraParams ?? {}) }) + `&_r=${tick}.${reloadKey ?? 0}`;
  const { data, loading, error, reload } = useFetch<ListResponse>(url);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => { if (data) { onLoaded?.(data); rememberIds(memory, def.slug, data.rows.map((r) => r.id)); } }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // "/" jumps to search
  useEffect(() => {
    if (!shortcuts) return;
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [shortcuts]);

  const cols = allFields.filter((f) => !hidden.includes(f.key));
  const filterFields = def.fields.filter((f) => f.type !== 'code' && f.type !== 'textarea' && (f.filter || f.type === 'date' || isNumeric(f) || f.type === 'boolean'));
  const activeFilters = Object.entries(filters).filter(([, c]) => isActive(c));
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const cardsMode = !compact && (isMobile || view === 'cards');
  const selectable = !readOnly && !compact && !inlineEdit;
  const pad = density === 'compact' ? 'py-[7px]' : density === 'spacious' ? 'py-4' : 'py-2.5';

  /* inline editing */
  const startEdit = (row: Row) => { if (!readOnly) setEditing({ id: row.id, draft: { ...row } }); };
  const startNew = () => setEditing({ id: '__new', draft: { ...(newDefaults ?? {}), status: def.fields.find((f) => f.key === 'status')?.options?.[0] } });
  const saveEdit = async () => {
    if (!editing) return;
    const missing = missingRequired(allFields, editing.draft);
    if (missing.length) { toast(referenceT("{value0} is required", {value0: referenceT(missing[0].label)}), 'danger'); return; }
    setSaving(true);
    try {
      if (editing.id === '__new') {
        await entityApi.create(def.entity, editing.draft);
        toast(referenceT("{value0} record added", {value0: def.title.replace(/ master$/i, '')}));
      } else {
        await entityApi.update(def.entity, editing.id, editing.draft);
        toast(referenceT("Changes saved"));
      }
      setEditing(null);
      refresh();
    } catch (e) {
      toast((e as Error).message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const exporter = useExport();
  const openNew = useOpenInNewContext();
  const exportCSV = async (onlySelected = false) => {
    try {
      let source = rows;
      if (!onlySelected) {
        const all = await entityApi.list(def.entity, { q: dq, size: 5000, sort: sort?.key, dir: sort?.dir, filters: reqFilters, ...(extraParams ?? {}) });
        source = all.rows;
      } else source = rows.filter((r) => selected.has(r.id));
      exporter.download(`${def.slug}.csv`, cols.map((c) => c.label), source.map((r) => cols.map((c) => (isNumeric(c) ? Number(r[c.key] ?? 0) : fmtValue(c, r[c.key])))));
      toast(referenceT(source.length === 1 ? "Exported {count} row" : "Exported {count} rows", {count: source.length}));
    } catch (err) {
      toast((err as Error).message || 'Export failed', 'danger');
    }
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => entityApi.remove(def.entity, id)));
    const failed = ids.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) {
      // Keep the failed rows selected so the action can be retried.
      toast(referenceT(ids.length === 1 ? "{failed} of {count} record could not be deleted" : "{failed} of {count} records could not be deleted", {failed: failed.length, count: ids.length}), 'danger');
      setSelected(new Set(failed));
    } else {
      toast(referenceT(ids.length === 1 ? "Deleted {count} record" : "Deleted {count} records", {count: ids.length}));
      setSelected(new Set());
    }
    setConfirmDelete(false);
    refresh();
  };

  const toggleSort = (k: string) => setSort((s) => (!s || s.key !== k ? { key: k, dir: 'asc' } : s.dir === 'asc' ? { key: k, dir: 'desc' } : null));

  const quickChips = quickField?.options ?? (data ? Object.keys(data.facets) : []);
  const facetTotal = data ? Object.values(data.facets).reduce((a, b) => a + b, 0) : 0;
  const groupFields = def.fields.filter((f) => f.type === 'select' || f.type === 'status' || f.type === 'ref' || f.type === 'person');
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const m = new Map<string, Row[]>();
    rows.forEach((r) => { const k = String(r[groupBy] ?? '—'); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, groupBy]);
  const firstMoney = cols.find((c) => c.type === 'currency');

  const clearAll = () => { setFilters({}); setQuick(null); setQ(''); };
  const hasCriteria = Boolean(dq || quick || activeFilters.length);

  /* ───────── pieces ───────── */
  const searchBox = (
    <div className={cx('relative', compact ? 'flex-1' : 'w-full sm:w-64')}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <Input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={compact ? 'Search' : `Search ${def.title.toLowerCase()}`} className="pl-8 pr-7" aria-label={referenceT("Search")} />
      {q ? (
        <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink" aria-label={referenceT("Clear search")}><X size={14} /></button>
      ) : (
        !compact && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line px-1 text-[length:calc(10.5px*var(--fs-scale))] text-ink-3">/</span>
      )}
    </div>
  );

  const filterButton = (
    <Button icon={Funnel} onClick={() => setAdvOpen(true)} variant={activeFilters.length ? 'subtle' : 'secondary'} className={compact ? 'px-2' : ''} aria-label={referenceT("Advanced filter")}>
      {!compact && 'Filters'}
      {activeFilters.length > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[length:calc(10.5px*var(--fs-scale))] text-white tnum">{activeFilters.length}</span>}
    </Button>
  );

  const chips = !hideQuick && quickKey && quickChips.length > 0 && (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      <button onClick={() => setQuick(null)} className={cx('shrink-0 rounded-full px-2.5 py-1 text-[length:calc(12.5px*var(--fs-scale))] font-medium transition-colors', !quick ? 'bg-rail text-white dark:bg-brand' : 'text-ink-2 hover:bg-surface-3')}><ReferenceText message="All" /><span className="ml-0.5 opacity-70 tnum">{data ? facetTotal : ''}</span>
      </button>
      {quickChips.map((o) => (
        <button key={o} onClick={() => setQuick(quick === o ? null : o)} className={cx('shrink-0 rounded-full px-2.5 py-1 text-[length:calc(12.5px*var(--fs-scale))] font-medium transition-colors', quick === o ? 'bg-rail text-white dark:bg-brand' : 'text-ink-2 hover:bg-surface-3')}>
          {o} <span className="ml-0.5 opacity-70 tnum">{data?.facets[o] ?? 0}</span>
        </button>
      ))}
    </div>
  );

  const viewsMenu = (
    <Popover align="left" width="w-64" trigger={(t) => <Button icon={Bookmark} onClick={t} className="hidden sm:inline-flex"><ReferenceText message="Views" /></Button>}>
      {(close) => (
        <div>
          <MenuItem onClick={() => { clearAll(); close(); }} active={!hasCriteria}><ReferenceText message="All records" /></MenuItem>
          {views.map((v) => (
            <div key={v.name} className="group flex items-center">
              <div className="flex-1"><MenuItem onClick={() => { setQ(v.q); setQuick(v.quick); setFilters(v.filters); close(); }}>{v.name}</MenuItem></div>
              <IconButton icon={X} size="sm" label={referenceT("Delete view {value0}", {value0: v.name})} className="opacity-0 group-hover:opacity-100" onClick={() => setViews(views.filter((x) => x.name !== v.name))} />
            </div>
          ))}
          <ViewStateStatus state={viewsState} />
          <div className="mt-1 border-t border-line p-1.5 pt-2">
            <div className="mb-1 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{hasCriteria ? referenceT("Save the current search and filters") : referenceT("Set a search or filter, then save it here")}</div>
            <div className="flex gap-1.5">
              <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder={referenceT("View name")} className="h-7 text-[length:calc(12.5px*var(--fs-scale))]" disabled={!hasCriteria} />
              <Button size="sm" variant="primary" disabled={!hasCriteria || !viewName.trim()} onClick={() => { setViews([...views.filter((v) => v.name !== viewName.trim()), { name: viewName.trim(), q, quick, filters }]); setViewName(''); toast(referenceT("View saved")); }}><ReferenceText message="Save" /></Button>
            </div>
          </div>
        </div>
      )}
    </Popover>
  );

  const columnsMenu = (
    <Popover align="right" width="w-56" trigger={(t) => <IconButton icon={Columns3} label={referenceT("Choose columns")} onClick={t} />}>
      <div className="max-h-72 overflow-y-auto p-1">
        <div className="flex items-center justify-between px-1 pb-1 text-[length:calc(11.5px*var(--fs-scale))] text-ink-3"><ReferenceText message="Show columns" /> {records && <button className="text-brand hover:underline" onClick={() => setHidden(defaultHidden(def))}><ReferenceText message="Reset" /></button>}</div>
        <ViewStateStatus state={colsState} />
        {allFields.map((f) => (
          <div key={f.key} className="rounded px-1 py-1 hover:bg-surface-3">
            <Checkbox checked={!hidden.includes(f.key)} onChange={(on) => setHidden(on ? hidden.filter((h) => h !== f.key) : [...hidden, f.key])} label={f.label} className="w-full" />
          </div>
        ))}
      </div>
    </Popover>
  );

  /* ───────── table ───────── */
  const renderCell = (f: Field, row: Row) => (renderers?.[f.key] ? renderers[f.key](row) : <CellValue field={f} row={row} primary={f.key === primary?.key} />);

  const editRow = (key: string) => (
    <tr key={key} className="bg-accent-soft/50" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') saveEdit(); if (e.key === 'Escape') setEditing(null); }}>
      {cols.map((f) => (
        <td key={f.key} className="border-b border-line px-2 py-1.5">
          {f.readOnly || f.type === 'code' ? (
            <span className="px-1 text-[length:calc(12.5px*var(--fs-scale))] text-ink-3">{editing?.id === '__new' ? referenceT("Auto") : String(editing?.draft[f.key] ?? '')}</span>
          ) : (
            <FieldInput field={f} value={editing?.draft[f.key]} compact onChange={(v) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, [f.key]: v } } : e))} />
          )}
        </td>
      ))}
      {extraColumns?.map((c) => <td key={c.key} className="border-b border-line px-3" />)}
      <td className="sticky right-0 border-b border-line bg-accent-soft px-2 py-1.5">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="primary" icon={Check} loading={saving} onClick={saveEdit}><ReferenceText message="Save" /></Button>
          <IconButton icon={X} size="sm" label={referenceT("Cancel")} onClick={() => setEditing(null)} />
        </div>
      </td>
    </tr>
  );

  const dataRow = (row: Row) => {
    if (editing?.id === row.id) return editRow(row.id);
    const isSel = selected.has(row.id);
    const isCurrent = selectedId === row.id;
    return (
      <tr
        key={row.id}
        onClick={(e) => { if (navigates && openNew && (e.ctrlKey || e.metaKey)) { openNew(recordPath(def, row.id)); return; } if (inlineEdit) startEdit(row); else onOpen?.(row); }}
        onAuxClick={(e) => { if (navigates && openNew && e.button === 1) openNew(recordPath(def, row.id)); }}
        className={cx('group transition-colors', (!records || onOpen || inlineEdit) && 'cursor-pointer', isCurrent ? 'bg-brand-soft' : isSel ? 'bg-brand-soft/50' : 'hover:bg-surface-2')}
      >
        {selectable && (
          <td className={cx('border-b border-line pl-3 pr-1', pad)} onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSel} onChange={(on) => setSelected((s) => { const n = new Set(s); if (on) n.add(row.id); else n.delete(row.id); return n; })} />
          </td>
        )}
        {cols.map((f, i) => (
          <td key={f.key} className={cx('max-w-[280px] border-b border-line px-3', pad, isNumeric(f) && 'text-right', i === 0 && isCurrent && 'shadow-[inset_3px_0_0_var(--accent)]')}>
            {renderCell(f, row)}
          </td>
        ))}
        {extraColumns?.map((c) => <td key={c.key} className={cx('border-b border-line px-3', pad, c.align === 'right' && 'text-right')}>{c.render(row)}</td>)}
        {inlineEdit && <td className={cx('border-b border-line px-3 text-right text-[length:calc(12px*var(--fs-scale))] text-ink-3 opacity-0 group-hover:opacity-100', pad)}><ReferenceText message="Edit" /></td>}
        {navigates && (
          <td className={cx('sticky right-0 border-b border-line px-2 text-right', pad, isCurrent ? 'bg-brand-soft' : isSel ? 'bg-brand-soft/50' : 'bg-surface group-hover:bg-surface-2')} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <IconButton icon={Eye} size="sm" label={referenceT("Open")} onClick={() => router.push(recordPath(def, row.id))} />
              {!['print', 'inbox', 'process'].includes(def.template) && <IconButton icon={Pencil} size="sm" label={referenceT("Edit")} onClick={() => router.push(recordPath(def, row.id, true))} />}
            </div>
          </td>
        )}
      </tr>
    );
  };

  const colCount = cols.length + (selectable ? 1 : 0) + (extraColumns?.length ?? 0) + (inlineEdit ? 1 : 0) + (navigates ? 1 : 0);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const table = (
    <Table className="w-full border-separate border-spacing-0 text-[length:calc(13px*var(--fs-scale))]">
      <TableHeader>
        <tr>
          {selectable && (
            <th className="w-9 border-b border-line bg-surface-2 pl-3 pr-1">
              <Checkbox checked={allOnPage} indeterminate={!allOnPage && rows.some((r) => selected.has(r.id))} onChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())} />
            </th>
          )}
          {cols.map((f) => {
            const active = sort?.key === f.key;
            const SI = !active ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;
            return (
              <th key={f.key} className={cx('group whitespace-nowrap border-b border-line bg-surface-2 px-3 py-2 text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-2', isNumeric(f) ? 'text-right' : 'text-left')}>
                <button onClick={() => toggleSort(f.key)} className={cx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')}>
                  <ReferenceText message={f.label} />
                  <SI size={12} className={active ? 'text-brand' : 'opacity-0 group-hover:opacity-100 text-ink-3'} />
                </button>
              </th>
            );
          })}
          {extraColumns?.map((c) => <th key={c.key} className={cx('whitespace-nowrap border-b border-line bg-surface-2 px-3 py-2 text-[length:calc(12px*var(--fs-scale))] font-medium text-ink-2', c.align === 'right' ? 'text-right' : 'text-left')}><ReferenceText message={c.label} /></th>)}
          {inlineEdit && <th className="sticky right-0 w-28 border-b border-line bg-surface-2" />}
          {navigates && <th className="sticky right-0 w-20 border-b border-line bg-surface-2" aria-label={referenceT("Actions")} />}
        </tr>
      </TableHeader>
      <TableBody>
        {editing?.id === '__new' && editRow('__new')}
        {!data && loading && Array.from({ length: 10 }, (_, i) => (
          <tr key={i}>{Array.from({ length: colCount }, (__, j) => <td key={j} className="border-b border-line px-3 py-2.5"><Skeleton className={j === 0 ? 'w-16' : 'w-24'} /></td>)}</tr>
        ))}
        {groups
          ? groups.map(([g, rs]) => (
              <Fragment key={g}>
                <tr className="bg-surface-3/60">
                  <td colSpan={colCount} className="border-b border-line px-3 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] font-semibold text-ink">
                    {g} <span className="ml-1 font-normal text-ink-3">{referenceT(rs.length === 1 ? "{count} row" : "{count} rows", {count: rs.length})}</span>
                    {firstMoney && <span className="float-right tnum">{fmtCurrency(rs.reduce((s, r) => s + (Number(r[firstMoney.key]) || 0), 0))}</span>}
                  </td>
                </tr>
                {rs.map(dataRow)}
              </Fragment>
            ))
          : rows.map(dataRow)}
      </TableBody>
      {showTotals && data && rows.length > 0 && (
        <TableFooter className="sticky bottom-0 z-10">
          <tr>
            {selectable && <td className="border-t border-line bg-surface-2" />}
            {cols.map((f, i) => (
              <td key={f.key} className={cx('whitespace-nowrap border-t-2 border-line-strong bg-surface-2 px-3 py-2 text-[length:calc(12.5px*var(--fs-scale))] font-semibold', isNumeric(f) && 'text-right tnum')}>
                {i === 0 ? `Total (${total})` : isNumeric(f) && f.type !== 'percent' && data.totals[f.key] !== undefined ? fmtValue(f, data.totals[f.key]) : ''}
              </td>
            ))}
            {extraColumns?.map((c) => <td key={c.key} className="border-t-2 border-line-strong bg-surface-2" />)}
            {navigates && <td className="sticky right-0 border-t-2 border-line-strong bg-surface-2" />}
          </tr>
        </TableFooter>
      )}
    </Table>
  );

  const cards = (
    <CardGrid data-reference-result className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {!data && loading && Array.from({ length: 8 }, (_, i) => <div key={i} className="rounded-lg border border-line bg-surface p-3.5"><Skeleton className="mb-3 w-24" /><Skeleton className="mb-2 w-3/4" /><Skeleton className="w-1/2" /></div>)}
      {rows.map((row) => {
        const statusF = def.fields.find((f) => f.type === 'status');
        const codeF = def.fields.find((f) => f.type === 'code');
        const secondary = def.fields.find((f) => f.secondary);
        const meta = cols.filter((f) => f !== primary && f !== statusF && f !== codeF && f !== secondary).slice(0, 4);
        return (
          <button key={row.id} onClick={() => (inlineEdit ? startEdit(row) : onOpen?.(row))} className={cx('flex flex-col rounded-lg border bg-surface p-3.5 text-left transition-colors hover:border-brand/50', selectedId === row.id ? 'border-brand' : 'border-line')}>
            <div className="flex w-full items-center gap-2">
              {codeF && <span className="text-[length:calc(12px*var(--fs-scale))] font-medium text-brand-ink tnum">{row[codeF.key]}</span>}
              <span className="flex-1" />
              {statusF && <StatusBadge value={row[statusF.key]} />}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              {primary?.type === 'person' && <Avatar name={row[primary.key]} size={26} />}
              <div className="min-w-0">
                <div className="truncate text-[length:calc(14px*var(--fs-scale))] font-semibold text-ink">{fmtValue(primary, row[primary.key])}</div>
                {secondary && <div className="truncate text-[length:calc(12px*var(--fs-scale))] text-ink-3">{fmtValue(secondary, row[secondary.key])}</div>}
              </div>
            </div>
            <dl className="mt-3 grid w-full grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-2.5">
              {meta.map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="truncate text-[length:calc(11px*var(--fs-scale))] text-ink-3"><ReferenceText message={f.label} /></dt>
                  <dd className={cx('truncate text-[length:calc(12.5px*var(--fs-scale))] text-ink', isNumeric(f) && 'tnum')}>{fmtValue(f, row[f.key])}</dd>
                </div>
              ))}
            </dl>
          </button>
        );
      })}
    </CardGrid>
  );

  const list = (
    <ul data-reference-result>
      {!data && loading && Array.from({ length: 12 }, (_, i) => <li key={i} className="border-b border-line px-3 py-3"><Skeleton className="mb-2 w-2/3" /><Skeleton className="w-1/3" /></li>)}
      {rows.map((row) => {
        const statusF = def.fields.find((f) => f.type === 'status');
        const codeF = def.fields.find((f) => f.type === 'code');
        const secondary = def.fields.find((f) => f.secondary) ?? cols.find((f) => f !== primary && f !== codeF && f !== statusF);
        const active = selectedId === row.id;
        return (
          <li key={row.id}>
            <button onClick={() => onOpen?.(row)} className={cx('relative flex w-full items-center gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors', active ? 'bg-brand-soft' : 'hover:bg-surface-2')}>
              {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {(primary?.type === 'person' || primary?.type === 'company') && <Avatar name={row[primary.key]} size={30} />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[length:calc(13.5px*var(--fs-scale))] font-medium text-ink">{fmtValue(primary, row[primary.key])}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[length:calc(12px*var(--fs-scale))] text-ink-3">
                  {codeF && <span className="tnum">{row[codeF.key]}</span>}
                  {secondary && <span className="truncate">{fmtValue(secondary, row[secondary.key])}</span>}
                </span>
              </span>
              {statusF && <StatusBadge value={row[statusF.key]} />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const empty = data && rows.length === 0 && editing?.id !== '__new' && (
    <Empty
      icon={SearchX}
      title={hasCriteria ? 'No records match' : 'No records yet'}
      body={hasCriteria ? 'Try a different search, or clear filters to see everything.' : `Add the first ${def.title.toLowerCase()} record to get started.`}
      action={hasCriteria ? <Button onClick={clearAll}><ReferenceText message="Clear search and filters" /></Button> : !readOnly && (onNew || inlineEdit) ? <Button variant="primary" icon={Plus} onClick={inlineEdit ? startNew : onNew}>{newLabel}</Button> : null}
    />
  );

  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, total);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-surface">
      {loading && data && <div className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-brand" />}

      {/* toolbar */}
      <div className={cx('border-b border-line', compact ? 'space-y-2 p-2.5' : 'space-y-2 px-3 py-2.5')}>
        <div className="flex flex-wrap items-center gap-2">
          {searchBox}
          {filterButton}
          {!compact && viewsMenu}
          {!compact && groupable && (
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="hidden w-48 sm:block" aria-label={referenceT("Group by")}>
              <option value=""><ReferenceText message="No grouping" /></option>
              {groupFields.map((f) => <option key={f.key} value={f.key}><ReferenceText message="Group by" /> <ReferenceText message={f.label} /></option>)}
            </Select>
          )}
          {!compact && <span className="hidden flex-1 sm:block" />}
          {toolbarExtra}
          {!compact && (
            <div className="flex items-center gap-0.5">
              {columnsMenu}
              <IconButton icon={density === 'compact' ? Rows4 : Rows3} label={density === 'compact' ? 'Comfortable rows' : 'Compact rows'} disabled={densityPref.disabled} onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')} className="hidden sm:inline-flex" />
              <div className="ml-1 hidden md:block">
                <Segmented size="sm" label={referenceT("Result view")} disabled={viewPref.disabled} value={view} onChange={(v) => { setView(v); }} options={[{ value: 'table', icon: Table2, title: 'Table view' }, { value: 'cards', icon: LayoutGrid, title: 'Card view' }]} />
              </div>
              <IconButton icon={Download} label={exporter.label} onClick={() => exportCSV(false)} />
            </div>
          )}
          {!readOnly && (inlineEdit || onNew) && (
            <Button variant="primary" icon={Plus} onClick={inlineEdit ? startNew : onNew} className={compact ? 'px-2' : ''} aria-label={newLabel}>
              {!compact && newLabel}
            </Button>
          )}
        </div>

        {selected.size > 0 ? (
          <div className="flex items-center gap-2 rounded-md bg-rail px-3 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] text-white anim-fade">
            <span className="font-medium">{selected.size} <ReferenceText message="selected" /></span>
            <span className="flex-1" />
            <button className="rounded px-2 py-0.5 hover:bg-rail-3" onClick={() => exportCSV(true)}><ReferenceText message="Export selected" /></button>
            <button className="rounded px-2 py-0.5 text-[#ffb4a6] hover:bg-rail-3" onClick={() => setConfirmDelete(true)}><Trash2 size={13} className="mr-1 inline" /><ReferenceText message="Delete" /></button>
            <button className="rounded px-2 py-0.5 hover:bg-rail-3" onClick={() => setSelected(new Set())}><ReferenceText message="Clear" /></button>
          </div>
        ) : (
          (chips || activeFilters.length > 0) && (
            <div className="flex items-center gap-2">
              {chips}
              {activeFilters.length > 0 && (
                <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto">
                  {chips && <span className="h-4 w-px bg-line" />}
                  {activeFilters.map(([k, c]) => {
                    const f = def.fields.find((x) => x.key === k)!;
                    return (
                      <span key={k} className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-brand/30 bg-brand-soft py-0.5 pl-2.5 pr-1 text-[length:calc(12px*var(--fs-scale))] text-brand-ink">
                        <span className="truncate"><span className="font-medium"><ReferenceText message={f?.label} />:</span> {f ? filterSummary(f, c, fmt) : ''}</span>
                        <button onClick={() => setFilters((x) => { const n = { ...x }; delete n[k]; return n; })} className="rounded-full p-0.5 hover:bg-brand/15" aria-label={referenceT("Remove {value0} filter", {value0: referenceT(f?.label)})}><X size={12} /></button>
                      </span>
                    );
                  })}
                  <button onClick={() => setFilters({})} className="shrink-0 text-[length:calc(12px*var(--fs-scale))] text-ink-3 hover:text-ink"><ReferenceText message="Clear all" /></button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {error && <ErrorNote message={error} onRetry={reload} />}

      {/* body */}
      <div className="relative min-h-0 flex-1 overflow-auto">
        {compact ? list : cardsMode ? cards : table}
        {empty}
      </div>

      {/* pagination: shared Pagination for full worklists; the narrow side list keeps the source pager */}
      {compact ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-line bg-surface-2 px-3 py-1.5 text-[length:calc(12.5px*var(--fs-scale))] text-ink-2">
          <span className="whitespace-nowrap tnum">{data ? (total ? `${from}–${to} of ${total}` : '0 records') : referenceT("Loading…")}</span>
          <span className="flex-1" />
          <IconButton icon={ChevronLeft} size="sm" label={referenceT("Previous page")} disabled={page <= 1} onClick={() => setPage(page - 1)} />
          <span className="tnum text-ink-3">{page}/{pages}</span>
          <IconButton icon={ChevronRight} size="sm" label={referenceT("Next page")} disabled={page >= pages} onClick={() => setPage(page + 1)} />
        </div>
      ) : (
        <Pagination page={page} pageSize={size} total={total} onPageChange={setPage} onPageSizeChange={changeSize} pageSizeDisabled={pageSizePref.disabled || Boolean(defaultSize)} />
      )}

      <AdvancedFilter open={advOpen} onClose={() => setAdvOpen(false)} fields={filterFields} value={filters} onApply={setFilters} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={referenceT(selected.size === 1 ? "Delete {count} record?" : "Delete {count} records?", {count: selected.size})}
        footer={<><Button onClick={() => setConfirmDelete(false)}><ReferenceText message="Keep them" /></Button><Button variant="danger" icon={Trash2} onClick={deleteSelected}><ReferenceText message="Delete" /></Button></>}
      >
        <p className="text-[length:calc(13px*var(--fs-scale))] text-ink-2"><ReferenceText message="This removes the selected records from the list. Linked documents keep their copy of the data." /></p>
      </Modal>
    </div>
  );
}
