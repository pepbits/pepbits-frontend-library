import type {NextRequest} from 'next/server';

/** Optional same-origin transport; the unchanged demo API owns every response and write. */
async function forward(request: NextRequest, context: {params: Promise<{segments: string[]}>}) {
  const base = process.env.ERP_API_URL;
  if (!base) return Response.json({error: 'The ERP demo API is not configured.'}, {status: 503});
  const {segments} = await context.params;
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\/\u0000-\u001f]/.test(segment))) return Response.json({error: 'Invalid API path.'}, {status: 400});
  const headers = new Headers();
  for (const key of ['authorization', 'content-type', 'x-product-id', 'x-reference-module', 'x-reference-branch', 'x-reference-facility', 'x-rcm-scope', 'x-teleconsult-role', 'x-teleconsult-patient', 'idempotency-key', 'x-api-key', 'x-calling-ae']) {
    const value = request.headers.get(key); if (value) headers.set(key, value);
  }
  try {
    const response = await fetch(base.replace(/\/$/, '') + '/' + segments.map(encodeURIComponent).join('/') + request.nextUrl.search, {
      method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store', redirect: 'error', signal: request.signal,
    });
    const output = new Headers({'Cache-Control': 'no-store'});
    for (const key of ['content-type', 'x-sentinel-reference', 'retry-after']) {const value = response.headers.get(key); if (value) output.set(key, value);}
    return new Response(response.body, {status: response.status, headers: output});
  } catch {return Response.json({error: 'The ERP demo API is unavailable.'}, {status: 502});}
}
export {forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE};
