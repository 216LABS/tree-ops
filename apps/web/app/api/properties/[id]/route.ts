import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { fail } from '@/lib/http';

const body = z.object({
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

export const PATCH = officeWrite<'id', typeof body>('properties.update', SELLERS, body, async (tx, _ctx, b, { id }) => {
  const [p] = await tx`update properties set address = ${b.address}, city = ${b.city ?? null}, state_code = ${b.stateCode.toUpperCase()}, lat = ${b.lat ?? null}, lon = ${b.lon ?? null},
    hoa_name = ${b.hoaName ?? null}, access_notes = ${b.accessNotes ?? null}, gate_code = ${b.gateCode ?? null}, hazards = ${tx.json(b.hazards)} where id = ${id} returning id`;
  if (!p) fail('not_found', 'Property not found.');
  return { id };
});
