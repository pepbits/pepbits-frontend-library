import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, test, vi} from 'vitest';
import {subscribeEventStream, useEventStream, type EventSourceLike} from './event-stream';

class FakeSource implements EventSourceLike {
  static all: FakeSource[] = [];
  listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  constructor(public url: string) {FakeSource.all.push(this);}
  addEventListener(type: string, listener: (event: MessageEvent) => void) {this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);}
  emit(type: string, data: string) {for (const listener of this.listeners.get(type) ?? []) listener(new MessageEvent(type, {data}));}
  close() {this.closed = true;}
}
const create = (url: string) => new FakeSource(url);
afterEach(() => {FakeSource.all = []; vi.useRealTimers();});

test('reports readiness, parses JSON payloads and keeps raw text when it is not JSON', () => {
  const status = vi.fn(), changed = vi.fn(), hello = vi.fn();
  const stop = subscribeEventStream({url: '/events', handlers: {hello, changed}, onStatus: status, readyEvent: 'hello', create});
  const source = FakeSource.all[0]!;
  expect(source.url).toBe('/events');
  expect(status).toHaveBeenLastCalledWith('connecting');
  source.emit('hello', '{"time":"2026-10-24T09:00"}');
  expect(status).toHaveBeenLastCalledWith('live');
  expect(hello).toHaveBeenCalledWith({time: '2026-10-24T09:00'});
  source.emit('changed', 'not json');
  expect(changed).toHaveBeenCalledWith('not json');
  stop();
  expect(source.closed).toBe(true);
});

test('errors close the source, report offline and reconnect after the bounded delay', () => {
  vi.useFakeTimers();
  const status = vi.fn();
  const stop = subscribeEventStream({url: '/events', handlers: {}, onStatus: status, retryMs: 1000, create});
  const first = FakeSource.all[0]!;
  first.onerror?.(new Event('error'));
  expect(first.closed).toBe(true);
  expect(status).toHaveBeenLastCalledWith('offline');
  vi.advanceTimersByTime(999);
  expect(FakeSource.all).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(FakeSource.all).toHaveLength(2);
  stop();
  FakeSource.all[1]!.onerror?.(new Event('error'));
  vi.advanceTimersByTime(5000);
  expect(FakeSource.all).toHaveLength(2);
});

test('late events from a replaced or stopped source are ignored', () => {
  vi.useFakeTimers();
  const handler = vi.fn();
  const stop = subscribeEventStream({url: '/events', handlers: {notice: handler}, retryMs: 10, create});
  const first = FakeSource.all[0]!;
  first.onerror?.(new Event('error'));
  vi.advanceTimersByTime(10);
  first.emit('notice', '1');
  expect(handler).not.toHaveBeenCalled();
  FakeSource.all[1]!.emit('notice', '2');
  expect(handler).toHaveBeenCalledWith(2);
  stop();
  FakeSource.all[1]!.emit('notice', '3');
  expect(handler).toHaveBeenCalledTimes(1);
});

test('the hook uses the latest handlers without reconnecting and disconnects for a null URL', () => {
  const first = vi.fn(), second = vi.fn();
  const {result, rerender} = renderHook(({url, handler}) => useEventStream(url, {notice: handler}, {create}), {initialProps: {url: '/events' as string | null, handler: first}});
  expect(result.current).toBe('connecting');
  act(() => FakeSource.all[0]!.emit('open', ''));
  expect(result.current).toBe('live');
  rerender({url: '/events', handler: second});
  expect(FakeSource.all).toHaveLength(1);
  act(() => FakeSource.all[0]!.emit('notice', '{"id":1}'));
  expect(second).toHaveBeenCalledWith({id: 1});
  expect(first).not.toHaveBeenCalled();
  rerender({url: null, handler: second});
  expect(FakeSource.all[0]!.closed).toBe(true);
  expect(result.current).toBe('offline');
});
