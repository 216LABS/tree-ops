import { toE164 } from '@treeops/core/messages';
import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { fail } from '@/lib/http';

const body = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  kind: z.enum(['residential', 'commercial', 'hoa', 'property_mgr', 'municipal']).optional(),
  phone: z.string().max(30).nullish(),
  email: z.email().nullish().or(z.literal('')),
  locale: z.enum(['en', 'es']).optional(),
  billingTermsDays: z.number().int().min(0).max(120).optional(),
  notes: z.string().max(4000).nullish(),
});

export const PATCH = officeWrite<'id', typeof body>('customers.update', SELLERS, body, async (tx, _ctx, b, { id }) => {
  const [c] = await tx`update customers set
      name = coalesce(${b.name ?? null}, name), kind = coalesce(${b.kind ?? null}, kind), locale = coalesce(${b.locale ?? null}, locale),
      billing_terms_days = coalesce(${b.billingTermsDays ?? null}, billing_terms_days),
      phone = ${b.phone === undefined ? null : b.phone ? (toE164(b.phone) ?? b.phone) : null}, email = ${b.email || null}, notes = ${b.notes ?? null}
    where id = ${id} returning id`;
  if (!c) fail('not_found', 'Customer not found.');
  return { id };
});
