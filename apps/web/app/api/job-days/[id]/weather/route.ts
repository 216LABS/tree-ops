import type { P } from '@/lib/api';
import { asUser, OFFICE_ROLES, requireApi } from '@/lib/auth';
import { fail, route } from '@/lib/http';
import { refreshJobDay } from '@/lib/weather';

export const POST = route<P<'id'>>(async (_req, { params }) => {
  const ctx = await requireApi(OFFICE_ROLES);
  const { id } = await params;
  const [jd] = await asUser(ctx, (tx) => tx`select id from job_days where id = ${id}`);
  if (!jd) fail('not_found', 'Job day not found.');
  return { flags: await refreshJobDay(id) };
});
