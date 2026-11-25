// Client helpers for the kid API routes. Pure fetch; safe in the browser.

export type ApiResult<T> = { status: number; data: T | null };

type Opts = { retries?: number; delayMs?: number; fetchImpl?: typeof fetch };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POSTs JSON. Network errors and 5xx are retried (default 3 retries) with the SAME body, so an id in it
 * (clientAttemptId) keeps the write idempotent. 4xx come straight back. status 0 = never reached the server.
 */
export async function postWithRetry<T = unknown>(url: string, body: unknown, opts: Opts = {}): Promise<ApiResult<T>> {
  const { retries = 3, delayMs = 400, fetchImpl = fetch } = opts;
  const payload = JSON.stringify(body);
  for (let i = 0; ; i++) {
    try {
      const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
      if (res.status < 500 || i >= retries) {
        return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
      }
    } catch {
      if (i >= retries) return { status: 0, data: null };
    }
    await wait(delayMs * 2 ** i);
  }
}

/** A v4 UUID; falls back to getRandomValues where randomUUID is missing (older phones). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
