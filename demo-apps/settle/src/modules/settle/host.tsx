'use client';
import React, {createContext, useContext, useMemo} from 'react';
import type {SettleTransport} from '../../adapters/settle';

/** App-lifetime Settle runtime: configured transport, desk user and scope identity. Session,
 * preferences, localization and notifications belong to the application host. */
export interface SettleRuntime {
  transport: SettleTransport;
  /** Scope identity: a change remounts data stores so no other user's cache is reused. */
  scopeKey: string;
  deskUserId: number;
  setDeskUserId: (id: number) => void;
}
/** Per-route Settle location and navigation, mapped onto the host NavigationPort. */
export interface SettleRoute {
  /** Current Settle path, e.g. `/bills?status=F`. */
  path: string;
  navigate: (path: string, options?: {replace?: boolean}) => void;
  hrefFor: (path: string) => string;
  /** Opens a Settle path in a separate browser context (print previews). */
  openWindow: (path: string) => void;
}
export type SettleHost = SettleRuntime & SettleRoute;
const Runtime = createContext<SettleRuntime | null>(null);
const Route = createContext<SettleRoute | null>(null);
export function SettleRuntimeProvider({value, children}: {value: SettleRuntime; children: React.ReactNode}) {
  return <Runtime.Provider value={value}>{children}</Runtime.Provider>;
}
export function SettleRouteProvider({value, children}: {value: SettleRoute; children: React.ReactNode}) {
  return <Route.Provider value={value}>{children}</Route.Provider>;
}
export function useSettleRuntime() {
  const runtime = useContext(Runtime);
  if (!runtime) throw new Error('Settle runtime is missing');
  return runtime;
}
export function useSettleRoute() {
  const route = useContext(Route);
  if (!route) throw new Error('Settle route is missing');
  return route;
}
export function usePathname() {return useSettleRoute().path.split('?')[0]!;}
export function useSearchParams() {
  const query = useSettleRoute().path.split('?')[1] ?? '';
  return useMemo(() => new URLSearchParams(query), [query]);
}
export function useParams<T extends Record<string, string>>(): T {
  const parts = usePathname().split('/').filter(Boolean);
  // Settle record routes are /bills/:billNo, /patients/:mrNo, /print/bill/:billNo and /print/receipt/:no.
  let value = '';
  try {value = decodeURIComponent(parts[parts[0] === 'print' ? 2 : 1] ?? '');} catch {/* malformed: not found upstream */}
  return {billNo: value, mrNo: value, no: value} as unknown as T;
}
export function useRouter() {
  const route = useSettleRoute();
  return useMemo(() => ({
    push: (path: string) => route.navigate(path),
    replace: (path: string, _options?: {scroll?: boolean}) => route.navigate(path, {replace: true}),
  }), [route]);
}

/** In-app link: keeps a real href (middle-click, copy link) and routes primary clicks through the host. */
export function Link({href, onClick, ...props}: React.ComponentProps<'a'> & {href: string}) {
  const route = useSettleRoute();
  return <a {...props} href={route.hrefFor(href)} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !props.target) {
      event.preventDefault(); route.navigate(href);
    }
  }}/>;
}
