'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useMemo, useState } from 'react';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import {useParams} from '@pepbits/reference-diagnostics';
import { ChevronLeft, Copy, Eye, EyeOff, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { useAuth } from '../../../../lib/auth';
import { useApi, useCurrency, useDebounced, useMaster } from '../../../../lib/hooks';
import { FieldDef, masterBySlug, MasterDef } from '../../../../lib/masters';
import {cls} from '../../../../lib/format';
import { Badge, Button, Card, Checkbox, Empty, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Textarea, TubeChip, useToast } from '../../../../components/ui';
import { PrintableReport } from '../../../../components/PrintableReport';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Loads each relation master referenced by the config once. */
function useRelations(def?: MasterDef) {
  const slugs = useMemo(() => {
    if (!def) return [];
    return [...new Set([...def.fields.map((f) => f.rel), ...def.columns.map((c) => c.rel), def.filter?.rel].filter(Boolean) as string[])];
  }, [def]);
  const lists: Record<string, any[]> = {};
  // hooks are called in a stable order because the slug list only depends on the static config
  // eslint-disable-next-line react-hooks/rules-of-hooks
  for (let i = 0; i < 12; i++) lists[slugs[i] ?? `__none${i}`] = useMaster(slugs[i] ?? null);
  return lists;
}

function RelationSelect({ f, value, onChange, rows }: { f: FieldDef; value: any; onChange: (v: any) => void; rows: any[] }) {
  const vk = f.relValue || 'id';
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : vk === 'id' ? Number(e.target.value) : e.target.value)} placeholder={f.required ? 'Select…' : 'None'}
      options={[...(f.extraOptions || []), ...rows.filter((r) => r.active !== false || r[vk] === value).map((r) => ({ value: r[vk], label: f.relLabel ? f.relLabel(r) : r.name ?? r.code }))]} />
  );
}

function MultiRelation({ f, value, onChange, rows }: { f: FieldDef; value: number[]; onChange: (v: number[]) => void; rows: any[] }) {
 const referenceT = useReferenceLocalization().t;

  const [q, setQ] = useState('');
  const sel: number[] = value || [];
  const list = rows.filter((r) => r.active !== false && !sel.includes(r.id) && (!q || (f.relLabel?.(r) ?? r.name).toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="rounded border border-line-strong p-2">
      <div className="mb-2 flex flex-wrap gap-1">
        {sel.length === 0 && <span className="text-xs text-ink-mute"><ReferenceText message="None selected" /></span>}
        {sel.map((id) => { const r = rows.find((x) => x.id === id); return (
          <span key={id} className="inline-flex items-center gap-1 rounded border border-lab-100 bg-lab-50 px-1.5 py-0.5 text-xs text-lab-800">{r ? f.relLabel?.(r) ?? r.name : id}
            <DiagnosticButton type="button" onClick={() => onChange(sel.filter((x) => x !== id))}><X className="h-3 w-3" /></DiagnosticButton></span>
        ); })}
      </div>
      <Input placeholder={referenceT("Search to add")} value={q} onChange={(e) => setQ(e.target.value)} />
      {q && <div className="mt-1 max-h-40 overflow-y-auto rounded border border-line">{list.slice(0, 30).map((r) => (
        <DiagnosticButton type="button" key={r.id} onClick={() => { onChange([...sel, r.id]); setQ(''); }} className="block w-full px-2 py-1 text-left text-sm hover:bg-lab-50">{f.relLabel?.(r) ?? r.name}</DiagnosticButton>
      ))}</div>}
    </div>
  );
}

function Secret({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const toast = useToast();
  const gen = () => onChange(Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join(''));
  return (
    <div className="flex gap-1">
      <Input type={show ? 'text' : 'password'} className="font-mono" value={value ?? ''} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      <Button type="button" variant="ghost" icon={show ? EyeOff : Eye} onClick={() => setShow(!show)} />
      <Button type="button" variant="ghost" icon={Copy} onClick={() => { navigator.clipboard?.writeText(value || ''); toast.info('Copied'); }} />
      <Button type="button" size="sm" onClick={gen}><ReferenceText message="Generate" /></Button>
    </div>
  );
}

const SAMPLE_REPORT = {
  lab: { name: 'Your Laboratory', address: '1 Example Street', phone: '000', email: 'lab@example.org', accreditation: 'Accreditation no.' },
  report: { reportNo: 'RPT0000001', version: 1, status: 'FINAL', lastReleasedAt: new Date().toISOString() },
  order: { orderNo: 'ORD0000001', createdAt: new Date().toISOString() },
  patient: { fullName: 'Sample Patient', mrn: 'MRN0000001', gender: 'F', age: '41 Y', dob: '1985-04-12' },
  doctor: { name: 'Dr Example' },
  samples: [{ sampleNo: 'S0000001', collectedAt: new Date().toISOString() }],
  departments: [{ id: 1, name: 'Clinical Biochemistry', tests: [{ orderTestId: 1, name: 'Lipid profile', method: 'Enzymatic', sampleType: 'Serum', interpretation: 'Fasting sample preferred.', validatedByName: 'Tech', signedByName: 'Dr Pathologist', signedAt: new Date().toISOString(), rows: [
    { name: 'Total cholesterol', value: '240', unit: 'mg/dL', flag: 'H', referenceText: '< 200', method: 'CHOD-PAP', loinc: '2093-3' },
    { name: 'HDL cholesterol', value: '45', unit: 'mg/dL', flag: '', referenceText: '> 40', method: 'Direct', loinc: '2085-9' },
    { name: 'Potassium', value: '6.8', unit: 'mmol/L', flag: 'HH', referenceText: '3.5 – 5.1', method: 'ISE', loinc: '2823-3' },
  ] }] }],
  pending: [], signers: [{ fullName: 'Dr Pathologist', qualification: 'MD', signatureText: 'Dr P' }], addenda: [], amendments: [],
};

export default function MasterPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {money}=useDiagnosticFormat();

  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const def = masterBySlug(slug);
  const { can } = useAuth();
  const toast = useToast();
  const currency = useCurrency();
  const rel = useRelations(def);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const dq = useDebounced(q);
  const filterVal = def?.filter ? sp.get(def.filter.key) || '' : '';
  const { data, error, loading, reload } = useApi<any[]>(def ? `/masters/${slug}` : null, { q: dq, ...(def?.filter && filterVal ? { [def.filter.key]: filterVal } : {}) });
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setEdit(null); setQ(''); }, [slug]);
  if (!def) return <Empty title={referenceT("Unknown master")} hint={<Link className="text-lab-700" href="/masters"><ReferenceText message="Back to masters" /></Link>} />;
  const writable = can(...(def.writeRoles || []));

  const startNew = () => {
    const f: any = {};
    for (const fd of def.fields) if (fd.default !== undefined) f[fd.key] = fd.default;
    if (def.filter && filterVal) f[def.filter.key] = Number(filterVal);
    if (def.hasActive) f.active = true;
    setErr(null); setEdit(f);
  };
  const save = async () => {
    for (const fd of def.fields) {
      if (fd.when && !fd.when(edit)) continue;
      const v = edit[fd.key];
      if (fd.required && (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length))) return setErr(`${fd.label} is required.`);
    }
    const body: any = {};
    for (const fd of def.fields) {
      let v = edit[fd.key];
      if (fd.type === 'number') v = v === '' || v === undefined || v === null ? null : Number(v);
      if (v !== undefined) body[fd.key] = v;
    }
    if (def.hasActive) body.active = edit.active !== false;
    setBusy(true); setErr(null);
    try {
      if (edit.id) await api.put(`/masters/${slug}/${edit.id}`, body); else await api.post(`/masters/${slug}`, body);
      
      toast.ok(`${def.title}: saved`);
      setEdit(null); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async (row: any) => {
    if (!confirm('Delete this record? If it is in use, deactivate it instead.')) return;
    try { await api.del(`/masters/${slug}/${row.id}`);  toast.ok('Deleted'); reload(); } catch (e: any) { toast.err(e.message); }
  };
  const toggleActive = async (row: any) => {
    try { await api.put(`/masters/${slug}/${row.id}`, { active: !row.active });  reload(); } catch (e: any) { toast.err(e.message); }
  };

  const relText = (slugName: string | undefined, id: any, label?: (r: any) => string, vk = 'id') => {
    const rows = rel[slugName || ''] || [];
    const one = (x: any) => { const r = rows.find((y) => y[vk] === x); return r ? (label ? label(r) : r.name ?? r.code) : x ?? '—'; };
    return Array.isArray(id) ? id.map(one).join(', ') : one(id);
  };
  const rows = (data || []).filter((r) => showInactive || r.active !== false);

  // group fields into sections for the form
  const sections: { title: string; fields: FieldDef[] }[] = [];
  for (const f of def.fields) {
    if (f.section || !sections.length) sections.push({ title: f.section || '', fields: [] });
    sections[sections.length - 1].fields.push(f);
  }

  return (
    <div>
      <Link href="/masters" className="no-print mb-1 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-lab-700"><ChevronLeft className="h-3 w-3" /><ReferenceText message="Masters" /></Link>
      <PageHeader title={def.title} subtitle={def.description}
        actions={writable && <Button variant="primary" icon={Plus} onClick={startNew}><ReferenceText message="Add" /></Button>} />
      <ErrorNote error={error} />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative w-64"><Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" /><Input className="pl-8" placeholder={referenceT("Search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {def.filter && (
            <Select className="w-72" value={filterVal} placeholder={referenceT("All {value0}s", {value0: def.filter.label.toLowerCase()})}
              onChange={(e) => router.replace(`/masters/${slug}${e.target.value ? `?${def.filter!.key}=${e.target.value}` : ''}`)}
              options={(rel[def.filter.rel] || []).map((r) => ({ value: r.id, label: def.filter!.relLabel ? def.filter!.relLabel(r) : r.name }))} />
          )}
          {def.hasActive && <Checkbox label={referenceT("Show inactive")} checked={showInactive} onChange={setShowInactive} />}
          <span className="ml-auto text-xs text-ink-mute">{rows.length} <ReferenceText message="record(s)" /></span>
        </div>
        {loading && !data ? <Loading /> : !rows.length ? <Empty title={referenceT("No records")} hint={writable ? 'Use Add to create the first one.' : undefined} /> : (
          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <DiagnosticTable className="tbl">
              <TableHeader><TableRow>{def.columns.map((c) => <TableHead key={c.key}><ReferenceText message={c.label} /></TableHead>)}{def.hasActive && <TableHead><ReferenceText message="Status" /></TableHead>}<TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={cls(r.active === false && 'opacity-55')}>
                    {def.columns.map((c) => {
                      const v = r[c.key];
                      let out: React.ReactNode = v ?? '—';
                      if (c.render === 'bool') out = v ? 'Yes' : '—';
                      else if (c.render === 'color') out = <TubeChip color={v} />;
                      else if (c.render === 'rel') out = relText(c.rel, v, c.relLabel, c.relValue);
                      else if (c.render === 'money') out = money(v, currency);
                      else if (c.render === 'mono') out = <span className="font-mono text-xs">{v ?? '—'}</span>;
                      else if (c.render === 'range') out = `${r.ageMin ?? 0}–${r.ageMax ?? '∞'} ${String(r.ageUnit || '').toLowerCase()}`;
                      return <TableCell key={c.key} className="max-w-xs truncate">{out}</TableCell>;
                    })}
                    {def.hasActive && <TableCell><Badge value={r.active ? 'SUCCESS' : 'CANCELLED'} label={r.active ? 'Active' : 'Inactive'} /></TableCell>}
                    <TableCell className="whitespace-nowrap text-right">
                      {def.links?.map((l) => <Link key={l.label} href={l.href(r)} className="mr-2 text-xs text-lab-700 hover:underline"><ReferenceText message={l.label} /></Link>)}
                      {writable && <>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => { setErr(null); setEdit({ ...r }); }}><ReferenceText message="Edit" /></Button>
                        {def.hasActive && <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>{r.active ? 'Deactivate' : 'Activate'}</Button>}
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(r)} aria-label={referenceT("Delete")} />
                      </>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DiagnosticTable>
          </div>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${def.title.toLowerCase()}` : `New ${def.title.toLowerCase()}`} width={slug === 'report-templates' ? 'max-w-7xl' : def.width || 'max-w-2xl'}
        footer={<><Button onClick={() => setEdit(null)}><ReferenceText message="Cancel" /></Button><Button variant="primary" loading={busy} onClick={save}><ReferenceText message="Save" /></Button></>}>
        {edit && (
          <div className={slug === 'report-templates' ? 'grid gap-4 lg:grid-cols-[1fr_1.1fr]' : ''}>
            <div>
              <ErrorNote error={err} />
              {sections.map((s, si) => (
                <div key={si} className="mb-4">
                  {s.title && <div className="mb-2 border-b border-line pb-1 text-xs font-semibold text-ink-soft">{s.title}</div>}
                  <div className="grid grid-cols-3 gap-3">
                    {s.fields.filter((f) => !f.when || f.when(edit)).map((f) => {
                      const v = edit[f.key];
                      const set = (nv: any) => setEdit((e: any) => ({ ...e, [f.key]: nv }));
                      const span = f.span === 3 ? 'col-span-3' : f.span === 2 ? 'col-span-2' : '';
                      if (f.type === 'checkbox') return <div key={f.key} className={cls('flex items-end pb-1.5', span)}><Checkbox label={f.label} checked={!!v} onChange={set} /></div>;
                      return (
                        <Field key={f.key} label={f.label} hint={f.hint} required={f.required} className={span}>
                          {f.type === 'number' ? <Input type="number" step={f.step || '1'} value={v ?? ''} onChange={(e) => set(e.target.value)} />
                            : f.type === 'textarea' ? <Textarea value={v ?? ''} onChange={(e) => set(e.target.value)} />
                            : f.type === 'html' ? <Textarea rows={4} className="font-mono text-xs" value={v ?? ''} onChange={(e) => set(e.target.value)} />
                            : f.type === 'select' ? <Select value={v ?? ''} onChange={(e) => set(e.target.value || null)} placeholder={f.required ? undefined : 'None'} options={f.options || []} />
                            : f.type === 'relation' ? <RelationSelect f={f} value={v} onChange={set} rows={rel[f.rel!] || []} />
                            : f.type === 'multirelation' ? <MultiRelation f={f} value={v} onChange={set} rows={rel[f.rel!] || []} />
                            : f.type === 'color' ? <div className="flex items-center gap-2"><DiagnosticInput type="color" className="h-8 w-10 rounded border border-line-strong" value={v || '#9ca3af'} onChange={(e) => set(e.target.value)} /><Input className="font-mono" value={v ?? ''} onChange={(e) => set(e.target.value)} /></div>
                            : f.type === 'secret' ? <Secret value={v} onChange={set} />
                            : <Input value={v ?? ''} onChange={(e) => set(e.target.value)} />}
                        </Field>
                      );
                    })}
                  </div>
                </div>
              ))}
              {def.hasActive && <Checkbox label={referenceT("Active")} checked={edit.active !== false} onChange={(v) => setEdit({ ...edit, active: v })} />}
            </div>
            {slug === 'report-templates' && (
              <div>
                <div className="mb-1 text-xs font-semibold text-ink-soft"><ReferenceText message="Live preview (sample data)" /></div>
                <div className="max-h-[62vh] overflow-auto rounded border border-line bg-[#E9ECEF] p-2">
                  <div style={{ zoom: 0.72 }}><PrintableReport r={{ ...SAMPLE_REPORT, template: edit }} /></div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
