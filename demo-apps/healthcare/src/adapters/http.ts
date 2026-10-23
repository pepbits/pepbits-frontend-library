import {createContext, useContext} from 'react';
import {createAuthedFetch} from '@pepbits/platform/auth';

export type Request = (path: string, init?: RequestInit) => Promise<Response>;
// The existing API recognizes this product scope. It is routing metadata, not authority.
export const API_PRODUCT = 'nexora';
export function createRequest(apiBaseUrl: string): Request {
  const request = createAuthedFetch({apiBaseUrl});
  return (path, init) => {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path');
    const headers = new Headers(init?.headers);
    headers.set('X-Product-Id', API_PRODUCT);
    return request(path, {...init, headers});
  };
}
export class ApiFailure extends Error {
  constructor(public status: number, message: string) {super(message);}
}
export async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiFailure(response.status, typeof body?.error === 'string' ? body.error : 'The service request failed.');
  if (!body) throw new ApiFailure(502, 'The service returned an invalid response.');
  return body as T;
}
export const RequestContext = createContext<Request | null>(null);
export function useRequest() {
  const value = useContext(RequestContext);
  if (!value) throw new Error('Healthcare API provider is missing');
  return value;
}
