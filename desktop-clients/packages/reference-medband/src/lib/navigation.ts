"use client";
import { useMemo } from "react";
import { useReferenceHost, useReferencePathname } from "@pepbits/reference-host";

/**
 * Next.js navigation hooks replaced by the host: paths are module-relative and the host owns the address bar.
 * `replace` accepts (and ignores) the Next scroll option so source call sites stay unchanged.
 */
export function useRouter() {
  const host = useReferenceHost();
  return useMemo(() => ({
    push: (path: string) => host.navigate(path),
    replace: (path: string, _options?: { scroll?: boolean }) => host.navigate(path),
  }), [host]);
}
export const usePathname = useReferencePathname;
/** The query string of the current module path. Stable between renders of one path, so it is safe in dependency lists. */
export function useSearchParams() {
  const path = useReferenceHost().path ?? "";
  return useMemo(() => new URLSearchParams(path.split("#")[0].split("?")[1] ?? ""), [path]);
}
