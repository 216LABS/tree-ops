import { toE164 } from '@treeops/core/messages';
import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { recordConsent } from '@/lib/messaging';

const body = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(['residential', 'commercial', 'hoa', 'property_mgr', 'municipal']).default('residential'),
  phone: z.string().max(30).nullish(),
  email: z.email().nullish().or(z.literal('')),
  locale: z.enum(['en', 'es']).default('en'),
  billingTermsDays: z.number().int().min(0).max(120).default(0),
  notes: z.string().max(4000).nullish(),
  textOk: z.boolean().default(false),
  property: z.object({
    address: z.string().trim().min(3).max(300),
    city: z.string().max(100).nullish(),
    stateCode: z.string().length(2),
    lat: z.number().min(-90).max(90).nullish(),
    lon: z.number().min(-180).max(180).nullish(),
    hoaName: z.string().max(120).nullish(),
    accessNotes: z.string().max(1000).nullish(),
    gateCode: z.string().max(40).nullish(),
  }).nullish(),
});

/** New customer, optionally with their first property (docs/SPEC.md screen 13 and the customer screens). */
export const POST = officeWrite('customers.create', SELLERS, body, async (tx, ctx, b) => {
  const phone = b.phone ? (toE164(b.phone) ?? b.phone) : null;
  const [c] = await tx`insert into customers (tenant_id, branch_id, kind, name, phone, email, locale, billing_terms_days, notes)
    values (${ctx.tenantId}, ${ctx.branchId}, ${b.kind}, ${b.name}, ${phone}, ${b.email || null}, ${b.locale}, ${b.billingTermsDays}, ${b.notes ?? null}) returning id`;
  if (b.textOk && phone) await recordConsent(tx, ctx.tenantId, phone, 'opted_in', `verbal:office:${ctx.userId}`);
  let propertyId: string | null = null;
  if (b.property) {
    const p = b.property;
    const [row] = await tx`insert into properties (tenant_id, customer_id, address, city, state_code, lat, lon, hoa_name, access_notes, gate_code)
      values (${ctx.tenantId}, ${c!.id}, ${p.address}, ${p.city ?? null}, ${p.stateCode.toUpperCase()}, ${p.lat ?? null}, ${p.lon ?? null}, ${p.hoaName ?? null}, ${p.accessNotes ?? null}, ${p.gateCode ?? null}) returning id`;
    propertyId = row!.id;
  }
  return { id: c!.id, propertyId };
});
