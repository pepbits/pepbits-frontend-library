import {vi} from 'vitest';
import type {EventSourceLike} from '@pepbits/platform/event-stream';
import {createCaregridClient} from '../adapters/caregrid';
import fixtures from './fixtures.json';

type Json = unknown;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** Fictional HTTP double of the unchanged CareGrid API. Writes mutate an in-memory copy so commands can be asserted. */
export function mockCaregrid(options: {fail?: Record<string, {status: number; body?: Json}>} = {}) {
  const state = clone(fixtures) as typeof fixtures & {appointments: (typeof fixtures.appointments[number] & Record<string, unknown>)[]};
  const fail = {...options.fail};
  const calls: {method: string; path: string; body?: Json}[] = [];
  const detail = (id: number) => {const row = state.appointments.find(a => a.id === id) ?? state.appointments[0]!; return {...state.appointment, ...row, id, resources: state.appointment.resources, reminders: state.appointment.reminders, queue: id === state.queue[0]?.appointment_id ? [{reason: state.queue[0]!.reason}] : []};};
  const route = (method: string, path: string, body: Json): Json => {
    const [pathname] = path.split('?');
    const parts = pathname!.split('/').filter(Boolean);
    if (method === 'GET') {
      if (pathname === '/meta') return state.meta;
      if (pathname === '/notifications') return state.notifications;
      if (pathname === '/analytics/summary') return state.summary;
      if (pathname === '/analytics/durations') return state.durations;
      if (pathname === '/analytics/utilization') return state.utilization;
      if (pathname === '/queue') return state.queue;
      if (parts[0] === 'queue' && parts[2] === 'suggestions') return state.suggestions;
      if (pathname === '/types') return path.includes('category=') ? state.types.filter(t => path.includes('category=' + t.category_id)) : state.types;
      if (parts[0] === 'types') return {...state.type, id: Number(parts[1])};
      if (pathname === '/patients') return state.patients;
      if (parts[0] === 'patients') return {...state.patient, id: Number(parts[1])};
      if (pathname === '/resources') return state.resources;
      if (parts[0] === 'resources') return {...state.resource, id: Number(parts[1])};
      if (pathname === '/exceptions') return state.exceptions;
      if (pathname === '/holidays') return state.holidays;
      if (pathname === '/waitlist') return state.waitlist;
      if (pathname === '/search') return state.search;
      if (pathname === '/schedule') return state.schedule;
      if (pathname === '/appointments') return state.appointments;
      if (parts[0] === 'appointments') return detail(Number(parts[1]));
      if (pathname === '/reminders') return state.reminders;
      if (pathname === '/availability') return state.availability;
    }
    if (method === 'POST') {
      if (parts[0] === 'appointments' && parts[2] === 'status') {
        const action = (body as {action: string}).action, next = {confirm: 'confirmed', check_in: 'checked_in', start: 'in_progress', complete: 'completed', no_show: 'no_show', undo: 'booked'}[action] ?? 'booked';
        const row = state.appointments.find(a => a.id === Number(parts[1]));
        if (row) Object.assign(row, {status: next, checked_in_at: next === 'checked_in' ? '2026-10-24T09:00' : row.checked_in_at, actual_start: next === 'in_progress' ? '2026-10-24T09:05' : row.actual_start});
        return {...detail(Number(parts[1])), status: next};
      }
      if (parts[0] === 'appointments' && (parts[2] === 'reschedule' || parts[2] === 'cancel')) return {...detail(Number(parts[1])), status: parts[2] === 'cancel' ? 'cancelled' : 'booked'};
      if (pathname === '/appointments/series') return {seriesId: 'S-FICTIONAL', booked: [{id: 9001, start: '2026-10-26T09:00'}, {id: 9002, start: '2026-10-28T09:15', shifted: true}], skipped: []};
      if (pathname === '/appointments') return {ref: 'CG-FICTIONAL-1', patient_name: state.patient.full_name, type_name: state.type.name, start_at: (body as {start: string}).start, resources: state.appointment.resources, reminders: state.appointment.reminders};
      if (pathname === '/patients') return {...state.patients[0], id: 9999, full_name: (body as {full_name: string}).full_name, mrn: 'CG-NEW'};
      if (pathname === '/exceptions/preview') return {impacted: state.appointments.slice(0, 2)};
      if (pathname === '/exceptions') return {id: 77, impacted: 2};
      if (pathname === '/holidays') return {id: 5, impacted: 0};
      if (pathname === '/waitlist') return {id: 31};
      if (pathname === '/queue/auto') return {moved: [], failed: []};
      return {ok: true};
    }
    if (method === 'PATCH') return parts[0] === 'types' ? {...state.type, ...(body as object)} : {ok: true};
    if (method === 'PUT') return {ok: true, flagged: 0};
    if (method === 'DELETE') return {ok: true};
    throw new Error(`Unexpected ${method} ${path}`);
  };
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(/^\/caregrid-api/, ''), method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) as Json : undefined;
    calls.push({method, path: url, body});
    const failure = Object.entries(fail).find(([key]) => `${method} ${url}`.startsWith(key));
    if (failure) return Response.json(failure[1].body ?? {error: 'Fictional failure'}, {status: failure[1].status});
    return Response.json(route(method, url, body));
  });
  const client = createCaregridClient('/caregrid-api', fetch as unknown as typeof globalThis.fetch);
  return {client, fetch, calls, state, fail, writes: () => calls.filter(c => c.method !== 'GET')};
}

/** Controllable stand-in for the browser EventSource. */
export class FakeEventSource implements EventSourceLike {
  static all: FakeEventSource[] = [];
  listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  constructor(public url: string) {FakeEventSource.all.push(this);}
  addEventListener(type: string, listener: (event: MessageEvent) => void) {this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);}
  emit(type: string, data: unknown) {for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type, {data: JSON.stringify(data)}));}
  close() {this.closed = true;}
  static latest() {return FakeEventSource.all.at(-1)!;}
}
export const createFakeEventSource = (url: string) => new FakeEventSource(url);
