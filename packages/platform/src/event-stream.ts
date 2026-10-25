import {useEffect, useRef, useState} from 'react';

/** Connection state reported to the host. `live` means the server has confirmed the stream. */
export type EventStreamStatus = 'connecting' | 'live' | 'offline';
/** The subset of the browser EventSource used here, so hosts and tests can supply their own. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
  onerror: ((event: Event) => void) | null;
}
export type EventStreamHandlers = Readonly<Record<string, (data: unknown) => void>>;
export interface EventStreamOptions {
  /** Absolute or same-origin URL chosen by the host. No origin is inferred. */
  url: string;
  handlers: EventStreamHandlers;
  onStatus?: (status: EventStreamStatus) => void;
  /** Event that confirms the stream; the standard `open` event is used when omitted. */
  readyEvent?: string;
  /** Delay before reconnecting after an error. Defaults to 4 seconds. */
  retryMs?: number;
  create?: (url: string) => EventSourceLike;
}

const parse = (raw: unknown) => {
  if (typeof raw !== 'string') return raw;
  try {return JSON.parse(raw) as unknown;} catch {return raw;}
};

/**
 * Subscribe to a Server-Sent Events stream with bounded reconnection.
 * Returns an unsubscribe function; after it runs no handler or status callback fires.
 * The stream carries notifications only: hosts must still read authoritative state over HTTP.
 */
export function subscribeEventStream({url, handlers, onStatus, readyEvent = 'open', retryMs = 4000, create}: EventStreamOptions): () => void {
  const factory = create ?? ((target: string) => new EventSource(target) as unknown as EventSourceLike);
  let source: EventSourceLike | null = null, timer: ReturnType<typeof setTimeout> | undefined, active = true;
  const connect = () => {
    if (!active) return;
    onStatus?.('connecting');
    let current: EventSourceLike;
    try {current = factory(url);} catch {onStatus?.('offline'); timer = setTimeout(connect, retryMs); return;}
    source = current;
    current.addEventListener(readyEvent, event => {if (active && source === current) {onStatus?.('live'); if (readyEvent !== 'open') handlers[readyEvent]?.(parse(event.data));}});
    for (const [type, handler] of Object.entries(handlers)) {
      if (type === readyEvent && readyEvent !== 'open') continue;
      current.addEventListener(type, event => {if (active && source === current) handler(parse(event.data));});
    }
    current.onerror = () => {
      if (!active || source !== current) return;
      onStatus?.('offline'); current.close(); source = null;
      timer = setTimeout(connect, retryMs);
    };
  };
  connect();
  return () => {active = false; clearTimeout(timer); source?.close(); source = null;};
}

/** React binding. Handlers are read through a ref, so changing them does not reconnect. A null URL disconnects. */
export function useEventStream(url: string | null, handlers: EventStreamHandlers, options: Omit<EventStreamOptions, 'url' | 'handlers' | 'onStatus'> = {}): EventStreamStatus {
  const [status, setStatus] = useState<EventStreamStatus>(url ? 'connecting' : 'offline');
  const latest = useRef(handlers);
  latest.current = handlers;
  const {readyEvent, retryMs, create} = options;
  const keys = Object.keys(handlers).sort().join('|');
  useEffect(() => {
    if (!url) {setStatus('offline'); return;}
    const proxied = Object.fromEntries(keys.split('|').filter(Boolean).map(type => [type, (data: unknown) => latest.current[type]?.(data)]));
    return subscribeEventStream({url, handlers: proxied, onStatus: setStatus, readyEvent, retryMs, create});
  }, [url, keys, readyEvent, retryMs, create]);
  return status;
}
