import React from 'react';
import {act, render, waitFor} from '@testing-library/react';
import {describe, expect, test, vi} from 'vitest';
import axe from 'axe-core';
import {usePreferences} from '@pepbits/preferences/react';
import type {PreferencePolicy, UserPreferences} from '@pepbits/preferences';
import {ReportsProviders} from './providers';
import {ReportsApplicationPage} from './renderer';
import {hrefFor, targetFromPath} from './navigation';
import {REPORTS_ROUTE_DEFINITIONS} from './modules/reports/routes';
import {fixtureSession, fixtureUser} from './test/session';
import {mockHttp} from './test/mock-http';

function DensityProbe() {return <span hidden data-effective-density={usePreferences().preferences.density}/>;}
const scenarios: {name: string; preferences: Partial<UserPreferences>; policy?: PreferencePolicy}[] = [
  {name: 'default', preferences: {}}, {name: 'Arabic RTL', preferences: {language: 'ar'}}, {name: 'reduced motion', preferences: {reducedMotion: true}},
  {name: 'locked density', preferences: {density: 'spacious'}, policy: {revision: 2, rules: {density: {value: 'compact', locked: true}}}},
];
// Every source page route: static paths, one fixture exemplar per dynamic route, a runtime job and preferences.
const paths = [...REPORTS_ROUTE_DEFINITIONS.filter(route => !route.pattern.includes(':')).map(route => route.pattern),
  '/reports/trial-balance', '/builder/new', '/dashboards/executive-overview', '/jobs/:job', '/admin/audit?q=report', '/preferences'];
const scope = {applicationId: 'nexora', branchId: fixtureUser.branch};

describe.each(scenarios)('$name', scenario => {
  test.each(paths)('%s renders API data and passes axe', async template => {
    const mock = mockHttp(scenario.preferences, scenario.policy);
    let path = template;
    if (template === '/jobs/:job') {
      const job = mock.store.handle(fixtureUser, scope, {method: 'POST', path: '/api/jobs', body: {reportId: 'payer-mix', format: 'csv', deliver: 'download'}}).body as {id: string};
      path = '/jobs/' + job.id;
    }
    const [pathname, query] = path.split('?');
    const target = targetFromPath(pathname!, query);
    expect(target.pageId).not.toBe('not-found');
    expect(hrefFor(target)).toBe(path);
    const navigation = {current: target, hrefFor, open: vi.fn(), openInNewContext: vi.fn()};
    const {container} = render(<ReportsProviders apiBaseUrl="/api" request={mock.request} session={fixtureSession} navigation={navigation}><ReportsApplicationPage target={target}/><DensityProbe/></ReportsProviders>);
    await waitFor(() => expect(container.querySelector(path === '/preferences' ? '[data-page-id="preferences"]' : '.reports-page h1')).toBeInTheDocument(), {timeout: 15000});
    const content = container.querySelector('.reports-page') as HTMLElement;
    await waitFor(() => expect(content.querySelector('[aria-busy=true],.animate-pulse')).toBeNull(), {timeout: 15000});
    if (path !== '/preferences') await waitFor(() => expect(content.querySelector('.lumen-reports [data-route]')?.getAttribute('data-route')).not.toBe('not-found'));
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 50));});
    expect(mock.unexpected).toEqual([]);
    expect(content.textContent).not.toContain('This page could not load');
    expect(content.textContent).not.toContain('This page does not exist');
    expect(navigation.open).not.toHaveBeenCalled();
    expect(document.documentElement.dir).toBe(scenario.preferences.language === 'ar' ? 'rtl' : 'ltr');
    expect(document.documentElement.dataset.reducedMotion).toBe(String(!!scenario.preferences.reducedMotion));
    if (scenario.policy) expect(container.querySelector('[data-effective-density]')?.getAttribute('data-effective-density')).toBe('compact');
    const result = await axe.run(content, {rules: {'color-contrast': {enabled: false}}});
    expect(result.violations.map(v => ({id: v.id, nodes: v.nodes.slice(0, 3).map(n => n.html)}))).toEqual([]);
  });
});
