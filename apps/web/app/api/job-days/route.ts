import { asUser, MANAGERS, requireApi } from '@/lib/auth';
import { idempotent, parseJson, route } from '@/lib/http';
import { afterScheduled, jobDayBody, scheduleJobDay } from '@/lib/jobs';
import { z } from 'zod';

const body = jobDayBody.extend({ notify: z.boolean().default(true) });

/** Schedule a job day. 423 `gated` with the open checks, 409 `conflict` with the equipment clash. */
export const POST = route(async (req) => {
  const ctx = await requireApi(MANAGERS);
  const b = await parseJson(req, body);
  return idempotent(ctx.tenantId, req, 'job-days.create', async () => {
    const id = await asUser(ctx, (tx) => scheduleJobDay(tx, ctx, b));
    const text = await afterScheduled(ctx, id, b.notify);
    return { id, text: text?.status ?? null };
  });
});
