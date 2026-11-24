import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { sendEstimate } from '@/lib/estimates';

export const POST = officeWrite<'id', never>('estimates.send', SELLERS, null, (tx, ctx, _b, { id }) => sendEstimate(tx, ctx, id));
