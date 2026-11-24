import type { P } from '@/lib/api';
import { approveBody, approveEstimate } from '@/lib/estimates';
import { clientIp, parseJson, rateLimit, route } from '@/lib/http';

/** Customer approval: no account; the signature, name, address and time are kept (screen 2). */
export const POST = route<P<'token'>>(async (req, { params }) => {
  const { token } = await params;
  rateLimit(`e:${clientIp(req)}`, 30);
  const b = await parseJson(req, approveBody);
  return approveEstimate(token, b, { ip: clientIp(req), userAgent: req.headers.get('user-agent') });
});
