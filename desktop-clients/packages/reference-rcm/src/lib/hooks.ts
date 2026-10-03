"use client";
import { useEffect, useRef } from "react";
import { useReferenceHost } from "@pepbits/reference-host";

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};

/** Whether the host's keyboard-shortcut preference is on. Every shortcut listener is attached only while it is. */
export function useShortcutsEnabled() {
  return useReferenceHost().preferences.keyboardShortcuts !== false;
}

/**
 * Window key handler that exists only while the host's keyboard-shortcut preference is on (turning it off removes the listener).
 * `handler` always sees the latest closure; it decides whether the event is its own and calls preventDefault itself.
 */
export function useKeyHandler(handler: (e: KeyboardEvent) => void, active = true, capture = false) {
  const enabled = useShortcutsEnabled();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!enabled || !active) return;
    const onKey = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener("keydown", onKey, capture);
    return () => window.removeEventListener("keydown", onKey, capture);
  }, [enabled, active, capture]);
}

/** True while the user is typing in a field (single-key shortcuts must not fire). */
export const isTyping = typing;

/** The host's managed table page size (10, 20, 50 or 100); the worklist tables use it as their page size. */
export function usePageSize(): number {
  return useReferenceHost().preferences.pageSize;
}
