import { notFound, redirect } from "next/navigation";
import { PAGE_REGISTRY, schoolRoleView } from "@pepbits/erp-config";
import type { PageDefinition } from "@pepbits/erp-config";

/** Resolve a (module, page) pair. An unknown page 404s; a page reached under a
    module that does not own it redirects to its canonical URL, so /hr/customer-master
    is writable but lands on /finance/customer-master. */
export function resolvePage(moduleSegment: string, pageId: string, suffix = ""): PageDefinition {
  const page = PAGE_REGISTRY[pageId];
  if (!page) notFound();
  if (page.module !== moduleSegment && !(page.module === 'reference-school' && schoolRoleView(moduleSegment))) redirect(`/${page.module}/${pageId}${suffix}`);
  return page;
}
