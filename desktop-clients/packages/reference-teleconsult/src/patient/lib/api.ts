"use client";
import { createContext, useContext } from "react";
import { PATIENT_HEADER } from "../../shared/contract";
import { useBoundClient } from "../../shared/client-hook";

export { ApiError, qs } from "../../shared/client";

/** The server-validated beneficiary currently selected. Routes requests; the server re-checks every one. */
const PatientIdContext = createContext<string | undefined>(undefined);
export const PatientIdProvider = PatientIdContext.Provider;

/** Authenticated transport for the patient module. Always call inside a component, never at module scope. */
export function useTeleconsultClient() {
  const patientId = useContext(PatientIdContext);
  return useBoundClient(patientId ? { [PATIENT_HEADER]: patientId } : {});
}

/** Transport without a selected beneficiary, used to ask the server which people this account may act for. */
export function useSessionClient() {
  return useBoundClient({});
}
