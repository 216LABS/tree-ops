'use client';

export class ApiError extends Error {
  constructor(public code: string, message: string, public detail?: unknown, public status = 0) {
    super(message);
  }
}

/** JSON calls from the office screens. Every write carries a fresh Idempotency-Key, so a double tap does the work once. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; key?: string } = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['Idempotency-Key'] = opts.key ?? crypto.randomUUID();
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new ApiError('offline', 'No connection. Try again when you have signal.');
  }
  const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string; detail?: unknown } } | null;
  if (!res.ok) throw new ApiError(json?.error?.code ?? 'server', json?.error?.message ?? 'Something went wrong.', json?.error?.detail, res.status);
  return json as T;
}

export const uuid = () => crypto.randomUUID();
