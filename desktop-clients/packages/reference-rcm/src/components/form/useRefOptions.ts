"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApiClient } from "../../lib/api";
import type { OptionItem } from "../../lib/types";
import type { ComboItem } from "../ui/Combobox";

/**
 * Options for a reference field, searched on the server so large lists stay fast. Reads go through the scoped client; a
 * newer search aborts the older one, and nothing outlives the component (the source's module-level cache is gone).
 */
export function useRefOptions(source?: string) {
  const client = useApiClient();
  const [items, setItems] = useState<ComboItem[]>([]);
  const [loading, setLoading] = useState(false);
  const last = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const search = useCallback((q: string) => {
    if (!source || last.current === q) return;
    last.current = q;
    controller.current?.abort();
    const c = (controller.current = new AbortController());
    setLoading(true);
    client.get<OptionItem[]>(`/options/${source}${q ? `?q=${encodeURIComponent(q)}` : ""}`, { signal: c.signal })
      .then((rows) => { if (last.current === q && !c.signal.aborted) { setItems(rows); setLoading(false); } })
      .catch(() => { if (!c.signal.aborted) { setItems([]); setLoading(false); } });
  }, [source, client]);

  useEffect(() => { last.current = null; setItems([]); return () => controller.current?.abort(); }, [source]);
  return { items, loading, search };
}
