import { db } from '@treeops/db';
import { requireApi } from '@/lib/auth';
import { baseUrl } from '@/lib/env';
import { route } from '@/lib/http';
import { providers } from '@/lib/providers';

/** Starts (or resumes) Stripe onboarding for the company's own account. Skippable during setup. */
export const POST = route(async () => {
  const ctx = await requireApi(['owner']);
  const p = providers().payments;
  let account = ctx.tenant.stripe_account_id;
  if (!account) {
    account = (await p.createConnectedAccount({ businessName: ctx.tenant.name, tenantId: ctx.tenantId })).accountId;
    await db()`update tenants set stripe_account_id = ${account} where id = ${ctx.tenantId}`;
  }
  const link = await p.createAccountLink(account, `${baseUrl()}/settings?tab=company&stripe=done`, `${baseUrl()}/settings?tab=company`);
  return { url: link.url };
});
