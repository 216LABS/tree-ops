import { z } from 'zod';
import { supabaseServer } from '@/lib/auth';
import { DEMO, demoLoginEnabled } from '@/lib/env';
import { fail, parseJson, route } from '@/lib/http';

/** "Use the demo company" (local and test only, or a hosted copy that opts in with DEMO_LOGIN=1). */
export const POST = route(async (req) => {
  if (!demoLoginEnabled()) fail('not_found', 'Not found.');
  const b = await parseJson(req, z.object({ as: z.enum(['owner', 'sales', 'office']).default('owner') }));
  const email = b.as === 'sales' ? DEMO.sales : b.as === 'office' ? DEMO.office : DEMO.email;
  const { error } = await (await supabaseServer()).auth.signInWithPassword({ email, password: DEMO.password });
  if (error) fail('unauthorized', 'The demo company isn’t set up. Run pnpm seed:demo.');
  return { ok: true };
});
