import { OFFICE_ROLES, requireApi } from '@/lib/auth';
import { route } from '@/lib/http';
import { refreshUpcoming } from '@/lib/weather';

export const POST = route(async () => {
  const ctx = await requireApi(OFFICE_ROLES);
  return refreshUpcoming(ctx.tenantId, 14);
});
