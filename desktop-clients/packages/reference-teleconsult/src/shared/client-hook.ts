"use client";
import { useMemo, useRef } from "react";
import { referenceScopeKey, useReferenceHost } from "@pepbits/reference-host";
import { createTeleconsultClient } from "./client";

/**
 * Client bound to the mounted module's authenticated host fetch plus routing headers. It is keyed by the
 * host scope (tenant/application/branch/user/roles/module) and the headers, so a scope, role or
 * beneficiary change yields a new client and every hook using it cancels and reloads. The latest host.fetch
 * is read through a ref: a host that re-creates its fetch each render must not restart every request.
 */
export function useBoundClient(headers: Record<string, string>) {
  const host = useReferenceHost();
  const fetchRef = useRef(host.fetch);
  fetchRef.current = host.fetch;
  const scope = referenceScopeKey(host.scope);
  const headerKey = JSON.stringify(headers);
  return useMemo(() => createTeleconsultClient({
    headers: JSON.parse(headerKey),
    fetch: (path, init) => {
      const authenticated = fetchRef.current;
      if (!authenticated) return Promise.reject(new Error("Authenticated fetch is required"));
      return authenticated(path, init);
    },
  }), [scope, headerKey]);
}
