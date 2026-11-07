/** Same-origin JSON call to one of our API routes (the server checks origin, content type and role). */
export async function api<T = Record<string, unknown>>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T & { ok: boolean; error?: string }> {
  try {
    const r = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok && data.ok !== false, ...data };
  } catch {
    return { ok: false, error: 'network' } as T & { ok: boolean; error?: string };
  }
}
