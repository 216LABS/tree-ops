import { z } from 'zod';
import type { P } from '@/lib/api';
import { signChangeOrder } from '@/lib/billing';
import { clientIp, parseJson, rateLimit, route } from '@/lib/http';

const body = z.object({ signerName: z.string().trim().min(2).max(120).default('x'), signaturePng: z.string().max(600_000).default(''), clientId: z.uuid(), decline: z.boolean().default(false), consentSms: z.boolean().default(false) });

export const POST = route<P<'token'>>(async (req, { params }) => {
  const { token } = await params;
  rateLimit(`co:${clientIp(req)}`, 30);
  const b = await parseJson(req, body);
  return signChangeOrder(token, b, { ip: clientIp(req), userAgent: req.headers.get('user-agent') });
});
