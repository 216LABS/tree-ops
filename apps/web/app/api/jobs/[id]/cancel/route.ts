import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { fail } from '@/lib/http';

export const POST = officeWrite<'id', never>('jobs.cancel', MANAGERS, null, async (tx, _ctx, _b, { id }) => {
  const [j] = await tx`update jobs set status = 'cancelled' where id = ${id} and status in ('unscheduled','scheduled') returning id`;
  if (!j) fail('conflict', 'Only a job that hasn’t started can be cancelled.');
  await tx`delete from job_days jd where jd.job_id = ${id} and jd.status in ('planned','weather_hold')
    and not exists (select 1 from briefings b where b.job_day_id = jd.id) and not exists (select 1 from work_log w where w.job_day_id = jd.id) and not exists (select 1 from photos p where p.job_day_id = jd.id)`;
  return { ok: true };
});
