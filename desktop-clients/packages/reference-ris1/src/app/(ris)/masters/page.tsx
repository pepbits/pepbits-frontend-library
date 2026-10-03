'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticSelect,DiagnosticTable,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useMemo, useState } from 'react';
import { Plus, Pencil, Search } from 'lucide-react';
import {useApi,useFmt} from '../../../lib/client';
import { PageHeader, Tabs, Modal, Field, useToast, useSession, ModalityChip, Empty, ROLE_LABEL } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'select' | 'textarea' | 'check' | 'events'; options?: [string, string][] | 'modalities' | 'modalities*' | 'modalities?'; wide?: boolean; rows?: number; hint?: string };
type EntityDef = { key: string; label: string; singular: string; fields: FieldDef[]; columns: { key: string; label: string; render?: (r: any) => React.ReactNode }[]; blurb: string };

const EVENTS = ['ORDER_NEW', 'ORDER_UPDATE', 'ORDER_CANCEL', 'EXAM_COMPLETE', 'REPORT_PRELIM', 'REPORT_FINAL', 'REPORT_CORRECTED', 'STUDY_ROUTE'];
const active = { key: 'active', label: 'Active', type: 'check' as const };
const activeCol = { key: 'active', label: 'Status', render: (r: any) => r.active ? <span className="text-xs font-bold text-ok"><ReferenceText message="Active" /></span> : <span className="text-xs text-ink-soft"><ReferenceText message="Inactive" /></span> };

const entities = (fmt:ReturnType<typeof useFmt>): EntityDef[] => [
  {
    key: 'modalities', label: 'Modalities', singular: 'modality', blurb: 'Imaging rooms and devices. The AE title is used for the modality worklist and to recognise images sent by the device.',
    fields: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'ae_title', label: 'AE title' }, { key: 'room', label: 'Room' }, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'daily_capacity', label: 'Daily capacity', type: 'number' }, active],
    columns: [{ key: 'code', label: 'Code', render: (r) => <ModalityChip code={r.code} /> }, { key: 'name', label: 'Name' }, { key: 'ae_title', label: 'AE title', render: (r) => <span className="id">{r.ae_title}</span> }, { key: 'room', label: 'Room' }, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'daily_capacity', label: 'Capacity/day' }, activeCol],
  },
  {
    key: 'procedures', label: 'Procedures', singular: 'procedure', blurb: 'The test master. Price feeds billing; codes are validated on inbound HL7 and FHIR orders.',
    fields: [{ key: 'code', label: 'Code', hint: 'Used in OBR-4 of inbound orders' }, { key: 'name', label: 'Name' }, { key: 'modality_code', label: 'Modality', type: 'select', options: 'modalities' }, { key: 'body_part', label: 'Body part' }, { key: 'cpt', label: 'CPT / billing code' }, { key: 'price', label: 'Price', type: 'number' }, { key: 'duration_min', label: 'Slot length (min)', type: 'number' }, { key: 'contrast', label: 'Uses contrast', type: 'check' }, { key: 'prep', label: 'Patient preparation', type: 'textarea', wide: true, rows: 2 }, active],
    columns: [{ key: 'code', label: 'Code', render: (r) => <span className="id">{r.code}</span> }, { key: 'name', label: 'Name' }, { key: 'modality_code', label: 'Modality', render: (r) => <ModalityChip code={r.modality_code} /> }, { key: 'cpt', label: 'CPT' }, { key: 'price', label: 'Price', render: (r) => fmt.money(r.price) }, { key: 'duration_min', label: 'Minutes' }, { key: 'contrast', label: 'Contrast', render: (r) => (r.contrast ? 'Yes' : '') }, activeCol],
  },
  {
    key: 'templates', label: 'Report templates', singular: 'template', blurb: 'Normal reports, fill-in templates (use ___ for blanks the radiologist jumps to with F2) and short macros.',
    fields: [{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Type', type: 'select', options: [['TEMPLATE', 'Template with blanks'], ['NORMAL', 'Normal report'], ['MACRO', 'Macro (phrase)']] }, { key: 'modality_code', label: 'Modality', type: 'select', options: 'modalities?' }, { key: 'body_part', label: 'Body part' }, { key: 'technique', label: 'Technique', type: 'textarea', wide: true, rows: 2 }, { key: 'findings', label: 'Findings', type: 'textarea', wide: true, rows: 8 }, { key: 'impression', label: 'Impression', type: 'textarea', wide: true, rows: 3 }, active],
    columns: [{ key: 'name', label: 'Name' }, { key: 'kind', label: 'Type', render: (r) => fmt.status(r.kind) }, { key: 'modality_code', label: 'Modality', render: (r) => (r.modality_code ? <ModalityChip code={r.modality_code} /> : 'Any') }, { key: 'body_part', label: 'Body part' }, { key: 'impression', label: 'Impression', render: (r) => <span className="line-clamp-1 max-w-sm text-ink-3">{r.impression}</span> }, activeCol],
  },
  {
    key: 'tat_rules', label: 'TAT targets', singular: 'TAT rule', blurb: 'Report turnaround targets from exam completion to final signature. A modality-specific rule overrides the * rule for that priority.',
    fields: [{ key: 'priority', label: 'Priority', type: 'select', options: [['STAT', 'STAT'], ['URGENT', 'Urgent'], ['ROUTINE', 'Routine']] }, { key: 'modality_code', label: 'Modality', type: 'select', options: 'modalities*' }, { key: 'target_minutes', label: 'Target (minutes)', type: 'number' }, { key: 'warn_percent', label: 'Warn at (% of target)', type: 'number' }],
    columns: [{ key: 'priority', label: 'Priority' }, { key: 'modality_code', label: 'Modality', render: (r) => (r.modality_code === '*' ? 'All modalities' : <ModalityChip code={r.modality_code} />) }, { key: 'target_minutes', label: 'Target', render: (r) => fmt.minutes(r.target_minutes) }, { key: 'warn_percent', label: 'Warn at', render: (r) => `${r.warn_percent}%` }],
  },
  {
    key: 'referrers', label: 'Referring doctors', singular: 'referrer', blurb: 'Referring physicians. Inbound HL7 orders add unknown referrers automatically.',
    fields: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'specialty', label: 'Specialty' }, { key: 'facility', label: 'Facility' }, { key: 'phone', label: 'Phone', hint: 'Used for critical result calls' }, { key: 'email', label: 'Email' }, active],
    columns: [{ key: 'code', label: 'Code', render: (r) => <span className="id">{r.code}</span> }, { key: 'name', label: 'Name' }, { key: 'specialty', label: 'Specialty' }, { key: 'facility', label: 'Facility' }, { key: 'phone', label: 'Phone' }, activeCol],
  },
  {
    key: 'users', label: 'Staff', singular: 'staff member', blurb: 'Radiologists, residents, technologists, front desk and billing staff. The role controls what each person can sign or change.',
    fields: [{ key: 'username', label: 'Username' }, { key: 'name', label: 'Full name' }, { key: 'role', label: 'Role', type: 'select', options: Object.entries(ROLE_LABEL) as [string, string][] }, { key: 'title', label: 'Title / qualification' }, { key: 'license_no', label: 'Registration no.' }, { key: 'modalities', label: 'Modalities', hint: 'Comma separated, e.g. CT,MR' }, { key: 'phone', label: 'Phone' }, { key: 'signature', label: 'Signature line', wide: true, hint: 'Printed under signed reports' }, active],
    columns: [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role', render: (r) => ROLE_LABEL[r.role] || r.role }, { key: 'title', label: 'Title' }, { key: 'license_no', label: 'Registration' }, { key: 'modalities', label: 'Modalities' }, activeCol],
  },
  {
    key: 'interfaces', label: 'Interfaces', singular: 'interface', blurb: 'Connections to HIS, EMR, other PACS and FHIR servers. Outbound interfaces receive the events ticked here.',
    fields: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type', type: 'select', options: [['HL7_MLLP', 'HL7 v2 over MLLP'], ['HL7_HTTP', 'HL7 v2 over HTTP'], ['FHIR', 'FHIR R4 REST'], ['DICOM', 'DICOM C-STORE']] }, { key: 'direction', label: 'Direction', type: 'select', options: [['OUT', 'Outbound'], ['IN', 'Inbound']] }, { key: 'facility', label: 'Facility / application' }, { key: 'host', label: 'Host' }, { key: 'port', label: 'Port', type: 'number' }, { key: 'url', label: 'URL', wide: true }, { key: 'ae_title', label: 'Remote AE title' }, { key: 'events', label: 'Events sent', type: 'events', wide: true }, active],
    columns: [{ key: 'name', label: 'Name' }, { key: 'type', label: 'Type' }, { key: 'direction', label: 'Direction', render: (r) => (r.direction === 'IN' ? 'Inbound' : 'Outbound') }, { key: 'host', label: 'Endpoint', render: (r) => <span className="id">{r.url || `${r.ae_title ? r.ae_title + '@' : ''}${r.host || ''}:${r.port || ''}`}</span> }, { key: 'events', label: 'Events', render: (r) => <span className="text-xs text-ink-soft">{(r.events || '').split(',').filter(Boolean).length || 0} <ReferenceText message="events" /></span> }, activeCol],
  },
];

export default function Masters() {
 const fmt=useFmt();
 const ENTITIES=entities(fmt);
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();

  const [key, setKey] = useState('modalities');
  const def = ENTITIES.find((e) => e.key === key)!;
  const { data, reload } = useApi<any[]>(`/api/masters/${key}`);
  const { data: mods } = useApi<any[]>('/api/masters/modalities');
  const { user } = useSession();
  const toast = useToast();
  const [edit, setEdit] = useState<any>(null);
  const [q, setQ] = useState('');
  const admin = user?.role === 'ADMIN';

  const rows = useMemo(() => (data || []).filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [data, q]);

  const opts = (o: FieldDef['options']): [string, string][] => {
    const m = (mods || []).map((x) => [x.code, `${x.code} · ${x.name}`] as [string, string]);
    if (o === 'modalities') return m;
    if (o === 'modalities*') return [['*', 'All modalities'], ...m];
    if (o === 'modalities?') return [['', 'Any modality'], ...m];
    return o || [];
  };

  const save = async () => {
    const body: any = {};
    for (const f of def.fields) {
      let v = edit[f.key];
      if (f.type === 'number') v = v === '' || v == null ? null : Number(v);
      if (f.type === 'check') v = v ? 1 : 0;
      if (f.key === 'modality_code' && v === '') v = null;
      body[f.key] = v;
    }
    try {
      if (edit.id) await api(`/api/masters/${key}/${edit.id}`, { method: 'PUT', json: body });
      else await api(`/api/masters/${key}`, { method: 'POST', json: body });
      toast('ok', `${def.singular[0].toUpperCase() + def.singular.slice(1)} saved`);
      setEdit(null); reload();
    } catch (e: any) { toast('error', e.message); }
  };
  const remove = async () => {
    if (!confirm(def.fields.some((f) => f.key === 'active') ? `Deactivate this ${def.singular}? Existing records keep their reference.` : `Delete this ${def.singular}?`)) return;
    try { await api(`/api/masters/${key}/${edit.id}`, { method: 'DELETE' }); toast('ok', 'Done'); setEdit(null); reload(); } catch (e: any) { toast('error', e.message); }
  };
  const blank = () => Object.fromEntries(def.fields.map((f) => [f.key, f.type === 'check' ? (f.key === 'active' ? 1 : 0) : f.type === 'select' ? opts(f.options)[0]?.[0] ?? '' : f.key === 'warn_percent' ? 75 : '']));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Masters")} subtitle={referenceT("Reference data that drives ordering, billing, reporting, turnaround and integration.")}
        actions={admin ? <DiagnosticButton className="btn-primary" onClick={() => setEdit(blank())}><Plus size={16} /><ReferenceText message="Add" /> {def.singular}</DiagnosticButton> : <span className="text-sm text-ink-soft"><ReferenceText message="Switch to the administrator to make changes" /></span>} />
      <div className="panel">
        <div className="overflow-x-auto px-3 pt-1"><Tabs value={key} onChange={(k) => { setKey(k); setQ(''); }} items={ENTITIES.map((e) => ({ value: e.key, label: e.label }))} /></div>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <p className="flex-1 text-sm text-ink-soft">{def.blurb}</p>
          <div className="relative w-64"><Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" /><DiagnosticInput className="field pl-9" placeholder={referenceT("Filter")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Filter")} /></div>
        </div>
        <div className="overflow-x-auto">
          <DiagnosticTable className="table-base">
            <TableHeader><TableRow>{def.columns.map((c) => <TableHead key={c.key}><ReferenceText message={c.label} /></TableHead>)}<TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.active === 0 ? 'opacity-55' : ''}>
                  {def.columns.map((c) => <TableCell key={c.key}>{c.render ? c.render(r) : r[c.key] ?? '—'}</TableCell>)}
                  <TableCell className="text-right">{admin && <DiagnosticButton className="btn-ghost btn-sm" onClick={() => setEdit({ ...r })} aria-label={referenceT("Edit")}><Pencil size={14} /></DiagnosticButton>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DiagnosticTable>
          {data && !rows.length && <Empty title={referenceT("Nothing here yet")} />}
        </div>
      </div>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={referenceT("{value0} {value1}", {value0: edit.id ? 'Edit' : 'Add', value1: def.singular})} width={key === 'templates' ? 'max-w-3xl' : 'max-w-2xl'}
          footer={<>{edit.id && <DiagnosticButton className="btn-danger mr-auto" onClick={remove}>{def.fields.some((f) => f.key === 'active') ? 'Deactivate' : 'Delete'}</DiagnosticButton>}<DiagnosticButton className="btn-secondary" onClick={() => setEdit(null)}><ReferenceText message="Cancel" /></DiagnosticButton><DiagnosticButton className="btn-primary" onClick={save}><ReferenceText message="Save" /></DiagnosticButton></>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {def.fields.map((f) => {
              const v = edit[f.key] ?? '';
              const upd = (val: any) => setEdit({ ...edit, [f.key]: val });
              if (f.type === 'check') return <label key={f.key} className="flex items-center gap-2 text-sm font-bold sm:col-span-2"><DiagnosticInput type="checkbox" className="accent-petrol" checked={!!edit[f.key]} onChange={(e) => upd(e.target.checked ? 1 : 0)} /><ReferenceText message={f.label} /></label>;
              if (f.type === 'events') {
                const cur = String(v).split(',').filter(Boolean);
                return (
                  <Field key={f.key} label={f.label} className="sm:col-span-2">
                    <div className="grid grid-cols-2 gap-1.5 rounded-md border border-line p-2 text-sm">
                      {EVENTS.map((ev) => <label key={ev} className="flex items-center gap-2"><DiagnosticInput type="checkbox" className="accent-petrol" checked={cur.includes(ev)} onChange={(e) => upd((e.target.checked ? [...cur, ev] : cur.filter((x) => x !== ev)).join(','))} /><span className="id">{ev}</span></label>)}
                    </div>
                  </Field>
                );
              }
              return (
                <Field key={f.key} label={f.label} hint={f.hint} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  {f.type === 'select' ? (
                    <DiagnosticSelect className="field" value={v ?? ''} onChange={(e) => upd(e.target.value)}>{opts(f.options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</DiagnosticSelect>
                  ) : f.type === 'textarea' ? (
                    <DiagnosticTextarea className="field font-sans" rows={f.rows || 3} value={v} onChange={(e) => upd(e.target.value)} />
                  ) : (
                    <DiagnosticInput className="field" type={f.type === 'number' ? 'number' : 'text'} value={v} onChange={(e) => upd(e.target.value)} />
                  )}
                </Field>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
