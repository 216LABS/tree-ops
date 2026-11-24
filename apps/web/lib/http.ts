import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { db } from '@treeops/db';

/**
 * API errors are `{ error: { code, message } }` (docs/SPEC.md section 9) with codes unauthorized, forbidden,
 * not_found, conflict, validation, gated, gone, rate_limited.
 */
export type ErrorCode = 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'gated' | 'gone' | 'rate_limited' | 'not_configured' | 'server';
const STATUS: Record<ErrorCode, number> = { unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, validation: 422, gated: 423, gone: 410, rate_limited: 429, not_configured: 503, server: 500 };

export class HttpError extends Error {
  constructor(public code: ErrorCode, message: string, public detail?: unknown) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export const fail = (code: ErrorCode, message: string, detail?: unknown): never => {
  throw new HttpError(code, message, detail);
};

const issueText = (i: { path: PropertyKey[]; message: string }) => (i.path.length ? `${String(i.path.join('.'))}: ${i.message}` : i.message);

export async function parseJson<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    fail('validation', 'The request was not valid JSON.');
  }
  const out = schema.safeParse(body);
  if (!out.success) fail('validation', [...new Set(out.error.issues.map(issueText))].join(' '));
  return out.data as z.infer<T>;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function errorResponse(err: unknown, path = ''): NextResponse {
  if (err instanceof HttpError) return NextResponse.json({ error: { code: err.code, message: err.message, detail: err.detail } }, { status: err.status });
  if (err instanceof Error && err.message.endsWith('is not configured')) return NextResponse.json({ error: { code: 'not_configured', message: 'This is not set up yet. Payments and texts turn on once their accounts are connected.' } }, { status: 503 });
  const code = (err as { code?: string }).code;
  const map: Record<string, [ErrorCode, string]> = {
    '42501': ['forbidden', 'Your role can’t do this.'],
    '22P02': ['not_found', 'Not found.'],
    '23503': ['conflict', 'Something else still points at this, so it can’t change.'],
    '23505': ['conflict', 'That already exists.'],
    '23514': ['validation', 'That isn’t allowed for this record.'],
    '23P01': ['conflict', 'That equipment is already booked then.'],
  };
  if (code && map[code]) {
    const [c, m] = map[code];
    return NextResponse.json({ error: { code: c, message: m } }, { status: STATUS[c] });
  }
  console.error(JSON.stringify({ level: 'error', msg: 'route failed', path, error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined }));
  return NextResponse.json({ error: { code: 'server', message: 'Something went wrong. Try again.' } }, { status: 500 });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown>;

/** Wraps a route: JSON out, typed errors, no internals leaked. */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const out = await handler(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (err) {
      return errorResponse(err, new URL(req.url).pathname);
    }
  };
}

/**
 * Every write accepts an Idempotency-Key header (a uuid). The response is kept for 7 days and replayed on a repeat, so a
 * double tap or a retried request does the work once.
 */
export async function idempotent<T>(tenantId: string, req: Request, routeName: string, fn: () => Promise<T>): Promise<T> {
  const key = req.headers.get('idempotency-key');
  if (!key || !isUuid(key)) return fn();
  const sql = db();
  const [hit] = await sql`select response from idempotency_keys where tenant_id = ${tenantId} and key = ${key} and created_at > now() - interval '7 days'`;
  if (hit) return hit.response as T;
  const out = await fn();
  await sql`insert into idempotency_keys (tenant_id, key, route, status, response) values (${tenantId}, ${key}, ${routeName}, 200, ${sql.json((out ?? { ok: true }) as never)}) on conflict do nothing`;
  return out;
}

const buckets = new Map<string, { n: number; reset: number }>();
/** A per-instance limit; enough to slow guessing at public links. */
export function rateLimit(key: string, max: number, windowMs = 60_000) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    if (buckets.size > 10_000) buckets.clear();
    buckets.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  if (++b.n > max) fail('rate_limited', 'Too many requests. Wait a minute and try again.');
}

export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;

export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) fail('unauthorized', 'Unauthorized');
}
