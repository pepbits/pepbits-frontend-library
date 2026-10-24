import type {PreferencePolicy, UserPreferences} from '@pepbits/preferences';
import type {Request} from '../adapters/http';
import {catalog} from './locale';
import {createStore, type ReportsStore} from './store';
import {fixtureUser} from './session';

/**
 * Mocked application HTTP for jsdom: preferences/localization answers plus the reports namespace served by the
 * in-process demo store with the same identity rules as the demo router (actor from the session, branch from the
 * routing header). Unexpected paths are recorded so tests can assert the page used only known endpoints.
 */
export function mockHttp(preferences: Partial<UserPreferences> = {}, policy: PreferencePolicy = {revision: 1, rules: {}}, options: {store?: ReportsStore; user?: typeof fixtureUser} = {}) {
  const store = options.store ?? createStore(), user = options.user ?? fixtureUser;
  const unexpected: string[] = [], calls: {path: string; method: string; headers: Headers; body?: unknown}[] = [];
  const request: Request = async (path, init) => {
    const method = init?.method ?? 'GET', headers = new Headers(init?.headers), body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({path, method, headers, body});
    if (path === '/preferences') return Response.json({overrides: preferences, preferences, policy, userRevision: 1, canManage: false});
    if (path.startsWith('/localization')) {const language = new URL(path, 'http://localhost').searchParams.get('language') ?? 'en';return Response.json({messages: catalog(language), fallbackMessages: catalog('en')});}
    const match = path.match(/^\/reference-modules\/reports(\/.*)$/);
    if (match) {
      if (headers.get('X-Reference-Module') !== 'reference-reports') return Response.json({error: 'Module is unavailable.'}, {status: 403});
      const result = store.handle(user, {applicationId: headers.get('X-Product-Id'), branchId: headers.get('X-Reference-Branch')}, {method, path: match[1]!, body});
      const type = result.headers?.['Content-Type'];
      if (type && !type.includes('json')) return new Response(result.body as BodyInit, {status: result.status, headers: result.headers});
      return Response.json(result.body, {status: result.status});
    }
    unexpected.push(method + ' ' + path);
    return Response.json({error: 'Not found'}, {status: 404});
  };
  return {request, store, calls, unexpected};
}
