export interface ReferenceTransportOptions {
  namespace: string;
  moduleId?: string;
  applicationId: string;
  branchId: string;
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  failureMessage: () => string;
}
/** Configurable host transport. Credentials remain in the injected host fetch. */
export function createReferenceTransport(options: ReferenceTransportOptions) {
  const fetch = (endpoint: string, init?: RequestInit) => {
    const path = endpoint.startsWith('/school/') ? endpoint.slice('/school'.length) : endpoint;
    const pathname = path.split(/[?#]/)[0];
    let invalid = !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(pathname);
    try { invalid ||= pathname.split('/').some(part => ['.', '..'].includes(decodeURIComponent(part))); }
    catch { invalid = true; }
    if (invalid) return Promise.reject(new Error('Invalid module API path'));
    const headers = new Headers(init?.headers);
    headers.set('X-Product-Id', options.applicationId);
    headers.set('X-Reference-Branch', options.branchId);
    if (options.moduleId) headers.set('X-Reference-Module', options.moduleId);
    return options.fetch(options.namespace + path, {...init, headers});
  };
  const request = async <T,>(endpoint: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(endpoint, init);
    let body: unknown;
    try { body = await response.json(); }
    catch { throw Object.assign(new Error(options.failureMessage()), {status: response.status, code: 'INVALID_JSON'}); }
    if (!response.ok) {
      const details = body as {error?: unknown} | null;
      throw Object.assign(new Error(typeof details?.error === 'string' ? details.error : options.failureMessage()), {status: response.status, details: body});
    }
    return body as T;
  };
  return {fetch, request};
}
