'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, AlertTriangle, CalendarCheck, CheckCircle2, Clock, Hourglass, Languages, ListChecks, Repeat, Search, Siren, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, useLive } from '@/lib/live';
import { PATTERN_HINT, SLOT_MODEL_LABEL } from '@/lib/meta';
import { addDays, age, dur, hm, niceDate, niceDateTime, time, WEEKDAYS } from '@/lib/time';
import { Avatar, CatIcon, SegmentStrip, Skeleton } from '@/components/ui/primitives';
import { Availability, Slot, SlotPicker } from '@/components/booking/SlotPicker';

function Step({ n, title, done, children, right }: { n: number; title: string; done?: boolean; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="panel flex h-full min-h-0 flex-col">
      <div className="panel-head">
        <div className="flex items-center gap-2.5">
          <span className={clsx('grid h-6 w-6 place-items-center rounded-full text-xs font-bold', done ? 'bg-teal-600 text-white' : 'bg-ink-100 text-ink')}>
            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
          </span>
          <h2 className="panel-title">{title}</h2>
        </div>
        {right}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
    </section>
  );
}

function PatientStep({ patient, setPatient }: { patient: any; setPatient: (p: any) => void }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ full_name: '', gender: 'Female', dob: '', phone: '', language: 'English' });
  const { data: results } = useApi<any[]>(!patient ? `/patients?q=${encodeURIComponent(q)}` : null, { live: false });
  const { data: detail } = useApi<any>(patient ? `/patients/${patient.id}` : null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!patient) inputRef.current?.focus(); }, [patient]);
  const { toast, meta } = useLive();

  if (patient) {
    const upcoming = (detail?.appointments ?? []).filter((a: any) => ['booked', 'confirmed'].includes(a.status) && a.start_at >= (meta?.now ?? '')).reverse().slice(0, 4);
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-canvas p-3">
          <Avatar name={patient.full_name} className="h-10 w-10 text-sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-ink">{patient.full_name}</div>
            <div className="text-xs text-muted">{patient.mrn}, {patient.gender}, {age(patient.dob)} y</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {patient.interpreter_needed ? <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[0.7rem]"><Languages className="h-3 w-3" />{patient.language}</span> : null}
              {patient.mobility && patient.mobility !== 'Independent' && <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[0.7rem]"><Accessibility className="h-3 w-3" />{patient.mobility}</span>}
              {patient.allergies && <span className="inline-flex items-center gap-1 rounded bg-crimson-50 px-1.5 py-0.5 text-[0.7rem] text-crimson-700"><AlertTriangle className="h-3 w-3" />{patient.allergies}</span>}
            </div>
          </div>
          <button className="btn-ghost btn-xs" onClick={() => setPatient(null)}>Change</button>
        </div>
        {detail && (
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">Upcoming for this patient</div>
            {upcoming.length ? upcoming.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 border-b border-line/70 py-1.5 text-xs last:border-0">
                <CatIcon name={a.category_icon} className="h-3.5 w-3.5" style={{ color: a.dept_color }} />
                <span className="min-w-0 flex-1 truncate">{a.type_name}</span>
                <span className="text-muted tabnum">{niceDateTime(a.start_at)}</span>
              </div>
            )) : <div className="text-xs text-muted">Nothing booked yet.</div>}
          </div>
        )}
      </div>
    );
  }
  if (adding) {
    return (
      <form className="space-y-2.5" onSubmit={async e => {
        e.preventDefault();
        try { const p = await api('/patients', { body: form }); setPatient(p); setAdding(false); }
        catch (err: any) { toast({ level: 'warning', title: 'Patient not saved', body: err.message }); }
      }}>
        <div><label className="label">Full name</label><input className="field" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} autoFocus /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Gender</label><select className="field" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option>Female</option><option>Male</option><option>Other</option></select></div>
          <div><label className="label">Date of birth</label><input type="date" className="field" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Phone</label><input className="field" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Language</label><input className="field" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-ghost btn-sm" onClick={() => setAdding(false)}>Back to search</button><button className="btn-primary btn-sm">Register patient</button></div>
      </form>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input ref={inputRef} className="field pl-9" placeholder="Name, MRN or phone" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!results && <div className="space-y-1.5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-11" />)}</div>}
        {results?.slice(0, 30).map(p => (
          <button key={p.id} onClick={() => setPatient(p)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-canvas">
            <Avatar name={p.full_name} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{p.full_name}</div><div className="text-[0.72rem] text-muted">{p.mrn}, {age(p.dob)} y, {p.phone}</div></div>
            {p.upcoming > 0 && <span className="rounded-full bg-teal-50 px-1.5 text-[0.68rem] font-semibold text-teal-700">{p.upcoming}</span>}
          </button>
        ))}
        {results && !results.length && <div className="py-6 text-center text-sm text-muted">No patient matches “{q}”.</div>}
      </div>
      <button className="btn-outline btn-sm" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> New patient</button>
    </div>
  );
}

function ServiceStep({ type, setType }: { type: any; setType: (t: any) => void }) {
  const { meta } = useLive();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | null>(null);
  const { data: types } = useApi<any[]>('/types', { live: false });
  const list = useMemo(() => (types ?? []).filter(t => (!cat || t.category_id === cat) && (!q || `${t.name} ${t.category_name}`.toLowerCase().includes(q.toLowerCase()))), [types, cat, q]);
  if (type) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl bg-canvas p-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white" style={{ color: type.dept_color }}><CatIcon name={type.category_icon} className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-ink">{type.name}</div>
            <div className="text-xs text-muted">{type.category_name}, {dur(type.duration_min)}, {SLOT_MODEL_LABEL[type.slot_model]}</div>
          </div>
          <button className="btn-ghost btn-xs" onClick={() => setType(null)}>Change</button>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-muted">What this booking reserves</span><span className="text-muted">{type.pattern}</span></div>
          <SegmentStrip detailed total={type.duration_min} segments={type.requirements.map((r: any) => ({ label: r.label, kind: r.kind, offset: r.offset, duration: r.duration }))} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-line p-2"><div className="text-muted">Start times</div><div className="font-medium text-ink">Every {type.slot_step_min} min{type.window_start != null ? `, ${hm(type.window_start)} to ${hm(type.window_end)}` : ''}</div></div>
          <div className="rounded-lg border border-line p-2"><div className="text-muted">Notice</div><div className="font-medium text-ink">{type.min_notice_min ? `At least ${dur(type.min_notice_min)} ahead` : 'Same day allowed'}</div></div>
        </div>
        {type.prep_instructions && <div className="rounded-lg bg-marigold-50 p-2.5 text-xs text-marigold-700"><b>Patient preparation: </b>{type.prep_instructions}</div>}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input className="field pl-9" placeholder="Search 185 services, for example MRI, dialysis, refill" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="flex max-h-[5.6rem] flex-wrap gap-1 overflow-y-auto">
        <button className={clsx('chip', !cat && 'chip-on')} onClick={() => setCat(null)}>All</button>
        {meta?.categories.map(c => (
          <button key={c.id} className={clsx('chip', cat === c.id && 'chip-on')} onClick={() => setCat(cat === c.id ? null : c.id)}>
            <CatIcon name={c.icon} className="h-3.5 w-3.5" style={{ color: cat === c.id ? undefined : c.color }} />{c.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!types && <div className="space-y-1.5">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-11" />)}</div>}
        {list.map(t => (
          <button key={t.id} onClick={() => setType(t)} className="grid w-full grid-cols-[1.75rem_1fr_5.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-canvas">
            <CatIcon name={t.category_icon} className="h-4 w-4" style={{ color: t.dept_color }} />
            <div className="min-w-0"><div className="truncate text-sm text-ink">{t.name}</div><div className="truncate text-[0.7rem] text-muted">{dur(t.duration_min)}, {t.pattern}</div></div>
            <SegmentStrip total={t.duration_min} segments={t.requirements.map((r: any) => ({ label: r.label, kind: r.kind, offset: r.offset, duration: r.duration }))} />
          </button>
        ))}
        {types && !list.length && <div className="py-6 text-center text-sm text-muted">No service matches. Try a shorter word.</div>}
      </div>
    </div>
  );
}

function BookInner() {
  const sp = useSearchParams();
  const { meta, toast } = useLive();
  const [patient, setPatient] = useState<any>(null);
  const [type, setType] = useState<any>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [priority, setPriority] = useState<'routine' | 'urgent'>('routine');
  const [repeat, setRepeat] = useState(false);
  const [series, setSeries] = useState({ weekdays: [1, 3, 5], time: '09:00', occurrences: 6, startDate: '' });
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('desk');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [wlOpen, setWlOpen] = useState(false);
  const waitlistId = sp.get('waitlist');

  useEffect(() => {
    const pid = sp.get('patient'); const tid = sp.get('type');
    if (pid) api(`/patients/${pid}`).then(setPatient).catch(() => {});
    if (tid) api<any[]>('/types').then(ts => setType(ts.find(t => String(t.id) === tid) ?? null)).catch(() => {});
  }, [sp]);
  useEffect(() => { setSlot(null); setDone(null); if (type) setRepeat(false); }, [type, patient]);
  useEffect(() => { if (meta && !series.startDate) setSeries(s => ({ ...s, startDate: meta.today })); }, [meta, series.startDate]);

  const bookOne = async () => {
    if (!patient || !type || !slot) return;
    setBusy(true);
    try {
      const a = await api('/appointments', { body: { patientId: patient.id, typeId: type.id, start: slot.start, assignments: slot.assignments, priority, source, notes: notes || undefined, waitlistId: waitlistId ? Number(waitlistId) : undefined } });
      setDone({ kind: 'one', appt: a }); setSlot(null); setNotes('');
    } catch (e: any) {
      toast({ level: 'warning', title: 'That time was just taken', body: e.detail?.alternatives?.length ? `Nearest free: ${e.detail.alternatives.slice(0, 3).map((s: Slot) => time(s.start)).join(', ')}.` : e.message });
    } finally { setBusy(false); }
  };
  const bookSeries = async () => {
    if (!patient || !type) return;
    setBusy(true);
    try { const r = await api('/appointments/series', { body: { patientId: patient.id, typeId: type.id, ...series, priority, notes: notes || undefined } }); setDone({ kind: 'series', ...r }); }
    catch (e: any) { toast({ level: 'warning', title: 'Course not booked', body: e.message }); }
    finally { setBusy(false); }
  };
  const addWaitlist = async (earliest: string, latest: string) => {
    try { await api('/waitlist', { body: { patientId: patient.id, typeId: type.id, earliest, latest, priority, notes: notes || undefined } }); setWlOpen(false); }
    catch (e: any) { toast({ level: 'warning', title: 'Not added', body: e.message }); }
  };

  const ready = patient && type;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Book an appointment</h1>
          <p className="text-sm text-muted">Patient, service, time. Every person, machine, room and bed the service needs is checked for you.</p>
        </div>
        {waitlistId && <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">Booking from the waitlist</span>}
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(17rem,22rem)_1fr] 2xl:grid-cols-[minmax(17rem,21rem)_minmax(22rem,30rem)_1fr]">
        <div className="flex flex-col gap-2.5 2xl:contents">
          <div className="h-[22rem] lg:h-[calc((100vh-10rem)*0.42)] lg:min-h-[14rem] 2xl:h-[calc(100vh-9.5rem)]"><Step n={1} title="Patient" done={!!patient}><PatientStep patient={patient} setPatient={setPatient} /></Step></div>
          <div className="h-[30rem] lg:h-[calc((100vh-10rem)*0.58)] lg:min-h-[20rem] 2xl:h-[calc(100vh-9.5rem)]"><Step n={2} title="Service" done={!!type}><ServiceStep type={type} setType={setType} /></Step></div>
        </div>

        <Step n={3} title="Time" done={!!slot}
          right={type && (
            <div className="flex items-center gap-2">
              <div className="seg">
                <button data-on={priority === 'routine'} onClick={() => setPriority('routine')}>Routine</button>
                <button data-on={priority === 'urgent'} onClick={() => setPriority('urgent')}><span className="inline-flex items-center gap-1"><Siren className="h-3 w-3" />Urgent</span></button>
              </div>
              <button className={clsx('chip', repeat && 'chip-on')} onClick={() => setRepeat(r => !r)}><Repeat className="h-3.5 w-3.5" />Repeat</button>
            </div>
          )}>
          {done ? (
            <div className="flex flex-col items-center py-8 text-center animate-rise">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-teal-50 text-teal-600"><CalendarCheck className="h-7 w-7" /></div>
              {done.kind === 'one' ? (
                <>
                  <div className="mt-3 text-lg font-semibold text-ink">Booked for {done.appt.patient_name}</div>
                  <div className="text-muted">{done.appt.type_name}, {niceDateTime(done.appt.start_at, meta?.today)}</div>
                  <div className="mt-1 text-sm text-muted">Reference <b className="text-ink">{done.appt.ref}</b>. {done.appt.resources.length} resources reserved, {done.appt.reminders.length} reminder{done.appt.reminders.length === 1 ? '' : 's'} scheduled by {patient?.preferred_channel ?? 'SMS'}.</div>
                </>
              ) : (
                <>
                  <div className="mt-3 text-lg font-semibold text-ink">{done.booked.length} sessions booked</div>
                  <div className="text-sm text-muted">Series {done.seriesId}. {done.booked.filter((b: any) => b.shifted).length} moved to the nearest free time.</div>
                  {done.skipped.length > 0 && <div className="mt-2 max-w-md rounded-lg bg-marigold-50 p-2 text-xs text-marigold-700">Skipped: {done.skipped.map((s: any) => `${niceDate(s.date)} (${s.reason})`).join('; ')}</div>}
                  <div className="mt-3 flex max-w-lg flex-wrap justify-center gap-1">{done.booked.map((b: any) => <span key={b.id} className="chip">{niceDate(b.start)} {time(b.start)}</span>)}</div>
                </>
              )}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => { setType(null); setDone(null); }}>Book another service for this patient</button>
                <button className="btn-outline" onClick={() => { setPatient(null); setType(null); setDone(null); }}>New patient</button>
                {done.kind === 'one' && <Link className="btn-ghost" href={`/schedule?date=${done.appt.start_at.slice(0, 10)}`}>View on schedule board</Link>}
              </div>
            </div>
          ) : !ready ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-2 text-center text-muted">
              <Clock className="h-8 w-8 text-ink-300" />
              <div className="font-medium text-ink">{!patient ? 'Start by choosing a patient' : 'Now choose a service'}</div>
              <div className="max-w-xs text-sm">Free times appear here, already checked against working hours, leave, maintenance and every other booking.</div>
            </div>
          ) : repeat ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">Book a whole course in one step. When the preferred time is taken on a day, CareGrid picks the nearest free time and keeps the same team where possible.</p>
              <div>
                <label className="label">Days</label>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((d, i) => (
                    <button key={d} className={clsx('chip w-12 justify-center', series.weekdays.includes(i) && 'chip-on')}
                      onClick={() => setSeries(s => ({ ...s, weekdays: s.weekdays.includes(i) ? s.weekdays.filter(x => x !== i) : [...s.weekdays, i].sort() }))}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="label">Preferred time</label><input type="time" className="field" value={series.time} onChange={e => setSeries({ ...series, time: e.target.value })} /></div>
                <div><label className="label">Sessions</label><input type="number" min={1} max={60} className="field" value={series.occurrences} onChange={e => setSeries({ ...series, occurrences: Number(e.target.value) })} /></div>
                <div><label className="label">Starting</label><input type="date" className="field" value={series.startDate} onChange={e => setSeries({ ...series, startDate: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                <input className="field max-w-sm" placeholder="Note for the team (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
                <button className="btn-primary" disabled={busy || !series.weekdays.length} onClick={bookSeries}><ListChecks className="h-4 w-4" /> Book {series.occurrences} sessions</button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              <SlotPicker typeId={type.id} patientId={patient.id} priority={priority} startDate={sp.get('date') ?? meta?.today} selected={slot} onPick={setSlot} onData={setAvail} />
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <select className="field w-auto" value={source} onChange={e => setSource(e.target.value)} aria-label="Booking source">
                  <option value="desk">At the desk</option><option value="phone">By phone</option><option value="portal">Patient portal</option><option value="referral">Referral</option><option value="walkin">Walk-in</option>
                </select>
                <input className="field min-w-[10rem] flex-1" placeholder="Note for the team (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
                {avail && (
                  <div className="relative">
                    <button className="btn-ghost btn-sm" onClick={() => setWlOpen(o => !o)}><Hourglass className="h-4 w-4" /> Waitlist</button>
                    {wlOpen && <WaitlistPop today={meta?.today ?? ''} onAdd={addWaitlist} onClose={() => setWlOpen(false)} />}
                  </div>
                )}
                <button className="btn-primary min-w-[9rem]" disabled={!slot || busy} onClick={bookOne}>
                  <CalendarCheck className="h-4 w-4" />{slot ? `Book ${time(slot.start)}` : 'Pick a time'}
                </button>
              </div>
            </div>
          )}
        </Step>
      </div>
    </div>
  );
}

function WaitlistPop({ today, onAdd, onClose }: { today: string; onAdd: (a: string, b: string) => void; onClose: () => void }) {
  const [a, setA] = useState(today); const [b, setB] = useState(addDays(today, 7));
  return (
    <div className="absolute bottom-11 right-0 z-20 w-72 rounded-xl border border-line bg-white p-3 shadow-pop animate-rise">
      <div className="flex items-center justify-between"><div className="text-sm font-semibold text-ink">Add to waitlist</div><button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted" /></button></div>
      <p className="mt-1 text-xs text-muted">You will get an alert as soon as a matching slot frees up.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div><label className="label">From</label><input type="date" className="field" value={a} onChange={e => setA(e.target.value)} /></div>
        <div><label className="label">Until</label><input type="date" className="field" value={b} onChange={e => setB(e.target.value)} /></div>
      </div>
      <button className="btn-primary btn-sm mt-3 w-full" onClick={() => onAdd(a, b)}>Add to waitlist</button>
    </div>
  );
}

export default function BookPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><BookInner /></Suspense>;
}

