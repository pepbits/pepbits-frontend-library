import React from 'react';
import {render} from '@testing-library/react';
import type {SessionValue} from '@pepbits/platform/auth';
import type {WindowPort} from '@pepbits/platform/windows';
import {DesktopApp} from '../app';
import {fixtureSession, mockApi} from './mock-api';

/** The whole desktop host at an address, with a mocked demo API and a controlled session. */
export function renderDesktop(path: string, options: {api?: ReturnType<typeof mockApi>; session?: SessionValue; windows?: WindowPort; detachedDocumentKey?: string; aiEnabled?: boolean} = {}) {
  window.history.replaceState(null, '', path);
  const api = options.api ?? mockApi();
  const view = render(<DesktopApp apiBaseUrl="/api" request={api.request} session={options.session ?? fixtureSession} windows={options.windows}
    detachedDocumentKey={options.detachedDocumentKey ?? null} aiEnabled={options.aiEnabled ?? false}/>);
  return {...view, api};
}
