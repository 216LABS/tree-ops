import type { z } from 'zod';
import { asUser, requireApi, type Ctx, type Role } from './auth';
import { idempotent, parseJson, route } from './http';
import type { Tx } from '@treeops/db';

/** Route params in Next 16 arrive as a promise. */
export type P<K extends string> = { params: Promise<Record<K, string>> };

/**
 * An office write: role check, idempotency key, JSON body validation, then `fn` as the signed-in user so RLS applies.
 */
export function officeWrite<K extends string, S extends z.ZodTypeAny>(name: string, roles: Role[], schema: S | null, fn: (tx: Tx, ctx: Ctx, body: z.infer<S>, params: Record<K, string>, req: Request) => Promise<unknown>) {
  return route<P<K>>(async (req, { params }) => {
    const ctx = await requireApi(roles);
    const p = await params;
    const body = schema ? await parseJson(req, schema) : (undefined as z.infer<S>);
    return idempotent(ctx.tenantId, req, name, () => asUser(ctx, (tx) => fn(tx, ctx, body, p, req)));
  });
}
