import { requireCron, route } from '@/lib/http';
import { runJobs } from '@/lib/worker';

export const maxDuration = 60;

/** Every minute: drain the jobs queue. */
export const GET = route(async (req) => {
  requireCron(req);
  return runJobs(50);
});
