"use client";
import React, { createContext, useContext } from "react";
import type { UserPreferences } from "@pepbits/preferences";

/** UI-only contract: the host resolves tenant policy before providing values.
 * Managed presentation wins over individual demo/table props. No ERP dependency.
 */
export interface PresentationPreferences {
  density: "compact" | "comfortable" | "spacious";
  zebraStripes: boolean;
  stickyTableHeader: boolean;
  wrapCellText: boolean;
  pageSize: number;
}
const PresentationContext = createContext<PresentationPreferences | null>(null);
export const PresentationProvider = PresentationContext.Provider;
export function usePresentationPreferences() { return useContext(PresentationContext); }

/** Project the host's effective preferences; policy resolution and persistence stay with the host. */
export function presentationFromPreferences(preferences: UserPreferences): PresentationPreferences {
  const { density, zebraStripes, stickyTableHeader, wrapCellText, pageSize } = preferences;
  return { density, zebraStripes, stickyTableHeader, wrapCellText, pageSize };
}
