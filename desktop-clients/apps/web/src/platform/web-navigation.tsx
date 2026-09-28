"use client";

import { useEffect, useMemo } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useProduct } from "@pepbits/erp-shell";
import { legacySchoolModuleAlias, PAGE_REGISTRY, REFERENCE_PAGE_BY_ID, referenceInternalPath } from "@pepbits/erp-config";
import type { NavigationPort, NavigationTarget } from "@pepbits/platform-ports";

/** The canonical module segment for a page. "shared" pages live under /shared. */
export function moduleSegmentFor(pageId: string): string {
  const page = PAGE_REGISTRY[pageId];
  return page ? page.module : "shared";
}

export function hrefFor(target: NavigationTarget): string {
  const base = `/${target.moduleId ?? moduleSegmentFor(target.pageId)}/${target.pageId}`;
  if (REFERENCE_PAGE_BY_ID[target.pageId] && target.recordId) return `${base}/${encodeURIComponent(target.recordId)}`;
  if (target.mode === "new") return `${base}/new`;
  if (target.recordId) return target.mode === "edit" ? `${base}/${target.recordId}/edit` : `${base}/${target.recordId}`;
  return base;
}

export const LAST_PAGE_KEY = "nexora-last-page";

export function useWebNavigation(): NavigationPort {
  const router = useRouter();
  const product = useProduct();
  const pathname = usePathname();
  const params = useParams<{ module?: string; page?: string; recordId?: string }>();

  /* Recorded so "/" can restore it when landingPage is "last-visited". Only
     real pages -- "/" itself is the redirect and must not be remembered, or the
     next visit lands on a page whose job is to leave. */
  useEffect(() => {
    if (!params.page) return;
    try { window.localStorage.setItem(LAST_PAGE_KEY, pathname); } catch { /* storage unavailable */ }
  }, [params.page, pathname]);

  const alias=legacySchoolModuleAlias(product,params.module);
  useEffect(()=>{
    if(alias && params.page)router.replace(hrefFor({pageId:params.page,moduleId:alias,...(params.recordId?{recordId:referenceInternalPath(params.recordId)??params.recordId}:{})}));
  },[alias,params.page,params.recordId,router]);

  return useMemo(() => {
    const last = pathname.split("/").filter(Boolean).at(-1);
    const mode: NavigationTarget["mode"] | undefined =
      last === "new" ? "new" : last === "edit" ? "edit" : params.recordId ? "view" : undefined;

    const current: NavigationTarget = {
      pageId: params.page ?? "finance-dashboard",
      ...(params.module?.startsWith("reference-school") ? {moduleId:params.module} : {}),
      ...(mode ? { mode } : {}),
      ...(params.recordId ? { recordId: REFERENCE_PAGE_BY_ID[params.page ?? ''] ? referenceInternalPath(params.recordId) ?? params.recordId : params.recordId } : {}),
    };

    return {
      current,
      open: (target) => router.push(hrefFor(target)),
      /* Always from a user gesture, so this is not popup-blocked. noopener because
         the new tab has no reason to reach back into this one. */
      openInNewContext: (target) => { window.open(hrefFor(target), "_blank", "noopener"); },
      hrefFor,
    };
  }, [params.module, params.page, params.recordId, pathname, router]);
}
