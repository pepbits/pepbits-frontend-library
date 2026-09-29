'use client';
import {useLocalization as useHealthcareLocalization} from '@pepbits/ops-ui';
import {LocalizedText} from '@pepbits/ops-ui';
import {useReferenceHost} from '@pepbits/reference-host';
import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, RefreshCw, UserRoundX, X } from 'lucide-react';
import { useReferenceRouter, useReferenceSearchParams } from '@pepbits/reference-host';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { AppointmentPanel } from '../../components/appointments/AppointmentPanel';
import { BookingPanel } from '../../components/appointments/BookingPanel';
import { SlotBoard } from '../../components/appointments/SlotBoard';
import { PickedSlot, SlotBoardData } from '../../components/appointments/types';
import { RefSelect } from '../../components/masters/RefSelect';
import { PatientBanner } from '../../components/patients/PatientBanner';
import { Button, Input, SearchInput, Segmented , DateInput} from '../../components/ui/controls';
import { Column, DataTable } from '../../components/ui/DataTable';
import { EmptyState, ErrorBanner, Spinner, StatusBadge } from '../../components/ui/display';
import { useToast } from '../../components/ui/Toast';
import { useApiClient, errorMessage, qs } from '../../lib/api';
import { addDays, todayIso, useFormat } from '../../lib/format';
import { useApi, useDebounced, useInterval } from '../../lib/hooks';
import { usePageHeader } from '../../lib/session';
import { Page, PatientSummary, Row } from '../../lib/types';

const STATUSES = ['Booked', 'Confirmed', 'Arrived', 'In Consultation', 'Completed', 'No-show', 'Cancelled'];

function Appointments() {
 const {t:healthcareT}=useHealthcareLocalization();
  const {preferences} = useReferenceHost();
  const api = useApiClient();
  const { fmtDay , fmtTime } = useFormat();
  usePageHeader(healthcareT("Appointments"), healthcareT("Resource availability, bookings and check-in"));
  const router = useReferenceRouter();
  const sp = useReferenceSearchParams();
  const toast = useToast();
  const [date, setDate] = useState(sp.get('date') || todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [resourceType, setResourceType] = useState<'All' | 'Provider' | 'Room' | 'Equipment'>('All');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickedSlot | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [preset, setPreset] = useState<PatientSummary | null>(null);
  const resourceId = sp.get('resourceId') ?? '';
  const isToday = date === todayIso();

  const slotsUrl = `/scheduling/slots${qs({ date, departmentId, resourceType: resourceType === 'All' ? '' : resourceType, resourceIds: resourceId })}`;
  const slots = useApi<SlotBoardData>(slotsUrl);
  const dq = useDebounced(search, 250);
  const list = useApi<Page>(`/appointments${qs({ date, departmentId, search: dq, resourceId, pageSize: 500 })}`);
  const reload = () => { slots.reload(); list.reload(); };
  useInterval(reload, 30000);

  useEffect(() => {
    const pid = sp.get('patientId');
    if (pid) api<PatientSummary>(`/patients/${pid}`).then(setPreset).catch(() => undefined);
    const focus = sp.get('focus');
    if (focus) api<Row>(`/appointments/${focus}`).then(setSelected).catch(() => undefined);
  }, []); // eslint-disable-hc-line react-hooks/exhaustive-deps
  useEffect(() => { setPicked(null); setRescheduling(false); }, [date, departmentId, resourceType]);

  const rows = list.data?.data ?? [];
  const counts = useMemo(() => STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((x) => x.n), [rows]);
  const nextUp = rows.filter((r) => ['Booked', 'Confirmed', 'Arrived'].includes(r.status)).slice(0, 12);

  const move = async (r: PickedSlot) => {
    if (!selected) return;
    try {
      const a = await api<Row>(`/appointments/${selected.id}/reschedule`, { method: 'PUT', body: { resourceId: r.resource.id, date: r.date, startTime: r.slot.start } });
      toast({ tone: 'ok', title: healthcareT("{v0} moved",{v0:a.apptNo}), body: healthcareT("{v0} at {v1}",{v0:a.resourceName,v1:a.startTime}) });
      setSelected(a); setRescheduling(false); reload();
    } catch (e) { toast({ tone: 'danger', title: healthcareT("Could not reschedule"), body: errorMessage(e) }); }
  };

  const columns: Column<Row>[] = [
    { key: 'startTime', header: 'Time', width: '90px', render: (a) => <span className="hc-num font-medium">{fmtTime(a.startTime)}-{fmtTime(a.endTime)}</span> },
    { key: 'patient', header: 'Patient', render: (a) => <span className="flex items-center gap-1.5">{!a.patientId && <UserRoundX className="h-3.5 w-3.5 text-hc-selfpay-600" />}<span className="font-medium">{a.patientName || a.guestName}</span><span className="font-mono text-hc-2xs text-hc-ink-mute">{a.mrn || 'No MRN'}</span></span> },
    { key: 'phone', header: 'Mobile', render: (a) => <span className="hc-num">{a.phone || a.guestPhone}</span> },
    { key: 'resourceName', header: 'Resource' },
    { key: 'departmentName', header: 'Department' },
    { key: 'reason', header: 'Reason', render: (a) => <span className="text-hc-ink-soft">{a.reason}</span> },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="hc-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hc-line px-3 py-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} />
            <DateInput value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="!h-7 w-[140px] text-hc-xs" aria-label="Date" />
            <Button size="sm" variant="ghost" icon={<ChevronRight className="h-4 w-4" />} aria-label="Next day" onClick={() => setDate(addDays(date, 1))} />
            <Button size="sm" variant={isToday ? 'subtle' : 'secondary'} onClick={() => setDate(todayIso())}><LocalizedText message="Today" /></Button>
          </div>
          <span className="hidden text-hc-sm font-medium 2xl:inline">{fmtDay(date)}</span>
          <div className="w-48"><RefSelect entity="departments" params={{ type: 'Clinical,Diagnostic,Nursing' }} value={departmentId} onChange={setDepartmentId} placeholder="All departments" /></div>
          <Segmented size="sm" value={resourceType} onChange={setResourceType} options={(['All', 'Provider', 'Room', 'Equipment'] as const).map((v) => ({ value: v, label: v === 'All' ? 'All' : v === 'Equipment' ? 'Equipment' : `${v}s` }))} />
          {resourceId && <Button size="xs" variant="subtle" icon={<X className="h-3 w-3" />} onClick={() => router.replace('/appointments')}><LocalizedText message="Resource" /> {resourceId}</Button>}
          <div className="ml-auto flex items-center gap-1.5">
            {view === 'list' && <SearchInput value={search} onChange={setSearch} placeholder="Patient, MRN, mobile" className="w-52" />}
            <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reload} aria-label="Refresh" />
            <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'board', label: 'Board', icon: <LayoutGrid className="h-3.5 w-3.5" /> }, { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" /> }]} />
          </div>
        </div>
        {(slots.error || list.error) && <div className="p-3"><ErrorBanner message={(slots.error || list.error)!.message} onRetry={reload} /></div>}
        {view === 'board' ? (
          slots.data ? (
            slots.data.resources.length ? (
              <SlotBoard
                data={slots.data}
                isToday={isToday}
                picked={picked}
                rescheduling={rescheduling}
                selectedApptId={selected?.id ?? null}
                onPickSlot={(resource, slot) => {
                  const p = { resource, slot, date };
                  if (rescheduling) move(p); else { setPicked(p); setSelected(null); }
                }}
                onPickAppointment={(a) => { setSelected(a); setPicked(null); setRescheduling(false); }}
              />
            ) : <EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No bookable resources" body="No resource matches these filters. Set up resources and their availability under Scheduling setup." />
          ) : <div className="flex flex-1 items-center justify-center"><Spinner label="Loading availability" /></div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(a) => a.id} loading={list.loading} selectedKey={selected?.id} onRowClick={(a) => { setSelected(a); setPicked(null); }}
            empty={<EmptyState icon={<CalendarDays className="h-8 w-8" />} title="No appointments" body="Switch to the board to book a slot." />} />
        )}
        <div className="flex h-8 shrink-0 items-center gap-4 border-t border-hc-line px-3 text-hc-2xs text-hc-ink-mute">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-hc-petrol-300 bg-hc-petrol-50" /><LocalizedText message="Booked" /></span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-hc-ok-100 bg-hc-ok-50" /><LocalizedText message="Arrived" /></span>
          <span className="flex items-center gap-1"><UserRoundX className="h-3 w-3 text-hc-selfpay-600" /><LocalizedText message="No MRN yet" /></span>
          <span className="flex items-center gap-1"><span className="hc-hatch h-2.5 w-2.5 rounded-sm" /><LocalizedText message="Blocked" /></span>
          <span className="ml-auto"><LocalizedText message="Click an empty slot to book · auto-refreshes every 30s" /></span>
        </div>
      </div>

      <aside className="hc-panel flex w-[360px] shrink-0 flex-col overflow-hidden">
        {picked && !rescheduling ? (
          <BookingPanel
            key={`${picked.resource.id}-${picked.slot.start}-${date}`}
            picked={picked}
            preset={preset}
            onCancel={() => setPicked(null)}
            onBooked={(a) => { setPicked(null); setSelected(a); setPreset(null); reload(); }}
          />
        ) : selected ? (
          <AppointmentPanel
            key={selected.id}
            appt={selected}
            rescheduling={rescheduling}
            onClose={() => { setSelected(null); setRescheduling(false); }}
            onReschedule={() => setRescheduling((r) => !r)}
            onChanged={(a) => { setSelected(a); reload(); }}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {preset && (
              <div className="space-y-2 border-b border-hc-line bg-hc-petrol-50/50 p-3">
                <p className="flex items-center justify-between text-hc-xs font-medium text-hc-petrol-700"><LocalizedText message="Booking for" /> <button type="button" className="text-hc-ink-mute hover:text-hc-ink" onClick={() => setPreset(null)} aria-label="Clear"><X className="h-3.5 w-3.5" /></button></p>
                <PatientBanner patient={preset} policy={preset.primaryPolicy} compact />
                <p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Pick a free slot on the board." /></p>
              </div>
            )}
            <div className="border-b border-hc-line p-3">
              <p className="text-hc-xs font-semibold text-hc-ink-soft">{isToday ? <LocalizedText message="Today"/> : fmtDay(date)}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="rounded-md bg-hc-canvas px-2 py-1.5"><p className="hc-num text-hc-lg font-semibold">{rows.filter((r) => !['Cancelled'].includes(r.status)).length}</p><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Booked" /></p></div>
                <div className="rounded-md bg-hc-canvas px-2 py-1.5"><p className="hc-num text-hc-lg font-semibold">{slots.data?.resources.reduce((s, r) => s + r.free, 0) ?? '-'}</p><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="Free slots" /></p></div>
                <div className="rounded-md bg-hc-canvas px-2 py-1.5"><p className="hc-num text-hc-lg font-semibold text-hc-selfpay-700">{rows.filter((r) => !r.patientId && r.status !== 'Cancelled').length}</p><p className="text-hc-2xs text-hc-ink-mute"><LocalizedText message="No MRN" /></p></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">{counts.map(({ s, n }) => <span key={s} className="inline-flex items-center gap-1"><StatusBadge status={s} /><span className="hc-num text-hc-2xs text-hc-ink-mute">{n}</span></span>)}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              <p className="px-1 pb-1 text-hc-xs font-semibold text-hc-ink-soft"><LocalizedText message="Next up" /></p>
              {nextUp.length === 0 ? <EmptyState className="!py-6" title="Nothing waiting" /> : nextUp.map((a) => (
                <button key={a.id} type="button" onClick={() => setSelected(a)} className={clsx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-hc-xs hover:bg-hc-canvas')}>
                  <span className="hc-num w-10 shrink-0 font-semibold">{fmtTime(a.startTime)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.patientName || a.guestName}</span><span className="block truncate text-hc-2xs text-hc-ink-mute">{a.resourceName}</span></span>
                  <StatusBadge status={a.status} />
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function AppointmentsPage() { return <Suspense><Appointments /></Suspense>; }
