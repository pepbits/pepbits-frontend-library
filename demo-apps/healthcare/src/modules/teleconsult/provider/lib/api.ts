"use client";
import { createContext, useContext } from "react";
import type { Role } from "../../shared/types";
import { ROLE_HEADER } from "../../shared/contract";
import { useBoundClient } from "../../shared/client-hook";

export { ApiError, qs } from "../../shared/client";

/** The server-validated mode (doctor/nurse) currently in use. Routes requests; never grants anything. */
const RoleContext = createContext<Role | undefined>(undefined);
export const ProviderRoleProvider = RoleContext.Provider;

/** Authenticated transport for the provider module. Always call inside a component, never at module scope. */
export function useTeleconsultClient() {
  const role = useContext(RoleContext);
  return useBoundClient(role ? { [ROLE_HEADER]: role } : {});
}

/** Transport without a requested mode, used only to ask the server which modes this account may use. */
export function useSessionClient() {
  return useBoundClient({});
}
