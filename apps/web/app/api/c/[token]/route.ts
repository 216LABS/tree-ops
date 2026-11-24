import type { P } from '@/lib/api';
import { crewBundle, resolveLink } from '@/lib/crew';
import { rateLimit, route } from '@/lib/http';

/** The crew link's day bundle (no login). */
export const GET = route<P<'token'>>(async (_req, { params }) => {
  const { token } = await params;
  rateLimit(`c:${token.slice(0, 32)}`, 300);
  return crewBundle(await resolveLink(token));
});
