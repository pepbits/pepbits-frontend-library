"use client";
// Port of lumen-reports src/components/dashboards/DashboardView.tsx and NewDashboardButton.tsx.
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ConfirmDialog, IconButton, Skeleton, useLocalization } from '@pepbits/ops-ui';
import { ReferenceLink, useReferenceHost } from '@pepbits/reference-host';
import { ApiError, useModuleRouter, useReportsClient } from '../api/client';
import { ChartRenderer } from '../charts/Charts';
import type { ColumnType, Dashboard, DateRangeValue, RunResult, Widget, WidgetKind } from '../types';
import { DataTable } from '../ui/DataTable';
import { Button, Card, Modal, MultiSelect, SelectInput, TextInput } from '../ui/primitives';
import { useReportFormat } from '../ui/preferences';
import { useToast } from '../ui/Toast';
import { DateRangeInput } from '../reports/FilterBar';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface WidgetReport {
  id: string;
  title: string;
  dateKey: string;
  hasChart: boolean;
  columns: { key: string; label: string; type: ColumnType }[];
}

const SIZE: Record<Widget['size'], string> = { sm: 'lr-widget-sm', md: 'lr-widget-md', lg: 'lr-widget-lg' };
const KIND_LABEL: Record<WidgetKind, string> = { kpi: 'Headline number', bar: 'Bar chart', line: 'Line chart', donut: 'Donut chart', table: 'Table' };

function WidgetCard({ w, report, range }: { w: Widget; report?: WidgetReport; range: DateRangeValue }) {
  const { api } = useReportsClient();
  const { preferences } = useReferenceHost();
  const { t } = useLocalization();
  const fmt = useReportFormat();
  const [res, setRes] = useState<RunResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!report) return;
    let live = true;
    const controller = new AbortController();
    setErr(null);
    api<RunResult>(`/api/reports/${report.id}/run`, { body: { filters: { [report.dateKey]: range }, pageSize: w.kind === 'table' ? 10 : 50 }, signal: controller.signal })
      .then((r) => { if (live) setRes(r); })
      .catch((e) => { if (live && e?.name !== 'AbortError') setErr(e instanceof ApiError && e.code === 'ASYNC_REQUIRED' ? 'Period too long for this widget. Choose a shorter period.' : e.message); });
    return () => { live = false; controller.abort(); };
  }, [api, report, range, w.kind]);

  const types = Object.fromEntries((report?.columns ?? []).map((c) => [c.key, c.type]));
  return (
    <Card className={`${SIZE[w.size]} lr-widget`}>
      <div className="lr-row lr-row-between lr-widget-head">
        <h3 className="lr-h3 lr-truncate">{w.title}</h3>
        {report && <ReferenceLink href={`/reports/${report.id}`} className="lr-link lr-xs lr-shrink0">{t('Open report')}</ReferenceLink>}
      </div>
      <div className="lr-widget-body">
        {!report ? (
          <p className="lr-row lr-gap-xs lr-sm lr-muted"><Lock className="lr-icon-sm" aria-hidden />{t('Your role cannot see this report.')}</p>
        ) : err ? (
          <p className="lr-sm lr-warn-ink">{t(err)}</p>
        ) : !res ? (
          preferences.loadingSkeletons ? <Skeleton className="lr-skeleton" /> : <p className="lr-sm lr-muted" aria-busy>{t('Loading…')}</p>
        ) : w.kind === 'kpi' ? (
          <div>
            <p className="lr-num lr-kpi">{fmt.value(res.totals[w.kpiColumn ?? ''], types[w.kpiColumn ?? ''] ?? 'number')}</p>
            <p className="lr-xs lr-muted lr-mt-xs">{t('{from} to {to}', { from: fmt.value(res.meta.from, 'date'), to: fmt.value(res.meta.to, 'date') })}</p>
          </div>
        ) : w.kind === 'table' ? (
          <DataTable columns={res.columns} rows={res.rows} totals={res.totals} maxHeight="short" caption={w.title} />
        ) : res.chart ? (
          <ChartRenderer data={{ ...res.chart, type: w.kind }} types={types} height={w.size === 'lg' ? 260 : 240} />
        ) : (
          <p className="lr-sm lr-muted">{t('This report has no chart. Show it as a table instead.')}</p>
        )}
      </div>
    </Card>
  );
}

export function DashboardView({ dashboard, reports, canEdit, canShare, roles }: {
  dashboard: Dashboard;
  reports: WidgetReport[];
  canEdit: boolean;
  canShare: boolean;
  roles: { id: string; name: string }[];
}) {
 const referenceT = useReferenceLocalization().t;

  const router = useModuleRouter();
  const { api } = useReportsClient();
  const { t } = useLocalization();
  const toast = useToast();
  const byId = new Map(reports.map((r) => [r.id, r]));
  const [range, setRange] = useState<DateRangeValue>(dashboard.dateRange);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Dashboard>(dashboard);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nw, setNw] = useState<{ reportId: string; kind: WidgetKind; size: Widget['size']; title: string; kpiColumn: string }>({ reportId: reports[0]?.id ?? '', kind: 'bar', size: 'md', title: '', kpiColumn: '' });
  const view = editing ? draft : dashboard;
  const nwReport = byId.get(nw.reportId);
  const numericCols = (nwReport?.columns ?? []).filter((c) => c.type !== 'string' && c.type !== 'date');

  const move = (i: number, d: -1 | 1) => {
    const w = [...draft.widgets];
    const j = i + d;
    if (j < 0 || j >= w.length) return;
    [w[i], w[j]] = [w[j], w[i]];
    setDraft({ ...draft, widgets: w });
  };
  const addWidget = () => {
    if (!nwReport) return;
    const kind = !nwReport.hasChart && ['bar', 'line', 'donut'].includes(nw.kind) ? 'table' : nw.kind;
    const w: Widget = {
      id: `w${Date.now().toString(36)}`, reportId: nwReport.id, kind, size: kind === 'kpi' ? 'sm' : nw.size,
      title: nw.title.trim() || (kind === 'kpi' ? numericCols.find((c) => c.key === nw.kpiColumn)?.label ?? nwReport.title : nwReport.title),
      ...(kind === 'kpi' ? { kpiColumn: nw.kpiColumn || numericCols[0]?.key } : {}),
    };
    setDraft({ ...draft, widgets: [...draft.widgets, w] });
    setAdding(false);
  };
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/dashboards/${dashboard.id}`, { method: 'PUT', body: { name: draft.name, description: draft.description, visibility: draft.visibility, sharedRoleIds: draft.sharedRoleIds, dateRange: range, widgets: draft.widgets } });
      toast.success('Dashboard saved.');
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    setConfirmDelete(false);
    try {
      await api(`/api/dashboards/${dashboard.id}`, { method: 'DELETE' });
      router.push('/dashboards');
      router.refresh();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <div>
      <div className="lr-row lr-row-between lr-row-end lr-mb-lg">
        <div className="lr-page-header-text">
          {editing ? (
            <div className="lr-grid-2">
              <TextInput label={referenceT("Name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              <TextInput label={referenceT("Description")} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <SelectInput label={referenceT("Visible to")} value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as Dashboard['visibility'] })}
                options={[{ value: 'private', label: 'Only me' }, ...(canShare ? [{ value: 'roles', label: 'Selected roles' }, { value: 'everyone', label: 'Everyone' }] : [])]}
                hint={referenceT("Viewers only see widgets for reports their own role can open.")} />
              {draft.visibility === 'roles' && (
                <MultiSelect label={referenceT("Roles")} options={roles.map((r) => r.name)} value={draft.sharedRoleIds.map((id) => roles.find((r) => r.id === id)?.name ?? id)}
                  onChange={(names) => setDraft({ ...draft, sharedRoleIds: names.map((n) => roles.find((r) => r.name === n)?.id ?? n) })} />
              )}
            </div>
          ) : (
            <>
              <h1 className="lr-h1">{dashboard.name}</h1>
              <p className="lr-page-description">{dashboard.description}</p>
            </>
          )}
        </div>
        <div className="lr-row lr-row-end">
          <DateRangeInput value={range} onChange={setRange} label={referenceT("Period for all widgets")} />
          {canEdit && !editing && <Button icon={<Pencil className="lr-icon-sm" />} onClick={() => { setDraft(dashboard); setEditing(true); }}><ReferenceText message="Edit" /></Button>}
          {editing && (
            <>
              <Button icon={<Plus className="lr-icon-sm" />} onClick={() => setAdding(true)}><ReferenceText message="Add widget" /></Button>
              <Button onClick={() => setEditing(false)}><ReferenceText message="Cancel" /></Button>
              <Button variant="primary" loading={saving} onClick={save}><ReferenceText message="Save dashboard" /></Button>
            </>
          )}
        </div>
      </div>

      {view.widgets.length === 0 ? (
        <Card className="lr-pad-xl lr-center lr-sm lr-muted">{t(canEdit ? 'Choose Edit, then Add widget to place reports on this dashboard.' : 'This dashboard has no widgets yet.')}</Card>
      ) : (
        <div className="lr-widget-grid">
          {view.widgets.map((w, i) => (
            editing ? (
              <Card key={w.id} className={`${SIZE[w.size]} lr-pad`}>
                <div className="lr-row lr-row-between lr-row-start">
                  <div className="lr-grow">
                    <TextInput label={referenceT("Widget title")} value={w.title} onChange={(e) => setDraft({ ...draft, widgets: draft.widgets.map((x) => (x.id === w.id ? { ...x, title: e.target.value } : x)) })} />
                    <p className="lr-xs lr-muted lr-mt-xs">{t('{kind} of {report}', { kind: t(KIND_LABEL[w.kind]), report: byId.get(w.reportId)?.title ?? w.reportId })}</p>
                  </div>
                  <div className="lr-row lr-gap-none lr-shrink0">
                    <IconButton label={referenceT("Move earlier")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="lr-icon-sm" /></IconButton>
                    <IconButton label={referenceT("Move later")} disabled={i === view.widgets.length - 1} onClick={() => move(i, 1)}><ArrowDown className="lr-icon-sm" /></IconButton>
                    <IconButton label={referenceT("Remove widget")} onClick={() => setDraft({ ...draft, widgets: draft.widgets.filter((x) => x.id !== w.id) })}><Trash2 className="lr-icon-sm" /></IconButton>
                  </div>
                </div>
                <div className="lr-mt-sm">
                  <SelectInput label={referenceT("Widget size")} value={w.size} onChange={(e) => setDraft({ ...draft, widgets: draft.widgets.map((x) => (x.id === w.id ? { ...x, size: e.target.value as Widget['size'] } : x)) })}
                    options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Half width' }, { value: 'lg', label: 'Full width' }]} />
                </div>
              </Card>
            ) : (
              <WidgetCard key={w.id} w={w} report={byId.get(w.reportId)} range={range} />
            )
          ))}
        </div>
      )}

      {canEdit && !editing && (
        <div className="lr-row lr-row-flush-end lr-mt-lg"><Button variant="danger" size="sm" icon={<Trash2 className="lr-icon-xs" />} onClick={() => setConfirmDelete(true)}><ReferenceText message="Delete dashboard" /></Button></div>
      )}
      <ConfirmDialog open={confirmDelete} tone="danger" title={referenceT("Delete dashboard")} confirmLabel={referenceT("Delete")} message={t('Delete the dashboard "{name}"?', { name: dashboard.name })} onConfirm={remove} onCancel={() => setConfirmDelete(false)} />

      <Modal open={adding} onClose={() => setAdding(false)} title={referenceT("Add widget")} description={referenceT("Widgets use the dashboard period and each viewer's own access.")}
        footer={<><Button onClick={() => setAdding(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" onClick={addWidget} disabled={!nwReport}><ReferenceText message="Add widget" /></Button></>}>
        <div className="lr-grid-2">
          <div className="lr-span-full">
            <SelectInput label={referenceT("Report")} value={nw.reportId} onChange={(e) => setNw({ ...nw, reportId: e.target.value, kpiColumn: '' })} options={reports.map((r) => ({ value: r.id, label: r.title }))} />
          </div>
          <SelectInput label={referenceT("Show as")} value={nw.kind} onChange={(e) => setNw({ ...nw, kind: e.target.value as WidgetKind })}
            options={(Object.keys(KIND_LABEL) as WidgetKind[]).filter((k) => nwReport?.hasChart || !['bar', 'line', 'donut'].includes(k)).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          {nw.kind === 'kpi' ? (
            <SelectInput label={referenceT("Number to show")} value={nw.kpiColumn || numericCols[0]?.key || ''} onChange={(e) => setNw({ ...nw, kpiColumn: e.target.value })} options={numericCols.map((c) => ({ value: c.key, label: c.label }))} hint={referenceT("The report total for the period.")} />
          ) : (
            <SelectInput label={referenceT("Size")} value={nw.size} onChange={(e) => setNw({ ...nw, size: e.target.value as Widget['size'] })} options={[{ value: 'md', label: 'Half width' }, { value: 'lg', label: 'Full width' }, { value: 'sm', label: 'Small' }]} />
          )}
          <div className="lr-span-full"><TextInput label={referenceT("Title (optional)")} value={nw.title} onChange={(e) => setNw({ ...nw, title: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}

export function NewDashboardButton() {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useModuleRouter();
  const toast = useToast();
  const create = async () => {
    setBusy(true);
    try {
      const d = await api<{ id: string }>('/api/dashboards', { body: { name, description } });
      router.push(`/dashboards/${d.id}`);
    } catch (e) {
      toast.error(e);
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="primary" icon={<Plus className="lr-icon-sm" />} onClick={() => setOpen(true)}><ReferenceText message="New dashboard" /></Button>
      <Modal open={open} onClose={() => setOpen(false)} title={referenceT("New dashboard")} description={referenceT("It starts private and empty. Add widgets with Edit.")}
        footer={<><Button onClick={() => setOpen(false)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} disabled={name.trim().length < 2} onClick={create}><ReferenceText message="Create dashboard" /></Button></>}>
        <div className="lr-stack">
          <TextInput label={referenceT("Name")} value={name} onChange={(e) => setName(e.target.value)} />
          <TextInput label={referenceT("Description")} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
