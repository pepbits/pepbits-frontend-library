'use client';
import {CardGrid} from '@pepbits/ops-ui';

import {DiagnosticButton} from '@pepbits/reference-diagnostics';
import {useDiagnosticClient, useDiagnosticFormat} from '@pepbits/reference-diagnostics';
import { useEffect, useMemo, useState } from 'react';
import {useReferenceRouter as useRouter, useReferenceSearchParams as useSearchParams} from '@pepbits/reference-host';
import { Layers, Search, Truck, UserPlus, X } from 'lucide-react';

import { useCurrency, useDebounced, useMaster } from '../../../../lib/hooks';
import {minutesLabel} from '../../../../lib/format';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea, TubeChip } from '../../../../components/ui';
import { TestPicker } from '../../../../components/TestPicker';
import { PatientForm } from '../../patients/PatientForm';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function NewOrderPage() {
 const referenceT = useReferenceLocalization().t;

 const {api}=useDiagnosticClient();
 const {money}=useDiagnosticFormat();

  const sp = useSearchParams();
  const router = useRouter();
  const currency = useCurrency();
  const tests = useMaster('tests');
  const profilesAll = useMaster('profiles');
  const doctors = useMaster('doctors');
  const bodySites = useMaster('body-sites');
  const containers = useMaster('containers');

  const [patient, setPatient] = useState<any>(null);
  const [pq, setPq] = useState('');
  const dpq = useDebounced(pq);
  const [matches, setMatches] = useState<any[]>([]);
  const [register, setRegister] = useState(false);
  const [testIds, setTestIds] = useState<number[]>([]);
  const [profileIds, setProfileIds] = useState<number[]>([]);
  const [sites, setSites] = useState<Record<number, number>>({});
  const [f, setF] = useState({ doctorId: '', priority: 'ROUTINE', patientLocation: '', diagnosis: '', clinicalNotes: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { const id = sp.get('patientId'); if (id) api.get(`/patients/${id}`).then(setPatient).catch(() => {}); }, [sp]);
  useEffect(() => { if (!dpq.trim() || patient) { setMatches([]); return; } api.get<any[]>('/patients', { q: dpq }).then((r) => setMatches(r.slice(0, 8))).catch(() => {}); }, [dpq, patient]);

  const profiles = profilesAll.filter((p) => profileIds.includes(p.id));
  const coveredByProfiles = useMemo(() => new Set(profiles.flatMap((p) => p.testIds || [])), [profiles]);
  const looseTests = tests.filter((t) => testIds.includes(t.id) && !coveredByProfiles.has(t.id));
  const allTests = tests.filter((t) => testIds.includes(t.id) || coveredByProfiles.has(t.id));
  const total = profiles.reduce((s, p) => s + p.price, 0) + looseTests.reduce((s, t) => s + t.price, 0);
  const tubes = useMemo(() => {
    const m = new Map<string, { container: any; tests: string[] }>();
    for (const t of allTests) {
      const key = `${t.sampleTypeId}-${t.containerId}`;
      const c = containers.find((x) => x.id === t.containerId);
      if (!m.has(key)) m.set(key, { container: c, tests: [] });
      m.get(key)!.tests.push(t.code);
    }
    return [...m.values()];
  }, [allTests, containers]);
  const needSite = allTests.filter((t) => t.requiresBodySite);

  const submit = async (bill: boolean) => {
    if (!patient) return setErr('Select or register a patient first.');
    if (!testIds.length && !profileIds.length) return setErr('Add at least one test or profile.');
    const missing = needSite.filter((t) => !sites[t.id]);
    if (missing.length) return setErr(`Choose a body site for ${missing.map((t) => t.name).join(', ')}.`);
    setBusy(bill ? 'bill' : 'save'); setErr(null);
    try {
      const o = await api.post('/orders', {
        patientId: patient.id, doctorId: f.doctorId ? Number(f.doctorId) : undefined, priority: f.priority,
        testIds: looseTests.map((t) => t.id), profileIds, bodySites: sites,
        patientLocation: f.patientLocation || undefined, diagnosis: f.diagnosis || undefined, clinicalNotes: f.clinicalNotes || undefined,
      });
      router.push(`/orders/${o.id}${bill ? '?bill=1' : ''}`);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };

  return (
    <div>
      <PageHeader title={referenceT("New order")} subtitle={referenceT("Choose the patient, add tests or profiles, then bill or send straight to collection")} />
      <ErrorNote error={err} />
      <CardGrid className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Card title={referenceT("Patient")} actions={<Button size="sm" icon={UserPlus} onClick={() => setRegister(true)}><ReferenceText message="Register new" /></Button>}>
            {patient ? (
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold">{patient.fullName}</div>
                  <div className="text-sm text-ink-soft"><span className="font-mono">{patient.mrn}</span> · {patient.gender} · {patient.age}{patient.isPregnant ? ' · pregnant' : ''}{patient.ethnicity ? ` · ${patient.ethnicity}` : ''}</div>
                </div>
                <Button size="sm" variant="ghost" icon={X} onClick={() => { setPatient(null); setPq(''); }}><ReferenceText message="Change" /></Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-mute" />
                <Input autoFocus className="pl-8" placeholder={referenceT("Search by MRN, name, phone or national ID")} value={pq} onChange={(e) => setPq(e.target.value)} />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded border border-line bg-white shadow-lg">
                    {matches.map((p) => (
                      <DiagnosticButton key={p.id} onClick={() => setPatient(p)} className="flex w-full justify-between border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-lab-50">
                        <span><span className="font-medium">{p.fullName}</span> <span className="text-ink-mute">{p.gender} · {p.age}</span></span>
                        <span className="font-mono text-xs text-ink-soft">{p.mrn}</span>
                      </DiagnosticButton>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card title={referenceT("Tests and profiles")} bodyClass="h-[520px] p-3">
            <TestPicker currency={currency} selectedTests={allTests.map((t) => t.id)} selectedProfiles={profileIds}
              onAddTest={(t) => setTestIds((s) => [...s, t.id])} onAddProfile={(p) => setProfileIds((s) => [...s, p.id])} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={referenceT("Order details")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={referenceT("Priority")} className="col-span-2">
                <div className="flex gap-1">
                  {['ROUTINE', 'STAT'].map((p) => (
                    <DiagnosticButton key={p} onClick={() => setF({ ...f, priority: p })} className={`flex-1 rounded border px-3 py-1.5 text-sm font-medium ${f.priority === p ? (p === 'STAT' ? 'border-flag-crit bg-flag-crit text-white' : 'border-lab-600 bg-lab-50 text-lab-800') : 'border-line-strong text-ink-soft'}`}>{p === 'STAT' ? 'STAT (urgent)' : 'Routine'}</DiagnosticButton>
                  ))}
                </div>
              </Field>
              <Field label={referenceT("Referring doctor")} className="col-span-2">
                <Select value={f.doctorId} onChange={(e) => setF({ ...f, doctorId: e.target.value })} placeholder={referenceT("Self / not specified")} options={doctors.filter((d) => d.active).map((d) => ({ value: d.id, label: `${d.name}${d.specialty ? ` · ${d.specialty}` : ''}` }))} />
              </Field>
              <Field label={referenceT("Location / ward")}><Input value={f.patientLocation} onChange={(e) => setF({ ...f, patientLocation: e.target.value })} placeholder={referenceT("OPD, Ward 3…")} /></Field>
              <Field label={referenceT("Diagnosis / ICD")}><Input value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
              <Field label={referenceT("Clinical notes")} className="col-span-2"><Textarea rows={2} value={f.clinicalNotes} onChange={(e) => setF({ ...f, clinicalNotes: e.target.value })} /></Field>
            </div>
          </Card>

          <Card title={referenceT("Selected ({value0} tests)", {value0: allTests.length})} bodyClass="p-0">
            {!allTests.length ? <div className="p-4 text-sm text-ink-mute"><ReferenceText message="Pick tests or profiles from the catalogue." /></div> : (
              <div className="divide-y divide-line">
                {profiles.map((p) => (
                  <div key={`p${p.id}`} className="flex items-center gap-2 px-3 py-2">
                    <Layers className="h-4 w-4 text-lab-600" />
                    <div className="flex-1 text-sm"><div className="font-medium">{p.name}</div><div className="text-xs2 text-ink-mute">{tests.filter((t) => (p.testIds || []).includes(t.id)).map((t) => t.code).join(', ')}</div></div>
                    <span className="num text-sm">{money(p.price, currency)}</span>
                    <DiagnosticButton onClick={() => setProfileIds((s) => s.filter((x) => x !== p.id))} className="rounded p-1 text-ink-mute hover:bg-paper hover:text-flag-crit"><X className="h-3.5 w-3.5" /></DiagnosticButton>
                  </div>
                ))}
                {looseTests.map((t) => (
                  <div key={t.id} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <TubeChip size="sm" color={containers.find((c) => c.id === t.containerId)?.capColor} />
                      <div className="flex-1 text-sm"><div className="font-medium">{t.name}</div><div className="text-xs2 text-ink-mute">{t.code} <ReferenceText message="· TAT" /> {minutesLabel(f.priority === 'STAT' ? t.tatStatMinutes : t.tatRoutineMinutes)}</div></div>
                      {t.isOutsourced && <Badge value="OUTSOURCED" label={referenceT("Outsourced")} />}
                      <span className="num text-sm">{money(t.price, currency)}</span>
                      <DiagnosticButton onClick={() => setTestIds((s) => s.filter((x) => x !== t.id))} className="rounded p-1 text-ink-mute hover:bg-paper hover:text-flag-crit"><X className="h-3.5 w-3.5" /></DiagnosticButton>
                    </div>
                  </div>
                ))}
                {needSite.length > 0 && (
                  <div className="space-y-2 bg-paper/60 px-3 py-2">
                    {needSite.map((t) => (
                      <Field key={t.id} label={referenceT("Body site for {value0}", {value0: t.name})} required>
                        <Select value={sites[t.id] || ''} onChange={(e) => setSites({ ...sites, [t.id]: Number(e.target.value) })} placeholder={referenceT("Choose site")} options={bodySites.filter((b) => b.active).map((b) => ({ value: b.id, label: `${b.name}${b.laterality ? ` (${b.laterality})` : ''}` }))} />
                      </Field>
                    ))}
                  </div>
                )}
              </div>
            )}
            {allTests.length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                  <span><ReferenceText message="Tubes needed:" /></span>
                  {tubes.map((tb, i) => <span key={i} className="inline-flex items-center gap-1"><TubeChip size="sm" color={tb.container?.capColor} />{tb.container?.name ?? 'Container'} ({tb.tests.join(', ')})</span>)}
                </div>
                {allTests.some((t) => t.isOutsourced) && <div className="mb-2 flex items-center gap-1.5 text-xs text-flag-warn"><Truck className="h-3.5 w-3.5" /><ReferenceText message="Some tests are sent to a reference lab after accessioning." /></div>}
                <div className="flex items-center justify-between text-base font-semibold"><span><ReferenceText message="Total" /></span><span className="num">{money(total, currency)}</span></div>
              </div>
            )}
          </Card>
          <div className="flex gap-2">
            <Button className="flex-1" loading={busy === 'save'} disabled={!!busy} onClick={() => submit(false)}><ReferenceText message="Place order" /></Button>
            <Button className="flex-1" variant="primary" loading={busy === 'bill'} disabled={!!busy} onClick={() => submit(true)}><ReferenceText message="Place order and bill" /></Button>
          </div>
        </div>
      </CardGrid>
      <PatientForm open={register} onClose={() => setRegister(false)} onSaved={(p) => setPatient(p)} />
    </div>
  );
}
