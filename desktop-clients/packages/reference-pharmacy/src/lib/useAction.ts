"use client";
import { useCallback, useRef, useState } from "react";
import { useToast } from "../components/ui/toast";
import { newOperationKey, useRefreshAll } from "./api";

/**
 * Runs a mutation with a busy flag, success toast, error toast and a global refresh; a call while another is running is ignored. `fn` receives the operation key of this
 * attempt; pass it to `api.post/patch(path, body, { operationKey })` and an explicit retry of the same operation can reuse it.
 * Success titles/bodies are catalog messages (already translated by the caller when they carry values); error titles are the
 * server's (or the transport's) message.
 */
export function useAction() {
  const toast = useToast();
  const refreshAll = useRefreshAll();
  const [busy, setBusy] = useState<string | null>(null);
  // Synchronous lock: state is stale within the same tick, so a double click would otherwise start two mutations.
  const locked = useRef(false);
  const run = useCallback(async <T,>(key: string, fn: (operation: { operationKey: string }) => Promise<T>, success?: string | ((r: T) => string), body?: string): Promise<T | undefined> => {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(key);
    try {
      const r = await fn({ operationKey: newOperationKey() });
      if (success) toast({ tone: "ok", title: typeof success === "function" ? success(r) : success, body });
      void refreshAll();
      return r;
    } catch (e) {
      toast({ tone: "error", title: (e as Error).message });
      return undefined;
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }, [toast, refreshAll]);
  return { run, busy };
}
