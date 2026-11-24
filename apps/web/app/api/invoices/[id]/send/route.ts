import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { sendInvoice } from '@/lib/billing';

export const POST = officeWrite<'id', never>('invoices.send', MANAGERS, null, (tx, ctx, _b, { id }) => sendInvoice(tx, ctx, id));
