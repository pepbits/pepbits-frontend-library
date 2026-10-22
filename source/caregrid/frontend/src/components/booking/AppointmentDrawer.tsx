'use client';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Accessibility, AlertTriangle, Ban, CalendarClock, CheckCircle2, Languages, LogIn, MessageSquare, Play, ShieldAlert, Square, Undo2, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { useLive } from '@/lib/live';
import { dur, niceDate, niceDateTime, time, toMin } from '@/lib/time';
import { CatIcon, Drawer, ErrorNote, Modal, SegmentStrip, Skeleton, StatusPill } from '@/components/ui/primitives';
import { Slot, SlotPicker } from './SlotPicker';

export function AppointmentDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { toast, meta, version } = useLive();
  const [a, setA] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('Patient request');

  useEffect(() => {
    if (!id) { setA(null); setMoving(false); setSlot(null); return; }
    api(`/appointments/${id}`).then(x => { setA(x); setErr(null); }).catch(e => setErr(e.message));
  }, [id, version]);

  const act = async (action: string, label: string) => {
    setBusy(true);
    try { const x = await api(`/appointments/${id}/status`, { body: { action } }); setA(x); toast({ level: 'success', title: label, body: `${x.patient_name}, ${x.type_name}` }); }
    catch (e: any) { toast({ level: 'warning', title: 'Not changed', body: e.message }); }
    finally { setBusy(false); }
  };
  const move = async () => {
    if (!slot) return; setBusy(true);
    try { const x = await api(`/appointments/${id}/reschedule`, { body: { start: slot.start, assignments: slot.assignments } }); setA(x); setMoving(false); setSlot(null); }
    catch (e: any) { toast({ level: 'warning', title: 'Could not move', body: e.message }); }
    finally { setBusy(false); }
  };
  const doCancel = async () => {
    setBusy(true);
    try { const x = await api(`/appointments/${id}/cancel`, { body: { reason } }); setA(x); setCancelOpen(false); }
    catch (e: any) { toast({ level: 'warning', title: 'Could not cancel', body: e.message }); }
    finally { setBusy(false); }
  };

  const start = a ? toMin(a.start_at) : 0;
  const segs = a?.resources?.map((r: any) => ({ label: r.role_label, name: r.resource_name, kind: r.kind, offset: toMin(r.start_at) - start, duration: toMin(r.end_at) - toMin(r.start_at) })) ?? [];
  const canMove = a && ['booked', 'confirmed'].includes(a.status);

  const footer = a && (
    <div className="flex flex-wrap items-center gap-2">
      {a.status === 'booked' && <button className="btn-outline btn-sm" disabled={busy} onClick={() => act('confirm', 'Confirmed')}><CheckCircle2 className="h-4 w-4" /> Confirm</button>}
      {['booked', 'confirmed'].includes(a.status) && <button className="btn-primary btn-sm" disabled={busy} onClick={() => act('check_in', 'Checked in')}><LogIn className="h-4 w-4" /> Check in</button>}
      {a.status === 'checked_in' && <button className="btn-primary btn-sm" disabled={busy} onClick={() => act('start', 'Session started')}><Play className="h-4 w-4" /> Start session</button>}
      {a.status === 'in_progress' && <button className="btn-primary btn-sm" disabled={busy} onClick={() => act('complete', 'Completed')}><Square className="h-4 w-4" /> Complete</button>}
      {['booked', 'confirmed'].includes(a.status) && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act('no_show', 'Marked as no-show')}><UserX className="h-4 w-4" /> No-show</button>}
      {['checked_in', 'no_show'].includes(a.status) && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => act('undo', 'Status reset')}><Undo2 className="h-4 w-4" /> Undo</button>}
      <div className="ml-auto flex gap-2">
        {canMove && <button className="btn-outline btn-sm" onClick={() => setMoving(m => !m)}><CalendarClock className="h-4 w-4" /> {moving ? 'Keep time' : 'Move'}</button>}
        {['booked', 'confirmed', 'checked_in'].includes(a.status) && <button className="btn-ghost btn-sm text-crimson-600 hover:bg-crimson-50" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" /> Cancel</button>}
      </div>
    </div>
  );

  return (
    <Drawer open={!!id} onClose={onClose} width="max-w-[40rem]" footer={footer}
      title={a ? <span className="flex items-center gap-2"><CatIcon name={a.category_icon} className="h-5 w-5" style={{ color: a.dept_color }} />{a.type_name}</span> : 'Appointment'}
      subtitle={a ? <span className="flex items-center gap-2">{a.ref} <StatusPill status={a.status} /> {a.priority === 'urgent' && <span className="rounded-full bg-crimson-50 px-2 py-0.5 text-[0.7rem] font-semibold text-crimson-700">Urgent</span>}</span> : undefined}>
      {err && <ErrorNote message={err} />}
      {!a && !err && <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-32" /></div>}
      {a && (
        <div className="space-y-5">
          {a.queue?.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-marigold-100 bg-marigold-50 p-3 text-sm text-marigold-700">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1"><div className="font-semibold">Needs a new time</div><div>{a.queue[0].reason}</div></div>
              {canMove && !moving && <button className="btn-outline btn-xs" onClick={() => setMoving(true)}>Find a time</button>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-canvas p-3">
              <div className="text-xs text-muted">When</div>
              <div className="text-base font-semibold text-ink">{niceDate(a.start_at, meta?.today)}</div>
              <div className="text-sm tabnum">{time(a.start_at)} to {time(a.end_at)} <span className="text-muted">({dur(toMin(a.end_at) - toMin(a.start_at))})</span></div>
              {(a.checked_in_at || a.actual_start) && (
                <div className="mt-1.5 space-y-0.5 text-[0.75rem] text-muted tabnum">
                  {a.checked_in_at && <div>Arrived {time(a.checked_in_at)}</div>}
                  {a.actual_start && <div>Started {time(a.actual_start)}{a.actual_end ? `, finished ${time(a.actual_end)} (${toMin(a.actual_end) - toMin(a.actual_start)} min)` : ''}</div>}
                </div>
              )}
            </div>
            <Link href={`/patients?id=${a.patient_id}`} className="rounded-xl bg-canvas p-3 hover:bg-ink-100/60">
              <div className="text-xs text-muted">Patient</div>
              <div className="text-base font-semibold text-ink">{a.patient_name}</div>
              <div className="text-sm text-muted">{a.mrn} {a.phone && <span className="ml-1">{a.phone}</span>}</div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {a.interpreter_needed ? <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[0.7rem]"><Languages className="h-3 w-3" />{a.language} interpreter</span> : null}
                {a.mobility && a.mobility !== 'Independent' && <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[0.7rem]"><Accessibility className="h-3 w-3" />{a.mobility}</span>}
                {a.allergies && <span className="inline-flex items-center gap-1 rounded bg-crimson-50 px-1.5 py-0.5 text-[0.7rem] text-crimson-700"><AlertTriangle className="h-3 w-3" />{a.allergies}</span>}
              </div>
            </Link>
          </div>

          {moving && (
            <div className="rounded-xl border border-teal-200 p-3">
              <div className="mb-2 text-sm font-semibold text-ink">Pick a new time</div>
              <SlotPicker typeId={a.type_id} patientId={a.patient_id} priority={a.priority} excludeApptId={a.id} startDate={meta?.today}
                preferred={a.resources.map((r: any) => r.resource_id)} selected={slot} onPick={setSlot} compact />
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-sm text-muted">{slot ? <>Move to <b className="text-ink">{niceDateTime(slot.start, meta?.today)}</b></> : 'Same people and machines are preferred where possible.'}</div>
                <button className="btn-primary btn-sm" disabled={!slot || busy} onClick={move}>Move appointment</button>
              </div>
            </div>
          )}

          <section>
            <div className="mb-2 text-sm font-semibold text-ink">Reserved resources</div>
            <SegmentStrip segments={segs} total={toMin(a.end_at) - start} detailed />
          </section>

          {(a.prep_instructions || a.requires_consent) && (
            <section className="rounded-xl border border-line p-3 text-sm">
              <div className="font-semibold text-ink">Preparation</div>
              {a.prep_instructions && <p className="mt-1 text-muted">{a.prep_instructions}</p>}
              {a.requires_consent ? <p className="mt-1 text-marigold-700">Written consent required before the procedure.</p> : null}
            </section>
          )}

          {a.reminders?.length > 0 && (
            <section>
              <div className="mb-2 text-sm font-semibold text-ink">Patient reminders</div>
              <div className="space-y-1.5">
                {a.reminders.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg bg-canvas px-3 py-2 text-xs">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                    <div className="flex-1"><span className="font-medium text-ink">{r.channel}, {niceDateTime(r.send_at, meta?.today)}</span><div className="text-muted">{r.message}</div></div>
                    <span className={clsx('rounded px-1.5 py-0.5 text-[0.65rem] font-semibold', r.status === 'scheduled' ? 'bg-teal-50 text-teal-700' : r.status === 'sent' ? 'bg-ink-100 text-ink-600' : 'bg-crimson-50 text-crimson-700')}>{r.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {a.cancel_reason && <div className="text-sm text-muted">Cancelled: {a.cancel_reason}</div>}
          {a.notes && <div className="rounded-lg bg-canvas p-3 text-sm"><span className="font-medium">Note: </span>{a.notes}</div>}
        </div>
      )}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this appointment?"
        footer={<><button className="btn-ghost" onClick={() => setCancelOpen(false)}>Keep it</button><button className="btn-danger" disabled={busy} onClick={doCancel}>Cancel appointment</button></>}>
        <p className="text-muted">All reserved resources are released and the slot is offered to matching waitlisted patients.</p>
        <label className="label mt-3">Reason</label>
        <div className="flex flex-wrap gap-1.5">
          {['Patient request', 'Clinically not needed', 'Duplicate booking', 'Resource unavailable', 'Patient admitted'].map(r => (
            <button key={r} className={clsx('chip', reason === r && 'chip-on')} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
      </Modal>
    </Drawer>
  );
}
