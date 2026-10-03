'use client';
import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';

import { useDebounced } from '../../../../lib/hooks';
import { age, fullName } from '../../../../lib/format';
import { Button, Field, Input, PageHeader, Section, Select, Textarea, cx, useToast } from '../../../../components/ui';
import { RefSelect } from '../../../../components/refselect';
import { PatientBanner, PatientFormModal } from '../../../../components/patient';
import { PickedTest, TestPicker } from '../../../../components/testpicker';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function NewOrderPage() {
 const referenceT = useReferenceLocalization().t;

 const {get,post}=useDiagnosticClient();

  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const [patient, setPatient] = useState<any>(null);
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [matches, setMatches] = useState<any[]>([]);
  const [register, setRegister] = useState(false);
  const [enc, setEnc] = useState({ type: 'OP', locationId: '', doctorId: '', bed: '' });
  const [priority, setPriority] = useState('ROUTINE');
  const [clinicalInfo, setClinical] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [tests, setTests] = useState<PickedTest[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { const id = sp.get('patientId'); if (id) get(`/patients/${id}`).then(setPatient).catch(() => {}); }, [sp]);
  useEffect(() => {
    if (!dq.trim() || patient) { setMatches([]); return; }
    get('/patients', { q: dq, pageSize: 8 }).then((r) => setMatches(r.data)).catch(() => {});
  }, [dq, patient]);

  const missingSite = tests.find((t) => t.test.body_site_required && !t.bodySiteId);
  const submit = async () => {
    setErr(null);
    if (!patient) return setErr('Choose or register the patient first.');
    if (!tests.length) return setErr('Add at least one test.');
    if (missingSite) return setErr(`${missingSite.test.name} needs a body site.`);
    setBusy(true);
    try {
      const o = await post('/orders', {
        patientId: patient.id, priority, clinicalInfo, diagnosis, doctorId: enc.doctorId ? Number(enc.doctorId) : undefined,
        encounter: { type: enc.type, locationId: enc.locationId ? Number(enc.locationId) : undefined, doctorId: enc.doctorId ? Number(enc.doctorId) : undefined, bed: enc.bed || undefined },
        tests: tests.map((t) => ({ testId: t.test.id, bodySiteId: t.bodySiteId ? Number(t.bodySiteId) : undefined })),
      });
      toast.ok(`Order ${o.order_no} created and billed (${o.bill?.bill_no}).`);
      router.push(`/orders/${o.id}`);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={referenceT("New order")} subtitle={referenceT("Tests are billed when the order is saved and then appear on the collection list.")} />
      <div className="space-y-4">
        <Section title={referenceT("Patient")}>
          {patient ? (
            <PatientBanner p={patient}>
              <Button size="sm" variant="ghost" className="ml-auto" icon={<X className="h-3.5 w-3.5" />} onClick={() => setPatient(null)}><ReferenceText message="Change patient" /></Button>
            </PatientBanner>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <div className="relative w-full max-w-lg">
                <Input autoFocus placeholder={referenceT("Search by name, MRN, phone or national ID")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={referenceT("Find patient")} />
                {matches.length > 0 && (
                  <ul className="absolute left-0 right-0 top-10 z-10 max-h-72 overflow-y-auto rounded-md border border-line bg-white shadow-pop">
                    {matches.map((m) => (
                      <li key={m.id}><DiagnosticButton className="flex w-full justify-between gap-3 px-3 py-2 text-left hover:bg-hema-50" onClick={() => { setPatient(m); setQ(''); }}>
                        <span><span className="font-medium">{fullName(m)}</span> <span className="text-xs text-ink-soft">{[age(m.dob), m.gender].filter(Boolean).join(' ')}</span></span>
                        <span className="text-xs text-ink-soft tnum">{m.mrn}{m.phone ? `, ${m.phone}` : ''}</span>
                      </DiagnosticButton></li>
                    ))}
                  </ul>
                )}
              </div>
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setRegister(true)}><ReferenceText message="Register new patient" /></Button>
            </div>
          )}
        </Section>

        <Section title={referenceT("Encounter and clinical details")}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label={referenceT("Patient type")}><Select value={enc.type} onChange={(type) => setEnc({ ...enc, type })} options={[{ value: 'OP', label: 'Outpatient' }, { value: 'IP', label: 'Inpatient' }, { value: 'ER', label: 'Emergency' }]} /></Field>
            <Field label={referenceT("Location / ward")}><RefSelect entity="locations" value={enc.locationId} onChange={(locationId) => setEnc({ ...enc, locationId })} placeholder={referenceT("Not specified")} /></Field>
            <Field label={referenceT("Ordering doctor")}><RefSelect entity="doctors" value={enc.doctorId} onChange={(doctorId) => setEnc({ ...enc, doctorId })} placeholder={referenceT("Not specified")} /></Field>
            <Field label={referenceT("Bed")}><Input value={enc.bed} onChange={(e) => setEnc({ ...enc, bed: e.target.value })} /></Field>
            <Field label={referenceT("Priority")} className="md:col-span-1">
              <div className="flex overflow-hidden rounded-md border border-line-strong">
                {['ROUTINE', 'URGENT', 'STAT'].map((p) => (
                  <DiagnosticButton key={p} type="button" onClick={() => setPriority(p)} aria-pressed={priority === p}
                    className={cx('flex-1 py-1.5 text-sm', priority === p ? (p === 'STAT' ? 'bg-crit text-white' : p === 'URGENT' ? 'bg-high text-white' : 'bg-hema-600 text-white') : 'bg-white hover:bg-paper')}>
                    {p === 'ROUTINE' ? 'Routine' : p === 'URGENT' ? 'Urgent' : 'STAT'}
                  </DiagnosticButton>
                ))}
              </div>
            </Field>
            <Field label={referenceT("Provisional diagnosis")}><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></Field>
            <Field label={referenceT("Clinical information")} className="md:col-span-2"><Textarea className="min-h-[38px]" rows={1} value={clinicalInfo} onChange={(e) => setClinical(e.target.value)} /></Field>
          </div>
        </Section>

        <TestPicker value={tests} onChange={setTests} />

        <div className="flex items-center justify-end gap-3">
          {err && <p className="text-sm text-crit">{err}</p>}
          <Button onClick={() => router.back()}><ReferenceText message="Cancel" /></Button>
          <Button variant="primary" loading={busy} onClick={submit}><ReferenceText message="Create order and bill" /></Button>
        </div>
      </div>
      <PatientFormModal open={register} onClose={() => setRegister(false)} onSaved={(p) => setPatient(p)} />
    </>
  );
}
