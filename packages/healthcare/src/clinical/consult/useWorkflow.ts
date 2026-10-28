"use client";
import {useEffect, useRef, useState} from "react";
import {problemsOf} from "../context/port";

/** Local async write guard. Mounted workflow instances are scoped by encounter and port. */
export function useWorkflow(onBusyChange?: (busy: boolean) => void, dirty = false) {
  const [busy, setBusy] = useState(false), [problems, setProblems] = useState<string[]>([]);
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onBusyChange?.(busy || dirty); return () => onBusyChange?.(false); }, [busy, dirty, onBusyChange]);
  const run = async <T,>(write: () => Promise<T>, success?: (value: T) => void | Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setProblems([]);
    try { const result = await write(); if (mounted.current) await success?.(result); }
    catch (error) { if (mounted.current) setProblems(problemsOf(error)); }
    finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return {busy, problems, setProblems, run};
}
