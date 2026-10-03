"use client";
import { useEffect, useRef } from "react";
import { useReferenceHost } from "@pepbits/reference-host";

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};

/**
 * Shortcuts through one window listener that exists only while the host's keyboard-shortcut preference is on. Keys are
 * "mod+k", "mod+enter" (Ctrl or Cmd), or a bare key; bare keys never fire while the user is typing.
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>) {
  const enabled = useReferenceHost().preferences.keyboardShortcuts !== false;
  const ref = useRef(map);
  useEffect(() => { ref.current = map; });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const fn = ref.current[`${mod ? "mod+" : ""}${e.key.toLowerCase()}`];
      if (!fn || (!mod && typing(e))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      fn(e);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}

/** The host's managed table page size, for list pages that page through results. */
export const usePageSize = () => useReferenceHost().preferences.pageSize;
