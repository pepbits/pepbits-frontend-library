import type {Request} from './http';
export type DiagnosticVariant = 'lis1' | 'lis2' | 'ris1';
/** Scope is routing metadata. The unchanged API authenticates the actor and authorizes each command. */
export function createDiagnosticTransport(request: Request, variant: DiagnosticVariant, branch: string): Request {
  return (path, init) => {
    try {
      if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path) || path.split(/[/?#]/).some(part => /[\\/]/.test(decodeURIComponent(part)) || ['.', '..'].includes(decodeURIComponent(part)))) throw new Error('Invalid diagnostic API path');
    } catch {return Promise.reject(new Error('Invalid diagnostic API path'));}
    const headers = new Headers(init?.headers);
    headers.set('X-Product-Id', 'nexora'); headers.set('X-Reference-Branch', branch); headers.set('X-Reference-Module', 'reference-' + variant);
    return request('/reference-modules/' + variant + path, {...init, headers});
  };
}
