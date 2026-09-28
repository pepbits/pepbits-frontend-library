"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { ReferenceLink, useReferencePathname, useReferenceRouter, useReferenceSearchParams } from "@pepbits/reference-host";

/** Source `next/link`: module-internal hrefs go through host.navigate (see ReferenceLink). */
export function Link(props: ComponentProps<typeof ReferenceLink>) {
  return <ReferenceLink {...props} />;
}

/** Source `next/navigation` useRouter. */
export function useRouter() {
  return useReferenceRouter();
}

export function usePathname() {
  return useReferencePathname();
}

export function useSearchParams() {
  return useReferenceSearchParams();
}

const ParamsContext = createContext<Record<string, string>>({});
export const RouteParamsProvider = ParamsContext.Provider;

/** Source `useParams()` for dynamic pages (/live/[id], /quizzes/[id]); filled by the module's route matcher. */
export function useParams<T extends Record<string, string> = Record<string, string>>() {
  return useContext(ParamsContext) as T;
}
