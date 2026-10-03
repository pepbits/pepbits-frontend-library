'use client';
import {DiagnosticButton,DiagnosticInput,DiagnosticTextarea,DiagnosticSelect} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, X, AlertTriangle } from 'lucide-react';
import {useFmt,toLocalInput,useApi} from '../lib/client';
import { Field, Modal, ModalityChip, useToast } from './ui';
import PatientForm from './PatientForm';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Order entry: patient, one or more procedures (one accession each), clinical details, schedule and payer. */
export default function NewOrder({ open, onClose, onCreated, patientId }: { open: boolean; onClose: () => void; onCreated: (orders: any[]) => void; patientId?: number }) {
 const referenceT = useReferenceLocalization().t;

 const fmt=useFmt();

 const {api}=useDiagnosticClient();

  const { data: lk } = useApi<any>('/api/lookups');
  const toast = useToast();
  const [patient, setPatient] = useState<any>(null);
  const [pq, setPq] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [register, setRegister] = useState(false);
  const [mod, setMod] = useState('');
  const [procQ, setProcQ] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [f, setF] = useState<any>({ priority: 'ROUTINE', patient_class: 'OP', referrer_id: '', clinical_history: '', reason: '', schedule: false, scheduled_at: toLocalInput(), payer: 'SELF', discount: 0, placer_order_no: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (patientId && open) api(`/api/patients/${patientId}`).then(setPatient); }, [patientId, open]);
  useEffect(() => {
    if (patient || pq.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => api(`/api/patients?q=${encodeURIComponent(pq)}`).then((r) => setMatches(r.slice(0, 8))), 200);
    return () => clearTimeout(t);
  }, [pq, patient]);
  useEffect(() => { if (patient) setF((x: any) => ({ ...x, payer: patient.insurance ? 'INSURANCE' : 'SELF' })); }, [patient]);

  const procs = useMemo(() => (lk?.procedures || []).filter((p: any) =>
    (!mod || p.modality_code === mod) && (!procQ || `${p.name} ${p.code} ${p.cpt}`.toLowerCase().includes(procQ.toLowerCase()))), [lk, mod, procQ]);
  const chosen = (lk?.procedures || []).filter((p: any) => picked.includes(p.id));
  const total = chosen.reduce((s: number, p: any) => s + p.price, 0);
  const needsContrast = chosen.some((p: any) => p.contrast);
  const allergy = patient?.allergies && !/^none/i.test(patient.allergies);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const reset = () => { setPatient(null); setPq(''); setPicked([]); setMod(''); setProcQ(''); };

  const submit = async () => {
    if (!patient) return toast('error', 'Choose or register the patient first');
    if (!picked.length) return toast('error', 'Choose at least one procedure');
    setBusy(true);
    try {
      const orders = await api<any[]>('/api/orders', {
        method: 'POST',
        json: {
          patient_id: patient.id, procedure_ids: picked, priority: f.priority, patient_class: f.patient_class,
          referrer_id: f.referrer_id ? Number(f.referrer_id) : null, clinical_history: f.clinical_history, reason: f.reason,
          scheduled_at: f.schedule ? new Date(f.scheduled_at).toISOString() : null, payer: f.payer,
          discount: Number(f.discount || 0) / Math.max(1, picked.length), placer_order_no: f.placer_order_no || null,
        },
      });
      toast('ok', `Created ${orders.length} order${orders.length > 1 ? 's' : ''}: ${orders.map((o) => o.accession).join(', ')}`);
      reset();
      onCreated(orders);
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal open={open && !register} onClose={onClose} title={referenceT("New imaging order")} width="max-w-4xl"
        footer={<>
          <div className="mr-auto self-center text-sm text-ink-soft">{picked.length ? <>{picked.length} <ReferenceText message="procedure" />{picked.length > 1 ? 's' : ''}<ReferenceText message=", one accession each ·" /> <b className="text-ink">{fmt.money(total - Number(f.discount || 0))}</b></> : 'No procedures chosen'}</div>
          <DiagnosticButton className="btn-secondary" onClick={onClose}><ReferenceText message="Cancel" /></DiagnosticButton>
          <DiagnosticButton className="btn-primary" disabled={busy || !patient || !picked.length} onClick={submit}><ReferenceText message="Place order" /></DiagnosticButton>
        </>}>
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 font-bold"><ReferenceText message="1. Patient" /></h3>
            {patient ? (
              <div className="flex items-center justify-between rounded-md border border-petrol/40 bg-petrol-light/50 px-3 py-2">
                <div>
                  <div className="font-bold">{fmt.name(patient)} <span className="id ml-2 font-normal text-ink-soft">{patient.mrn}</span></div>
                  <div className="text-sm text-ink-soft">{fmt.date(patient.dob)} · {fmt.age(patient.dob)} {patient.sex} · {patient.insurance || 'Self pay'}</div>
                </div>
                {!patientId && <DiagnosticButton className="btn-ghost btn-sm" onClick={() => setPatient(null)}><X size={14} /><ReferenceText message="Change" /></DiagnosticButton>}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-ink-soft" />
                  <DiagnosticInput className="field pl-9" placeholder={referenceT("Search by name, MRN or phone")} value={pq} onChange={(e) => setPq(e.target.value)} autoFocus aria-label={referenceT("Find patient")} />
                  {!!matches.length && (
                    <div className="absolute left-0 right-0 top-10 z-10 rounded-md border border-line bg-white shadow-lg">
                      {matches.map((m) => (
                        <DiagnosticButton key={m.id} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-petrol-light" onClick={() => setPatient(m)}>
                          <span><b>{fmt.name(m)}</b> · {fmt.date(m.dob)}</span><span className="id text-ink-soft">{m.mrn}</span>
                        </DiagnosticButton>
                      ))}
                    </div>
                  )}
                </div>
                <DiagnosticButton className="btn-secondary" onClick={() => setRegister(true)}><UserPlus size={16} /><ReferenceText message="New patient" /></DiagnosticButton>
              </div>
            )}
            {allergy && <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-stat"><AlertTriangle size={15} /><ReferenceText message="Allergy recorded:" /> {patient.allergies}</p>}
          </section>

          <section>
            <h3 className="mb-2 font-bold"><ReferenceText message="2. Procedures" /></h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <DiagnosticButton className={`btn-sm rounded-full border px-3 ${!mod ? 'border-petrol bg-petrol text-white' : 'border-line bg-white'}`} onClick={() => setMod('')}><ReferenceText message="All" /></DiagnosticButton>
              {(lk?.modalities || []).map((m: any) => (
                <DiagnosticButton key={m.code} className={`btn-sm rounded-full border px-3 font-bold ${mod === m.code ? 'border-petrol bg-petrol text-white' : 'border-line bg-white text-ink-3'}`} onClick={() => setMod(m.code)} title={m.name}>{m.code}</DiagnosticButton>
              ))}
              <DiagnosticInput className="field ml-auto h-7 w-56 text-xs" placeholder={referenceT("Filter by name, code or CPT")} value={procQ} onChange={(e) => setProcQ(e.target.value)} aria-label={referenceT("Filter procedures")} />
            </div>
            <div className="scroll-thin grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-line p-1.5 sm:grid-cols-2">
              {procs.map((p: any) => {
                const on = picked.includes(p.id);
                return (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${on ? 'bg-petrol-light' : 'hover:bg-paper'}`}>
                    <DiagnosticInput type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])} className="accent-petrol" />
                    <ModalityChip code={p.modality_code} />
                    <span className="flex-1 truncate">{p.name}{p.contrast ? <span className="ml-1 text-xs font-bold text-urgent"><ReferenceText message="contrast" /></span> : null}</span>
                    <span className="text-xs tabular-nums text-ink-soft">{fmt.money(p.price)}</span>
                  </label>
                );
              })}
            </div>
            {chosen.filter((p: any) => p.prep).map((p: any) => (
              <p key={p.id} className="mt-1.5 text-sm text-ink-3"><b>{p.name}:</b> {p.prep}</p>
            ))}
            {needsContrast && allergy && <p className="mt-1.5 text-sm font-bold text-stat"><ReferenceText message="Contrast study ordered for a patient with a recorded allergy. Confirm premedication with the radiologist." /></p>}
          </section>

          <section>
            <h3 className="mb-2 font-bold"><ReferenceText message="3. Clinical details" /></h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={referenceT("Priority")}>
                <div className="flex gap-1">
                  {['ROUTINE', 'URGENT', 'STAT'].map((p) => (
                    <DiagnosticButton key={p} type="button" onClick={() => setF({ ...f, priority: p })}
                      className={`btn flex-1 border ${f.priority === p ? (p === 'STAT' ? 'border-stat bg-stat text-white' : p === 'URGENT' ? 'border-urgent bg-urgent text-white' : 'border-petrol bg-petrol text-white') : 'border-line bg-white text-ink-3'}`}>
                      {fmt.status(p)}
                    </DiagnosticButton>
                  ))}
                </div>
              </Field>
              <Field label={referenceT("Patient class")}>
                <DiagnosticSelect className="field" value={f.patient_class} onChange={set('patient_class')}><option value="OP"><ReferenceText message="Outpatient" /></option><option value="IP"><ReferenceText message="Inpatient" /></option><option value="ER"><ReferenceText message="Emergency" /></option></DiagnosticSelect>
              </Field>
              <Field label={referenceT("Referring physician")}>
                <DiagnosticSelect className="field" value={f.referrer_id} onChange={set('referrer_id')}>
                  <option value=""><ReferenceText message="Self-referred / none" /></option>
                  {(lk?.referrers || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}{r.specialty ? ` · ${r.specialty}` : ''}</option>)}
                </DiagnosticSelect>
              </Field>
              <Field label={referenceT("Clinical history")} className="sm:col-span-2"><DiagnosticTextarea className="field" rows={2} value={f.clinical_history} onChange={set('clinical_history')} placeholder={referenceT("Symptoms, relevant history, question to answer")} /></Field>
              <Field label={referenceT("Reason for exam")}><DiagnosticTextarea className="field" rows={2} value={f.reason} onChange={set('reason')} placeholder={referenceT("e.g. rule out PE")} /></Field>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <h3 className="mb-2 font-bold"><ReferenceText message="4. Appointment" /></h3>
              <label className="mb-2 flex items-center gap-2 text-sm"><DiagnosticInput type="checkbox" className="accent-petrol" checked={f.schedule} onChange={set('schedule')} /><ReferenceText message="Book a time now" /></label>
              {f.schedule && <DiagnosticInput type="datetime-local" className="field" value={f.scheduled_at} onChange={set('scheduled_at')} aria-label={referenceT("Appointment time")} />}
              {!f.schedule && <p className="text-sm text-ink-soft"><ReferenceText message="The order waits in the unscheduled list until booked or the patient walks in." /></p>}
            </div>
            <div className="sm:col-span-2">
              <h3 className="mb-2 font-bold"><ReferenceText message="5. Billing" /></h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label={referenceT("Payer")}><DiagnosticSelect className="field" value={f.payer} onChange={set('payer')}><option value="SELF"><ReferenceText message="Self pay" /></option><option value="INSURANCE"><ReferenceText message="Insurance" /></option><option value="CORPORATE"><ReferenceText message="Corporate" /></option></DiagnosticSelect></Field>
                <Field label={referenceT("Discount (total)")}><DiagnosticInput type="number" min={0} className="field" value={f.discount} onChange={set('discount')} /></Field>
                <Field label={referenceT("Placer order no.")} className="col-span-2" hint={referenceT("Optional external reference from the requesting system.")}><DiagnosticInput className="field font-mono" value={f.placer_order_no} onChange={set('placer_order_no')} /></Field>
              </div>
            </div>
          </section>
        </div>
      </Modal>
      <PatientForm open={register} onClose={() => setRegister(false)} onSaved={(p) => { setPatient(p); setRegister(false); }} />
    </>
  );
}
