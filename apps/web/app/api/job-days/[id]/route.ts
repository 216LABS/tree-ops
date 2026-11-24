import type { P } from '@/lib/api';
import { asUser, MANAGERS, requireApi } from '@/lib/auth';
import { fail, idempotent, parseJson, route } from '@/lib/http';
import { afterMoved, moveBody, moveJobDay } from '@/lib/jobs';

/** Move a job day (drag on the board, or "move for weather", which texts the customer the new date). */
export const PATCH = route<P<'id'>>(async (req, { params }) => {
  const ctx = await requireApi(MANAGERS);
  const { id } = await params;
  const b = await parseJson(req, moveBody);
  return idempotent(ctx.tenantId, req, 'job-days.move', async () => {
    const moved = await asUser(ctx, (tx) => moveJobDay(tx, ctx, id, b));
    const text = moved.from !== moved.to || b.weather ? await afterMoved(ctx, id, b.weather) : null;
    return { ...moved, text: text?.status ?? null };
  });
});

export const DELETE = route<P<'id'>>(async (_req, { params }) => {
  const ctx = await requireApi(MANAGERS);
  const { id } = await params;
  return asUser(ctx, async (tx) => {
    const [jd] = await tx`select status, job_id from job_days where id = ${id}`;
    if (!jd) fail('not_found', 'Job day not found.');
    if (jd!.status !== 'planned' && jd!.status !== 'weather_hold') fail('conflict', 'Work was recorded on this day; it can’t be removed.');
    const [records] = await tx`select (select count(*) from briefings where job_day_id = ${id}) + (select count(*) from work_log where job_day_id = ${id}) + (select count(*) from photos where job_day_id = ${id}) as n`;
    if (Number(records!.n) > 0) fail('conflict', 'Work was recorded on this day; it can’t be removed.');
    await tx`delete from crew_links where job_day_id = ${id}`;
    await tx`delete from job_days where id = ${id}`;
    await tx`update jobs set status = 'unscheduled' where id = ${jd!.job_id} and status = 'scheduled' and not exists (select 1 from job_days where job_id = ${jd!.job_id})`;
    return { ok: true };
  });
});
