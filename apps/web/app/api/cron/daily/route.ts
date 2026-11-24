import { requireCron, route } from '@/lib/http';
import { runJobs, scheduleDaily } from '@/lib/worker';

export const maxDuration = 60;

/** Early morning: queue each company's weather refresh and the housekeeping jobs, then start draining. */
export const GET = route(async (req) => {
  requireCron(req);
  const out = await scheduleDaily();
  const ran = await runJobs(50);
  return { ...out, ...ran };
});
