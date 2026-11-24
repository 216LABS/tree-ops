import { stormTriage, triageAdvice } from '@treeops/core/storm';
import type { P } from '@/lib/api';
import { asUser, OFFICE_ROLES, requireApi } from '@/lib/auth';
import { route } from '@/lib/http';

/** The triage queue (docs/SPEC.md section 9, GET /storm/:eventId/queue). */
export const GET = route<P<'id'>>(async (_req, { params }) => {
  const ctx = await requireApi(OFFICE_ROLES);
  const { id } = await params;
  const rows = await asUser(ctx, (tx) => tx`select * from storm_intake where storm_event_id = ${id} and status not in ('done','declined')`);
  return { queue: stormTriage(rows as unknown as never[]).map((r: { id: string }) => ({ ...r, advice: triageAdvice(r as never) })) };
});
