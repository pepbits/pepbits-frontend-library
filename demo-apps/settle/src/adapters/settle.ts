/** Billing data transport for the unchanged Settle Express API.
 * The base URL is configuration (NEXT_PUBLIC_SETTLE_API_URL); components never see it.
 * `x-user-id` selects the fictional desk user exactly as the source demo does; the Settle
 * server checks every right for that user (UI gating is not authorization). */
export class SettleApiError extends Error {
  status: number; code: string; details?: {reasons?: string[]; [key: string]: unknown};
  constructor(status: number, message: string, code: string, details?: SettleApiError['details']) {super(message); this.name = 'SettleApiError'; this.status = status; this.code = code; this.details = details;}
}
export type SettleMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export interface SettleCall {method?: SettleMethod; body?: unknown; signal?: AbortSignal}
export type SettleTransport = <T = unknown>(path: string, call?: SettleCall) => Promise<{data: T; status: number}>;
export type SettleFetch = (url: string, init: RequestInit) => Promise<Response>;

function assertPath(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f#]/.test(path)) throw new SettleApiError(400, 'Invalid Settle API path', 'invalid_path');
  for (const part of path.split('?')[0]!.split('/')) {
    let decoded: string; try {decoded = decodeURIComponent(part);} catch {throw new SettleApiError(400, 'Invalid Settle API path', 'invalid_path');}
    if (decoded === '.' || decoded === '..' || /[\\/]/.test(decoded)) throw new SettleApiError(400, 'Invalid Settle API path', 'invalid_path');
  }
}

export function createSettleTransport(baseUrl: string, userId: () => number, fetcher: SettleFetch = (url, init) => fetch(url, init)): SettleTransport {
  const base = baseUrl.replace(/\/$/, '');
  return async <T,>(path: string, call: SettleCall = {}) => {
    assertPath(path);
    let response: Response;
    try {
      response = await fetcher(base + path, {
        method: call.method ?? 'GET', cache: 'no-store', signal: call.signal,
        headers: {'content-type': 'application/json', 'x-user-id': String(userId())},
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error;
      throw new SettleApiError(0, 'Cannot reach the billing server. Check that the Settle API is running.', 'offline');
    }
    const text = await response.text();
    let json: unknown = null;
    try {json = text ? JSON.parse(text) : null;} catch {/* non-JSON body */}
    if (!response.ok) {
      const error = (json as {error?: {message?: string; code?: string; details?: SettleApiError['details']}} | null)?.error;
      throw new SettleApiError(response.status, error?.message || `Request failed (${response.status})`, error?.code || 'error', error?.details);
    }
    return {data: json as T, status: response.status};
  };
}
