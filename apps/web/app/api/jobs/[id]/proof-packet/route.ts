import type { P } from '@/lib/api';
import { asUser, MANAGERS, requireApi } from '@/lib/auth';
import { fail, route } from '@/lib/http';
import { generatePacket } from '@/lib/proof';

export const maxDuration = 60;

export const POST = route<P<'id'>>(async (_req, { params }) => {
  const ctx = await requireApi(MANAGERS);
  const { id } = await params;
  const [j] = await asUser(ctx, (tx) => tx`select id from jobs where id = ${id}`);
  if (!j) fail('not_found', 'Job not found.');
  const out = await generatePacket(ctx.tenantId, id, ctx.userId);
  return { id: out.id, sha256: out.sha256, url: out.url };
});
