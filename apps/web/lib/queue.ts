import { db, type Q } from '@treeops/db';

/**
 * The jobs queue (docs/SPEC.md section 10). Claimed with FOR UPDATE SKIP LOCKED and a 2-minute lease; retried with
 * backoff; dead after max_attempts, shown in Settings > System.
 */
export type JobKind = 'sms.send' | 'weather.refresh' | 'estimate.expire' | 'links.revoke';

export async function enqueue(sql: Q, kind: JobKind, payload: Record<string, unknown>, opts: { tenantId?: string | null; runAfter?: Date; idemKey?: string; maxAttempts?: number } = {}) {
  const [row] = await sql`
    insert into jobs_queue (tenant_id, kind, payload, run_after, idem_key, max_attempts)
    values (${opts.tenantId ?? null}, ${kind}, ${sql.json(payload as never)}, ${opts.runAfter ?? new Date()}, ${opts.idemKey ?? null}, ${opts.maxAttempts ?? (kind === 'sms.send' ? 5 : 3)})
    on conflict (idem_key) do nothing returning id`;
  return row?.id as number | undefined;
}

type HandlerMap = Record<JobKind, (payload: any, tenantId: string | null) => Promise<void>>;

export async function runDue(handlers: HandlerMap, limit = 25, onlyIds?: number[]): Promise<{ done: number; failed: number }> {
  const sql = db();
  const claimed = await sql`
    update jobs_queue set status = 'running', locked_until = now() + interval '2 minutes', attempts = attempts + 1
    where id in (
      select id from jobs_queue
      where (status = 'queued' or (status = 'running' and locked_until < now())) and run_after <= now()
        ${onlyIds ? sql`and id = any(${onlyIds})` : sql``}
      order by id limit ${limit} for update skip locked)
    returning *`;
  let done = 0;
  let failed = 0;
  for (const job of claimed) {
    try {
      await handlers[job.kind as JobKind](job.payload, job.tenant_id);
      await sql`update jobs_queue set status = 'done', locked_until = null, last_error = null where id = ${job.id}`;
      done++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      const permanent = (err as { permanent?: boolean }).permanent === true;
      const dead = permanent || job.attempts >= job.max_attempts;
      const backoffSec = Math.min(3600, 30 * 2 ** (job.attempts - 1)) + Math.floor(Math.random() * 15);
      await sql`update jobs_queue set status = ${dead ? 'dead' : 'queued'}, locked_until = null, last_error = ${msg.slice(0, 500)},
        run_after = now() + make_interval(secs => ${backoffSec}) where id = ${job.id}`;
    }
  }
  return { done, failed };
}
