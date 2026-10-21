import { useEffect, useRef, useState } from "react";

export type ListStatusValue = "idle" | "loading" | "ready" | "error";

export interface ListState<T> {
  status: ListStatusValue;
  items: T[];
  retry: () => void;
}

interface Snapshot<T> {
  key: string | null;
  status: ListStatusValue;
  items: T[];
}

/**
 * Load one host list. `key` identifies the request (null = not applicable yet,
 * e.g. states before a country is chosen). Successful results are cached per key
 * for the life of the wizard; failures are not cached and can be retried.
 */
export function useList<T>(key: string | null, load: () => Promise<T[]>): ListState<T> {
  const cache = useRef(new Map<string, T[]>());
  const loadRef = useRef(load);
  loadRef.current = load;
  const [attempt, setAttempt] = useState(0);
  const [snap, setSnap] = useState<Snapshot<T>>({ key: null, status: "idle", items: [] });

  useEffect(() => {
    if (key === null) {
      setSnap({ key, status: "idle", items: [] });
      return;
    }
    const hit = cache.current.get(key);
    if (hit) {
      setSnap({ key, status: "ready", items: hit });
      return;
    }
    let live = true;
    setSnap({ key, status: "loading", items: [] });
    Promise.resolve()
      .then(() => loadRef.current())
      .then(
        (items) => {
          if (!live) return;
          const list = Array.isArray(items) ? items : [];
          cache.current.set(key, list);
          setSnap({ key, status: "ready", items: list });
        },
        () => {
          if (live) setSnap({ key, status: "error", items: [] });
        },
      );
    return () => {
      live = false;
    };
  }, [key, attempt]);

  // Until the effect catches up with a new key, report it as loading rather than stale items.
  const current: Snapshot<T> = snap.key === key ? snap : { key, status: key === null ? "idle" : "loading", items: [] };
  return { status: current.status, items: current.items, retry: () => setAttempt((a) => a + 1) };
}

export const codesOf = (items: Array<{ code: string }>) => items.map((i) => i.code);
export const nameOf = (items: Array<{ code: string; name: string }>, code: string) =>
  items.find((i) => i.code === code)?.name ?? code;
