import { db } from '@treeops/db';
import { z } from 'zod';
import { isMock, isProd } from '@/lib/env';
import { fail, parseJson, route } from '@/lib/http';

/** Mock Stripe onboarding: marks the mock account able to take payments. */
export const POST = route(async (req) => {
  if (isProd() || !isMock()) fail('not_found', 'Not found.');
  const b = await parseJson(req, z.object({ account: z.string().startsWith('acct_mock_') }));
  await db()`update tenants set stripe_charges_enabled = true where stripe_account_id = ${b.account}`;
  return { ok: true };
});
