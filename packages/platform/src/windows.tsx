"use client";

import React, { createContext, useContext } from "react";

export interface DetachedWindowRequest {
  /** Identifies the window to this shell. Not shown anywhere. */
  documentId: string;
  /** What the child window should open. A document key, never a name. */
  documentKey: string;
  /** Already sanitised by windowTitleFor. Reaches the OS taskbar. */
  title: string;
}

/**
 * Opening a record in a window of its own.
 *
 * A port rather than a direct Tauri call, for the reason every port here
 * exists: the web shell has no windows to open and the same screens render in
 * both. `available` is how a shell says so, and it is what the detach action
 * is hidden behind — an action that silently does nothing is worse than one
 * that is not offered.
 */
export interface WindowPort {
  readonly available: boolean;
  open(request: DetachedWindowRequest): Promise<boolean>;
  close(documentId: string): Promise<void>;
  focus(documentId: string): Promise<void>;
  /** The user closed the window themselves. Returns an unsubscribe. */
  onClosed(listener: (documentId: string) => void): () => void;
}

/** What a shell without windows provides. Every call is a no-op that says so. */
export const NULL_WINDOW_PORT: WindowPort = {
  available: false,
  open: async () => false,
  close: async () => undefined,
  focus: async () => undefined,
  onClosed: () => () => undefined,
};

const WindowContext = createContext<WindowPort>(NULL_WINDOW_PORT);

export function WindowPortProvider({ value, children }: { value: WindowPort; children: React.ReactNode }) {
  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

/**
 * Defaults to the null port rather than throwing, unlike useNavigation.
 *
 * Navigation is required for a shell to work at all; a second window is not.
 * A shell that never provides one should render without windows, not crash.
 */
export function useWindowPort(): WindowPort {
  return useContext(WindowContext);
}
