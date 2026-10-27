"use client";
import React, {createContext, useContext, useMemo, type ReactNode} from "react";
import type {ClinicalActor} from "../types";
import type {ClinicalDataPort} from "./port";

interface ClinicalContextValue { port: ClinicalDataPort; actor: ClinicalActor | null }

const ClinicalContext = createContext<ClinicalContextValue | null>(null);

/** Supplies the data port and the signed-in clinician to every clinical section, form and queue below it. */
export function ClinicalProvider({port, actor = null, children}: {port: ClinicalDataPort; actor?: ClinicalActor | null; children: ReactNode}) {
  const value = useMemo(() => ({port, actor}), [port, actor]);
  return <ClinicalContext.Provider value={value}>{children}</ClinicalContext.Provider>;
}

function useClinical() {
  const value = useContext(ClinicalContext);
  if (!value) throw new Error("Clinical components need a <ClinicalProvider> with a data port.");
  return value;
}

export const useClinicalPort = () => useClinical().port;

/** The clinician and a permission check. A missing actor can do nothing; the server decides either way. */
export function useClinicalActor() {
  const {actor} = useClinical();
  return useMemo(() => ({actor, can: (permission: string) => !!actor?.permissions.includes(permission)}), [actor]);
}
