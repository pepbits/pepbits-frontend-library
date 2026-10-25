import type {NextRequest} from 'next/server';

/** Optional same-origin transport to the unchanged Settle Express API, which owns every response,
 * rule and write. `SETTLE_API_URL` is server-only, e.g. http://127.0.0.1:4000 (no /api suffix). */
async function forward(request: NextRequest, context: {params: Promise<{segments: string[]}>}) {
  const base = process.env.SETTLE_API_URL;
  if (!base) return Response.json({error: {code: 'not_configured', message: 'The Settle billing API is not configured.'}}, {status: 503});
  const {segments} = await context.params;
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\/\u0000-\u001f]/.test(segment))) return Response.json({error: {code: 'invalid_path', message: 'Invalid API path.'}}, {status: 400});
  const headers = new Headers();
  for (const key of ['content-type', 'x-user-id']) {const value = request.headers.get(key); if (value) headers.set(key, value);}
  try {
    const response = await fetch(base.replace(/\/$/, '') + '/api/' + segments.map(encodeURIComponent).join('/') + request.nextUrl.search, {
      method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store', redirect: 'error', signal: request.signal,
    });
    const output = new Headers({'Cache-Control': 'no-store'});
    const type = response.headers.get('content-type'); if (type) output.set('content-type', type);
    return new Response(response.body, {status: response.status, headers: output});
  } catch {return Response.json({error: {code: 'offline', message: 'The Settle billing API is unavailable.'}}, {status: 502});}
}
export {forward as GET, forward as POST, forward as PATCH, forward as DELETE};
