import React from 'react';
import {render as testingRender} from '@testing-library/react';
import {vi} from 'vitest';
import {DEFAULT_PREFERENCES, type PreferencePolicy, type UserPreferences} from '@pepbits/preferences';
import type {ReferenceHost} from '../modules/reports/host';
import {LocaleWrapper} from './locale';
import {createStore, type ReportsStore} from './store';

export const finance = {id: 'fixture-finance', tenantId: 'fictional-tenant', name: 'Fictional Finance Manager', email: 'finance@example.test', role: 'finance-manager'};
export const admin = {id: 'fixture-admin', tenantId: 'fictional-tenant', name: 'Fictional Administrator', email: 'admin@example.test', role: 'enterprise-admin'};
export const operations = {id: 'fixture-operations', tenantId: 'fictional-tenant', name: 'Fictional Operations Analyst', email: 'operations@example.test', role: 'operations-analyst'};
export const SCOPE = {applicationId: 'nexora', branchId: 'head-office'};

/** A module host whose request/fetch are served by the in-process demo store (mocked API, no network). */
export function storeHost(path: string, o: {store?: ReportsStore; user?: typeof admin; preferences?: Partial<UserPreferences>; policy?: PreferencePolicy} = {}) {
  const store = o.store ?? createStore(), user = o.user ?? admin;
  const calls: {path: string; method: string; body?: unknown}[] = [];
  const call = async (p: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({path: p, method: init?.method ?? 'GET', body});
    return store.handle(user, SCOPE, {method: init?.method ?? 'GET', path: p, body});
  };
  const preferences = {...DEFAULT_PREFERENCES, ...o.preferences} as UserPreferences;
  const navigate = vi.fn();
  const host: ReferenceHost = {
    scope: {tenantId: user.tenantId, applicationId: SCOPE.applicationId, branchId: SCOPE.branchId, userId: user.id, roles: [user.role]},
    preferences, path, navigate,
    preferenceHost: {preferences, preferencePolicy: o.policy ?? {revision: 0, rules: {}}, preferencesAvailable: true, onPreferenceChange: vi.fn()},
    request: async <T,>(p: string, init?: RequestInit) => {
      const r = await call(p, init);
      if (r.status >= 400) throw Object.assign(new Error((r.body as {error?: string}).error ?? 'failed'), {status: r.status, details: r.body});
      return r.body as T;
    },
    fetch: async (p: string, init?: RequestInit) => {
      const r = await call(p, init);
      const type = r.headers?.['Content-Type'];
      return new Response(type && !type.includes('json') ? r.body as BodyInit : JSON.stringify(r.body), {status: r.status, headers: r.headers ?? {'Content-Type': 'application/json'}});
    },
  };
  return {host, calls, navigate, store, user};
}
export const render = (ui: React.ReactElement) => testingRender(ui, {wrapper: LocaleWrapper});
export const LONG = {timeout: 10000};
