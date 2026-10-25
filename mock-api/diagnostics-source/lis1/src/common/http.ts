/** Real outbound HTTP (no mocks). Returns status + body text, never throws. */
export async function postExternal(url: string, body: string, contentType: string, headers: Record<string, string> = {}) {
  if(process.env.DIAGNOSTICS_EMBEDDED==='1')return {ok:false,status:0,body:'External delivery is disabled in the reference runtime'};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': contentType, ...headers },
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text.slice(0, 4000) };
  } catch (e: any) {
    return { ok: false, status: 0, body: `Connection failed: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}

export function authHeaders(type: string, token?: string): Record<string, string> {
  if (!token) return {};
  if (type === 'BEARER') return { Authorization: `Bearer ${token}` };
  if (type === 'API_KEY') return { 'x-api-key': token };
  return {};
}
