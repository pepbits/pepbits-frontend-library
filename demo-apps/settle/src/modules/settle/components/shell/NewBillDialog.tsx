'use client';

import clsx from 'clsx';
import { BedDouble, Check, Pill, Plus, Search, Stethoscope, UserPlus } from '@pepbits/icons';
import { useRouter } from '../../host';
import { useEffect, useState } from 'react';
import { qs, useApi, useDebounced, useMutation } from '../../lib/api';
import { age, useFormat } from '../../lib/format';
import { useSession } from '../../lib/session';
import type { BillPayload, Patient, Visit } from '../../lib/types';
import { Dialog, useErrorToast, useToast } from '../ui/overlay';
import { Badge, Button, Field, Input, Segmented, Select, Skeleton } from '../ui/primitives';

type PatientRow = Patient & { dues: number; deposit_balance: number; active_bills: number; last_visit: string | null };

export function NewBillDialog({ open, onClose, initialMr }: { open: boolean; onClose: () => void; initialMr?: string | null }) {
  const { date, money } = useFormat();
  const router = useRouter();
  const { meta } = useSession();
  const toast = useToast();
  const fail = useErrorToast();
  const { run, pending } = useMutation();

  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const [mr, setMr] = useState<string | null>(initialMr || null);
  const [registering, setRegistering] = useState(false);
  const [reg, setReg] = useState({ name: '', phone: '', gender: 'F', dob: '' });
  const [visitId, setVisitId] = useState<string | null>(null);
  const [newVisit, setNewVisit] = useState(false);
  const [nv, setNv] = useState({ visitType: 'o', doctor: '', department: '', primaryPlanId: '', secondaryPlanId: '' });
  const [billType, setBillType] = useState<'P' | 'C'>('P');
  const [restriction, setRestriction] = useState<'N' | 'P'>('N');

  useEffect(() => {
    if (open) { setMr(initialMr || null); setQ(''); setRegistering(false); setVisitId(null); setNewVisit(false); }
  }, [open, initialMr]);

  const patients = useApi<PatientRow[]>(open ? `/patients${qs({ q: dq })}` : null);
  const visits = useApi<Visit[]>(open && mr ? `/patients/${mr}/visits` : null);
  const selected = patients.data?.find((p) => p.mr_no === mr);

  useEffect(() => {
    if (!visits.data) return;
    if (visits.data.length === 0) { setNewVisit(true); setVisitId(null); return; }
    const v = visits.data[0]!;
    setVisitId(v.visit_id);
    setNewVisit(false);
    setBillType(v.visit_type === 'i' ? 'C' : 'P');
  }, [visits.data]);

  const chosenVisit = visits.data?.find((v) => v.visit_id === visitId);

  async function register() {
    try {
      const { data } = await run<Patient>('/patients', 'POST', { name: reg.name.trim(), phone: reg.phone.trim(), gender: reg.gender, dob: reg.dob || null });
      setMr(data.mr_no);
      setRegistering(false);
      setQ(data.mr_no);
      toast({ tone: 'success', title: `Registered ${data.name}`, body: `MR number ${data.mr_no}` });
    } catch (e) { fail(e, 'Could not register'); }
  }

  async function create() {
    if (!mr) return;
    try {
      let vid = visitId;
      if (newVisit || !vid) {
        const { data } = await run<Visit>(`/patients/${mr}/visits`, 'POST', {
          visitType: nv.visitType, doctor: nv.doctor || null, department: nv.department || null,
          primaryPlanId: nv.primaryPlanId ? Number(nv.primaryPlanId) : null, secondaryPlanId: nv.secondaryPlanId ? Number(nv.secondaryPlanId) : null,
        });
        vid = data.visit_id;
      }
      const { data } = await run<BillPayload>('/bills', 'POST', { visitId: vid, billType: restriction === 'P' ? 'P' : billType, restrictionType: restriction });
      toast({ tone: 'success', title: `Bill ${data.bill.bill_no} created`, body: data.bill.is_tpa ? 'Insurance is connected from the visit.' : undefined });
      onClose();
      router.push(`/bills/${data.bill.bill_no}`);
    } catch (e) { fail(e, 'Could not create the bill'); }
  }

  const canCreate = !!mr && (newVisit || !!visitId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="New bill"
      sub="Pick the patient and visit. Bill type follows the visit — change it if you need to."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create} loading={pending} disabled={!canCreate}>Create bill</Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr_0.9fr]">
        {/* Patient */}
        <section className="flex min-h-[340px] flex-col">
          <StepTitle n={1} done={!!mr}>Patient</StepTitle>
          {!registering ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
                <Input autoFocus aria-label="Find patient" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MR number or phone" className="ps-9" />
              </div>
              <div className="mt-2 max-h-[300px] flex-1 overflow-y-auto rounded-lg border border-line">
                {patients.loading && !patients.data ? (
                  <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
                ) : patients.data?.length ? (
                  patients.data.slice(0, 40).map((p) => (
                    <button key={p.mr_no} type="button" onClick={() => setMr(p.mr_no)}
                      className={clsx('flex w-full items-center gap-3 border-b border-line/70 px-3 py-2.5 text-start last:border-0 transition-colors',
                        mr === p.mr_no ? 'bg-pine-50' : 'hover:bg-mist')}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mist-2 text-[length:calc(12px*var(--fs-scale,1))] font-semibold text-ink-soft">
                        {p.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[length:calc(14px*var(--fs-scale,1))] font-medium">{p.name}</span>
                        <span className="block text-[length:calc(12px*var(--fs-scale,1))] text-ink-mute">{p.mr_no} · {p.gender || '—'}{age(p.dob) !== null ? `, ${age(p.dob)} y` : ''} · {p.phone}</span>
                      </span>
                      {mr === p.mr_no && <Check className="h-4 w-4 text-pine-600" />}
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-[length:calc(13px*var(--fs-scale,1))] text-ink-soft">No patient matches “{q}”.</p>
                )}
              </div>
              <Button variant="quiet" size="sm" className="mt-2 self-start" icon={<UserPlus className="h-4 w-4" />} onClick={() => { setRegistering(true); setReg((r) => ({ ...r, name: /\d/.test(q) ? '' : q })); }}>
                Register a new patient
              </Button>
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <Field label="Full name"><Input autoFocus value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} /></Field>
              <Field label="Mobile number"><Input inputMode="tel" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender">
                  <Select value={reg.gender} onChange={(e) => setReg({ ...reg, gender: e.target.value })}>
                    <option value="F">Female</option><option value="M">Male</option><option value="O">Other</option>
                  </Select>
                </Field>
                <Field label="Date of birth" optional><Input type="date" value={reg.dob} onChange={(e) => setReg({ ...reg, dob: e.target.value })} /></Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRegistering(false)}>Back to search</Button>
                <Button size="sm" variant="primary" disabled={!reg.name.trim() || reg.phone.trim().length < 8} loading={pending} onClick={register}>Register</Button>
              </div>
            </div>
          )}
        </section>

        {/* Visit */}
        <section className={clsx('flex flex-col', !mr && 'pointer-events-none opacity-40')}>
          <StepTitle n={2} done={!!visitId || newVisit}>Visit</StepTitle>
          {selected && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selected.dues > 0 && <Badge tone="marigold">{`Owes ${money(selected.dues, { whole: true })}`}</Badge>}
              {selected.deposit_balance > 0 && <Badge tone="pine">{`Deposit ${money(selected.deposit_balance, { whole: true })}`}</Badge>}
              {selected.active_bills > 0 && <Badge tone="sky">{selected.active_bills} active bill{selected.active_bills > 1 ? 's' : ''}</Badge>}
            </div>
          )}
          <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
            {visits.data?.slice(0, 6).map((v) => (
              <button key={v.visit_id} type="button" onClick={() => { setVisitId(v.visit_id); setNewVisit(false); setBillType(v.visit_type === 'i' ? 'C' : 'P'); }}
                className={clsx('flex items-start gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors',
                  !newVisit && visitId === v.visit_id ? 'border-pine-500 bg-pine-50' : 'border-line hover:border-line-strong')}>
                {v.visit_type === 'i' ? <BedDouble className="mt-0.5 h-4 w-4 text-indigo-500" /> : <Stethoscope className="mt-0.5 h-4 w-4 text-sky-500" />}
                <span className="min-w-0 flex-1 text-[length:calc(13px*var(--fs-scale,1))]">
                  <span className="block font-medium">{v.visit_id} <span className="font-normal text-ink-mute">{v.visit_type === 'i' ? 'Inpatient' : 'Outpatient'}</span></span>
                  <span className="block truncate text-ink-soft">{v.doctor || 'No doctor'}{v.department ? `, ${v.department}` : ''} · {date(v.admitted_at)}</span>
                  {v.primary_sponsor && <span className="block truncate text-pine-700">{v.primary_sponsor} — {v.primary_plan}</span>}
                </span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setNewVisit(true); setVisitId(null); setBillType(nv.visitType === 'i' ? 'C' : 'P'); }}
            className={clsx('mt-1.5 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-[length:calc(13px*var(--fs-scale,1))] font-medium transition-colors',
              newVisit ? 'border-pine-500 bg-pine-50 text-pine-800' : 'border-line-strong text-ink-soft hover:text-ink')}>
            <Plus className="h-4 w-4" /> Start a new visit
          </button>
          {newVisit && (
            <div className="mt-2 grid grid-cols-2 gap-2.5 rounded-lg border border-line p-3">
              <div className="col-span-2">
                <Segmented size="sm" value={nv.visitType} onChange={(v) => { setNv({ ...nv, visitType: v }); setBillType(v === 'i' ? 'C' : 'P'); }}
                  options={[{ value: 'o', label: 'Outpatient' }, { value: 'i', label: 'Inpatient' }]} />
              </div>
              <Field label="Doctor" optional><Input value={nv.doctor} onChange={(e) => setNv({ ...nv, doctor: e.target.value })} placeholder="Dr. …" /></Field>
              <Field label="Department" optional><Input value={nv.department} onChange={(e) => setNv({ ...nv, department: e.target.value })} /></Field>
              <Field label="Primary insurance" optional>
                <Select value={nv.primaryPlanId} onChange={(e) => setNv({ ...nv, primaryPlanId: e.target.value })}>
                  <option value="">Self pay</option>
                  {meta?.plans.map((p) => <option key={p.id} value={p.id}>{p.sponsor_name} — {p.name}</option>)}
                </Select>
              </Field>
              <Field label="Secondary insurance" optional>
                <Select value={nv.secondaryPlanId} disabled={!nv.primaryPlanId} onChange={(e) => setNv({ ...nv, secondaryPlanId: e.target.value })}>
                  <option value="">None</option>
                  {meta?.plans.filter((p) => String(p.id) !== nv.primaryPlanId).map((p) => <option key={p.id} value={p.id}>{p.sponsor_name} — {p.name}</option>)}
                </Select>
              </Field>
            </div>
          )}
        </section>

        {/* Bill type */}
        <section className={clsx('flex flex-col', !(visitId || newVisit) && 'pointer-events-none opacity-40')}>
          <StepTitle n={3} done={canCreate}>Bill</StepTitle>
          <div className="space-y-2">
            <Choice active={restriction === 'N' && billType === 'P'} onClick={() => { setRestriction('N'); setBillType('P'); }}
              title="Bill Now" body="Pay at the counter before the service. Settlement only." />
            <Choice active={restriction === 'N' && billType === 'C'} onClick={() => { setRestriction('N'); setBillType('C'); }}
              title="Bill Later" body="Charges build up during the stay. Takes advances; insurance applies." />
            <Choice active={restriction === 'P'} onClick={() => setRestriction('P')} icon={<Pill className="h-4 w-4" />}
              title="Pharmacy bill" body="Medicines only. Uses pharmacy deposits." />
          </div>
          {chosenVisit?.primary_sponsor && restriction === 'N' && (
            <p className="mt-3 rounded-lg bg-pine-50 px-3 py-2 text-[length:calc(12.5px*var(--fs-scale,1))] text-pine-800">
              {billType === 'C' || meta?.prefs.allow_bill_now_insurance
                ? `${chosenVisit.primary_sponsor} will be connected automatically.`
                : 'Bill Now bills are self-pay. Choose Bill Later to bill the sponsor.'}
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
}

function StepTitle({ n, done, children }: { n: number; done: boolean; children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[length:calc(13px*var(--fs-scale,1))] font-semibold text-ink">
      <span className={clsx('flex h-5 w-5 items-center justify-center rounded-full text-[length:calc(11px*var(--fs-scale,1))]', done ? 'bg-pine-600 text-white' : 'bg-mist-2 text-ink-soft')}>
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      {children}
    </h3>
  );
}

function Choice({ active, onClick, title, body, icon }: { active: boolean; onClick: () => void; title: string; body: string; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={clsx('flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors',
        active ? 'border-pine-500 bg-pine-50' : 'border-line hover:border-line-strong')}>
      <span className={clsx('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', active ? 'border-pine-600 bg-pine-600' : 'border-line-strong')}>
        {active && <span className="h-1.5 w-1.5 rounded-full bg-panel" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[length:calc(14px*var(--fs-scale,1))] font-medium">{icon}{title}</span>
        <span className="block text-[length:calc(12.5px*var(--fs-scale,1))] text-ink-soft">{body}</span>
      </span>
    </button>
  );
}
