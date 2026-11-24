import { officeWrite } from '@/lib/api';
import { MANAGERS } from '@/lib/auth';
import { closeJob } from '@/lib/billing';

export const POST = officeWrite<'id', never>('jobs.close', MANAGERS, null, (tx, ctx, _b, { id }) => closeJob(tx, ctx, id));
