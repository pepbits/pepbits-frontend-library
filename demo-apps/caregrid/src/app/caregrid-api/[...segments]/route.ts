import type {NextRequest} from 'next/server';

/**
 * Optional same-origin transport to the unchanged CareGrid scheduling API, including its
 * Server-Sent Events stream. No credential is forwarded: the scheduling API has no
 * authentication of its own, so the host session token must not leave this origin.
 */
async function forward(request: NextRequest, context: {params: Promise<{segments: string[]}>}) {
  const base = process.env.CAREGRID_SCHEDULING_API_URL;
  if (!base) return Response.json({error: 'The CareGrid scheduling API is not configured.'}, {status: 503});
  const {segments} = await context.params;
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[\\/\u0000-\u001f]/.test(segment))) return Response.json({error: 'Invalid API path.'}, {status: 400});
  const headers = new Headers();
  for (const key of ['content-type', 'accept', 'last-event-id']) {const value = request.headers.get(key); if (value) headers.set(key, value);}
  try {
    const response = await fetch(base.replace(/\/$/, '') + '/' + segments.map(encodeURIComponent).join('/') + request.nextUrl.search, {
      method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store', redirect: 'error', signal: request.signal,
    });
    const type = response.headers.get('content-type') ?? '';
    // no-transform keeps response compression from buffering the live event stream.
    const output = new Headers({'Cache-Control': type.startsWith('text/event-stream') ? 'no-cache, no-transform' : 'no-store'});
    if (type) output.set('content-type', type);
    if (type.startsWith('text/event-stream')) output.set('X-Accel-Buffering', 'no');
    return new Response(response.body, {status: response.status, headers: output});
  } catch {return Response.json({error: 'The CareGrid scheduling API is unavailable.'}, {status: 502});}
}
export const dynamic = 'force-dynamic';
export {forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE};
