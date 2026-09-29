'use client';
import {useCsvExport} from '../../lib/export';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import { Download, Eye, Pencil, Plus, Power, RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApiClient, errorMessage, qs } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { useLookupInvalidation } from '../../lib/lookups';
import { MasterDef } from '../../lib/masters';
import { Page, Row } from '../../lib/types';
import { Button, FilterChips, SearchInput, Segmented } from '../ui/controls';
import { Column, DataTable, Pagination } from '../ui/DataTable';
import { EmptyState, ErrorBanner } from '../ui/display';
import { useToast } from '../ui/Toast';
import { RenderCell } from './cells';

export function MasterWorklist({ def, onOpen, onNew, selectedId, refreshKey = 0, scope = {}, onClearScope }: {
  def: MasterDef; onOpen: (row: Row, mode: 'view' | 'edit') => void; onNew: () => void; selectedId?: string | null; refreshKey?: number;
  scope?: Record<string, string>; onClearScope?: () => void;
}) {
 const exporter=useCsvExport();
 const {downloadCsv}=exporter;
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const invalidateLookups = useLookupInvalidation();
  const api = useApiClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('All');
  const [status, setStatus] = useState<'All' | 'Active' | 'Inactive'>('Active');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: def.columns[0].sortKey ?? def.columns[0].key, dir: 'asc' });
  const [page, setPage] = useState(1);
  const {preferences} = useReferenceHost();
  const pageSize = preferences.pageSize;
  const setPageSize = () => {};
  const q = useDebounced(search, 250);
  useEffect(() => setPage(1), [q, preset, status, pageSize]);

  const params = { search: q, status, sort: sort.key, dir: sort.dir, page, pageSize, ...(def.presets && preset !== 'All' ? { [def.presets.param]: preset } : {}), ...scope };
  const { data, loading, error, reload } = useApi<Page>(`/masters/${def.entity}${qs(params)}`);
  useEffect(() => { if (refreshKey) reload(); }, [refreshKey, reload]);

  const toggleStatus = async (r: Row) => {
    const next = r.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api(`/masters/${def.entity}/${r.id}/status`, { method: 'PATCH', body: { status: next } });
      invalidateLookups(); reload();
      toast({ tone: 'ok', title: healthcareT("{v0} {v1}",{v0:def.titleOf(r),v1:next === 'Active' ? 'activated' : 'deactivated'}) });
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not change status"), body: errorMessage(e) }); }
  };

  const exportCsv = async () => {
    if(exporter.disabled)return;
    try {
      const all = await api<Page>(`/masters/${def.entity}${qs({ ...params, page: 1, pageSize: 1000 })}`);
      downloadCsv(`${def.entity}.csv`, def.columns.map((c) => c.header), all.data.map((r) => def.columns.map((c) => r[c.key])));
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Export failed"), body: errorMessage(e) }); }
  };

  const columns: Column<Row>[] = def.columns.map((c) => ({ key: c.key, header: c.header, width: c.width, align: c.align, sortable: true, render: (r) => <RenderCell c={c} r={r} /> }));
  const scopeEntries = Object.entries(scope);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
        <SearchInput value={search} onChange={setSearch} placeholder={t("Search {v0}",{v0:def.title.toLowerCase()})} className="w-64" />
        <Segmented size="sm" value={status} onChange={setStatus} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }, { value: 'All', label: 'All' }]} />
        {def.presets && <FilterChips value={preset} onChange={setPreset} options={[{ value: 'All', label: `All ${def.presets.label.toLowerCase()}s` }, ...def.presets.values.map((v) => ({ value: v, label: v }))]} />}
        {scopeEntries.length > 0 && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-hc-info-50 pl-2.5 pr-1 text-hc-xs text-hc-info-700"><LocalizedText message="Filtered by {scope}" values={{scope:scopeEntries.map(([k,v])=>`${t(def.sections.flatMap(s=>s.fields).find(f=>f.key===k)?.label??k)} ${v}`).join(', ')}}/>
            {onClearScope && <button type="button" aria-label="Clear filter" onClick={onClearScope} className="rounded-full p-0.5 hover:bg-hc-info-100"><X className="h-3 w-3" /></button>}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload} aria-label="Refresh" />
          <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} disabled={exporter.disabled} title={exporter.reason} onClick={exportCsv}><LocalizedText message="Export" /></Button>
          <Button mutation size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={onNew}><LocalizedText message="New {record}" values={{record:t(def.singular)}}/></Button>
        </div>
      </div>
      {error && <div className="p-3"><ErrorBanner message={error.message} onRetry={reload} /></div>}
      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        selectedKey={selectedId}
        sort={sort}
        onSort={(k) => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))}
        onRowClick={(r) => onOpen(r, 'view')}
        rowClassName={(r) => (r.status === 'Inactive' ? 'text-hc-ink-mute' : undefined)}
        rowActions={(r) => (
          <>
            <Button size="xs" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} aria-label="View" title="View" onClick={() => onOpen(r, 'view')} />
            <Button mutation size="xs" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} aria-label="Edit" title="Edit" onClick={() => onOpen(r, 'edit')} />
            <Button mutation size="xs" variant="ghost" icon={<Power className="h-3.5 w-3.5" />} aria-label={r.status === 'Active' ? 'Deactivate' : 'Activate'} title={r.status === 'Active' ? 'Deactivate' : 'Activate'} onClick={() => toggleStatus(r)} className={r.status === 'Active' ? 'hover:text-hc-danger-600' : 'hover:text-hc-ok-600'} />
          </>
        )}
        empty={<EmptyState icon={<def.icon className="h-8 w-8" />} title={t("No {v0} match",{v0:def.title.toLowerCase()})} body="Change the search or filters, or create a new record." action={<Button mutation size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={onNew}><LocalizedText message="New {record}" values={{record:t(def.singular)}}/></Button>} />}
      />
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} onPageSize={setPageSize} />}
    </div>
  );
}
