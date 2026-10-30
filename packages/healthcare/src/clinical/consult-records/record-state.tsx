"use client";
import React, {useEffect, useRef, useState} from "react";
import {ErrorState} from "@pepbits/components";
import {useConsultPort} from "../context/consult-host";
import {problemsOf} from "../context/port";

export const encounterClosed = (status: string) => ["signed", "checked-out", "discharged", "cancelled", "entered-in-error"].includes(status);

/** No module cache: a read belongs to this mounted consumer and its current port/context. */
export function useRecordResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, retry] = useState(0);
  const [state, setState] = useState<{load: typeof load; data?: T; problems: string[]}>({load, problems: []});
  useEffect(() => {
    const controller = new AbortController();
    setState({load, problems: []});
    void load(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({load, data, problems: []});
    }).catch(error => {
      if (!controller.signal.aborted) setState({load, problems: problemsOf(error)});
    });
    return () => controller.abort();
  }, [load, attempt]);
  return {data: state.load === load ? state.data : undefined, problems: state.load === load ? state.problems : [], retry: () => retry(n => n + 1)};
}

export function RecordLoadError({problems, retry}: {problems: string[]; retry: () => void}) {
  return problems.length ? <ErrorState title="Unable to load clinical records" description={problems.join(" ")} onRetry={retry}/> : null;
}

/** Fences completion on host/patient replacement and blocks duplicate writes before React rerenders. */
export function useRecordMutation(scope: string, readOnly = false) {
  const port = useConsultPort();
  const current = useRef({port, scope, readOnly});
  current.current = {port, scope, readOnly};
  const live = useRef(true), pending = useRef<symbol | null>(null);
  const [busy, setBusy] = useState(false), [problems, setProblems] = useState<string[]>([]);
  useEffect(() => { live.current = true; return () => { live.current = false; pending.current = null; }; }, []);
  useEffect(() => { pending.current = null; setBusy(false); setProblems([]); }, [port, scope]);
  const run = async <T,>(action: () => Promise<T>, done?: (value: T) => void | Promise<void>) => {
    if (current.current.readOnly || pending.current) return;
    const token = Symbol(); pending.current = token; setBusy(true); setProblems([]);
    const valid = () => live.current && pending.current === token && current.current.port === port && current.current.scope === scope;
    try { const value = await action(); if (valid()) await done?.(value); }
    catch (error) { if (valid()) setProblems(problemsOf(error)); }
    finally { if (valid()) { pending.current = null; setBusy(false); } }
  };
  return {busy, problems, setProblems, run};
}

/** A local React key prevents drafts or results from crossing a patient or port boundary. */
export function useRecordScopeKey(scope: string) {
  const port = useConsultPort();
  const previous = useRef({port, scope, generation: 0});
  if (previous.current.port !== port || previous.current.scope !== scope) previous.current = {port, scope, generation: previous.current.generation + 1};
  return previous.current.generation;
}
