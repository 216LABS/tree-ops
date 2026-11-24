import { z } from 'zod';
import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { createEstimate } from '@/lib/estimates';

export const POST = officeWrite('estimates.create', SELLERS, z.object({ propertyId: z.uuid() }), async (tx, ctx, b) => ({ id: await createEstimate(tx, ctx, b.propertyId) }));
