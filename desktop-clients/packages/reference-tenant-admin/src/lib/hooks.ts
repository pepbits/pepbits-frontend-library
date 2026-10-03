"use client";
import { useEffect, useRef } from "react";
import { useReferenceHost } from "@pepbits/reference-host";

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};

/**
 * Single-key and modifier shortcuts that never fire while the user is typing (unless allowInInputs).
 * The listener is attached only while the host's keyboard-shortcut preference is on; turning it off removes it.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, deps: unknown[] = [], opts: { allowInInputs?: boolean } = {}) {
  const enabled = useReferenceHost().preferences.keyboardShortcuts !== false;
  const ref = useRef(map);
  useEffect(() => { ref.current = map; });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = `${mod ? "mod+" : ""}${e.shiftKey && e.key.length > 1 ? "shift+" : ""}${e.key.toLowerCase()}`;
      const fn = ref.current[key];
      if (!fn) return;
      if (!mod && !opts.allowInInputs && typing(e)) return;
      e.preventDefault();
      fn(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}

/** The host's managed table page size (10, 20, 50 or 100); the configuration list pages use it as their page size. */
export function usePageSize(): number {
  return useReferenceHost().preferences.pageSize;
}
