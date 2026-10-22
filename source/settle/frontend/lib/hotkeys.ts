'use client';

import { useEffect, useRef } from 'react';

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

/**
 * Registers a keyboard shortcut. `combo` is like "k", "mod+k", "shift+?".
 * Plain-key shortcuts are ignored while typing in a field or when a dialog is open.
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const mod = parts.includes('mod');
    const shift = parts.includes('shift');
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== key) return;
      if (mod !== (e.metaKey || e.ctrlKey)) return;
      if (shift && !e.shiftKey) return;
      if (!mod && (isTyping(e.target) || document.querySelector('[data-dialog-open="true"]'))) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, enabled]);
}
