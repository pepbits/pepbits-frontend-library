'use client';
import {useEffect, useRef} from 'react';
import {usePreferences} from '@pepbits/preferences/react';

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

/**
 * Registers a Settle keyboard shortcut. `combo` is like "a" or "shift+x". Plain-key shortcuts are
 * ignored while typing in a field or while a dialog is open. The listener exists only while the
 * effective `keyboardShortcuts` preference is on (PREF-07); every action stays reachable by its button.
 * Shell-owned combinations (⌘K command palette, ? page helper) are deliberately not registered here.
 */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  const {preferences} = usePreferences();
  const ref = useRef(handler);
  ref.current = handler;
  const active = enabled && preferences.keyboardShortcuts !== false;
  useEffect(() => {
    if (!active) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const shift = parts.includes('shift');
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== key) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shift !== e.shiftKey && key !== '/') return;
      if (isTyping(e.target) || document.querySelector('[data-dialog-open="true"],[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, active]);
}
