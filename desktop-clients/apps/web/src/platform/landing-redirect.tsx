"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {moduleLandingPage,productNavigationTarget,type ModuleKey} from "@pepbits/erp-config";
import { useERP, useProduct } from "@pepbits/erp-shell";
import { SessionSplash } from "@pepbits/erp-screens";
import { LAST_PAGE_KEY, hrefFor } from "./web-navigation";

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

/** Where "/" goes, decided by the landingPage preference. */
export function LandingRedirect() {
  const product = useProduct();
  const router = useRouter();
  const { preferences } = useERP();

  useEffect(() => {
    if(preferences.defaultModule && product.modules[preferences.defaultModule as ModuleKey]) {
      const module=preferences.defaultModule as ModuleKey;
      const page=moduleLandingPage(product,module);
      if(page){router.replace(hrefFor(productNavigationTarget(product,page,module)));return;}
    }
    if (preferences.landingPage === "last-visited") {
      const last = read(LAST_PAGE_KEY);
      // Only an in-app path: a stored value is user-writable, and a bare
      // "/" would loop straight back here.
      if (last && last.startsWith("/") && last !== "/" && !last.startsWith("//") && product.pages[last.split("/")[2]]) {
        router.replace(last);
        return;
      }
    }
    /* nexora-module is what ERPProvider writes on every module change; falling
       back to finance keeps the historical behaviour for a fresh browser. */
    const stored = read("nexora-module");
    const module: ModuleKey = stored && stored in product.modules ? (stored as ModuleKey) : product.defaultModule;
    const page=moduleLandingPage(product,module);
    if(page)router.replace(hrefFor(productNavigationTarget(product,page,module)));
  }, [preferences.landingPage, preferences.defaultModule, router, product]);

  return <SessionSplash />;
}
