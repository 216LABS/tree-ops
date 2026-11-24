import { db } from '@treeops/db';
import { deliverMessage } from './messaging';
import { enqueue, runDue } from './queue';
import { refreshUpcoming } from './weather';

/** Handlers for the jobs queue (docs/SPEC.md section 10). */
export const handlers = {
  'sms.send': (p: { messageId: string }) => deliverMessage(p.messageId),
  'weather.refresh': async (p: { tenantId: string }) => {
    await refreshUpcoming(p.tenantId);
  },
  'estimate.expire': async () => {
    await db()`update estimates set status = 'expired' where status = 'sent' and valid_until < current_date`;
  },
  'links.revoke': async () => {
    await db()`update crew_links set revoked = true where not revoked and expires_at < now()`;
  },
};

export const runJobs = (limit = 25) => runDue(handlers, limit);

/** The daily cron: one weather refresh per tenant, plus the housekeeping jobs. Keyed by date so a rerun adds nothing. */
export async function scheduleDaily(now = new Date()) {
  const sql = db();
  const day = now.toISOString().slice(0, 10);
  const tenants = await sql`select id from tenants`;
  for (const t of tenants) await enqueue(sql, 'weather.refresh', { tenantId: t.id }, { tenantId: t.id, idemKey: `weather:${t.id}:${day}` });
  await enqueue(sql, 'estimate.expire', {}, { idemKey: `estimate.expire:${day}` });
  await enqueue(sql, 'links.revoke', {}, { idemKey: `links.revoke:${day}` });
  return { tenants: tenants.length };
}
