import { officeWrite } from '@/lib/api';
import { SELLERS } from '@/lib/auth';
import { sendChangeOrder } from '@/lib/billing';

export const POST = officeWrite<'id', never>('change-orders.send', SELLERS, null, (tx, ctx, _b, { id }) => sendChangeOrder(tx, ctx, id));
