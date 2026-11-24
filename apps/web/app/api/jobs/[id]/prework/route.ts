import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { checkBody, upsertCheck } from '@/lib/jobs';

export const POST = officeWrite<'id', typeof checkBody>('prework.upsert', SELLERS, checkBody, async (tx, ctx, b, { id }) => ({ id: await upsertCheck(tx, ctx, id, b) }));
