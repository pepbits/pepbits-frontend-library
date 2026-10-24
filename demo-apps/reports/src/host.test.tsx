import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, test, vi} from 'vitest';
import {ReportsProviders} from './providers';
import {ReportsApplicationPage} from './renderer';
import {hrefFor, targetFromPath} from './navigation';
import {analystSession, fixtureSession} from './test/session';
import {mockHttp} from './test/mock-http';

function mount(path: string, session = fixtureSession, mock = mockHttp({}, undefined, {user: session.user as typeof fixtureSession.user & {}})) {
  const [pathname, query] = path.split('?');
  const target = targetFromPath(pathname!, query);
  const navigation = {current: target, hrefFor, open: vi.fn(), openInNewContext: vi.fn()};
  const view = render(<ReportsProviders apiBaseUrl="/api" request={mock.request} session={session} navigation={navigation}><ReportsApplicationPage target={target}/></ReportsProviders>);
  return {...view, navigation, mock};
}

test('module requests carry the configured namespace and routing headers from the session', async () => {
  const {mock} = mount('/reports');
  await screen.findByRole('heading', {name: 'Report library', level: 1}, {timeout: 15000});
  // The page title can render before its data request is recorded under load.
  const call = await waitFor(() => { const found = mock.calls.find(c => c.path === '/reference-modules/reports/api/page/reports'); expect(found).toBeDefined(); return found!; });
  expect(call.headers.get('X-Reference-Module')).toBe('reference-reports');
  expect(call.headers.get('X-Reference-Branch')).toBe(fixtureSession.user!.branch);
  expect(call.headers.get('X-Product-Id')).toBe('nexora');
});

test('module links resolve to application deep links and use host navigation', async () => {
  const {navigation} = mount('/');
  const link = await screen.findByRole('link', {name: 'Open report library'}, {timeout: 15000});
  expect(link).toHaveAttribute('href', '/reports');
  fireEvent.click(link);
  expect(navigation.open).toHaveBeenCalledWith(expect.objectContaining({pageId: 'reports-library'}));
});

test('a server page denial becomes host navigation to the denied overview', async () => {
  const {navigation} = mount('/builder', analystSession);
  await waitFor(() => expect(navigation.open).toHaveBeenCalledWith(expect.objectContaining({pageId: 'reports-overview', query: 'denied=1'})), {timeout: 15000});
});
