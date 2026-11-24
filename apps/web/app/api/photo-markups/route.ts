import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { fail } from '@/lib/http';

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const body = z.object({
  photoId: z.uuid(),
  treeId: z.uuid(),
  number: z.number().int().min(1).max(999),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#f97316'),
  // Shapes in photo-relative coordinates (0..1), so they line up at any screen size.
  shape: z.object({ circle: z.object({ cx: z.number().min(0).max(1), cy: z.number().min(0).max(1), r: z.number().min(0.01).max(1) }).nullish(), arrow: z.tuple([point, point]).nullish(), label: point }),
});

/** A new markup row per edit (append-only); the newest per photo and tree wins. */
export const POST = officeWrite('markups.create', SELLERS, body, async (tx, ctx, b) => {
  const [p] = await tx`select id from photos where id = ${b.photoId}`;
  const [t] = await tx`select number from trees where id = ${b.treeId}`;
  if (!p || !t) fail('not_found', 'Photo or tree not found.');
  if (t!.number !== b.number) fail('validation', 'The number on the photo must match the tree’s number.');
  const [m] = await tx`insert into photo_markups (tenant_id, photo_id, tree_id, shape, color, number) values (${ctx.tenantId}, ${b.photoId}, ${b.treeId}, ${tx.json(b.shape as never)}, ${b.color}, ${b.number}) returning id`;
  return { id: m!.id };
});
