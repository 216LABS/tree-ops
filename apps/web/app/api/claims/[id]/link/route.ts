import type { P } from '@/lib/api';
import { asUser, MANAGERS, requireApi } from '@/lib/auth';
import { baseUrl } from '@/lib/env';
import { fail, route } from '@/lib/http';
import { derivedToken, hashToken } from '@/lib/tokens';

/** The read-only link for an adjuster, HOA or lawyer: the job record and its proof packets, no login. */
export const POST = route<P<'id'>>(async (_req, { params }) => {
  const ctx = await requireApi(MANAGERS);
  const { id } = await params;
  // Sets the link fingerprint if this claim doesn't have one yet (claims imported or made before links existed).
  const [c] = await asUser(ctx, (tx) => tx`update claims set viewer_token_hash = ${hashToken(derivedToken('claim', id))} where id = ${id} returning id`);
  if (!c) fail('not_found', 'Claim not found.');
  return { url: `${baseUrl()}/v/${derivedToken('claim', id)}` };
});
