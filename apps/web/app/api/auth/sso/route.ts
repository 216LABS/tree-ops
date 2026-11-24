import { db } from '@treeops/db';
import { z } from 'zod';
import { supabaseServer } from '@/lib/auth';
import { baseUrl } from '@/lib/env';
import { fail, parseJson, rateLimit, clientIp, route } from '@/lib/http';

/**
 * Enterprise sign-in by email domain (docs/SPEC.md section 9, POST /auth/sso/start): Supabase SAML SSO for a domain the
 * company registered. [T] The identity provider (Okta or Azure AD) is set up per docs/ENTERPRISE.md.
 */
export const POST = route(async (req) => {
  rateLimit(`sso:${clientIp(req)}`, 20);
  const b = await parseJson(req, z.object({ email: z.email() }));
  const domain = b.email.split('@')[1]!.toLowerCase();
  const [t] = await db()`select id from tenants where sso_domain = ${domain}`;
  if (!t) fail('not_found', 'That company doesn’t use single sign-on here. Use your password.');
  const { data, error } = await (await supabaseServer()).auth.signInWithSSO({ domain, options: { redirectTo: `${baseUrl()}/auth/callback` } });
  if (error || !data?.url) fail('not_configured', 'Single sign-on isn’t connected for this company yet.');
  return { url: data!.url };
});
