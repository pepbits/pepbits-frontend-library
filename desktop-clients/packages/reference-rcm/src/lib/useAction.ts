"use client";
import { useCallback, useRef, useState } from "react";

/**
 * Runs one write at a time. `busy` drives disabled buttons; the ref refuses a second call in the same tick (a double click or
 * Ctrl+Enter plus click lands before React re-renders), so a duplicate submit never reaches the client.
 */
export function useAction() {
  const inflight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inflight.current) return undefined;
    inflight.current = true; setBusy(true);
    try { return await fn(); } finally { inflight.current = false; setBusy(false); }
  }, []);
  return { busy, run };
}
