import { z } from 'zod';
import type { P } from '@/lib/api';
import { applyOps, opSchema, resolveLink } from '@/lib/crew';
import { clientIp, parseJson, rateLimit, route } from '@/lib/http';

/**
 * The outbox flush (docs/SPEC.md section 9): `{ops}` in, `{applied, dupes, rejected, retry}` out. `retry` means an op
 * depends on a photo or briefing that hasn't arrived yet; the phone keeps it and sends again.
 */
export const POST = route<P<'token'>>(async (req, { params }) => {
  const { token } = await params;
  rateLimit(`c:${token.slice(0, 32)}`, 600);
  const scope = await resolveLink(token);
  const b = await parseJson(req, z.object({ ops: z.array(opSchema).max(100) }));
  return applyOps(scope, b.ops, { ip: clientIp(req), userAgent: req.headers.get('user-agent') });
});
