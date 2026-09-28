"use client";
/*
 * Port of lumen-reports src/components/reports/ReportViewer.tsx.
 * Differences from the source, all host integration: page size starts from and follows the effective
 * pageSize preference (not the organisation default), exports download through host.fetch, the export
 * menu is ordered/narrowed by the export preference, and menus use the shared ActionMenu.
 */
import { CalendarClock, ChevronDown, Clock, Columns3, Download, Lock, Mail, Printer, RotateCcw, Save, Star, Trash2, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionMenu, IconButton, MenuButton, useLocalization } from '@pepbits/ops-ui';
import { ApiError, useReportsClient } from '../api/client';
import { ChartRenderer } from '../charts/Charts';
import type { Action, DateRangeValue, FilterValues, ReportDefinition, ReportPolicy, RunResult, SavedView, SortSpec } from '../types';
import { DataTable, Pagination } from '../ui/DataTable';
import { Badge, Button, Card } from '../ui/primitives';
import { useManagedPageSize, useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { BackgroundDialog, ColumnPicker, FORMAT_LABEL, SaveViewDialog, ScheduleDialog, useAllowedFormats } from './dialogs';
import { DateRangeInput, FilterFields, RangeMeter } from './FilterBar';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



export interface ViewerProps {
  def: ReportDefinition;
  actions: Action[];
  views: SavedView[];
  initialView?: SavedView | null;
  favorite: boolean;
  filterOptions: Record<string, string[]>;
  sensitiveKeys: string[];
  unmask: boolean;
  policy: ReportPolicy;
  rowsPerDay: number;
  totalBranches: number;
  scopedBranches: string[] | null;
  settings: { timezone: string; pageSize: number };
  roles: { id: string; name: string }[];
  canRoleViews: boolean;
  userEmail: string;
  userId: string;
}

function defaultFilters(def: ReportDefinition): FilterValues {
  const f: FilterValues = {};
  for (const d of def.filters) if (d.default !== undefined) f[d.key] = d.default;
  return f;
}

export function ReportViewer(p: ViewerProps) {
 const referenceT = useReferenceLocalization().t;

  const { def } = p;
  const { api, download, canDownload } = useReportsClient();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const toast = useToast();
  const managed = useManagedPageSize();
  const dateKey = def.filters.find((f) => f.type === 'daterange')?.key ?? 'period';
  const initialView = p.initialView ?? undefined;

  const [views, setViews] = useState(p.views);
  const [activeView, setActiveView] = useState<SavedView | undefined>(initialView);
  const [draft, setDraft] = useState<FilterValues>(() => ({ ...defaultFilters(def), ...(initialView?.filters ?? {}) }));
  const [applied, setApplied] = useState<FilterValues>(draft);
  const [columns, setColumns] = useState<string[]>(initialView?.columns?.length ? initialView.columns : def.defaultColumns);
  const [sort, setSort] = useState<SortSpec | undefined>(initialView?.sort ?? def.sort);
  const [page, setPage] = useState(1);
  const pageSize = managed.pageSize;
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [asyncReason, setAsyncReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(p.favorite);
  const [dialog, setDialog] = useState<null | 'columns' | 'save' | 'background' | 'email' | 'schedule'>(null);
  const [exporting, setExporting] = useState(false);
  const reqId = useRef(0);

  // A page-size change (user or tenant policy) returns to the first page.
  useEffect(() => { setPage(1); }, [pageSize]);

  const run = useCallback(async (signal: AbortSignal) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const r = await api<RunResult>(`/api/reports/${def.id}/run`, { body: { filters: applied, columns, sort, page, pageSize }, signal });
      if (id !== reqId.current) return;
      setResult(r);
      setAsyncReason(null);
    } catch (e) {
      if (id !== reqId.current || (e as { name?: string })?.name === 'AbortError') return;
      if (e instanceof ApiError && e.code === 'ASYNC_REQUIRED') {
        setAsyncReason(e.message);
        setResult(null);
      } else setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [api, def.id, applied, columns, sort, page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    return () => controller.abort();
  }, [run]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const apply = () => { setApplied(draft); setPage(1); };
  const reset = () => {
    const f = defaultFilters(def);
    setDraft(f);
    setApplied(f);
    setColumns(def.defaultColumns);
    setSort(def.sort);
    setActiveView(undefined);
    setPage(1);
  };
  const loadView = (v: SavedView) => {
    const f = { ...defaultFilters(def), ...v.filters };
    setActiveView(v);
    setDraft(f);
    setApplied(f);
    setColumns(v.columns.length ? v.columns : def.defaultColumns);
    setSort(v.sort ?? def.sort);
    setPage(1);
  };
  const refreshViews = async () => setViews(await api<SavedView[]>(`/api/reports/${def.id}/views`));
  const deleteView = async (v: SavedView) => {
    try {
      await api(`/api/views/${v.id}`, { method: 'DELETE' });
      if (activeView?.id === v.id) setActiveView(undefined);
      await refreshViews();
      toast.success('View deleted.');
    } catch (e) {
      toast.error(e);
    }
  };
  const toggleFav = async () => {
    try {
      const r = await api<{ favorite: boolean }>('/api/favorites', { body: { reportId: def.id } });
      setFavorite(r.favorite);
    } catch (e) {
      toast.error(e);
    }
  };
  const doExport = async (format: 'csv' | 'xlsx' | 'json') => {
    setExporting(true);
    try {
      await download(`/api/reports/${def.id}/export`, { filters: applied, columns, sort, format }, `${def.id}.${format}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ASYNC_REQUIRED') {
        setAsyncReason(e.message);
        setDialog('background');
      } else toast.error(e);
    } finally {
      setExporting(false);
    }
  };
  const onSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
    setPage(1);
  };

  const formats = useAllowedFormats(p.actions);
  const types = useMemo(() => Object.fromEntries(def.columns.map((c) => [c.key, c.type])), [def.columns]);
  const selectedBranches = Array.isArray(draft.branch) ? draft.branch.length : 0;
  const branchShare = (selectedBranches || p.scopedBranches?.length || p.totalBranches) / p.totalBranches;
  const range = (draft[dateKey] as DateRangeValue | undefined) ?? { preset: 'last_30_days' };

  return (
    <div className="lr-stack">
      {/* Title and actions */}
      <div className="lr-row lr-row-between lr-row-start">
        <div className="lr-page-header-text">
          <p className="lr-sm lr-muted">{def.category} / {def.subcategory}</p>
          <div className="lr-row lr-gap-xs">
            <h1 className="lr-h1">{def.title}</h1>
            <IconButton label={favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={favorite} onClick={toggleFav}>
              <Star className={`lr-icon ${favorite ? 'lr-star-on' : 'lr-star-off'}`} />
            </IconButton>
            {def.kind === 'custom' && <Badge tone="brand"><ReferenceText message="Custom" /></Badge>}
            {def.groupBy.length === 0 && <Badge><ReferenceText message="Row detail" /></Badge>}
          </div>
          <p className="lr-page-description">{def.description}</p>
        </div>
        <div className="no-print lr-row">
          <ActionMenu trigger={<Button icon={<Save className="lr-icon-sm" />}>{activeView ? activeView.name : t('Views')} <ChevronDown className="lr-icon-xs" /></Button>}>
            {(close) => (
              <div className="lr-menu">
                <MenuButton icon={<RotateCcw className="lr-icon-sm" />} label={referenceT("Report default")} onClick={() => { reset(); close(); }} />
                {views.map((v) => (
                  <div key={v.id} className="lr-row lr-gap-none lr-menu-row">
                    <button type="button" className="lr-menu-item lr-grow" onClick={() => { loadView(v); close(); }}>
                      {v.name}
                      <span className="lr-block lr-xs lr-muted">{v.scope === 'role' ? t('Role: {role}', { role: p.roles.find((r) => r.id === v.roleId)?.name ?? v.roleId ?? '' }) : t('Personal')}{v.isDefault ? `, ${t('default')}` : ''}</span>
                    </button>
                    {(v.scope === 'user' ? v.ownerId === p.userId : p.canRoleViews) && (
                      <IconButton label={t('Delete view {name}', { name: v.name })} onClick={() => deleteView(v)}><Trash2 className="lr-icon-sm" /></IconButton>
                    )}
                  </div>
                ))}
                <div className="lr-menu-divider">
                  <button type="button" className="lr-menu-item lr-link lr-medium" onClick={() => { setDialog('save'); close(); }}>{t('Save current view…')}</button>
                </div>
              </div>
            )}
          </ActionMenu>
          <Button icon={<Columns3 className="lr-icon-sm" />} onClick={() => setDialog('columns')}><ReferenceText message="Columns" /></Button>
          {formats.length > 0 && (
            <ActionMenu trigger={<Button icon={<Download className="lr-icon-sm" />} loading={exporting}>{t('Export')} <ChevronDown className="lr-icon-xs" /></Button>}>
              {(close) => (
                <div className="lr-menu">
                  {formats.map((f) => (
                    <button key={f} type="button" className="lr-menu-item" disabled={!canDownload} title={canDownload ? undefined : t('Downloads are not available in this host.')} onClick={() => { close(); void doExport(f); }}>{t(FORMAT_LABEL[f])}</button>
                  ))}
                  <div className="lr-menu-divider">
                    <MenuButton icon={<Clock className="lr-icon-sm" />} label={referenceT("Run in background…")} onClick={() => { close(); setDialog('background'); }} />
                  </div>
                </div>
              )}
            </ActionMenu>
          )}
          {p.actions.includes('print') && <Button icon={<Printer className="lr-icon-sm" />} onClick={() => window.print()} aria-label={t('Print')}><ReferenceText message="Print" /></Button>}
          {p.actions.includes('email') && <Button icon={<Mail className="lr-icon-sm" />} onClick={() => setDialog('email')}><ReferenceText message="Email" /></Button>}
          {p.actions.includes('schedule') && <Button icon={<CalendarClock className="lr-icon-sm" />} onClick={() => setDialog('schedule')}><ReferenceText message="Schedule" /></Button>}
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print lr-pad">
        <div className="lr-row lr-row-end">
          <DateRangeInput value={range} onChange={(v) => setDraft({ ...draft, [dateKey]: v })} />
          <FilterFields defs={def.filters} values={draft} onChange={(k, v) => setDraft({ ...draft, [k]: v })} options={p.filterOptions} lockedBranches={p.scopedBranches} />
          <div className="lr-row lr-ml-auto">
            <Button variant="ghost" onClick={reset}><ReferenceText message="Reset" /></Button>
            <Button variant="primary" icon={<Zap className="lr-icon-sm" />} onClick={apply} disabled={!dirty && !!result}><ReferenceText message="Run report" /></Button>
          </div>
        </div>
        <div className="lr-mt">
          <RangeMeter range={range} timezone={p.settings.timezone} policy={p.policy} detail={def.groupBy.length === 0} rowsPerDay={p.rowsPerDay} branchShare={branchShare} onBackground={() => setDialog('background')} />
        </div>
        {p.scopedBranches && (
          <p className="lr-row lr-gap-xs lr-xs lr-muted lr-mt-sm">
            <Lock className="lr-icon-xs" aria-hidden /> {t('Your access is limited to {branches}. Other branches are never included.', { branches: p.scopedBranches.join(', ') })}
          </p>
        )}
      </Card>

      {/* Async required */}
      {asyncReason && (
        <Card className="lr-pad-lg lr-card-warning">
          <div className="lr-row lr-row-between">
            <div className="lr-page-header-text">
              <p className="lr-medium">{t('This request is too large to show on screen')}</p>
              <p className="lr-sm lr-muted">{asyncReason} {t('Run it in the background: it is processed month by month, saved to My reports, and emailed if you choose.')}</p>
            </div>
            <Button variant="signal" icon={<Clock className="lr-icon-sm" />} onClick={() => setDialog('background')}><ReferenceText message="Run in background" /></Button>
          </div>
        </Card>
      )}
      {error && <Card className="lr-pad lr-card-danger"><p role="alert" className="lr-sm lr-danger-ink">{error}</p></Card>}

      {/* Chart */}
      {result?.chart && (
        <Card className="lr-pad">
          <ChartRenderer data={result.chart} types={types} />
        </Card>
      )}

      {/* Table */}
      {(result || (loading && !asyncReason)) && (
        <Card>
          <div className="lr-table-meta">
            <span className="lr-num">
              {result ? t('Period {from} to {to} ({days} days). Ran in {ms} ms{cached}.', { from: fmt.value(result.meta.from, 'date'), to: fmt.value(result.meta.to, 'date'), days: fmt.count(result.meta.rangeDays), ms: result.meta.durationMs, cached: result.meta.cached ? t(' from cache') : '' }) : t('Running…')}
            </span>
            {result && <span>{t('Data refreshed {when}', { when: fmt.dateTime(result.meta.freshness, p.settings.timezone) })}</span>}
          </div>
          {result && result.meta.maskedColumns.length > 0 && (
            <p className="lr-masked-note">
              <Lock className="lr-icon-xs" aria-hidden /> {t('Sensitive columns are masked for your role: {columns}.', { columns: result.columns.filter((c) => c.masked).map((c) => c.label).join(', ') })}
            </p>
          )}
          <DataTable columns={result?.columns ?? []} rows={result?.rows ?? []} totals={result?.totals} sort={sort} onSort={onSort} loading={loading} maxHeight="tall" caption={def.title} />
          {result && <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPage={setPage} onPageSize={managed.setPageSize} pageSizeLocked={managed.locked} />}
        </Card>
      )}

      <ColumnPicker open={dialog === 'columns'} onClose={() => setDialog(null)} def={def} value={columns} onApply={(c) => { setColumns(c); setPage(1); }} sensitive={p.sensitiveKeys} unmask={p.unmask} />
      <SaveViewDialog open={dialog === 'save'} onClose={() => setDialog(null)} reportId={def.id} columns={columns} filters={draft} sort={sort} roles={p.roles} canRoleViews={p.canRoleViews} onSaved={refreshViews} />
      <BackgroundDialog open={dialog === 'background' || dialog === 'email'} mode={dialog === 'email' ? 'email' : 'background'} onClose={() => setDialog(null)} def={def} actions={p.actions} filters={draft} columns={columns} sort={sort} userEmail={p.userEmail} reason={dialog === 'background' ? asyncReason : null} />
      <ScheduleDialog open={dialog === 'schedule'} onClose={() => setDialog(null)} def={def} actions={p.actions} filters={applied} columns={columns} userEmail={p.userEmail} timezone={p.settings.timezone} />
    </div>
  );
}
