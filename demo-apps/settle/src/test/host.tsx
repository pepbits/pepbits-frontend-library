import React from 'react';
import {readFileSync} from 'node:fs';
import {render} from '@testing-library/react';
import {vi} from 'vitest';
import type {SessionValue} from '@pepbits/platform/auth';
import type {Request} from '../adapters/http';
import {SettleProviders} from '../providers';
import {SettleAppPage} from '../renderer';
import {hrefFor, targetFromPath, type SettleTarget} from '../navigation';
import {mockSettle} from './mock-settle';

const catalog = (language: string) => JSON.parse(readFileSync(process.cwd() + '/../../dummy-api/config/localization/shared/' + language + '.json', 'utf8')).messages as Record<string, string>;
export const sharedMessages = catalog('en');

export const fixtureSession: SessionValue = {status: 'authenticated', user: {id: 'fixture-admin', name: 'Fictional Administrator', email: 'fixture@example.test', initials: 'FA', title: 'Administrator', role: 'admin', branch: 'head-office', tenantId: 'fictional-tenant'}, login: async () => null, logout: async () => {}};

export interface HostOptions {overrides?: Record<string, unknown>; rules?: Record<string, {value: unknown; locked: boolean}>}
/** Host demo-API mock: preferences snapshot with policy, and canonical localization catalogs. */
export function hostRequest({overrides = {}, rules = {}}: HostOptions = {}) {
  const writes: Record<string, unknown>[] = [];
  let snapshot = {overrides, preferences: overrides, policy: {revision: 1, rules}, userRevision: 1, canManage: false};
  const request = vi.fn<Request>(async (path, init) => {
    if (path.startsWith('/localization')) {
      const language = new URLSearchParams(path.split('?')[1]).get('language') ?? 'en';
      return Response.json({messages: language === 'ar' ? catalog('ar') : sharedMessages, fallbackMessages: sharedMessages});
    }
    if (path === '/preferences') {
      if (init?.method === 'PUT') {const body = JSON.parse(String(init.body)); writes.push(body); snapshot = {...snapshot, overrides: body.preferences, preferences: body.preferences, userRevision: snapshot.userRevision + 1};}
      return Response.json(snapshot);
    }
    return Response.json({error: 'Unexpected request ' + path}, {status: 404});
  });
  return {request, writes};
}

/** Renders a Settle path through the full public host chain (session, preferences, localization,
 * EnterpriseShell) with mocked host and Settle transports. */
export function renderSettle(path: string, options: HostOptions & {settle?: ReturnType<typeof mockSettle>; session?: SessionValue} = {}) {
  const settle = options.settle ?? mockSettle();
  const host = hostRequest(options);
  const [p, q] = path.split('?');
  const target: SettleTarget = targetFromPath(p || '/', q ?? '');
  const open = vi.fn(), openInNewContext = vi.fn();
  const navigation = {current: target, hrefFor, open, openInNewContext};
  const utils = render(<SettleProviders apiBaseUrl="/api" settleApiBaseUrl="/settle-api" request={host.request} session={options.session ?? fixtureSession} navigation={navigation} settleFetch={settle.fetcher}><SettleAppPage target={target}/></SettleProviders>);
  return {...utils, settle, host, navigation: {open, openInNewContext}, target};
}
