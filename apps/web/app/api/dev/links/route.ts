import { db } from '@treeops/db';
import { z } from 'zod';
import { baseUrl, isLocalOrTest } from '@/lib/env';
import { fail, parseJson, route } from '@/lib/http';
import { encryptToken, hashToken, newToken } from '@/lib/tokens';

/** Local and test only: fresh crew, estimate or invoice links for the demo (the real ones are only ever texted). */
export const POST = route(async (req) => {
  if (!isLocalOrTest()) fail('not_found', 'Not found.');
  const b = await parseJson(req, z.object({ kind: z.enum(['crew', 'estimate', 'invoice']), id: z.uuid() }));
  const sql = db();
  const token = newToken();
  if (b.kind === 'crew') {
    const [jd] = await sql`select tenant_id, day from job_days where id = ${b.id}`;
    if (!jd) fail('not_found', 'No such job day.');
    await sql`update crew_links set revoked = true where job_day_id = ${b.id}`;
    await sql`insert into crew_links (tenant_id, job_day_id, token_hash, token_enc, expires_at) values (${jd!.tenant_id}, ${b.id}, ${hashToken(token)}, ${encryptToken(token)}, now() + interval '3 days')`;
    return { url: `${baseUrl()}/c/${token}` };
  }
  if (b.kind === 'estimate') {
    const [e] = await sql`update estimates set public_token_hash = ${hashToken(token)} where id = ${b.id} returning id`;
    if (!e) fail('not_found', 'No such estimate.');
    return { url: `${baseUrl()}/e/${token}` };
  }
  const [i] = await sql`update invoices set public_token_hash = ${hashToken(token)} where id = ${b.id} returning id`;
  if (!i) fail('not_found', 'No such invoice.');
  return { url: `${baseUrl()}/i/${token}` };
});
