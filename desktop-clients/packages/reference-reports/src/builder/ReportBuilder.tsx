"use client";
// Port of lumen-reports src/components/builder/ReportBuilder.tsx. The server re-validates every definition.
import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { IconButton, Input, useLocalization } from '@pepbits/ops-ui';
import { useModuleRouter, useReportsClient } from '../api/client';
import { ChartRenderer } from '../charts/Charts';
import { PRESET_LABELS, PRESETS } from '../lib/dates';
import { validateExpression } from '../lib/expression';
import type { Aggregate, ColumnType, Dataset, DatePreset, ReportDefinition, RunResult } from '../types';
import { DataTable } from '../ui/DataTable';
import { Button, Card, CardHeader, Checkbox, MultiSelect, Notice, SelectInput, TextArea, TextInput } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


interface Col {
  key: string;
  label: string;
  type: ColumnType;
  field?: string;
  aggregate?: Aggregate;
  expression?: string;
  shown: boolean;
}

const AGG_LABEL: Record<Aggregate, string> = { sum: 'Total', avg: 'Average', min: 'Minimum', max: 'Maximum', count: 'Count' };
const NUMERIC: ColumnType[] = ['integer', 'number', 'currency', 'percent'];

function uniqueKey(base: string, taken: string[]) {
  let k = base.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([^a-z])/, 'c_$1').slice(0, 36) || 'col';
  let i = 2;
  const b = k;
  while (taken.includes(k)) k = `${b}_${i++}`;
  return k;
}

function fromDefinition(def?: ReportDefinition | null): Col[] {
  if (!def) return [];
  return def.columns.map((c) => ({ key: c.key, label: c.label, type: c.type, field: c.expression ? undefined : c.field ?? c.key, aggregate: c.aggregate, expression: c.expression, shown: def.defaultColumns.includes(c.key) }));
}

export function ReportBuilder({ datasets, categories, roles, canShare, isAdmin, existing }: {
  datasets: Dataset[];
  categories: string[];
  roles: { id: string; name: string }[];
  canShare: boolean;
  isAdmin: boolean;
  existing?: ReportDefinition | null;
}) {
 const referenceT = useReferenceLocalization().t;

  const router = useModuleRouter();
  const { api } = useReportsClient();
  const { t } = useLocalization();
  const toast = useToast();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? categories[0]);
  const [subcategory, setSubcategory] = useState(existing?.subcategory ?? 'Custom');
  const [datasetId, setDatasetId] = useState(existing?.datasetId ?? datasets[0].id);
  const [mode, setMode] = useState<'summary' | 'detail'>(existing ? (existing.groupBy.length ? 'summary' : 'detail') : 'summary');
  const [groupBy, setGroupBy] = useState<string[]>(existing?.groupBy ?? []);
  const [cols, setCols] = useState<Col[]>(fromDefinition(existing));
  const [filterFields, setFilterFields] = useState<string[]>(existing?.filters.filter((f) => f.type !== 'daterange' && f.key !== 'branch').map((f) => f.field) ?? []);
  const [preset, setPreset] = useState<DatePreset>(((existing?.filters.find((f) => f.type === 'daterange')?.default as { preset?: DatePreset } | undefined)?.preset) ?? 'last_30_days');
  const [sortKey, setSortKey] = useState(existing?.sort?.key ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(existing?.sort?.dir ?? 'desc');
  const [chartType, setChartType] = useState(existing?.chart.type ?? 'bar');
  const [chartX, setChartX] = useState(existing?.chart.x ?? '');
  const [chartY, setChartY] = useState<string[]>(existing?.chart.y ?? []);
  const [visibility, setVisibility] = useState(existing?.visibility ?? 'private');
  const [sharedRoleIds, setShared] = useState<string[]>(existing?.sharedRoleIds ?? []);
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ds = datasets.find((d) => d.id === datasetId)!;
  const dims = ds.fields.filter((f) => f.type === 'string' || f.type === 'date');
  const numericFields = ds.fields.filter((f) => NUMERIC.includes(f.type));
  const keys = cols.map((c) => c.key);

  const changeDataset = (id: string) => {
    setDatasetId(id);
    setCols([]);
    setGroupBy([]);
    setFilterFields([]);
    setChartX('');
    setChartY([]);
    setPreview(null);
  };
  const changeMode = (m: 'summary' | 'detail') => {
    setMode(m);
    setCols([]);
    setGroupBy([]);
    setPreview(null);
  };
  const changeGroupBy = (g: string[]) => {
    setGroupBy(g);
    // Keep grouping columns first, in the chosen order.
    const rest = cols.filter((c) => !(c.field && !c.aggregate && !c.expression));
    const dimsCols: Col[] = g.map((f) => {
      const fd = ds.fields.find((x) => x.key === f)!;
      return { key: f, label: fd.label, type: fd.type, field: f, shown: true };
    });
    setCols([...dimsCols, ...rest]);
    if (!chartX && g[0]) setChartX(g[0]);
  };
  const addDetailField = (f: string) => {
    const fd = ds.fields.find((x) => x.key === f)!;
    setCols([...cols, { key: uniqueKey(f, keys), label: fd.label, type: fd.type, field: f, shown: true }]);
  };
  const [mField, setMField] = useState('');
  const [mAgg, setMAgg] = useState<Aggregate>('sum');
  const addMeasure = () => {
    const f = mField || numericFields[0]?.key;
    if (!f) return;
    const fd = ds.fields.find((x) => x.key === f)!;
    const key = uniqueKey(mAgg === 'sum' ? f : `${mAgg}_${f}`, keys);
    setCols([...cols, { key, label: mAgg === 'sum' ? fd.label : `${AGG_LABEL[mAgg]} ${fd.label.toLowerCase()}`, type: mAgg === 'count' ? 'integer' : fd.type, field: f, aggregate: mAgg, shown: true }]);
    if (!chartY.length) setChartY([key]);
  };
  const addComputed = () => setCols([...cols, { key: uniqueKey('calc', keys), label: 'New calculation', type: 'percent', expression: '', shown: true }]);
  const update = (i: number, patch: Partial<Col>) => setCols(cols.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => setCols(cols.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const n = [...cols];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setCols(n);
  };

  const exprErrors = useMemo(() => cols.map((c, i) => (c.expression !== undefined ? (c.expression.trim() ? validateExpression(c.expression, cols.slice(0, i).map((x) => x.key)) : 'Enter a formula.') : null)), [cols]);

  const payload = () => ({
    title, description, category, subcategory, datasetId,
    columns: cols.map((c) => ({ key: c.key, label: c.label, type: c.type, ...(c.expression !== undefined ? { expression: c.expression } : { field: c.field, ...(c.aggregate ? { aggregate: c.aggregate } : {}) }) })),
    defaultColumns: cols.filter((c) => c.shown).map((c) => c.key),
    groupBy: mode === 'summary' ? groupBy : [],
    filterFields,
    defaultPreset: preset,
    sort: sortKey ? { key: sortKey, dir: sortDir } : undefined,
    chart: chartType === 'none' || mode === 'detail' ? { type: 'none' as const } : { type: chartType, x: chartX || groupBy[0], y: chartY },
    visibility,
    sharedRoleIds,
    tags: [],
  });

  const runPreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      setPreview(await api<RunResult>('/api/builder/preview', { body: { ...payload(), title: title || 'Preview' } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  };
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const def = await api<ReportDefinition>(existing ? `/api/definitions/${existing.id}` : '/api/definitions', { method: existing ? 'PUT' : 'POST', body: payload() });
      toast.success(existing ? 'Report updated.' : 'Report saved to the library.');
      router.push(`/reports/${def.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const filterable = ds.fields.filter((f) => f.filter && f.key !== ds.branchField);
  const canSave = title.trim().length >= 3 && cols.length > 0 && exprErrors.every((e) => !e);

  return (
    <div className="lr-split-builder">
      <div className="lr-stack">
        <Card>
          <CardHeader title={referenceT("About the report")} />
          <div className="lr-grid-2 lr-pad">
            <div className="lr-span-full"><TextInput label={referenceT("Title")} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={referenceT("For example: Discount by payer and branch")} /></div>
            <div className="lr-span-full"><TextArea label={referenceT("Description")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={referenceT("What the report answers, in one sentence.")} /></div>
            <SelectInput label={referenceT("Category")} value={category} onChange={(e) => setCategory(e.target.value)} options={categories.map((c) => ({ value: c, label: c }))} />
            <TextInput label={referenceT("Group in library under")} value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
          </div>
        </Card>

        <Card>
          <CardHeader title={referenceT("Data")} description={referenceT("Only approved datasets are available. Sensitive fields stay masked for roles that cannot see them.")} />
          <div className="lr-grid-2 lr-pad">
            <SelectInput label={referenceT("Dataset")} value={datasetId} onChange={(e) => changeDataset(e.target.value)} options={datasets.map((d) => ({ value: d.id, label: `${d.name} (${d.domain})` }))} hint={ds.description} />
            <SelectInput label={referenceT("Report type")} value={mode} onChange={(e) => changeMode(e.target.value as 'summary' | 'detail')}
              options={[{ value: 'summary', label: 'Summary: grouped totals' }, { value: 'detail', label: 'Detail: one row per record' }]}
              hint={mode === 'detail' ? 'Detail reports load up to 92 days on screen; longer periods run in the background.' : undefined} />
            {mode === 'summary' && (
              <div className="lr-span-full">
                <MultiSelect label={referenceT("Group rows by")} options={dims.map((f) => f.key)} value={groupBy} onChange={changeGroupBy} placeholder={referenceT("Choose one or more fields")} />
                <p className="lr-hint">{t('Field keys: {keys}', { keys: dims.map((f) => `${f.key} (${f.label})`).join(', ') })}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={referenceT("Columns")} description={referenceT("Untick “Shown” to make a column optional: people can add it from the Columns button when they need it.")} />
          <div className="lr-stack-sm lr-pad">
            {mode === 'detail' ? (
              <div className="lr-row lr-gap-xs">
                {ds.fields.map((f) => (
                  <button type="button" key={f.key} onClick={() => addDetailField(f.key)} className="lr-chip-add">
                    + <ReferenceText message={f.label} />{f.sensitive ? ` (${t('sensitive')})` : ''}
                  </button>
                ))}
              </div>
            ) : (
              <div className="lr-row lr-row-end">
                <div className="lr-grow lr-min-180">
                  <SelectInput label={referenceT("Measure")} value={mField || numericFields[0]?.key} onChange={(e) => setMField(e.target.value)} options={ds.fields.map((f) => ({ value: f.key, label: f.label }))} />
                </div>
                <div className="lr-w-160">
                  <SelectInput label={referenceT("Summary")} value={mAgg} onChange={(e) => setMAgg(e.target.value as Aggregate)} options={(Object.keys(AGG_LABEL) as Aggregate[]).map((a) => ({ value: a, label: AGG_LABEL[a] }))} />
                </div>
                <Button icon={<Plus className="lr-icon-sm" />} onClick={addMeasure}><ReferenceText message="Add measure" /></Button>
              </div>
            )}
            <div><Button size="sm" variant="ghost" icon={<Plus className="lr-icon-xs" />} onClick={addComputed}><ReferenceText message="Add calculated column" /></Button></div>

            {cols.length === 0 ? <p className="lr-notice lr-notice-info lr-center">{t(mode === 'summary' ? 'Choose grouping fields, then add measures.' : 'Add the fields you want as columns.')}</p> : (
              <ul className="lr-stack-sm">
                {cols.map((c, i) => {
                  const isDim = mode === 'summary' && !c.aggregate && c.expression === undefined;
                  return (
                    <li key={c.key} className="lr-builder-col">
                      <div className="lr-row">
                        <Input aria-label={referenceT("Column label")} className="lr-builder-label" value={c.label} onChange={(e) => update(i, { label: e.target.value })} />
                        <code className="lr-xs lr-muted">{c.key}</code>
                        <span className="lr-xs lr-muted">{t(c.expression !== undefined ? 'calculated' : isDim ? 'group' : c.aggregate ? AGG_LABEL[c.aggregate].toLowerCase() : c.type)}</span>
                        <span className="lr-row lr-gap-none lr-ml-auto">
                          <Checkbox checked={c.shown} onChange={(v) => update(i, { shown: v })} label={referenceT("Shown")} disabled={isDim} />
                          <IconButton label={referenceT("Move up")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="lr-icon-sm" /></IconButton>
                          <IconButton label={referenceT("Move down")} disabled={i === cols.length - 1} onClick={() => move(i, 1)}><ArrowDown className="lr-icon-sm" /></IconButton>
                          {!isDim && <IconButton label={t('Remove {label}', { label: c.label })} onClick={() => remove(i)}><Trash2 className="lr-icon-sm" /></IconButton>}
                        </span>
                      </div>
                      {c.expression !== undefined && (
                        <div className="lr-builder-formula">
                          <Input aria-label={referenceT("Formula")} className="lr-mono" value={c.expression} onChange={(e) => update(i, { expression: e.target.value })}
                            error={exprErrors[i] ?? undefined}
                            hint={exprErrors[i] ? undefined : 'Valid. Use columns above this one with + - * / ( ) and round, abs, min, max, coalesce.'}
                            placeholder={referenceT("e.g. {value0}", {value0: cols.filter((x) => x.aggregate || mode === 'detail').slice(0, 2).map((x) => x.key).join(' / ') || 'net_amount / invoices'})} />
                          <SelectInput label={referenceT("Result type")} value={c.type} onChange={(e) => update(i, { type: e.target.value as ColumnType })} options={NUMERIC.map((ty) => ({ value: ty, label: ty }))} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={referenceT("Filters and sorting")} />
          <div className="lr-grid-2 lr-pad">
            <SelectInput label={referenceT("Default period")} value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)} options={PRESETS.filter((p) => p !== 'custom').map((p) => ({ value: p, label: PRESET_LABELS[p] }))} hint={referenceT("Branch is always available as a filter.")} />
            <MultiSelect label={referenceT("Extra filters")} options={filterable.map((f) => f.key)} value={filterFields} onChange={setFilterFields} placeholder={referenceT("None")} />
            <SelectInput label={referenceT("Sort by")} value={sortKey} onChange={(e) => setSortKey(e.target.value)} options={[{ value: '', label: 'No default sort' }, ...cols.map((c) => ({ value: c.key, label: c.label }))]} />
            <SelectInput label={referenceT("Direction")} value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} options={[{ value: 'desc', label: 'Largest first' }, { value: 'asc', label: 'Smallest first' }]} />
          </div>
        </Card>

        {mode === 'summary' && (
          <Card>
            <CardHeader title={referenceT("Chart")} />
            <div className="lr-grid-3 lr-pad">
              <SelectInput label={referenceT("Chart type")} value={chartType} onChange={(e) => setChartType(e.target.value as typeof chartType)} options={[{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }, { value: 'donut', label: 'Donut' }, { value: 'none', label: 'No chart' }]} />
              <SelectInput label={referenceT("Labels from")} value={chartX || groupBy[0] || ''} onChange={(e) => setChartX(e.target.value)} options={groupBy.map((g) => ({ value: g, label: ds.fields.find((f) => f.key === g)?.label ?? g }))} />
              <MultiSelect label={referenceT("Values")} options={cols.filter((c) => c.aggregate || c.expression !== undefined).map((c) => c.key)} value={chartY} onChange={setChartY} placeholder={referenceT("Choose")} />
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title={referenceT("Who can use it")} />
          <div className="lr-grid-2 lr-pad">
            <SelectInput label={referenceT("Visibility")} value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              options={[{ value: 'private', label: 'Only me' }, ...(canShare ? [{ value: 'roles', label: 'Selected roles' }, { value: 'everyone', label: 'Everyone' }] : [])]}
              hint={canShare ? 'Shared roles get view, print, CSV, Excel, email and schedule. Adjust per role in Roles and access.' : 'Your role can build private reports. Ask an administrator to share them.'} />
            {visibility === 'roles' && (
              <MultiSelect label={referenceT("Roles")} options={roles.map((r) => r.name)} value={sharedRoleIds.map((id) => roles.find((r) => r.id === id)?.name ?? id)}
                onChange={(names) => setShared(names.map((n) => roles.find((r) => r.name === n)?.id ?? n))} placeholder={referenceT("Choose roles")} />
            )}
          </div>
          {isAdmin && <p className="lr-card-footnote">{t('On-screen limits for custom reports follow the global rules in Settings and rules.')}</p>}
        </Card>
      </div>

      <div className="lr-sticky-side">
        <Card>
          <CardHeader title={referenceT("Preview")} description={referenceT("First 25 rows for the default period, with your own access applied.")}
            actions={<Button size="sm" icon={<RefreshCw className="lr-icon-xs" />} loading={previewing} onClick={runPreview} disabled={!cols.length}><ReferenceText message="Refresh preview" /></Button>} />
          {error && <Notice tone="danger" role="alert" className="lr-notice-flush">{error}</Notice>}
          {preview?.chart && <div className="lr-pad lr-divider-bottom"><ChartRenderer data={preview.chart} types={Object.fromEntries(cols.map((c) => [c.key, c.type]))} height={220} /></div>}
          {preview ? (
            <DataTable columns={preview.columns} rows={preview.rows} totals={preview.totals} maxHeight="medium" caption="Preview" />
          ) : (
            <p className="lr-empty-text lr-center lr-pad-lg">{t('Add columns, then refresh the preview.')}</p>
          )}
          <div className="lr-card-actions">
            <Button onClick={() => router.push('/builder')}><ReferenceText message="Cancel" /></Button>
            <Button variant="primary" loading={saving} disabled={!canSave} onClick={save}>{existing ? 'Save changes' : 'Save report'}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
