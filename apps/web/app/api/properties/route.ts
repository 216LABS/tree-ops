import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';

const propertyBody = z.object({
  customerId: z.uuid(),
  address: z.string().trim().min(3).max(300),
  city: z.string().max(100).nullish(),
  stateCode: z.string().length(2),
  lat: z.number().min(-90).max(90).nullish(),
  lon: z.number().min(-180).max(180).nullish(),
  hoaName: z.string().max(120).nullish(),
  accessNotes: z.string().max(1000).nullish(),
  gateCode: z.string().max(40).nullish(),
  hazards: z.array(z.string().max(120)).max(20).default([]),
});

export const POST = officeWrite('properties.create', SELLERS, propertyBody, async (tx, ctx, b) => {
  const [p] = await tx`insert into properties (tenant_id, customer_id, address, city, state_code, lat, lon, hoa_name, access_notes, gate_code, hazards)
    values (${ctx.tenantId}, ${b.customerId}, ${b.address}, ${b.city ?? null}, ${b.stateCode.toUpperCase()}, ${b.lat ?? null}, ${b.lon ?? null}, ${b.hoaName ?? null}, ${b.accessNotes ?? null}, ${b.gateCode ?? null}, ${tx.json(b.hazards)}) returning id`;
  return { id: p!.id };
});
