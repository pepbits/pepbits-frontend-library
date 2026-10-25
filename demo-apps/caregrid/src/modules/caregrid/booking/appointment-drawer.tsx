'use client';
import React, {useEffect, useState} from 'react';
import {Accessibility, AlertTriangle, Ban, CalendarClock, CheckCircle2, Languages, LogIn, MessageSquare, Play, ShieldAlert, Square, Undo2, UserX} from '@pepbits/icons';
import {Badge, Button, Skeleton} from '@pepbits/ui';
import {Drawer, Modal} from '@pepbits/components';
import {useNavigation} from '@pepbits/platform/navigation';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import {to} from '../../../navigation';
import {useLive} from '../live';
import {useCaregridFormat} from '../format';
import {ACTION_LABEL, OPEN_STATUSES} from '../labels';
import {toMin} from '../time';
import {CatIcon, Chip, QueryError, SegmentStrip, StatusPill} from '../ui';
import {SlotPicker} from './slot-picker';
import type {AppointmentDetail, Slot} from '../types';

const REASONS = ['Patient request', 'Clinically not needed', 'Duplicate booking', 'Resource unavailable', 'Patient admitted'];
const failureText = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Appointment detail with lifecycle commands, rescheduling and cancellation. Every command is acknowledged by the API. */
export function AppointmentDrawer({id, onClose}: {id: number | null; onClose: () => void}) {
  const {client, meta, version} = useLive(), f = useCaregridFormat(), {t} = f, {notify, can} = useScreenHost(), navigation = useNavigation();
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null), [error, setError] = useState<unknown>(null), [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false), [moving, setMoving] = useState(false), [slot, setSlot] = useState<Slot | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false), [reason, setReason] = useState(REASONS[0]!);
  const writable = can('edit');
  useEffect(() => {
    if (!id) {setAppointment(null); setMoving(false); setSlot(null); setError(null); return;}
    const controller = new AbortController();
    client.request<AppointmentDetail>(`/appointments/${id}`, {signal: controller.signal}).then(next => {setAppointment(next); setError(null);}, failure => {if (!controller.signal.aborted) setError(failure);});
    return () => controller.abort();
  }, [client, id, version, attempt]);
  const run = async (command: () => Promise<AppointmentDetail>, success?: string, failureTitle = 'Not changed') => {
    if (busy || !writable) return false;
    setBusy(true);
    try {const next = await command(); setAppointment(next); if (success) notify(`${t(success)}: ${next.patient_name}, ${next.type_name}`, {tone: 'success'}); return true;}
    catch (failure) {notify(`${t(failureTitle)}. ${failureText(failure)}`, {tone: 'warning'}); return false;}
    finally {setBusy(false);}
  };
  const act = (action: string) => run(() => client.request(`/appointments/${id}/status`, {body: {action}}), ACTION_LABEL[action]);
  const move = async () => {if (slot && await run(() => client.request(`/appointments/${id}/reschedule`, {body: {start: slot.start, assignments: slot.assignments}}), 'Moved', 'Could not move')) {setMoving(false); setSlot(null);}};
  const cancel = async () => {if (await run(() => client.request(`/appointments/${id}/cancel`, {body: {reason}}), 'Cancelled', 'Could not cancel')) setCancelOpen(false);};
  const a = appointment, start = a ? toMin(a.start_at) : 0;
  const segments = a?.resources?.map(r => ({label: r.role_label, name: r.resource_name, kind: r.kind, offset: toMin(r.start_at) - start, duration: toMin(r.end_at) - toMin(r.start_at)})) ?? [];
  const canMove = !!a && OPEN_STATUSES.includes(a.status) && writable;
  const footer = a ? <div className="flex w-full flex-wrap items-center gap-2" data-appointment-actions>
    {a.status === 'booked' ? <Button size="sm" variant="outline" disabled={busy || !writable} leftIcon={<CheckCircle2 className="size-4"/>} onClick={() => act('confirm')}>{t('Confirm')}</Button> : null}
    {OPEN_STATUSES.includes(a.status) ? <Button size="sm" disabled={busy || !writable} leftIcon={<LogIn className="size-4"/>} onClick={() => act('check_in')}>{t('Check in')}</Button> : null}
    {a.status === 'checked_in' ? <Button size="sm" disabled={busy || !writable} leftIcon={<Play className="size-4"/>} onClick={() => act('start')}>{t('Start session')}</Button> : null}
    {a.status === 'in_progress' ? <Button size="sm" disabled={busy || !writable} leftIcon={<Square className="size-4"/>} onClick={() => act('complete')}>{t('Complete')}</Button> : null}
    {OPEN_STATUSES.includes(a.status) ? <Button size="sm" variant="ghost" disabled={busy || !writable} leftIcon={<UserX className="size-4"/>} onClick={() => act('no_show')}>{t('No-show')}</Button> : null}
    {['checked_in', 'no_show'].includes(a.status) ? <Button size="sm" variant="ghost" disabled={busy || !writable} leftIcon={<Undo2 className="size-4"/>} onClick={() => act('undo')}>{t('Undo')}</Button> : null}
    <span className="flex-1"/>
    {canMove ? <Button size="sm" variant="outline" leftIcon={<CalendarClock className="size-4"/>} onClick={() => setMoving(value => !value)}>{t(moving ? 'Keep time' : 'Move')}</Button> : null}
    {['booked', 'confirmed', 'checked_in'].includes(a.status) ? <Button size="sm" variant="danger" disabled={!writable} leftIcon={<Ban className="size-4"/>} onClick={() => setCancelOpen(true)}>{t('Cancel')}</Button> : null}
  </div> : undefined;
  return <Drawer open={!!id} onClose={onClose} width="lg" footer={footer} title={a ? a.type_name : 'Appointment'} subtitle={a ? `${a.ref} · ${t(a.priority === 'urgent' ? 'Urgent' : 'Routine')}` : undefined}>
    <div className="space-y-5 px-5 py-4" data-appointment-drawer={id ?? undefined}>
      <QueryError error={error} onRetry={() => setAttempt(n => n + 1)}/>
      {!a && !error ? <div className="space-y-3"><Skeleton className="h-16"/><Skeleton className="h-32"/></div> : null}
      {a ? <>
        <div className="flex flex-wrap items-center gap-2"><CatIcon name={a.category_icon} color={a.dept_color} className="size-5"/><StatusPill status={a.status}/>{a.priority === 'urgent' ? <Badge tone="danger">{t('Urgent')}</Badge> : null}</div>
        {a.queue?.length ? <div role="note" className="flex items-start gap-3 rounded-[var(--radius)] p-3 text-sm cg-wash-warning">
          <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0"/><div className="flex-1"><p className="font-semibold">{t('Needs a new time')}</p><p>{a.queue[0]!.reason}</p></div>
          {canMove && !moving ? <Button size="xs" variant="outline" onClick={() => setMoving(true)}>{t('Find a time')}</Button> : null}
        </div> : null}
        {!writable ? <p className="rounded-[var(--radius)] p-2 text-xs cg-wash-info">{t('Your role can view this appointment but not change it.')}</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius)] bg-[var(--surface-2)] p-3">
            <p className="text-xs text-[var(--text-muted)]">{t('When')}</p>
            <p className="text-base font-semibold">{f.niceDate(a.start_at, meta?.today)}</p>
            <p className="text-sm tabular-nums">{t('{from} to {to}', {from: f.time(a.start_at), to: f.time(a.end_at)})} <span className="text-[var(--text-muted)]">({f.dur(toMin(a.end_at) - toMin(a.start_at))})</span></p>
            {a.checked_in_at || a.actual_start ? <div className="mt-1.5 space-y-0.5 text-[0.75rem] tabular-nums text-[var(--text-muted)]">
              {a.checked_in_at ? <p>{t('Arrived {time}', {time: f.time(a.checked_in_at)})}</p> : null}
              {a.actual_start ? <p>{t('Started {time}', {time: f.time(a.actual_start)})}{a.actual_end ? `, ${t('finished {time} ({n} min)', {time: f.time(a.actual_end), n: f.number(toMin(a.actual_end) - toMin(a.actual_start))})}` : ''}</p> : null}
            </div> : null}
          </div>
          <button type="button" onClick={() => {onClose(); navigation.open(to('caregrid-patients', {id: a.patient_id}));}} className="rounded-[var(--radius)] bg-[var(--surface-2)] p-3 text-start hover:bg-[var(--surface-3)]">
            <span className="block text-xs text-[var(--text-muted)]">{t('Patient')}</span>
            <span className="block text-base font-semibold">{a.patient_name}</span>
            <span className="block text-sm text-[var(--text-muted)]">{a.mrn}{a.phone ? ` · ${a.phone}` : ''}</span>
            <span className="mt-1.5 flex flex-wrap gap-1">
              {a.interpreter_needed ? <Badge tone="info"><Languages aria-hidden className="me-1 inline size-3"/>{t('{language} interpreter', {language: a.language ?? ''})}</Badge> : null}
              {a.mobility && a.mobility !== 'Independent' ? <Badge tone="neutral"><Accessibility aria-hidden className="me-1 inline size-3"/>{a.mobility}</Badge> : null}
              {a.allergies ? <Badge tone="danger"><AlertTriangle aria-hidden className="me-1 inline size-3"/>{a.allergies}</Badge> : null}
            </span>
          </button>
        </div>
        {moving ? <div className="rounded-[var(--radius)] border border-[var(--primary)] p-3" data-move-panel>
          <p className="mb-2 text-sm font-semibold">{t('Pick a new time')}</p>
          <SlotPicker typeId={a.type_id} patientId={a.patient_id} priority={a.priority === 'urgent' ? 'urgent' : 'routine'} excludeApptId={a.id} startDate={meta?.today} preferred={a.resources.map(r => r.resource_id)} selected={slot} onPick={setSlot} compact/>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-[var(--text-muted)]">{slot ? t('Move to {when}', {when: f.niceDateTime(slot.start, meta?.today)}) : t('Same people and machines are preferred where possible.')}</p>
            <Button size="sm" disabled={!slot || busy} onClick={move}>{t('Move appointment')}</Button>
          </div>
        </div> : null}
        <section><h3 className="mb-2 text-sm font-semibold">{t('Reserved resources')}</h3><SegmentStrip segments={segments} total={toMin(a.end_at) - start} detailed/></section>
        {a.prep_instructions || a.requires_consent ? <section className="rounded-[var(--radius)] border border-[var(--border)] p-3 text-sm"><h3 className="font-semibold">{t('Preparation')}</h3>
          {a.prep_instructions ? <p className="mt-1 text-[var(--text-muted)]">{a.prep_instructions}</p> : null}
          {a.requires_consent ? <p className="mt-1" style={{color: 'var(--warning-ink)'}}>{t('Written consent required before the procedure.')}</p> : null}
        </section> : null}
        {a.reminders?.length ? <section><h3 className="mb-2 text-sm font-semibold">{t('Patient reminders')}</h3><ul className="space-y-1.5">
          {a.reminders.map(r => <li key={r.id} className="flex items-start gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs"><MessageSquare aria-hidden className="mt-0.5 size-3.5 shrink-0" style={{color: 'var(--primary)'}}/>
            <div className="flex-1"><p className="font-medium">{r.channel}, {f.niceDateTime(r.send_at, meta?.today)}</p><p className="text-[var(--text-muted)]">{r.message}</p></div><Badge tone={r.status === 'scheduled' ? 'success' : r.status === 'sent' ? 'neutral' : 'danger'}>{t(r.status)}</Badge></li>)}
        </ul></section> : null}
        {a.cancel_reason ? <p className="text-sm text-[var(--text-muted)]">{t('Cancelled: {reason}', {reason: a.cancel_reason})}</p> : null}
        {a.notes ? <p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm"><span className="font-medium">{t('Note')}: </span>{a.notes}</p> : null}
      </> : null}
    </div>
    <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} size="sm" title="Cancel this appointment?" footer={<><Button variant="ghost" onClick={() => setCancelOpen(false)}>{t('Keep it')}</Button><Button variant="danger" disabled={busy} onClick={cancel}>{t('Cancel appointment')}</Button></>}>
      <div className="space-y-3 p-5 text-sm">
        <p className="text-[var(--text-muted)]">{t('All reserved resources are released and the slot is offered to matching waitlisted patients.')}</p>
        <div role="group" aria-label={t('Reason')} className="flex flex-wrap gap-1.5">{REASONS.map(option => <Chip key={option} pressed={reason === option} onClick={() => setReason(option)}>{t(option)}</Chip>)}</div>
      </div>
    </Modal>
  </Drawer>;
}
