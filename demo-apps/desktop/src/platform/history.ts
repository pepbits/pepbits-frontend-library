import {useMemo, useSyncExternalStore} from 'react';
import type {NavigationPort, NavigationTarget} from '@pepbits/platform/navigation';

const CHANGE = 'pepbits-desktop-location';
const subscribe = (notify: () => void) => {
  window.addEventListener('popstate', notify); window.addEventListener(CHANGE, notify);
  return () => {window.removeEventListener('popstate', notify); window.removeEventListener(CHANGE, notify);};
};
const location = () => window.location.pathname + window.location.search;

/**
 * The address bar as a navigation port, for the web build and the Tauri webview alike.
 * The workspace frame owns documents; this only mirrors the active one so deep links,
 * reloads and Back/Forward work. Same-address writes are ignored.
 */
export function useHistoryNavigation(targetFromPath: (pathname: string, search: string) => NavigationTarget, hrefFor: (target: NavigationTarget) => string): NavigationPort {
  const address = useSyncExternalStore(subscribe, location, () => '/');
  return useMemo<NavigationPort>(() => {
    const [pathname, search = ''] = address.split('?');
    const go = (target: NavigationTarget) => {
      const href = hrefFor(target);
      if (href === location()) return;
      window.history.pushState(null, '', href);
      window.dispatchEvent(new Event(CHANGE));
    };
    return {current: targetFromPath(pathname!, search), open: go, openInNewContext: go, hrefFor};
  }, [address, targetFromPath, hrefFor]);
}
