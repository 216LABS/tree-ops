import type { P } from '@/lib/api';
import { asUser, requireApi, SELLERS } from '@/lib/auth';
import { fail, route } from '@/lib/http';
import { sendCopy } from '@/lib/phc';

export const POST = route<P<'id'>>(async (_req, { params }) => {
  const ctx = await requireApi(SELLERS);
  const { id } = await params;
  const [a] = await asUser(ctx, (tx) => tx`select id from phc_applications where id = ${id}`);
  if (!a) fail('not_found', 'Record not found.');
  return sendCopy(ctx, id);
});
