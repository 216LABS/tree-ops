import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { treeBody, upsertTree } from '@/lib/estimates';
import { isUuid, fail } from '@/lib/http';

/** Trees are created and edited with ids made on the phone, so the estimate builder can work offline. */
export const PUT = officeWrite<'id', typeof treeBody>('trees.upsert', SELLERS, treeBody, async (tx, ctx, b, { id }) => {
  if (!isUuid(id)) fail('validation', 'Bad tree id.');
  return { id: await upsertTree(tx, ctx, id, b) };
});
