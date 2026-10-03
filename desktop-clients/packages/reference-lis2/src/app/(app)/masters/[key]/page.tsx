'use client';
import {DateInput} from '../../../../components/ui';

import {DiagnosticButton,DiagnosticInput} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import {useParams} from '@pepbits/reference-diagnostics';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import { useFilters, useList, useResource } from '../../../../lib/hooks';

import { Button, Checkbox, ErrorBanner, Field, Input, Loading, Modal, PageHeader, Select, Textarea, useToast } from '../../../../components/ui';
import { FilterBar, FilterItem, PagedTable, SearchBox } from '../../../../components/table';
import { RefSelect } from '../../../../components/refselect';
import { can, useUser } from '../../../../components/shell';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function MasterPage() {
 const referenceT = useReferenceLocalization().t;

 const {get}=useDiagnosticClient();

  const { key } = useParams<{ key: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const user = useUser();
  const toast = useToast();
  const { data: meta } = useResource<any[]>('/masters/meta');
  const e = meta?.find((x) => x.key === key);
  // Parent filter from a child link, e.g. ?parameter_id=5
  const parent = useMemo(() => { if (!e) return null; const f = e.fields.find((fd: any) => fd.type === 'ref' && sp.get(fd.name)); return f ? { field: f, value: sp.get(f.name)! } : null; }, [e, sp]);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [f, set] = useFilters({ q: '', sort: '', dir: 'asc', pageSize: 25 });
  const filters = { ...f, ...extra, ...(parent ? { [parent.field.name]: parent.value } : {}) };
  const { data, loading, error, reload } = useList(e ? `/masters/${key}` : null, filters);
  const [parentLabel, setParentLabel] = useState('');
  const [edit, setEdit] = useState<any>(null);
  useEffect(() => {
    if (!parent) return setParentLabel('');
    get(`/masters/${parent.field.ref}/${parent.value}`).then((r) => { const disp = meta?.find((m) => m.key === parent.field.ref); setParentLabel(r.code ? `${r.code} ${r.name || ''}` : r.name || r.lot_no || disp?.label || ''); }).catch(() => {});
  }, [parent, meta]);

  if (!meta) return <Loading />;
  if (!e) return <ErrorBanner error={`Unknown master “${key}”.`} />;
  const cols = e.fields.filter((fd: any) => fd.list && fd.type !== 'password' && fd.name !== parent?.field.name);
  const filterable = e.fields.filter((fd: any) => fd.list && (fd.type === 'select' || fd.type === 'ref' || fd.type === 'bool') && fd.name !== parent?.field.name).slice(0, 3);
  const editable = can(user, 'PATHOLOGIST');
  const render = (fd: any, r: any) => {
    const v = r[fd.name];
    if (fd.type === 'ref') return r[`${fd.name}__label`] || '';
    if (fd.type === 'bool') return v ? 'Yes' : <span className="text-ink-faint"><ReferenceText message="No" /></span>;
    if (fd.type === 'color') return v ? <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-black/20" style={{ background: v }} />{v}</span> : '';
    if (fd.type === 'select') return v ? (String(v).length <= 3 ? v : String(v).replace(/_/g, ' ').toLowerCase()) : '';
    if (typeof v === 'string' && v.length > 80) return <span title={v}>{v.slice(0, 80)}…</span>;
    return v ?? '';
  };
  return (
    <>
      <div className="mb-1 text-sm"><Link href="/masters" className="text-ink-soft hover:text-ink"><ReferenceText message="Master data" /></Link> <span className="text-ink-faint">/ {e.group}</span></div>
      <PageHeader title={e.label} subtitle={e.description}
        actions={editable && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit(parent ? { [parent.field.name]: Number(parent.value) } : {})}><ReferenceText message="Add" /> {e.label.toLowerCase().replace(/s$/, '')}</Button>} />
      <ErrorBanner error={error} onRetry={reload} />
      <div className="panel">
        <FilterBar>
          <SearchBox className="w-64" value={f.q} onChange={(q) => set({ q })} placeholder={referenceT("Search {value0}", {value0: e.label.toLowerCase()})} />
          {parent && (
            <span className="inline-flex h-8 items-center gap-1 self-end rounded-md bg-hema-50 px-2 text-sm text-hema-700">
              <ReferenceText message={parent.field.label} />: <b>{parentLabel || parent.value}</b>
              <DiagnosticButton aria-label={referenceT("Clear filter")} onClick={() => router.push(`/masters/${key}`)} className="rounded p-0.5 hover:bg-hema-100"><X className="h-3.5 w-3.5" /></DiagnosticButton>
            </span>
          )}
          {filterable.map((fd: any) => (
            <FilterItem key={fd.name} label={fd.label}>
              {fd.type === 'ref' ? <RefSelect entity={fd.ref} className="w-44" value={extra[fd.name] || ''} onChange={(v) => { setExtra({ ...extra, [fd.name]: v }); set({}); }} />
                : fd.type === 'bool' ? <Select className="w-24" value={extra[fd.name] || ''} onChange={(v) => { setExtra({ ...extra, [fd.name]: v }); set({}); }} placeholder={referenceT("Any")} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
                : <Select className="w-40" value={extra[fd.name] || ''} onChange={(v) => { setExtra({ ...extra, [fd.name]: v }); set({}); }} placeholder={referenceT("Any")} options={fd.options} />}
            </FilterItem>
          ))}
        </FilterBar>
        <PagedTable result={data} loading={loading} page={f.page} pageSize={f.pageSize} onPage={(page) => set({ page })} onPageSize={(pageSize) => set({ pageSize })}
          sort={f.sort ? { key: f.sort, dir: f.dir as any } : undefined} onSort={(k) => set({ sort: k, dir: f.sort === k && f.dir === 'asc' ? 'desc' : 'asc', page: 1 })}
          onRowClick={(r: any) => setEdit(r)} empty={<div className="p-8 text-center text-sm text-ink-soft"><ReferenceText message="No" /> {e.label.toLowerCase()} <ReferenceText message="yet" />{editable ? '. Use Add to create the first one.' : '.'}</div>}
          columns={[
            ...cols.map((fd: any) => ({ key: fd.name, header: fd.label, sortable: true, render: (r: any) => render(fd, r), className: fd.name === 'code' ? 'font-medium' : undefined })),
            ...(e.children?.length ? [{ key: '__children', header: '', render: (r: any) => (
              <div className="flex flex-wrap gap-2">{e.children.map((c: any) => <Link key={c.key} onClick={(ev) => ev.stopPropagation()} className="link whitespace-nowrap text-xs" href={`/masters/${c.key}?${c.fk}=${r.id}`}><ReferenceText message={c.label} /></Link>)}</div>) }] : []),
          ]} />
      </div>
      {edit && <RecordModal entity={e} record={edit} canEdit={editable} canDelete={can(user)} onClose={() => setEdit(null)}
        onSaved={(msg) => { toast.ok(msg);  reload(); setEdit(null); }} />}
    </>
  );
}

function RecordModal({ entity, record, onClose, onSaved, canEdit, canDelete }: { entity: any; record: any; onClose: () => void; onSaved: (msg: string) => void; canEdit: boolean; canDelete: boolean }) {
 const referenceT = useReferenceLocalization().t;

 const {del,post,put}=useDiagnosticClient();
 const {fmtDateTime}=useDiagnosticFormat();

  const isNew = !record.id;
  const [v, setV] = useState<any>(() => {
    const init: any = {};
    entity.fields.forEach((fd: any) => { init[fd.name] = record[fd.name] ?? (isNew ? fd.default ?? (fd.type === 'bool' ? 0 : '') : fd.type === 'bool' ? 0 : ''); });
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body: any = {};
      entity.fields.forEach((fd: any) => { if (fd.type === 'password' && !v[fd.name]) return; body[fd.name] = v[fd.name] === '' ? null : v[fd.name]; });
      if (isNew) await post(`/masters/${entity.key}`, body); else await put(`/masters/${entity.key}/${record.id}`, body);
      onSaved(isNew ? `${entity.label.replace(/s$/, '')} created.` : 'Changes saved.');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm('Delete this record? Records that are in use cannot be deleted; deactivate them instead.')) return;
    setBusy(true);
    try { await del(`/masters/${entity.key}/${record.id}`); onSaved('Deleted.'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const wide = (fd: any) => ['textarea', 'html'].includes(fd.type);
  return (
    <Modal open onClose={onClose} width="max-w-3xl" title={isNew ? `New ${entity.label.toLowerCase().replace(/s$/, '')}` : `${entity.label}: ${record.code || record.name || record.username || record.lot_no || `#${record.id}`}`}
      footer={<>
        {!isNew && canDelete && <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} onClick={remove} disabled={busy}><ReferenceText message="Delete" /></Button>}
        <Button onClick={onClose}>{canEdit ? 'Cancel' : 'Close'}</Button>
        {canEdit && <Button variant="primary" loading={busy} onClick={save}>{isNew ? 'Create' : 'Save changes'}</Button>}
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {entity.fields.map((fd: any) => {
          const label = `${fd.label}${fd.required ? ' *' : ''}`;
          const set = (x: any) => setV({ ...v, [fd.name]: x });
          const common = { disabled: !canEdit };
          let control: React.ReactNode;
          if (fd.type === 'bool') return <div key={fd.name} className="flex items-end pb-1"><Checkbox checked={!!v[fd.name]} onChange={(x) => set(x ? 1 : 0)} label={fd.label} /></div>;
          if (fd.type === 'ref') control = <RefSelect entity={fd.ref} value={v[fd.name] ?? ''} onChange={(x) => set(x ? Number(x) : '')} placeholder={referenceT("None")} params={{ all: 1 }} {...common} />;
          else if (fd.type === 'select') control = <Select value={v[fd.name] ?? ''} onChange={set} placeholder={fd.required ? undefined : 'None'} options={fd.options} {...common} />;
          else if (fd.type === 'textarea') control = <Textarea value={v[fd.name] ?? ''} onChange={(e) => set(e.target.value)} {...common} />;
          else if (fd.type === 'html') control = <Textarea className="min-h-[110px] font-mono text-xs" value={v[fd.name] ?? ''} onChange={(e) => set(e.target.value)} {...common} />;
          else if (fd.type === 'color') control = <div className="flex gap-2"><DiagnosticInput type="color" className="h-9 w-12 rounded border border-line-strong" value={v[fd.name] || '#cccccc'} onChange={(e) => set(e.target.value)} {...common} /><Input value={v[fd.name] ?? ''} onChange={(e) => set(e.target.value)} {...common} /></div>;
          else if (fd.type === 'date') control = <DateInput value={v[fd.name] ?? ''} onChange={(e) => set(e.target.value)} {...common} />;
          else control = <Input type={fd.type === 'number' ? 'number' : fd.type === 'password' ? 'password' : 'text'} step="any" value={v[fd.name] ?? ''} autoComplete={fd.type === 'password' ? 'new-password' : undefined}
            onChange={(e) => set(fd.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} {...common} />;
          return <Field key={fd.name} label={label} hint={fd.help} className={wide(fd) ? 'sm:col-span-2' : undefined}>{control}</Field>;
        })}
      </div>
      {!isNew && <p className="mt-3 text-2xs text-ink-faint"><ReferenceText message="Created" /> {fmtDateTime(record.created_at)}<ReferenceText message=", updated" /> {fmtDateTime(record.updated_at)}</p>}
      {err && <p className="mt-3 rounded-md bg-crit-bg px-3 py-2 text-sm text-crit">{err}</p>}
    </Modal>
  );
}
