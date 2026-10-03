"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReferenceHost } from "@pepbits/reference-host";
import { ApiError, type TeleconsultClient } from "./client";
import { normalizeFrames } from "./contract";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isAbort = (error: unknown) => (error as { name?: string })?.name === "AbortError";

/**
 * GET resource with an AbortController per request and a sequence guard: a response that arrives after
 * the path, client (scope/role/beneficiary) or component changed is discarded, never applied.
 * Silent polls skip a tick while a request is still in flight; reload() supersedes it.
 */
export function useApiResource<T>(client: TeleconsultClient, path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(Boolean(path));
  const seq = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (silent = false, force = false) => {
    if (!path) return;
    if (silent && !force && inFlight.current) return;
    controller.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    const n = ++seq.current;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const value = await client.get<T>(path, { signal: mine.signal });
      if (n === seq.current) { setData(value); setError(undefined); }
    } catch (e) {
      if (n === seq.current && !isAbort(e)) setError(message(e));
    } finally {
      if (n === seq.current) { inFlight.current = false; setLoading(false); }
    }
  }, [client, path]);

  // A different client means a different scope, role or beneficiary: drop what the previous one returned.
  useEffect(() => { setData(undefined); setError(undefined); }, [client]);

  useEffect(() => {
    void load();
    const timer = opts.poll ? setInterval(() => void load(true), opts.poll) : undefined;
    return () => {
      if (timer) clearInterval(timer);
      seq.current++;
      inFlight.current = false;
      controller.current?.abort();
    };
  }, [load, opts.poll]);

  const reload = useCallback(() => load(true, true), [load]);
  return { data, error, loading, reload, setData };
}

/** A 4xx other than timeout/rate-limit will not fix itself on the next tick. */
const permanent = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;

/**
 * Authenticated polling for the live vitals/transcript `/current` endpoints (the replacement for
 * EventSource, which cannot carry credentials). One request at a time, cancelled on unmount or when the
 * path/client changes, and stopped when the server reports `done` or a permanent 4xx.
 */
export function useLivePoll<T>(
  client: TeleconsultClient,
  path: string | null,
  onFrames: (frames: T[]) => void,
  opts: { intervalMs: number; isDone?: (frame: T) => boolean },
) {
  const callback = useRef(onFrames);
  callback.current = onFrames;
  const done = useRef(opts.isDone);
  done.current = opts.isDone;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!path) { setConnected(false); return; }
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let next = true;
      try {
        const frames = normalizeFrames<T>(await client.get<unknown>(path, { signal: controller.signal }));
        if (stopped) return;
        setConnected(true);
        setError(undefined);
        if (frames.length) callback.current(frames);
        if (done.current && frames.some(done.current)) next = false;
      } catch (e) {
        if (stopped || isAbort(e)) return;
        setConnected(false);
        setError(message(e));
        if (permanent(e)) next = false;
      }
      if (next && !stopped) timer = setTimeout(tick, opts.intervalMs);
    };
    void tick();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      setConnected(false);
    };
  }, [client, path, opts.intervalMs]);

  return { connected, error };
}

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Keyboard shortcut that is attached only while the effective keyboardShortcuts preference is on. */
export function useHotkey(match: (e: KeyboardEvent) => boolean, handler: (e: KeyboardEvent) => void) {
  const enabled = useReferenceHost().preferences.keyboardShortcuts !== false;
  const h = useRef(handler);
  h.current = handler;
  const m = useRef(match);
  m.current = match;
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => { if (m.current(e)) h.current(e); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [enabled]);
}

/** Client-generated record id for new orders/prescriptions/vitals rows; the server stays authoritative. */
export const localId = () => globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10);
