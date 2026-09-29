'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import clsx from 'clsx';
import { ArrowLeft, BadgeCheck, CalendarCheck2, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, Stethoscope, UserPlus, UserRoundX, Wallet } from 'lucide-react';
import { useReferenceRouter, useReferenceSearchParams } from '@pepbits/reference-host';
import { Suspense, useEffect, useState } from 'react';
import { RefSelect } from '../../../components/masters/RefSelect';
import { PatientBanner } from '../../../components/patients/PatientBanner';
import { PatientSearch } from '../../../components/patients/PatientSearch';
import { prefillFromQuery, QuickRegister } from '../../../components/patients/QuickRegister';
import { Button, Field, Input, Segmented } from '../../../components/ui/controls';
import { Badge, EmptyState, ErrorBanner, Spinner, StatusBadge } from '../../../components/ui/display';
import { useToast } from '../../../components/ui/Toast';
import { useApiClient, ApiError, errorMessage, qs } from '../../../lib/api';
import { todayIso, useFormat } from '../../../lib/format';
import { useApi } from '../../../lib/hooks';
import { usePageHeader, useSession } from '../../../lib/session';
import { Page, PatientSummary, Row } from '../../../lib/types';

type EncType = 'Outpatient' | 'Walk-in' | 'Emergency' | 'Pharmacy';
interface Elig { status: 'Eligible' | 'Ineligible' | 'Manual'; reference: string; message: string; policyId: string; checkedAt: string }

const Step = ({ n, title, done, children, className }: { n: number; title: string; done?: boolean; children: React.ReactNode; className?: string }) => (
  <section className={clsx('hc-panel flex min-h-0 flex-col overflow-hidden', className)}>
    <div className="hc-panel-head">
      <h2 className="flex items-center gap-2 hc-panel-title">
        <span className={clsx('grid h-5 w-5 place-items-center rounded-full text-hc-2xs font-semibold', done ? 'bg-hc-ok-600 text-white' : 'bg-hc-petrol-50 text-hc-petrol-700')}>{done ? '✓' : n}</span>
        {title}
      </h2>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
  </section>
);

function NewEncounter() {
 const {t:healthcareT}=useHealthcareLocalization();
 const {t}=useLocalization();
  const api = useApiClient();
  const { fmtDate , fmtTime } = useFormat();
  usePageHeader(healthcareT("New encounter"), healthcareT("Find the patient, choose the visit, confirm who pays"));
  const router = useReferenceRouter();
  const sp = useReferenceSearchParams();
  const toast = useToast();
  const { facilityId, facility } = useSession();
  const today = todayIso();

  const [patient, setPatient] = useState<Row | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [appointment, setAppointment] = useState<Row | null>(null);
  const [encounterType, setEncounterType] = useState<EncType>('Outpatient');
  const [visitType, setVisitType] = useState<'New' | 'Follow-up'>('New');
  const [departmentId, setDepartmentId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [paymentClass, setPaymentClass] = useState<'Cash' | 'Insurance'>('Cash');
  const [policyId, setPolicyId] = useState('');
  const [elig, setElig] = useState<Elig | null>(null);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [registerQuery, setRegisterQuery] = useState<string | null>(null);
  const [guestAppt, setGuestAppt] = useState<Row | null>(null);

  const todays = useApi<Page>(patient ? null : `/appointments${qs({ date: today, status: 'Booked,Confirmed', pageSize: 100 })}`);
  const patientAppts = useApi<Page>(patient ? `/appointments${qs({ date: today, patientId: patient.id, status: 'Booked,Confirmed', pageSize: 20 })}` : null);

  useEffect(() => { if (facility?.type === 'Pharmacy') setEncounterType('Pharmacy'); }, [facility?.type]);

  const loadPatient = async (id: string) => {
    setLoadingPatient(true);
    try {
      const p = await api<Row>(`/patients/${id}`);
      setPatient(p);
      const usable = (p.policies ?? []).filter((x: Row) => x.status === 'Active');
      const primary = usable.find((x: Row) => x.isPrimary && !x.isExpired) ?? usable.find((x: Row) => !x.isExpired) ?? usable[0];
      setPolicyId(primary?.id ?? '');
      setPaymentClass(primary ? 'Insurance' : 'Cash');
      setElig(null);
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not load patient"), body: errorMessage(e) }); }
    finally { setLoadingPatient(false); }
  };

  const linkAppointment = (a: Row | null) => {
    setAppointment(a);
    if (a) {
      setDepartmentId(a.departmentId ?? ''); setSpecialtyId(''); setProviderId(a.providerId ?? '');
      if (a.reason) setChiefComplaint(a.reason);
      if (encounterType === 'Pharmacy' || encounterType === 'Walk-in') setEncounterType('Outpatient');
      if (/follow/i.test(a.reason ?? '')) setVisitType('Follow-up');
    }
  };

  useEffect(() => {
    const apptId = sp.get('appointmentId');
    const pid = sp.get('patientId');
    if (apptId) {
      api<Row>(`/appointments/${apptId}`).then((a) => {
        if (!a.patientId) { setGuestAppt(a); return; }
        linkAppointment(a); loadPatient(a.patientId);
      }).catch((e) => toast({ tone: 'danger', title: healthcareT("Appointment not found"), body: errorMessage(e) }));
    } else if (pid) loadPatient(pid);
  }, []); // eslint-disable-hc-line react-hooks/exhaustive-deps

  const pickFromList = (a: Row) => {
    if (!a.patientId) { setGuestAppt(a); return; }
    linkAppointment(a); loadPatient(a.patientId);
  };

  const policies: Row[] = (patient?.policies ?? []).filter((x: Row) => x.status === 'Active');
  const policy = policies.find((x) => x.id === policyId) ?? null;
  const pharmacy = encounterType === 'Pharmacy';
  const eligOk = paymentClass === 'Cash' || (elig && elig.policyId === policyId && elig.status !== 'Ineligible');
  const visitOk = pharmacy || (!!departmentId && !!providerId);

  const check = async () => {
    if (!patient || !policyId) return;
    setChecking(true); setElig(null);
    try {
      const r = await api<Row>('/eligibility/check', { method: 'POST', body: { patientId: patient.id, policyId } });
      setElig({ status: r.status, reference: r.reference, message: r.message, policyId, checkedAt: r.checkedAt });
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Eligibility check failed"), body: errorMessage(e) }); }
    finally { setChecking(false); }
  };

  const create = async () => {
    if (!patient) return;
    setSaving(true); setErrors({}); setBanner(null);
    try {
      const enc = await api<Row>('/encounters', {
        method: 'POST',
        body: {
          patientId: patient.id, appointmentId: appointment?.id ?? '', encounterType, visitType,
          departmentId: pharmacy ? '' : departmentId, specialtyId: pharmacy ? '' : specialtyId, providerId: pharmacy ? '' : providerId,
          paymentClass, policyId: paymentClass === 'Insurance' ? policyId : '', eligibilityRef: paymentClass === 'Insurance' ? elig?.reference ?? '' : '',
          chiefComplaint, facilityId,
        },
      });
      toast({ tone: 'ok', title: healthcareT("Encounter {v0} created",{v0:enc.encNo}), body: healthcareT("{v0} · {v1}",{v0:enc.patientName,v1:paymentClass === 'Insurance' ? enc.payerName : 'Self-pay'}) });
      router.push(`/encounters/${enc.id}`);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) { setErrors(e.fields); setBanner(Object.values(e.fields)[0]); }
      else setBanner(errorMessage(e));
      setSaving(false);
    }
  };

  const EligIcon = elig?.status === 'Eligible' ? ShieldCheck : elig?.status === 'Manual' ? ShieldQuestion : ShieldAlert;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => router.push('/encounters')}><LocalizedText message="Encounters" /></Button>
        {patient ? (
          <PatientBanner className="flex-1" patient={patient} policy={paymentClass === 'Insurance' ? policy : null} paymentClass={paymentClass} eligibility={paymentClass === 'Insurance' && elig?.policyId === policyId ? elig : null}
            right={<Button size="sm" variant="ghost" onClick={() => { setPatient(null); setAppointment(null); setElig(null); router.replace('/encounters/new'); }}><LocalizedText message="Change patient" /></Button>} />
        ) : <div className="flex-1" />}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3">
        <Step n={1} title="Patient" done={!!patient}>
          {loadingPatient ? <Spinner label="Loading patient" /> : patient ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-hc-xs">
                <div><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Mobile" /></p><p className="hc-num">{patient.phone}</p></div>
                <div><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="National ID" /></p><p className="font-mono">{patient.nationalId || 'Not recorded'}</p></div>
                <div><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Nationality" /></p><p>{patient.nationality || 'Not recorded'}</p></div>
                <div><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Last visit" /></p><p>{patient.lastVisit ? fmtDate(patient.lastVisit) : <LocalizedText message="First visit"/>}</p></div>
              </div>
              <div>
                <p className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Today&apos;s appointment" /></p>
                {(patientAppts.data?.data ?? []).length === 0 && !appointment ? <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="None booked today. This will be a walk-in unless you book first." /></p> : (
                  <div className="space-y-1">
                    {[...(appointment ? [appointment] : []), ...(patientAppts.data?.data ?? []).filter((a) => a.id !== appointment?.id)].map((a) => (
                      <button key={a.id} type="button" onClick={() => linkAppointment(appointment?.id === a.id ? null : a)}
                        className={clsx('flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-hc-xs', appointment?.id === a.id ? 'border-hc-petrol-500 bg-hc-petrol-50' : 'border-hc-line hover:border-hc-ink-faint')}>
                        <CalendarCheck2 className={clsx('h-4 w-4', appointment?.id === a.id ? 'text-hc-petrol-600' : 'text-hc-ink-faint')} />
                        <span className="min-w-0 flex-1"><span className="hc-num font-semibold">{fmtTime(a.startTime)}</span> · {a.resourceName}<span className="block truncate text-hc-2xs text-hc-ink-mute">{a.apptNo} · {a.reason}</span></span>
                        {appointment?.id === a.id ? <Badge tone="petrol"><LocalizedText message="Linked" /></Badge> : <span className="text-hc-2xs text-hc-petrol-700"><LocalizedText message="Link" /></span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <PatientSearch size="lg" autoFocus onSelect={(p) => loadPatient(p.id)} onCreate={(q) => setRegisterQuery(q)} />
              <Button mutation size="sm" variant="subtle" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setRegisterQuery('')}><LocalizedText message="Register walk-in patient" /></Button>
              <div>
                <p className="mb-1.5 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Expected today" /></p>
                {todays.loading ? <Spinner /> : (todays.data?.data ?? []).length === 0 ? <p className="text-hc-xs text-hc-ink-mute"><LocalizedText message="No open appointments today." /></p> : (
                  <div className="space-y-0.5">
                    {todays.data!.data.map((a) => (
                      <button key={a.id} type="button" onClick={() => pickFromList(a)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-hc-xs hover:bg-hc-canvas">
                        <span className="hc-num w-10 shrink-0 font-semibold">{fmtTime(a.startTime)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 truncate font-medium">{!a.patientId && <UserRoundX className="h-3.5 w-3.5 text-hc-selfpay-600" />}{a.patientName || a.guestName}</span>
                          <span className="block truncate text-hc-2xs text-hc-ink-mute">{a.mrn || 'No MRN, register on arrival'} · {a.resourceName}</span>
                        </span>
                        <StatusBadge status={a.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Step>

        <Step n={2} title="Visit" done={!!patient && visitOk}>
          {!patient ? <EmptyState title="Select a patient first" /> : (
            <div className="space-y-3">
              <Field label="Encounter type">
                <Segmented className="w-full [&>button]:flex-1 [&>button]:justify-center" value={encounterType} onChange={(v) => { setEncounterType(v); if (v === 'Pharmacy') linkAppointment(null); }}
                  options={(['Outpatient', 'Walk-in', 'Emergency', 'Pharmacy'] as EncType[]).map((v) => ({ value: v, label: v }))} />
              </Field>
              {pharmacy ? (
                <p className="rounded-md bg-hc-info-50 px-3 py-2 text-hc-xs text-hc-info-700"><LocalizedText message="Pharmacy counter sale. No doctor is needed; medicines are billed on the pharmacy bill and prescription drugs need an approved eRx." /></p>
              ) : (
                <>
                  <Field label="Visit">
                    <Segmented value={visitType} onChange={setVisitType} options={[{ value: 'New', label: 'New visit' }, { value: 'Follow-up', label: 'Follow-up' }]} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Department" required error={errors.departmentId}>
                      <RefSelect entity="departments" params={{ type: 'Clinical,Diagnostic,Nursing' }} value={departmentId} invalid={!!errors.departmentId}
                        onChange={(v) => { setDepartmentId(v); setSpecialtyId(''); setProviderId(''); }} />
                    </Field>
                    <Field label="Specialty">
                      <RefSelect entity="specialties" params={departmentId ? { departmentId } : null} waitingFor="department" value={specialtyId} onChange={(v) => { setSpecialtyId(v); setProviderId(''); }} placeholder="Any specialty" />
                    </Field>
                    <Field label="Treating provider" required error={errors.providerId} className="col-span-2">
                      <RefSelect entity="providers" params={departmentId ? { departmentId, ...(specialtyId ? { specialtyId } : {}), providerType: 'Doctor,Lab Doctor,Physiotherapist,Nurse' } : null}
                        waitingFor="department" value={providerId} invalid={!!errors.providerId} onChange={setProviderId} />
                    </Field>
                  </div>
                  {visitType === 'Follow-up' && <p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Doctor follow-ups are charged at the follow-up consultation rate." /></p>}
                </>
              )}
              <Field label="Chief complaint"><Input value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="e.g. Fever for 3 days" /></Field>
              {appointment && <p className="flex items-center gap-1.5 text-hc-xs text-hc-petrol-700"><CalendarCheck2 className="h-3.5 w-3.5" /><LocalizedText message="Linked to {appointment}. It will be marked arrived." values={{appointment:appointment.apptNo}} /></p>}
            </div>
          )}
        </Step>

        <Step n={3} title="Payment & eligibility" done={!!patient && !!eligOk}>
          {!patient ? <EmptyState title="Select a patient first" /> : (
            <div className="flex h-full flex-col gap-3">
              <Segmented className="w-full [&>button]:flex-1 [&>button]:justify-center" value={paymentClass}
                tone={(v) => (v === 'Cash' ? 'text-hc-selfpay-700' : 'text-hc-petrol-700')}
                onChange={(v) => { setPaymentClass(v); setErrors({}); }}
                options={[{ value: 'Insurance', label: 'Insurance', icon: <ShieldCheck className="h-3.5 w-3.5" /> }, { value: 'Cash', label: 'Self-pay', icon: <Wallet className="h-3.5 w-3.5" /> }]} />
              {paymentClass === 'Insurance' ? (
                policies.length === 0 ? (
                  <div className="rounded-md border border-dashed border-hc-line-strong p-3 text-hc-xs text-hc-ink-mute"><LocalizedText message="No policy on file." /><button type="button" className="font-medium text-hc-petrol-700 hover:underline" onClick={() => router.push(`/patients/${patient.id}`)}><LocalizedText message="Add insurance to the patient" /></button><LocalizedText message="or continue as self-pay." /></div>
                ) : (
                  <>
                    <div className="space-y-1.5" role="radiogroup" aria-label="Policy">
                      {policies.map((p) => (
                        <button key={p.id} type="button" role="radio" aria-checked={p.id === policyId} onClick={() => { setPolicyId(p.id); setElig(null); }}
                          className={clsx('w-full rounded-md border px-3 py-2 text-left', p.id === policyId ? 'border-hc-petrol-500 bg-hc-petrol-50/60' : 'border-hc-line hover:border-hc-ink-faint')}>
                          <span className="flex items-center justify-between gap-2 text-hc-sm font-medium">{p.payerName} · {p.planName}
                            <span className="flex gap-1">{p.isPrimary && <Badge tone="petrol"><LocalizedText message="Primary" /></Badge>}{p.isExpired && <Badge tone="danger"><LocalizedText message="Expired" /></Badge>}</span>
                          </span>
                          <span className="hc-num mt-0.5 block text-hc-2xs text-hc-ink-mute">{p.networkName} · {p.tpaName} · <span className="font-mono">{p.memberId}</span> <LocalizedText message="· valid to" /> {fmtDate(p.validTo)} <LocalizedText message="· co-pay" /> {p.copayPct}%</span>
                        </button>
                      ))}
                    </div>
                    <Button variant={elig?.policyId === policyId ? 'secondary' : 'primary'} icon={checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />} disabled={!policyId || checking} onClick={check}>
                      {elig?.policyId === policyId ? <LocalizedText message="Check again"/> : <LocalizedText message="Check eligibility"/>}
                    </Button>
                    {elig && elig.policyId === policyId && (
                      <div className={clsx('rounded-md border p-3', elig.status === 'Eligible' ? 'border-hc-ok-100 bg-hc-ok-50' : elig.status === 'Manual' ? 'border-hc-warn-100 bg-hc-warn-50' : 'border-hc-danger-100 bg-hc-danger-50')} role="status">
                        <p className={clsx('flex items-center gap-2 text-hc-sm font-semibold', elig.status === 'Eligible' ? 'text-hc-ok-700' : elig.status === 'Manual' ? 'text-hc-warn-700' : 'text-hc-danger-700')}>
                          <EligIcon className="h-4 w-4" />{elig.status === 'Manual' ? <LocalizedText message="Verify manually"/> : elig.status}
                        </p>
                        <p className="mt-1 text-hc-xs text-hc-ink-soft">{elig.message}</p>
                        <p className="mt-1 font-mono text-hc-2xs text-hc-ink-mute"><LocalizedText message="Ref" /> {elig.reference}</p>
                        {elig.status === 'Ineligible' && <Button size="sm" variant="selfpay" className="mt-2" onClick={() => setPaymentClass('Cash')}><LocalizedText message="Continue as self-pay" /></Button>}
                      </div>
                    )}
                    {errors.eligibility && <p className="text-hc-xs text-hc-danger-600">{errors.eligibility}</p>}
                  </>
                )
              ) : (
                <p className="rounded-md bg-hc-selfpay-50 px-3 py-2 text-hc-xs text-hc-selfpay-700"><LocalizedText message="The patient pays the cash tariff for every line. No eligibility check or approvals are needed." /></p>
              )}
              <div className="mt-auto space-y-2 border-t border-hc-line pt-3">
                {banner && <ErrorBanner message={banner} />}
                <Button mutation size="lg" variant={paymentClass === 'Cash' ? 'selfpay' : 'primary'} className="w-full" icon={<Stethoscope className="h-4 w-4" />} loading={saving}
                  disabled={!visitOk || !eligOk || (paymentClass === 'Insurance' && !policyId)} onClick={create}><LocalizedText message="Create {type} encounter" values={{type:healthcareT(encounterType).toLowerCase()}}/></Button>
                {paymentClass === 'Insurance' && !eligOk && <p className="text-center text-hc-2xs text-hc-ink-mute"><LocalizedText message="Run a successful eligibility check to continue on insurance." /></p>}
                {!visitOk && <p className="text-center text-hc-2xs text-hc-ink-mute"><LocalizedText message="Choose the department and treating provider." /></p>}
              </div>
            </div>
          )}
        </Step>
      </div>

      <QuickRegister open={registerQuery !== null} onClose={() => setRegisterQuery(null)} initial={prefillFromQuery(registerQuery ?? '')}
        onCreated={(p: PatientSummary) => { setRegisterQuery(null); loadPatient(p.id); }} />
      <QuickRegister
        open={!!guestAppt}
        onClose={() => setGuestAppt(null)}
        title={t("Register {v0}",{v0:guestAppt?.guestName ?? ''})}
        submitLabel="Register & continue"
        initial={guestAppt ? { firstName: String(guestAppt.guestName).split(' ')[0], lastName: String(guestAppt.guestName).split(' ').slice(1).join(' '), phone: guestAppt.guestPhone, gender: guestAppt.guestGender, dob: guestAppt.guestDob } : undefined}
        submit={async (body) => {
          const r = await api<{ appointment: Row; patient: PatientSummary }>(`/appointments/${guestAppt!.id}/register`, { method: 'POST', body });
          linkAppointment(r.appointment);
          return r.patient;
        }}
        onCreated={(p) => { setGuestAppt(null); loadPatient(p.id); }}
      />
    </div>
  );
}

export default function NewEncounterPage() { return <Suspense><NewEncounter /></Suspense>; }
