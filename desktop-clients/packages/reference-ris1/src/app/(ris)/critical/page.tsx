'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { useState } from 'react';
import { Phone, CheckCheck, Siren } from 'lucide-react';
import {useApi,useFmt} from '../../../lib/client';
import { PageHeader, StatusBadge, ModalityChip, Empty, Modal, Field, Tabs, useToast } from '../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const SLA: Record<string, number> = { RED: 60, ORANGE: 360, YELLOW: 4320 };
const SEV: Record<string, string> = { RED: 'Red · 1 hour', ORANGE: 'Orange · 6 hours', YELLOW: 'Yellow · 3 days' };

export default function Critical() {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api}=useDiagnosticClient();

  const [tab, setTab] = useState<'open' | 'done'>('open');
  const { data, reload } = useApi<any[]>('/api/critical', { poll: 15000 });
  const toast = useToast();
  const [comm, setComm] = useState<any>(null);
  const [form, setForm] = useState({ communicated_to: '', method: 'PHONE', readback: true, notes: '' });

  const rows = (data || []).filter((c) => (tab === 'open' ? c.status !== 'ACKNOWLEDGED' : c.status === 'ACKNOWLEDGED'));
  const open = (data || []).filter((c) => c.status !== 'ACKNOWLEDGED').length;

  const submit = async () => {
    try {
      await api(`/api/critical/${comm.id}`, { method: 'PATCH', json: form });
      toast('ok', `Communication with ${form.communicated_to} recorded`);
      setComm(null); reload();
    } catch (e: any) { toast('error', e.message); }
  };
  const ack = async (c: any) => {
    try { await api(`/api/critical/${c.id}`, { method: 'PATCH', json: { action: 'acknowledge' } }); toast('ok', 'Critical result closed'); reload(); } catch (e: any) { toast('error', e.message); }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={referenceT("Critical results")} subtitle={referenceT("Findings flagged at sign-off must be communicated directly to a responsible clinician, read back and closed within the time for their urgency.")} />
      <div className="panel">
        <div className="px-3 pt-2"><Tabs value={tab} onChange={setTab} items={[{ value: 'open', label: <><ReferenceText message="Open" /> <span className="ml-1 rounded bg-crit-bg px-1.5 text-crit">{open}</span></> }, { value: 'done', label: 'Closed' }]} /></div>
        {data && !rows.length && <Empty title={tab === 'open' ? 'No critical results waiting' : 'No closed critical results'} />}
        <ul>
          {rows.map((c) => {
            const mins = (Date.now() - new Date(c.flagged_at).getTime()) / 60000;
            const commMins = c.communicated_at ? (new Date(c.communicated_at).getTime() - new Date(c.flagged_at).getTime()) / 60000 : null;
            const late = c.status === 'OPEN' && mins > SLA[c.severity];
            return (
              <li key={c.id} className={`flex flex-wrap items-start gap-4 border-b border-line/70 px-4 py-3.5 ${late ? 'bg-crit-bg/50' : ''}`}>
                <Siren size={22} className={`mt-0.5 shrink-0 ${c.status === 'ACKNOWLEDGED' ? 'text-ink-soft' : 'text-crit'}`} />
                <div className="min-w-[260px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[16px]">{c.category}</b><StatusBadge status={c.status} />
                    <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${c.severity === 'RED' ? 'bg-stat text-white' : c.severity === 'ORANGE' ? 'bg-urgent-bg text-urgent' : 'bg-paper text-ink-3'}`}>{SEV[c.severity]}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-3">{c.finding}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <Link href={`/reading/${c.order_id}`} className="font-bold hover:underline">{fmt.name(c)}</Link>
                    <span className="id text-ink-soft">{c.mrn}</span><ModalityChip code={c.modality_code} /><span>{c.procedure_name}</span><span className="id text-ink-soft">{c.accession}</span>
                  </div>
                </div>
                <div className="w-64 text-sm">
                  <div><ReferenceText message="Flagged by" /> <b>{c.flagged_by_name}</b></div>
                  <div className="text-ink-soft">{fmt.dateTime(c.flagged_at)}</div>
                  {c.status === 'OPEN' && <div className={`font-bold ${late ? 'text-crit' : 'text-urgent'}`}>{late ? `Overdue by ${fmt.minutes(mins - SLA[c.severity])}` : `${fmt.minutes(SLA[c.severity] - mins)} left to communicate`}</div>}
                  {c.communicated_to && <div className="mt-1"><ReferenceText message="Told" /> <b>{c.communicated_to}</b> <ReferenceText message="by" /> {c.method?.toLowerCase().replace('_', ' ')}{c.readback ? ', read back' : ''}<div className="text-ink-soft"><ReferenceText message="after" /> {fmt.minutes(commMins)} · {c.communicated_by_name}</div></div>}
                </div>
                <div className="flex w-40 flex-col gap-1.5">
                  {c.status === 'OPEN' && <DiagnosticButton className="btn-primary" onClick={() => { setComm(c); setForm({ communicated_to: c.referrer_name || '', method: 'PHONE', readback: true, notes: '' }); }}><Phone size={15} /><ReferenceText message="Record call" /></DiagnosticButton>}
                  {c.status === 'COMMUNICATED' && <DiagnosticButton className="btn-primary" onClick={() => ack(c)}><CheckCheck size={15} /><ReferenceText message="Close" /></DiagnosticButton>}
                  {c.referrer_phone && c.status === 'OPEN' && <a href={`tel:${c.referrer_phone}`} className="text-center text-xs text-petrol hover:underline">{c.referrer_phone}</a>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {comm && (
        <Modal open onClose={() => setComm(null)} title={referenceT("Record communication")}
          footer={<><DiagnosticButton className="btn-secondary" onClick={() => setComm(null)}><ReferenceText message="Cancel" /></DiagnosticButton><DiagnosticButton className="btn-primary" disabled={!form.communicated_to.trim()} onClick={submit}><ReferenceText message="Save" /></DiagnosticButton></>}>
          <p className="mb-3 rounded-md bg-crit-bg px-3 py-2 text-sm"><b className="text-crit">{comm.category}</b>: {comm.finding}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={referenceT("Communicated to")} className="col-span-2"><DiagnosticInput className="field" value={form.communicated_to} onChange={(e) => setForm({ ...form, communicated_to: e.target.value })} autoFocus /></Field>
            <Field label={referenceT("Method")}>
              <DiagnosticSelect className="field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="PHONE"><ReferenceText message="Phone" /></option><option value="IN_PERSON"><ReferenceText message="In person" /></option><option value="PAGER"><ReferenceText message="Pager call-back" /></option><option value="SECURE_MESSAGE"><ReferenceText message="Secure message" /></option>
              </DiagnosticSelect>
            </Field>
            <label className="mt-6 flex items-center gap-2 text-sm font-bold"><DiagnosticInput type="checkbox" className="accent-petrol" checked={form.readback} onChange={(e) => setForm({ ...form, readback: e.target.checked })} /><ReferenceText message="Result read back" /></label>
            <Field label={referenceT("Notes")} className="col-span-2"><DiagnosticTextarea className="field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={referenceT("Plan agreed, who will act on it")} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
