'use client';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useEventStream, type EventSourceLike, type EventStreamStatus} from '@pepbits/platform/event-stream';
import {useScreenHost} from '@pepbits/patterns/screen-host';
import type {CaregridClient} from '../../adapters/caregrid';
import type {Meta, Notice} from './types';
import {nowLocal} from './time';

interface LiveValue {
  client: CaregridClient; meta: Meta | null; metaError: unknown; retryMeta: () => void;
  status: EventStreamStatus; lastSync: string | null;
  /** Increments (debounced) whenever the server announces a schedule change. */
  version: number; bump: () => void;
  notices: Notice[]; unread: number; markAllRead: () => void; markRead: (id: number) => void;
}
const Context = createContext<LiveValue | null>(null);
const TONE = {success: 'success', info: 'info', warning: 'warning', critical: 'error'} as const;

/**
 * Live scheduling state for one authenticated identity: reference metadata, notifications and the
 * Server-Sent Events channel. Events only trigger HTTP re-reads; the API remains the source of truth.
 */
export function CaregridLiveProvider({client, children, createEventSource}: {client: CaregridClient; children: React.ReactNode; createEventSource?: (url: string) => EventSourceLike}) {
  const {notify} = useScreenHost();
  const [meta, setMeta] = useState<Meta | null>(null), [metaError, setMetaError] = useState<unknown>(null), [metaAttempt, setMetaAttempt] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null), [version, setVersion] = useState(0), [notices, setNotices] = useState<Notice[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined), metaRef = useRef(meta);
  metaRef.current = meta;
  const bump = useCallback(() => {clearTimeout(timer.current); timer.current = setTimeout(() => setVersion(value => value + 1), 250);}, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const controller = new AbortController();
    setMetaError(null);
    client.request<Meta>('/meta', {signal: controller.signal}).then(setMeta, error => {if (!controller.signal.aborted) setMetaError(error);});
    return () => controller.abort();
  }, [client, metaAttempt]);
  useEffect(() => {
    const controller = new AbortController();
    client.request<Notice[]>('/notifications', {signal: controller.signal}).then(setNotices, () => {});
    return () => controller.abort();
  }, [client]);
  const handlers = useMemo(() => ({
    hello: (data: unknown) => {setLastSync((data as {time?: string})?.time ?? nowLocal()); bump(); if (!metaRef.current) setMetaAttempt(value => value + 1);},
    ping: (data: unknown) => setLastSync((data as {time?: string})?.time ?? nowLocal()),
    notification: (data: unknown) => {
      const notice = data as Notice;
      if (!notice || typeof notice.title !== 'string') return;
      setNotices(list => [notice, ...list.filter(item => item.id !== notice.id)].slice(0, 80));
      notify([notice.title, notice.body].filter(Boolean).join('. '), {tone: TONE[notice.level] ?? 'info'});
    },
    'schedule-changed': () => {setLastSync(nowLocal()); bump();},
  }), [bump, notify]);
  const status = useEventStream(client.eventsUrl, handlers, {readyEvent: 'hello', create: createEventSource});
  const markAllRead = useCallback(() => {setNotices(list => list.map(item => ({...item, read: 1}))); client.request('/notifications/read-all', {body: {}}).catch(() => {});}, [client]);
  const markRead = useCallback((id: number) => {setNotices(list => list.map(item => item.id === id ? {...item, read: 1} : item)); client.request(`/notifications/${id}/read`, {body: {}}).catch(() => {});}, [client]);
  const value = useMemo<LiveValue>(() => ({client, meta, metaError, retryMeta: () => setMetaAttempt(n => n + 1), status, lastSync, version, bump, notices, unread: notices.filter(item => !item.read).length, markAllRead, markRead}),
    [client, meta, metaError, status, lastSync, version, bump, notices, markAllRead, markRead]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLive() {
  const value = useContext(Context);
  if (!value) throw new Error('useLive requires CaregridLiveProvider');
  return value;
}

/**
 * GET a scheduling resource; re-reads after live schedule changes unless `live` is false.
 * Superseded requests abort; the last accepted data stays visible while a new query loads.
 */
export function useCaregridQuery<T>(path: string | null, {live = true}: {live?: boolean} = {}) {
  const {client, version} = useLive();
  const [state, setState] = useState<{path: string | null; data: T | null; error: unknown}>({path: null, data: null, error: null});
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const liveKey = live ? version : 0;
  useEffect(() => {
    if (!path) {setState({path: null, data: null, error: null}); return;}
    const controller = new AbortController();
    client.request<T>(path, {signal: controller.signal}).then(
      data => {if (!controller.signal.aborted) setState({path, data, error: null});},
      error => {if (!controller.signal.aborted) setState(previous => ({path, data: previous.data, error}));});
    return () => controller.abort();
  }, [client, path, attempt, liveKey]);
  const setData = useCallback((update: (data: T | null) => T | null) => setState(previous => ({...previous, data: update(previous.data)})), []);
  return {data: path ? state.data : null, error: state.path === path ? state.error : null, loading: !!path && state.path !== path, reload, setData};
}
