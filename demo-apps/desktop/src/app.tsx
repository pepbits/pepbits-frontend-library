import React, {useMemo} from 'react';
import {ApplicationProviders, type ApplicationWorkspace} from '@pepbits/shell/application-providers';
import {WindowPortProvider, NULL_WINDOW_PORT, type WindowPort} from '@pepbits/platform/windows';
import type {SessionValue} from '@pepbits/platform/auth';
import {API_PRODUCT, type Request} from './adapters/http';
import {desktopProductForRole, hrefFor, targetFromPath} from './navigation';
import {DesktopPage} from './renderer';
import {DesktopAi} from './modules/ai/assistant';
import {useHistoryNavigation} from './platform/history';

const brand = {name: 'Desktop', tagline: 'Fictional desktop workspace'};
export interface DesktopAppProps {
  /** Demo API base URL from VITE_API_URL; never hardcoded. */
  apiBaseUrl: string | undefined;
  windows?: WindowPort;
  /** Set in a detached child window: the one document it shows. */
  detachedDocumentKey?: string | null;
  /** AI is off unless VITE_AI_ENABLED=true. */
  aiEnabled?: boolean;
  /** Test seams: a mocked transport and controlled session. */
  request?: Request;
  session?: SessionValue;
}
export function DesktopApp({apiBaseUrl, windows = NULL_WINDOW_PORT, detachedDocumentKey = null, aiEnabled = false, request, session}: DesktopAppProps) {
  const navigation = useHistoryNavigation(targetFromPath, hrefFor);
  const workspace = useMemo<ApplicationWorkspace>(() => ({render: target => <DesktopPage target={target}/>, detachedDocumentKey,
    ...(aiEnabled ? {wrapShell: (shell: React.ReactNode) => <DesktopAi>{shell}</DesktopAi>} : {})}), [detachedDocumentKey, aiEnabled]);
  if (!apiBaseUrl && !request) return <main className="p-6"><p role="alert">Set VITE_API_URL to the demo API base URL before starting the desktop demo.</p></main>;
  return <WindowPortProvider value={windows}>
    <ApplicationProviders apiBaseUrl={apiBaseUrl ?? ''} navigation={navigation} productId={API_PRODUCT} brand={brand} productForRole={desktopProductForRole}
      className="desktop-page" notice="Fictional demonstration only" workspace={workspace} {...(request ? {request} : {})} {...(session ? {session} : {})}/>
  </WindowPortProvider>;
}
