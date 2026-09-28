'use client';
/*
 * Replacements for next/navigation and next/link. Paths are module-relative
 * ("/workspace/dashboard"); the host maps them onto its own URL space through
 * `host.navigate`. Route params come from the module router, not from a framework.
 */
import { createContext, useCallback, useContext, useMemo, type ComponentProps } from 'react';
import { ReferenceLink, useReferenceHost, useReferenceRouter } from '@pepbits/reference-host';

export type RouteParams = { section?: string; slug?: string; id?: string };
export const RouteParamsContext = createContext<RouteParams>({});

export function useParams<T extends RouteParams = RouteParams>(): T {
  return useContext(RouteParamsContext) as T;
}

export function useRouter() {
  return useReferenceRouter();
}

export function usePathname(): string {
  return (useReferenceHost().path ?? '/').split('?')[0] || '/';
}

/** Stable per query string, so effects keyed on it do not rerun every render. */
export function useSearchParams(): URLSearchParams {
  const query = (useReferenceHost().path ?? '').split('?')[1] ?? '';
  return useMemo(() => new URLSearchParams(query), [query]);
}

/** Source `next/link` call sites keep their shape; navigation goes through the host. */
export function Link({ href, prefetch: _prefetch, ...props }: ComponentProps<'a'> & { href: string; prefetch?: boolean }) {
  return <ReferenceLink href={href} {...props} />;
}
export default Link;

/**
 * Opens a module path in a new browser context when the host can resolve it
 * (openInNewContext, or hrefFor/href to a real URL). Returns null otherwise, so callers
 * fall back to ordinary in-module navigation instead of opening a wrong URL.
 */
export function useOpenInNewContext(): ((path: string) => void) | null {
  const host = useReferenceHost();
  const resolve = host.hrefFor ?? host.href;
  const open = useCallback((path: string) => {
    if (host.openInNewContext) { host.openInNewContext(path); return; }
    if (resolve) window.open(resolve(path), '_blank', 'noopener');
  }, [host, resolve]);
  return host.openInNewContext || resolve ? open : null;
}
