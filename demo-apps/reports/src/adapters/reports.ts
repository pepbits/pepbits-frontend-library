import type {Request} from './http';
import {API_PRODUCT} from './http';

export const REPORTS_NAMESPACE = '/reference-modules/reports';
export const REPORTS_MODULE_ID = 'reference-reports';

function invalidPath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f#]/.test(path)) return true;
  try {return path.split('?')[0]!.split('/').some(part => {const decoded = decodeURIComponent(part);return /[\\]/.test(decoded) || decoded === '.' || decoded === '..';});}
  catch {return true;}
}

/**
 * Configured HTTP for the unchanged Lumen Reports demo API. The module keeps the source `/api/...` paths; this
 * adapter namespaces them, attaches the application, module and branch routing headers (never authority: the
 * API derives the actor from the bearer session) and maps failures to `{status, details}` for the module client.
 */
export function createReportsTransport(request: Request, branch: string) {
  const fetch: Request = async (path, init) => {
    if (invalidPath(path)) throw new Error('Invalid Reports API path');
    const headers = new Headers(init?.headers);
    headers.set('X-Product-Id', API_PRODUCT);
    headers.set('X-Reference-Module', REPORTS_MODULE_ID);
    headers.set('X-Reference-Branch', branch);
    return request(REPORTS_NAMESPACE + path, {...init, headers});
  };
  return {fetch, request: async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, init);
    let body: unknown;
    try {body = await response.json();}
    catch {throw Object.assign(new Error('The Reports service returned an unreadable response.'), {status: response.status, code: 'INVALID_JSON'});}
    if (!response.ok) {
      const details = body as {error?: unknown} | null;
      throw Object.assign(new Error(typeof details?.error === 'string' ? details.error : 'Reports request failed'), {status: response.status, details: body});
    }
    return body as T;
  }};
}
